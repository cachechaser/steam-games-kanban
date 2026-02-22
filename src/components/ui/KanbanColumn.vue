<script setup>
defineProps({
	name: {type: String, required: true},
	color: {type: String, default: '#66c0f4'},
	count: {type: Number, default: 0},
	status: {type: String, default: ''}
})
</script>

<template>
	<div
			class="kanban-column column"
			:style="{ borderTopColor: color }"
			:data-status="status || name"
	>
		<div class="column-header">
			<h2>
				{{ name }}
				<span class="column-count">{{ count }}</span>
			</h2>
		</div>
		<div class="card-list">
			<transition-group name="card-list">
				<slot/>
			</transition-group>
		</div>
	</div>
</template>

