import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'

export interface Profile {
  id: string
  display_name: string
  avatar: string | null
}

export interface ProfileInput {
  display_name: string
  avatar: string | null
}

const COLUMNS = 'id, display_name, avatar'

export const profileKey = (userId: string) => ['profile', userId] as const

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select(COLUMNS)
    .eq('id', userId)
    .maybeSingle<Profile>()
  if (error) throw error
  return data
}

export const myProfileQuery = (userId: string) => ({
  queryKey: profileKey(userId),
  queryFn: () => fetchMyProfile(userId),
})

/** The signed-in user's profile, or null if they haven't chosen a name yet. */
export function useMyProfile(userId: string) {
  return useQuery(myProfileQuery(userId))
}

/**
 * Creates the profile on first sign-in, or updates it afterwards.
 * The row id is never sent: the database takes it from the verified session.
 */
export function useSaveProfile(userId: string, exists: boolean) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ProfileInput): Promise<Profile> => {
      // A fresh builder per request: postgrest builders mutate their URL as filters are added.
      const profiles = () => getSupabase().from('profiles')
      const update = () =>
        profiles().update(input).eq('id', userId).select(COLUMNS).single<Profile>()
      const { data, error } = exists
        ? await update()
        : await profiles().insert(input).select(COLUMNS).single<Profile>()
      // A duplicate means the profile already exists (e.g. created in another tab): update instead.
      if (error?.code === '23505') {
        const retry = await update()
        if (retry.error) throw retry.error
        return retry.data
      }
      if (error) throw error
      return data
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKey(userId), profile)
      // Spaces show your avatar too.
      void queryClient.invalidateQueries({ queryKey: ['space'] })
    },
  })
}
