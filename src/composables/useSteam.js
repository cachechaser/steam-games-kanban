import { ref, computed, watch, reactive, toRaw } from 'vue'

const STATE_KEY = 'steam_kanban_state'

// IndexedDB Helper
const DB_NAME = 'SteamKanbanDB'
// TODO: If we need to change the structure later, we can increment this version and handle migrations in onupgradeneeded
const DB_VERSION = 2

const getDB = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains('games')) {
            db.createObjectStore('games', { keyPath: 'appid' })
        }
    }
})

const saveGameToDB = async (game) => {
    try {
        const db = await getDB()
        return new Promise((resolve, reject) => {
            const tx = db.transaction('games', 'readwrite')
            const rawGame = toRaw(game)
            const gameData = JSON.parse(JSON.stringify(rawGame))
            
            const store = tx.objectStore('games')
            const req = store.put(gameData)
            
            req.onsuccess = () => resolve()
            req.onerror = () => reject(req.error)
            
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error)
        })
    } catch (e) {
        console.error("IDB Save Game Failed", e)
    }
}

const saveAllGamesToDB = async (games) => {
    try {
        const db = await getDB()
        return new Promise((resolve, reject) => {
            const tx = db.transaction('games', 'readwrite')
            const store = tx.objectStore('games')
            games.forEach(game => {
                 const rawGame = toRaw(game)
                 const gameData = JSON.parse(JSON.stringify(rawGame))
                 store.put(gameData)
            })
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error)
        })
    } catch (e) {
        console.error("IDB Batch Save Failed", e)
    }
}

const loadGamesFromDB = async () => {
    try {
        const db = await getDB()
        return new Promise((resolve, reject) => {
            const tx = db.transaction('games', 'readonly')
            const req = tx.objectStore('games').getAll()
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error)
        })
    } catch (e) {
        console.error("IDB Load Failed", e)
        return []
    }
}

const clearDB = async () => {
    try {
        const db = await getDB()
        return new Promise((resolve, reject) => {
            const tx = db.transaction('games', 'readwrite')
            tx.objectStore('games').clear()
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error)
        })
    } catch (e) {
        console.error("IDB Clear Failed", e)
    }
}

const state = reactive({
  steamId: '',
  apiKey: '',
  games: [],
  columns: ['Backlog', 'Playing', 'Completed'],
  lastUpdated: null,
  userProfile: null,
  loading: false,
  error: null
})

// Error Handling Helper
const handleApiError = (response, context) => {
    if (response.status === 401 || response.status === 403) {
        return `Access Denied: Please check your API Key and ensure your Steam Profile Privacy Settings are set to 'Public'.`
    }
    if (response.status === 429) {
        return `Rate Limit Exceeded: You are making too many requests to Steam. Please wait a few minutes.`
    }
    if (response.status === 500 || response.status === 503) {
        return `Steam Servers Unavailable: The Steam API is currently down. Try again later.`
    }
    return `Error (${response.status}) while fetching ${context}.`
}

// Persistence
const loadState = async () => {
  const saved = localStorage.getItem(STATE_KEY)
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      state.steamId = parsed.steamId || ''
      state.apiKey = parsed.apiKey || ''
      state.columns = parsed.columns || ['Backlog', 'Playing', 'Completed']
      state.lastUpdated = parsed.lastUpdated || null
      state.userProfile = parsed.userProfile || null
    } catch (e) {
      console.error('Failed to load state', e)
    }
  }

  const games = await loadGamesFromDB()
  if (games && games.length > 0) {
      state.games = games
  }
}

const saveMetadata = () => {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({
      steamId: state.steamId,
      apiKey: state.apiKey,
      columns: state.columns,
      lastUpdated: state.lastUpdated,
      userProfile: state.userProfile
    }))
  } catch (e) {
    console.error('Failed to save metadata', e)
  }
}

watch(() => [state.steamId, state.apiKey, state.columns, state.lastUpdated, state.userProfile], saveMetadata)

// Helper for Stats
// Returns { total, achieved, error }
const getCompletionData = (game) => {
    // If detailed list exists
    if (game.achievementsList && game.achievementsList.achievements) {
        const total = game.achievementsList.achievements.length
        const achieved = game.achievementsList.achievements.filter(a => a.achieved).length
        return { total, achieved, error: null }
    }
    // Fallback to simple stats if they exist (legacy)
    if (game.achievements) {
        return game.achievements
    }
    // Fallback error from list
    if (game.achievementsList && game.achievementsList.error) {
        return { total: 0, achieved: 0, error: game.achievementsList.error }
    }

    return { total: 0, achieved: 0, error: null }
}

