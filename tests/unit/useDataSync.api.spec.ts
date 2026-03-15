import { useDataSync } from '@/composables/useDataSync'

describe('useDataSync API', () => {
  it('exposes sync state and actions', () => {
    const sync = useDataSync()

    expect(sync.status.value).toBe(sync.Status.IDLE)
    expect(typeof sync.startHosting).toBe('function')
    expect(typeof sync.joinRoom).toBe('function')
  })

  it('builds sync links from room ids', () => {
    const sync = useDataSync()
    sync.roomId.value = 'room123'
    expect(sync.syncLink.value).toContain('sync=room123')
  })
})

