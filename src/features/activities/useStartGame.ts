import { useCallback, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { activityErrorMessage, useStartRound, type Round } from './api'
import { pickPrompt, promptsFor, type ChoicePrompt, type GameKind } from './prompts'

/** Start a game with a prompt this space hasn't played recently. */
export function useStartGame(spaceId: string, rounds: Round[]) {
  const start = useStartRound(spaceId)
  const toast = useToast()
  const [starting, setStarting] = useState<GameKind | null>(null)

  const startGame = useCallback(
    async (kind: GameKind): Promise<Round['id'] | null> => {
      const played = rounds.filter((r) => r.kind === kind).map((r) => r.prompt_key) // newest first
      const p = pickPrompt(promptsFor(kind), played)
      const choice = 'a' in p ? (p as ChoicePrompt) : null
      setStarting(kind)
      try {
        const round = await start.mutateAsync({
          kind,
          key: p.key,
          prompt: p.prompt,
          a: choice?.a,
          b: choice?.b,
        })
        return round.id
      } catch (err) {
        toast.show({
          title: 'Couldn’t start that',
          description: activityErrorMessage(err),
          tone: 'danger',
        })
        return null
      } finally {
        setStarting(null)
      }
    },
    [rounds, start, toast],
  )

  return { startGame, starting }
}

export function scrollToRound(id: string) {
  const el = document.getElementById(`round-${id}`)
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
