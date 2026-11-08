<script setup lang="ts">
import {ref, computed, reactive} from 'vue'
import {useStatsAutoLoad} from '@/composables/useStatsAutoLoad'
import {useGameInfoModal} from '@/composables/useGameInfoModal'
import GameInfoComponent from '../GameInfoComponent.vue'
import GameCard from '../ui/GameCard.vue'
import KanbanColumn from '../ui/KanbanColumn.vue'
import BaseOverlay from '../ui/BaseOverlay.vue'
import ViewHeader from "@/components/ui/ViewHeader.vue";
import type {SteamColumn, SteamGame} from "@/types/domain";
import {BOARD_COLOR_OPTIONS, DEFAULT_COLUMN_COLOR} from '@/types/board'

type EditableColumn = { name: string; color: string; id: string }
type TouchState = {
	active: boolean
	game: SteamGame | null
	sourceColumn: string
	timer: ReturnType<typeof setTimeout> | null
	initialX: number
	initialY: number
	element: HTMLElement | null
	offsetX: number
	offsetY: number
	scrollDirection: -1 | 0 | 1
}

const {state, getCompletionData, updateGameStatus, toggleGameVisibility, copyGameToColumn, removeGameFromColumn} = useStatsAutoLoad()
const {showGameInfo, selectedGame, openGameInfo, closeGameInfo} = useGameInfoModal()

const searchTerm = ref('')
const showFilters = ref(false)
const showLayoutEditor = ref(false)
const filterCompletion = ref(0) // Min completion %
const hideNoAchievements = ref(false)
const hideFree = ref(false)

// Drag state
const isDragging = ref(false)
const isShiftHeld = ref(false)
const draggedGameIsDuplicate = ref(false)
const dragSourceColumn = ref('')



// Layout Editor State
const editingColumns = ref<EditableColumn[]>([])
const availableColors = BOARD_COLOR_OPTIONS

// DOM Refs
const boardContainerRef = ref<HTMLElement | null>(null)

// Touch Drag State
const touchState = reactive<TouchState>({
	active: false,
	game: null,
	sourceColumn: '',
	timer: null,
	initialX: 0,
	initialY: 0,
	element: null, // The clone
	offsetX: 0,
	offsetY: 0,
	scrollDirection: 0
})

let scrollTimer: ReturnType<typeof setInterval> | null = null



const filteredGames = computed<SteamGame[]>(() => {
	let result = state.games
	if (searchTerm.value) {
		const lower = searchTerm.value.toLowerCase()
		result = result.filter(g => g.name.toLowerCase().includes(lower))
	}
	result = result.filter(g => !g.hidden)

	if (hideNoAchievements.value) {
		result = result.filter(g => {
			const stats = getCompletionData(g)
			return stats.total > 0
		})
	}
	if (filterCompletion.value > 0) {
		result = result.filter(g => {
			const stats = getCompletionData(g)
			if (!stats.total) return false
			return (stats.achieved / stats.total * 100) >= filterCompletion.value
		})
	}
	if (hideFree.value) {
		result = result.filter(g => g.playtime_forever > 0)
	}
	return result
})

const getGamesByStatus = (status: string) => {
	return filteredGames.value.filter(g => {
		return g.status === status || (g.duplicateColumns && g.duplicateColumns.includes(status))
	})
}

const isGameDuplicateInColumn = (game: SteamGame, columnName: string) => {
	// A game is a "duplicate" in a column if it appears in multiple columns
	const cols = [game.status, ...(game.duplicateColumns || [])]
	return cols.length > 1 && cols.includes(columnName)
}

