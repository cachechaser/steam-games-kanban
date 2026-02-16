<script setup>
import {onMounted, computed, ref} from 'vue'
import {useRouter} from './router'
import {useSteam} from './composables/useSteam'
import NavBar from './components/NavBar.vue'
import Footer from './components/Footer.vue'
import BoardView from './components/BoardView.vue'
import ProfileView from './components/ProfileView.vue'
import ProfileEditView from './components/ProfileEditView.vue'
import CompletionView from './components/CompletionView.vue'
import AchievementView from './components/AchievementView.vue'
import HomeView from './components/HomeView.vue'

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
	const params = new URLSearchParams(window.location.search);
	return params;
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
	loadState()
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
/* Global Styles */
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');

:root {
	--steam-bg-dark: #171a21;
	--steam-bg-darker: #0f1219;
	--steam-blue-light: #66c0f4;
	--steam-blue-dark: #2a475e;
	--steam-text-light: #c7d5e0;
	--steam-text-muted: #8f98a0;
}

body {
	margin: 0;
	font-family: 'Roboto', 'Motiva Sans', sans-serif, Arial, Helvetica;
	background-color: var(--steam-bg-darker); /* Very Dark Background */
	color: var(--steam-text-light); /* Steam Light Text */
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

h1 {
	margin: 0;
	color: var(--steam-text-light);
	font-size: 1.5rem;
}

p {
	margin: 0;
}

.main-content {
	flex: 1;
	padding: 0;
	overflow: hidden;
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
	overflow-y: auto;
	overflow-x: hidden;
	padding: 16px;
	box-sizing: border-box;
}

.header-bar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 15px 25px;
	background: rgba(0, 0, 0, 0.2);
	border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	flex-shrink: 0;
}

.column {
	flex: 1 0 320px;
	min-width: 320px;
	border-top: 4px solid var(--steam-blue-light); /* Fallback */
	transition: transform 0.2s, box-shadow 0.2s;
	scroll-snap-align: center;
}

/* --- Global UI Components --- */

/* Buttons */
.btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 8px 16px;
	border-radius: 4px;
	border: 1px solid transparent;
	cursor: pointer;
	font-weight: 500;
	transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
	font-size: 0.9rem;
	font-family: inherit;
	background: transparent;
	color: inherit;
}

.btn:not(:disabled):hover {
	transform: translateY(-2px);
	filter: brightness(1.1);
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.btn:not(:disabled):active {
	transform: translateY(0);
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.btn:disabled {
	cursor: not-allowed;
	opacity: 0.6;
}

.btn-primary {
	background: linear-gradient(90deg, var(--steam-blue-light), #2D73FF);
	color: #1b2838;
	border: none;
	font-weight: bold;
}

.btn-secondary {
	background: rgba(255, 255, 255, 0.05);
	color: var(--steam-text-light);
	border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-secondary:hover {
	background: var(--steam-blue-dark);
	color: white;
	border-color: var(--steam-blue-light);
}

.btn-danger {
	background: rgba(217, 83, 79, 0.2);
	color: #ff5252;
	border: 1px solid rgba(217, 83, 79, 0.3);
}

.btn-danger:hover {
	background: #d9534f;
	color: white;
}

.btn-small {
	padding: 4px 8px;
	font-size: 0.8rem;
}

.btn-icon {
	width: 32px;
	height: 32px;
	padding: 0;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
}

.btn-link {
	background: none;
	border: none;
	color: var(--steam-blue-light);
	text-decoration: underline;
	padding: 0;
}

/* Hide Button (Eye Slash) */
.hide-btn {
	background: transparent;
	border: none;
	color: var(--steam-text-muted);
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	border-radius: 50%;
	padding: 0;
	transition: background-color 0.2s, color 0.2s;
}

.hide-btn:hover {
	background-color: rgba(255, 255, 255, 0.1);
	color: white;
}

/* Cards */
.card-panel {
	background: #1b2838;
	background: linear-gradient(145deg, #1b2838, #222b35);
	border-radius: 8px;
	border: 1px solid rgba(255, 255, 255, 0.05);
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	color: var(--steam-text-light);
	transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}

.card-hover:hover {
	transform: translateY(-4px);
	border-color: var(--steam-blue-light);
	box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
	background: linear-gradient(145deg, #222b35, #2a475e);
}

/* Inputs */
.input-field {
	padding: 10px 12px;
	border-radius: 4px;
	border: 1px solid var(--steam-blue-dark);
	background: var(--steam-bg-darker);
	color: white;
	transition: all 0.3s;
	box-sizing: border-box;
}

.input-field:focus {
	border-color: var(--steam-blue-light);
	outline: none;
	box-shadow: 0 0 10px rgba(102, 192, 244, 0.2);
}

/* Columns */
.kanban-column {
	background: #101217;
	border-radius: 8px;
	display: flex;
	flex-direction: column;
	box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

.column-header {
	padding: 15px;
	background: rgba(255, 255, 255, 0.03);
	border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	border-radius: 8px 8px 0 0;
}

.column-header h2 {
	margin: 0;
	font-size: 1.1em;
	color: var(--steam-text-light);
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-weight: 700;
	letter-spacing: 0.5px;
}

.column-count {
	background: rgba(255, 255, 255, 0.1);
	padding: 2px 8px;
	border-radius: 12px;
	font-size: 0.8em;
	color: var(--steam-text-muted);
}

/* Scrollbar */
::-webkit-scrollbar {
	width: 8px;
	height: 8px;
}

::-webkit-scrollbar-track {
	background: var(--steam-bg-dark);
}

::-webkit-scrollbar-thumb {
	background: var(--steam-blue-dark);
	border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
	background: var(--steam-blue-light);
}

a {
	color: var(--steam-blue-light);
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

	.header-bar {
		flex-direction: column;
		gap: 10px;
		align-items: stretch;
		text-align: center;
	}

	.column {
		flex: 0 0 85vw;
		width: 85vw;
		min-width: 280px;
		scroll-snap-align: center;
	}
}
</style>
