<script setup>
import {onMounted, computed, ref} from 'vue'
import {useSteam} from '../composables/useSteam'
import GameInfoComponent from './GameInfoComponent.vue'

const {state, loadState, fetchAllAchievementsDetailed, fetchAchievements, toggleGameVisibility} = useSteam()

const showGameInfo = ref(false)
const selectedGame = ref(null)

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

const openGameInfo = (game) => {
  selectedGame.value = game
  showGameInfo.value = true
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

    // Exclude games with explicit "No stats" error
    if (stats.error && (stats.error === 'No stats available' || stats.error.includes('No stats'))) {
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
        @close="showGameInfo = false"
    />

    <div class="header-bar">
      <h1>Completion Board</h1>
      <button @click="refreshStats" :disabled="state.loading" class="btn btn-secondary reload-btn">
        {{ state.loading ? 'Updating Stats...' : '↻ Refresh Stats' }}
      </button>
    </div>

    <div class="board-container">
      <div
          v-for="col in processedColumns"
          :key="col.name"
          class="kanban-column column"
          :style="{ borderTopColor: col.color }"
      >
        <div class="column-header">
          <h2>{{ col.name }} <span class="column-count">{{ col.games.length }}</span></h2>
        </div>
        <div class="card-list">
          <transition-group name="card-list">
            <div v-for="game in col.games" :key="game.appid" class="card-panel card-hover card">
              <div class="card-actions-top">
                <button @click="openGameInfo(game)" class="hide-btn info-btn" title="More Info">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                       viewBox="0 0 16 16">
                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                    <path
                        d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z"/>
                  </svg>
                </button>
                <button @click="toggleGameVisibility(game)" class="hide-btn" title="Hide Game">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                       viewBox="0 0 16 16">
                    <path
                        d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
                    <path
                        d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
                    <path
                        d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
                  </svg>
                </button>
              </div>
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
                    <span class="ach-count">{{ getCompletionData(game).achieved }} / {{
                        getCompletionData(game).total
                      }}</span>
                    <span class="percentage" :style="{ color: col.color }">
                                        {{
                        Math.round(getCompletionData(game).achieved / getCompletionData(game).total * 100)
                      }}%
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

                <button v-else @click="fetchAllAchievementsDetailed(true)" :disabled="game.loadingDetails"
                        class="btn btn-secondary btn-small small-btn">
                  {{ game.loadingDetails ? '...' : 'Load Stats' }}
                </button>
              </div>
            </div>
          </transition-group>
        </div>
      </div>
    </div>
  </div>
</template>
