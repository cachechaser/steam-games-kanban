<script setup>
import {ref, computed, onMounted} from 'vue'
import {useSteam} from '../composables/useSteam'

const {state, loadState, fetchGames, clearData} = useSteam()

const newApiKey = ref('')
const newSteamId = ref('')
const searchTerm = ref('')

onMounted(() => {
	loadState()
	newApiKey.value = state.apiKey
	newSteamId.value = state.steamId
})

const saveSettings = async () => {
	state.apiKey = newApiKey.value
	state.steamId = newSteamId.value
	// Trigger save via watcher in composable
	// Also try to fetch games if changed
	if (state.apiKey && state.steamId) {
		await fetchGames()
	}
}

const loginWithSteam = () => {
	const returnUrl = window.location.href.split('#')[0] + '#/profile/edit';
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

const filteredGames = computed(() => {
	if (!searchTerm.value) return state.games
	const lower = searchTerm.value.toLowerCase()
	return state.games.filter(g => g.name.toLowerCase().includes(lower))
})

const toggleHide = (game) => {
	game.hidden = !game.hidden
}

const toggleAllHidden = (hidden) => {
	if (confirm(`Set ALL filtered games to ${hidden ? 'Hidden' : 'Visible'}?`)) {
		filteredGames.value.forEach(g => g.hidden = hidden)
	}
}

</script>

<template>
	<div class="profile-view">
		<div class="settings-section">
			<h2>Profile Settings</h2>

			<div class="form-group">
				<label>Steam Account</label>
				<div v-if="state.steamId" class="steam-status connected">
					<div class="status-info">
						<span class="id-label">Steam ID:</span>
						<span class="id-value">{{ state.steamId }}</span>
					</div>
					<button @click="loginWithSteam" class="secondary-btn small">Switch Account</button>
				</div>
				<div v-else class="steam-status disconnected">
					<span>Not connected</span>
					<button @click="loginWithSteam" class="secondary-btn small">Connect with Steam</button>
				</div>
			</div>

			<div class="form-group">
				<label>Steam Web API Key</label>
				<input v-model="newApiKey" type="password" placeholder="Enter API Key"/>
				<p class="hint">Get your key <a href="https://steamcommunity.com/dev/apikey" target="_blank">here</a>. Required
					to fetch games.</p>
			</div>

			<!-- Optional manual override for ID -->
			<details class="advanced-settings">
				<summary>Advanced: Set ID Manually</summary>
				<div class="form-group indented">
					<label>Steam ID (64-bit)</label>
					<input v-model="newSteamId" placeholder="Steam ID (automatically filled by login)"/>
				</div>
			</details>

			<div class="actions">
				<button @click="saveSettings" class="primary-btn">Save & Reload Games</button>
				<button @click="clearData" class="danger-btn">Reset App Data</button>
			</div>

			<p v-if="state.error" class="error">{{ state.error }}</p>
		</div>

		<div class="manage-games-section">
			<h2>Manage Games ({{ filteredGames.length }})</h2>

			<div class="manage-controls">
				<input v-model="searchTerm" placeholder="Search games..." class="search-input"/>
				<div class="bulk-actions">
					<button @click="toggleAllHidden(true)" class="secondary-btn">Hide All</button>
					<button @click="toggleAllHidden(false)" class="secondary-btn">Show All</button>
				</div>
			</div>

			<div class="games-list">
				<transition-group name="list">
					<div v-for="game in filteredGames" :key="game.appid" class="game-item" :class="{ hidden: game.hidden }">
						<img
								v-if="game.img_icon_url"
								:src="`http://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`"
								alt=""
						/>
						<span class="name">{{ game.name }}</span>
						<div class="game-actions">
							<span class="status-tag">{{ game.status }}</span>
							<button @click="toggleHide(game)" class="toggle-btn" :class="{ active: !game.hidden }">
								{{ game.hidden ? 'Hidden' : 'Visible' }}
							</button>
						</div>
					</div>
				</transition-group>
			</div>
		</div>
	</div>
</template>

<style scoped>
.profile-view {
	max-width: 1200px; /* Limit width for readability even on full screen */
	margin: 0 auto;
	color: #c7d5e0;
	animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateY(10px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.settings-section {
	background: linear-gradient(135deg, #1b2838 0%, #171a21 100%);
	padding: 30px;
	border-radius: 8px;
	margin-bottom: 30px;
	box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
	border: 1px solid #2a475e;
}

.form-group {
	margin-bottom: 25px;
}

label {
	display: block;
	margin-bottom: 10px;
	font-weight: bold;
	color: #66c0f4;
	text-transform: uppercase;
	letter-spacing: 1px;
	font-size: 0.9em;
}

input {
	width: 100%;
	padding: 12px;
	border-radius: 4px;
	border: 1px solid #2a475e;
	background: #0f1219;
	color: white;
	box-sizing: border-box;
	transition: border-color 0.3s, box-shadow 0.3s;
}

input:focus {
	border-color: #66c0f4;
	box-shadow: 0 0 10px rgba(102, 192, 244, 0.3);
	outline: none;
}

.hint {
	font-size: 0.85em;
	color: #8f98a0;
	margin-top: 8px;
}

.actions {
	display: flex;
	gap: 20px;
	margin-top: 30px;
	padding-top: 20px;
	border-top: 1px solid #2a475e;
}

.primary-btn {
	padding: 12px 24px;
	background: linear-gradient(90deg, #06BFFF, #2D73FF);
	color: white;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	font-weight: bold;
	font-size: 1rem;
	box-shadow: 0 4px 12px rgba(6, 191, 255, 0.3);
}

.danger-btn {
	padding: 12px 24px;
	background: #d9534f;
	color: white;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	margin-left: auto; /* Push to right */
}

.secondary-btn {
	padding: 8px 16px;
	background: #2a475e;
	color: #c7d5e0;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	transition: background 0.3s, color 0.3s;
}

.secondary-btn:hover {
	background: #66c0f4;
	color: white;
}

.steam-status {
	display: flex;
	justify-content: space-between;
	align-items: center;
	background: rgba(0, 0, 0, 0.2);
	padding: 15px;
	border-radius: 6px;
	border-left: 4px solid #66c0f4;
}

.steam-status.disconnected {
	border-left-color: #d9534f;
}

.id-label {
	color: #8f98a0;
	margin-right: 10px;
}

.id-value {
	color: white;
	font-family: monospace;
	font-size: 1.1em;
}

.advanced-settings {
	margin-top: 20px;
	border: 1px dashed #2a475e;
	padding: 10px;
	border-radius: 4px;
}

.advanced-settings summary {
	cursor: pointer;
	color: #8f98a0;
	font-size: 0.9em;
}

.indented {
	margin-left: 20px;
	margin-top: 15px;
}

.manage-games-section {
	background: #1b2838;
	padding: 30px;
	border-radius: 8px;
	box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
	border: 1px solid #2a475e;
}

.manage-controls {
	display: flex;
	gap: 20px;
	margin-bottom: 20px;
	flex-wrap: wrap;
}

.search-input {
	flex: 1;
	min-width: 200px;
}

.games-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
	max-height: 60vh; /* Use viewport height */
	overflow-y: auto;
	padding-right: 10px;
}

.game-item {
	display: flex;
	align-items: center;
	padding: 12px;
	background: #171a21;
	border-radius: 6px;
	gap: 15px;
	transition: background 0.2s, transform 0.2s;
	border: 1px solid transparent;
}

.game-item:hover {
	background: #20262e;
	transform: translateX(5px);
	border-color: #2a475e;
}

.game-item.hidden {
	opacity: 0.6;
	background: #0f1219;
}

.game-item img {
	width: 32px;
	height: 32px;
	border-radius: 4px;
}

.name {
	flex: 1;
	font-weight: 500;
}

.game-actions {
	display: flex;
	align-items: center;
	gap: 15px;
}

.status-tag {
	font-size: 0.8em;
	background: rgba(102, 192, 244, 0.1);
	color: #66c0f4;
	padding: 4px 8px;
	border-radius: 4px;
	border: 1px solid rgba(102, 192, 244, 0.3);
}

.toggle-btn {
	padding: 6px 12px;
	background: #1b2838;
	border: 1px solid #2a475e;
	color: #8f98a0;
	border-radius: 4px;
	cursor: pointer;
	min-width: 80px;
	transition: all 0.2s;
}

.toggle-btn.active {
	background: #2a475e; /* Greenish/Blue */
	color: white;
	border-color: #66c0f4;
}

.toggle-btn:hover {
	background: #66c0f4;
	color: white;
	border-color: #66c0f4;
}

/* List Transitions */
.list-enter-active,
.list-leave-active {
	transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
	opacity: 0;
	transform: translateX(30px);
}
</style>