const onDragStart = (evt: DragEvent, game: SteamGame, columnName: string): void => {
	const dataTransfer = evt.dataTransfer
	if (!dataTransfer) return

	isDragging.value = true
	isShiftHeld.value = evt.shiftKey
	dragSourceColumn.value = columnName
	const cols = [game.status, ...(game.duplicateColumns || [])]
	draggedGameIsDuplicate.value = cols.length > 1
	dataTransfer.dropEffect = evt.shiftKey ? 'copy' : 'move'
	dataTransfer.effectAllowed = 'copyMove'
	dataTransfer.setData('gameId', game.appid.toString())
	dataTransfer.setData('sourceColumn', columnName)
	
	const onKeyDown = (e: KeyboardEvent): void => {
		if (e.key === 'Shift') isShiftHeld.value = true
	}
	const onKeyUp = (e: KeyboardEvent): void => {
		if (e.key === 'Shift') isShiftHeld.value = false
	}
	window.addEventListener('keydown', onKeyDown)
	window.addEventListener('keyup', onKeyUp)

	// Clean up on drag end
	const cleanup = () => {
		isDragging.value = false
		isShiftHeld.value = false
		draggedGameIsDuplicate.value = false
		dragSourceColumn.value = ''
		window.removeEventListener('keydown', onKeyDown)
		window.removeEventListener('keyup', onKeyUp)
		if (evt.currentTarget instanceof HTMLElement) {
			evt.currentTarget.removeEventListener('dragend', cleanup)
		}
	}
	if (evt.currentTarget instanceof HTMLElement) {
		evt.currentTarget.addEventListener('dragend', cleanup)
	}
}

const onDrop = (evt: DragEvent, status: string): void => {
	const dataTransfer = evt.dataTransfer
	if (!dataTransfer) return
	const gameId = dataTransfer.getData('gameId')
	const game = state.games.find(g => g.appid.toString() === gameId)
	if (game) {
		if (isShiftHeld.value || evt.shiftKey) {
			copyGameToColumn(game, status)
		} else {
			if (game.duplicateColumns && game.duplicateColumns.includes(status)) {
				// Moving to a column where it's already a duplicate — promote it and remove duplicate entry
				game.duplicateColumns = game.duplicateColumns.filter(c => c !== status)
			}
			updateGameStatus(game, status)
		}
	}
	isDragging.value = false
	isShiftHeld.value = false
	draggedGameIsDuplicate.value = false
	dragSourceColumn.value = ''
}

// --- Touch Drag Logic ---
const onTouchStart = (evt: TouchEvent, game: SteamGame, columnName: string): void => {
	// Only start if one finger
	if (evt.touches.length > 1) return

	touchState.initialX = evt.touches[0].clientX
	touchState.initialY = evt.touches[0].clientY
	touchState.game = game
	touchState.sourceColumn = columnName

	// Track duplicate state for bin display
	const cols = [game.status, ...(game.duplicateColumns || [])]
	draggedGameIsDuplicate.value = cols.length > 1

	// Start timer for long press (reduced to 200ms for responsiveness)
	touchState.timer = setTimeout(() => {
		startTouchDrag(evt)
	}, 200)
}

const onTouchMove = (evt: TouchEvent): void => {
	if (touchState.active) {
		if (evt.cancelable) evt.preventDefault() // Prevent scrolling
		
		const touch = evt.touches[0]
		if (touchState.element) {
			touchState.element.style.left = (touch.clientX - touchState.offsetX) + 'px'
			touchState.element.style.top = (touch.clientY - touchState.offsetY) + 'px'

			// Auto Scroll Logic
			handleAutoScroll(touch.clientX);
		}
	} else {
		// Cancel timer if moved significantly before activation
		const dx = Math.abs(evt.touches[0].clientX - touchState.initialX)
		const dy = Math.abs(evt.touches[0].clientY - touchState.initialY)
		if (dx > 10 || dy > 10) {
			clearTimeout(touchState.timer)
		}
	}
}

const handleAutoScroll = (x: number): void => {
	if (!boardContainerRef.value) return

	const container = boardContainerRef.value
	const threshold = 80 // Larger threshold for mobile
	const speed = 15 // Scroll speed
	const rect = container.getBoundingClientRect()

	let direction: -1 | 0 | 1 = 0
	if (x < rect.left + threshold) {
		direction = -1
	} else if (x > rect.right - threshold) {
		direction = 1
	}

	if (direction === 0) {
		stopScrolling()
		return
	}

	if (touchState.scrollDirection !== direction) {
		stopScrolling()
		touchState.scrollDirection = direction

		const scrollStep = () => {
			if (touchState.scrollDirection !== 0 && boardContainerRef.value) {
				boardContainerRef.value.scrollLeft += (speed * touchState.scrollDirection)
			}
		}

		scrollTimer = setInterval(scrollStep, 16)
	}
}

