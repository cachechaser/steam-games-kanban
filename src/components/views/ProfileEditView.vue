<script setup lang="ts">
import {ref, computed, onMounted, watch} from "vue";
import {useSteam} from "@/composables/useSteam";
import {useSteamLogin} from "@/composables/useSteamLogin";
import {copyToClipboard} from "@/utils/clipboard";
import GameIconImg from "../ui/GameIconImg.vue";
import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";
import { CollectionImportPayload, SteamGame} from "@/types/domain";

type ImportMode = 'add' | 'replace';
type ImportResult = {
	columnsCreated: string[];
	columnsRemoved: string[];
	gamesMoved: number;
	gamesReset: number;
	gamesNotFound: number;
};

const {
	state,
	loadState,
	refreshLibrary,
	clearData,
	toggleGameVisibility,
	setGamesVisibility,
	importCollections,
	isGameDuplicated,
} = useSteam();
const {loginWithSteam: loginWithSteamRaw} = useSteamLogin();

const loginWithSteam = () => loginWithSteamRaw("#/profile/edit");

const userApiKey = ref("");
const newSteamId = ref("");
const searchTerm = ref("");
const showHiddenOnly = ref(false);

const importJson = ref("");
const importOnlyUnassigned = ref(false);
const importMode = ref<ImportMode>("add");
const importResult = ref<ImportResult | null>(null);
const importError = ref(null);
const importLoading = ref(false);

const RAW_BASE = "https://raw.githubusercontent.com/cachechaser/steam-games-kanban/main/scripts";

const OS_OPTIONS = [
	{id: "sh", label: "sh", sub: "Mac & Linux"},
	{id: "powershell", label: "PowerShell", sub: "Windows"},
];

const OS_CONFIG = {
	sh: {
		description:
				"Fetches and runs the script directly — JSON is copied to your clipboard automatically.",
		command: `curl -fsSL ${RAW_BASE}/extract_collections.sh | sh`,
		note: "Requires curl. For clipboard support on Linux, install xclip: sudo apt install xclip",
	},
	powershell: {
		description:
				"Fetches and runs the PowerShell script — JSON is copied to your clipboard automatically.",
		command: `iex (iwr "${RAW_BASE}/extract_collections.ps1" -UseBasicParsing).Content`,
		note: "Open PowerShell and paste the command above. No admin rights required.",
	},
};

const detectOS = () =>
		navigator.userAgent.includes("Win") ? "powershell" : "sh";

const selectedOS = ref(detectOS());
const cmdCopied = ref(false);

const currentConfig = computed(() => OS_CONFIG[selectedOS.value]);
const isSetupIncomplete = computed(() => !state.hasServerApiKey && !state.apiKey?.trim());
const apiKeyError = computed(() => state.error || "");
const advancedSummaryText = computed(() =>
		state.hasServerApiKey
				? "Advanced: Optional Overrides (ID / API Key)"
				: "Advanced: Set ID Manually",
);

const copyCommand = async () => {
	const ok = await copyToClipboard(currentConfig.value.command);
	if (ok) {
		cmdCopied.value = true;
		setTimeout(() => {
			cmdCopied.value = false;
		}, 2000);
	} else {
		alert("Failed to copy. Please select the command text and copy it manually.");
	}
};

onMounted(() => {
	loadState();
	userApiKey.value = state.apiKey;
	newSteamId.value = state.steamId;
});

watch(() => state.apiKey, (value) => {
	userApiKey.value = value || "";
});

const saveSettings = async () => {
	state.apiKey = userApiKey.value.trim();
	state.steamId = newSteamId.value;
	// Trigger save via watcher in composable
	// Also try to fetch games if changed
	if (state.steamId && (state.apiKey || state.hasServerApiKey)) {
		await refreshLibrary();
	}
};

const filteredGames = computed(() => {
	let result = state.games;
	if (showHiddenOnly.value) {
		result = result.filter((g) => g.hidden);
	}
	if (searchTerm.value) {
		const lower = searchTerm.value.toLowerCase();
		result = result.filter((g) => g.name.toLowerCase().includes(lower));
	}
	return result;
});

const toggleHide = (game: SteamGame) => {
	toggleGameVisibility(game);
};

const toggleAllHidden = (hidden: boolean) => {
	if (confirm(`Set ALL filtered games to ${hidden ? "Hidden" : "Visible"}?`)) {
		setGamesVisibility(filteredGames.value, hidden);
	}
};

