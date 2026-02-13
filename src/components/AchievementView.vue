<script setup>
import {onMounted} from 'vue'
import {useSteam} from '../composables/useSteam'

const {state, loadState, fetchAllAchievements, fetchAchievements} = useSteam()

const achievementColumns = [
	{name: 'Backlog (0%)', min: 0, max: 0, color: '#ff5252'}, // Red
	{name: 'Started (1-24%)', min: 1, max: 24, color: '#ffc83d'}, // Yellow
	{name: 'Quarter (25-49%)', min: 25, max: 49, color: '#a4d007'}, // Light Green
	{name: 'Half (50-74%)', min: 50, max: 74, color: '#66c0f4'}, // Blue
	{name: 'Close (75-99%)', min: 75, max: 99, color: '#be5eff'}, // Purple
	{name: 'Perfect (100%)', min: 100, max: 100, color: '#ffffff'} // White/Gold
]

onMounted(async () => {
	loadState()
	const now = Date.now()
	const lastUpdate = state.lastUpdated || 0
	// Auto-load if stale > 48h
	if (state.games.length > 0 && (now - lastUpdate > 172800000)) {
		await fetchAllAchievements()
	}
})

const getGamesForColumn = (column) => {
	return state.games.filter(g => {
		// Hide hidden games
		if (g.hidden) return false;

		// Exclude games with explicit "No stats" error (and variations)
		if (g.achievements && g.achievements.error &&
				(g.achievements.error === 'No stats available' || g.achievements.error.includes('No stats'))) {
			return false;
		}

		// If no achievements loaded or total is 0, it goes to 0% column
		if (!g.achievements || g.achievements.error || !g.achievements.total) {
			return column.min === 0 && column.max === 0;
		}

		const percentage = Math.round((g.achievements.achieved / g.achievements.total) * 100);
		return percentage >= column.min && percentage <= column.max;
	}).sort((a, b) => {
		// Sort by percentage desc within column
		const pA = a.achievements && a.achievements.total ? (a.achievements.achieved / a.achievements.total) : 0
		const pB = b.achievements && b.achievements.total ? (b.achievements.achieved / b.achievements.total) : 0
		return pB - pA
	})
}

const refreshStats = async () => {
	await fetchAllAchievements(true)
}
</script>

<template>
	<div class="achievement-view">
		<div class="header-bar">
			<h1>Achievement Board</h1>
			<button @click="refreshStats" :disabled="state.loading" class="btn btn-secondary reload-btn">
				{{ state.loading ? 'Loading Stats...' : '↻ Refresh Stats' }}
			</button>
		</div>

		<div class="board-container">
			<div
					v-for="col in achievementColumns"
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
									:src="`http://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`"
									alt="icon"
									class="game-icon"
							/>
							<span class="game-title">{{ game.name }}</span>
						</div>

						<div class="stats">
							<div v-if="game.achievements && !game.achievements.error">
								<div class="achievement-text">
									<span class="ach-count">{{ game.achievements.achieved }} / {{ game.achievements.total }}</span>
									<span class="percentage" :style="{ color: col.color }">
                                    {{ Math.round(game.achievements.achieved / game.achievements.total * 100) }}%
                                </span>
								</div>
								<div class="progress-bar">
									<div class="progress"
									     :style="{ width: (game.achievements.achieved / game.achievements.total * 100) + '%', background: col.color }"></div>
								</div>
							</div>
							<button v-else @click="fetchAchievements(game)" :disabled="game.loadingStats" class="btn btn-secondary btn-small small-btn">
								{{ game.loadingStats ? '...' : 'Load Stats' }}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.achievement-view {
	height: 100%;
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
	width: 100%;
	animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateY(10px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.header-bar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 20px;
	background: rgba(0, 0, 0, 0.2);
	padding: 10px 20px;
	border-radius: 8px;
	box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.reload-btn {
	/* Just inheriting */
}

.board-container {
	flex: 1;
	display: flex;
	gap: 20px;
	overflow-x: auto;
	overflow-y: hidden;
	padding-bottom: 10px;
	scroll-snap-type: x mandatory;
}

.column {
	flex: 0 0 320px;
	min-width: 320px;
	border-top: 4px solid var(--steam-blue-light); /* overridden by inline style */
	transition: transform 0.2s;
	scroll-snap-align: start;
}

.column-header {
	/* Inheriting form global */
}

.card-list {
	flex: 1;
	padding: 15px;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.card {
	padding: 12px;
	/* Removed border, shadow, background as they are in card-panel */
	border: 1px solid transparent; /* Override card-panel? No, card-panel has border. */
}

.card:hover {
	border-color: rgba(255, 255, 255, 0.1);
}

.card-header {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-bottom: 10px;
}

.game-icon {
	width: 32px;
	height: 32px;
	border-radius: 4px;
}

.game-title {
	font-weight: bold;
	font-size: 0.9em;
	line-height: 1.2;
}

.stats {
	font-size: 0.85em;
	color: var(--steam-text-muted);
	background: rgba(0, 0, 0, 0.2);
	padding: 8px;
	border-radius: 4px;
}

.achievement-text {
	display: flex;
	justify-content: space-between;
	margin-bottom: 5px;
}

.percentage {
	font-weight: bold;
}

.progress-bar {
	height: 6px;
	background: #0f1219;
	border-radius: 3px;
	overflow: hidden;
}

.progress {
	height: 100%;
	transition: width 0.5s ease-out;
}

.small-btn {
	width: 100%;
	/* Removed background colors etc as they are in btn-secondary */
}

/* Mobile Adjustments */
@media (max-width: 768px) {
	.header-bar {
		flex-direction: column;
		gap: 10px;
		align-items: stretch;
		text-align: center;
	}

	.column {
		flex: 0 0 85vw;
		width: 85vw;
		min-width: 280px;
	}
}
</style>
