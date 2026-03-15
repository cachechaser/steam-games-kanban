<script setup lang="ts">
import HideIcon from '../icons/HideIcon.vue'
import InfoIcon from '@/components/icons/InfoIcon.vue'
import type { CompletionData, SteamGame } from '@/types/domain'
import { DEFAULT_COLUMN_COLOR } from '@/types/board'

const props = withDefaults(defineProps<{
	game: SteamGame
	completionData: CompletionData
	columnColor?: string
	draggable?: boolean
	loadingDetails?: boolean
	isDuplicate?: boolean
}>(), {
	columnColor: DEFAULT_COLUMN_COLOR,
	draggable: false,
	loadingDetails: false,
	isDuplicate: false
})

const emit = defineEmits<{
	(e: 'info', game: SteamGame): void
	(e: 'hide', game: SteamGame): void
	(e: 'load-stats', game: SteamGame): void
}>()

const gameIconUrl = (game: SteamGame): string => {
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
	<div class="card-panel card-hover card" :draggable="draggable" :class="{ 'is-duplicate': isDuplicate }">
		<div class="card-actions-top">
			<button @click.stop="emit('info', game)" class="btn btn-icon hide-btn" title="Show Game Info">
				<InfoIcon/>
			</button>
			<button @click.stop="emit('hide', game)" class="btn btn-icon hide-btn" title="Hide Game">
				<HideIcon/>
			</button>
		</div>
		<div class="card-header">
			<div class="game-icon-wrapper">
				<img
						v-if="game.img_icon_url"
						:src="gameIconUrl(game)"
						alt="icon"
						class="game-icon"
				/>
				<span v-if="isDuplicate" class="duplicate-badge" title="This game appears in multiple columns"><font-awesome-icon icon="copy" /></span>
			</div>
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

