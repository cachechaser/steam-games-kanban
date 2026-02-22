<script setup>
defineProps({
	appid: {type: Number, required: true},
	iconHash: {type: String, default: ''},
	alt: {type: String, default: ''},
	size: {type: String, default: 'default'} // 'default' | 'small' | 'large'
})

const sizeClasses = {
	small: 'game-icon-small',
	default: '',
	large: 'game-icon-large'
}
</script>

<template>
	<img
			v-if="iconHash"
			:src="`//media.steampowered.com/steamcommunity/public/images/apps/${appid}/${iconHash}.jpg`"
			:alt="alt"
			:class="sizeClasses[size]"
			v-bind="$attrs"
	/>
</template>

