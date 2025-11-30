<script setup lang="ts">
/**
 * GameCanvas Component
 *
 * Main 3D rendering canvas that displays the Sudoku cube.
 * Integrates Three.js SceneManager with Vue reactivity.
 *
 * IMPORTANT: SceneManager is stored outside of Vue's reactivity system
 * because Three.js objects don't work with Vue's Proxy wrappers.
 */

import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useGameStore } from '../../stores/gameStore';
import { SceneManager } from '../../three/SceneManager';
import type { Position, PlaneRef } from '../../types';

const store = useGameStore();

// Template refs
const containerRef = ref<HTMLDivElement>();
const canvasRef = ref<HTMLCanvasElement>();

// Scene manager instance - stored as plain variable to avoid Vue's Proxy wrapping
// Three.js objects must not be wrapped in Vue's reactivity system
let sceneManager: SceneManager | null = null;

// Initialize Three.js scene
onMounted(() => {
  if (!canvasRef.value) return;

  sceneManager = new SceneManager();
  sceneManager.init(canvasRef.value);

  // Set up event handlers
  sceneManager.onCellClicked((pos: Position) => {
    store.selectCell(pos);
  });

  sceneManager.onCellHovered((pos: Position | null) => {
    // When hovering, show highlights for hovered cell, otherwise revert to selected cell
    if (pos) {
      sceneManager?.showRelatedCells(pos);
    } else if (store.selectedCell) {
      sceneManager?.showRelatedCells(store.selectedCell);
    }
  });

  // Auto-switch plane based on camera orientation (selects back plane)
  sceneManager.onPlaneChanged((axis: 'XY' | 'XZ' | 'YZ', index: number, cameraOnPositiveSide: boolean) => {
    store.setCameraDirection(cameraOnPositiveSide);
    store.setActivePlane({ axis, index });
  });

  // Create cube if game is already loaded
  if (store.cube) {
    sceneManager.createCube(store.cube);
    sceneManager.highlightPlane(store.activePlane as PlaneRef);
  }

  // Start animation loop
  sceneManager.startAnimationLoop();
});

// Cleanup on unmount
onBeforeUnmount(() => {
  sceneManager?.dispose();
  sceneManager = null;
});

// Watch for cube changes (initial load only)
watch(
  () => store.cube,
  (newCube) => {
    if (newCube && sceneManager) {
      sceneManager.createCube(newCube);
      sceneManager.highlightPlane(store.activePlane as PlaneRef);
    }
  }
);

// Watch for cell value changes (triggered by store.lastCellUpdate)
watch(
  () => store.lastCellUpdate,
  (cellData) => {
    if (cellData && sceneManager) {
      sceneManager.updateCell(
        cellData.pos,
        cellData.value,
        cellData.isGiven,
        cellData.isError
      );
    }
  }
);

// Watch for wrong attempts and flash the cell red
watch(
  () => store.lastWrongAttempt,
  (wrongAttempt) => {
    if (wrongAttempt && sceneManager) {
      sceneManager.flashCellError(wrongAttempt.pos);
    }
  }
);

// Watch for active plane changes
watch(
  () => store.activePlane,
  (newPlane) => {
    sceneManager?.highlightPlane(newPlane as PlaneRef);
  }
);

// Watch for selected cell changes
watch(
  () => store.selectedCell,
  (newCell) => {
    sceneManager?.setSelectedCell(newCell);
    if (newCell) {
      sceneManager?.showRelatedCells(newCell);
    } else {
      sceneManager?.clearHighlights();
    }
  }
);

// Expose scene manager for parent components
defineExpose({
  resetCamera: () => sceneManager?.resetCamera()
});
</script>

<template>
  <div ref="containerRef" class="game-canvas-container">
    <canvas ref="canvasRef" class="game-canvas" />

    <!-- Loading overlay -->
    <div v-if="store.isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>Generating puzzle...</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="!store.cube" class="empty-state">
      <p>No game loaded</p>
      <button @click="store.newGame('medium')" class="start-button">
        Start New Game
      </button>
    </div>
  </div>
</template>

<style scoped>
.game-canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 400px;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 8px;
  overflow: hidden;
}

.game-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(26, 26, 46, 0.9);
  color: white;
  gap: 1rem;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #4a90d9;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  gap: 1.5rem;
}

.empty-state p {
  font-size: 1.25rem;
}

.start-button {
  padding: 0.75rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  color: white;
  background: #4a90d9;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.start-button:hover {
  background: #5a9fe9;
  transform: translateY(-2px);
}

.start-button:active {
  transform: translateY(0);
}
</style>
