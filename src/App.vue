<script setup>
import {computed, onMounted, ref} from 'vue'
import {useRouter} from './router'
import {useSteam} from './composables/useSteam'
import NavBar from './components/NavBar.vue'
import Footer from './components/Footer.vue'
import BoardView from './components/views/BoardView.vue'
import ProfileView from './components/views/ProfileView.vue'
import ProfileEditView from './components/views/ProfileEditView.vue'
import CompletionView from './components/views/CompletionView.vue'
import AchievementView from './components/views/AchievementView.vue'
import HomeView from './components/views/HomeView.vue'

const {currentView, navigate} = useRouter()
const {state, loadState, fetchGames} = useSteam()
const isInitialized = ref(false)

const currentComponent = computed(() => {
	if (!isInitialized.value) {
		return null
	}

	// Login Guard
	if (!state.steamId) {
		return HomeView
	}

	switch (currentView.value) {
		case 'Board':
			return BoardView
		case 'Profile':
			return ProfileView
		case 'ProfileEdit':
			return ProfileEditView
		case 'Completion':
			return CompletionView
		case 'Achievements':
			return AchievementView
		default:
			return BoardView
	}
})

const getQueryParams = () => {
	return new URLSearchParams(window.location.search);
}

const checkOpenIdReturn = async () => {
	const params = getQueryParams();
	const claimedId = params.get('openid.claimed_id');
	if (claimedId) {
		const parts = claimedId.split('/');
		let id = parts.pop();
		if (!id) id = parts.pop();

		if (id && /^\d+$/.test(id)) {
			state.steamId = id;
			localStorage.setItem('steam_kanban_state', JSON.stringify({...state, steamId: id}))
			navigate('#/profile/edit');
			window.history.replaceState({}, document.title, window.location.pathname + '#/profile/edit');
			if (state.apiKey) {
				await fetchGames();
			}
			return true;
		}
	}
	return false;
}

onMounted(async () => {
	await loadState()
	await checkOpenIdReturn()
	isInitialized.value = true
})
</script>

<template>
	<div class="app-container">
		<NavBar/>
		<main class="main-content">
			<div class="content-wrapper">
				<transition name="fade" mode="out-in">
					<component :is="currentComponent" v-if="currentComponent"/>
				</transition>
			</div>
		</main>
		<Footer/>
	</div>
</template>

<style>
/* Global Styles are now imported in main.js via global.scss */
</style>