const onTouchEnd = (evt: TouchEvent): void => {
	clearTimeout(touchState.timer)
	stopScrolling()
	if (touchState.active) {
		// Find drop target
		const touch = evt.changedTouches[0]

		// Hide ghost momentarily to find element underneath
		if (!touchState.element) {
			stopTouchDrag()
			draggedGameIsDuplicate.value = false
			return
		}
		touchState.element.style.display = 'none'
		const target = document.elementFromPoint(touch.clientX, touch.clientY)
		touchState.element.style.display = 'block'

		// Check if dropped on the bin
		const bin = target?.closest('.drag-bin')
		if (bin && touchState.game && touchState.sourceColumn) {
			const cols = [touchState.game.status, ...(touchState.game.duplicateColumns || [])]
			if (cols.length > 1) {
				removeGameFromColumn(touchState.game, touchState.sourceColumn)
			}
		} else {
			// Traverse up to find a column with data-status
			const col = target?.closest('.kanban-column')
			if (col) {
				const status = col.getAttribute('data-status')
				if (status && touchState.game) {
					updateGameStatus(touchState.game, status)
				}
			}
		}

		stopTouchDrag()
	}
	draggedGameIsDuplicate.value = false
}

const startTouchDrag = (evt: TouchEvent): void => {
	touchState.active = true
	// Create ghost element
	if (!(evt.target instanceof Element)) return
	const original = evt.target.closest('.card') as HTMLElement | null
	if (!original) return

	// Calculate offset so we hold it where we touched it
	const rect = original.getBoundingClientRect()
	touchState.offsetX = evt.touches[0].clientX - rect.left
	touchState.offsetY = evt.touches[0].clientY - rect.top

	// Clone
	const clone = original.cloneNode(true) as HTMLElement
	clone.style.position = 'fixed'
	clone.style.width = rect.width + 'px'
	clone.style.height = rect.height + 'px'
	clone.style.left = rect.left + 'px'
	clone.style.top = rect.top + 'px'
	clone.style.zIndex = '9999'
	clone.style.opacity = '0.9'
	clone.style.pointerEvents = 'none' // Important to click through
	clone.style.transform = 'scale(1.05)'
	clone.style.boxShadow = '0 10px 20px rgba(0,0,0,0.5)'

	document.body.appendChild(clone)
	touchState.element = clone

	// Vibrate if available
	if (navigator.vibrate) navigator.vibrate(50)
}

const stopTouchDrag = () => {
	touchState.active = false
	if (touchState.element) {
		document.body.removeChild(touchState.element)
		touchState.element = null
	}
	touchState.game = null
	touchState.sourceColumn = ''
	stopScrolling()
}

const stopScrolling = () => {
	if (scrollTimer) {
		clearInterval(scrollTimer)
		scrollTimer = null
	}
	touchState.scrollDirection = 0
}

const toggleHide = (game: SteamGame): void => {
	toggleGameVisibility(game)
}

const handleCopyGame = (game: SteamGame): void => {
	// On mobile/click: show a simple prompt to pick a column
	const colNames = state.columns.map(c => typeof c === 'object' ? c.name : c)
	const currentCols = [game.status, ...(game.duplicateColumns || [])]
	const available = colNames.filter(c => !currentCols.includes(c))
	if (available.length === 0) {
		alert('This game is already in all columns.')
		return
	}
	const choice = prompt(`Copy "${game.name}" to column:\n${available.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nEnter number:`)
	if (choice) {
		const idx = parseInt(choice, 10) - 1
		if (idx >= 0 && idx < available.length) {
			copyGameToColumn(game, available[idx])
		}
	}
}

