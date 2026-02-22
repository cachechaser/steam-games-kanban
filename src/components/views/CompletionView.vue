<script setup>
import {computed} from 'vue'
import {useStatsAutoLoad} from '@/composables/useStatsAutoLoad.js'
import {useGameInfoModal} from '@/composables/useGameInfoModal.js'
import GameInfoComponent from '../GameInfoComponent.vue'
import GameCard from '../ui/GameCard.vue'
import KanbanColumn from '../ui/KanbanColumn.vue'
import ViewHeader from '../ui/ViewHeader.vue'

const {state, refreshLibrary, toggleGameVisibility} = useStatsAutoLoad()
const {showGameInfo, selectedGame, openGameInfo, closeGameInfo} = useGameInfoModal()

const completionColumns = [
	{name: 'Backlog (0%)', min: 0, max: 0, color: '#ff5252'}, // Red
	{name: 'Started (1-24%)', min: 1, max: 24, color: '#ffc83d'}, // Yellow
	{name: 'Quarter (25-49%)', min: 25, max: 49, color: '#a4d007'}, // Light Green
	{name: 'Half (50-74%)', min: 50, max: 74, color: '#66c0f4'}, // Blue
	{name: 'Close (75-99%)', min: 75, max: 99, color: '#be5eff'}, // Purple
	{name: 'Perfect (100%)', min: 100, max: 100, color: '#ffffff'} // White/Gold
]



// Helper to calculate percentage from the detailed list if available, or fallback to simple stats
const getCompletionData = (game) => {
	// If detailed list exists
	if (game.achievementsList && game.achievementsList.achievements) {
		const total = game.achievementsList.achievements.length
		const achieved = game.achievementsList.achievements.filter(a => a.achieved).length
		return {total, achieved, error: null}
	}
	// Fallback to simple stats if they exist (legacy)
	if (game.achievements) {
		return game.achievements
	}
	return {total: 0, achieved: 0, error: null}
}

const processedColumns = computed(() => {
	// Create map for games
	const gamesByCol = new Map(completionColumns.map(c => [c.name, []]))

	// Single pass through games
	state.games.forEach(g => {
		if (g.hidden) return

		const stats = getCompletionData(g)

		// Exclude games with errors or no achievements
		if (stats.error || stats.total === 0) {
			return;
		}

		let percentage = 0
		if (stats && !stats.error && stats.total > 0) {
			percentage = Math.round((stats.achieved / stats.total) * 100)
		}

		// Find column
		const col = completionColumns.find(c => percentage >= c.min && percentage <= c.max)
		if (col) {
			gamesByCol.get(col.name).push(g)
		}
	})

	// Sort and return structure
	return completionColumns.map(col => {
		const games = gamesByCol.get(col.name)
		games.sort((a, b) => {
			const statsA = getCompletionData(a)
			const statsB = getCompletionData(b)

			const pA = statsA.total ? (statsA.achieved / statsA.total) : 0
			const pB = statsB.total ? (statsB.achieved / statsB.total) : 0
			return pB - pA
		})

		return {
			...col,
			games
		}
	})
})

</script>

<template>
	<div class="completion-view">
		<GameInfoComponent
				:game="selectedGame"
				:is-open="showGameInfo"
				@close="closeGameInfo"
		/>

		<ViewHeader title="Completion Board">
			<template #actions>
				<button @click="refreshLibrary" :disabled="state.loading" class="btn btn-secondary reload-btn">
					{{ state.loading ? 'Updating Stats...' : '↻ Refresh Stats' }}
				</button>
			</template>
		</ViewHeader>

		<div class="board-container">
			<KanbanColumn
					v-for="col in processedColumns"
					:key="col.name"
					:name="col.name"
					:color="col.color"
					:count="col.games.length"
			>
				<GameCard
						v-for="game in col.games"
						:key="game.appid"
						:game="game"
						:completion-data="getCompletionData(game)"
						:column-color="col.color"
						:loading-details="game.loadingDetails"
						@info="openGameInfo"
						@hide="toggleGameVisibility"
						@load-stats="() => refreshLibrary()"
				/>
			</KanbanColumn>
		</div>
	</div>
</template>
