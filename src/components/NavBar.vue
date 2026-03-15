<script setup lang="ts">
import {useSteam} from '@/composables/useSteam'
import {useSteamLogin} from '@/composables/useSteamLogin'
import {useRouter} from '@/router'
import {useDataSync} from '@/composables/useDataSync'

const {currentView, navigate} = useRouter()
const {state} = useSteam()
const {loginWithSteam} = useSteamLogin()
const {openOverlay, isOverlayOpen} = useDataSync()

const isActive = (viewName: string) => {
	return currentView.value === viewName
}

const handleSyncClick = () => {
	openOverlay()
}
</script>

<template>
	<nav class="navbar">
		<div class="container">
			<div class="left-section">
				<button type="button" class="logo" @click="navigate('/')">Steam Backlog</button>
				<div class="links" v-if="state.steamId">
					<button type="button" class="nav-link" :class="{ active: isActive('Board') }" @click="navigate('/')">
						<font-awesome-icon icon="table-columns" class="nav-icon" />
						<span class="nav-text">Board</span>
					</button>
					<button type="button" class="nav-link" :class="{ active: isActive('Achievements') }" @click="navigate('/achievements')">
						<font-awesome-icon icon="trophy" class="nav-icon" />
						<span class="nav-text">Achievements</span>
					</button>
					<button type="button" class="nav-link" :class="{ active: isActive('Completion') }" @click="navigate('/completion')">
						<font-awesome-icon icon="chart-bar" class="nav-icon" />
						<span class="nav-text">Completion</span>
					</button>
				</div>
			</div>

			<div class="right-section">
				<button
					v-if="state.steamId"
					class="btn btn-secondary btn-icon"
					:class="{ active: isOverlayOpen }"
					@click="handleSyncClick"
					title="Sync with another device"
				>
					<font-awesome-icon icon="satellite-dish" />
				</button>

				<button v-if="state.steamId && state.userProfile" type="button" class="user-profile-link"
				   :class="{ active: isActive('Profile') || isActive('ProfileEdit') }" @click="navigate('/profile')">
					<div class="user-profile">
						<span class="username">{{ state.userProfile.personaname }}</span>
						<img :src="state.userProfile.avatar" alt="Avatar" class="avatar"/>
					</div>
				</button>

				<div v-else-if="state.steamId && !state.userProfile" class="user-profile-link">
					<span class="username">{{ state.steamId }}</span>
				</div>

				<button v-if="!state.steamId" @click="loginWithSteam" class="steam-login-btn">
					<img src="https://community.cloudflare.steamstatic.com/public/images/signinthroughsteam/sits_01.png"
					     alt="Sign in through Steam"/>
				</button>

				<div v-else class="setup-msg">
					<button
						v-if="!state.apiKey && !state.hasServerApiKey"
						type="button"
						class="setup-link"
						:class="{ active: isActive('ProfileEdit') }"
						@click="navigate('/profile/edit')"
					>
						<span class="desktop-text">Complete Setup</span>
						<span class="mobile-text">Setup</span>
					</button>
				</div>
			</div>
		</div>
	</nav>
</template>

<style scoped>
.navbar {
	background: var(--steam-bg-dark); /* Steam Dark Blue */
	color: white;
	height: 60px;
	box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
	flex-shrink: 0;
	z-index: 100;
	border-bottom: 2px solid var(--steam-blue-light); /* Steam Light Blue */
	display: flex;
	align-items: center;
	width: 100vw;
	position: sticky;
	top: 0;
}

.container {
	display: flex;
	justify-content: space-between;
	align-items: center;
	width: 100%;
	padding: 0 20px;
	box-sizing: border-box;
}

.left-section {
	display: flex;
	align-items: center;
	gap: 30px;
}

.right-section {
	display: flex;
	align-items: center;
	gap: 15px;
}

