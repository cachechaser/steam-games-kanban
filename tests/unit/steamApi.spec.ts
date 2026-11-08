import { buildSteamProxyHeaders, getSteamApiKeyFromEnv, resolveSteamRequestPath, sanitizeUrlForLogs } from '../../lib/steamApi'

describe('steam api helpers', () => {
  it('reads and trims the preferred key from an env-like object', () => {
    expect(getSteamApiKeyFromEnv({
      STEAM_WEB_API_KEY: '  preferred-key  ',
      STEAM_API_KEY: 'fallback-key'
    })).toBe('preferred-key')
  })

  it('injects the server key when the request does not provide one', () => {
    const resolved = resolveSteamRequestPath('/ISteamUser/GetPlayerSummaries/v0002/?steamids=123', 'server-key')

    expect(resolved.missingKey).toBe(false)
    if (resolved.missingKey === false) {
      expect(resolved.keySource).toBe('server')
      expect(resolved.path).toContain('key=server-key')
      expect(resolved.path).toContain('steamids=123')
    }
  })

  it('redacts keys and strips proxy-only headers', () => {
    expect(sanitizeUrlForLogs('/x?key=secret&y=1')).toContain('key=[REDACTED]')
    expect(buildSteamProxyHeaders({
      host: 'localhost:5173',
      'content-length': '123',
      accept: 'application/json'
    })).toEqual({ accept: 'application/json' })
  })
})


