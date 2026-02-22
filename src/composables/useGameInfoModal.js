import {ref} from 'vue'

/**
 * Composable for the game info modal open/close logic.
 * Used by BoardView, CompletionView, and AchievementView.
 */
export function useGameInfoModal() {
	const showGameInfo = ref(false)
	const selectedGame = ref(null)

	const openGameInfo = (game) => {
		selectedGame.value = game
		showGameInfo.value = true
	}

	const closeGameInfo = () => {
		showGameInfo.value = false
	}

	return {showGameInfo, selectedGame, openGameInfo, closeGameInfo}
}

