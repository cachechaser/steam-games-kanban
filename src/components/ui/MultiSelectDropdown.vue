<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, onUpdated, ref, toRefs} from 'vue'
import type { CSSProperties } from 'vue'

const MODE_OPTIONS = ['tags', 'dropdown'] as const
type Mode = (typeof MODE_OPTIONS)[number]

type OptionObject = { key: string, label: string, locked?: boolean }
type Option = string | OptionObject
type NormalizedOption = { key: string, label: string, locked: boolean }

const props = withDefaults(defineProps<{
	/** Array of option objects: { key: string, label: string, locked?: boolean } or plain strings */
	options: Option[]
	/** Array of selected keys (strings) */
	modelValue: string[]
	/** Display mode: 'tags' (inline pill toggles) or 'dropdown' (button + checkbox menu) */
	mode?: Mode
	/** In dropdown mode, show selected items as removable tags instead of a plain button */
	showTags?: boolean
	/** Button label shown in dropdown mode */
	buttonLabel?: string
	/** FontAwesome icon name for the dropdown button */
	buttonIcon?: string | null
	/** Minimum number of selected items (prevents unchecking below this) */
	minSelected?: number
}>(), {
	mode: 'tags',
	showTags: true,
	buttonLabel: 'Select',
	buttonIcon: null,
	minSelected: 0,
})

const { mode, showTags, buttonLabel, buttonIcon } = toRefs(props)

const emit = defineEmits<{
	(e: 'update:modelValue', value: string[]): void
}>()

const dropdownOpen = ref(false)
const triggerEl = ref<HTMLElement | null>(null)
const menuStyle = ref<CSSProperties>({})

const DEFAULT_DROPDOWN_Z_INDEX = 1000
const OVERLAY_DROPDOWN_Z_OFFSET = 2

const resolveDropdownZIndex = (): number => {
	const trigger = triggerEl.value
	if (!trigger) return DEFAULT_DROPDOWN_Z_INDEX

	const overlay = trigger.closest('.modal-overlay')
	if (!(overlay instanceof HTMLElement)) return DEFAULT_DROPDOWN_Z_INDEX

	const parsed = Number.parseInt(window.getComputedStyle(overlay).zIndex || '', 10)
	if (Number.isFinite(parsed)) {
		return parsed + OVERLAY_DROPDOWN_Z_OFFSET
	}

	return DEFAULT_DROPDOWN_Z_INDEX
}

const backdropStyle = computed<CSSProperties>(() => ({
	zIndex: `${Math.max(resolveDropdownZIndex() - 1, 1)}`,
}))

/** Normalize an option to { key, label, locked } */
const normalize = (opt: Option): NormalizedOption => {
	if (typeof opt === 'string') return {key: opt, label: opt, locked: false}
	return {key: opt.key, label: opt.label, locked: !!opt.locked}
}

/** Options with locked filtered out for display */
const displayOptions = computed<Option[]>(() => {
	return props.options.filter(o => !normalize(o).locked)
})

const isSelected = (key: string): boolean => props.modelValue.includes(key)

const isDisabled = (opt: Option) => {
	const n = normalize(opt)
	if (n.locked) return true
	return isSelected(n.key) && props.modelValue.length <= props.minSelected
}

/** Selected options as normalized objects, preserving modelValue order (excluding locked) */
const selectedOptions = computed<NormalizedOption[]>(() => {
	return props.modelValue
		.map(key => props.options.find(o => normalize(o).key === key))
		.filter(o => o && !normalize(o).locked)
		.map(normalize)
})

const toggle = (opt: Option) => {
	const n = normalize(opt)
	if (isDisabled(opt)) return

	const selected = [...props.modelValue]
	const idx = selected.indexOf(n.key)
	if (idx > -1) {
		selected.splice(idx, 1)
	} else {
		selected.push(n.key)
	}
	emit('update:modelValue', selected)
}

const hiddenCount = ref(0)

const positionMenu = () => {
	const el = triggerEl.value
	if (!el) return
	const rect = el.getBoundingClientRect()
	menuStyle.value = {
		position: 'fixed',
		top: `${rect.bottom + 4}px`,
		left: `${rect.left}px`,
		minWidth: `${rect.width}px`,
		zIndex: `${resolveDropdownZIndex()}`,
	}
}

