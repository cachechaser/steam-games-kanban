<script setup>
import {ref, computed, watch} from 'vue'
import GameInfoComponent from '../GameInfoComponent.vue'
import AchievementTable from '../AchievementTable.vue'
import MultiSelectDropdown from '../ui/MultiSelectDropdown.vue'
import ViewHeader from "@/components/ui/ViewHeader.vue";
import {useGameInfoModal} from "@/composables/useGameInfoModal.js";
import {useStatsAutoLoad} from "@/composables/useStatsAutoLoad.js";

const {showGameInfo, selectedGame, openGameInfo, closeGameInfo} = useGameInfoModal()
const {state, refreshLibrary, getCompletionData} = useStatsAutoLoad()

// Data
const currentPage = ref(1)
const achievementsPerPage = 50

// Filters
const filterLocked = ref('all')
const filterPlayedOnly = ref(false)
const filterColumns = ref([])
const sortBy = ref('unlockRate')
const sortDesc = ref(true)
const gameSearch = ref('')
const rarityMin = ref(0)
const rarityMax = ref(100)
const showFilters = ref(false)

// Column visibility
const allTableColumns = [
	{key: 'game', label: 'Game', default: true},
	{key: 'achievement', label: 'Achievement', default: true, locked: true},
	{key: 'rarityTier', label: 'Rarity Tier', default: false},
	{key: 'unlockRate', label: 'Global %', default: true},
	{key: 'avgGlobalRarity', label: 'Avg. Global Rarity', default: false},
	{key: 'gameCompletion', label: 'Game Completion', default: false},
	{key: 'playtime', label: 'Playtime', default: false},
	{key: 'unlockDate', label: 'Unlock Date', default: true},
]
const visibleColumns = ref(allTableColumns.filter(c => c.default).map(c => c.key))


// Rarity tier helper
const getRarityTier = (pct) => {
	if (pct <= 5) return {label: 'Ultra Rare', color: '#ffc83d'}
	if (pct <= 15) return {label: 'Rare', color: '#be5eff'}
	if (pct <= 35) return {label: 'Uncommon', color: '#66c0f4'}
	if (pct <= 60) return {label: 'Common', color: '#a4d007'}
	return {label: 'Very Common', color: '#8f98a0'}
}

// Pre-compute game completion map
const gameCompletionMap = computed(() => {
	const map = new Map()
	if (!state.games) return map
	for (const game of state.games) {
		if (game.hidden) continue
		const data = getCompletionData(game)
		const pct = data.total ? Math.round((data.achieved / data.total) * 100) : 0
		map.set(game.appid, {achieved: data.achieved, total: data.total, percent: pct})
	}
	return map
})

// Pre-compute average global rarity per game
const avgGlobalRarityMap = computed(() => {
	const map = new Map()
	if (!state.games) return map
	for (const game of state.games) {
		if (game.hidden) continue
		if (!game.achievementsList?.achievements?.length) continue
		const total = game.achievementsList.achievements.reduce((acc, ach) => acc + (Number(ach.unlockPercentage) || 0), 0)
		map.set(game.appid, parseFloat((total / game.achievementsList.achievements.length).toFixed(1)))
	}
	return map
})

// Computed properties
const allAchievements = computed(() => {
	const list = []
	if (!state.games) return []

	for (const game of state.games) {
		if (game.hidden) continue
		if (!game.achievementsList || game.achievementsList.error || !game.achievementsList.achievements) continue

		const completion = gameCompletionMap.value.get(game.appid) || {achieved: 0, total: 0, percent: 0}
		const avgRarity = avgGlobalRarityMap.value.get(game.appid) || 0

		for (const ach of game.achievementsList.achievements) {
			const pct = Number(ach.unlockPercentage) || 0
			list.push({
				appid: game.appid,
				gameName: game.name,
				gameIcon: game.img_icon_url,
				apiname: ach.apiname,
				name: ach.name,
				description: ach.description,
				achieved: ach.achieved === 1 || ach.achieved === true,
				unlockTime: ach.unlocktime,
				icon: ach.icon,
				iconGray: ach.icongray,
				unlockPercentage: pct,
				gameStatus: game.status,
				gamePlaytime: game.playtime_forever,
				gameCompletion: completion,
				avgGlobalRarity: avgRarity,
				rarityTier: getRarityTier(pct),
			})
		}
	}
	return list
})