const handleImportCollections = async () => {
	importError.value = null;
	importResult.value = null;
	importLoading.value = true;

	try {
		let data: CollectionImportPayload;
		try {
			data = JSON.parse(importJson.value);
		} catch {
			importError.value = "Invalid JSON. Please paste the exact output from the extraction script.";
			return;
		}

		if (!data.collections || !Array.isArray(data.collections)) {
			importError.value = 'Invalid format. Expected {"collections": [...]}';
			return;
		}

		if (importMode.value === 'replace') {
			const confirmed = confirm(
					'Replace mode will remove all existing columns and replace them with your collections. Games not in any collection will be moved to "Backlog". Continue?'
			);
			if (!confirmed) {
				importLoading.value = false;
				return;
			}
		}

		importResult.value = await importCollections(data, importMode.value, importOnlyUnassigned.value);
		importJson.value = "";
	} catch (e) {
		importError.value = e instanceof Error ? e.message : String(e);
	} finally {
		importLoading.value = false;
	}
};

const handleFileUpload = (event: Event) => {
	const input = event.target as HTMLInputElement | null;
	const file = input?.files?.[0];
	if (!file) return;

	const reader = new FileReader();
	reader.onload = (e) => {
		const result = e.target?.result;
		if (typeof result === 'string') {
			importJson.value = result;
		} else {
			importError.value = 'Failed to read file as text.';
		}
	};
	reader.onerror = () => {
		importError.value = "Failed to read file.";
	};
	reader.readAsText(file);
};
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
					<button @click="loginWithSteam" class="btn btn-secondary btn-small">
						Switch Account
					</button>
				</div>
				<div v-else class="steam-status disconnected">
					<span>Not connected</span>
					<button @click="loginWithSteam" class="btn btn-secondary btn-small">
						Connect with Steam
					</button>
				</div>
			</div>

			<div class="form-group" v-if="!state.hasServerApiKey">
				<label class="label-with-badge">
					<span :class="{ 'setup-required-label-text': isSetupIncomplete }">Steam Web API Key</span>
					<span v-if="isSetupIncomplete" class="setup-required-badge">Required</span>
				</label>
				<input
						v-model="userApiKey"
						type="password"
						placeholder="Enter API Key"
						:class="['input-field', { 'setup-required-input': isSetupIncomplete }]"
				/>
				<p class="hint">
					Get your key
					<a href="https://steamcommunity.com/dev/apikey" target="_blank"
					>here</a
					>. Required to fetch games unless a server key is configured.
				</p>
				<p v-if="apiKeyError" class="input-context-error">
					<font-awesome-icon icon="triangle-exclamation" />
					<span>{{ apiKeyError }}</span>
				</p>
			</div>

			<!-- Optional manual override for ID -->
			<details class="advanced-settings" :open="Boolean(apiKeyError) && state.hasServerApiKey">
				<summary>{{ advancedSummaryText }}</summary>
				<div class="form-group indented" v-if="state.hasServerApiKey">
					<label>Steam Web API Key</label>
					<input
							v-model="userApiKey"
							type="password"
							placeholder="Enter API Key"
							class="input-field"
					/>
					<p v-if="apiKeyError" class="input-context-error">
						<font-awesome-icon icon="triangle-exclamation" />
						<span>{{ apiKeyError }}</span>
					</p>
					<p class="hint">
						Optional override if you want to use 
						<a href="https://steamcommunity.com/dev/apikey" target="_blank"
						>your own Steam Web API Key</a
						>.
					</p>
				</div>
				<div class="form-group indented">
					<label>Steam ID (64-bit)</label>
					<input
							v-model="newSteamId"
							placeholder="Steam ID (automatically filled by login)"
							class="input-field"
					/>
				</div>
			</details>

			<div class="actions">
				<button @click="saveSettings" class="btn btn-primary">
					Save & Reload Games
				</button>
				<button @click="clearData" class="btn btn-danger">
					Reset App Data
				</button>
			</div>

		</div>

		<div class="card-panel import-section">
			<h2>Import Steam Collections</h2>
			<p class="hint">
				Run the extraction script on your local PC to export your Steam
				collections, then paste or upload the JSON output here. Each collection
				will become a kanban column, and games will be sorted into it.
			</p>

			<div class="os-switcher">
				<div class="os-tabs">
					<button
							v-for="os in OS_OPTIONS"
							:key="os.id"
							:class="['os-tab', { active: selectedOS === os.id }]"
							@click="
              selectedOS = os.id;
              cmdCopied = false;
            "
					>
						<span class="os-label">{{ os.label }}</span>
						<span class="os-sub">{{ os.sub }}</span>
					</button>
				</div>
				<div class="os-command-block">
					<p class="os-description">{{ currentConfig.description }}</p>
					<div class="command-line">
						<code class="command-text">{{ currentConfig.command }}</code>
						<button
								class="copy-btn"
								:class="{ copied: cmdCopied }"
								@click="copyCommand"
						>
							<span v-if="cmdCopied">Copied!</span>
							<span v-else>Copy</span>
						</button>
					</div>
					<p class="os-note">{{ currentConfig.note }}</p>
				</div>
			</div>

			<div class="form-group">
				<label>Upload JSON file</label>
				<input
						type="file"
						accept=".json,.txt"
						@change="handleFileUpload"
						class="input-field file-input"
				/>
			</div>

			<div class="form-group">
				<label>Or paste JSON output</label>
				<textarea
						v-model="importJson"
						placeholder='{"collections":[{"name":"Playing","game_ids":[12345]}]}'
						class="input-field import-textarea"
						rows="6"
				></textarea>
			</div>

			<div class="import-options">
				<label class="import-mode-label">Import Mode</label>
				<div class="import-mode-toggle">
					<button
							:class="['toggle-btn', { active: importMode === 'add' }]"
							@click="importMode = 'add'"
					>
						Add to Board
					</button>
					<button
							:class="['toggle-btn', { active: importMode === 'replace' }]"
							@click="importMode = 'replace'"
					>
						Replace Board
					</button>
				</div>
				<p class="import-mode-hint" v-if="importMode === 'add'">
					Keeps your existing columns. New collection columns are added and games are sorted in.
					A game in multiple collections keeps the last one as primary and is also added to the others.
				</p>
				<p class="import-mode-hint" v-else>
					<font-awesome-icon icon="triangle-exclamation" /> Removes all existing columns and replaces them with the imported collections.
					Games not in any collection will be moved to "Backlog".
				</p>

				<label class="filter-check" v-if="importMode === 'add'">
					<input type="checkbox" v-model="importOnlyUnassigned"/>
					Only assign games currently in "Backlog" (preserve existing
					assignments)
				</label>
			</div>

			<div class="actions">
				<button
						@click="handleImportCollections"
						class="btn btn-primary"
						:disabled="!importJson || importLoading"
				>
					{{ importLoading ? "Importing..." : "Import Collections" }}
				</button>
			</div>

			<div v-if="importResult" class="import-result success">
				<p><font-awesome-icon icon="circle-check" /> Import complete!</p>
				<ul>
					<li>
						Games moved: <strong>{{ importResult.gamesMoved }}</strong>
					</li>
					<li v-if="importResult.gamesReset">
						Games reset to Backlog: <strong>{{ importResult.gamesReset }}</strong>
					</li>
					<li v-if="importResult.columnsCreated && importResult.columnsCreated?.length">
						New columns created:
						<strong>{{ importResult.columnsCreated.join(", ") }}</strong>
					</li>
					<li v-if="importResult.columnsRemoved && importResult.columnsRemoved.length">
						Columns removed:
						<strong>{{ importResult.columnsRemoved.join(", ") }}</strong>
					</li>
					<li v-if="importResult.gamesNotFound">
						Games not in library (skipped):
						<strong>{{ importResult.gamesNotFound }}</strong>
					</li>
				</ul>
			</div>

			<p v-if="importError" class="error">{{ importError }}</p>
		</div>

		<div class="card-panel manage-games-section">
			<h2>Manage Games ({{ filteredGames.length }})</h2>

			<div class="manage-controls">
				<input
						v-model="searchTerm"
						placeholder="Search games..."
						class="input-field search-input"
				/>
				<div class="bulk-actions">
					<label class="filter-check" style="margin-right: 10px">
						<input type="checkbox" v-model="showHiddenOnly"/> Show Hidden Only
					</label>
					<button @click="toggleAllHidden(true)" class="btn btn-secondary">
						Hide All
					</button>
					<button @click="toggleAllHidden(false)" class="btn btn-secondary">
						Show All
					</button>
				</div>
			</div>

			<div class="games-list">
				<transition-group name="list">
					<div
							v-for="game in filteredGames"
							:key="game.appid"
							class="game-item"
							:class="{ hidden: game.hidden }"
					>
						<GameIconImg :appid="game.appid" :icon-hash="game.img_icon_url"/>
						<span class="name">{{ game.name }}</span>
						<div class="game-actions">
							<span class="status-tag">{{ game.status }}</span>
							<span v-if="isGameDuplicated(game)" class="status-tag" style="color: var(--steam-blue-light); font-size: 0.75rem;" title="In multiple columns">
								+{{ game.duplicateColumns.length }}
							</span>
							<button
									@click="toggleHide(game)"
									class="btn btn-secondary btn-small toggle-btn"
									:class="{ active: !game.hidden }"
							>
								{{ game.hidden ? "Hidden" : "Visible" }}
							</button>
						</div>
					</div>
				</transition-group>
			</div>
		</div>
	</div>
</template>