const openDropdown = () => {
	dropdownOpen.value = !dropdownOpen.value
	if (dropdownOpen.value) {
		nextTick(positionMenu)
	}
}

const closeDropdown = () => {
	dropdownOpen.value = false
}

const tagsContainerEl = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null

const hideOverflowingTags = () => {
	const container = tagsContainerEl.value
	const trigger = triggerEl.value
	if (!container || !trigger) return

	const tags = container.querySelectorAll<HTMLElement>('.col-tag')
	if (!tags.length) return
	tags.forEach(t => t.style.display = 'none')
	
	const parentEl = trigger.closest('.tag-dropdown')?.parentElement
	const maxWidth = parentEl ? parentEl.clientWidth : trigger.clientWidth

	const rightEl = trigger.querySelector('.tag-dropdown-right') as HTMLElement
	const rightWidth = rightEl ? rightEl.offsetWidth : 60
	const availableWidth = maxWidth - rightWidth - 26

	let usedWidth = 0
	const gap = 4
	let visible = 0

	for (let i = 0; i < tags.length; i++) {
		tags[i].style.display = ''
		const tagWidth = tags[i].offsetWidth

		const needed = i === 0 ? tagWidth : usedWidth + gap + tagWidth

		if (needed <= availableWidth) {
			usedWidth = needed
			visible++
		} else {
			tags[i].style.display = 'none'
		}
	}

	hiddenCount.value = tags.length - visible
}

onMounted(() => {
	if (props.mode === 'dropdown' && props.showTags && triggerEl.value) {
		nextTick(hideOverflowingTags)
		const parentEl = triggerEl.value.closest('.tag-dropdown')?.parentElement || triggerEl.value
		resizeObserver = new ResizeObserver(() => hideOverflowingTags())
		resizeObserver.observe(parentEl)
	}
})

onUpdated(() => {
	if (props.mode === 'dropdown' && props.showTags) {
		nextTick(hideOverflowingTags)
	}
})

onBeforeUnmount(() => {
	resizeObserver?.disconnect()
})
</script>

<template>
	<!-- Tags mode -->
	<div v-if="mode === 'tags'" class="column-tags">
		<span
				v-for="opt in displayOptions"
				:key="normalize(opt).key"
				@click="toggle(opt)"
				:class="['col-tag', isSelected(normalize(opt).key) ? 'active' : '']"
		>
			{{ normalize(opt).label }}
		</span>
	</div>

	<!-- Dropdown mode with tags display -->
	<div v-else-if="showTags" class="tag-dropdown">
		<div ref="triggerEl" class="tag-dropdown-trigger" @click.stop="openDropdown">
			<div class="tag-dropdown-left">
				<div ref="tagsContainerEl" class="tag-dropdown-tags">
					<span
							v-for="opt in selectedOptions"
							:key="opt.key"
							class="col-tag active"
							@click.stop="toggle(opt)"
					>{{ opt.label }}</span>
					<span v-if="selectedOptions.length === 0" class="tag-dropdown-placeholder">None selected</span>
				</div>
				<div class="tag-dropdown-fade"></div>
			</div>
			<div class="tag-dropdown-right">
				<span v-if="hiddenCount > 0" class="col-tag active tag-overflow">+{{ hiddenCount }}</span>
				<font-awesome-icon :icon="dropdownOpen ? 'chevron-up' : 'chevron-down'" class="tag-dropdown-chevron"/>
			</div>
		</div>
		<Teleport to="body">
			<div v-if="dropdownOpen" class="dropdown-backdrop" :style="backdropStyle" @click.stop="closeDropdown"></div>
			<div v-if="dropdownOpen" class="dropdown-menu" :style="menuStyle">
				<label
						v-for="opt in displayOptions"
						:key="normalize(opt).key"
						class="dropdown-item"
						:class="{ disabled: isDisabled(opt) }"
				>
					<input
							type="checkbox"
							:checked="isSelected(normalize(opt).key)"
							:disabled="isDisabled(opt)"
							@change="toggle(opt)"
					/>
					{{ normalize(opt).label }}
				</label>
			</div>
		</Teleport>
	</div>

	<!-- Dropdown mode with button trigger -->
	<div v-else class="checkbox-dropdown">
		<button ref="triggerEl" class="btn btn-secondary btn-sm" @click.stop="openDropdown">
			<font-awesome-icon v-if="buttonIcon" :icon="buttonIcon"/> 
			<span>{{ buttonLabel }}</span>
		</button>
		<Teleport to="body">
			<div v-if="dropdownOpen" class="dropdown-backdrop" :style="backdropStyle" @click.stop="closeDropdown"></div>
			<div v-if="dropdownOpen" class="dropdown-menu" :style="menuStyle">
				<label
						v-for="opt in displayOptions"
						:key="normalize(opt).key"
						class="dropdown-item"
						:class="{ disabled: isDisabled(opt) }"
				>
					<input
							type="checkbox"
							:checked="isSelected(normalize(opt).key)"
							:disabled="isDisabled(opt)"
							@change="toggle(opt)"
					/>
					{{ normalize(opt).label }}
				</label>
			</div>
		</Teleport>
	</div>