.logo {
	font-size: 1.5rem;
	font-weight: 900;
	letter-spacing: 1px;
	background-color: transparent;
	background: linear-gradient(135deg, var(--steam-blue-light) 0%, #ffffff 100%);
	border: none;
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	text-decoration: none;
	cursor: pointer;
	transition: opacity 0.3s;
	text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	white-space: nowrap;
}

.logo:hover {
	opacity: 0.9;
	transform: scale(1.02);
}

.links {
	display: flex;
	gap: 15px;
}

.nav-link {
	color: var(--steam-text-muted);
	background: transparent;
	border: none;
	cursor: pointer;
	text-decoration: none;
	font-weight: 600;
	padding: 8px 12px;
	border-radius: 4px;
	transition: all 0.3s ease;
	position: relative;
	overflow: hidden;
	display: flex;
	align-items: center;
	gap: 6px;
}

.nav-icon {
	font-size: 0.9rem;
	flex-shrink: 0;
}

.nav-text {
	white-space: nowrap;
}

.nav-link::before {
	content: '';
	position: absolute;
	bottom: 0;
	left: 0;
	width: 0;
	height: 2px;
	background: var(--steam-blue-light);
	transition: width 0.3s;
}

.nav-link:hover::before {
	width: 100%;
}

.nav-link:hover {
	color: white;
	background: rgba(102, 192, 244, 0.15);
	transform: translateY(-2px);
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.nav-link.active {
	color: var(--steam-blue-light);
	background: rgba(102, 192, 244, 0.15);
	font-weight: bold;
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.nav-link.active::before {
	width: 100%;
}

.steam-login-btn {
	background: none;
	border: none;
	padding: 0;
	cursor: pointer;
	transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.3s;
}

.steam-login-btn:hover {
	transform: scale(1.05);
	filter: brightness(1.2) drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3));
}

.user-profile-link {
	background: transparent;
	border: none;
	cursor: pointer;
	padding: 0;
	text-decoration: none;
	border-radius: 30px;
	transition: all 0.3s ease;
}

.user-profile-link.active .user-profile {
	background: rgba(102, 192, 244, 0.2);
	border-color: var(--steam-blue-light);
	box-shadow: 0 0 10px rgba(102, 192, 244, 0.2);
}

.user-profile {
	display: flex;
	align-items: center;
	gap: 12px;
	background: rgba(255, 255, 255, 0.05);
	padding: 4px 10px;
	border-radius: 30px;
	border: 1px solid rgba(255, 255, 255, 0.1);
	transition: all 0.3s ease;
	cursor: pointer;
}

.user-profile:hover {
	background: rgba(255, 255, 255, 0.1);
	border-color: rgba(102, 192, 244, 0.5);
}

.username {
	color: var(--steam-text-light);
	font-weight: bold;
	font-size: 0.9rem;
	max-width: 200px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.avatar {
	width: 32px;
	height: 32px;
	border-radius: 50%;
	border: 2px solid var(--steam-blue-light);
}

.setup-link {
	color: #ff9900;
	background: rgba(255, 153, 0, 0.1);
	border: 1px solid #ff9900;
	cursor: pointer;
	font-weight: bold;
	text-decoration: none;
	padding: 6px 12px;
	border-radius: 4px;
	transition: all 0.3s;
	font-size: 0.9em;
	display: inline-block;
}

.setup-link:hover {
	background: #ff9900;
	color: var(--steam-bg-dark);
}

.setup-link.active {
	background: #ff9900;
	color: var(--steam-bg-dark);
	box-shadow: 0 0 10px rgba(255, 153, 0, 0.5);
}

.desktop-text {
	display: inline;
}

.mobile-text {
	display: none;
}

/* Mobile Adjustments */
@media (max-width: 768px) {
	.container {
		padding: 0 10px;
	}

	.left-section {
		gap: 10px;
	}

	.logo {
		font-size: 1.1rem;
		/* Keep visible but smaller */
	}

	.links {
		gap: 5px;
	}

	.nav-link {
		padding: 5px 8px;
		font-size: 0.9em;
	}

	.nav-text {
		display: none;
	}

	.nav-icon {
		font-size: 1.1rem;
	}

	.username {
		display: none; /* Hide username on mobile to save space */
	}

	.user-profile {
		padding: 0;
		background: transparent;
		border: none;
	}

	.steam-login-btn img {
		height: 24px; /* Smaller login button */
	}

	.desktop-text {
		display: none;
	}

	.mobile-text {
		display: inline;
	}

	.setup-link {
		padding: 4px 8px;
		font-size: 0.8em;
	}
}
</style>
