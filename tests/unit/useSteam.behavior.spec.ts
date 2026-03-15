import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SteamGame } from '@/types/domain'

type IdbMock = {
  games: Map<number, SteamGame>
}

const installIndexedDbMock = (seedGames: SteamGame[] = []): IdbMock => {
  const games = new Map<number, SteamGame>(seedGames.map((g) => [g.appid, structuredClone(g)]))

  const db = {
    objectStoreNames: {
      contains: (name: string) => name === 'games'
    },
    createObjectStore: vi.fn(),
    transaction: () => {
      const tx: {
        oncomplete: (() => void) | null
        onerror: (() => void) | null
        error: Error | null
        objectStore: (name: string) => {
          put: (value: SteamGame) => { onsuccess: (() => void) | null; onerror: (() => void) | null; error: Error | null }
          getAll: () => { result: SteamGame[]; onsuccess: (() => void) | null; onerror: (() => void) | null; error: Error | null }
          clear: () => void
        }
      } = {
        oncomplete: null,
        onerror: null,
        error: null,
        objectStore: (_name: string) => ({
          put: (value: SteamGame) => {
            games.set(value.appid, structuredClone(value))
            const req = { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null, error: null as Error | null }
            queueMicrotask(() => req.onsuccess?.())
            return req
          },
          getAll: () => {
            const req = {
              result: Array.from(games.values()).map((g) => structuredClone(g)),
              onsuccess: null as (() => void) | null,
              onerror: null as (() => void) | null,
              error: null as Error | null
            }
            queueMicrotask(() => req.onsuccess?.())
            return req
          },
          clear: () => {
            games.clear()
          }
        })
      }

      queueMicrotask(() => tx.oncomplete?.())

      return tx
    }
  }

  const open = vi.fn(() => {
    const req = {
      result: db,
      error: null as Error | null,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onupgradeneeded: null as ((event: { target: { result: typeof db } }) => void) | null
    }

    queueMicrotask(() => {
      req.onupgradeneeded?.({ target: { result: db } })
      req.onsuccess?.()
    })

    return req
  })

  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: { open }
  })

  return { games }
}

const makeJsonResponse = (payload: unknown, status = 200): Response => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

const installLocalStorageMock = (): void => {
  const store = new Map<string, string>()

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, String(value))
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => {
        store.clear()
      }
    }
  })
}

const importFreshSteam = async () => {
  vi.resetModules()
  const mod = await import('../../src/composables/useSteam')
  return mod.useSteam()
}