// Logic
const fetchUserProfile = async () => {
    if (!state.steamId || !state.apiKey) return

    try {
        const response = await fetch(`/api/steam/ISteamUser/GetPlayerSummaries/v0002/?key=${state.apiKey}&steamids=${state.steamId}`)
        if (!response.ok) {
            console.warn(handleApiError(response, 'User Profile'))
            return
        }
        
        const data = await response.json()
        if (data.response && data.response.players && data.response.players.length > 0) {
            state.userProfile = data.response.players[0]
            saveMetadata()
        }
    } catch (e) {
        console.error("Failed to fetch user profile", e)
    }
}

// Smart Game Fetching
const fetchGames = async () => {
  if (state.loading) return
  
  if (!state.steamId || !state.apiKey) {
    state.error = 'Please set your Steam ID and API Key in Profile settings.'
    return
  }
  
  state.loading = true
  state.error = null
  
  fetchUserProfile()

  try {
    const response = await fetch(`/api/steam/IPlayerService/GetOwnedGames/v0001/?key=${state.apiKey}&steamid=${state.steamId}&format=json&include_appinfo=1&include_played_free_games=1`)
    
    if (!response.ok) {
        state.error = handleApiError(response, 'Game List')
        return
    }
    
    const data = await response.json()
    if (data.response && data.response.games) {
      const existingMap = new Map(state.games.map(g => [g.appid, g]))
      let hasUpdates = false

      const newGames = data.response.games.map(g => {
        const existing = existingMap.get(g.appid)

        // Determine if we need to update achievements
        let needsUpdate = false

        if (!existing) {
            // New game detected
            needsUpdate = true
        } else {
            // Existing game, check if playtime/last_played changed
            // rtime_last_played is unix timestamp
            if (g.rtime_last_played !== existing.rtime_last_played) {
                needsUpdate = true
            }
            // Or if we don't have achievements loaded yet
            if (!existing.achievementsList || existing.achievementsList.error) {
                needsUpdate = true
            }
        }

        if (needsUpdate) hasUpdates = true

        return {
          ...g,
          status: existing ? existing.status : 'Backlog',
          achievements: existing ? existing.achievements : null,
          achievementsList: existing ? existing.achievementsList : null,
          hidden: existing ? existing.hidden : false,
          loadingStats: false,
          loadingDetails: false,
          needsUpdate: needsUpdate // Flag for detailed fetcher
        }
      })

      state.games = newGames

      await saveAllGamesToDB(state.games)

      await fetchAllAchievementsDetailed(true)

    } else {
      state.games = []
      clearDB()
    }
  } catch (err) {
    state.error = "Network Error: Failed to connect to Steam API."
    console.error(err)
  } finally {
    state.loading = false
  }
}

const fetchGameDetails = async (game) => {
  if (game.loadingDetails) return

  // If not needing update and we have data, skip
  // EXCEPT if this is called manually (e.g. user clicked "Load Stats"), we might want to force it?
  // We can assume manual calls imply desire to fetch.
  // But let's check if we already have valid data to avoid spam.
  if (!game.needsUpdate && game.achievementsList && !game.achievementsList.error && game.achievementsList.achievements) {
      return
  }

  game.loadingDetails = true

  try {
      const p1 = fetch(`/api/steam/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${game.appid}&key=${state.apiKey}&steamid=${state.steamId}&l=english`)
      const p2 = fetch(`/api/steam/ISteamUserStats/GetSchemaForGame/v2/?key=${state.apiKey}&appid=${game.appid}&l=english`)
      const p3 = fetch(`/api/steam/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${game.appid}&format=json`)

      const [r1, r2, r3] = await Promise.all([p1, p2, p3])

      // Check for rate limits or errors in batch
      if (r1.status === 429 || r2.status === 429 || r3.status === 429) {
          throw new Error("Rate Limit Exceeded")
      }

      const playerData = r1.ok ? await r1.json() : null
      const schemaData = r2.ok ? await r2.json() : null
      const globalData = r3.ok ? await r3.json() : null

      if (!playerData || !playerData.playerstats || !playerData.playerstats.achievements) {
           game.achievementsList = { error: 'No player stats' }
           game.needsUpdate = false
           await saveGameToDB(game)
           return
      }

      const playerAchievements = playerData.playerstats.achievements
      const schemaAchievements = schemaData?.game?.availableGameStats?.achievements || []
      const globalAchievements = globalData?.achievementpercentages?.achievements || []

      const schemaMap = new Map(schemaAchievements.map(a => [a.name, a]))
      const globalMap = new Map(globalAchievements.map(a => [a.name, a.percent]))

      const combined = playerAchievements.map(pa => {
          const schema = schemaMap.get(pa.apiname)
          const globalPercent = globalMap.get(pa.apiname)

          return {
              apiname: pa.apiname,
              name: schema?.displayName || pa.name || pa.apiname,
              description: schema?.description || pa.description || '',
              achieved: pa.achieved,
              unlocktime: pa.unlocktime,
              icon: schema?.icon || '',
              icongray: schema?.icongray || '',
              unlockPercentage: Number(globalPercent) || 0
          }
      })

      game.achievementsList = { achievements: combined }
      game.needsUpdate = false // Clear flag

      await saveGameToDB(game)

  } catch (e) {
      if (e.message.includes("Rate Limit")) {
          state.error = "Rate limit reached. Some games were not updated."
      }
      console.error(`Error fetching details for ${game.name}: ${e.message}`)
      game.achievementsList = { error: e.message }
  } finally {
      game.loadingDetails = false
  }
}