</template>

<style scoped>
.tag-dropdown {
	position: relative;
	display: block;
	width: 100%;
	max-width: 100%;
	min-width: 0;
	overflow: hidden;
}

.tag-dropdown-trigger {
	display: flex;
	align-items: center;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 6px;
	cursor: pointer;
	transition: border-color 0.2s;
	height: 34px;
	padding-right: 2px;
	overflow: hidden;

	&:hover {
		border-color: rgba(255, 255, 255, 0.25);
	}
}

.tag-dropdown-left {
	position: relative;
	flex: 1 1 0;
	min-width: 0;
	overflow: hidden;
	height: 100%;
	display: flex;
	align-items: center;
	padding-left: 8px;
}

.tag-dropdown-tags {
	display: flex;
	flex-wrap: nowrap;
	gap: 4px;
	align-items: center;
	max-width: 100%;
	overflow: hidden;
}

.tag-dropdown-right {
	flex: 0 0 auto;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 6px;
	padding: 0 8px;
	white-space: nowrap;
}

.tag-dropdown-placeholder {
	font-size: 0.82rem;
	color: rgba(255, 255, 255, 0.3);
	white-space: nowrap;
}

.tag-overflow {
	cursor: default;
	pointer-events: none;
	flex-shrink: 0;
	white-space: nowrap;
}

.tag-dropdown-chevron {
	font-size: 0.7rem;
	color: rgba(255, 255, 255, 0.4);
	flex-shrink: 0;
}

.checkbox-dropdown {
	position: relative;
	display: inline-block;
}

@media (max-width: 768px) {
	.tag-dropdown-trigger {
		height: 38px;
	}
}
</style>

<!-- Unscoped styles for Teleported elements -->
<style>
.dropdown-backdrop {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 999;
}

.dropdown-menu {
	position: fixed;
	z-index: 1000;
	background: #1b2838;
	border: 1px solid rgba(102, 192, 244, 0.25);
	border-radius: 5px;
	padding: 6px 0;
	min-width: 160px;
	box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
}

.dropdown-item {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 5px 12px;
	font-size: 0.82rem;
	color: #c7d5e0;
	cursor: pointer;
	user-select: none;
	transition: background 0.15s;

	&:hover {
		background: rgba(102, 192, 244, 0.1);
	}

	&.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	input[type="checkbox"] {
		accent-color: #66c0f4;
		cursor: pointer;
	}
}

@media (max-width: 768px) {
	.dropdown-backdrop {
		background: rgba(0, 0, 0, 0.5);
	}

	.dropdown-menu {
		top: auto !important;
		bottom: 0;
		left: 0 !important;
		right: 0;
		min-width: unset !important;
		width: 100%;
		border-radius: 12px 12px 0 0;
		max-height: 50vh;
		overflow-y: auto;
		padding: 10px 0;
		-webkit-overflow-scrolling: touch;
	}

	.dropdown-item {
		padding: 10px 16px;
		font-size: 0.9rem;
		gap: 10px;

		input[type="checkbox"] {
			width: 18px;
			height: 18px;
		}
	}
}
</style>


