<script setup lang="ts">
/**
 * DifficultySelect Component
 *
 * Landing page for selecting game difficulty before starting.
 */

import { DIFFICULTY_CONFIGS, type Difficulty } from '../../types/game';

const emit = defineEmits<{
  (e: 'select', difficulty: Difficulty): void;
}>();

const difficulties: Difficulty[] = ['beginner', 'easy', 'medium', 'hard', 'expert'];

function getDifficultyColor(diff: Difficulty): string {
  switch (diff) {
    case 'beginner': return '#4ad990';
    case 'easy': return '#4a90d9';
    case 'medium': return '#d9a34a';
    case 'hard': return '#d9664a';
    case 'expert': return '#d94a6a';
  }
}
</script>

<template>
  <div class="difficulty-select">
    <div class="hero">
      <h1 class="title">
        <span class="logo-z">Z</span>UDOKU
      </h1>
      <p class="subtitle">3D Sudoku Challenge</p>
    </div>

    <div class="difficulty-grid">
      <button
        v-for="diff in difficulties"
        :key="diff"
        class="difficulty-card"
        :style="{ '--accent-color': getDifficultyColor(diff) }"
        @click="emit('select', diff)"
      >
        <div class="card-header">
          <span class="difficulty-name">{{ DIFFICULTY_CONFIGS[diff].name }}</span>
        </div>
        <p class="difficulty-desc">{{ DIFFICULTY_CONFIGS[diff].description }}</p>
        <div class="difficulty-stats">
          <span class="stat">
            <span class="stat-value">{{ DIFFICULTY_CONFIGS[diff].givens }}</span>
            <span class="stat-label">Given</span>
          </span>
          <span class="stat">
            <span class="stat-value">{{ DIFFICULTY_CONFIGS[diff].maxErrors }}</span>
            <span class="stat-label">Lives</span>
          </span>
        </div>
      </button>
    </div>

    <div class="instructions">
      <h3>How to Play</h3>
      <ul>
        <li>Fill all 729 cells in the 9×9×9 cube</li>
        <li>Each number 1-9 must appear exactly once in every row, column, and 3×3 block</li>
        <li>This applies to all 27 planes (XY, XZ, and YZ)</li>
        <li>Rotate the cube to view different faces</li>
        <li>Navigate through layers with the plane selector</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.difficulty-select {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  padding: 2rem;
  padding-top: 4rem;
  overflow-y: auto;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}

.hero {
  text-align: center;
  margin-bottom: 3rem;
}

.title {
  font-size: 4rem;
  font-weight: 800;
  color: white;
  letter-spacing: -0.02em;
  margin: 0;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.logo-z {
  color: #e94560;
  display: inline-block;
  animation: pulse-z 2s ease-in-out infinite;
}

@keyframes pulse-z {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.subtitle {
  font-size: 1.25rem;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0.5rem;
}

.difficulty-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  max-width: 1100px;
  width: 100%;
  margin-bottom: 2rem;
}

.difficulty-card {
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
}

.difficulty-card:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--accent-color);
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3), 0 0 20px color-mix(in srgb, var(--accent-color) 30%, transparent);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.difficulty-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--accent-color);
}

.difficulty-desc {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 1rem 0;
  flex: 1;
}

.difficulty-stats {
  display: flex;
  gap: 1.5rem;
}

.stat {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: white;
}

.stat-label {
  font-size: 0.625rem;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.instructions {
  max-width: 1100px;
  width: 100%;
  text-align: left;
  color: rgba(255, 255, 255, 0.5);
}

.instructions h3 {
  font-size: 1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 1rem;
}

.instructions ul {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.8;
}

.instructions li {
  padding-left: 1.5rem;
  position: relative;
}

.instructions li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: #4a90d9;
}

@media (max-width: 768px) {
  .title {
    font-size: 3rem;
  }

  .difficulty-grid {
    grid-template-columns: 1fr;
  }

  .difficulty-card {
    padding: 1.25rem;
  }
}
</style>
