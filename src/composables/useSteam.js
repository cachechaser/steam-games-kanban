import { ref, computed, watch, reactive } from 'vue'

const STATE_KEY = 'steam_kanban_state'

const state = reactive({
  steamId: '',
  apiKey: '',
  games: [],
  columns: ['Backlog', 'Playing', 'Completed'],
  lastUpdated: null, // Timestamp of last full achievement fetch
  userProfile: null, // { personaname, avatar, ... }
  loading: false,
  error: null
})

// Persistence
const loadState = () => {
  const saved = localStorage.getItem(STATE_KEY)
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      state.steamId = parsed.steamId || ''
      state.apiKey = parsed.apiKey || ''
      state.games = parsed.games || []
      state.columns = parsed.columns || ['Backlog', 'Playing', 'Completed']
      state.lastUpdated = parsed.lastUpdated || null
      state.userProfile = parsed.userProfile || null
    } catch (e) {
      console.error('Failed to load state', e)
    }
  }
}

const saveState = () => {
  localStorage.setItem(STATE_KEY, JSON.stringify({
    steamId: state.steamId,
    apiKey: state.apiKey,
    games: state.games,
    columns: state.columns,
    lastUpdated: state.lastUpdated,
    userProfile: state.userProfile
  }))
}

// Watch for changes to save automatically
watch(() => state, saveState, { deep: true })

// Logic
const fetchUserProfile = async () => {
    if (!state.steamId || !state.apiKey) return

    try {
        const response = await fetch(`/api/steam/ISteamUser/GetPlayerSummaries/v0002/?key=${state.apiKey}&steamids=${state.steamId}`)
        if (!response.ok) return
        
        const data = await response.json()
        if (data.response && data.response.players && data.response.players.length > 0) {
            state.userProfile = data.response.players[0]
        }
    } catch (e) {
        console.error("Failed to fetch user profile", e)
    }
}

const fetchGames = async () => {
  if (state.loading) return // Prevent concurrent fetches
  
  if (!state.steamId || !state.apiKey) {
    state.error = 'Please set your Steam ID and API Key in Profile settings.'
    return
  }
  
  state.loading = true
  state.error = null
  
  // Try to fetch user profile in parallel or before
  fetchUserProfile()

  try {
    const response = await fetch(`/api/steam/IPlayerService/GetOwnedGames/v0001/?key=${state.apiKey}&steamid=${state.steamId}&format=json&include_appinfo=1&include_played_free_games=1`)
    
    if (!response.ok) throw new Error(`Steam API Error: ${response.statusText}`)
    
    const data = await response.json()
    if (data.response && data.response.games) {
      const existingMap = new Map(state.games.map(g => [g.appid, g]))
      
      state.games = data.response.games.map(g => {
        const existing = existingMap.get(g.appid)
        return {
          ...g,
          status: existing ? existing.status : 'Backlog',
          achievements: existing ? existing.achievements : null,
          hidden: existing ? existing.hidden : false,
          loadingStats: false
        }
      })
    } else {
      state.games = []
    }
  } catch (err) {
    state.error = err.message
  } finally {
    state.loading = false
  }
}

const fetchAchievements = async (game) => {
  if (game.loadingStats) return
  game.loadingStats = true
  
  try {
    const response = await fetch(`/api/steam/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${game.appid}&key=${state.apiKey}&steamid=${state.steamId}`)
    
    if (!response.ok) {
        if (response.status === 400) {
             game.achievements = { error: 'No stats' }
        } else {
             // For privacy or other errors, mark as error but don't throw heavily
             game.achievements = { error: `Error ${response.status}` }
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
            game.achievements = { error: 'Stats inaccessible' }
        }
    }
  } catch (err) {
    console.error(err)
    game.achievements = { error: 'Failed to load' }
  } finally {
    game.loadingStats = false
  }
}

const fetchAllAchievements = async (force = false) => {
  if (!state.games.length) return
  if (state.loading) return // Don't fetch stats while loading games
  
  const now = Date.now()
  // 48 hours in ms = 48 * 60 * 60 * 1000 = 172800000
  if (!force && state.lastUpdated && (now - state.lastUpdated < 172800000)) {
      console.log('Achievements updated recently, skipping auto-fetch.')
      return
  }

  // Fetch in chunks to be nice to the API/browser
  // Using a simple loop with small delay or promise.all in chunks
  const chunkSize = 5
  for (let i = 0; i < state.games.length; i += chunkSize) {
      const chunk = state.games.slice(i, i + chunkSize)
      await Promise.all(chunk.map(g => {
          // Skip if already loaded and valid (unless force)
          if (!force && g.achievements && !g.achievements.error) return Promise.resolve()
          return fetchAchievements(g)
      }))
  }
  
  state.lastUpdated = now
}

const addColumn = (name) => {
    if (name && !state.columns.includes(name)) {
        state.columns.push(name)
    }
}

const removeColumn = (name) => {
    const idx = state.columns.indexOf(name)
    if (idx > -1) {
        // Move games in this column to the first column (Backlog usually)
        const fallback = state.columns[0] === name ? (state.columns[1] || 'Backlog') : state.columns[0]
        state.games.forEach(g => {
            if (g.status === name) g.status = fallback
        })
        state.columns.splice(idx, 1)
    }
}

const clearData = () => {
    if(confirm("Clear all local data?")) {
        localStorage.removeItem(STATE_KEY)
        state.steamId = ''
        state.apiKey = ''
        state.games = []
        state.columns = ['Backlog', 'Playing', 'Completed']
        state.lastUpdated = null
        state.userProfile = null
        window.location.reload()
    }
}

export function useSteam() {
    return {
        state,
        loadState,
        fetchGames,
        fetchAchievements,
        fetchAllAchievements,
        fetchUserProfile,
        addColumn,
        removeColumn,
        clearData
    }
}
