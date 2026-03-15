<script setup lang="ts">
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

const sizeClasses: Record<'default' | 'small' | 'large', string> = {
	small: 'game-icon-small',
	default: '',
	large: 'game-icon-large'
}
</script>

<template>
	<img
			v-if="props.iconHash"
			:src="`//media.steampowered.com/steamcommunity/public/images/apps/${props.appid}/${props.iconHash}.jpg`"
			:alt="props.alt"
			:class="sizeClasses[props.size]"
			v-bind="$attrs"
	/>
</template>