const onBinDrop = (evt: DragEvent): void => {
	evt.preventDefault()
	const dataTransfer = evt.dataTransfer
	if (!dataTransfer) return
	const gameId = dataTransfer.getData('gameId')
	const sourceColumn = dataTransfer.getData('sourceColumn')
	const game = state.games.find(g => g.appid.toString() === gameId)
	if (game && sourceColumn) {
		const cols = [game.status, ...(game.duplicateColumns || [])]
		if (cols.length > 1) {
			removeGameFromColumn(game, sourceColumn)
		}
	}
	isDragging.value = false
	isShiftHeld.value = false
	draggedGameIsDuplicate.value = false
	dragSourceColumn.value = ''
}


// Layout Editor Logic
const openLayoutEditor = () => {
	// Clone columns for editing
	editingColumns.value = state.columns.map(col => {
		// Handle legacy string columns
		if (typeof col === 'string') {
			return {name: col, color: DEFAULT_COLUMN_COLOR, id: col}
		}
		return {name: col.name, color: col.color || DEFAULT_COLUMN_COLOR, id: col.id || col.name}
	})
	showLayoutEditor.value = true
}

const addEditColumn = () => {
	editingColumns.value.push({name: 'New Column', color: DEFAULT_COLUMN_COLOR, id: Date.now().toString()})
}

const removeEditColumn = (index: number): void => {
	if (editingColumns.value.length <= 1) {
		alert("Must have at least one column")
		return
	}
	if (confirm("Remove column? Games will move to the first column.")) {
		editingColumns.value.splice(index, 1)
	}
}

const moveColumn = (index: number, direction: -1 | 1): void => {
	if (direction === -1 && index > 0) {
		const temp = editingColumns.value[index]
		editingColumns.value[index] = editingColumns.value[index - 1]
		editingColumns.value[index - 1] = temp
	} else if (direction === 1 && index < editingColumns.value.length - 1) {
		const temp = editingColumns.value[index]
		editingColumns.value[index] = editingColumns.value[index + 1]
		editingColumns.value[index + 1] = temp
	}
}

const saveLayout = () => {
	if (editingColumns.value.length === 0) return

	const newNames = new Set(editingColumns.value.map(c => c.name))
	const oldColumns = state.columns.map(c => typeof c === 'string' ? c : c.name)

	const removedNames = oldColumns.filter(name => !newNames.has(name))

	if (removedNames.length > 0) {
		const fallback = editingColumns.value[0].name
		state.games.forEach(g => {
			if (removedNames.includes(g.status)) {
				g.status = fallback
			}
			// Clean up duplicateColumns that reference removed columns
			if (g.duplicateColumns) {
				g.duplicateColumns = g.duplicateColumns.filter(c => !removedNames.includes(c))
			}
		})
	}

	const names = editingColumns.value.map(c => c.name)
	if (new Set(names).size !== names.length) {
		alert("Column names must be unique")
		return
	}

	state.columns = [...editingColumns.value] // Save as objects
	showLayoutEditor.value = false
}

// Helper to get color safely
const getColColor = (col: SteamColumn): string => {
	return typeof col === 'object' ? (col.color || DEFAULT_COLUMN_COLOR) : DEFAULT_COLUMN_COLOR
}
const getColName = (col: SteamColumn): string => {
	return typeof col === 'object' ? col.name : col
}

</script>

