<script setup>
import {computed, onMounted, reactive} from 'vue'
import {useSteam} from '../composables/useSteam'
import {useRouter} from '../router'

const {state, loadState, fetchAllAchievements} = useSteam()
const {navigate} = useRouter()

const failedHeaders = reactive(new Set())
const failedPortraits = reactive(new Set())
const FALLBACK_IMG = 'https://placehold.co/600x400'

onMounted(async () => {
	loadState()
	// Ensure stats are loaded
	const now = Date.now()
	const lastUpdate = state.lastUpdated || 0
	if (state.games.length > 0 && (now - lastUpdate > 172800000)) {
		await fetchAllAchievements()
	}
})

// --- Image Handling ---
const getHeaderUrl = (appid) => {
	if (failedHeaders.has(appid)) return FALLBACK_IMG
	return `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/header.jpg`
}

const getPortraitUrl = (appid) => {
	if (failedPortraits.has(appid)) return FALLBACK_IMG
	return `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/library_600x900.jpg`
}

const onHeaderError = (appid) => {
	failedHeaders.add(appid)
}

const onPortraitError = (appid) => {
	failedPortraits.add(appid)
}

// --- KPIs & Stats Calculation ---
const stats = computed(() => {
	const games = state.games;
	const totalGames = games.length;
	let totalAchievements = 0;
	let perfectGames = 0;
	let totalPlaytimeMins = 0;
	let achievementSum = 0;
	let achievementCount = 0;
	let pileOfShameCount = 0;

	// Distribution
	let timeDist = {'0-1h': 0, '1-10h': 0, '10-100h': 0, '100h+': 0};

	// Backlog Ratio
	let unplayed = 0;
	let played = 0;
	let completed = 0;

	games.forEach(g => {
		const playtime = g.playtime_forever || 0;
		totalPlaytimeMins += playtime;

		// Pile of Shame
		if (playtime === 0) {
			pileOfShameCount++;
			unplayed++;
		} else {
			// Distribution
			if (playtime < 60) timeDist['0-1h']++;
			else if (playtime < 600) timeDist['1-10h']++;
			else if (playtime < 6000) timeDist['10-100h']++;
			else timeDist['100h+']++;
		}

		// Achievements
		if (g.achievements && !g.achievements.error && g.achievements.total > 0) {
			totalAchievements += g.achievements.achieved;
			const pct = g.achievements.achieved / g.achievements.total;
			achievementSum += pct;
			achievementCount++;

			if (g.achievements.achieved === g.achievements.total) {
				perfectGames++;
				completed++;
			} else if (playtime > 0) {
				played++;
			}
		} else {
			// If no achievements but played, counts as played
			if (playtime > 0) played++;
		}
	});

	const avgCompletion = achievementCount > 0 ? (achievementSum / achievementCount * 100) : 0;
	const totalPlaytimeHours = Math.floor(totalPlaytimeMins / 60);
	const continuousYears = (totalPlaytimeHours / 24 / 365).toFixed(1);

	// Library Rank
	let libraryRank = 'Novice';
	if (totalGames > 50) libraryRank = 'Gamer';
	if (totalGames > 100) libraryRank = 'Collector';
	if (totalGames > 500) libraryRank = 'Hoarder';
	if (totalGames > 1000) libraryRank = 'Librarian';

	const pileOfShamePct = totalGames > 0 ? Math.round((pileOfShameCount / totalGames) * 100) : 0;

	// Top 5
	const top5 = [...games]
			.sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0))
			.slice(0, 5)
			.map(g => ({
				...g,
				hours: Math.round((g.playtime_forever || 0) / 60)
			}));

	// Trophy Case (Perfect Games)
	const trophyCase = games.filter(g =>
			g.achievements && !g.achievements.error && g.achievements.total > 0 && g.achievements.achieved === g.achievements.total
	);

	// Graveyard (< 2h played, > 0)
	const graveyard = games.filter(g => {
		const pt = g.playtime_forever || 0;
		return pt > 0 && pt < 120;
	});

	// Recent (Top playtime last 2 weeks)
	const recent = [...games]
			.filter(g => g.playtime_2weeks > 0)
			.sort((a, b) => b.playtime_2weeks - a.playtime_2weeks)
			.slice(0, 5);

	// Long Haul (>500h, not perfect)
	const longHaul = games.filter(g => {
		const pt = g.playtime_forever || 0;
		const isPerf = g.achievements && g.achievements.achieved === g.achievements.total;
		return pt > 30000 && !isPerf;
	}).sort((a, b) => b.playtime_forever - a.playtime_forever);

	// Account Age
	let accountAge = 0;
	let memberSince = 'Unknown';
	if (state.userProfile && state.userProfile.timecreated) {
		const created = new Date(state.userProfile.timecreated * 1000);
		memberSince = created.toLocaleDateString();
		accountAge = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24 * 365));
	}

	return {
		totalGames,
		totalPlaytimeHours,
		totalAchievements,
		perfectGames,
		continuousYears,
		avgCompletion: Math.round(avgCompletion),
		libraryRank,
		pileOfShamePct,
		unplayed,
		played,
		completed,
		timeDist,
		top5,
		trophyCase,
		graveyard,
		recent,
		longHaul,
		accountAge,
		memberSince
	};
})

