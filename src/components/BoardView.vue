<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useSteam } from '../composables/useSteam'

const { state, loadState, fetchAchievements, fetchAllAchievements, addColumn, removeColumn, fetchGames } = useSteam()

const searchTerm = ref('')
const showFilters = ref(false)
const showLayoutEditor = ref(false)
const filterCompletion = ref(0) // Min completion %
const hideNoAchievements = ref(false)
const hideFree = ref(false)

// Layout Editor State
const editingColumns = ref([])
const availableColors = ['#66c0f4', '#a4d007', '#ffc83d', '#ff5252', '#be5eff', '#ffffff']

onMounted(async () => {
    loadState()
    if (state.games.length === 0 && state.steamId && state.apiKey) {
        await fetchGames()
    }
    
    const now = Date.now()
    const lastUpdate = state.lastUpdated || 0
    if (state.games.length > 0 && (now - lastUpdate > 172800000)) { 
        console.log('Auto-refreshing achievements...')
        await fetchAllAchievements()
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
        result = result.filter(g => g.achievements && g.achievements.total > 0)
    }
    if (filterCompletion.value > 0) {
        result = result.filter(g => {
            if (!g.achievements || !g.achievements.total) return false
            return (g.achievements.achieved / g.achievements.total * 100) >= filterCompletion.value
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

const toggleHide = (game) => {
    game.hidden = !game.hidden
}

const refreshStats = async () => {
    await fetchAllAchievements(true) 
}

// Layout Editor Logic
const openLayoutEditor = () => {
    // Clone columns for editing
    editingColumns.value = state.columns.map(col => {
        // Handle legacy string columns
        if (typeof col === 'string') {
             return { name: col, color: '#66c0f4', id: col }
        }
        return { ...col }
    })
    showLayoutEditor.value = true
}

const addEditColumn = () => {
    editingColumns.value.push({ name: 'New Column', color: '#66c0f4', id: Date.now().toString() })
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
    // Logic to handle renamed/removed columns for existing games
    // 1. Identify removed columns
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

    // 2. Update state
    // Store simple names in state.columns if we want to keep backward compat, or objects?
    // User requested deciding colors. So we MUST store objects now.
    // Migration: We'll store objects.
    // BUT: getGamesByStatus uses g.status which is a string (name).
    // So state.columns will be array of objects, but we match by name.
    
    // Ensure uniqueness of names
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
          <div class="search-box">
              <input v-model="searchTerm" placeholder="Search games..." />
          </div>
          <div class="actions">
               <button @click="showFilters = !showFilters" :class="{ active: showFilters }">
                   <span v-if="showFilters">▼</span><span v-else>►</span> Filters
               </button>
               <button @click="openLayoutEditor" class="layout-btn">
                   ✎ Edit Board
               </button>
               <button @click="refreshStats" :disabled="state.loading" class="reload-stats-btn">
                   {{ state.loading ? 'Loading Stats...' : '↻ Stats' }}
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
                          <button @click="moveColumn(index, -1)" :disabled="index === 0">▲</button>
                          <button @click="moveColumn(index, 1)" :disabled="index === editingColumns.length - 1">▼</button>
                      </div>
                      <input v-model="col.name" placeholder="Name" class="name-input"/>
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
                      <button @click="removeEditColumn(index)" class="remove-btn">×</button>
                  </div>
              </div>
              <button @click="addEditColumn" class="add-btn-full">+ Add Column</button>
              <div class="modal-actions">
                  <button @click="showLayoutEditor = false" class="cancel-btn">Cancel</button>
                  <button @click="saveLayout" class="save-btn">Save Changes</button>
              </div>
          </div>
      </div>

      <div class="board-container">
          <transition-group name="column-list" tag="div" class="board-flex">
              <div 
                v-for="(col, index) in state.columns" 
                :key="getColName(col)" 
                class="column"
                :style="{ borderTopColor: getColColor(col) }"
                @dragover.prevent
                @dragenter.prevent
                @drop="onDrop($event, getColName(col))"
              >
                <div class="column-header">
                    <h2>
                        {{ getColName(col) }} 
                        <span class="count">{{ getGamesByStatus(getColName(col)).length }}</span>
                    </h2>
                </div>
                
                <div class="card-list">
                  <transition-group name="card-list">
                      <div 
                        v-for="game in getGamesByStatus(getColName(col))" 
                        :key="game.appid" 
                        class="card"
                        draggable="true"
                        @dragstart="onDragStart($event, game)"
                      >
                        <div class="card-actions-top">
                            <button @click="toggleHide(game)" class="icon-btn" title="Hide Game">×</button>
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
                          <div v-if="game.achievements && !game.achievements.error">
                            <div class="achievement-text">
                                <span>{{ game.achievements.achieved }} / {{ game.achievements.total }}</span>
                                <span class="percentage">{{ Math.round(game.achievements.achieved / game.achievements.total * 100) }}%</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress" :style="{ width: (game.achievements.achieved / game.achievements.total * 100) + '%', background: getColColor(col) }"></div>
                            </div>
                          </div>
                          <div v-else-if="game.achievements && game.achievements.error" class="stat-error">
                              {{ game.achievements.error }}
                          </div>
                          <button v-else @click="fetchAchievements(game)" :disabled="game.loadingStats" class="small-btn">
                            {{ game.loadingStats ? '...' : 'Load Stats' }}
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
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

.controls-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(to right, #1b2838, #2a475e);
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
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
    width: 100%; 
    padding: 10px 15px;
    border-radius: 20px;
    border: 1px solid #4b6175;
    background: rgba(0,0,0,0.2);
    color: #c7d5e0;
    box-sizing: border-box;
    transition: all 0.3s;
}

.search-box input:focus {
    background: rgba(0,0,0,0.4);
    border-color: #66c0f4;
    outline: none;
    box-shadow: 0 0 10px rgba(102, 192, 244, 0.2);
}

.actions {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap; 
}

.actions button {
    padding: 8px 16px;
    background: rgba(255,255,255,0.05);
    color: #c7d5e0;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 5px;
}

.actions button:hover {
    background: #66c0f4;
    color: white;
    border-color: #66c0f4;
}

.actions button.active {
    background: #2a475e;
    border-color: #66c0f4;
    color: #66c0f4;
}

.layout-btn {
    font-weight: bold;
    border-color: #a4d007 !important;
    color: #a4d007 !important;
}

.layout-btn:hover {
    background: #a4d007 !important;
    color: #1b2838 !important;
}

.reload-stats-btn {
    font-weight: bold;
}

.filters-panel {
    background: #20262e;
    padding: 15px 20px;
    border-radius: 6px;
    display: flex;
    gap: 30px;
    align-items: center;
    color: #c7d5e0;
    box-shadow: inset 0 2px 6px rgba(0,0,0,0.3);
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
    background: rgba(0,0,0,0.8);
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
    background: rgba(255,255,255,0.05);
    padding: 10px;
    border-radius: 4px;
}

.row-controls {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.row-controls button {
    padding: 0;
    width: 20px;
    height: 20px;
    font-size: 0.6em;
    display: flex;
    align-items: center;
    justify-content: center;
}

.name-input {
    flex: 1;
    padding: 8px;
    border-radius: 4px;
    border: 1px solid #4b6175;
    background: #0f1219;
    color: white;
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
    background: none;
    border: none;
    color: #d9534f;
    font-size: 1.5em;
    cursor: pointer;
}

.add-btn-full {
    width: 100%;
    padding: 10px;
    background: rgba(255,255,255,0.05);
    border: 1px dashed #66c0f4;
    color: #66c0f4;
    margin-bottom: 20px;
    cursor: pointer;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.cancel-btn {
    background: transparent;
    border: 1px solid #4b6175;
}

.save-btn {
    background: #66c0f4;
    color: #1b2838;
    font-weight: bold;
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
    background: #101217;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    border-top: 4px solid #66c0f4; /* Fallback */
    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
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

.column:hover {
    box-shadow: 0 8px 16px rgba(0,0,0,0.5);
}

.column-header {
    padding: 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255,255,255,0.03);
    border-radius: 8px 8px 0 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
}

.column h2 {
    margin: 0;
    font-size: 1.1em;
    color: #c7d5e0;
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
}

.count {
    background: rgba(255,255,255,0.1);
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.8em;
    color: #8f98a0;
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
    background: linear-gradient(145deg, #1b2838, #222b35);
    padding: 12px;
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    cursor: grab;
    position: relative;
    border: 1px solid rgba(102, 192, 244, 0.05);
    color: #c7d5e0;
    transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.card:hover {
    transform: translateY(-4px) scale(1.01);
    box-shadow: 0 8px 16px rgba(0,0,0,0.5);
    border-color: #66c0f4;
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

.icon-btn {
    background: rgba(0,0,0,0.6);
    color: #aaa;
    border: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    line-height: 1;
}

.icon-btn:hover {
    color: white;
    background: #d9534f;
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
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
}

.game-title {
    font-weight: bold;
    font-size: 0.95em;
    line-height: 1.3;
    color: #e4e4e4;
}

.stats {
    font-size: 0.85em;
    color: #8f98a0;
    background: rgba(0,0,0,0.2);
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
    color: #66c0f4;
    font-weight: bold;
}

.progress-bar {
    height: 6px;
    background: #0f1219;
    border-radius: 3px;
    overflow: hidden;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.5);
}

.progress {
    height: 100%;
    background: linear-gradient(90deg, #66c0f4, #4c6b22); 
    transition: width 0.5s ease-out;
}

.small-btn {
    padding: 6px 0;
    font-size: 0.9em;
    background: rgba(255,255,255,0.05);
    color: #8f98a0;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px;
    cursor: pointer;
    width: 100%;
    transition: all 0.2s;
}

.small-btn:hover {
    background: #66c0f4;
    color: #1b2838;
    border-color: #66c0f4;
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
