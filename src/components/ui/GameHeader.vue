<script setup lang="ts">
/**
 * GameHeader Component
 *
 * Top bar with game title, timer, and menu controls.
 * Also shows concise constraint hints for the selected cell.
 */

import { computed } from 'vue';
import { useGameStore } from '../../stores/gameStore';
import { DIFFICULTY_CONFIGS } from '../../types/game';

const store = useGameStore();

const formattedTime = computed(() => {
  const elapsed = store.timer.elapsed;
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
});

const difficultyConfig = computed(() => {
  return DIFFICULTY_CONFIGS[store.difficulty];
});

const progressPercent = computed(() => {
  return Math.round(store.progress * 100);
});

const errorCount = computed(() => store.stats.errors);
const maxErrors = computed(() => difficultyConfig.value.maxErrors);
const errorsRemaining = computed(() => maxErrors.value - errorCount.value);
const isErrorDanger = computed(() => errorsRemaining.value <= 1);
const isErrorWarning = computed(() => errorsRemaining.value <= 2 && !isErrorDanger.value);

// Cell constraints info for hints display
const exclusions = computed(() => store.selectedCellExclusions);
const hasSelectedEmptyCell = computed(() => {
  if (!store.selectedCell || !store.cube) return false;
  const pos = store.selectedCell;
  const cell = store.cube[pos.z]?.[pos.y]?.[pos.x];
  return cell && !cell.isGiven && cell.value === 0;
});

// Format available candidates as a simple list
const availableCandidates = computed(() => {
  if (!exclusions.value) return [];
  return Array.from(exclusions.value.candidates).sort((a, b) => a - b);
});

// Format blocked values with concise reason
const blockedValues = computed(() => {
  if (!exclusions.value) return [];
  const result: { value: number; reason: string }[] = [];
  for (const [value, blockers] of exclusions.value.blockedBy) {
    // Get the first blocker as the primary reason
    const first = blockers[0];
    if (first) {
      // Extract short reason like "XY row" or "XZ block"
      const parts = first.constraint.split('-');
      const reason = `${parts[0]} ${parts[1]}`;
      result.push({ value, reason });
    }
  }
  return result.sort((a, b) => a.value - b.value);
});
</script>

<template>
  <header class="game-header-wrapper">
    <div class="game-header">
      <div class="logo">
        <span class="logo-z">Z</span>UDOKU
      </div>

      <div class="game-info" v-if="store.cube">
      <div class="difficulty-badge">
        {{ difficultyConfig.name }}
      </div>

      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
        <span class="progress-text">{{ progressPercent }}%</span>
      </div>

      <div class="timer" :class="{ paused: store.timer.isPaused }">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        {{ formattedTime }}
      </div>

      <div class="stats">
        <!-- Error counter with danger/warning states -->
        <div
          class="error-counter"
          :class="{ danger: isErrorDanger, warning: isErrorWarning }"
          :title="`${errorsRemaining} errors remaining`"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <span class="error-count">{{ errorCount }}</span>
          <span class="error-max">/ {{ maxErrors }}</span>
        </div>

        <span class="stat" title="Hints used">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          {{ store.stats.hints }}
        </span>
      </div>
    </div>

    <div class="actions">
      <button
        class="icon-btn"
        :class="{ active: store.showHints }"
        @click="store.toggleHints()"
        :disabled="!store.selectedCell"
        title="Show hints"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18h6"/>
          <path d="M10 22h4"/>
          <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/>
        </svg>
      </button>

      <button
        class="icon-btn"
        @click="store.timer.isPaused ? store.resumeTimer() : store.pauseTimer()"
        title="Pause/Resume"
      >
        <svg v-if="store.timer.isPaused" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16"/>
          <rect x="14" y="4" width="4" height="16"/>
        </svg>
      </button>
    </div>
    </div>

    <!-- Concise hints bar - only shown when explicitly requested -->
    <div class="hints-bar" v-if="store.showHints && hasSelectedEmptyCell && exclusions">
      <span class="hints-label">Available:</span>
      <span class="candidates">
        <span
          v-for="n in availableCandidates"
          :key="n"
          class="candidate"
        >{{ n }}</span>
      </span>
      <span class="divider" v-if="blockedValues.length > 0">|</span>
      <span class="blocked" v-if="blockedValues.length > 0">
        <span
          v-for="blocked in blockedValues"
          :key="blocked.value"
          class="blocked-item"
          :title="blocked.reason"
        >
          <span class="blocked-value">{{ blocked.value }}</span>
          <span class="blocked-reason">{{ blocked.reason }}</span>
        </span>
      </span>
    </div>
  </header>
</template>

<style scoped>
.game-header-wrapper {
  position: relative;
  z-index: 100;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
}

/* Hints bar - positioned absolutely to not affect layout */
.hints-bar {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 1.5rem;
  font-size: 0.75rem;
  background: rgba(26, 26, 46, 0.95);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 10;
}

.hints-label {
  color: rgba(255, 255, 255, 0.5);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.candidates {
  display: flex;
  gap: 0.25rem;
}

.candidate {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  font-weight: 700;
  color: #4ad990;
  background: rgba(74, 217, 144, 0.15);
  border-radius: 3px;
}

.divider {
  color: rgba(255, 255, 255, 0.2);
  margin: 0 0.25rem;
}

.blocked {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.blocked-item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: rgba(255, 255, 255, 0.5);
}

.blocked-value {
  font-weight: 700;
  color: rgba(255, 107, 107, 0.7);
  text-decoration: line-through;
}

.blocked-reason {
  font-size: 0.625rem;
  color: rgba(255, 255, 255, 0.35);
}

.logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  letter-spacing: -0.02em;
}

.logo-z {
  color: #e94560;
}

.game-info {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.difficulty-badge {
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #4a90d9;
  background: rgba(74, 144, 217, 0.15);
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.progress-bar {
  position: relative;
  width: 120px;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #4a90d9, #4ad990);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  right: -40px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
}

.timer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: white;
}

.timer svg {
  width: 18px;
  height: 18px;
  opacity: 0.7;
}

.timer.paused {
  opacity: 0.5;
}

.stats {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
}

.stat svg {
  width: 16px;
  height: 16px;
}

/* Enhanced error counter */
.error-counter {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  transition: all 0.3s ease;
}

.error-counter svg {
  width: 16px;
  height: 16px;
}

.error-count {
  font-weight: 700;
}

.error-max {
  opacity: 0.6;
  font-weight: 400;
}

.error-counter.warning {
  color: #ffb347;
  background: rgba(255, 179, 71, 0.2);
  animation: pulse-warning 1.5s ease-in-out infinite;
}

.error-counter.warning svg {
  stroke: #ffb347;
}

.error-counter.danger {
  color: #ff4757;
  background: rgba(255, 71, 87, 0.25);
  animation: pulse-danger 0.8s ease-in-out infinite;
}

.error-counter.danger svg {
  stroke: #ff4757;
}

@keyframes pulse-warning {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes pulse-danger {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.4);
  }
  50% {
    transform: scale(1.08);
    box-shadow: 0 0 15px 2px rgba(255, 71, 87, 0.3);
  }
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.05);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.icon-btn.active {
  background: rgba(74, 144, 217, 0.3);
  color: #4a90d9;
}

.icon-btn svg {
  width: 20px;
  height: 20px;
}

@media (max-width: 768px) {
  .game-header {
    padding: 0.5rem 1rem;
  }

  .game-info {
    gap: 0.75rem;
  }

  .progress-bar {
    display: none;
  }

  .stats {
    display: none;
  }
}
</style>
