import type { IncomingHttpHeaders, IncomingMessage } from 'node:http'

export const STEAM_API_TARGET = 'https://api.steampowered.com'

export type SteamEnvSource = Record<string, string | undefined>

export type SteamPathResolution =
    | { missingKey: true }
    | { missingKey: false; keySource: 'user' | 'server'; path: string }

export const getSteamApiKeyFromEnv = (env: SteamEnvSource = process.env): string => {
    const key = env.STEAM_WEB_API_KEY || env.STEAM_API_KEY
    return typeof key === 'string' ? key.trim() : ''
}

export const getServerSteamApiKey = (): string => getSteamApiKeyFromEnv(process.env)

export const sanitizeUrlForLogs = (url = ''): string => {
    try {
        const parsed = new URL(url, 'http://localhost')
        if (parsed.searchParams.has('key')) {
            parsed.searchParams.set('key', '[REDACTED]')
        }
        return `${parsed.pathname}${parsed.search}`.replace(/key=%5BREDACTED%5D/gi, 'key=[REDACTED]')
    } catch {
        return String(url).replace(/([?&]key=)[^&]+/i, '$1[REDACTED]')
    }
}

export const resolveSteamRequestPath = (incomingPath = '', serverApiKey = getServerSteamApiKey()): SteamPathResolution => {
    const parsed = new URL(incomingPath, 'http://localhost')
    const userKey = parsed.searchParams.get('key')?.trim()
    const effectiveKey = userKey || serverApiKey

    if (!effectiveKey) {
        return { missingKey: true }
    }

    parsed.searchParams.set('key', effectiveKey)

    return {
        missingKey: false,
        keySource: userKey ? 'user' : 'server',
        path: `${parsed.pathname}${parsed.search}`
    }
}

export const buildSteamProxyHeaders = (headers: IncomingHttpHeaders): Record<string, string> => {
    const proxyHeaders: Record<string, string> = {}

    for (const [key, value] of Object.entries(headers)) {
        if (!value) continue
        if (key.toLowerCase() === 'host' || key.toLowerCase() === 'content-length') continue
        proxyHeaders[key] = Array.isArray(value) ? value.join(',') : value
    }

    return proxyHeaders
}

export const readRawBodyFromIncomingMessage = async (req: IncomingMessage): Promise<Buffer | undefined> => {
    if (req.method === 'GET' || req.method === 'HEAD') {
        return undefined
    }

    return await new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        req.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0)))
        req.on('error', reject)
    })
}

