<script setup>
import {onMounted} from 'vue'
import {useSteam} from '../composables/useSteam'

const {state, loadState, fetchAllAchievementsDetailed, fetchAchievements} = useSteam()

const completionColumns = [
	{name: 'Backlog (0%)', min: 0, max: 0, color: '#ff5252'}, // Red
	{name: 'Started (1-24%)', min: 1, max: 24, color: '#ffc83d'}, // Yellow
	{name: 'Quarter (25-49%)', min: 25, max: 49, color: '#a4d007'}, // Light Green
	{name: 'Half (50-74%)', min: 50, max: 74, color: '#66c0f4'}, // Blue
	{name: 'Close (75-99%)', min: 75, max: 99, color: '#be5eff'}, // Purple
	{name: 'Perfect (100%)', min: 100, max: 100, color: '#ffffff'} // White/Gold
]

const refreshStats = async () => {
	await fetchAllAchievementsDetailed(true)
}

onMounted(async () => {
	await loadState()
	const now = Date.now()
	const lastUpdate = state.lastUpdated || 0

	// Check if any game has detailed achievement data loaded
	const hasStats = state.games.some(g => g.achievementsList && g.achievementsList.achievements && g.achievementsList.achievements.length > 0)

	// Auto-load if stale > 48h
	if (state.games.length > 0 && (now - lastUpdate > 172800000 || !hasStats)) {
		await fetchAllAchievementsDetailed()
	}
})

// Helper to calculate percentage from the detailed list if available, or fallback to simple stats
const getCompletionData = (game) => {
    // If detailed list exists
    if (game.achievementsList && game.achievementsList.achievements) {
        const total = game.achievementsList.achievements.length
        const achieved = game.achievementsList.achievements.filter(a => a.achieved).length
        return { total, achieved, error: null }
    }
    // Fallback to simple stats if they exist (legacy)
    if (game.achievements) {
        return game.achievements
    }
    return { total: 0, achieved: 0, error: null }
}

const getGamesForColumn = (column) => {
	return state.games.filter(g => {
		// Hide hidden games
		if (g.hidden) return false;

        const stats = getCompletionData(g)

		// Exclude games with explicit "No stats" error (and variations)
		if (stats.error && (stats.error === 'No stats available' || stats.error.includes('No stats'))) {
			return false;
		}

		// If no achievements loaded or total is 0, it goes to 0% column (Backlog)
		if (!stats || stats.error || !stats.total) {
			return column.min === 0 && column.max === 0;
		}

		const percentage = Math.round((stats.achieved / stats.total) * 100);
		return percentage >= column.min && percentage <= column.max;
	}).sort((a, b) => {
		// Sort by percentage desc within column
		const statsA = getCompletionData(a)
		const statsB = getCompletionData(b)

		const pA = statsA.total ? (statsA.achieved / statsA.total) : 0
		const pB = statsB.total ? (statsB.achieved / statsB.total) : 0
		return pB - pA
	})
}
</script>

<template>
	<div class="completion-view">
		<div class="header-bar">
			<h1>Completion Board</h1>
			<button @click="refreshStats" :disabled="state.loading" class="btn btn-secondary reload-btn">
				{{ state.loading ? 'Updating Stats...' : '↻ Refresh Stats' }}
			</button>
		</div>

		<div class="board-container">
			<div
					v-for="col in completionColumns"
					:key="col.name"
					class="kanban-column column"
					:style="{ borderTopColor: col.color }"
			>
				<div class="column-header">
					<h2>{{ col.name }} <span class="column-count">{{ getGamesForColumn(col).length }}</span></h2>
				</div>
				<div class="card-list">
					<div v-for="game in getGamesForColumn(col)" :key="game.appid" class="card-panel card-hover card">
						<div class="card-header">
							<img
									v-if="game.img_icon_url"
									:src="`//media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`"
									alt="icon"
									class="game-icon"
							/>
							<span class="game-title">{{ game.name }}</span>
						</div>

						<div class="stats">
						    <!-- Use computed stats -->
						    <div v-if="getCompletionData(game).total > 0">
								<div class="achievement-text">
									<span class="ach-count">{{ getCompletionData(game).achieved }} / {{ getCompletionData(game).total }}</span>
									<span class="percentage" :style="{ color: col.color }">
                                    {{ Math.round(getCompletionData(game).achieved / getCompletionData(game).total * 100) }}%
                                </span>
								</div>
								<div class="progress-bar">
									<div class="progress"
									     :style="{ width: (getCompletionData(game).achieved / getCompletionData(game).total * 100) + '%', background: col.color }"></div>
								</div>
							</div>

							<div v-else-if="getCompletionData(game).error" class="error-text">
							    {{ getCompletionData(game).error }}
							</div>

							<button v-else @click="fetchAllAchievementsDetailed(true)" :disabled="game.loadingDetails" class="btn btn-secondary btn-small small-btn">
								{{ game.loadingDetails ? '...' : 'Load Stats' }}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
