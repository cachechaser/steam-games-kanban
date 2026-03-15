import { ref, computed, toRaw } from 'vue'
import { useSteam } from './useSteam'
import { Status } from '@/types/sync'
import type {
    DataChannelMessage,
    PersistedRoom,
    SignalingMessage,
    SyncDataPayload,
    SyncDirection,
    SyncStatus,
} from '@/types/sync'

/**
 * Composable for WebRTC-based data synchronization between devices.
 *
 * Flow:
 * 1. Host device opens overlay → creates a signaling room → gets a roomId
 * 2. roomId is embedded in a link / QR code
 * 3. Guest device scans QR or clicks link → joins the room
 * 4. WebRTC data channel is established via the signaling server
 * 5. Host sends all local data (games, columns, settings) to the guest
 * 6. Guest receives and applies the data
 * 7. Room is destroyed (one-time use)
 */


const SESSION_KEY = 'steam_sync_room'

// Build ICE server config from env
const buildIceServers = (): RTCIceServer[] => {
    const servers: RTCIceServer[] = []

    const stunUrls = import.meta.env.VITE_STUN_URLS || 'stun:stun.l.google.com:19302'
    stunUrls.split(',').forEach((url: string) => {
        if (url.trim()) servers.push({ urls: url.trim() })
    })

    const turnUrl = import.meta.env.VITE_TURN_URL
    if (turnUrl) {
        servers.push({
            urls: turnUrl,
            username: import.meta.env.VITE_TURN_USERNAME || '',
            credential: import.meta.env.VITE_TURN_CREDENTIAL || ''
        })
    }

    return servers
}

// Singleton state so multiple components can access it
const status = ref<SyncStatus>(Status.IDLE)
const roomId = ref('')
const errorMessage = ref('')
const progress = ref(0) // 0-100 for transfer progress
const isOverlayOpen = ref(false)
const syncDirection = ref<SyncDirection>('send')

let ws: WebSocket | null = null
let peerConnection: RTCPeerConnection | null = null
let dataChannel: RTCDataChannel | null = null
let receiveBuffer: string[] = []
let expectedChunks = 0
let visibilityHandler: (() => void) | null = null
let sendComplete = false

const getErrorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : String(error)
}

const isPersistedRoom = (value: unknown): value is PersistedRoom => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Record<string, unknown>
    return typeof candidate.roomId === 'string' && (candidate.direction === 'send' || candidate.direction === 'receive')
}

const isSyncDataPayload = (value: unknown): value is SyncDataPayload => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Record<string, unknown>
    return typeof candidate.version === 'number' && Array.isArray(candidate.games)
}

const parseDataChannelMessage = (raw: string): DataChannelMessage | null => {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    switch (parsed.type) {
        case 'sync-header':
            if (typeof parsed.totalChunks === 'number' && typeof parsed.totalSize === 'number') {
                return { type: 'sync-header', totalChunks: parsed.totalChunks, totalSize: parsed.totalSize }
            }
            return null
        case 'sync-chunk':
            if (typeof parsed.index === 'number' && typeof parsed.data === 'string') {
                return { type: 'sync-chunk', index: parsed.index, data: parsed.data }
            }
            return null
        case 'sync-done':
            return { type: 'sync-done' }
        default:
            return null
    }
}

const parseSignalingMessage = (raw: string): SignalingMessage => {
    return JSON.parse(raw) as SignalingMessage
}

