<script setup lang="ts">
/**
 * Main App Component
 *
 * Root component that assembles the game layout.
 */

import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useGameStore } from './stores/gameStore';
import GameCanvas from './components/game/GameCanvas.vue';
import GameHeader from './components/ui/GameHeader.vue';
import NumberPad from './components/ui/NumberPad.vue';
import PlaneSelector from './components/ui/PlaneSelector.vue';
import DifficultySelect from './components/ui/DifficultySelect.vue';
import type { Difficulty } from './types/game';

const store = useGameStore();
const showLandingPage = ref(true);

async function startGame(difficulty: Difficulty) {
  await store.newGame(difficulty);
  showLandingPage.value = false;
}


function returnToMenu() {
  store.resetGame();
  showLandingPage.value = true;
}

async function tryAgain() {
  // Start a new game with the same difficulty
  await store.newGame(store.difficulty);
}

// Keyboard shortcuts
function handleKeydown(e: KeyboardEvent) {
  if (!store.cube) return;

  // Number input (1-9)
  if (e.key >= '1' && e.key <= '9' && store.selectedCell) {
    const num = parseInt(e.key);
    if (store.gameState?.isPencilMode) {
      store.togglePencilMark(store.selectedCell, num as any);
    } else {
      store.setCellValue(store.selectedCell, num as any);
    }
    return;
  }

  // Clear cell
  if ((e.key === 'Delete' || e.key === 'Backspace' || e.key === '0') && store.selectedCell) {
    store.setCellValue(store.selectedCell, 0);
    return;
  }

  // Undo/Redo
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z') {
      e.preventDefault();
      store.undo();
      return;
    }
    if (e.key === 'y') {
      e.preventDefault();
      store.redo();
      return;
    }
  }

  // Pencil mode toggle
  if (e.key === 'n' || e.key === 'N') {
    store.togglePencilMode();
    return;
  }

  // Plane navigation
  if (e.key === 'PageUp' || e.key === '[') {
    store.prevPlane();
    return;
  }
  if (e.key === 'PageDown' || e.key === ']') {
    store.nextPlane();
    return;
  }

  // Axis switching
  if (e.key === 'x' || e.key === 'X') {
    store.switchAxis('XY');
    return;
  }
  if (e.key === 'y' || e.key === 'Y') {
    store.switchAxis('XZ');
    return;
  }
  if (e.key === 'z' || e.key === 'Z') {
    store.switchAxis('YZ');
    return;
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  store.cleanup();
});
</script>

<template>
  <div class="app">
    <!-- Landing Page / Difficulty Selection -->
    <Transition name="fade">
      <DifficultySelect
        v-if="showLandingPage"
        @select="startGame"
      />
    </Transition>

    <!-- Game View -->
    <template v-if="!showLandingPage && store.cube">
      <GameHeader @go-home="returnToMenu" />

      <main class="game-layout">
        <div class="canvas-container">
          <GameCanvas />
        </div>

        <aside class="sidebar">
          <PlaneSelector />
          <NumberPad />

          <!-- New Game Button -->
          <div class="new-game-section">
            <button class="new-game-btn" @click="returnToMenu">
              New Game
            </button>
          </div>
        </aside>
      </main>
    </template>

    <!-- Victory overlay -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="store.isComplete" class="victory-overlay">
          <div class="victory-content">
            <h1>Congratulations!</h1>
            <p>You solved the puzzle!</p>

            <div class="victory-stats">
              <div class="stat">
                <span class="value">{{ Math.floor(store.timer.elapsed / 60) }}:{{ (store.timer.elapsed % 60).toString().padStart(2, '0') }}</span>
                <span class="label">Time</span>
              </div>
              <div class="stat">
                <span class="value">{{ store.stats.errors }}</span>
                <span class="label">Errors</span>
              </div>
              <div class="stat">
                <span class="value">{{ store.stats.hints }}</span>
                <span class="label">Hints</span>
              </div>
            </div>

            <div class="victory-actions">
              <button @click="returnToMenu" class="btn primary">
                Play Again
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Game Over overlay -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="store.isGameOver && !store.isComplete" class="gameover-overlay">
          <div class="gameover-content">
            <h1>Game Over</h1>
            <p>You made too many mistakes!</p>

            <div class="gameover-stats">
              <div class="stat">
                <span class="value">{{ Math.floor(store.timer.elapsed / 60) }}:{{ (store.timer.elapsed % 60).toString().padStart(2, '0') }}</span>
                <span class="label">Time</span>
              </div>
              <div class="stat">
                <span class="value">{{ store.stats.errors }} / {{ store.maxErrors }}</span>
                <span class="label">Errors</span>
              </div>
              <div class="stat">
                <span class="value">{{ Math.round(store.progress * 100) }}%</span>
                <span class="label">Progress</span>
              </div>
            </div>

            <div class="gameover-actions">
              <button @click="tryAgain" class="btn primary">
                Try Again
              </button>
              <button @click="returnToMenu" class="btn secondary">
                Change Difficulty
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  background: #1a1a2e;
}

