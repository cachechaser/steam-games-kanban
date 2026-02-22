<script setup>
import {useSteamLogin} from '@/composables/useSteamLogin.js'

const {loginWithSteam} = useSteamLogin()
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