const goToEdit = () => {
	navigate('#/profile/edit')
}
</script>

<template>
	<div class="dashboard">
		<!-- Profile Header -->
		<div class="profile-header">
			<div v-if="state.userProfile" class="user-info">
				<img :src="state.userProfile.avatarfull" alt="Avatar" class="avatar-large"/>
				<div class="user-text">
					<h1>{{ state.userProfile.personaname }}</h1>
					<span class="member-since" v-if="stats.memberSince !== 'Unknown'">Member since {{
							stats.memberSince
						}} ({{ stats.accountAge }} Years)</span>
					<a :href="state.userProfile.profileurl" target="_blank" class="steam-link">View on Steam</a>
				</div>
			</div>
			<div v-else class="user-info">
				<div class="avatar-placeholder">?</div>
				<h1>Guest</h1>
			</div>
			<button @click="goToEdit" class="edit-btn">Edit Profile</button>
		</div>

		<!-- 🕹️ Hero Grid (Stats) -->
		<div class="hero-grid">
			<div class="hero-card">
				<div class="label">Total Games</div>
				<div class="value">{{ stats.totalGames }}</div>
				<div class="rank-badge">{{ stats.libraryRank }}</div>
			</div>

			<div class="hero-card">
				<div class="label">Total Playtime</div>
				<div class="value">{{ stats.totalPlaytimeHours.toLocaleString() }} <span class="unit">h</span></div>
				<div class="sub">{{ stats.continuousYears }} Years continuous</div>
			</div>

			<div class="hero-card">
				<div class="label">Perfect Games</div>
				<div class="value gold">{{ stats.perfectGames }}</div>
				<div class="sub">100% Completed</div>
			</div>

			<div class="hero-card">
				<div class="label">Total Achievements</div>
				<div class="value blue">{{ stats.totalAchievements.toLocaleString() }}</div>
				<div class="sub">Unlocked</div>
			</div>

			<div class="hero-card">
				<div class="label">Completionist Score</div>
				<div class="gauge-container">
					<div class="gauge-bg" :style="{ background: `conic-gradient(#66c0f4 ${stats.avgCompletion}%, #2a475e 0)` }">
						<div class="gauge-inner">{{ stats.avgCompletion }}%</div>
					</div>
				</div>
			</div>

			<div class="hero-card warning">
				<div class="label">Pile of Shame</div>
				<div class="value">{{ stats.pileOfShamePct }}%</div>
				<div class="progress-bar-bg">
					<div class="progress-bar-fill" :style="{ width: stats.pileOfShamePct + '%' }"></div>
				</div>
				<div class="sub">Unplayed Games</div>
			</div>
		</div>

		<!-- 📊 Visualizations -->
		<div class="viz-grid">
			<!-- Backlog Ratio -->
			<div class="viz-card">
				<h3>Backlog Ratio</h3>
				<div class="donut-chart"
				     :style="{ background: `conic-gradient(#ff5252 0% ${(stats.unplayed/stats.totalGames)*100}%, #66c0f4 ${(stats.unplayed/stats.totalGames)*100}% ${((stats.unplayed+stats.played)/stats.totalGames)*100}%, #ffc83d ${((stats.unplayed+stats.played)/stats.totalGames)*100}% 100%)` }">
					<div class="donut-hole"></div>
				</div>
				<div class="legend">
					<span class="l-item"><span class="dot red"></span> Unplayed</span>
					<span class="l-item"><span class="dot blue"></span> Played</span>
					<span class="l-item"><span class="dot gold"></span> Perfect</span>
				</div>
			</div>

			<!-- Playtime Distribution -->
			<div class="viz-card wide">
				<h3>Playtime Distribution</h3>
				<div class="bar-chart">
					<div class="bar-group" v-for="(count, label) in stats.timeDist" :key="label">
						<div class="bar" :style="{ height: Math.max(10, (count / stats.totalGames) * 150) + 'px' }">
							<span class="bar-val">{{ count }}</span>
						</div>
						<div class="bar-label">{{ label }}</div>
					</div>
				</div>
			</div>

			<!-- Top 5 Obsessions -->
			<div class="viz-card wide">
				<h3>Top 5 Obsessions</h3>
				<div class="top-list">
					<div v-for="game in stats.top5" :key="game.appid" class="top-item">
						<img :src="getHeaderUrl(game.appid)" class="bg-image" @error="onHeaderError(game.appid)"/>
						<div class="item-content">
							<div class="game-name">{{ game.name }}</div>
							<div class="game-hours">{{ game.hours }}h</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- 🏆 Lists & Grids -->
		<div class="content-section">
			<h3>🏆 The Trophy Case (Perfect Games)</h3>
			<div v-if="stats.trophyCase.length" class="trophy-grid">
				<div v-for="game in stats.trophyCase" :key="game.appid" class="trophy-item">
					<img :src="getPortraitUrl(game.appid)" loading="lazy" @error="onPortraitError(game.appid)"/>
					<div class="glow"></div>
				</div>
			</div>
			<div v-else class="empty-state">No perfect games yet. Keep pushing!</div>
		</div>

		<div class="lists-grid">
			<!-- Recently Bingeing -->
			<div class="list-card">
				<h3>🔥 Recently Bingeing</h3>
				<div class="simple-list">
					<div v-for="game in stats.recent" :key="game.appid" class="list-row">
						<img
								:src="`http://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`"
								class="icon"/>
						<span class="name">{{ game.name }}</span>
						<span class="val">{{ Math.round(game.playtime_2weeks / 60) }}h</span>
					</div>
					<div v-if="!stats.recent.length" class="empty-text">No recent activity.</div>
				</div>
			</div>

			<!-- Long Haul -->
			<div class="list-card">
				<h3>🏔️ The Long Haul (>500h)</h3>
				<div class="simple-list">
					<div v-for="game in stats.longHaul" :key="game.appid" class="list-row">
						<span class="name">{{ game.name }}</span>
						<span class="val">{{ Math.round(game.playtime_forever / 60) }}h</span>
					</div>
					<div v-if="!stats.longHaul.length" class="empty-text">No massive time-sinks yet.</div>
				</div>
			</div>

			<!-- Graveyard -->
			<div class="list-card">
				<h3>🪦 The Graveyard (< 2h)</h3>
				<div class="simple-list">
					<div v-for="game in stats.graveyard.slice(0, 10)" :key="game.appid" class="list-row muted">
						<span class="name">{{ game.name }}</span>
						<span class="val">{{ Math.round(game.playtime_forever) }}m</span>
					</div>
					<div v-if="stats.graveyard.length > 10" class="more-text">+{{ stats.graveyard.length - 10 }} more...</div>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.dashboard {
	max-width: 1400px;
	margin: 0 auto;
	color: #c7d5e0;
	animation: fadeIn 0.5s ease-out;
	overflow-y: auto;
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

/* Header */
.profile-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	background: linear-gradient(135deg, #1b2838 0%, #171a21 100%);
	padding: 30px;
	border-radius: 8px;
	margin-bottom: 30px;
	box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
	border-bottom: 2px solid #2a475e;
}

.user-info {
	display: flex;
	align-items: center;
	gap: 20px;
}

.avatar-large {
	width: 80px;
	height: 80px;
	border-radius: 8px;
	border: 2px solid #66c0f4;
	box-shadow: 0 0 15px rgba(102, 192, 244, 0.2);
}

.user-text h1 {
	margin: 0;
	color: white;
	font-size: 2rem;
}

.member-since {
	display: block;
	color: #8f98a0;
	font-size: 0.9em;
	margin: 5px 0;
}

.steam-link {
	color: #66c0f4;
	text-decoration: none;
	font-size: 0.9em;
}

.edit-btn {
	padding: 10px 20px;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid #66c0f4;
	color: #66c0f4;
	border-radius: 4px;
	cursor: pointer;
	transition: all 0.2s;
}

.edit-btn:hover {
	background: #66c0f4;
	color: #1b2838;
}

/* Hero Grid */
.hero-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: 20px;
	margin-bottom: 30px;
}

