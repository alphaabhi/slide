import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { refreshRounds } from '@/features/activities/api'
import { getSupabase } from '@/lib/supabase'
import type { Message, OutboxItem, Reaction } from './model'

export const PAGE_SIZE = 50
const COLUMNS =
  'id, space_id, sender_id, client_id, body, created_at, reply_to, message_reactions(user_id, emoji)'

export const messagesKey = (spaceId: string) => ['messages', spaceId] as const
type Pages = InfiniteData<Message[], string | null>

/** One page of history, newest first. `before` = load messages older than this time. */
export async function fetchPage(spaceId: string, before: string | null): Promise<Message[]> {
  let q = getSupabase()
    .from('messages')
    .select(COLUMNS)
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE)
  if (before) q = q.lt('created_at', before)
  const { data, error } = await q.returns<Message[]>()
  if (error) throw error
  return data
}

export function useMessageHistory(spaceId: string) {
  return useInfiniteQuery({
    queryKey: messagesKey(spaceId),
    queryFn: ({ pageParam }) => fetchPage(spaceId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) =>
      last.length === PAGE_SIZE ? last[last.length - 1]!.created_at : undefined,
    // Live updates keep this fresh; refetching every page on focus would be wasteful.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

/** Add messages to the cached history, skipping any already there. */
export function addToCache(qc: QueryClient, spaceId: string, incoming: Message[]) {
  qc.setQueryData<Pages>(messagesKey(spaceId), (data) => {
    if (!data) return data
    const byClient = new Map(incoming.map((m) => [m.client_id, m]))
    const known = new Set<string>()
    let changed = false
    // Known messages: take newer reactions (a catch-up after a drop brings them).
    const pages = data.pages.map((page) =>
      page.map((m) => {
        known.add(m.client_id)
        const next = byClient.get(m.client_id)
        if (!next?.message_reactions || sameReactions(m.message_reactions, next.message_reactions))
          return m
        changed = true
        return { ...m, message_reactions: next.message_reactions }
      }),
    )
    const fresh = incoming.filter((m) => !known.has(m.client_id))
    if (fresh.length === 0 && !changed) return data
    const [first = [], ...rest] = pages
    return { ...data, pages: [[...fresh, ...first], ...rest] }
  })
}

function sameReactions(a: Reaction[] = [], b: Reaction[] = []) {
  if (a.length !== b.length) return false
  return a.every((r) => b.some((x) => x.user_id === r.user_id && x.emoji === r.emoji))
}

/** A reaction was set, changed or removed: update that message in place. */
export function applyReaction(
  qc: QueryClient,
  spaceId: string,
  row: { message_id: string; user_id: string; emoji: string | null },
) {
  qc.setQueryData<Pages>(messagesKey(spaceId), (data) => {
    if (!data) return data
    let found = false
    const pages = data.pages.map((page) =>
      page.map((m) => {
        if (m.id !== row.message_id) return m
        found = true
        const others = (m.message_reactions ?? []).filter((r) => r.user_id !== row.user_id)
        return { ...m, message_reactions: [...others, { user_id: row.user_id, emoji: row.emoji }] }
      }),
    )
    return found ? { ...data, pages } : data
  })
}

/** React to a message (null removes your reaction). Shows instantly; reverts if it fails. */
export function useReact(spaceId: string, myId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: { messageId: string; emoji: string | null }) => {
      const { error } = await getSupabase().rpc('react_to_message', {
        p_message_id: a.messageId,
        p_emoji: a.emoji,
      })
      if (error) throw error
    },
    onMutate: (a) => {
      const before = findMessage(qc, spaceId, a.messageId)?.message_reactions
      applyReaction(qc, spaceId, { message_id: a.messageId, user_id: myId, emoji: a.emoji })
      return { before }
    },
    onError: (_e, a, ctx) => {
      const mineBefore = ctx?.before?.find((r) => r.user_id === myId)?.emoji ?? null
      applyReaction(qc, spaceId, { message_id: a.messageId, user_id: myId, emoji: mineBefore })
    },
  })
}

export function findMessage(qc: QueryClient, spaceId: string, id: string): Message | undefined {
  return qc
    .getQueryData<Pages>(messagesKey(spaceId))
    ?.pages.flat()
    .find((m) => m.id === id)
}

/**
 * The message a reply quotes: from what's already loaded, or fetched on its own
 * (it may be far back in the history).
 */
