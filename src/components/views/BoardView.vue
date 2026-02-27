<script setup>
import {ref, computed, reactive} from 'vue'
import {useStatsAutoLoad} from '@/composables/useStatsAutoLoad.js'
import {useGameInfoModal} from '@/composables/useGameInfoModal.js'
import GameInfoComponent from '../GameInfoComponent.vue'
import GameCard from '../ui/GameCard.vue'
import KanbanColumn from '../ui/KanbanColumn.vue'
import ViewHeader from "@/components/ui/ViewHeader.vue";

const {state, refreshLibrary, fetchGameDetails, getCompletionData, updateGameStatus, toggleGameVisibility, copyGameToColumn, removeGameFromColumn} = useStatsAutoLoad()
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
const editingColumns = ref([])
const availableColors = ['#66c0f4', '#a4d007', '#ffc83d', '#ff5252', '#be5eff', '#ffffff']

// DOM Refs
const boardContainerRef = ref(null)

// Touch Drag State
const touchState = reactive({
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

let scrollTimer = null;



const filteredGames = computed(() => {
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

const getGamesByStatus = (status) => {
	return filteredGames.value.filter(g => {
		return g.status === status || (g.duplicateColumns && g.duplicateColumns.includes(status))
	})
}

const isGameDuplicateInColumn = (game, columnName) => {
	// A game is a "duplicate" in a column if it appears in multiple columns
	const cols = [game.status, ...(game.duplicateColumns || [])]
	return cols.length > 1 && cols.includes(columnName)
}

const onDragStart = (evt, game, columnName) => {
	isDragging.value = true
	isShiftHeld.value = evt.shiftKey
	dragSourceColumn.value = columnName
	const cols = [game.status, ...(game.duplicateColumns || [])]
	draggedGameIsDuplicate.value = cols.length > 1
	evt.dataTransfer.dropEffect = evt.shiftKey ? 'copy' : 'move'
	evt.dataTransfer.effectAllowed = 'copyMove'
	evt.dataTransfer.setData('gameId', game.appid.toString())
	evt.dataTransfer.setData('sourceColumn', columnName)
	
	const onKeyDown = (e) => {
		if (e.key === 'Shift') isShiftHeld.value = true
	}
	const onKeyUp = (e) => {
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
		evt.target.removeEventListener('dragend', cleanup)
	}
	evt.target.addEventListener('dragend', cleanup)
}

const onDrop = (evt, status) => {
	const gameId = evt.dataTransfer.getData('gameId')
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
const onTouchStart = (evt, game, columnName) => {
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

const onTouchMove = (evt) => {
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

const handleAutoScroll = (x) => {
	if (!boardContainerRef.value) return;

	const container = boardContainerRef.value;
	const threshold = 80; // Larger threshold for mobile
	const speed = 15; // Scroll speed
	const rect = container.getBoundingClientRect();

	let direction = 0;
	if (x < rect.left + threshold) {
		direction = -1;
	} else if (x > rect.right - threshold) {
		direction = 1;
	}

	if (direction === 0) {
		stopScrolling();
		return;
	}

	if (touchState.scrollDirection !== direction) {
		stopScrolling();
		touchState.scrollDirection = direction;

		const scrollStep = () => {
			if (touchState.scrollDirection !== 0 && boardContainerRef.value) {
				boardContainerRef.value.scrollLeft += (speed * touchState.scrollDirection);
			}
		};

		scrollTimer = setInterval(scrollStep, 16);
	}
}

const onTouchEnd = (evt) => {
	clearTimeout(touchState.timer)
	stopScrolling();
	if (touchState.active) {
		// Find drop target
		const touch = evt.changedTouches[0]

		// Hide ghost momentarily to find element underneath
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

const startTouchDrag = (evt) => {
	touchState.active = true
	// Create ghost element
	const original = evt.target.closest('.card')
	if (!original) return

	// Calculate offset so we hold it where we touched it
	const rect = original.getBoundingClientRect()
	touchState.offsetX = evt.touches[0].clientX - rect.left
	touchState.offsetY = evt.touches[0].clientY - rect.top

	// Clone
	const clone = original.cloneNode(true)
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
	stopScrolling();
}

const stopScrolling = () => {
	if (scrollTimer) {
		clearInterval(scrollTimer);
		scrollTimer = null;
	}
	touchState.scrollDirection = 0;
}

const toggleHide = (game) => {
	toggleGameVisibility(game)
}

const handleCopyGame = (game) => {
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
		const idx = parseInt(choice) - 1
		if (idx >= 0 && idx < available.length) {
			copyGameToColumn(game, available[idx])
		}
	}
}

const onBinDrop = (evt) => {
	evt.preventDefault()
	const gameId = evt.dataTransfer.getData('gameId')
	const sourceColumn = evt.dataTransfer.getData('sourceColumn')
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
			return {name: col, color: '#66c0f4', id: col}
		}
		return {...col}
	})
	showLayoutEditor.value = true
}

const addEditColumn = () => {
	editingColumns.value.push({name: 'New Column', color: '#66c0f4', id: Date.now().toString()})
}

const removeEditColumn = (index) => {
	if (editingColumns.value.length <= 1) {
		alert("Must have at least one column")
		return
	}
	if (confirm("Remove column? Games will move to the first column.")) {
		editingColumns.value.splice(index, 1)
	}
}

const moveColumn = (index, direction) => {
	if (direction === -1 && index > 0) {
		const temp = editingColumns.value[index];
		editingColumns.value[index] = editingColumns.value[index - 1];
		editingColumns.value[index - 1] = temp;
	} else if (direction === 1 && index < editingColumns.value.length - 1) {
		const temp = editingColumns.value[index];
		editingColumns.value[index] = editingColumns.value[index + 1];
		editingColumns.value[index + 1] = temp;
	}
}

const saveLayout = () => {
	const newNames = new Set(editingColumns.value.map(c => c.name));
	const oldColumns = state.columns.map(c => typeof c === 'string' ? c : c.name);

	const removedNames = oldColumns.filter(name => !newNames.has(name));

	if (removedNames.length > 0) {
		const fallback = editingColumns.value[0].name;
		state.games.forEach(g => {
			if (removedNames.includes(g.status)) {
				g.status = fallback;
			}
			// Clean up duplicateColumns that reference removed columns
			if (g.duplicateColumns) {
				g.duplicateColumns = g.duplicateColumns.filter(c => !removedNames.includes(c));
			}
		});
	}

	const names = editingColumns.value.map(c => c.name);
	if (new Set(names).size !== names.length) {
		alert("Column names must be unique");
		return;
	}

	state.columns = [...editingColumns.value]; // Save as objects
	showLayoutEditor.value = false;
}

// Helper to get color safely
const getColColor = (col) => {
	return typeof col === 'object' ? col.color : '#66c0f4';
}
const getColName = (col) => {
	return typeof col === 'object' ? col.name : col;
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
						<span v-if="showFilters">▼</span><span v-else>►</span> Filters
					</button>
					<button @click="openLayoutEditor" class="btn btn-secondary layout-btn">
						✎ Edit Board
					</button>
					<button @click="refreshLibrary" :disabled="state.loading" class="btn btn-secondary reload-stats-btn">
						{{ state.loading ? 'Syncing...' : '↻ Sync Library' }}
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
		<div v-if="showLayoutEditor" class="modal-overlay">
			<div class="modal-content">
				<h2>Edit Board Layout</h2>
				<div class="editor-list">
					<div v-for="(col, index) in editingColumns" :key="col.id || index" class="editor-row">
						<div class="row-controls">
							<button @click="moveColumn(index, -1)" :disabled="index === 0" class="btn btn-small">▲</button>
							<button @click="moveColumn(index, 1)" :disabled="index === editingColumns.length - 1" class="btn btn-small">▼</button>
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
						<button @click="removeEditColumn(index)" class="btn btn-icon remove-btn">×</button>
					</div>
				</div>
				<button @click="addEditColumn" class="btn btn-secondary add-btn-full">+ Add Column</button>
				<div class="modal-actions">
					<button @click="showLayoutEditor = false" class="btn btn-secondary">Cancel</button>
					<button @click="saveLayout" class="btn btn-primary">Save Changes</button>
				</div>
			</div>
		</div>

		<div
				class="board-container"
				ref="boardContainerRef"
				:class="{ 'is-dragging': touchState.active }"
		>
			<!-- Drag Hint -->
			<transition name="fade">
				<div v-if="isDragging || touchState.active" class="drag-hint">
					<span v-if="isShiftHeld">⧉ Release to <strong>copy</strong> game into column</span>
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
							:loading-details="game.loadingDetails"
							:draggable="true"
							:is-duplicate="isGameDuplicateInColumn(game, getColName(col))"
							@dragstart="onDragStart($event, game, getColName(col))"
							@touchstart="onTouchStart($event, game, getColName(col))"
							@touchmove="onTouchMove($event)"
							@touchend="onTouchEnd($event)"
							@info="openGameInfo"
							@hide="toggleHide"
							@load-stats="fetchGameDetails"
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
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
					<path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
					<path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H5.5l1-1h3l1 1H13.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
				</svg>
				<span>Remove from column</span>
			</div>
		</transition>
	</div>
</template>
