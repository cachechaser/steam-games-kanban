import { ref, computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'

type AppView = 'Board' | 'Profile' | 'ProfileEdit' | 'Completion' | 'Achievements'

const currentPath = ref(window.location.hash)

window.addEventListener('hashchange', () => {
  currentPath.value = window.location.hash
})

const currentView = computed<AppView>(() => {
  const hash = currentPath.value.slice(1) || '/'
  
  if (hash === '/') return 'Board'
  if (hash === '/profile') return 'Profile'
  if (hash === '/profile/edit') return 'ProfileEdit'
  if (hash === '/completion') return 'Completion'
  if (hash === '/achievements') return 'Achievements'
  if (hash.startsWith('/profile/edit')) return 'ProfileEdit'

  return 'Board'
})

const navigate = (path: string): void => {
    window.location.hash = path
}

type RouterApi = {
  currentPath: Ref<string>
  currentView: ComputedRef<AppView>
  navigate: (path: string) => void
}

export const useRouter = (): RouterApi => {
  return {
    currentPath,
    currentView,
    navigate
  }
}