export function useQuotedMessage(spaceId: string, id: string | undefined) {
  const qc = useQueryClient()
  const cached = id ? findMessage(qc, spaceId, id) : undefined
  const q = useQuery({
    queryKey: ['message', id],
    enabled: !!id && !cached,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('messages')
        .select('id, sender_id, body, client_id, created_at')
        .eq('id', id!)
        .maybeSingle<Pick<Message, 'id' | 'sender_id' | 'body' | 'client_id' | 'created_at'>>()
      if (error) throw error
      return data
    },
  })
  return cached ?? q.data ?? undefined
}

/** Fetch the newest page and merge it in: catches anything missed while disconnected. */
export async function catchUp(qc: QueryClient, spaceId: string) {
  // Games share the connection, so they catch up too.
  void refreshRounds(qc, spaceId)
  addToCache(qc, spaceId, await fetchPage(spaceId, null))
}

export async function sendMessage(
  spaceId: string,
  clientId: string,
  body: string,
  replyTo?: string,
): Promise<Message> {
  const { data, error } = await getSupabase().rpc('send_message', {
    p_space_id: spaceId,
    p_client_id: clientId,
    p_body: body,
    ...(replyTo ? { p_reply_to: replyTo } : {}),
  })
  if (error) throw error
  return data as Message
}

/* ------------------------------------------------------------------ live */

export type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'offline'

/**
 * Streams new messages for one space. Subscribes only to this space, cleans up
 * on leave, catches up after any reconnect, and falls back to checking every
 * few seconds if the live connection can't be made (e.g. a network that blocks
 * websockets), so messages still arrive.
 */
