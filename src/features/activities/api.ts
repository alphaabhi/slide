import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import type { GameKind } from './prompts'

export type RoundStatus = 'open' | 'revealed' | 'skipped'

export interface RoundResponse {
  user_id: string
  choice: 'a' | 'b' | null
  answer: string | null
}

export interface Round {
  id: string
  space_id: string
  kind: GameKind
  prompt_key: string
  prompt: string
  option_a: string | null
  option_b: string | null
  started_by: string
  status: RoundStatus
  answered_by: string[]
  skipped_by: string | null
  created_at: string
  /** Only what this person may see: their own answer, and both after the reveal. */
  activity_responses: RoundResponse[]
}

const COLUMNS =
  'id, space_id, kind, prompt_key, prompt, option_a, option_b, started_by, status, answered_by, skipped_by, created_at, activity_responses(user_id, choice, answer)'

/** How many recent rounds to keep in view (and to check for repeats). */
export const ROUNDS_LIMIT = 100

export const roundsKey = (spaceId: string) => ['rounds', spaceId] as const

/** Newest first. */
export async function fetchRounds(spaceId: string): Promise<Round[]> {
  const { data, error } = await getSupabase()
    .from('activity_rounds')
    .select(COLUMNS)
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false })
    .limit(ROUNDS_LIMIT)
    .returns<Round[]>()
  if (error) throw error
  return data
}

export function useRounds(spaceId: string) {
  return useQuery({
    queryKey: roundsKey(spaceId),
    queryFn: () => fetchRounds(spaceId),
    // Live updates (and the chat's reconnect/poll fallback) keep this fresh.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

/** Something changed in this space's games: fetch again (answers are only visible via a fetch). */
export function refreshRounds(qc: QueryClient, spaceId: string) {
  return qc.invalidateQueries({ queryKey: roundsKey(spaceId) })
}

async function rpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<Omit<Round, 'activity_responses'>> {
  const { data, error } = await getSupabase().rpc(fn, args)
  if (error) throw error
  return data as Omit<Round, 'activity_responses'>
}

/** Put the server's latest copy of a round in the cache straight away, then refetch answers. */
function useRoundMutation<A>(spaceId: string, call: (args: A) => ReturnType<typeof rpc>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: call,
    onSuccess: (round) => {
      qc.setQueryData<Round[]>(roundsKey(spaceId), (list = []) => {
        const existing = list.find((r) => r.id === round.id)
        const merged: Round = { ...round, activity_responses: existing?.activity_responses ?? [] }
        return existing ? list.map((r) => (r.id === round.id ? merged : r)) : [merged, ...list]
      })
      void refreshRounds(qc, spaceId)
    },
  })
}

export function useStartRound(spaceId: string) {
  return useRoundMutation(
    spaceId,
    (a: { kind: GameKind; key: string; prompt: string; a?: string; b?: string }) =>
      rpc('start_round', {
        p_space_id: spaceId,
        p_kind: a.kind,
        p_prompt_key: a.key,
        p_prompt: a.prompt,
        p_option_a: a.a ?? null,
        p_option_b: a.b ?? null,
      }),
  )
}

export function useAnswerRound(spaceId: string) {
  return useRoundMutation(spaceId, (a: { roundId: string; choice?: 'a' | 'b'; answer?: string }) =>
    rpc('answer_round', {
      p_round_id: a.roundId,
      p_choice: a.choice ?? null,
      p_answer: a.answer ?? null,
    }),
  )
}

export function useSkipRound(spaceId: string) {
  return useRoundMutation(spaceId, (roundId: string) => rpc('skip_round', { p_round_id: roundId }))
}

const errorText: Record<string, string> = {
  round_closed: 'This one’s already finished.',
  space_closed: 'This space has been closed.',
  space_waiting: 'Games start once the other person joins.',
  answer_empty: 'Write an answer first.',
  answer_too_long: 'Keep it under 500 characters.',
  rate_limited: 'That’s a lot of games. Take a breather and try again soon.',
  not_member: 'You’re not in this space.',
}

export function activityErrorMessage(error: unknown): string {
  const e = (error ?? {}) as { message?: string; name?: string; status?: number }
  if (e.message && e.message in errorText) return errorText[e.message]!
  if (e.name === 'TypeError' || e.status === 0) {
    return 'Can’t reach SLIDE right now. Check your connection and try again.'
  }
  return 'Something went wrong. Please try again.'
}

/** What one person sees of a round. */
export interface RoundView {
  round: Round
  mine?: RoundResponse
  theirs?: RoundResponse
  iAnswered: boolean
  theyAnswered: boolean
  /** Open, and waiting on me. */
  myTurn: boolean
}

export function viewRound(round: Round, myId: string): RoundView {
  const mine = round.activity_responses.find((r) => r.user_id === myId)
  const theirs =
    round.status === 'revealed'
      ? round.activity_responses.find((r) => r.user_id !== myId)
      : undefined
  const iAnswered = round.answered_by.includes(myId)
  const theyAnswered = round.answered_by.some((id) => id !== myId)
  return {
    round,
    mine,
    theirs,
    iAnswered,
    theyAnswered,
    myTurn: round.status === 'open' && !iAnswered,
  }
}
