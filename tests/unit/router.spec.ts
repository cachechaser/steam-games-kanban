import { useRouter } from '@/router'

describe('useRouter', () => {
  it('maps hash paths to views', () => {
    const router = useRouter()

    window.location.hash = '#/achievements'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(router.currentView.value).toBe('Achievements')

    window.location.hash = '#/profile/edit/extra'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(router.currentView.value).toBe('ProfileEdit')
  })

  it('navigates by updating hash', () => {
    const router = useRouter()
    router.navigate('/completion')
    expect(window.location.hash).toBe('#/completion')
  })
})