export function useLiveMessages(spaceId: string, onIncoming: (m: Message) => void): LiveStatus {
  const qc = useQueryClient()
  const [status, setStatus] = useState<LiveStatus>(
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'connecting',
  )
  const onIncomingRef = useRef(onIncoming)
  useEffect(() => {
    onIncomingRef.current = onIncoming
  }, [onIncoming])

  useEffect(() => {
    const supabase = getSupabase()
    let channel: RealtimeChannel | null = null
    // Mutable connection state for this subscription only.
    const conn = {
      wasLive: false,
      downSince: null as number | null,
      poll: undefined as number | undefined,
    }

    const stopPolling = () => {
      window.clearInterval(conn.poll)
      conn.poll = undefined
    }
    const startPolling = () => {
      if (conn.poll !== undefined) return
      conn.poll = window.setInterval(() => {
        if (navigator.onLine) void catchUp(qc, spaceId).catch(() => {})
      }, 5000)
    }

    channel = supabase
      .channel(`space:${spaceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `space_id=eq.${spaceId}` },
        (payload) => {
          const m = payload.new as Message
          addToCache(qc, spaceId, [m])
          onIncomingRef.current(m)
        },
      )
      // A reaction was added, changed or removed.
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
          filter: `space_id=eq.${spaceId}`,
        },
        (payload) => {
          const r = payload.new as { message_id?: string; user_id?: string; emoji?: string | null }
          if (r?.message_id && r.user_id) {
            applyReaction(qc, spaceId, {
              message_id: r.message_id,
              user_id: r.user_id,
              emoji: r.emoji ?? null,
            })
          }
        },
      )
      // A game started, answered, revealed or skipped: refetch (answers are never streamed).
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_rounds',
          filter: `space_id=eq.${spaceId}`,
        },
        () => void refreshRounds(qc, spaceId),
      )
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') {
          stopPolling()
          conn.downSince = null
          setStatus('live')
          // After a drop, fetch anything sent while we were away.
          if (conn.wasLive) void catchUp(qc, spaceId).catch(() => {})
          conn.wasLive = true
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          conn.downSince ??= Date.now()
          setStatus(navigator.onLine ? 'reconnecting' : 'offline')
          startPolling()
        }
      })

    // If the live connection hasn't come up within 4 s, start the fallback anyway.
    const fallback = window.setTimeout(() => {
      if (!conn.wasLive) startPolling()
    }, 4000)

    const goOffline = () => setStatus('offline')
    const goOnline = () => {
      setStatus(conn.wasLive && conn.downSince === null ? 'live' : 'reconnecting')
      void catchUp(qc, spaceId).catch(() => {})
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)

    return () => {
      window.clearTimeout(fallback)
      stopPolling()
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [qc, spaceId])

  return status
}

/* ---------------------------------------------------------------- outbox */

type OutboxAction =
  | { type: 'add'; item: OutboxItem }
  | { type: 'status'; clientId: string; status: OutboxItem['status']; error?: string }
  | { type: 'remove'; clientId: string }

function outboxReducer(state: OutboxItem[], a: OutboxAction): OutboxItem[] {
  switch (a.type) {
    case 'add':
      return [...state, a.item]
    case 'status':
      return state.map((o) =>
        o.clientId === a.clientId ? { ...o, status: a.status, error: a.error } : o,
      )
    case 'remove':
      return state.filter((o) => o.clientId !== a.clientId)
  }
}

const outboxKey = (spaceId: string) => `slide.outbox.${spaceId}`

function loadOutbox(spaceId: string): OutboxItem[] {
  try {
    const raw = window.sessionStorage.getItem(outboxKey(spaceId))
    return raw ? (JSON.parse(raw) as OutboxItem[]) : []
  } catch {
    return []
  }
}

/** Errors a retry can't fix: show the reason instead of a retry loop. */
const permanentErrors: Record<string, string> = {
  space_closed: 'This space has closed, so this message can’t be sent.',
  not_member: 'You’re no longer in this space.',
  message_too_long: 'Too long. Messages can be up to 4,000 characters.',
  message_empty: 'Empty messages can’t be sent.',
  rate_limited: 'You’re sending very fast. Wait a moment, then tap Retry.',
  reply_invalid: 'The message you replied to isn’t available any more.',
}

/**
 * Messages typed here but not yet confirmed by the server. They survive a
 * refresh (sessionStorage) and are re-sent with the same id, which the server
 * treats as the same message, so a retry can never create a duplicate.
 */
export function useOutbox(spaceId: string, onConfirmed: (m: Message) => void) {
  const qc = useQueryClient()
  const [items, dispatch] = useReducer(outboxReducer, spaceId, loadOutbox)
  const inFlight = useRef(new Set<string>())
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    try {
      if (items.length) window.sessionStorage.setItem(outboxKey(spaceId), JSON.stringify(items))
      else window.sessionStorage.removeItem(outboxKey(spaceId))
    } catch {
      // Best effort only.
    }
  }, [items, spaceId])

  const deliver = useCallback(
    async (item: Pick<OutboxItem, 'clientId' | 'body' | 'replyTo'>) => {
      if (inFlight.current.has(item.clientId)) return // ignore double taps on Retry
      inFlight.current.add(item.clientId)
      dispatch({ type: 'status', clientId: item.clientId, status: 'sending' })
      try {
        const saved = await sendMessage(spaceId, item.clientId, item.body, item.replyTo)
        addToCache(qc, spaceId, [saved])
        dispatch({ type: 'remove', clientId: item.clientId })
        onConfirmed(saved)
      } catch (err) {
        const code = (err as { message?: string }).message ?? ''
        dispatch({
          type: 'status',
          clientId: item.clientId,
          status: 'failed',
          error: permanentErrors[code],
        })
        if (code === 'space_closed' || code === 'not_member') {
          void qc.invalidateQueries({ queryKey: ['space', spaceId] })
        }
      } finally {
        inFlight.current.delete(item.clientId)
      }
    },
    [qc, spaceId, onConfirmed],
  )

  const send = useCallback(
    (body: string, replyTo?: string) => {
      const item: OutboxItem = {
        clientId: crypto.randomUUID(),
        body,
        createdAt: new Date().toISOString(),
        status: 'sending',
        ...(replyTo ? { replyTo } : {}),
      }
      dispatch({ type: 'add', item })
      void deliver(item)
    },
    [deliver],
  )

  const retry = useCallback(
    (clientId: string) => {
      const item = itemsRef.current.find((o) => o.clientId === clientId)
      if (item) void deliver(item)
    },
    [deliver],
  )

  // Anything left over from before a refresh, and anything that failed while
  // offline, is re-sent once when we're (back) online. Safe: same ids.
  useEffect(() => {
    const resend = () => {
      for (const o of itemsRef.current) {
        if (o.status === 'sending' || (o.status === 'failed' && !o.error)) void deliver(o)
      }
    }
    resend()
    window.addEventListener('online', resend)
    return () => window.removeEventListener('online', resend)
  }, [deliver])

  return { items, send, retry }
}
