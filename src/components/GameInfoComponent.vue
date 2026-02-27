<script setup>
import {computed, ref} from 'vue'
import {useSteam} from '../composables/useSteam'
import AchievementTable from './AchievementTable.vue'
import GameIconImg from './ui/GameIconImg.vue'

const props = defineProps({
	game: Object,
	isOpen: Boolean
})

const emit = defineEmits(['close'])

const {getCompletionData, updateGameStatus, state, copyGameToColumn, removeGameFromColumn, getGameColumns} = useSteam()

const sortBy = ref('unlockRate')
const sortDesc = ref(true)
const dropdownOpen = ref(false)

const handleSort = (field) => {
	if (sortBy.value === field) {
		sortDesc.value = !sortDesc.value
	} else {
		sortBy.value = field
		sortDesc.value = field !== 'achName';
	}
}

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

const allColumnNames = computed(() => {
	return state.columns.map(c => typeof c === 'string' ? c : c.name)
})

const gameColumns = computed(() => {
	if (!props.game) return []
	return getGameColumns(props.game)
})

const toggleColumn = (col) => {
	if (!props.game) return
	if (gameColumns.value.includes(col)) {
		if (gameColumns.value.length <= 1) return
		removeGameFromColumn(props.game, col)
	} else {
		copyGameToColumn(props.game, col)
	}
}

const handleRemoveColumnTag = (col) => {
	if (!props.game) return
	if (gameColumns.value.length <= 1) return
	removeGameFromColumn(props.game, col)
}

const sortedAchievements = computed(() => {
	if (!props.game?.achievementsList?.achievements) return []

	const list = [...props.game.achievementsList.achievements].map(ach => ({
		...ach,
		appid: props.game.appid,
		gameName: props.game.name
	}))

	list.sort((a, b) => {
		let cmp
		switch (sortBy.value) {
			case 'achName':
				cmp = (a.name || '').localeCompare(b.name || '')
				break
			case 'unlockRate':
				cmp = (a.unlockPercentage || 0) - (b.unlockPercentage || 0)
				break
			case 'unlockDate': {
				const tA = a.achieved ? (a.unlocktime || 0) : -1
				const tB = b.achieved ? (b.unlocktime || 0) : -1
				cmp = tA - tB
				break
			}
			default:
				cmp = (a.unlockPercentage || 0) - (b.unlockPercentage || 0)
		}
		return sortDesc.value ? -cmp : cmp
	})

	return list
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
					<GameIconImg
							:appid="game.appid"
							:icon-hash="game.img_icon_url"
							size="large"
							class="game-icon-large"
					/>
					<div class="header-text">
						<h2>{{ game.name }}</h2>
						<div class="badges">
							<!-- Checkbox dropdown -->
							<div class="checkbox-dropdown" v-click-outside="() => dropdownOpen = false">
								<button class="btn btn-secondary btn-sm" @click="dropdownOpen = !dropdownOpen">
									⊞ Manage Columns ▾
								</button>
								<div v-if="dropdownOpen" class="dropdown-menu">
									<label
											v-for="col in allColumnNames"
											:key="col"
											class="dropdown-item"
											:class="{ disabled: gameColumns.includes(col) && gameColumns.length <= 1 }"
									>
										<input
												type="checkbox"
												:checked="gameColumns.includes(col)"
												:disabled="gameColumns.includes(col) && gameColumns.length <= 1"
												@change="toggleColumn(col)"
										/>
										{{ col }}
									</label>
								</div>
							</div>
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
							:sort-by="sortBy"
							:sort-desc="sortDesc"
							@sort="handleSort"
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
	flex-wrap: wrap;
}

.checkbox-dropdown {
	position: relative;
	display: inline-block;
}

.dropdown-trigger {
	font-size: 0.78rem;
	padding: 3px 8px;
	background: rgba(102, 192, 244, 0.08);
	border: 1px solid rgba(102, 192, 244, 0.25);
	border-radius: 4px;
	color: #66c0f4;
	cursor: pointer;
	transition: background 0.2s;

	&:hover {
		background: rgba(102, 192, 244, 0.18);
	}
}

.dropdown-menu {
	position: absolute;
	top: calc(100% + 4px);
	left: 0;
	z-index: 100;
	background: #1b2838;
	border: 1px solid rgba(102, 192, 244, 0.25);
	border-radius: 5px;
	padding: 6px 0;
	min-width: 160px;
	box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
}

.dropdown-item {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 5px 12px;
	font-size: 0.82rem;
	color: #c7d5e0;
	cursor: pointer;
	user-select: none;
	transition: background 0.15s;

	&:hover {
		background: rgba(102, 192, 244, 0.1);
	}

	&.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	input[type="checkbox"] {
		accent-color: #66c0f4;
		cursor: pointer;
	}
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
