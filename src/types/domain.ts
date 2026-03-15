export type SteamColumn = string | { name: string; color?: string; id?: string }

export interface CompletionData {
  total: number
  achieved: number
  error: string | null
}

export interface GameAchievement {
  apiname: string
  name: string
  description?: string
  achieved: boolean | 0 | 1
  unlocktime?: number
  unlockTime?: number
  icon?: string
  icongray?: string
  iconGray?: string
  unlockPercentage?: number
}

export interface SteamUserProfile {
  steamid?: string
  personaname?: string
  avatar?: string
  avatarfull?: string
  profileurl?: string
  timecreated?: number
  [key: string]: unknown
}

export interface SteamGame {
  appid: number
  name: string
  img_icon_url?: string
  playtime_forever?: number
  playtime_2weeks?: number
  rtime_last_played?: number
  status: string
  hidden?: boolean
  duplicateColumns?: string[]
  loadingStats?: boolean
  loadingDetails?: boolean
  needsUpdate?: boolean
  achievements?: CompletionData | null
  achievementsList?: {
    achievements?: GameAchievement[]
    error?: string
  } | null
  [key: string]: unknown
}

export interface SteamState {
  steamId: string
  apiKey: string
  hasServerApiKey: boolean
  games: SteamGame[]
  columns: SteamColumn[]
  lastUpdated: number
  userProfile: SteamUserProfile | null
  loading: boolean
  error: string | null
}

export interface CollectionImportPayload {
  collections: Array<{ name: string; game_ids: number[] }>
}

