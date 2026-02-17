<script setup>
import {ref, computed, onMounted} from 'vue'
import {useSteam} from '../composables/useSteam'

const {state, loadState, refreshLibrary, fetchAllAchievementsDetailed} = useSteam()

// Data
const loading = ref(false)
const currentPage = ref(1)
const achievementsPerPage = 50 // Reduced for list view

// Filters
const filterLocked = ref('all') // 'all', 'locked', 'unlocked'
const filterPlayedOnly = ref(false)
const filterColumns = ref([])
const sortBy = ref('unlockRate') // 'unlockRate', 'unlockDate', 'gameName', 'achName'
const sortDesc = ref(true)

// Computed properties
const allAchievements = computed(() => {
    const list = []
    if (!state.games) return []

    for (const game of state.games) {
        if (game.hidden) continue
        if (!game.achievementsList || game.achievementsList.error || !game.achievementsList.achievements) continue

        for (const ach of game.achievementsList.achievements) {
            list.push({
                appid: game.appid,
                gameName: game.name,
                gameIcon: game.img_icon_url,
                apiname: ach.apiname,
                name: ach.name,
                description: ach.description,
                achieved: ach.achieved === 1 || ach.achieved === true,
                unlockTime: ach.unlocktime, // Unix timestamp
                icon: ach.icon,
                iconGray: ach.icongray,
                unlockPercentage: Number(ach.unlockPercentage) || 0,
                gameStatus: game.status,
                gamePlaytime: game.playtime_forever
            })
        }
    }
    return list
})

const filteredAchievements = computed(() => {
	let result = allAchievements.value

	// Filter by lock status
	if (filterLocked.value === 'locked') {
		result = result.filter(a => !a.achieved)
	} else if (filterLocked.value === 'unlocked') {
		result = result.filter(a => a.achieved)
	}

	// Filter by played games
	if (filterPlayedOnly.value) {
		result = result.filter(a => a.gamePlaytime > 0)
	}

	// Filter by columns
	if (filterColumns.value.length > 0) {
		result = result.filter(a => filterColumns.value.includes(a.gameStatus))
	}

	// Apply sorting
	const sorted = [...result]
    const mul = sortDesc.value ? -1 : 1

	switch (sortBy.value) {
		case 'unlockRate':
			sorted.sort((a, b) => (a.unlockPercentage - b.unlockPercentage) * mul)
			break
		case 'unlockDate':
            // Sort by unlock time. Unlocked first if desc, last if asc?
            // Usually we want most recent first.
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
	}

	return sorted
})

const paginatedAchievements = computed(() => {
	const start = (currentPage.value - 1) * achievementsPerPage
	const end = start + achievementsPerPage
	return filteredAchievements.value.slice(start, end)
})

const totalPages = computed(() => {
	return Math.ceil(filteredAchievements.value.length / achievementsPerPage)
})

const pageInfo = computed(() => {
	const start = filteredAchievements.value.length === 0 ? 0 : (currentPage.value - 1) * achievementsPerPage + 1
	const end = Math.min(currentPage.value * achievementsPerPage, filteredAchievements.value.length)
	const total = filteredAchievements.value.length
	return {start, end, total}
})

const availableColumns = computed(() => {
	return state.columns.map(c => typeof c === 'object' ? c.name : c)
})

// Methods
const handleSort = (field) => {
    if (sortBy.value === field) {
        sortDesc.value = !sortDesc.value
    } else {
        sortBy.value = field
        sortDesc.value = true // Default desc for new field?
        if (field === 'gameName' || field === 'achName') sortDesc.value = false // Default asc for text
    }
}

const loadAchievements = async () => {
    // Uses the new smart refresh
	loading.value = true
	try {
		await refreshLibrary()
		if (currentPage.value === 1) currentPage.value = 1
	} finally {
		loading.value = false
	}
}

const goToPage = (page) => {
	if (page >= 1 && page <= totalPages.value) {
		currentPage.value = page
	}
}

const toggleColumn = (col) => {
	const idx = filterColumns.value.indexOf(col)
	if (idx > -1) {
		filterColumns.value.splice(idx, 1)
	} else {
		filterColumns.value.push(col)
	}
	currentPage.value = 1
}

const clearFilters = () => {
	filterLocked.value = 'all'
	filterPlayedOnly.value = false
	filterColumns.value = []
	currentPage.value = 1
}

const getIconUrl = (ach) => {
    // If achieved, use icon, else gray
    // Check if it's a full URL
    const url = ach.achieved ? ach.icon : ach.iconGray
    if (!url) return '' // placeholder?
    if (url.startsWith('http')) return url
    // Fallback if it's just a hash (old API behavior or weirdness)
    return `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/${ach.appid}/${url}.jpg`
}

onMounted(async () => {
	await loadState()
	const now = Date.now()
	const lastUpdate = state.lastUpdated || 0
	const hasAchievements = state.games.some(g => g.achievementsList && g.achievementsList.achievements && g.achievementsList.achievements.length > 0)

	if (!hasAchievements || (now - lastUpdate > 172800000)) {
		if (!hasAchievements) {
		    loadAchievements()
		} else {
		    fetchAllAchievementsDetailed()
		}
	}
})
</script>