.hero-card {
	background: #161920;
	padding: 20px;
	border-radius: 8px;
	text-align: center;
	box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 140px;
	border: 1px solid #2a475e;
	transition: transform 0.2s;
}

.hero-card:hover {
	transform: translateY(-5px);
	border-color: #66c0f4;
}

.hero-card.warning {
	border-color: #d9534f;
}

.label {
	color: #8f98a0;
	text-transform: uppercase;
	font-size: 0.75em;
	letter-spacing: 1px;
	margin-bottom: 10px;
	font-weight: bold;
}

.value {
	font-size: 2rem;
	font-weight: bold;
	color: white;
}

.value.gold {
	color: #ffc83d;
	text-shadow: 0 0 10px rgba(255, 200, 61, 0.4);
}

.value.blue {
	color: #66c0f4;
}

.unit {
	font-size: 1rem;
	color: #8f98a0;
}

.sub {
	font-size: 0.8rem;
	color: #666;
	margin-top: 5px;
}

.rank-badge {
	background: #66c0f4;
	color: #1b2838;
	padding: 4px 12px;
	border-radius: 12px;
	font-weight: bold;
	margin-top: 5px;
	font-size: 0.8em;
}

/* Gauge */
.gauge-container {
	width: 80px;
	height: 80px;
	position: relative;
}

