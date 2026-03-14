<script setup>
defineProps({
	show: {
		type: Boolean,
		default: true
	},
	contentClass: {
		type: String,
		default: ''
	},
	maxWidth: {
		type: String,
		default: '600px'
	},
	padded: {
		type: Boolean,
		default: true
	}
})

const emit = defineEmits(['close'])

const close = () => {
	emit('close')
}
</script>

<template>
	<transition name="fade">
		<div v-if="show" class="modal-overlay" @click.self="close">
			<div class="modal-content" :class="contentClass" :style="{ maxWidth }">
				<button class="btn btn-icon close-btn-abs" @click="close">
					<font-awesome-icon icon="xmark" />
				</button>

				<div v-if="$slots.header" class="overlay-header">
					<slot name="header" />
				</div>

				<div class="overlay-body" :class="{ padded }">
					<slot />
				</div>

				<div v-if="$slots.actions" class="modal-actions">
					<slot name="actions" />
				</div>
			</div>
		</div>
	</transition>
</template>

<style scoped>
.modal-overlay {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: rgba(0, 0, 0, 0.8);
	display: flex;
	justify-content: center;
	align-items: center;
	z-index: 99999;
}

.modal-content {
	background: #1b2838;
	border-radius: 8px;
	width: 95%;
	max-height: 75vh;
	overflow: hidden;
	box-shadow: 0 0 20px rgba(102, 192, 244, 0.3);
	color: white;
	position: relative;
	display: flex;
	flex-direction: column;
}

.close-btn-abs {
	position: absolute;
	top: 12px;
	right: 15px;
	font-size: 1.5rem;
	z-index: 10;
}

.overlay-header {
	padding: 25px 25px 15px;
	background: linear-gradient(to right, #171a21, #2a475e);
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	flex-shrink: 0;
}

.overlay-body {
	flex: 1;
	overflow-y: auto;
}

.overlay-body.padded {
	padding: 20px 25px;
}

.modal-actions {
	display: flex;
	justify-content: flex-end;
	gap: 10px;
	padding: 15px 25px;
	border-top: 1px solid rgba(255, 255, 255, 0.05);
	flex-shrink: 0;
}

@media (max-width: 480px) {
	.modal-content {
		max-height: 100dvh;
		width: 100%;
		height: 100dvh;
		border-radius: 0;
	}
}
</style>






