<script setup lang="ts">
/**
 * NumberPad Component
 *
 * On-screen number input for placing values in cells.
 * Supports both value entry and pencil marks.
 */

import { computed, ref, watch } from 'vue';
import { useGameStore } from '../../stores/gameStore';
import type { CellValue } from '../../types';

const store = useGameStore();

const isPencilMode = computed(() => store.gameState?.isPencilMode ?? false);
const isShaking = ref(false);

const selectedCell = computed(() => {
  if (!store.selectedCell || !store.cube) return null;
  const pos = store.selectedCell;
  return store.cube[pos.z]?.[pos.y]?.[pos.x] ?? null;
});

const canInput = computed(() => {
  return selectedCell.value && !selectedCell.value.isGiven;
});

// Watch for wrong attempts and trigger shake animation
watch(() => store.lastWrongAttempt, (newAttempt) => {
  if (newAttempt) {
    isShaking.value = true;
    setTimeout(() => {
      isShaking.value = false;
    }, 500);
  }
});

function handleNumberClick(num: number) {
  if (!store.selectedCell || !canInput.value) return;

  if (isPencilMode.value) {
    store.togglePencilMark(store.selectedCell, num as CellValue);
  } else {
    store.setCellValue(store.selectedCell, num as CellValue);
  }
}

function handleClear() {
  if (!store.selectedCell || !canInput.value) return;
  store.setCellValue(store.selectedCell, 0);
}
</script>

<template>
  <div class="number-pad" :class="{ 'pencil-mode': isPencilMode, 'shake': isShaking }">
    <div class="wrong-feedback" v-if="isShaking">Wrong!</div>
    <div class="number-grid">
      <button
        v-for="num in 9"
        :key="num"
        class="number-btn"
        :disabled="!canInput"
        @click="handleNumberClick(num)"
      >
        {{ num }}
      </button>
    </div>

    <div class="actions">
      <button
        class="action-btn"
        :disabled="!canInput"
        @click="handleClear"
        title="Clear cell"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
          <line x1="18" y1="9" x2="12" y2="15"/>
          <line x1="12" y1="9" x2="18" y2="15"/>
        </svg>
      </button>

      <button
        class="action-btn"
        :class="{ active: isPencilMode }"
        @click="store.togglePencilMode()"
        title="Pencil mode"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
        </svg>
      </button>

      <button
        class="action-btn hint-btn"
        :class="{ active: store.showHints }"
        :disabled="!store.selectedCell"
        @click="store.toggleHints()"
        title="Show hints"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18h6"/>
          <path d="M10 22h4"/>
          <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/>
        </svg>
      </button>

      <button
        class="action-btn"
        :disabled="!store.canUndo"
        @click="store.undo()"
        title="Undo"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 7v6h6"/>
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.number-pad {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.number-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.number-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  font-size: 1.5rem;
  font-weight: 600;
  color: white;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.number-btn:hover:not(:disabled) {
  background: rgba(74, 144, 217, 0.3);
  border-color: #4a90d9;
}

.number-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.number-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pencil-mode .number-btn {
  background: rgba(74, 217, 144, 0.1);
}

.pencil-mode .number-btn:hover:not(:disabled) {
  background: rgba(74, 217, 144, 0.3);
  border-color: #4ad990;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.08);
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn svg {
  width: 20px;
  height: 20px;
}

.action-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn.active {
  background: rgba(74, 217, 144, 0.2);
  border-color: #4ad990;
  color: #4ad990;
}

.action-btn.hint-btn:not(:disabled):hover {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.action-btn.hint-btn.active {
  background: rgba(255, 193, 7, 0.25);
  border-color: #ffc107;
  color: #ffc107;
}

/* Wrong answer feedback */
.wrong-feedback {
  position: absolute;
  top: -2rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.2);
  border-radius: 4px;
  animation: fadeOut 0.5s ease forwards;
}

@keyframes fadeOut {
  0% { opacity: 1; }
  70% { opacity: 1; }
  100% { opacity: 0; }
}

.number-pad {
  position: relative;
}

.shake {
  animation: shake 0.4s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-6px); }
  80% { transform: translateX(6px); }
}
</style>