.gauge-bg {
	width: 100%;
	height: 100%;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
}

.gauge-inner {
	width: 60px;
	height: 60px;
	background: #161920;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: bold;
	color: white;
}

/* Progress Bar */
.progress-bar-bg {
	width: 100%;
	height: 8px;
	background: #2a2a2a;
	border-radius: 4px;
	margin-top: 5px;
	overflow: hidden;
}

.progress-bar-fill {
	height: 100%;
	background: #d9534f;
}

/* Viz Grid */
.viz-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
	gap: 20px;
	margin-bottom: 30px;
}

.viz-card {
	background: #1b2838;
	padding: 20px;
	border-radius: 8px;
	box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
}

.viz-card.wide {
	grid-column: span 2;
}

@media (max-width: 900px) {
	.viz-card.wide {
		grid-column: span 1;
	}
}

h3 {
	margin: 0 0 15px 0;
	color: #66c0f4;
	font-size: 1.1rem;
	border-bottom: 1px solid #2a475e;
	padding-bottom: 10px;
}

/* Donut Chart */
.donut-chart {
	width: 150px;
	height: 150px;
	border-radius: 50%;
	margin: 0 auto;
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
}

.donut-hole {
	width: 100px;
	height: 100px;
	background: #1b2838;
	border-radius: 50%;
}

