import { attachSignaling } from '../../lib/signaling'

type Handler = (...args: unknown[]) => void

class FakeSocket {
  readyState = 1
  sent: Array<Record<string, unknown>> = []
  private handlers: Record<string, Handler> = {}

  on(event: string, cb: Handler): void {
    this.handlers[event] = cb
  }

  emitMessage(payload: Record<string, unknown>): void {
    this.handlers.message?.(JSON.stringify(payload))
  }

  close(): void {
    this.readyState = 3
    this.handlers.close?.()
  }

  send(payload: string): void {
    this.sent.push(JSON.parse(payload) as Record<string, unknown>)
  }
}

class FakeWss {
  private handlers: Record<string, Handler> = {}

  on(event: string, cb: Handler): void {
    this.handlers[event] = cb
  }

  connect(socket: FakeSocket): void {
    this.handlers.connection?.(socket)
  }
}

describe('attachSignaling', () => {
  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('creates room, joins peer, and relays offer', () => {
    vi.useFakeTimers()
    const wss = new FakeWss()
    attachSignaling(wss as never)

    const host = new FakeSocket()
    const guest = new FakeSocket()

    wss.connect(host)
    host.emitMessage({ type: 'create-room' })

    const created = host.sent.find((m) => m.type === 'room-created')
    expect(created).toBeTruthy()
    const roomId = created?.roomId as string

    wss.connect(guest)
    guest.emitMessage({ type: 'join-room', roomId })

    expect(guest.sent.some((m) => m.type === 'room-joined')).toBe(true)
    expect(host.sent.some((m) => m.type === 'peer-joined')).toBe(true)

    host.emitMessage({ type: 'offer', sdp: 'abc' })
    expect(guest.sent.some((m) => m.type === 'offer' && m.sdp === 'abc')).toBe(true)
  })

  it('returns error when joining a missing room', () => {
    vi.useFakeTimers()
    const wss = new FakeWss()
    attachSignaling(wss as never)

    const guest = new FakeSocket()
    wss.connect(guest)
    guest.emitMessage({ type: 'join-room', roomId: 'missing' })

    expect(guest.sent.some((m) => m.type === 'error' && m.message === 'Room not found or expired')).toBe(true)
  })

  it('rejects second guest when room is full', () => {
    vi.useFakeTimers()
    const wss = new FakeWss()
    attachSignaling(wss as never)

    const host = new FakeSocket()
    const guest1 = new FakeSocket()
    const guest2 = new FakeSocket()

    wss.connect(host)
    host.emitMessage({ type: 'create-room' })
    const roomId = host.sent.find((m) => m.type === 'room-created')?.roomId as string

    wss.connect(guest1)
    guest1.emitMessage({ type: 'join-room', roomId })

    wss.connect(guest2)
    guest2.emitMessage({ type: 'join-room', roomId })

    expect(guest2.sent.some((m) => m.type === 'error' && m.message === 'Room is full')).toBe(true)
  })

  it('rejoins a room and notifies when peer already exists', () => {
    vi.useFakeTimers()
    const wss = new FakeWss()
    attachSignaling(wss as never)

    const host = new FakeSocket()
    const guest = new FakeSocket()
    const reconnectHost = new FakeSocket()

    wss.connect(host)
    host.emitMessage({ type: 'create-room' })
    const roomId = host.sent.find((m) => m.type === 'room-created')?.roomId as string

    wss.connect(guest)
    guest.emitMessage({ type: 'join-room', roomId })

    wss.connect(reconnectHost)
    reconnectHost.emitMessage({ type: 'rejoin-room', roomId })

    expect(reconnectHost.sent.some((m) => m.type === 'room-rejoined')).toBe(true)
    expect(reconnectHost.sent.some((m) => m.type === 'peer-joined')).toBe(true)
  })

  it('broadcasts sync-complete to other peer and closes room', () => {
    vi.useFakeTimers()
    const wss = new FakeWss()
    attachSignaling(wss as never)

    const host = new FakeSocket()
    const guest = new FakeSocket()

    wss.connect(host)
    host.emitMessage({ type: 'create-room' })
    const roomId = host.sent.find((m) => m.type === 'room-created')?.roomId as string

    wss.connect(guest)
    guest.emitMessage({ type: 'join-room', roomId })

    host.emitMessage({ type: 'sync-complete' })
    expect(guest.sent.some((m) => m.type === 'sync-complete')).toBe(true)

    const lateGuest = new FakeSocket()
    wss.connect(lateGuest)
    lateGuest.emitMessage({ type: 'join-room', roomId })
    expect(lateGuest.sent.some((m) => m.type === 'error')).toBe(true)
  })

  it('notifies remaining peer on disconnect', () => {
    vi.useFakeTimers()
    const wss = new FakeWss()
    attachSignaling(wss as never)

    const host = new FakeSocket()
    const guest = new FakeSocket()

    wss.connect(host)
    host.emitMessage({ type: 'create-room' })
    const roomId = host.sent.find((m) => m.type === 'room-created')?.roomId as string

    wss.connect(guest)
    guest.emitMessage({ type: 'join-room', roomId })

    host.close()
    expect(guest.sent.some((m) => m.type === 'peer-disconnected')).toBe(true)
  })
})