describe('useSteam behavior', () => {
  beforeEach(() => {
    installLocalStorageMock()
    vi.restoreAllMocks()
  })

  it('loads persisted metadata + games from storage', async () => {
    installIndexedDbMock([
      { appid: 11, name: 'Saved Game', status: 'Backlog' } as SteamGame
    ])

    vi.stubGlobal('fetch', vi.fn(async () => makeJsonResponse({ hasServerApiKey: true })))

    localStorage.setItem('steam_kanban_state', JSON.stringify({
      steamId: '7656',
      apiKey: 'abc',
      columns: ['Backlog', 'Playing'],
      lastUpdated: 123,
      userProfile: { personaname: 'Tester' }
    }))

    const steam = await importFreshSteam()
    await steam.loadState()

    expect(steam.state.steamId).toBe('7656')
    expect(steam.state.apiKey).toBe('abc')
    expect(steam.state.hasServerApiKey).toBe(true)
    expect(steam.state.games).toHaveLength(1)
    expect(steam.state.games[0].appid).toBe(11)
  })

  it('reports setup error when refresh is called without any key or steam id', async () => {
    installIndexedDbMock()
    vi.stubGlobal('fetch', vi.fn(async () => makeJsonResponse({ hasServerApiKey: false })))

    const steam = await importFreshSteam()
    steam.state.steamId = ''
    steam.state.apiKey = ''
    steam.state.hasServerApiKey = false

    await steam.refreshLibrary()

    expect(steam.state.error).toContain('Please connect your Steam ID')
    expect(steam.state.loading).toBe(false)
  })

  it('supports duplicate column workflow and column removal fallback', async () => {
    installIndexedDbMock()
    vi.stubGlobal('fetch', vi.fn(async () => makeJsonResponse({ hasServerApiKey: false })))

    const steam = await importFreshSteam()
    steam.state.columns = ['Backlog', 'Playing', 'Completed']
    steam.state.games = [{ appid: 1, name: 'X', status: 'Backlog', duplicateColumns: [] } as SteamGame]

    const game = steam.state.games[0]

    await steam.copyGameToColumn(game, 'Playing')
    expect(steam.isGameDuplicated(game)).toBe(true)
    expect(steam.getGameColumns(game)).toEqual(['Backlog', 'Playing'])

    await steam.removeGameFromColumn(game, 'Backlog')
    expect(game.status).toBe('Playing')
    expect(game.duplicateColumns).toEqual([])

    steam.removeColumn('Playing')
    expect(steam.state.columns).toEqual(['Backlog', 'Completed'])
    expect(game.status).toBe('Backlog')
  })

  it('imports collections in add mode and reports stats', async () => {
    installIndexedDbMock()
    vi.stubGlobal('fetch', vi.fn(async () => makeJsonResponse({ hasServerApiKey: false })))

    const steam = await importFreshSteam()
    steam.state.columns = ['Backlog']
    steam.state.games = [
      { appid: 10, name: 'A', status: 'Backlog' } as SteamGame,
      { appid: 20, name: 'B', status: 'Backlog' } as SteamGame
    ]

    const result = await steam.importCollections({
      collections: [
        { name: 'RPG', game_ids: [10, 99] },
        { name: 'Coop', game_ids: [20] }
      ]
    }, 'add', false)

    expect(result.columnsCreated).toEqual(['RPG', 'Coop'])
    expect(result.gamesMoved).toBe(2)
    expect(result.gamesNotFound).toBe(1)
    expect(steam.state.games.find((g) => g.appid === 10)?.status).toBe('RPG')
  })

  it('imports collections in replace mode and resets unassigned games', async () => {
    installIndexedDbMock()
    vi.stubGlobal('fetch', vi.fn(async () => makeJsonResponse({ hasServerApiKey: false })))

    const steam = await importFreshSteam()
    steam.state.columns = ['Backlog', 'Old']
    steam.state.games = [
      { appid: 10, name: 'A', status: 'Old' } as SteamGame,
      { appid: 20, name: 'B', status: 'Old' } as SteamGame
    ]

    const result = await steam.importCollections({
      collections: [
        { name: 'Favorites', game_ids: [10] }
      ]
    }, 'replace', false)

    expect(result.columnsRemoved).toContain('Old')
    expect(result.gamesMoved).toBe(1)
    expect(result.gamesReset).toBe(1)
    expect(steam.state.columns).toEqual(['Backlog', 'Favorites'])
    expect(steam.state.games.find((g) => g.appid === 10)?.status).toBe('Favorites')
    expect(steam.state.games.find((g) => g.appid === 20)?.status).toBe('Backlog')
  })

  it('refreshes library and builds detailed achievements for update targets', async () => {
    installIndexedDbMock()

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/api/steam/config')) {
        return makeJsonResponse({ hasServerApiKey: true })
      }
      if (url.includes('ISteamUser/GetPlayerSummaries')) {
        return makeJsonResponse({ response: { players: [{ personaname: 'Tester' }] } })
      }
      if (url.includes('IPlayerService/GetOwnedGames')) {
        return makeJsonResponse({
          response: {
            games: [
              { appid: 100, name: 'Game 100', rtime_last_played: 1, playtime_forever: 10 }
            ]
          }
        })
      }
      if (url.includes('GetPlayerAchievements')) {
        return makeJsonResponse({
          playerstats: {
            achievements: [
              { apiname: 'ACH_A', achieved: 1, unlocktime: 10 }
            ]
          }
        })
      }
      if (url.includes('GetSchemaForGame')) {
        return makeJsonResponse({
          game: {
            availableGameStats: {
              achievements: [
                {
                  name: 'ACH_A',
                  displayName: 'Achievement A',
                  description: 'Desc',
                  icon: 'icon',
                  icongray: 'gray'
                }
              ]
            }
          }
        })
      }
      if (url.includes('GetGlobalAchievementPercentagesForApp')) {
        return makeJsonResponse({
          achievementpercentages: {
            achievements: [{ name: 'ACH_A', percent: 12.3 }]
          }
        })
      }

      return makeJsonResponse({})
    })

    vi.stubGlobal('fetch', fetchMock)

    const steam = await importFreshSteam()
    steam.state.steamId = '7656119'
    steam.state.apiKey = ''
    steam.state.hasServerApiKey = true

    await steam.refreshLibrary()

    expect(steam.state.error).toBeNull()
    expect(steam.state.games).toHaveLength(1)
    expect(steam.state.games[0].needsUpdate).toBe(false)
    expect(steam.state.games[0].achievementsList?.achievements?.[0].name).toBe('Achievement A')
    expect(steam.state.lastUpdated).toBeGreaterThan(0)
  })

  it('falls back from invalid user key to server key and retries refresh', async () => {
    installIndexedDbMock()

    let ownedCallCount = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/api/steam/config')) {
        return makeJsonResponse({ hasServerApiKey: true })
      }
      if (url.includes('ISteamUser/GetPlayerSummaries')) {
        return makeJsonResponse({ response: { players: [] } })
      }
      if (url.includes('IPlayerService/GetOwnedGames')) {
        ownedCallCount += 1
        if (ownedCallCount === 1) {
          return makeJsonResponse({ error: 'denied' }, 401)
        }
        return makeJsonResponse({ response: { games: [] } })
      }

      return makeJsonResponse({})
    })

    vi.stubGlobal('fetch', fetchMock)

    const steam = await importFreshSteam()
    steam.state.steamId = '7656119'
    steam.state.apiKey = 'bad-user-key'
    steam.state.hasServerApiKey = true

    await steam.refreshLibrary()

    expect(ownedCallCount).toBe(2)
    expect(steam.state.apiKey).toBe('')
    expect(steam.state.error).toContain('server API key is now used')
  })

  it('marks game with auth error and then with rate-limit error in fetchGameDetails', async () => {
    installIndexedDbMock()

    const steam = await importFreshSteam()
    steam.state.steamId = '7656119'
    steam.state.apiKey = 'user-key'
    steam.state.hasServerApiKey = false

    const game = { appid: 555, name: 'Auth/Rate', status: 'Backlog', needsUpdate: true } as SteamGame

    const authFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('GetPlayerAchievements')) return makeJsonResponse({}, 401)
      if (url.includes('GetSchemaForGame')) return makeJsonResponse({}, 200)
      if (url.includes('GetGlobalAchievementPercentagesForApp')) return makeJsonResponse({}, 200)
      return makeJsonResponse({})
    })
    vi.stubGlobal('fetch', authFetch)

    await steam.fetchGameDetails(game, true)

    expect(steam.state.apiKey).toBe('')
    expect(game.achievementsList?.error).toBe('Steam API access denied.')
    expect(game.needsUpdate).toBe(true)

    const rateFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('GetPlayerAchievements')) return makeJsonResponse({}, 429)
      if (url.includes('GetSchemaForGame')) return makeJsonResponse({}, 200)
      if (url.includes('GetGlobalAchievementPercentagesForApp')) return makeJsonResponse({}, 200)
      return makeJsonResponse({})
    })
    vi.stubGlobal('fetch', rateFetch)

    await steam.fetchGameDetails(game, true)

    expect(steam.state.error).toContain('Rate limit reached')
    expect(game.achievementsList?.error).toContain('Rate Limit Exceeded')
  })
})