.legend {
	display: flex;
	justify-content: center;
	gap: 15px;
	margin-top: 15px;
	font-size: 0.9em;
}

.l-item {
	display: flex;
	align-items: center;
	gap: 5px;
}

.dot {
	width: 10px;
	height: 10px;
	border-radius: 50%;
}

/* Bar Chart */
.bar-chart {
	display: flex;
	justify-content: space-around;
	align-items: flex-end;
	height: 180px;
	padding-top: 20px;
}

.bar-group {
	display: flex;
	flex-direction: column;
	align-items: center;
	width: 100%;
}

.bar {
	width: 40px;
	background: #66c0f4;
	border-radius: 4px 4px 0 0;
	transition: height 0.5s ease;
	display: flex;
	align-items: flex-end;
	justify-content: center;
	min-height: 2px;
}

.bar-val {
	margin-bottom: 5px;
	color: #ffc83d;
	font-weight: bold;
	font-size: 0.8em;
}

.bar-label {
	margin-top: 10px;
	font-size: 0.8em;
	color: #8f98a0;
}

/* Top List */
.top-list {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.top-item {
	position: relative;
	padding: 15px 20px;
	border-radius: 4px;
	border: 1px solid #2a475e;
	overflow: hidden;
	height: 50px; /* Fixed height for consistency */
	display: flex;
	align-items: center;
}

.bg-image {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	z-index: 0;
	opacity: 0.6; /* Dim it slightly for text readability */
	mask-image: linear-gradient(to right, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.5) 100%);
}

.item-content {
	position: relative;
	z-index: 1;
	display: flex;
	justify-content: space-between;
	align-items: center;
	width: 100%;
}

.game-name {
	font-weight: bold;
	color: white;
	text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
	font-size: 1.1em;
}

.game-hours {
	background: rgba(0, 0, 0, 0.6);
	padding: 4px 8px;
	border-radius: 4px;
	color: #66c0f4;
	font-weight: bold;
}

/* Trophy Case */
.content-section {
	margin-bottom: 30px;
}

.trophy-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
	gap: 15px;
}

.trophy-item {
	position: relative;
	border-radius: 4px;
	overflow: hidden;
	box-shadow: 0 0 10px rgba(255, 200, 61, 0.2);
	border: 2px solid #ffc83d;
	transition: transform 0.2s;
	background: #101217;
}

.trophy-item:hover {
	transform: scale(1.05);
	box-shadow: 0 0 20px rgba(255, 200, 61, 0.5);
	z-index: 10;
}

.trophy-item img {
	width: 100%;
	display: block;
	aspect-ratio: 2/3;
	object-fit: cover;
}

.empty-state {
	padding: 30px;
	text-align: center;
	color: #666;
	background: rgba(0, 0, 0, 0.2);
	border-radius: 8px;
}

/* Lists Grid */
.lists-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
	gap: 20px;
}

.list-card {
	background: #1b2838;
	padding: 20px;
	border-radius: 8px;
}

.simple-list {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.list-row {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 8px;
	background: rgba(255, 255, 255, 0.05);
	border-radius: 4px;
}

.list-row.muted {
	opacity: 0.7;
}

.list-row .icon {
	width: 24px;
	height: 24px;
	border-radius: 2px;
}

.list-row .name {
	flex: 1;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.list-row .val {
	color: #66c0f4;
	font-size: 0.9em;
}

.empty-text {
	color: #666;
	font-style: italic;
	padding: 10px;
}

.more-text {
	text-align: center;
	font-size: 0.8em;
	color: #666;
	padding: 5px;
}
</style>