const fetchAllAchievementsDetailed = async (onlyDirty = false) => {
  if (!state.games.length) return

  let targets = state.games.filter(g => !g.hidden)

  if (onlyDirty) {
      targets = targets.filter(g => g.needsUpdate)
      if (targets.length === 0) {
          console.log("No games need achievement updates.")
          return
      }
      console.log(`Updating achievements for ${targets.length} games...`)
  }

  const BATCH_SIZE = 3
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      // Stop if error is critical
      if (state.error && state.error.includes("Rate Limit")) break

      const batch = targets.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map(g => fetchGameDetails(g)))
      await new Promise(r => setTimeout(r, 100)) // Throttle slightly
  }

  state.lastUpdated = Date.now()
  saveMetadata()
}

// Wrapper for manual refresh
const refreshLibrary = async () => {
    await fetchGames()
}

const addColumn = (name) => {
    if (name && !state.columns.includes(name)) {
        state.columns.push(name)
    }
}

const removeColumn = (name) => {
    const idx = state.columns.indexOf(name)
    if (idx > -1) {
        const fallback = state.columns[0] === name ? (state.columns[1] || 'Backlog') : state.columns[0]
        state.games.forEach(g => {
            if (g.status === name) {
                g.status = fallback
                saveGameToDB(g)
            }
        })
        state.columns.splice(idx, 1)
    }
}

const clearData = () => {
    if(confirm("Clear all local data?")) {
        localStorage.removeItem(STATE_KEY)
        clearDB().then(() => {
            window.location.reload()
        })
    }
}

// Exposed update method
const updateGameStatus = async (game, status) => {
    const targetGame = state.games.find(g => g.appid === game.appid);
    if (targetGame) {
        targetGame.status = status;
        await saveGameToDB(targetGame);
    } else {
        console.error("Game not found in state", game.appid)
    }
}

const toggleGameVisibility = async (game) => {
    const targetGame = state.games.find(g => g.appid === game.appid);
    if (targetGame) {
        targetGame.hidden = !targetGame.hidden;
        await saveGameToDB(targetGame);
    }
}

const setGameVisibility = async (game, isHidden) => {
    const targetGame = state.games.find(g => g.appid === game.appid);
    if (targetGame) {
        targetGame.hidden = isHidden;
        await saveGameToDB(targetGame);
    }
}

const setGamesVisibility = async (games, isHidden) => {
    games.forEach(g => {
        const target = state.games.find(tg => tg.appid === g.appid)
        if (target) target.hidden = isHidden
    })
    await saveAllGamesToDB(state.games)
}

export function useSteam() {
    return {
        state,
        loadState,
        refreshLibrary,
        fetchGames,
        fetchAllAchievementsDetailed,
        fetchGameDetails, // Exposed for manual single-game fetch
        fetchUserProfile,
        addColumn,
        removeColumn,
        clearData,
        getCompletionData, // Exposed helper
        updateGameStatus, // Exposed update
        toggleGameVisibility,
        setGameVisibility,
        setGamesVisibility
    }
}
