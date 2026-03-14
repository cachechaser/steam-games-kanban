import {fileURLToPath, URL} from 'node:url'

import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import {attachSignaling} from './lib/signaling.js'

/**
 * Vite plugin that runs the WebRTC signaling WebSocket server
 * directly on Vite's dev HTTP server — no separate server.js needed.
 */
function wsSignalingPlugin() {
    const configureServerHook = 'configureServer'

    return {
        name: 'ws-signaling',
        [configureServerHook]: (server) => {
            // Lazy-import ws only when the dev server starts
            import('ws').then(({WebSocketServer}) => {
                const wss = new WebSocketServer({noServer: true})

                // Intercept upgrade requests for /ws/signal
                server.httpServer.on('upgrade', (req, socket, head) => {
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
export default defineConfig({
    plugins: [
        vue(),
        vueDevTools(),
        wsSignalingPlugin(),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        },
    },
    server: {
        proxy: {
            '/api/steam': {
                target: 'https://api.steampowered.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/steam/, '')
            }
        }
    }
})
