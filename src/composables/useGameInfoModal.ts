import {ref} from 'vue'
import type { SteamGame } from '@/types/domain'

/**
 * Composable for the game info modal open/close logic.
 * Used by BoardView, CompletionView, and AchievementView.
 */
export function useGameInfoModal() {
	const showGameInfo = ref(false)
	const selectedGame = ref<SteamGame | null>(null)

	const openGameInfo = (game: SteamGame) => {
		selectedGame.value = game
		showGameInfo.value = true
	}

	const closeGameInfo = () => {
		showGameInfo.value = false
	}

	return {showGameInfo, selectedGame, openGameInfo, closeGameInfo}
}


