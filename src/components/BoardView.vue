<script setup>
import {ref, computed, onMounted, reactive} from 'vue'
import {useSteam} from '../composables/useSteam'

const {state, loadState, refreshLibrary, fetchAllAchievementsDetailed, fetchGameDetails, getCompletionData} = useSteam()

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

onMounted(async () => {
	loadState()

	const now = Date.now()
	const lastUpdate = state.lastUpdated || 0

	// Check if any game has detailed achievement data loaded
	const hasStats = state.games.some(g => g.achievementsList && g.achievementsList.achievements && g.achievementsList.achievements.length > 0)

	// Auto-load if stale > 48h
	if (state.games.length > 0 && (now - lastUpdate > 172800000 || !hasStats)) {
		await fetchAllAchievementsDetailed()
	}
})

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
		game.status = status
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
				touchState.game.status = status
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
	game.hidden = !game.hidden
}

const refreshStats = async () => {
	await refreshLibrary()
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
		<div class="controls-bar">
			<h1>Your Main Board</h1>
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
				<button @click="refreshStats" :disabled="state.loading" class="btn btn-secondary reload-stats-btn">
					{{ state.loading ? 'Syncing...' : '↻ Sync Library' }}
				</button>
			</div>
		</div>

		<transition name="slide-down">
			<div v-if="showFilters" class="filters-panel">
				<label class="filter-check"><input type="checkbox" v-model="hideNoAchievements"> Has Achievements</label>
				<label class="filter-check"><input type="checkbox" v-model="hideFree"> Played > 0h</label>
				<div class="slider-control">
					<span>Min Completion: {{ filterCompletion }}%</span>
					<input type="range" v-model.number="filterCompletion" min="0" max="100" class="slider">
				</div>
			</div>
		</transition>

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
				<div
						v-for="(col, index) in state.columns"
						:key="getColName(col)"
						class="kanban-column column"
						:style="{ borderTopColor: getColColor(col) }"
						:data-status="getColName(col)"
						@dragover.prevent
						@dragenter.prevent
						@drop="onDrop($event, getColName(col))"
				>
					<div class="column-header">
						<h2>
							{{ getColName(col) }}
							<span class="column-count">{{ getGamesByStatus(getColName(col)).length }}</span>
						</h2>
					</div>

					<div class="card-list">
						<transition-group name="card-list">
							<div
									v-for="game in getGamesByStatus(getColName(col))"
									:key="game.appid"
									class="card-panel card-hover card"
									draggable="true"
									@dragstart="onDragStart($event, game)"
									@touchstart="onTouchStart($event, game)"
									@touchmove="onTouchMove($event)"
									@touchend="onTouchEnd($event)"
							>
								<div class="card-actions-top">
									<button @click="toggleHide(game)" class="hide-btn" title="Hide Game">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                          <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
                                          <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
                                          <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
                                        </svg>
                                    </button>
								</div>
								<div class="card-header">
									<img
											v-if="game.img_icon_url"
											:src="`http://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`"
											alt="icon"
											class="game-icon"
									/>
									<span class="game-title">{{ game.name }}</span>
								</div>

								<div class="stats">
									<div v-if="getCompletionData(game).total > 0">
										<div class="achievement-text">
											<span>{{ getCompletionData(game).achieved }} / {{ getCompletionData(game).total }}</span>
											<span class="percentage">{{
													Math.round(getCompletionData(game).achieved / getCompletionData(game).total * 100)
												}}%</span>
										</div>
										<div class="progress-bar">
											<div class="progress"
											     :style="{ width: (getCompletionData(game).achieved / getCompletionData(game).total * 100) + '%', background: getColColor(col) }"></div>
										</div>
									</div>
									<div v-else-if="getCompletionData(game).error" class="stat-error">
										{{ getCompletionData(game).error }}
									</div>
									<button v-else @click="fetchGameDetails(game)" :disabled="game.loadingDetails" class="btn btn-secondary btn-small">
										{{ game.loadingDetails ? '...' : 'Load Stats' }}
									</button>
								</div>
							</div>
						</transition-group>
					</div>
				</div>
			</transition-group>
		</div>
	</div>
</template>

<style scoped>
.board-view {
	height: 100%;
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 15px;
	animation: fadeIn 0.5s ease-out;
	padding: 20px;
	box-sizing: border-box;
}

@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateY(10px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.controls-bar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	background: linear-gradient(to right, #1b2838, #2a475e);
	padding: 12px 20px;
	border-radius: 6px;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	flex-wrap: wrap;
	gap: 10px;
	width: 100%;
	box-sizing: border-box;
	position: sticky;
	top: 0;
	z-index: 50; /* Above columns, below nav */
}

.search-box {
	flex: 1;
	min-width: 250px;
}

.search-box input {
	border-radius: 20px; /* Custom override for search */
}

.actions {
	display: flex;
	gap: 12px;
	align-items: center;
	flex-wrap: wrap;
}

.actions button.active {
	background: #2a475e;
	border-color: var(--steam-blue-light);
	color: var(--steam-blue-light);
}

.layout-btn {
	border-color: #a4d007 !important;
	color: #a4d007 !important;
}

.layout-btn:hover {
	background: #a4d007 !important;
	color: #1b2838 !important;
}

.reload-stats-btn {
	/* Just inheriting */
}

.filters-panel {
	background: #20262e;
	padding: 15px 20px;
	border-radius: 6px;
	display: flex;
	gap: 30px;
	align-items: center;
	color: var(--steam-text-light);
	box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.3);
	border-top: 1px solid #2a475e;
	flex-wrap: wrap;
	width: 100%;
	box-sizing: border-box;
}

.filter-check {
	display: flex;
	align-items: center;
	gap: 8px;
	cursor: pointer;
	user-select: none;
	white-space: nowrap;
}

.filter-check input {
	width: 16px;
	height: 16px;
	cursor: pointer;
}

.slider-control {
	display: flex;
	gap: 15px;
	align-items: center;
	flex: 1;
	min-width: 250px;
}

.slider {
	flex: 1;
	cursor: pointer;
}

/* Modal */
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
	z-index: 200;
}