<template>
	<div class="board-view">
		<GameInfoComponent
				:game="selectedGame"
				:is-open="showGameInfo"
				@close="closeGameInfo"
		/>

		<!-- Header -->
		<ViewHeader title="Your Main Board">
			<template #actions>
				<div class="search-box">
					<input v-model="searchTerm" placeholder="Search games..." class="input-field"/>
				</div>
				<div class="actions">
					<button @click="showFilters = !showFilters" class="btn btn-secondary" :class="{ active: showFilters }">
						<font-awesome-icon :icon="showFilters ? 'chevron-down' : 'chevron-right'" /> 
						<span>Filters</span>
					</button>
					<button @click="openLayoutEditor" class="btn btn-secondary layout-btn">
						<font-awesome-icon icon="pen" /> 
						<span>Edit Board</span>
					</button>
				</div>
			</template>
		</ViewHeader>
		

		<div class="slide-down-wrapper" :class="{ open: showFilters }">
			<div class="slide-down-inner">
				<div class="filters-panel">
					<label class="filter-check"><input type="checkbox" v-model="hideNoAchievements"> Has Achievements</label>
					<label class="filter-check"><input type="checkbox" v-model="hideFree"> Played > 0h</label>
					<div class="slider-control">
						<span>Min Completion: {{ filterCompletion }}%</span>
						<input type="range" v-model.number="filterCompletion" min="0" max="100" class="slider">
					</div>
				</div>
			</div>
		</div>

		<!-- Layout Editor Modal -->
		<BaseOverlay :show="showLayoutEditor" @close="showLayoutEditor = false">
			<h2>Edit Board Layout</h2>
			<div class="editor-list">
				<div v-for="(col, index) in editingColumns" :key="col.id || index" class="editor-row">
					<div class="row-controls">
						<button @click="moveColumn(index, -1)" :disabled="index === 0" class="btn btn-secondary btn-icon"><font-awesome-icon icon="chevron-up" /></button>
						<button @click="moveColumn(index, 1)" :disabled="index === editingColumns.length - 1" class="btn btn-secondary btn-icon"><font-awesome-icon icon="chevron-down" /></button>
					</div>
					<input v-model="col.name" placeholder="Name" class="input-field name-input"/>
					<div class="color-picker">
						<div
								v-for="color in availableColors"
								:key="color"
								class="color-swatch"
								:style="{ background: color }"
								:class="{ selected: col.color === color }"
								@click="col.color = color"
						></div>
					</div>
					<button @click="removeEditColumn(index)" class="btn btn-secondary btn-icon remove-btn"><font-awesome-icon icon="xmark" /></button>
				</div>
			</div>
			<button @click="addEditColumn" class="btn btn-secondary add-btn-full">+ Add Column</button>
			<template #actions>
				<button @click="showLayoutEditor = false" class="btn btn-secondary">Cancel</button>
				<button @click="saveLayout" class="btn btn-primary">Save Changes</button>
			</template>
		</BaseOverlay>

		<div
				class="board-container"
				ref="boardContainerRef"
				:class="{ 'is-dragging': touchState.active }"
		>
			<!-- Drag Hint -->
			<transition name="fade">
				<div v-if="isDragging || touchState.active" class="drag-hint">
					<span v-if="isShiftHeld"><font-awesome-icon icon="copy" /> Release to <strong>copy</strong> game into column</span>
					<span v-else>Hold <kbd>Shift</kbd> while dragging to <strong>copy</strong> instead of move</span>
				</div>
			</transition>

			<transition-group name="column-list" tag="div" class="board-flex">
				<KanbanColumn
						v-for="col in state.columns"
						:key="getColName(col)"
						:name="getColName(col)"
						:color="getColColor(col)"
						:count="getGamesByStatus(getColName(col)).length"
						@dragover.prevent
						@dragenter.prevent
						@drop="onDrop($event, getColName(col))"
				>
					<GameCard
							v-for="game in getGamesByStatus(getColName(col))"
							:key="game.appid + '-' + getColName(col)"
							:game="game"
							:completion-data="getCompletionData(game)"
							:column-color="getColColor(col)"
							:draggable="true"
							:is-duplicate="isGameDuplicateInColumn(game, getColName(col))"
							@dragstart="onDragStart($event, game, getColName(col))"
							@touchstart="onTouchStart($event, game, getColName(col))"
							@touchmove="onTouchMove($event)"
							@touchend="onTouchEnd($event)"
							@info="openGameInfo"
							@hide="toggleHide"
							@copy="handleCopyGame"
					/>
				</KanbanColumn>
			</transition-group>
		</div>

		<!-- Bin Drop Zone for removing duplicates -->
		<transition name="fade">
			<div
					v-if="(isDragging || touchState.active) && draggedGameIsDuplicate"
					class="drag-bin"
					@dragover.prevent
					@dragenter.prevent
					@drop="onBinDrop"
			>
				<font-awesome-icon icon="trash-can" />
				<span>Remove from column</span>
			</div>
		</transition>
	</div>
</template>
