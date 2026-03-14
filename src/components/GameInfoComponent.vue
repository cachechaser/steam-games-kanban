<script setup>
import {computed, ref} from 'vue'
import {useSteam} from '../composables/useSteam'
import AchievementTable from './AchievementTable.vue'
import GameIconImg from './ui/GameIconImg.vue'
import MultiSelectDropdown from './ui/MultiSelectDropdown.vue'
import BaseOverlay from './ui/BaseOverlay.vue'

const props = defineProps({
	game: Object,
	isOpen: Boolean
})

const emit = defineEmits(['close'])

const {getCompletionData, state, copyGameToColumn, removeGameFromColumn, getGameColumns} = useSteam()

const sortBy = ref('unlockRate')
const sortDesc = ref(true)

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

const updateGameColumns = (newColumns) => {
	if (!props.game) return
	const current = gameColumns.value
	// Add new columns
	for (const col of newColumns) {
		if (!current.includes(col)) {
			copyGameToColumn(props.game, col)
		}
	}
	// Remove unchecked columns
	for (const col of current) {
		if (!newColumns.includes(col)) {
			removeGameFromColumn(props.game, col)
		}
	}
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
	<BaseOverlay :show="isOpen && !!game" max-width="900px" :padded="false" @close="close">
		<!-- Header -->
		<template #header>
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
						<MultiSelectDropdown
								mode="dropdown"
								:show-tags="false"
								:options="allColumnNames"
								:model-value="gameColumns"
								@update:model-value="updateGameColumns"
								button-label="Manage Columns"
								button-icon="grip-vertical"
								:min-selected="1"
						/>
						<span class="playtime-badge"><font-awesome-icon icon="clock" /> {{ (game.playtime_forever / 60).toFixed(1) }}h</span>
					</div>
				</div>
			</div>
		</template>

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
	</BaseOverlay>
</template>

<style scoped>
.modal-header-custom {
	padding: 0;
	display: flex;
	align-items: center;
	gap: 20px;
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
