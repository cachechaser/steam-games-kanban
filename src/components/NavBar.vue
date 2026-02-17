<script setup>
import {computed} from 'vue'
import {useSteam} from '../composables/useSteam'
import {useRouter} from '../router'

const {currentView} = useRouter()
const {state} = useSteam()

const isActive = (viewName) => {
	return currentView.value === viewName
}

const loginWithSteam = () => {
	const returnUrl = window.location.href.split('#')[0];
	const realm = window.location.origin;

	const params = new URLSearchParams({
		'openid.ns': 'http://specs.openid.net/auth/2.0',
		'openid.mode': 'checkid_setup',
		'openid.return_to': returnUrl,
		'openid.realm': realm,
		'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
		'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
	});

	window.location.href = `https://steamcommunity.com/openid/login?${params.toString()}`;
}
</script>

<template>
	<nav class="navbar">
		<div class="container">
			<div class="left-section">
				<a href="#/" class="logo">Steam Backlog</a>
				<div class="links" v-if="state.steamId">
					<a href="#/" :class="{ active: isActive('Board') }">Board</a>
					<a href="#/achievements" :class="{ active: isActive('Achievements') }">Achievements</a>
					<a href="#/completion" :class="{ active: isActive('Completion') }">Completion</a>
				</div>
			</div>

			<div class="right-section">
				<a v-if="state.steamId && state.userProfile" href="#/profile" class="user-profile-link"
				   :class="{ active: isActive('Profile') || isActive('ProfileEdit') }">
					<div class="user-profile">
						<span class="username">{{ state.userProfile.personaname }}</span>
						<img :src="state.userProfile.avatar" alt="Avatar" class="avatar"/>
					</div>
				</a>

				<div v-else-if="state.steamId && !state.userProfile" class="user-profile-link">
					<span class="username">{{ state.steamId }}</span>
				</div>

				<button v-if="!state.steamId" @click="loginWithSteam" class="steam-login-btn">
					<img src="https://community.cloudflare.steamstatic.com/public/images/signinthroughsteam/sits_01.png"
					     alt="Sign in through Steam"/>
				</button>

				<div v-else class="setup-msg">
					<a v-if="!state.apiKey" href="#/profile/edit" class="setup-link" :class="{ active: isActive('ProfileEdit') }">
						<span class="desktop-text">Complete Setup</span>
						<span class="mobile-text">Setup</span>
					</a>
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
	position: sticky;
	top: 0;
	z-index: 100;
	border-bottom: 2px solid var(--steam-blue-light); /* Steam Light Blue */
	display: flex;
	align-items: center;
	width: 100%; /* Force full width */
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
	background: linear-gradient(135deg, var(--steam-blue-light) 0%, #ffffff 100%);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	text-decoration: none;
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

.links a {
	color: var(--steam-text-muted);
	text-decoration: none;
	font-weight: 500;
	padding: 8px 12px;
	border-radius: 4px;
	transition: all 0.3s ease;
	position: relative;
	overflow: hidden;
}

.links a::before {
	content: '';
	position: absolute;
	bottom: 0;
	left: 0;
	width: 0%;
	height: 2px;
	background: var(--steam-blue-light);
	transition: width 0.3s;
}

.links a:hover::before {
	width: 100%;
}

.links a:hover {
	color: white;
	background: rgba(102, 192, 244, 0.15);
	transform: translateY(-2px);
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.links a.active {
	color: var(--steam-blue-light);
	background: rgba(102, 192, 244, 0.15);
	font-weight: bold;
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.links a.active::before {
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
	font-weight: bold;
	text-decoration: none;
	padding: 6px 12px;
	border: 1px solid #ff9900;
	border-radius: 4px;
	transition: all 0.3s;
	background: rgba(255, 153, 0, 0.1);
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

	.links a {
		padding: 5px 8px;
		font-size: 0.9em;
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