<template>
	<div class="achievement-view">
		<!-- Header -->
		<div class="header-bar">
			<div class="header-title">
				<h1>Achievements</h1>
				<span class="results-count">{{ pageInfo.total }} Total</span>
			</div>
			    <span v-if="loading" class="loading-text">Checking for updates...</span>
				<button
					@click="loadAchievements"
					:disabled="loading"
					class="btn btn-secondary reload-btn"
				>
					↻ Refresh Library
				</button>
		</div>

		<!-- Error Banner -->
		<div v-if="state.error" class="error-banner">
		    ⚠️ {{ state.error }}
		</div>

		<!-- Filter Panel -->
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
			    <label>Game Filter</label>
				<label class="checkbox-label">
					<input type="checkbox" v-model="filterPlayedOnly" />
					Played Only
				</label>
			</div>

			<div class="filter-group">
				<label>Columns</label>
				<div class="column-tags">
					<span
						v-for="col in availableColumns"
						:key="col"
						@click="toggleColumn(col)"
						:class="['col-tag', filterColumns.includes(col) ? 'active' : '']"
					>
						{{ col }}
					</span>
				</div>
			</div>

			<div class="filter-actions">
				<button @click="clearFilters" class="btn-text">
					Clear Filters
				</button>
			</div>
		</div>

		<!-- Table List -->
		<div class="list-container">
		    <table class="ach-table">
		        <thead>
		            <tr>
		                <th @click="handleSort('gameName')" :class="['game-cell', {sorted: sortBy === 'gameName'}]">
		                    Game
		                    <span class="sort-icon">{{ sortBy === 'gameName' ? (sortDesc ? '▼' : '▲') : '' }}</span>
		                </th>
		                <th @click="handleSort('achName')" :class="{sorted: sortBy === 'achName'}">
		                    Achievement
		                    <span class="sort-icon">{{ sortBy === 'achName' ? (sortDesc ? '▼' : '▲') : '' }}</span>
		                </th>
		                <th @click="handleSort('unlockRate')" :class="{sorted: sortBy === 'unlockRate'}" class="text-right">
		                    Global %
		                    <span class="sort-icon">{{ sortBy === 'unlockRate' ? (sortDesc ? '▼' : '▲') : '' }}</span>
		                </th>
		                <th @click="handleSort('unlockDate')" :class="{sorted: sortBy === 'unlockDate'}" class="text-right">
		                    Unlock Date
		                    <span class="sort-icon">{{ sortBy === 'unlockDate' ? (sortDesc ? '▼' : '▲') : '' }}</span>
		                </th>
		            </tr>
		        </thead>
		        <tbody>
		            <tr v-if="paginatedAchievements.length === 0">
		                <td colspan="4" class="empty-state">
		                    {{ loading && allAchievements.length === 0 ? 'Loading data...' : 'No achievements found matching filters.' }}
		                </td>
		            </tr>
		            <tr v-for="ach in paginatedAchievements" :key="`${ach.appid}-${ach.apiname}`" :class="{locked: !ach.achieved}">
		                <td class="game-cell">
		                    <div class="game-info">
		                        <span class="game-name">{{ ach.gameName }}</span>
		                    </div>
		                </td>
		                <td class="desc-cell">
		                    <div class="ach-content-wrapper">
    		                    <img :src="getIconUrl(ach)" class="ach-img" alt="" loading="lazy" />
    		                    <div class="ach-text">
        		                    <div class="ach-title">{{ ach.name }}</div>
        		                    <div class="ach-desc">{{ ach.description }}</div>
    		                    </div>
		                    </div>
		                </td>
		                <td class="rate-cell">
		                    <span class="rate-badge">{{ ach.unlockPercentage.toFixed(1) }}%</span>
		                </td>
		                <td class="date-cell">
		                    <span v-if="ach.achieved && ach.unlockTime" class="unlock-date">
		                        {{ new Date(ach.unlockTime * 1000).toLocaleDateString() }}
		                    </span>
		                    <span v-else-if="ach.achieved" class="status-text unlocked">✓</span>
		                    <span v-else class="status-text locked">🔒</span>
		                </td>
		            </tr>
		        </tbody>
		    </table>
		</div>

		<!-- Pagination -->
		<div v-if="totalPages > 1" class="pagination-bar">
		    <div class="page-count">
		        Showing {{ pageInfo.start }}-{{ pageInfo.end }} of {{ pageInfo.total }}
		    </div>
			<div class="page-controls">
    			<button
    				@click="goToPage(currentPage - 1)"
    				:disabled="currentPage === 1"
    				class="btn-page"
    			>
    				Prev
    			</button>
    			<span class="page-current">{{ currentPage }} / {{ totalPages }}</span>
    			<button
    				@click="goToPage(currentPage + 1)"
    				:disabled="currentPage === totalPages"
    				class="btn-page"
    			>
    				Next
    			</button>
			</div>
		</div>
	</div>
</template>
