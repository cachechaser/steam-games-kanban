<script setup lang="ts">
import { DEFAULT_COLUMN_COLOR } from '@/types/board'

withDefaults(defineProps<{
	name: string
	color?: string
	count?: number
	status?: string
}>(), {
	color: DEFAULT_COLUMN_COLOR,
	count: 0,
	status: ''
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

