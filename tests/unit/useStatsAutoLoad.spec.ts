import { createApp, defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'

const refreshLibrary = vi.fn().mockResolvedValue(undefined)
const loadState = vi.fn().mockResolvedValue(undefined)

vi.mock('../../src/composables/useSteam', () => ({
  useSteam: () => ({
    state: {
      lastUpdated: 0,
      games: [
        { achievementsList: { achievements: [] } }
      ]
    },
    refreshLibrary,
    loadState
  })
}))

describe('useStatsAutoLoad', () => {
  it('calls loadState and refreshes when stats are stale', async () => {
    const { useStatsAutoLoad } = await import('../../src/composables/useStatsAutoLoad')

    const app = createApp(defineComponent({
      setup() {
        useStatsAutoLoad()
        return () => null
      }
    }))

    const el = document.createElement('div')
    app.mount(el)

    await Promise.resolve()
    await Promise.resolve()

    expect(loadState).toHaveBeenCalled()
    expect(refreshLibrary).toHaveBeenCalled()

    app.unmount()
  })
})

