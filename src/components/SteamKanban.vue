<script setup>
import { ref, onMounted, watch, computed } from 'vue'

const steamId = ref('')
const apiKey = ref('')
const games = ref([])
const loading = ref(false)
const error = ref('')
const currentView = ref('board') // 'board' or 'manage'
const searchTerm = ref('')

const columns = ['Backlog', 'Playing', 'Completed']

// Helper to get query params
const getQueryParams = () => {
    const params = new URLSearchParams(window.location.search);
    return params;
}

const checkOpenIdReturn = () => {
    const params = getQueryParams();
    const claimedId = params.get('openid.claimed_id');
    if (claimedId) {
        // ID looks like https://steamcommunity.com/openid/id/76561198000000000
        // Handle potential trailing slash
        const parts = claimedId.split('/');
        let id = parts.pop();
        if (!id) id = parts.pop();

        if (id && /^\d+$/.test(id)) {
            steamId.value = id;
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
            return true;
        }
    }
    return false;
}

// Load state from localStorage
onMounted(async () => {
  const savedSteamId = localStorage.getItem('steam_kanban_steamId')
  const savedApiKey = localStorage.getItem('steam_kanban_apiKey')
  const savedGames = localStorage.getItem('steam_kanban_games')

  // Check OpenID return first (overrides saved ID if present)
  const loggedInViaOpenId = checkOpenIdReturn();

  if (!loggedInViaOpenId && savedSteamId) steamId.value = savedSteamId
  if (savedApiKey) apiKey.value = savedApiKey
  
  if (savedGames) {
    try {
      games.value = JSON.parse(savedGames)
    } catch (e) {
      console.error('Failed to parse saved games', e)
    }
  }

  // Auto-load if we have everything
  if (steamId.value && apiKey.value && games.value.length === 0) {
      await fetchGames();
  }
})

// Save state to localStorage whenever it changes
watch([steamId, apiKey], () => {
  localStorage.setItem('steam_kanban_steamId', steamId.value)
  localStorage.setItem('steam_kanban_apiKey', apiKey.value)
})

watch(games, () => {
  localStorage.setItem('steam_kanban_games', JSON.stringify(games.value))
}, { deep: true })

const loginWithSteam = () => {
    const returnUrl = window.location.href;
    const realm = window.location.origin;
    
    const params = new URLSearchParams({
        'openid.ns': 'http://specs.openid.net/auth/2.0',
        'openid.mode': 'checkid_setup',
        'openid.return_to': returnUrl,
        'openid.realm': realm,
        'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
        'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
    });
    
    window.location.href = `https://steamcommunity.com/openid/login?${params.toString()}`;
}

