import crypto from 'node:crypto'

/**
 * Attach WebRTC signaling logic to a WebSocketServer instance.
 * Shared between the Vite dev plugin and the production Express server.
 *
 * @param {import('ws').WebSocketServer} wss
 */
export function attachSignaling(wss) {
    /** @type {Map<string, { host: import('ws')|null, guest: import('ws')|null, createdAt: number }>} */
    const rooms = new Map()

    // Cleanup stale rooms every 5 minutes
    setInterval(() => {
        const now = Date.now()
        for (const [id, room] of rooms) {
            if (now - room.createdAt > 10 * 60 * 1000) {
                if (room.host?.readyState === 1) room.host.close()
                if (room.guest?.readyState === 1) room.guest.close()
                rooms.delete(id)
            }
        }
    }, 5 * 60 * 1000)

    wss.on('connection', (ws) => {
        let assignedRoom = null
        let role = null

        ws.on('message', (raw) => {
            let msg
            try { msg = JSON.parse(raw) } catch { return }

            switch (msg.type) {
                case 'create-room': {
                    const roomId = crypto.randomBytes(6).toString('hex')
                    rooms.set(roomId, { host: ws, guest: null, createdAt: Date.now() })
                    assignedRoom = roomId
                    role = 'host'
                    ws.send(JSON.stringify({ type: 'room-created', roomId }))
                    break
                }

                case 'rejoin-room': {
                    const room = rooms.get(msg.roomId)
                    if (!room) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Room not found or expired' }))
                        return
                    }
                    room.host = ws
                    assignedRoom = msg.roomId
                    role = 'host'
                    ws.send(JSON.stringify({ type: 'room-rejoined', roomId: msg.roomId }))
                    if (room.guest?.readyState === 1) {
                        ws.send(JSON.stringify({ type: 'peer-joined' }))
                    }
                    break
                }

                case 'join-room': {
                    const room = rooms.get(msg.roomId)
                    if (!room) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Room not found or expired' }))
                        return
                    }
                    if (room.guest && room.guest.readyState === 1) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }))
                        return
                    }
                    room.guest = ws
                    assignedRoom = msg.roomId
                    role = 'guest'
                    ws.send(JSON.stringify({ type: 'room-joined', roomId: msg.roomId }))
                    if (room.host?.readyState === 1) {
                        room.host.send(JSON.stringify({ type: 'peer-joined' }))
                    }
                    break
                }

                case 'offer':
                case 'answer':
                case 'ice-candidate': {
                    if (!assignedRoom) return
                    const room = rooms.get(assignedRoom)
                    if (!room) return
                    const target = role === 'host' ? room.guest : room.host
                    if (target?.readyState === 1) {
                        target.send(JSON.stringify(msg))
                    }
                    break
                }

                case 'sync-complete': {
                    if (assignedRoom) {
                        const room = rooms.get(assignedRoom)
                        if (room) {
                            if (room.host?.readyState === 1 && room.host !== ws) room.host.send(JSON.stringify({ type: 'sync-complete' }))
                            if (room.guest?.readyState === 1 && room.guest !== ws) room.guest.send(JSON.stringify({ type: 'sync-complete' }))
                        }
                        rooms.delete(assignedRoom)
                    }
                    break
                }
            }
        })

        ws.on('close', () => {
            if (assignedRoom) {
                const room = rooms.get(assignedRoom)
                if (room) {
                    if (role === 'host') {
                        room.host = null
                    } else {
                        room.guest = null
                    }
                    const other = role === 'host' ? room.guest : room.host
                    if (other?.readyState === 1) {
                        other.send(JSON.stringify({ type: 'peer-disconnected' }))
                    }
                }
            }
        })
    })
}

