import { useGameInfoModal } from '@/composables/useGameInfoModal'

describe('useGameInfoModal', () => {
  it('opens and closes modal state', () => {
    const { showGameInfo, selectedGame, openGameInfo, closeGameInfo } = useGameInfoModal()

    expect(showGameInfo.value).toBe(false)
    openGameInfo({ appid: 10, name: 'Demo', status: 'Backlog' })

    expect(showGameInfo.value).toBe(true)
    expect(selectedGame.value?.appid).toBe(10)

    closeGameInfo()
    expect(showGameInfo.value).toBe(false)
  })
})

