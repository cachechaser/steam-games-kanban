<script setup>
import {computed, onMounted, reactive} from 'vue'
import {useSteam} from '@/composables/useSteam.js'
import {useRouter} from '@/router.js'

const {state, loadState, fetchAllAchievementsDetailed, getCompletionData} = useSteam()
const {navigate} = useRouter()

const failedHeaders = reactive(new Set())
const failedPortraits = reactive(new Set())
const FALLBACK_IMG = 'https://placehold.co/600x400'

onMounted(async () => {
	loadState()
	// Ensure stats are loaded
	const now = Date.now()
	const lastUpdate = state.lastUpdated || 0

	const hasStats = state.games.some(g => g.achievementsList && g.achievementsList.achievements && g.achievementsList.achievements.length > 0)

	if (state.games.length > 0 && (now - lastUpdate > 172800000 || !hasStats)) {
		await fetchAllAchievementsDetailed()
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
		const achData = getCompletionData(g)

		if (achData && !achData.error && achData.total > 0) {
			totalAchievements += achData.achieved;
			const pct = achData.achieved / achData.total;
			achievementSum += pct;
			achievementCount++;

			if (achData.achieved === achData.total) {
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
	const trophyCase = games.filter(g => {
		const achData = getCompletionData(g)
		return achData && !achData.error && achData.total > 0 && achData.achieved === achData.total
	});

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
		const achData = getCompletionData(g)
		const isPerf = achData && achData.achieved === achData.total;
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
			<button @click="goToEdit" class="btn btn-secondary edit-btn">Edit Profile</button>
		</div>

		<!-- 🕹️ Hero Grid (Stats) -->
		<div class="hero-grid">
			<div class="card-panel card-hover hero-card">
				<div class="label">Total Games</div>
				<div class="value">{{ stats.totalGames }}</div>
				<div class="rank-badge">{{ stats.libraryRank }}</div>
			</div>

			<div class="card-panel card-hover hero-card">
				<div class="label">Total Playtime</div>
				<div class="value">{{ stats.totalPlaytimeHours.toLocaleString() }} <span class="unit">h</span></div>
				<div class="sub">{{ stats.continuousYears }} Years continuous</div>
			</div>

			<div class="card-panel card-hover hero-card">
				<div class="label">Perfect Games</div>
				<div class="value gold">{{ stats.perfectGames }}</div>
				<div class="sub">100% Completed</div>
			</div>

			<div class="card-panel card-hover hero-card">
				<div class="label">Total Achievements</div>
				<div class="value blue">{{ stats.totalAchievements.toLocaleString() }}</div>
				<div class="sub">Unlocked</div>
			</div>

			<div class="card-panel card-hover hero-card">
				<div class="label">Completionist Score</div>
				<div class="gauge-container">
					<div class="gauge-bg" :style="{ background: `conic-gradient(var(--steam-blue-light) ${stats.avgCompletion}%, var(--steam-blue-dark) 0)` }">
						<div class="gauge-inner">{{ stats.avgCompletion }}%</div>
					</div>
				</div>
			</div>

			<div class="card-panel card-hover hero-card warning">
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
			<div class="card-panel viz-card">
				<h3>Backlog Ratio</h3>
				<div class="donut-chart"
				     :style="{ background: `conic-gradient(#ff5252 0% ${(stats.unplayed/stats.totalGames)*100}%, var(--steam-blue-light) ${(stats.unplayed/stats.totalGames)*100}% ${((stats.unplayed+stats.played)/stats.totalGames)*100}%, #ffc83d ${((stats.unplayed+stats.played)/stats.totalGames)*100}% 100%)` }">
					<div class="donut-hole"></div>
				</div>
				<div class="legend">
					<span class="l-item"><span class="dot red"></span> Unplayed</span>
					<span class="l-item"><span class="dot blue"></span> Played</span>
					<span class="l-item"><span class="dot gold"></span> Perfect</span>
				</div>
			</div>

			<!-- Playtime Distribution -->
			<div class="card-panel viz-card wide">
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
			<div class="card-panel viz-card wide">
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
			<div class="card-panel list-card">
				<h3>🔥 Recently Bingeing</h3>
				<div class="simple-list">
					<div v-for="game in stats.recent" :key="game.appid" class="list-row">
						<img
								:src="`//media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`"
								class="icon"/>
						<span class="name">{{ game.name }}</span>
						<span class="val">{{ Math.round(game.playtime_2weeks / 60) }}h</span>
					</div>
					<div v-if="!stats.recent.length" class="empty-text">No recent activity.</div>
				</div>
			</div>

			<!-- Long Haul -->
			<div class="card-panel list-card">
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
			<div class="card-panel list-card">
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
