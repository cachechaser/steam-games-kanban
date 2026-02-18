<script setup>
import {computed} from 'vue'
import {useSteam} from '../composables/useSteam'
import AchievementTable from './AchievementTable.vue'

const props = defineProps({
	game: Object,
	isOpen: Boolean
})

const emit = defineEmits(['close'])

const {getCompletionData, updateGameStatus, state} = useSteam()

const stats = computed(() => {
	if (!props.game) return {total: 0, achieved: 0}
	return getCompletionData(props.game)
})

const completionPercentage = computed(() => {
	if (!stats.value.total) return 0
	return Math.round((stats.value.achieved / stats.value.total) * 100)
})

const averageGlobal = computed(() => {
	if (!props.game?.achievementsList?.achievements?.length) return 0
	const total = props.game.achievementsList.achievements.reduce((acc, ach) => acc + (ach.unlockPercentage || 0), 0)
	return (total / props.game.achievementsList.achievements.length).toFixed(1)
})

const sortedAchievements = computed(() => {
	if (!props.game?.achievementsList?.achievements) return []
	// Sort by achieved (unlocked first), then unlock time (desc), then global rarity (rare first)
	const list = [...props.game.achievementsList.achievements].sort((a, b) => {
		if (a.achieved !== b.achieved) return a.achieved ? -1 : 1
		if (a.achieved && b.achieved) {
			return b.unlocktime - a.unlocktime
		}
		return a.unlockPercentage - b.unlockPercentage
	})

	// Map to structure expected by AchievementTable
	// It expects: appid, gameName, name, description, achieved, unlockTime/unlocktime, icon, iconGray/icongray, unlockPercentage
	return list.map(ach => ({
		...ach,
		appid: props.game.appid,
		gameName: props.game.name
	}))
})

const close = () => {
	emit('close')
}
</script>

<template>
	<transition name="fade">
		<div v-if="isOpen && game" class="modal-overlay" @click.self="close">
			<div class="modal-content game-info-modal">
				<button class="close-btn-abs" @click="close">×</button>

				<!-- Header -->
				<div class="modal-header-custom">
					<img
							v-if="game.img_icon_url"
							:src="`//media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`"
							class="game-icon-large"
							alt=""
					/>
					<div class="header-text">
						<h2>{{ game.name }}</h2>
						<div class="badges">
							<select v-model="game.status" @change="updateGameStatus(game, game.status)" class="status-select">
								<option v-for="col in state.columns" :key="typeof col === 'string' ? col : col.name" :value="typeof col === 'string' ? col : col.name">
									{{ typeof col === 'string' ? col : col.name }}
								</option>
							</select>
							<span class="playtime-badge">🕒 {{ (game.playtime_forever / 60).toFixed(1) }}h</span>
						</div>
					</div>
				</div>

				<!-- Stats Grid -->
				<div class="stats-grid">
					<div class="stat-box">
						<span class="stat-val">{{ stats.achieved }} / {{ stats.total }}</span>
						<span class="stat-label">Achievements</span>
					</div>
					<div class="stat-box" :style="{ color: completionPercentage === 100 ? '#ffc83d' : '#66c0f4' }">
						<span class="stat-val">{{ completionPercentage }}%</span>
						<span class="stat-label">Completion</span>
					</div>
					<div class="stat-box">
						<span class="stat-val">{{ averageGlobal }}%</span>
						<span class="stat-label">Avg. Global Rarity</span>
					</div>
				</div>

				<!-- Achievements List -->
				<div class="achievements-scroll">
					<h3>All Achievements</h3>
					<div v-if="sortedAchievements.length === 0" class="empty-text">
						No achievement data available.
					</div>

					<AchievementTable
							:achievements="sortedAchievements"
							:show-game-column="false"
					/>
				</div>
			</div>
		</div>
	</transition>
</template>

<style scoped>
.game-info-modal {
	max-width: 900px;
	width: 95%;
	max-height: 90vh;
	display: flex;
	flex-direction: column;
	padding: 0;
	overflow: hidden;
	position: relative;
	background: #1b2838;
}

.close-btn-abs {
	position: absolute;
	top: 15px;
	right: 15px;
	background: transparent;
	border: none;
	color: #fff;
	font-size: 1.5rem;
	cursor: pointer;
	z-index: 10;
}

.modal-header-custom {
	padding: 25px;
	background: linear-gradient(to right, #171a21, #2a475e);
	display: flex;
	align-items: center;
	gap: 20px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.game-icon-large {
	width: 64px;
	height: 64px;
	border-radius: 8px;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.header-text h2 {
	margin: 0 0 8px 0;
	font-size: 1.5rem;
	color: #fff;
}

.badges {
	display: flex;
	gap: 10px;
	align-items: center;
}

.status-select {
	font-size: 0.85rem;
	padding: 4px 8px;
	background: rgba(0, 0, 0, 0.3);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 4px;
	color: #c7d5e0;
	cursor: pointer;
}

.status-select option {
	background: #1b2838;
}

.playtime-badge {
	font-size: 0.85rem;
	padding: 4px 8px;
	background: rgba(0, 0, 0, 0.3);
	border-radius: 4px;
	color: #c7d5e0;
}

.stats-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	padding: 20px;
	gap: 15px;
	background: rgba(0, 0, 0, 0.2);
}

.stat-box {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	background: rgba(255, 255, 255, 0.05);
	padding: 15px;
	border-radius: 6px;
}

.stat-val {
	font-size: 1.5rem;
	font-weight: bold;
	color: #fff;
}

.stat-label {
	font-size: 0.8rem;
	color: #8f98a0;
	text-transform: uppercase;
	margin-top: 5px;
}

.achievements-scroll {
	flex: 1;
	overflow-y: auto;
	padding: 0 20px 20px 20px;
}

.achievements-scroll h3 {
	margin-top: 20px;
	color: #66c0f4;
	font-size: 1.1rem;
	margin-bottom: 15px;
}

.empty-text {
	color: #666;
	font-style: italic;
	padding: 10px;
}
</style>
