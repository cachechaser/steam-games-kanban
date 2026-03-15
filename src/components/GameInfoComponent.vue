<script setup lang="ts">
import {computed, ref} from 'vue'
import {useSteam} from '@/composables/useSteam'
import AchievementTable from './AchievementTable.vue'
import GameIconImg from './ui/GameIconImg.vue'
import MultiSelectDropdown from './ui/MultiSelectDropdown.vue'
import BaseOverlay from './ui/BaseOverlay.vue'
import type {SteamGame} from '@/types/domain'
import type {AchievementTableRow, SortField} from '@/types/achievementTable'

const props = withDefaults(defineProps<{
	game: SteamGame | null
	isOpen: boolean
}>(), {
	game: null,
	isOpen: false,
})

const emit = defineEmits<{
	(e: 'close'): void
}>()

const {getCompletionData, state, copyGameToColumn, removeGameFromColumn, getGameColumns} = useSteam()
const selectedGame = computed<SteamGame | null>(() => props.game)

const sortBy = ref<SortField>('unlockRate')
const sortDesc = ref(true)

const handleSort = (field: SortField): void => {
	if (sortBy.value === field) {
		sortDesc.value = !sortDesc.value
	} else {
		sortBy.value = field
		sortDesc.value = field !== 'achName'
	}
}

const stats = computed<{ total: number; achieved: number }>(() => {
	const game = selectedGame.value
	if (!game) return {total: 0, achieved: 0}
	return getCompletionData(game)
})

const completionPercentage = computed(() => {
	if (!stats.value.total) return 0
	return Math.round((stats.value.achieved / stats.value.total) * 100)
})

const averageGlobal = computed<string>(() => {
	const game = selectedGame.value
	if (!game?.achievementsList?.achievements?.length) return '0.0'
	const total = game.achievementsList.achievements.reduce((acc, ach) => acc + (ach.unlockPercentage || 0), 0)
	return (total / game.achievementsList.achievements.length).toFixed(1)
})

const allColumnNames = computed<string[]>(() => {
	return state.columns.map(c => typeof c === 'string' ? c : c.name)
})

const gameColumns = computed<string[]>(() => {
	const game = selectedGame.value
	if (!game) return []
	return getGameColumns(game)
})

const updateGameColumns = (newColumns: string[]): void => {
	const game = selectedGame.value
	if (!game) return
	const current = gameColumns.value
	// Add new columns
	for (const col of newColumns) {
		if (!current.includes(col)) {
			copyGameToColumn(game, col)
		}
	}
	// Remove unchecked columns
	for (const col of current) {
		if (!newColumns.includes(col)) {
			removeGameFromColumn(game, col)
		}
	}
}

const sortedAchievements = computed<AchievementTableRow[]>(() => {
	const game = selectedGame.value
	if (!game?.achievementsList?.achievements) return []

	const list: AchievementTableRow[] = [...game.achievementsList.achievements].map(ach => ({
		...ach,
		appid: game.appid,
		gameName: game.name
	}))

	list.sort((a, b) => {
		let cmp: number
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
	<BaseOverlay :show="isOpen && !!selectedGame" max-width="900px" :padded="false" @close="close">
		<!-- Header -->
		<template #header>
			<div class="modal-header-custom">
				<GameIconImg
						:appid="selectedGame?.appid || 0"
						:icon-hash="selectedGame?.img_icon_url"
						size="large"
						class="game-icon-large"
				/>
				<div class="header-text">
					<h2>{{ selectedGame?.name }}</h2>
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
						<span class="playtime-badge"><font-awesome-icon icon="clock" /> {{ (((selectedGame?.playtime_forever) || 0) / 60).toFixed(1) }}h</span>
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
					:sort-by="sortBy as SortField"
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
