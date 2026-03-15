import type { GameAchievement } from '@/types/domain'

export type SortField = '' | 'gameName' | 'achName' | 'rarityTier' | 'unlockRate' | 'avgGlobalRarity' | 'gameCompletion' | 'playtime' | 'unlockDate'

export type VisibleColumn = 'game' | 'achievement' | 'rarityTier' | 'unlockRate' | 'avgGlobalRarity' | 'gameCompletion' | 'playtime' | 'unlockDate'

export type TableColumnOption = {
  key: VisibleColumn
  label: string
  default: boolean
  locked?: boolean
}

export type AchievementTableRow = GameAchievement & {
  appid: number
  gameName?: string
  rarityTier?: { label: string; color: string }
  avgGlobalRarity?: number | null
  gameCompletion?: { achieved: number; total: number; percent: number }
  gamePlaytime?: number
}

export const ACHIEVEMENT_TABLE_COLUMNS: TableColumnOption[] = [
  { key: 'game', label: 'Game', default: true },
  { key: 'achievement', label: 'Achievement', default: true, locked: true },
  { key: 'rarityTier', label: 'Rarity Tier', default: false },
  { key: 'unlockRate', label: 'Global %', default: true },
  { key: 'avgGlobalRarity', label: 'Avg. Global Rarity', default: false },
  { key: 'gameCompletion', label: 'Game Completion', default: false },
  { key: 'playtime', label: 'Playtime', default: false },
  { key: 'unlockDate', label: 'Unlock Date', default: true },
]

export const DEFAULT_VISIBLE_COLUMNS: VisibleColumn[] = ACHIEVEMENT_TABLE_COLUMNS
  .filter(column => column.default)
  .map(column => column.key)


