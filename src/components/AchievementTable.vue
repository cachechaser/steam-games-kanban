<script setup>
import InfoIcon from './icons/InfoIcon.vue'

const props = defineProps({
	achievements: {
		type: Array,
		required: true
	},
	loading: {
		type: Boolean,
		default: false
	},
	showGameColumn: {
		type: Boolean,
		default: true
	},
	sortBy: {
		type: String,
		default: ''
	},
	sortDesc: {
		type: Boolean,
		default: true
	}
})

const emit = defineEmits(['sort', 'game-click'])

const handleSort = (field) => {
	emit('sort', field)
}

const onGameClick = (ach) => {
	emit('game-click', ach)
}

const getIconUrl = (ach) => {
	const url = ach.achieved ? ach.icon : (ach.iconGray || ach.icongray)
	if (!url) return ''
	if (url.startsWith('http')) return url
	return `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/${ach.appid}/${url}.jpg`
}
</script>

<template>
	<div class="table-responsive">
		<table class="ach-table">
			<thead>
			<tr>
				<th v-if="showGameColumn" @click="handleSort('gameName')" :class="['game-cell', {sorted: sortBy === 'gameName'}]">
					Game
					<span class="sort-icon">{{ sortBy === 'gameName' ? (sortDesc ? '▼' : '▲') : '' }}</span>
				</th>
				<th @click="handleSort('achName')" :class="{sorted: sortBy === 'achName'}">
					Achievement
					<span class="sort-icon">{{ sortBy === 'achName' ? (sortDesc ? '▼' : '▲') : '' }}</span>
				</th>
				<th @click="handleSort('unlockRate')" :class="{sorted: sortBy === 'unlockRate'}" class="text-right">
					Global %
					<span class="sort-icon">{{ sortBy === 'unlockRate' ? (sortDesc ? '▼' : '▲') : '' }}</span>
				</th>
				<th @click="handleSort('unlockDate')" :class="{sorted: sortBy === 'unlockDate'}" class="text-right">
					Unlock Date
					<span class="sort-icon">{{ sortBy === 'unlockDate' ? (sortDesc ? '▼' : '▲') : '' }}</span>
				</th>
			</tr>
			</thead>
			<tbody>
			<tr v-if="achievements.length === 0">
				<td :colspan="showGameColumn ? 4 : 3" class="empty-state">
					{{ loading ? 'Loading data...' : 'No achievements found.' }}
				</td>
			</tr>
			<tr v-for="ach in achievements" :key="`${ach.appid}-${ach.apiname}`" :class="{locked: !ach.achieved}">
				<td v-if="showGameColumn" class="game-cell">
					<div class="game-info" @click="onGameClick(ach)" style="cursor: pointer;">
						<span class="game-name">{{ ach.gameName }}</span>
						<span class="game-info-icon" title="Game Info">
							<InfoIcon/>
						</span>
					</div>
				</td>
				<td class="desc-cell">
					<div class="ach-content-wrapper">
						<img :src="getIconUrl(ach)" class="ach-img" alt="" loading="lazy"/>
						<div class="ach-text">
							<div class="ach-title">{{ ach.name }}</div>
							<div class="ach-desc">{{ ach.description }}</div>
						</div>
					</div>
				</td>
				<td class="rate-cell">
					<span class="rate-badge">{{ (ach.unlockPercentage || 0).toFixed(1) }}%</span>
				</td>
				<td class="date-cell">
                    <span v-if="ach.achieved && (ach.unlockTime || ach.unlocktime)" class="unlock-date">
                        {{ new Date((ach.unlockTime || ach.unlocktime) * 1000).toLocaleDateString() }}
                    </span>
					<span v-else-if="ach.achieved" class="status-text unlocked">✓</span>
					<span v-else class="status-text locked">🔒</span>
				</td>
			</tr>
			</tbody>
		</table>
	</div>
</template>

<style scoped>
.table-responsive {
	width: 100%;
	overflow-x: auto;
}

.ach-table {
	width: 100%;
	border-collapse: collapse;
	margin-top: 10px;
}

.ach-table th {
	text-align: left;
	padding: 12px 10px;
	color: var(--steam-text-light);
	font-weight: 500;
	font-size: 0.85rem;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	cursor: pointer;
	user-select: none;
	position: sticky;
	top: 0;
	backdrop-filter: blur(8px) brightness(90%);
	z-index: 1;
}

.ach-table th:hover {
	color: white;
	background: #1b2838;
}

.ach-table th.text-right {
	text-align: right;
}

.ach-table th.sorted {
	color: #ffffff;
	text-shadow: 0 0 12px rgba(255, 255, 255, 0.3);
}

.ach-table td {
	padding: 10px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	vertical-align: middle;
}

.ach-table tr:hover td {
	background: rgba(255, 255, 255, 0.03);
}

.ach-table tr.locked {
	opacity: 0.6;
}

.game-cell {
	width: 20%;
	max-width: 200px;
}

.game-info {
	display: flex;
	align-items: center;
	gap: 6px;
}

.game-info-icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
	border-radius: 50%;
	background: var(--steam-bg-darker);
	color: var(--steam-text-muted);
	opacity: 0;
	transition: opacity 0.15s ease;
	flex-shrink: 0;
}

.game-info-icon svg {
	width: 14px;
	height: 14px;
}

.game-info-icon:hover {
	background: rgba(255, 255, 255, 0.15);
	color: #ccc;
}

.ach-table tr:hover .game-info-icon {
	opacity: 1;
}

@media (hover: none) {
	.ach-table tr:hover .game-info-icon {
		opacity: 0;
	}
}

.ach-content-wrapper {
	display: flex;
	gap: 12px;
	align-items: flex-start;
}

.ach-img {
	width: 48px;
	height: 48px;
	border-radius: 4px;
	background: rgba(0, 0, 0, 0.3);
	flex-shrink: 0;
}

.ach-text {
	flex: 1;
	min-width: 0;
	align-self: center;
}

.desc-cell {
	width: 50%;
}

.ach-title {
	font-weight: bold;
	color: #e1e1e1;
	margin-bottom: 2px;
}

.ach-desc {
	font-size: 0.8rem;
	color: var(--steam-text-muted);
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.rate-cell {
	text-align: right;
	width: 100px;
}

.rate-badge {
	background: rgba(102, 192, 244, 0.1);
	color: var(--steam-blue-light);
	padding: 2px 6px;
	border-radius: 4px;
	font-size: 0.85rem;
	font-weight: bold;
}

.date-cell {
	text-align: right;
	width: 120px;
	font-size: 0.85rem;
	color: var(--steam-text-muted);
}

.status-text.unlocked {
	color: #a4d007;
	font-weight: bold;
	font-size: 1.2rem;
}

.empty-state {
	padding: 30px;
	text-align: center;
	color: #666;
	background: rgba(0, 0, 0, 0.2);
	border-radius: 8px;
}
</style>