const filteredAchievements = computed(() => {
	let result = allAchievements.value

	if (filterLocked.value === 'locked') {
		result = result.filter(a => !a.achieved)
	} else if (filterLocked.value === 'unlocked') {
		result = result.filter(a => a.achieved)
	}

	if (filterPlayedOnly.value) {
		result = result.filter(a => a.gamePlaytime > 0)
	}

	if (filterColumns.value.length > 0) {
		result = result.filter(a => filterColumns.value.includes(a.gameStatus))
	}

	if (gameSearch.value) {
		const lower = gameSearch.value.toLowerCase()
		result = result.filter(a => a.gameName.toLowerCase().includes(lower))
	}

	if (rarityMin.value > 0 || rarityMax.value < 100) {
		result = result.filter(a => a.unlockPercentage >= rarityMin.value && a.unlockPercentage <= rarityMax.value)
	}

	// Sort
	const sorted = [...result]
	const mul = sortDesc.value ? -1 : 1

	// todo add info icons (i icon) that show a tooltip/description when HOVERED or long-pressed on mobile 
	switch (sortBy.value) {
		case 'unlockRate':
		case 'rarityTier':
			sorted.sort((a, b) => (a.unlockPercentage - b.unlockPercentage) * mul)
			break
		case 'unlockDate':
			sorted.sort((a, b) => {
				const tA = a.achieved ? a.unlockTime : 0
				const tB = b.achieved ? b.unlockTime : 0
				return (tA - tB) * mul
			})
			break
		case 'gameName':
			sorted.sort((a, b) => a.gameName.localeCompare(b.gameName) * mul)
			break
		case 'achName':
			sorted.sort((a, b) => a.name.localeCompare(b.name) * mul)
			break
		case 'gameCompletion':
			sorted.sort((a, b) => (a.gameCompletion.percent - b.gameCompletion.percent) * mul)
			break
		case 'avgGlobalRarity':
			sorted.sort((a, b) => (a.avgGlobalRarity - b.avgGlobalRarity) * mul)
			break
		case 'playtime':
			sorted.sort((a, b) => (a.gamePlaytime - b.gamePlaytime) * mul)
			break
	}

	return sorted
})

const paginatedAchievements = computed(() => {
	const start = (currentPage.value - 1) * achievementsPerPage
	return filteredAchievements.value.slice(start, start + achievementsPerPage)
})

const totalPages = computed(() => {
	return Math.ceil(filteredAchievements.value.length / achievementsPerPage)
})

const pageInfo = computed(() => {
	const total = filteredAchievements.value.length
	const start = total === 0 ? 0 : (currentPage.value - 1) * achievementsPerPage + 1
	const end = Math.min(currentPage.value * achievementsPerPage, total)
	return {start, end, total}
})

const availableColumns = computed(() => {
	return state.columns.map(c => typeof c === 'object' ? c.name : c)
})

const activeFilterCount = computed(() => {
	let count = 0
	if (filterLocked.value !== 'all') count++
	if (filterPlayedOnly.value) count++
	if (filterColumns.value.length > 0) count++
	if (gameSearch.value) count++
	if (rarityMin.value > 0 || rarityMax.value < 100) count++
	return count
})

// Methods
const handleSort = (field) => {
	if (sortBy.value === field) {
		sortDesc.value = !sortDesc.value
	} else {
		sortBy.value = field
		sortDesc.value = !(field === 'gameName' || field === 'achName')
	}
}

const goToPage = (page) => {
	if (page >= 1 && page <= totalPages.value) {
		currentPage.value = page
	}
}


const clearFilters = () => {
	filterLocked.value = 'all'
	filterPlayedOnly.value = false
	filterColumns.value = []
	gameSearch.value = ''
	rarityMin.value = 0
	rarityMax.value = 100
}

const openGameInfoFromAch = (ach) => {
	const game = state.games.find(g => g.appid === ach.appid)
	if (game) {
		openGameInfo(game)
	}
}

// Reset page on any filter change
watch([filterLocked, filterPlayedOnly, filterColumns, gameSearch, rarityMin, rarityMax], () => {
	currentPage.value = 1
})
</script>