.modal-content {
	background: #1b2838;
	padding: 30px;
	border-radius: 8px;
	width: 90%;
	max-width: 600px;
	max-height: 80vh;
	overflow-y: auto;
	box-shadow: 0 0 20px rgba(102, 192, 244, 0.3);
	color: white;
}

.editor-list {
	display: flex;
	flex-direction: column;
	gap: 10px;
	margin-bottom: 20px;
}

.editor-row {
	display: flex;
	align-items: center;
	gap: 10px;
	background: rgba(255, 255, 255, 0.05);
	padding: 10px;
	border-radius: 4px;
}

.row-controls {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.row-controls button {
	width: 20px;
	height: 20px;
	font-size: 0.6em;
	padding: 0;
}

.name-input {
	flex: 1;
	padding: 8px; /* Override */
}

.color-picker {
	display: flex;
	gap: 5px;
}

.color-swatch {
	width: 24px;
	height: 24px;
	border-radius: 50%;
	cursor: pointer;
	border: 2px solid transparent;
}

.color-swatch.selected {
	border-color: white;
	transform: scale(1.1);
}

.remove-btn {
	color: #d9534f;
	font-size: 1.5em;
}

.add-btn-full {
	width: 100%;
	margin-bottom: 20px;
	border: 1px dashed var(--steam-blue-light);
	color: var(--steam-blue-light);
}

.modal-actions {
	display: flex;
	justify-content: flex-end;
	gap: 10px;
}

.board-container {
	flex: 1;
	overflow-x: auto;
	overflow-y: hidden;
	padding-bottom: 10px;
	-webkit-overflow-scrolling: touch;
	scroll-snap-type: x mandatory;
	width: 100%;
}

/* Disable scroll snap while dragging to allow smooth auto-scroll */
.board-container.is-dragging {
    scroll-snap-type: none;
}

.board-flex {
	display: flex;
	gap: 20px;
	height: 100%;
	width: max-content;
	min-width: 100%;
	padding-right: 20px;
}

.column {
	flex: 1 0 320px;
	min-width: 320px;
	border-top: 4px solid var(--steam-blue-light); /* Fallback */
	transition: transform 0.2s, box-shadow 0.2s;
	scroll-snap-align: center;
}

/* Mobile Adjustments */
@media (max-width: 768px) {
	.board-view {
		padding: 10px;
	}

	.controls-bar {
		flex-direction: column;
		align-items: stretch;
		gap: 15px;
		position: static; /* Unstick on mobile to save space? or keep */
	}

	.search-box {
		min-width: 100%;
	}

	.actions {
		justify-content: space-between;
	}

	.actions button {
		flex: 1;
		justify-content: center;
	}

	.filters-panel {
		flex-direction: column;
		align-items: flex-start;
		gap: 15px;
	}

	.slider-control {
		width: 100%;
		flex-wrap: wrap;
	}

	.slider {
		width: 100%;
		min-width: 100%;
	}

	.column {
		flex: 0 0 85vw;
		width: 85vw;
		min-width: 280px;
		scroll-snap-align: center;
	}

	.board-flex {
		padding-right: 15px;
		gap: 15px;
	}

	.editor-row {
		flex-wrap: wrap;
	}

	.name-input {
		min-width: 100%;
		order: 3;
	}

	.color-picker {
		order: 4;
	}
}

.card-list {
	flex: 1;
	padding: 15px;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.card {
	/* Resetting some specific card overrides if needed */
	padding: 12px;
	cursor: grab;
	position: relative;
	border: 1px solid rgba(102, 192, 244, 0.05);
	z-index: 1;
}

.card:hover {
	z-index: 10;
}

.card-actions-top {
	position: absolute;
	top: 5px;
	right: 5px;
	opacity: 0;
	transition: opacity 0.2s;
}

.card:hover .card-actions-top {
	opacity: 1;
}

.card-header {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-bottom: 10px;
	padding-right: 20px;
}

.game-icon {
	width: 36px;
	height: 36px;
	border-radius: 4px;
	box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
}

.game-title {
	font-weight: bold;
	font-size: 0.95em;
	line-height: 1.3;
	color: #e4e4e4;
}

.stats {
	font-size: 0.85em;
	color: var(--steam-text-muted);
	background: rgba(0, 0, 0, 0.2);
	padding: 8px;
	border-radius: 4px;
}

.achievement-text {
	display: flex;
	justify-content: space-between;
	margin-bottom: 5px;
	font-size: 0.9em;
}

.percentage {
	color: var(--steam-blue-light);
	font-weight: bold;
}

.progress-bar {
	height: 6px;
	background: #0f1219;
	border-radius: 3px;
	overflow: hidden;
	box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);
}

.progress {
	height: 100%;
	background: linear-gradient(90deg, var(--steam-blue-light), #4c6b22);
	transition: width 0.5s ease-out;
}

.stat-error {
	color: #d9534f;
	font-size: 0.8em;
	text-align: center;
	font-style: italic;
}

/* Transitions */
.slide-down-enter-active,
.slide-down-leave-active {
	transition: all 0.3s ease;
	max-height: 100px;
	opacity: 1;
}

.slide-down-enter-from,
.slide-down-leave-to {
	max-height: 0;
	opacity: 0;
	padding-top: 0;
	padding-bottom: 0;
	overflow: hidden;
}

.card-list-move,
.card-list-enter-active,
.card-list-leave-active {
	transition: all 0.4s ease;
}

.card-list-enter-from,
.card-list-leave-to {
	opacity: 0;
	transform: scale(0.9);
}

.card-list-leave-active {
	position: absolute;
}

.column-list-enter-active,
.column-list-leave-active {
	transition: all 0.4s ease;
}

.column-list-enter-from,
.column-list-leave-to {
	opacity: 0;
	transform: translateY(20px);
}
</style>
