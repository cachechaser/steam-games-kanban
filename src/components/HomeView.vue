<script setup>
const loginWithSteam = () => {
	const returnUrl = window.location.href.split('#')[0]; // Return to root
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
	<div class="home-view">
		<div class="hero-section">
			<h1>Steam Backlog</h1>
			<p class="subtitle">Organize, Track, and Complete your Steam Library.</p>

			<button @click="loginWithSteam" class="cta-btn">
				<img src="https://community.cloudflare.steamstatic.com/public/images/signinthroughsteam/sits_01.png"
				     alt="Sign in through Steam"/>
			</button>
		</div>

		<div class="features-grid">
			<div class="card-panel card-hover feature-card">
				<div class="icon">📋</div>
				<h3>Kanban Board</h3>
				<p>Drag and drop your games between Backlog, Playing, and Completed. Customize your workflow with custom
					columns.</p>
			</div>
			<div class="card-panel card-hover feature-card">
				<div class="icon">🏆</div>
				<h3>Achievement Tracking</h3>
				<p>Visualize your progress - group games by completion percentage and hunt down those
					100% perfect games.</p>
			</div>
			<div class="card-panel card-hover feature-card">
				<div class="icon">📊</div>
				<h3>Advanced Analytics</h3>
				<p>Deep dive into your gaming habits with completion scores, playtime distribution, and backlog ratios.</p>
			</div>
			<div class="card-panel card-hover feature-card">
				<div class="icon">🔍</div>
				<h3>Library Management</h3>
				<p>Filter out games - hide the ones you'll never play, and focus on what matters.</p>
			</div>
			<div class="card-panel card-hover feature-card">
				<div class="icon">💻</div>
				<h3>Keep your data safe</h3>
				<p>Your browser does all the work! No data will be saved on any server.</p>
			</div>
			<div class="card-panel card-hover feature-card">
				<div class="icon">😉</div>
				<h3>More to come</h3>
				<p>I will add more stuff if I need more stuff for my own personal use.</p>
			</div>
		</div>
	</div>
</template>

<style scoped>
.home-view {
	display: flex;
	flex-direction: column;
	align-items: center;
	overflow-y: auto;
	color: var(--steam-text-light);
	box-sizing: border-box;
	text-align: center;
	animation: fadeIn 0.8s ease-out;
}

@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateY(20px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.hero-section {
	margin-bottom: 60px;
	max-width: 800px;
}

h1 {
	font-size: 3.5rem;
	margin: 0 0 20px 0;
	background: linear-gradient(135deg, var(--steam-blue-light) 0%, #ffffff 100%);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	font-weight: 900;
}

.subtitle {
	font-size: 1.5rem;
	color: var(--steam-text-muted);
	margin-bottom: 40px;
	font-weight: 300;
}

.cta-btn {
	background: transparent;
	border: none;
	padding: 0;
	cursor: pointer;
	transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.cta-btn:hover {
	transform: scale(1.1);
	filter: drop-shadow(0 0 15px rgba(102, 192, 244, 0.4));
}

.features-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
	gap: 30px;
	width: 100%;
	max-width: 1200px;
}

.feature-card {
	padding: 30px;
	/* Removed background, border-radius, border, transition as they are in card-panel/card-hover */
}

.icon {
	font-size: 3rem;
	margin-bottom: 20px;
}

h3 {
	color: var(--steam-blue-light);
	margin: 0 0 10px 0;
	font-size: 1.3rem;
}

p {
	color: var(--steam-text-muted);
	line-height: 1.6;
	margin: 0;
}

@media (max-width: 768px) {
	h1 {
		font-size: 2.5rem;
	}

	.subtitle {
		font-size: 1.2rem;
	}
}
</style>
