import { ref, computed } from 'vue'

const currentPath = ref(window.location.hash)

window.addEventListener('hashchange', () => {
  currentPath.value = window.location.hash
})

const currentView = computed(() => {
  const hash = currentPath.value.slice(1) || '/'
  
  if (hash === '/') return 'Board'
  if (hash === '/profile') return 'Profile'
  if (hash === '/profile/edit') return 'ProfileEdit'
  if (hash === '/achievements') return 'Achievements'
  if (hash.startsWith('/profile/edit')) return 'ProfileEdit' 

  return 'Board'
})

const navigate = (path) => {
    window.location.hash = path
}

export const useRouter = () => {
  return {
    currentPath,
    currentView,
    navigate
  }
}