<template>
	<div class="achievement-view">
		<GameInfoComponent
				:game="selectedGame"
				:is-open="showGameInfo"
				@close="closeGameInfo"
		/>

		<!-- Header -->
		<ViewHeader title="Achievements">
			<template #after-title>
				<span class="results-count">{{ pageInfo.total }} Total</span>
			</template>
			<template #actions>
				<div class="actions">
					<span v-if="state.loading" class="loading-text">Checking for updates...</span>
					<button
							@click="showFilters = !showFilters"
							class="btn btn-secondary"
							:class="{ active: showFilters }"
					>
						<font-awesome-icon :icon="showFilters ? 'chevron-down' : 'chevron-right'"/>
						<span>Filters</span>
						<span v-if="activeFilterCount > 0" class="filter-badge">{{ activeFilterCount }}</span>
					</button>
					<button
							@click="refreshLibrary"
							:disabled="state.loading"
							class="btn btn-secondary reload-btn"
					>
						<font-awesome-icon icon="rotate"/>
						<span>Refresh Library</span>
					</button>
				</div>
			</template>
		</ViewHeader>

		<!-- Error Banner -->
		<div v-if="state.error" class="error-banner">
			<font-awesome-icon icon="triangle-exclamation"/>
			{{ state.error }}
		</div>

		<!-- Filter Panel (collapsible) -->
		<div class="slide-down-wrapper" :class="{ open: showFilters }">
			<div class="slide-down-inner">
				<div class="filter-panel">
					<div class="filter-group">
						<label>Status</label>
						<div class="btn-group">
							<button @click="filterLocked = 'all'" :class="{active: filterLocked === 'all'}">All</button>
							<button @click="filterLocked = 'locked'" :class="{active: filterLocked === 'locked'}">Locked</button>
							<button @click="filterLocked = 'unlocked'" :class="{active: filterLocked === 'unlocked'}">Unlocked</button>
						</div>
					</div>

					<div class="filter-group">
						<label>Search Game</label>
						<input
								v-model="gameSearch"
								placeholder="Filter by game name..."
								class="input-field input-small"
						/>
					</div>

					<div class="filter-group">
						<label>Game Filter</label>
						<label class="checkbox-label">
							<input type="checkbox" v-model="filterPlayedOnly"/>
							Played Only
						</label>
					</div>

					<div class="filter-group filter-group-big">
						<label>Board Columns</label>
						<MultiSelectDropdown
								:options="availableColumns"
								v-model="filterColumns"
								:mode="'dropdown'"
								button-label="Filter by Column"
								:show-tags="true"
						/>
					</div>

					<div class="filter-group filter-group-big">
						<label>Table Columns</label>
						<MultiSelectDropdown
								:options="allTableColumns"
								v-model="visibleColumns"
								:mode="'dropdown'"
								button-label="Manage Columns"
								:min-selected="1"
								:show-tags="true"
						/>
					</div>

					<div class="filter-group filter-group-wide">
						<label>Global Rarity: {{ rarityMin }}% – {{ rarityMax }}%</label>
						<div class="range-slider-group">
							<input type="range" v-model.number="rarityMin" min="0" max="100" class="slider"/>
							<input type="range" v-model.number="rarityMax" min="0" max="100" class="slider"/>
						</div>
					</div>

					<div class="filter-actions">
						<button @click="clearFilters" class="btn-text">
							Clear Filters
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Table List -->
		<AchievementTable
				:achievements="paginatedAchievements"
				:loading="state.loading"
				:sort-by="sortBy"
				:sort-desc="sortDesc"
				:show-game-column="visibleColumns.includes('game')"
				:visible-columns="visibleColumns"
				@sort="handleSort"
				@game-click="openGameInfoFromAch"
		/>

		<!-- Pagination -->
		<div v-if="totalPages > 1" class="pagination-bar">
			<div class="page-count">
				Showing {{ pageInfo.start }}-{{ pageInfo.end }} of {{ pageInfo.total }}
			</div>
			<div class="page-controls">
				<button
						@click="goToPage(currentPage - 1)"
						:disabled="currentPage === 1"
						class="btn btn-secondary btn-page"
				>
					Prev
				</button>
				<span class="page-current">{{ currentPage }} / {{ totalPages }}</span>
				<button
						@click="goToPage(currentPage + 1)"
						:disabled="currentPage === totalPages"
						class="btn btn-secondary btn-page"
				>
					Next
				</button>
			</div>
		</div>
	</div>
</template>
