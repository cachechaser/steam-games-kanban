<script setup>
defineProps({
	title: {type: String, required: true}
})
</script>

<template>
	<div class="header-bar">
		<div class="header-title">
			<h1>{{ title }}</h1>
			<slot name="after-title"/>
		</div>
		<slot name="actions"/>
	</div>
</template>