const fetchGames = async () => {
  if (!steamId.value || !apiKey.value) {
    error.value = 'Please enter Steam ID and API Key'
    return
  }
  loading.value = true
  error.value = ''
  
  try {
    // Using the proxy configured in vite.config.js
    const response = await fetch(`/api/steam/IPlayerService/GetOwnedGames/v0001/?key=${apiKey.value}&steamid=${steamId.value}&format=json&include_appinfo=1`)
    
    if (!response.ok) {
      throw new Error(`Steam API Error: ${response.statusText}`)
    }
    
    const data = await response.json()
    if (data.response && data.response.games) {
      // Merge with existing games to preserve status, achievements, and hidden state
      const newGames = data.response.games.map(g => {
        const existing = games.value.find(eg => eg.appid === g.appid)
        return {
          ...g,
          status: existing ? existing.status : 'Backlog',
          achievements: existing ? existing.achievements : null,
          hidden: existing ? existing.hidden : false, // Preserve hidden
          loadingStats: false
        }
      })
      games.value = newGames
    } else {
      games.value = []
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const fetchAchievements = async (game) => {
  if (game.loadingStats) return
  game.loadingStats = true
  
  try {
    const response = await fetch(`/api/steam/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${game.appid}&key=${apiKey.value}&steamid=${steamId.value}`)
    
    if (!response.ok) {
        if (response.status === 400) {
             game.achievements = { error: 'No stats available' }
        } else {
             throw new Error(`Error ${response.status}`)
        }
    } else {
        const data = await response.json()
        if (data.playerstats && data.playerstats.achievements) {
          const achieved = data.playerstats.achievements.filter(a => a.achieved === 1).length
          const total = data.playerstats.achievements.length
          game.achievements = { achieved, total }
        } else if (data.playerstats) {
             game.achievements = { error: 'No achievements found' }
        } else {
            game.achievements = { error: 'Stats not accessible' }
        }
    }
  } catch (err) {
    console.error(err)
    game.achievements = { error: 'Failed to load' }
  } finally {
    game.loadingStats = false
  }
}

const onDragStart = (evt, game) => {
  evt.dataTransfer.dropEffect = 'move'
  evt.dataTransfer.effectAllowed = 'move'
  evt.dataTransfer.setData('gameId', game.appid.toString())
}

const onDrop = (evt, status) => {
  const gameId = evt.dataTransfer.getData('gameId')
  const game = games.value.find(g => g.appid.toString() === gameId)
  if (game) {
    game.status = status
  }
}

const getGamesByStatus = (status) => {
  return games.value.filter(g => g.status === status && !g.hidden)
}

const toggleHide = (game) => {
    game.hidden = !game.hidden
}

const clearData = () => {
    if(confirm("Clear all data?")) {
        localStorage.removeItem('steam_kanban_games')
        localStorage.removeItem('steam_kanban_steamId')
        localStorage.removeItem('steam_kanban_apiKey')
        games.value = []
        steamId.value = ''
        apiKey.value = ''
    }
}

const filteredGames = computed(() => {
    if (!searchTerm.value) return games.value;
    const lower = searchTerm.value.toLowerCase();
    return games.value.filter(g => g.name.toLowerCase().includes(lower));
})

</script>

<template>
  <div class="steam-kanban">
    <div class="controls">
      <div class="header-row">
          <h1>Steam Games Kanban</h1>
          <div class="header-actions">
              <button @click="currentView = currentView === 'board' ? 'manage' : 'board'">
                  {{ currentView === 'board' ? 'Manage Games' : 'Back to Board' }}
              </button>
              <button @click="fetchGames" :disabled="loading" class="reload-btn" title="Reload Games">
                  ↻
              </button>
          </div>
      </div>
      
      <div class="auth-section">
          <div v-if="!steamId" class="login-prompt">
              <button @click="loginWithSteam" class="steam-login-btn">
                  <img src="https://community.cloudflare.steamstatic.com/public/images/signinthroughsteam/sits_01.png" alt="Sign in through Steam" />
              </button>
              <span>or enter ID manually below</span>
          </div>
          
          <div class="inputs">
            <input v-model="steamId" placeholder="Steam ID (64-bit)" />
            <input v-model="apiKey" placeholder="Steam Web API Key" type="password" />
            <button @click="fetchGames" :disabled="loading">
              {{ loading ? 'Loading...' : 'Load Games' }}
            </button>
             <button @click="clearData" class="danger">Clear Data</button>
          </div>
      </div>
      
      <p v-if="error" class="error">{{ error }}</p>
      <p class="info" v-if="!apiKey">
        Note: Even with Steam Login, you need a Steam Web API Key from <a href="https://steamcommunity.com/dev/apikey" target="_blank">here</a>.
      </p>
    </div>

    <!-- Board View -->
    <div v-if="currentView === 'board'" class="board">
      <div 
        v-for="col in columns" 
        :key="col" 
        class="column"
        @dragover.prevent
        @dragenter.prevent
        @drop="onDrop($event, col)"
      >
        <h2>{{ col }} ({{ getGamesByStatus(col).length }})</h2>
        <div class="card-list">
          <div 
            v-for="game in getGamesByStatus(col)" 
            :key="game.appid" 
            class="card"
            draggable="true"
            @dragstart="onDragStart($event, game)"
          >
            <div class="card-actions-top">
                <button @click="toggleHide(game)" class="icon-btn" title="Hide Game">×</button>
            </div>
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
                Achievements: {{ game.achievements.achieved }} / {{ game.achievements.total }}
                <div class="progress-bar">
                    <div class="progress" :style="{ width: (game.achievements.achieved / game.achievements.total * 100) + '%' }"></div>
                </div>
              </div>
              <div v-else-if="game.achievements && game.achievements.error" class="stat-error">
                  {{ game.achievements.error }}
              </div>
              <button v-else @click="fetchAchievements(game)" :disabled="game.loadingStats" class="small-btn">
                {{ game.loadingStats ? '...' : 'Load Stats' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Manage View -->
    <div v-else class="manage-view">
        <div class="manage-controls">
            <input v-model="searchTerm" placeholder="Search games..." class="search-input" />
        </div>
        <div class="games-table">
            <div class="table-header">
                <div>Game</div>
                <div>Status</div>
                <div>Hidden</div>
            </div>
            <div v-for="game in filteredGames" :key="game.appid" class="table-row">
                <div class="row-game">
                    <img 
                      v-if="game.img_icon_url" 
                      :src="`http://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`" 
                      alt="icon" 
                      class="row-icon"
                    />
                    {{ game.name }}
                </div>
                <div>{{ game.status }}</div>
                <div>
                    <button @click="toggleHide(game)" :class="{ 'btn-hidden': game.hidden, 'btn-visible': !game.hidden }">
                        {{ game.hidden ? 'Hidden' : 'Visible' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.steam-kanban {
  font-family: sans-serif;
  padding: 20px;
}

.controls {
  margin-bottom: 20px;
  background: #f5f5f5;
  padding: 15px;
  border-radius: 8px;
}

.header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
}

.header-row h1 {
    margin: 0;
}

.header-actions {
    display: flex;
    gap: 10px;
}

.reload-btn {
    font-size: 1.2em;
    padding: 8px 12px;
}

.auth-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.login-prompt {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 5px;
}

.steam-login-btn {
    background: none;
    padding: 0;
    border: none;
    cursor: pointer;
}

.inputs {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

input {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  flex: 1;
}

button {
  padding: 8px 16px;
  background: #2a475e; /* Steam blue */
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background: #ccc;
}

.danger {
    background: #d9534f;
}

.error {
  color: red;
}

/* Board Styles */
.board {
  display: flex;
  gap: 20px;
  overflow-x: auto;
  min-height: 500px;
}

.column {
  flex: 1;
  min-width: 300px;
  background: #e0e0e0;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
}

.column h2 {
  margin-top: 0;
  text-align: center;
  color: #333;
}

.card-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card {
  background: white;
  padding: 10px;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  cursor: grab;
  position: relative;
}

.card-actions-top {
    position: absolute;
    top: 5px;
    right: 5px;
}

.icon-btn {
    background: none;
    color: #999;
    padding: 0 5px;
    font-size: 1.2em;
}

.icon-btn:hover {
    color: #333;
    background: #eee;
}

.card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    padding-right: 20px; /* Space for X button */
}

.game-icon {
    width: 32px;
    height: 32px;
}

.game-title {
    font-weight: bold;
    font-size: 0.9em;
}

.stats {
    font-size: 0.8em;
    color: #666;
}

.progress-bar {
    height: 6px;
    background: #eee;
    border-radius: 3px;
    margin-top: 4px;
    overflow: hidden;
}

.progress {
    height: 100%;
    background: #66c0f4; /* Steam light blue */
}

.small-btn {
    padding: 4px 8px;
    font-size: 0.8em;
    background: #eee;
    color: #333;
}

.stat-error {
    color: orange;
    font-size: 0.8em;
}

/* Manage View Styles */
.manage-view {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.manage-controls {
    margin-bottom: 20px;
}

.search-input {
    width: 100%;
    max-width: 400px;
}

.games-table {
    display: flex;
    flex-direction: column;
    border: 1px solid #eee;
}

.table-header {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    padding: 10px;
    background: #f9f9f9;
    font-weight: bold;
    border-bottom: 1px solid #eee;
}

.table-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    padding: 10px;
    border-bottom: 1px solid #eee;
    align-items: center;
}

.table-row:hover {
    background: #fcfcfc;
}

.row-game {
    display: flex;
    align-items: center;
    gap: 10px;
}

.row-icon {
    width: 24px;
    height: 24px;
}

.btn-hidden {
    background: #ccc;
    color: #666;
}

.btn-visible {
    background: #5cb85c;
    color: white;
}
</style>
