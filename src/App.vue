<script setup>
import {onMounted, computed} from 'vue'
import {useRouter} from './router'
import {useSteam} from './composables/useSteam'
import NavBar from './components/NavBar.vue'
import BoardView from './components/BoardView.vue'
import ProfileView from './components/ProfileView.vue'
import ProfileEditView from './components/ProfileEditView.vue'
import AchievementView from './components/AchievementView.vue'

const {currentView, navigate} = useRouter()
const {state, loadState, fetchGames} = useSteam()

const currentComponent = computed(() => {
  switch (currentView.value) {
    case 'Board':
      return BoardView
    case 'Profile':
      return ProfileView
    case 'ProfileEdit':
      return ProfileEditView
    case 'Achievements':
      return AchievementView
    default:
      return BoardView
  }
})

// Helper to get query params
const getQueryParams = () => {
  const params = new URLSearchParams(window.location.search);
  return params;
}

const checkOpenIdReturn = async () => {
  const params = getQueryParams();
  const claimedId = params.get('openid.claimed_id');
  if (claimedId) {
    // ID looks like https://steamcommunity.com/openid/id/76561198000000000
    const parts = claimedId.split('/');
    let id = parts.pop();
    if (!id) id = parts.pop();

    if (id && /^\d+$/.test(id)) {
      state.steamId = id;
      // Save immediately
      localStorage.setItem('steam_kanban_state', JSON.stringify({...state, steamId: id}))

      // Navigate to Profile to verify/add API key
      navigate('#/profile/edit');

      // Clean URL from query params
      window.history.replaceState({}, document.title, window.location.pathname + '#/profile/edit');

      // If we have API key (maybe from previous session), fetch games
      if (state.apiKey) {
        await fetchGames();
      }
      return true;
    }
  }
  return false;
}

onMounted(async () => {
  loadState()
  await checkOpenIdReturn()
})
</script>

<template>
  <div class="app-container">
    <NavBar/>
    <main class="main-content">
      <div class="content-wrapper">
        <transition name="fade" mode="out-in">
          <component :is="currentComponent"/>
        </transition>
      </div>
    </main>
  </div>
</template>

<style>
/* Global Styles */
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');

body {
  margin: 0;
  font-family: 'Roboto', 'Motiva Sans', sans-serif, Arial, Helvetica;
  background-color: #0f1219; /* Very Dark Background */
  color: #c7d5e0; /* Steam Light Text */
  height: 100%;
  width: 100vw;
}

#app {
  height: 100vh;
  width: 100%;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100vw;
  background: radial-gradient(circle at top right, #1b2838 0%, #0f1219 60%);
}

.main-content {
  flex: 1;
  padding: 0;
  overflow: hidden; /* Prevent body scroll, views handle scrolling */
  width: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.content-wrapper {
  width: 100%;
  height: 100%;
  background: transparent;
  display: flex;
  flex-direction: column;
}

.content-wrapper > * {
  background: transparent;
  height: 100%;
  width: 100%;
  overflow: hidden; /* Default to hidden, specific views define scrolling */
  padding: 16px;
  box-sizing: border-box;
}

/* Global Button Animations */
button {
  font-family: inherit;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
}

button:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  filter: brightness(1.1);
}

button:not(:disabled):active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #171a21;
}

::-webkit-scrollbar-thumb {
  background: #2a475e;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #66c0f4;
}

a {
  color: #66c0f4;
  text-decoration: none;
  transition: color 0.2s;
}

a:hover {
  color: white;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .content-wrapper > * {
    padding: 12px;
  }
}
</style>
