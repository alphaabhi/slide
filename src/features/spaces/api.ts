import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'

/* ------------------------------------------------------------------ types */

interface MemberRow {
  user_id: string
  joined_at: string
  profiles: { display_name: string } | null
}

interface InvitationRow {
  expires_at: string
  revoked_at: string | null
  accepted_at: string | null
}

interface SpaceRow {
  id: string
  title: string | null
  status: 'active' | 'closed'
  created_at: string
  created_by: string
  space_members: MemberRow[]
  invitations?: InvitationRow[]
}

export type SpacePhase = 'waiting' | 'together' | 'closed'

export interface Space {
  id: string
  title: string | null
  phase: SpacePhase
  createdAt: string
  iCreatedIt: boolean
  partner: { id: string; name: string } | null
  /** The invite that can still be used, if any (waiting spaces only). */
  openInvite: { expiresAt: string } | null
}

export type InvitePreview =
  | { status: 'valid'; inviter_name: string | null; space_title: string | null; expires_at: string }
  | { status: 'own' | 'member'; space_id: string }
  | { status: 'not_found' | 'expired' | 'revoked' | 'used' | 'full' | 'closed' }

/* --------------------------------------------------------------- mapping */

const SPACE_COLUMNS =
  'id, title, status, created_at, created_by, space_members(user_id, joined_at, profiles(display_name)), invitations(expires_at, revoked_at, accepted_at)'

export function toSpace(row: SpaceRow, myId: string): Space {
  const partnerRow = row.space_members.find((m) => m.user_id !== myId)
  const now = Date.now()
  const open = (row.invitations ?? []).find(
    (i) => !i.revoked_at && !i.accepted_at && new Date(i.expires_at).getTime() > now,
  )
  const phase: SpacePhase =
    row.status === 'closed' ? 'closed' : row.space_members.length >= 2 ? 'together' : 'waiting'
  return {
    id: row.id,
    title: row.title,
    phase,
    createdAt: row.created_at,
    iCreatedIt: row.created_by === myId,
    partner: partnerRow
      ? { id: partnerRow.user_id, name: partnerRow.profiles?.display_name ?? 'Someone' }
      : null,
    openInvite: phase === 'waiting' && open ? { expiresAt: open.expires_at } : null,
  }
}

/** What to call a space when it has no title. */
export function spaceLabel(space: Space): string {
  if (space.title) return space.title
  if (space.partner) return `You & ${space.partner.name}`
  return 'Your new space'
}

export function inviteLink(token: string): string {
  return `${window.location.origin}/i/${token}`
}

export function inviteMessage(token: string): string {
  return `Enough of the dating-app chat. Come slide into my space 👉 ${inviteLink(token)}`
}

/* ------------------------------------------------------------------ errors */

const errorText: Record<string, string> = {
  invite_not_found:
    'This invite link doesn’t work. Check you copied all of it, or ask for a new one.',
  invite_expired: 'This invite has expired. Ask the person who sent it for a new link.',
  invite_revoked: 'This invite was cancelled. Ask the person who sent it for a new link.',
  invite_used: 'Someone has already joined with this link. Each space is for exactly two people.',
  space_full: 'This space already has two people in it.',
  space_closed: 'This space has been closed.',
  invite_own: 'This is your own invite. Send it to the person you want to talk to.',
  not_member: 'You’re not in this space.',
  rate_limited: 'You’ve done that a lot today. Please try again tomorrow.',
  profile_required: 'Choose a display name first.',
  not_signed_in: 'Sign in to continue.',
}

export function spaceErrorMessage(error: unknown): string {
  const e = (error ?? {}) as { message?: string; name?: string; status?: number; code?: string }
  const key = e.message ?? ''
  if (key in errorText) return errorText[key]!
  if (e.code === '23514')
    return 'That name isn’t allowed. Use up to 60 letters, numbers, spaces or emoji.'
  if (e.name === 'TypeError' || e.status === 0) {
    return 'Can’t reach SLIDE right now. Check your connection and try again.'
  }
  return 'Something went wrong. Please try again.'
}

/* ------------------------------------------------------------------ queries */

export const spacesKey = (userId: string) => ['spaces', userId] as const
export const spaceKey = (spaceId: string) => ['space', spaceId] as const

export function useMySpaces(userId: string) {
  return useQuery({
    queryKey: spacesKey(userId),
    queryFn: async (): Promise<Space[]> => {
      const { data, error } = await getSupabase()
        .from('spaces')
        .select(SPACE_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(50)
        .returns<SpaceRow[]>()
      if (error) throw error
      return data.map((row) => toSpace(row, userId))
    },
  })
}

export function useSpace(spaceId: string, userId: string) {
  return useQuery({
    queryKey: spaceKey(spaceId),
    queryFn: async (): Promise<Space | null> => {
      const { data, error } = await getSupabase()
        .from('spaces')
        .select(SPACE_COLUMNS)
        .eq('id', spaceId)
        .maybeSingle<SpaceRow>()
      if (error) throw error
      return data ? toSpace(data, userId) : null
    },
    // While waiting for the other person, check every few seconds so their
    // arrival shows up without a refresh. (Live updates arrive in stage 4.)
    refetchInterval: (q) => (q.state.data?.phase === 'waiting' ? 6000 : false),
    refetchOnWindowFocus: true,
  })
}

/* ---------------------------------------------------------------- actions */

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn, args)
  if (error) throw error
  return data as T
}

export function useCreateSpace(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (title: string) =>
      rpc<{ space_id: string; invite_token: string }>('create_space', { p_title: title || null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: spacesKey(userId) }),
  })
}

export function useRotateInvite(spaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      rpc<{ invite_token: string; expires_at: string }>('rotate_invitation', {
        p_space_id: spaceId,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: spaceKey(spaceId) }),
  })
}

export function useRevokeInvite(spaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => rpc<null>('revoke_invitation', { p_space_id: spaceId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: spaceKey(spaceId) }),
  })
}

export function useLeaveSpace(spaceId: string, userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => rpc<{ deleted: boolean }>('leave_space', { p_space_id: spaceId }),
    onSuccess: () => {
      qc.removeQueries({ queryKey: spaceKey(spaceId) })
      return qc.invalidateQueries({ queryKey: spacesKey(userId) })
    },
  })
}

export function getInvitation(token: string): Promise<InvitePreview> {
  return rpc<InvitePreview>('get_invitation', { p_token: token })
}

export function acceptInvitation(
  token: string,
): Promise<{ space_id: string; already_member: boolean }> {
  return rpc('accept_invitation', { p_token: token })
}
