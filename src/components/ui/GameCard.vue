<script setup>
import InfoIcon from '../icons/InfoIcon.vue'
import HideIcon from '../icons/HideIcon.vue'

const props = defineProps({
	game: {type: Object, required: true},
	completionData: {type: Object, required: true},
	columnColor: {type: String, default: '#66c0f4'},
	draggable: {type: Boolean, default: false},
	loadingDetails: {type: Boolean, default: false}
})

const emit = defineEmits(['info', 'hide', 'load-stats'])

const gameIconUrl = (game) => {
	if (!game.img_icon_url) return '//placehold.co/64x64'
	return `//media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`
}

const completionPercent = () => {
	const {achieved, total} = props.completionData
	if (!total) return 0
	return Math.round(achieved / total * 100)
}

const completionWidth = () => {
	const {achieved, total} = props.completionData
	if (!total) return '0%'
	return (achieved / total * 100) + '%'
}
</script>

<template>
	<div class="card-panel card-hover card" :draggable="draggable">
		<div class="card-actions-top">
			<button @click="emit('info', game)" class="hide-btn" title="More Info">
				<InfoIcon/>
			</button>
			<button @click="emit('hide', game)" class="hide-btn" title="Hide Game">
				<HideIcon/>
			</button>
		</div>
		<div class="card-header">
			<img
					v-if="game.img_icon_url"
					:src="gameIconUrl(game)"
					alt="icon"
					class="game-icon"
			/>
			<span class="game-title">{{ game.name }}</span>
		</div>

		<div class="stats">
			<div v-if="completionData.total > 0">
				<div class="achievement-text">
					<span>{{ completionData.achieved }} / {{ completionData.total }}</span>
					<span class="percentage" :style="{ color: columnColor }">{{ completionPercent() }}%</span>
				</div>
				<div class="progress-bar">
					<div class="progress"
					     :style="{ width: completionWidth(), background: columnColor }"></div>
				</div>
			</div>
			<div v-else-if="completionData.error" class="stat-error">
				{{ completionData.error }}
			</div>
			<button v-else @click="emit('load-stats', game)" :disabled="loadingDetails"
			        class="btn btn-secondary btn-small small-btn">
				{{ loadingDetails ? '...' : 'Load Stats' }}
			</button>
		</div>
	</div>
</template>

