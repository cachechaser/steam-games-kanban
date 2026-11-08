<script setup lang="ts">
import { useSteamIcon } from '@/composables/useSteamIcon'

const props = withDefaults(defineProps<{
	appid: number
	iconHash?: string
	alt?: string
	size?: 'default' | 'small' | 'large'
}>(), {
	iconHash: '',
	alt: '',
	size: 'default'
})

const { getGameIconUrl, handleGameIconError } = useSteamIcon()

const sizeClasses: Record<'default' | 'small' | 'large', string> = {
	small: 'game-icon-small',
	default: '',
	large: 'game-icon-large'
}

const handleImageError = (e: Event): void => {
	const img = e && (e.target as HTMLImageElement)
	// Create a temporary SteamGame object for the composable
	handleGameIconError({ appid: props.appid, img_icon_url: props.iconHash } as any, img)
}

// For the initial URL, we use a helper that doesn't need state tracking
const iconUrl = (() => {
	if (!props.iconHash) return ''
	return `//media.steampowered.com/steamcommunity/public/images/apps/${props.appid}/${props.iconHash}.jpg`
})()
</script>

<template>
	<img
			v-if="props.iconHash"
			:src="iconUrl"
			:alt="props.alt"
			:class="sizeClasses[props.size]"
			v-bind="$attrs"
			@error="handleImageError"
	/>
</template>

