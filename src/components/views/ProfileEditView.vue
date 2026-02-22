<script setup>
import {ref, computed, onMounted} from 'vue'
import {useSteam} from '@/composables/useSteam.js'

const {state, loadState, fetchGames, clearData, toggleGameVisibility, setGamesVisibility} = useSteam()

const newApiKey = ref('')
const newSteamId = ref('')
const searchTerm = ref('')
const showHiddenOnly = ref(false)

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
	let result = state.games
	if (showHiddenOnly.value) {
		result = result.filter(g => g.hidden)
	}
	if (searchTerm.value) {
		const lower = searchTerm.value.toLowerCase()
		result = result.filter(g => g.name.toLowerCase().includes(lower))
	}
	return result
})

const toggleHide = (game) => {
	toggleGameVisibility(game)
}

const toggleAllHidden = (hidden) => {
	if (confirm(`Set ALL filtered games to ${hidden ? 'Hidden' : 'Visible'}?`)) {
		setGamesVisibility(filteredGames.value, hidden)
	}
}

</script>

<template>
	<div class="profile-view">
		<div class="card-panel settings-section">
			<h2>Profile Settings</h2>

			<div class="form-group">
				<label>Steam Account</label>
				<div v-if="state.steamId" class="steam-status connected">
					<div class="status-info">
						<span class="id-label">Steam ID:</span>
						<span class="id-value">{{ state.steamId }}</span>
					</div>
					<button @click="loginWithSteam" class="btn btn-secondary btn-small">Switch Account</button>
				</div>
				<div v-else class="steam-status disconnected">
					<span>Not connected</span>
					<button @click="loginWithSteam" class="btn btn-secondary btn-small">Connect with Steam</button>
				</div>
			</div>

			<div class="form-group">
				<label>Steam Web API Key</label>
				<input v-model="newApiKey" type="password" placeholder="Enter API Key" class="input-field"/>
				<p class="hint">Get your key <a href="https://steamcommunity.com/dev/apikey" target="_blank">here</a>. Required
					to fetch games.</p>
			</div>

			<!-- Optional manual override for ID -->
			<details class="advanced-settings">
				<summary>Advanced: Set ID Manually</summary>
				<div class="form-group indented">
					<label>Steam ID (64-bit)</label>
					<input v-model="newSteamId" placeholder="Steam ID (automatically filled by login)" class="input-field"/>
				</div>
			</details>

			<div class="actions">
				<button @click="saveSettings" class="btn btn-primary">Save & Reload Games</button>
				<button @click="clearData" class="btn btn-danger">Reset App Data</button>
			</div>

			<p v-if="state.error" class="error">{{ state.error }}</p>
		</div>

		<div class="card-panel manage-games-section">
			<h2>Manage Games ({{ filteredGames.length }})</h2>

			<div class="manage-controls">
				<input v-model="searchTerm" placeholder="Search games..." class="input-field search-input"/>
				<div class="bulk-actions">
					<label class="filter-check" style="margin-right: 10px;">
						<input type="checkbox" v-model="showHiddenOnly"> Show Hidden Only
					</label>
					<button @click="toggleAllHidden(true)" class="btn btn-secondary">Hide All</button>
					<button @click="toggleAllHidden(false)" class="btn btn-secondary">Show All</button>
				</div>
			</div>

			<div class="games-list">
				<transition-group name="list">
					<div v-for="game in filteredGames" :key="game.appid" class="game-item" :class="{ hidden: game.hidden }">
						<img
								v-if="game.img_icon_url"
								:src="`//media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`"
								alt=""
						/>
						<span class="name">{{ game.name }}</span>
						<div class="game-actions">
							<span class="status-tag">{{ game.status }}</span>
							<button @click="toggleHide(game)" class="btn btn-secondary btn-small toggle-btn" :class="{ active: !game.hidden }">
								{{ game.hidden ? 'Hidden' : 'Visible' }}
							</button>
						</div>
					</div>
				</transition-group>
			</div>
		</div>
	</div>
</template>
