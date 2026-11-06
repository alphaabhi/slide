/**
 * SLIDE's illustrated avatars. Artwork: "Adventurer" by Lisa Wischofsky,
 * CC BY 4.0 (see public/avatars/LICENSE.txt). The names are original and only
 * appear in the picker; everywhere else people are shown by their own display
 * name. Keys must match the database check in *_avatars.sql.
 */
export const AVATARS = [
  { key: 'kai', name: 'Kai' },
  { key: 'rin', name: 'Rin' },
  { key: 'haru', name: 'Haru' },
  { key: 'sora', name: 'Sora' },
  { key: 'mika', name: 'Mika' },
  { key: 'jin', name: 'Jin' },
  { key: 'yuna', name: 'Yuna' },
  { key: 'ren', name: 'Ren' },
  { key: 'aiko', name: 'Aiko' },
  { key: 'taro', name: 'Taro' },
  { key: 'nori', name: 'Nori' },
  { key: 'emi', name: 'Emi' },
] as const

export type AvatarKey = (typeof AVATARS)[number]['key']

export function isAvatarKey(v: unknown): v is AvatarKey {
  return typeof v === 'string' && AVATARS.some((a) => a.key === v)
}

export function avatarSrc(key: AvatarKey): string {
  return `/avatars/${key}.svg`
}

export const AVATAR_CREDIT = {
  text: 'Avatars: “Adventurer” by Lisa Wischofsky, CC BY 4.0',
  href: 'https://creativecommons.org/licenses/by/4.0/',
}