const getWsUrl = (): string => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/ws/signal`
}

/** Save room to sessionStorage so we can rejoin after leaving/returning to the page. */
const persistRoom = (): void => {
    if (roomId.value && syncDirection.value === 'send') {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
            roomId: roomId.value,
            direction: syncDirection.value
        }))
    }
}

/** Clear persisted room. */
const clearPersistedRoom = (): void => {
    sessionStorage.removeItem(SESSION_KEY)
}

const cleanup = (): void => {
    if (dataChannel) {
        dataChannel.close()
        dataChannel = null
    }
    if (peerConnection) {
        peerConnection.close()
        peerConnection = null
    }
    if (ws) {
        ws.close()
        ws = null
    }
    receiveBuffer = []
    expectedChunks = 0
    sendComplete = false
    removeVisibilityListener()
}

const reset = (): void => {
    cleanup()
    clearPersistedRoom()
    status.value = Status.IDLE
    roomId.value = ''
    errorMessage.value = ''
    progress.value = 0
    syncDirection.value = 'send'
}

/**
 * Collect all syncable data from the app state.
 */
const collectSyncData = (): string => {
    const { state } = useSteam()
    const rawState = toRaw(state)

    return JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        steamId: rawState.steamId,
        apiKey: rawState.apiKey,
        columns: JSON.parse(JSON.stringify(rawState.columns)),
        lastUpdated: rawState.lastUpdated,
        userProfile: rawState.userProfile ? JSON.parse(JSON.stringify(rawState.userProfile)) : null,
        games: rawState.games.map(g => {
            const raw = toRaw(g)
            return JSON.parse(JSON.stringify(raw))
        })
    })
}

/**
 * Apply received sync data to the local app state.
 */
const applySyncData = async (jsonStr: string): Promise<void> => {
    const { state, loadState } = useSteam()
    const parsed: unknown = JSON.parse(jsonStr)

    if (!isSyncDataPayload(parsed)) {
        throw new Error('Invalid sync data format')
    }
    const data = parsed


    // Write metadata to localStorage
    const metaKey = 'steam_kanban_state'
    localStorage.setItem(metaKey, JSON.stringify({
        steamId: data.steamId || state.steamId,
        apiKey: data.apiKey || state.apiKey,
        columns: data.columns || state.columns,
        lastUpdated: data.lastUpdated || state.lastUpdated,
        userProfile: data.userProfile || state.userProfile
    }))

    // Write games to IndexedDB
    const DB_NAME = 'SteamKanbanDB'
    const DB_VERSION = 2
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION)
        req.onerror = () => reject(req.error)
        req.onsuccess = () => resolve(req.result)
        req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
            const db = (e.target as IDBOpenDBRequest).result
            if (!db.objectStoreNames.contains('games')) {
                db.createObjectStore('games', { keyPath: 'appid' })
            }
        }
    })

    // Clear existing games first
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('games', 'readwrite')
        tx.objectStore('games').clear()
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })

    // Write all received games
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('games', 'readwrite')
        const store = tx.objectStore('games')
        data.games.forEach(game => store.put(game))
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })

    // Reload state into reactive objects
    await loadState()
}

/**
 * Send data over the data channel in chunks with backpressure.
 * Waits for the send buffer to drain when it gets too full,
 * preventing "RTCDataChannel send queue is full" errors.
 */
const sendData = async (channel: RTCDataChannel, jsonStr: string): Promise<void> => {
    const CHUNK_SIZE = 16384 // 16KB chunks
    const BUFFER_THRESHOLD = 256 * 1024 // pause sending when buffered > 256KB
    const totalChunks = Math.ceil(jsonStr.length / CHUNK_SIZE)

    /** Wait until bufferedAmount drops below the threshold. */
    const waitForDrain = () => new Promise<void>((resolve) => {
        const check = () => {
            if (channel.bufferedAmount < BUFFER_THRESHOLD) {
                resolve()
            } else {
                setTimeout(check, 50)
            }
        }
        check()
    })

    // Send header first
    channel.send(JSON.stringify({ type: 'sync-header', totalChunks, totalSize: jsonStr.length }))

    for (let i = 0; i < totalChunks; i++) {
        // Wait for buffer to drain before sending more
        if (channel.bufferedAmount >= BUFFER_THRESHOLD) {
            await waitForDrain()
        }

        const chunk = jsonStr.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
        channel.send(JSON.stringify({ type: 'sync-chunk', index: i, data: chunk }))
        progress.value = Math.round(((i + 1) / totalChunks) * 100)
    }

    // Wait for final drain before sending done signal
    await waitForDrain()
    channel.send(JSON.stringify({ type: 'sync-done' }))
    sendComplete = true
}

const setupPeerConnection = (isHost: boolean): void => {
    const iceServers = buildIceServers()
    peerConnection = new RTCPeerConnection({ iceServers })

    peerConnection.onicecandidate = (event) => {
        if (event.candidate && ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ice-candidate', candidate: event.candidate }))
        }
    }

    peerConnection.onconnectionstatechange = () => {
        const connState = peerConnection?.connectionState
        if (connState === 'failed' || connState === 'disconnected') {
            // Expected after the guest closes its side post-transfer
            if (sendComplete || status.value === Status.COMPLETE) return
            errorMessage.value = 'Connection lost. Please try again.'
            status.value = Status.ERROR
        }
    }

    if (isHost) {
        // Host creates the data channel
        dataChannel = peerConnection.createDataChannel('sync', { ordered: true })
        setupDataChannel(dataChannel, true)
    } else {
        // Guest waits for the data channel
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel
            setupDataChannel(dataChannel, false)
        }
    }
}

const setupDataChannel = (channel: RTCDataChannel, isHost: boolean): void => {
    channel.onopen = async () => {
        status.value = Status.TRANSFERRING

        if (isHost) {
            // Host sends data
            try {
                const data = collectSyncData()
                await sendData(channel, data)
            } catch (e) {
                errorMessage.value = `Failed to prepare data: ${getErrorMessage(e)}`
                status.value = Status.ERROR
            }
        }
    }

    channel.onmessage = (event) => {
        try {
            if (typeof event.data !== 'string') return
            const msg = parseDataChannelMessage(event.data)
            if (!msg) return

            switch (msg.type) {
                case 'sync-header':
                    expectedChunks = msg.totalChunks
                    receiveBuffer = new Array(msg.totalChunks)
                    progress.value = 0
                    break

                case 'sync-chunk':
                    receiveBuffer[msg.index] = msg.data
                    progress.value = Math.round(((msg.index + 1) / expectedChunks) * 100)
                    break

                case 'sync-done':
                    handleSyncDone().then(r => r).catch(e => {
                        errorMessage.value = `Failed to apply data: ${getErrorMessage(e)}`
                        status.value = Status.ERROR
                    })
                    break
            }
        } catch (e) {
            console.error('[DataSync] Message parse error', e)
        }
    }

    channel.onerror = (e) => {
        // Ignore errors after host has finished sending — the guest
        // closing its side of the channel is expected and triggers this.
        if (sendComplete || status.value === Status.COMPLETE) return
        errorMessage.value = 'Data channel error'
        status.value = Status.ERROR
        console.error('[DataSync] Channel error', e)
    }

    channel.onclose = () => {
        if (sendComplete || status.value === Status.COMPLETE) return
        if (status.value === Status.TRANSFERRING) {
            errorMessage.value = 'Connection closed during transfer'
            status.value = Status.ERROR
        }
    }
}

const handleSyncDone = async (): Promise<void> => {
    try {
        const fullData = receiveBuffer.join('')
        await applySyncData(fullData)
        status.value = Status.COMPLETE
        progress.value = 100
        clearPersistedRoom()

        // Notify server that sync is complete
        if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'sync-complete' }))
        }

        // Clean up after a short delay
        setTimeout(() => cleanup(), 2000)
    } catch (e) {
        errorMessage.value = `Failed to apply data: ${getErrorMessage(e)}`
        status.value = Status.ERROR
    }
}

/**
 * Connect (or reconnect) the host WebSocket and attach message handlers.
 * @param {boolean} isRejoin - If true, send rejoin-room instead of create-room.
 */
const connectHostWs = (isRejoin: boolean = false): void => {
    if (ws && ws.readyState === WebSocket.OPEN) return // already connected

    ws = new WebSocket(getWsUrl())

    ws.onopen = () => {
        if (!ws) return
        if (isRejoin && roomId.value) {
            ws.send(JSON.stringify({ type: 'rejoin-room', roomId: roomId.value }))
        } else {
            ws.send(JSON.stringify({ type: 'create-room' }))
        }
    }

    ws.onmessage = async (event) => {
        if (typeof event.data !== 'string') return
        const msg = parseSignalingMessage(event.data)

        switch (msg.type) {
            case 'room-created':
                if (!msg.roomId) break
                roomId.value = msg.roomId
                status.value = Status.WAITING_FOR_PEER
                persistRoom()
                break

            case 'room-rejoined':
                // Successfully reconnected to existing room
                status.value = Status.WAITING_FOR_PEER
                break

            case 'peer-joined':
                status.value = Status.CONNECTING
                setupPeerConnection(true)
                try {
                    const pc = peerConnection
                    if (!pc || !ws) break
                    const offer = await pc.createOffer()
                    await pc.setLocalDescription(offer)
                    ws.send(JSON.stringify({ type: 'offer', offer }))
                } catch (e) {
                    errorMessage.value = `Failed to create offer: ${getErrorMessage(e)}`
                    status.value = Status.ERROR
                }
                break

            case 'answer':
                if (peerConnection && msg.answer) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.answer))
                }
                break

            case 'ice-candidate':
                if (peerConnection && msg.candidate) {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate))
                }
                break

            case 'sync-complete':
                status.value = Status.COMPLETE
                clearPersistedRoom()
                setTimeout(() => cleanup(), 2000)
                break

            case 'peer-disconnected':
                if (status.value !== Status.COMPLETE) {
                    // Guest disconnected while we were waiting — not fatal, keep room open
                    if (status.value === Status.WAITING_FOR_PEER) break
                    errorMessage.value = 'Peer disconnected'
                    status.value = Status.ERROR
                }
                break

            case 'error':
                errorMessage.value = msg.message || 'Unknown signaling error'
                status.value = Status.ERROR
                break
        }
    }

    ws.onerror = () => {
        // Only show error if we're not just waiting (transient network blip)
        if (status.value !== Status.WAITING_FOR_PEER) {
            errorMessage.value = 'Could not connect to signaling server'
            status.value = Status.ERROR
        }
    }

    ws.onclose = () => {
        // If we're still waiting for a peer, don't treat WS close as fatal.
        // The room lives on the server; we'll reconnect when the user returns.
        if (status.value === Status.WAITING_FOR_PEER || status.value === Status.CREATING_ROOM) {
            // Keep status as-is; visibility handler will reconnect
            return
        }
        if (status.value !== Status.COMPLETE && status.value !== Status.ERROR && status.value !== Status.IDLE) {
            errorMessage.value = 'Signaling connection lost'
            status.value = Status.ERROR
        }
    }
}

/**
 * Listen for page visibility changes. When the host returns to the page
 * (e.g. after sharing the link via the share sheet on mobile), reconnect
 * the WebSocket to the existing room.
 */
const addVisibilityListener = (): void => {
    removeVisibilityListener()
    visibilityHandler = () => {
        if (document.visibilityState !== 'visible') return
        if (syncDirection.value !== 'send') return
        if (!roomId.value) return
        // Only reconnect if we're in a waiting/idle-ish state and the WS is gone
        if (status.value !== Status.WAITING_FOR_PEER && status.value !== Status.CREATING_ROOM) return
        if (ws && ws.readyState === WebSocket.OPEN) return

        console.log('[DataSync] Page became visible — reconnecting to room', roomId.value)
        status.value = Status.WAITING_FOR_PEER
        connectHostWs(true)
    }
    document.addEventListener('visibilitychange', visibilityHandler)
}

const removeVisibilityListener = (): void => {
    if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler)
        visibilityHandler = null
    }
}

/**
 * HOST: Create a room and wait for a peer to connect.
 */
const startHosting = (): void => {
    reset()
    syncDirection.value = 'send'
    status.value = Status.CREATING_ROOM

    connectHostWs(false)
    addVisibilityListener()
}

/**
 * HOST: Resume hosting an existing room (e.g. after returning to the page).
 */
const resumeHosting = (existingRoomId: string): void => {
    syncDirection.value = 'send'
    roomId.value = existingRoomId
    status.value = Status.WAITING_FOR_PEER
    isOverlayOpen.value = true

    connectHostWs(true)
    addVisibilityListener()
}

/**
 * GUEST: Join an existing room by roomId.
 */
const joinRoom = (targetRoomId: string): void => {
    reset()
    syncDirection.value = 'receive'
    status.value = Status.JOINING_ROOM
    roomId.value = targetRoomId

    ws = new WebSocket(getWsUrl())

    ws.onopen = () => {
        if (!ws) return
        ws.send(JSON.stringify({ type: 'join-room', roomId: targetRoomId }))
    }

    ws.onmessage = async (event) => {
        if (typeof event.data !== 'string') return
        const msg = parseSignalingMessage(event.data)

        switch (msg.type) {
            case 'room-joined':
                status.value = Status.CONNECTING
                setupPeerConnection(false)
                break

            case 'offer':
                if (peerConnection && msg.offer) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.offer))
                    const answer = await peerConnection.createAnswer()
                    await peerConnection.setLocalDescription(answer)
                    if (ws) {
                        ws.send(JSON.stringify({ type: 'answer', answer }))
                    }
                }
                break

            case 'ice-candidate':
                if (peerConnection && msg.candidate) {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate))
                }
                break

            case 'sync-complete':
                status.value = Status.COMPLETE
                setTimeout(() => cleanup(), 2000)
                break

            case 'peer-disconnected':
                if (status.value !== Status.COMPLETE) {
                    errorMessage.value = 'Host disconnected'
                    status.value = Status.ERROR
                }
                break

            case 'error':
                errorMessage.value = msg.message || 'Unknown signaling error'
                status.value = Status.ERROR
                break
        }
    }

    ws.onerror = () => {
        errorMessage.value = 'Could not connect to signaling server'
        status.value = Status.ERROR
    }

    ws.onclose = () => {
        if (status.value !== Status.COMPLETE && status.value !== Status.ERROR) {
            errorMessage.value = 'Signaling connection lost'
            status.value = Status.ERROR
        }
    }
}

/**
 * Generate the one-time sync link for the current room.
 */
const getSyncLink = computed<string>(() => {
    if (!roomId.value) return ''
    const base = window.location.origin + window.location.pathname
    return `${base}?sync=${roomId.value}`
})

/**
 * Regenerate a room (close current, create new).
 */
const regenerateRoom = (): void => {
    startHosting()
}

/**
 * Open the sync overlay.
 */
const openOverlay = (): void => {
    isOverlayOpen.value = true

    // Check if there's a persisted room we should resume
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved) {
        try {
            const parsed: unknown = JSON.parse(saved)
            if (isPersistedRoom(parsed) && parsed.direction === 'send') {
                resumeHosting(parsed.roomId)
            }
        } catch { /* ignore */ }
    }
}

/**
 * Close the sync overlay and clean up.
 */
const closeOverlay = (): void => {
    isOverlayOpen.value = false
    // Don't reset if transfer is in progress
    if (status.value !== Status.TRANSFERRING) {
        reset()
    }
}

/**
 * Try to resume a persisted room on app startup (e.g. page reload while hosting).
 */
const tryResumeOnLoad = (): void => {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved) {
        try {
            const parsed: unknown = JSON.parse(saved)
            if (isPersistedRoom(parsed) && parsed.direction === 'send') {
                resumeHosting(parsed.roomId)
            }
        } catch { /* ignore */ }
    }
}

export function useDataSync() {
    return {
        // State
        status,
        roomId,
        errorMessage,
        progress,
        isOverlayOpen,
        syncDirection,
        syncLink: getSyncLink,

        // Constants
        Status,

        // Actions
        startHosting,
        joinRoom,
        regenerateRoom,
        openOverlay,
        closeOverlay,
        reset,
        cleanup,
        tryResumeOnLoad
    }
}