.game-layout {
  flex: 1;
  display: flex;
  gap: 1.5rem;
  padding: 1.5rem;
  overflow: hidden;
}

.canvas-container {
  flex: 1;
  min-width: 0;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 280px;
  flex-shrink: 0;
}

.new-game-section {
  margin-top: auto;
}

.new-game-btn {
  width: 100%;
  padding: 0.875rem;
  font-size: 1rem;
  font-weight: 600;
  color: white;
  background: #4a90d9;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.new-game-btn:hover {
  background: #5a9fe9;
}

/* Victory overlay */
.victory-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  z-index: 1000;
}

.victory-content {
  text-align: center;
  padding: 3rem;
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.victory-content h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  background: linear-gradient(90deg, #4a90d9, #4ad990);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.victory-content p {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 2rem;
}

.victory-stats {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
}

.victory-stats .stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.victory-stats .value {
  font-size: 2rem;
  font-weight: 700;
  color: white;
}

.victory-stats .label {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.victory-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

/* Game Over overlay */
.gameover-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.9);
  z-index: 1000;
}

.gameover-content {
  text-align: center;
  padding: 3rem;
  background: linear-gradient(135deg, #2a1a1a, #3a1a1a);
  border-radius: 16px;
  border: 1px solid rgba(255, 71, 87, 0.3);
  animation: shake-in 0.5s ease;
}

@keyframes shake-in {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

.gameover-content h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  color: #ff4757;
  text-shadow: 0 0 30px rgba(255, 71, 87, 0.5);
}

.gameover-content p {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 2rem;
}

.gameover-stats {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
}

.gameover-stats .stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.gameover-stats .value {
  font-size: 1.75rem;
  font-weight: 700;
  color: white;
}

.gameover-stats .label {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.gameover-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.btn {
  padding: 0.875rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn.primary {
  color: white;
  background: #4a90d9;
}

.btn.primary:hover {
  background: #5a9fe9;
}

.btn.secondary {
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.1);
}

.btn.secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 1024px) {
  .game-layout {
    flex-direction: column;
    padding: 0.75rem;
    gap: 0.75rem;
  }

  .canvas-container {
    flex: 1;
    min-height: 200px;
  }

  .sidebar {
    width: 100%;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .new-game-section {
    margin-top: 0;
    display: none;
  }
}

@media (max-width: 768px) {
  .game-layout {
    padding: 0.5rem;
    padding-bottom: 8rem; /* Space for number pad so cube centers above it */
    gap: 0.25rem;
    position: relative;
  }

  .canvas-container {
    flex: 1;
    min-height: 0;
  }

  .sidebar {
    position: fixed;
    bottom: 0.5rem;
    right: 0.5rem;
    width: auto;
    z-index: 100;
    pointer-events: none;
  }

  .sidebar > * {
    pointer-events: auto;
  }
}
</style>
