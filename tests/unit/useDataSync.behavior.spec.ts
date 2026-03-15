import { beforeEach, describe, expect, it, vi } from 'vitest'

type MessageHandler = (event: { data: string }) => void

class FakeWebSocket {
  static OPEN = 1
  static instances: FakeWebSocket[] = []

  readyState = FakeWebSocket.OPEN
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: MessageHandler | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null

  constructor(_url: string) {
    FakeWebSocket.instances.push(this)
  }

  send(payload: string): void {
    this.sent.push(payload)
  }

  close(): void {
    this.readyState = 3
    this.onclose?.()
  }

  emitOpen(): void {
    this.onopen?.()
  }

  async emitMessage(data: Record<string, unknown>): Promise<void> {
    await this.onmessage?.({ data: JSON.stringify(data) })
  }

  emitError(): void {
    this.onerror?.()
  }
}

class FakeDataChannel {
  bufferedAmount = 0
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null

  send(payload: string): void {
    this.sent.push(payload)
  }

  close(): void {
    this.onclose?.()
  }
}

class FakeRTCPeerConnection {
  connectionState = 'new'
  onicecandidate: ((event: { candidate: unknown }) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  ondatachannel: ((event: { channel: FakeDataChannel }) => void) | null = null
  channel = new FakeDataChannel()

  createDataChannel(): FakeDataChannel {
    return this.channel
  }

  async createOffer(): Promise<Record<string, unknown>> {
    return { type: 'offer', sdp: 'offer-sdp' }
  }

  async createAnswer(): Promise<Record<string, unknown>> {
    return { type: 'answer', sdp: 'answer-sdp' }
  }

  async setLocalDescription(_desc: unknown): Promise<void> {
    return
  }

  async setRemoteDescription(_desc: unknown): Promise<void> {
    return
  }

  async addIceCandidate(_candidate: unknown): Promise<void> {
    return
  }

  close(): void {
    this.connectionState = 'closed'
  }
}

const installStorage = () => {
  const session = new Map<string, string>()

  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => session.set(key, String(value)),
      removeItem: (key: string) => session.delete(key),
      clear: () => session.clear()
    }
  })
}

describe('useDataSync behavior', () => {
  beforeEach(() => {
    vi.resetModules()
    FakeWebSocket.instances = []
    installStorage()

    Object.defineProperty(globalThis, 'WebSocket', {
      configurable: true,
      value: FakeWebSocket
    })

    Object.defineProperty(globalThis, 'RTCPeerConnection', {
      configurable: true,
      value: FakeRTCPeerConnection
    })

    Object.defineProperty(globalThis, 'RTCSessionDescription', {
      configurable: true,
      value: class {
        constructor(public value: unknown) {}
      }
    })

    Object.defineProperty(globalThis, 'RTCIceCandidate', {
      configurable: true,
      value: class {
        constructor(public value: unknown) {}
      }
    })
  })

  it('creates a room when hosting starts', async () => {
    const { useDataSync } = await import('../../src/composables/useDataSync')
    const sync = useDataSync()

    sync.startHosting()
    expect(sync.status.value).toBe(sync.Status.CREATING_ROOM)

    const ws = FakeWebSocket.instances[0]
    ws.emitOpen()
    expect(ws.sent[0]).toContain('create-room')

    await ws.emitMessage({ type: 'room-created', roomId: 'abc123' })
    expect(sync.status.value).toBe(sync.Status.WAITING_FOR_PEER)
    expect(sync.roomId.value).toBe('abc123')
  })

  it('resumes hosting from persisted room state', async () => {
    sessionStorage.setItem('steam_sync_room', JSON.stringify({ roomId: 'persisted-room', direction: 'send' }))

    const { useDataSync } = await import('../../src/composables/useDataSync')
    const sync = useDataSync()

    sync.openOverlay()
    const ws = FakeWebSocket.instances[0]
    ws.emitOpen()

    expect(sync.isOverlayOpen.value).toBe(true)
    expect(sync.roomId.value).toBe('persisted-room')
    expect(ws.sent[0]).toContain('rejoin-room')
  })

  it('joins room and sends answer after offer', async () => {
    const { useDataSync } = await import('../../src/composables/useDataSync')
    const sync = useDataSync()

    sync.joinRoom('room-42')
    const ws = FakeWebSocket.instances[0]
    ws.emitOpen()

    expect(ws.sent[0]).toContain('join-room')

    await ws.emitMessage({ type: 'room-joined' })
    expect(sync.status.value).toBe(sync.Status.CONNECTING)

    await ws.emitMessage({ type: 'offer', offer: { sdp: 'x' } })

    expect(ws.sent.some((payload) => payload.includes('"type":"answer"'))).toBe(true)
  })

  it('moves to error state on websocket failure while joining', async () => {
    const { useDataSync } = await import('../../src/composables/useDataSync')
    const sync = useDataSync()

    sync.joinRoom('room-500')
    const ws = FakeWebSocket.instances[0]
    ws.emitError()

    expect(sync.status.value).toBe(sync.Status.ERROR)
    expect(sync.errorMessage.value).toContain('Could not connect')
  })
})



