import {onMounted} from 'vue'
import {useSteam} from './useSteam.js'

/**
 * Composable that auto-loads achievement stats on mount if stale (>48h) or missing.
 * Uses refreshLibrary which smartly fetches only games that changed since last refresh.
 * Used by BoardView, CompletionView, ProfileView, and AchievementView.
 */
export function useStatsAutoLoad() {
	const steam = useSteam()
	const {state, refreshLibrary} = steam

	const autoLoadStats = async () => {
		await steam.loadState()

		const now = Date.now()
		const lastUpdate = state.lastUpdated || 0
		const hasStats = state.games.some(
			g => g.achievementsList && g.achievementsList.achievements && g.achievementsList.achievements.length > 0
		)

		// Auto-refresh if stale > 48h or no stats present
		if (state.games.length > 0 && (now - lastUpdate > 172800000 || !hasStats)) {
			await refreshLibrary()
		}
	}

	onMounted(autoLoadStats)

	return steam
}

