import {fileURLToPath, URL} from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'

import {defineConfig, loadEnv} from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import {attachSignaling} from './lib/signaling'
import { Duplex } from "stream"
import {
    STEAM_API_TARGET,
    buildSteamProxyHeaders,
    getSteamApiKeyFromEnv,
    readRawBodyFromIncomingMessage,
    resolveSteamRequestPath,
    sanitizeUrlForLogs
} from './lib/steamApi'

type NextFunction = (err?: unknown) => void

type MiddlewareCapableServer = {
    middlewares: {
        use: (handler: (req: IncomingMessage, res: ServerResponse, next: NextFunction) => void) => void
    }
}

const sendJson = (res: ServerResponse, statusCode: number, payload: unknown): void => {
    const body = JSON.stringify(payload)
    res.statusCode = statusCode
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Length', Buffer.byteLength(body))
    res.end(body)
}

const createSteamApiMiddleware = (serverApiKey: string) => {
    return async (req: IncomingMessage, res: ServerResponse, next: NextFunction): Promise<void> => {
        const requestUrl = req.url || '/'
        const parsed = new URL(requestUrl, 'http://localhost')

        if (parsed.pathname === '/api/steam/config') {
            sendJson(res, 200, {hasServerApiKey: Boolean(serverApiKey)})
            return
        }

        if (!parsed.pathname.startsWith('/api/steam/')) {
            next()
            return
        }

        const relativePath = `${parsed.pathname.replace(/^\/api\/steam/, '') || '/'}${parsed.search}`
        const resolved = resolveSteamRequestPath(relativePath, serverApiKey)

        if (resolved.missingKey) {
            sendJson(res, 400, {
                error: 'Steam API key not configured.',
                message: 'Set STEAM_WEB_API_KEY (or STEAM_API_KEY) in your local environment, or provide a user key override in the client.'
            })
            return
        }

        const resolvedWithKey = resolved as Extract<ReturnType<typeof resolveSteamRequestPath>, { missingKey: false }>

        const safePath = sanitizeUrlForLogs(resolvedWithKey.path)
        console.log(`[Vite Steam Proxy] Forwarding to Steam API: ${safePath} | keySource=${resolvedWithKey.keySource}`)

        try {
            const targetUrl = `${STEAM_API_TARGET}${resolvedWithKey.path}`
            const body = await readRawBodyFromIncomingMessage(req)
            const steamRes = await fetch(targetUrl, {
                method: req.method,
                headers: {
                    ...buildSteamProxyHeaders(req.headers),
                    'accept-encoding': 'identity'  // Disable compression, let browser handle encoding
                },
                body: body ? new Uint8Array(body) : undefined,
                redirect: 'manual'
            })

            res.statusCode = steamRes.status
            steamRes.headers.forEach((value, key) => {
                if (key.toLowerCase() === 'transfer-encoding') return
                res.setHeader(key, value)
            })

            const buffer = Buffer.from(await steamRes.arrayBuffer())
            console.log(`[Vite Steam Proxy Response] ${safePath} | status=${steamRes.status} | size=${buffer.length} | content-type=${steamRes.headers.get('content-type')}`)
            res.end(buffer)
        } catch (error) {
            const err = error as Error
            console.error(`[Vite Steam Proxy Error] ${safePath} | ${err.stack || err.message}`)
            sendJson(res, 502, { error: 'Failed to reach Steam API', details: err.message })
        }
    }
}

const steamApiProxyPlugin = (serverApiKey: string) => {
    const attachMiddleware = (server: MiddlewareCapableServer): void => {
        server.middlewares.use((req, res, next) => {
            void createSteamApiMiddleware(serverApiKey)(req, res, next)
        })
    }

    return {
        name: 'steam-api-proxy',
        configureServer(server: MiddlewareCapableServer) {
            attachMiddleware(server)
        },
        configurePreviewServer(server: MiddlewareCapableServer) {
            attachMiddleware(server)
        }
    }
}

/**
 * Vite plugin that runs the WebRTC signaling WebSocket server
 * directly on Vite's dev HTTP server — no separate server.js needed.
 */
function wsSignalingPlugin() {
    const configureServerHook = 'configureServer'

    return {
        name: 'ws-signaling',
        [configureServerHook]: (server: { httpServer: { on: (arg0: string, arg1: (req: IncomingMessage, socket: Duplex, head: Buffer<ArrayBufferLike>) => void) => void } }) => {
            // Lazy-import ws only when the dev server starts
            import('ws').then(({WebSocketServer}) => {
                const wss = new WebSocketServer({noServer: true})

                // Intercept upgrade requests for /ws/signal
                server.httpServer.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer<ArrayBufferLike>) => {
                    if (req.url === '/ws/signal') {
                        wss.handleUpgrade(req, socket, head, (ws) => {
                            wss.emit('connection', ws, req)
                        })
                    }
                    // Other upgrade requests (e.g. Vite HMR) are left alone
                })

                attachSignaling(wss)

                console.log('[ws-signaling] WebSocket signaling server attached to Vite dev server')
            })
        }
    }
}

// https://vite.dev/config/
export default defineConfig(({mode}) => {
    const env = loadEnv(mode, process.cwd(), '')
    const serverApiKey = getSteamApiKeyFromEnv(env)

    return {
        plugins: [
            vue(),
            vueDevTools(),
            wsSignalingPlugin(),
            steamApiProxyPlugin(serverApiKey),
        ],
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url))
            },
        }
    }
})

