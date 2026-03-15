import request from 'supertest'
import { createServerApp, getServerSteamApiKey, resolveSteamRequestPath, sanitizeUrlForLogs } from '../../server'

describe('server helpers', () => {
  it('redacts key from logged urls', () => {
    expect(sanitizeUrlForLogs('/x?key=secret&y=1')).toContain('key=%5BREDACTED%5D')
  })

  it('prefers STEAM_WEB_API_KEY and trims it', () => {
    process.env.STEAM_WEB_API_KEY = '  abc  '
    process.env.STEAM_API_KEY = 'fallback'
    expect(getServerSteamApiKey()).toBe('abc')
  })

  it('resolves request path with user key override', () => {
    process.env.STEAM_WEB_API_KEY = 'serverKey'
    const resolved = resolveSteamRequestPath('/test?key=userKey&x=1')
    expect(resolved.missingKey).toBe(false)
    if (resolved.missingKey === false) {
      expect(resolved.keySource).toBe('user')
      expect(resolved.path).toContain('key=userKey')
    }
  })

  it('returns missing key when neither user nor server key exists', () => {
    delete process.env.STEAM_WEB_API_KEY
    delete process.env.STEAM_API_KEY
    const resolved = resolveSteamRequestPath('/test?x=1')
    expect(resolved).toEqual({ missingKey: true })
  })
})

describe('server app routes', () => {
  afterEach(() => {
    delete process.env.STEAM_WEB_API_KEY
    delete process.env.STEAM_API_KEY
  })

  it('returns config with server key presence flag', async () => {
    process.env.STEAM_WEB_API_KEY = 'x'
    const { app, server } = createServerApp()

    const res = await request(app).get('/api/steam/config')
    expect(res.status).toBe(200)
    expect(res.body.hasServerApiKey).toBe(true)

    server.close()
  })

  it('blocks steam proxy path when key is missing', async () => {
    const { app, server } = createServerApp()

    const res = await request(app).get('/api/steam/ISteamUser/GetPlayerSummaries/v0002/?steamids=1')
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Steam API key not configured')

    server.close()
  })
})


