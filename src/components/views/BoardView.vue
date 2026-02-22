<script setup>
import {ref, computed, reactive} from 'vue'
import {useStatsAutoLoad} from '@/composables/useStatsAutoLoad.js'
import {useGameInfoModal} from '@/composables/useGameInfoModal.js'
import GameInfoComponent from '../GameInfoComponent.vue'
import GameCard from '../ui/GameCard.vue'
import KanbanColumn from '../ui/KanbanColumn.vue'
import ViewHeader from "@/components/ui/ViewHeader.vue";

const {state, refreshLibrary, fetchGameDetails, getCompletionData, updateGameStatus, toggleGameVisibility} = useStatsAutoLoad()
const {showGameInfo, selectedGame, openGameInfo, closeGameInfo} = useGameInfoModal()

const searchTerm = ref('')
const showFilters = ref(false)
const showLayoutEditor = ref(false)
const filterCompletion = ref(0) // Min completion %
const hideNoAchievements = ref(false)
const hideFree = ref(false)



// Layout Editor State
const editingColumns = ref([])
const availableColors = ['#66c0f4', '#a4d007', '#ffc83d', '#ff5252', '#be5eff', '#ffffff']

// DOM Refs
const boardContainerRef = ref(null)

// Touch Drag State
const touchState = reactive({
	active: false,
	game: null,
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
	return filteredGames.value.filter(g => g.status === status)
}

const onDragStart = (evt, game) => {
	evt.dataTransfer.dropEffect = 'move'
	evt.dataTransfer.effectAllowed = 'move'
	evt.dataTransfer.setData('gameId', game.appid.toString())
}

const onDrop = (evt, status) => {
	const gameId = evt.dataTransfer.getData('gameId')
	const game = state.games.find(g => g.appid.toString() === gameId)
	if (game) {
		updateGameStatus(game, status)
	}
}

// --- Touch Drag Logic ---
const onTouchStart = (evt, game) => {
	// Only start if one finger
	if (evt.touches.length > 1) return

	touchState.initialX = evt.touches[0].clientX
	touchState.initialY = evt.touches[0].clientY
	touchState.game = game

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

		// Traverse up to find a column with data-status
		const col = target?.closest('.kanban-column')
		if (col) {
			const status = col.getAttribute('data-status')
			if (status && touchState.game) {
				updateGameStatus(touchState.game, status)
			}
		}

		stopTouchDrag()
	}
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
							:key="game.appid"
							:game="game"
							:completion-data="getCompletionData(game)"
							:column-color="getColColor(col)"
							:loading-details="game.loadingDetails"
							:draggable="true"
							@dragstart="onDragStart($event, game)"
							@touchstart="onTouchStart($event, game)"
							@touchmove="onTouchMove($event)"
							@touchend="onTouchEnd($event)"
							@info="openGameInfo"
							@hide="toggleHide"
							@load-stats="fetchGameDetails"
					/>
				</KanbanColumn>
			</transition-group>
		</div>
	</div>
</template>
