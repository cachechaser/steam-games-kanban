import { useSteamLogin } from '@/composables/useSteamLogin'

describe('useSteamLogin', () => {
  it('exposes login action', () => {
    const { loginWithSteam } = useSteamLogin()
    expect(typeof loginWithSteam).toBe('function')
  })
})


