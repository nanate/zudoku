<script setup lang="ts">
/**
 * CellInfo Component
 *
 * Displays exclusion information for the selected cell.
 * Shows which values are available vs blocked and why.
 */

import { computed } from 'vue';
import { useGameStore } from '../../stores/gameStore';
import type { CellValue, Axis } from '../../types';

const store = useGameStore();

const selectedCell = computed(() => {
  if (!store.selectedCell || !store.cube) return null;
  const pos = store.selectedCell;
  return {
    cell: store.cube[pos.z]?.[pos.y]?.[pos.x] ?? null,
    pos
  };
});

const exclusions = computed(() => store.selectedCellExclusions);

const hasSelection = computed(() => {
  return selectedCell.value?.cell && !selectedCell.value.cell.isGiven && selectedCell.value.cell.value === 0;
});

function getPlaneColor(axis: Axis): string {
  switch (axis) {
    case 'XY': return '#4a90d9';
    case 'XZ': return '#4ad990';
    case 'YZ': return '#d9a34a';
  }
}

function getConstraintLabel(constraint: string): string {
  const parts = constraint.split('-');
  const plane = parts[0];
  const type = parts[1];
  return `${plane} ${type}`;
}
</script>

<template>
  <div class="cell-info">
    <div class="header">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      <span>Cell Constraints</span>
    </div>

    <div v-if="!hasSelection" class="no-selection">
      Select an empty cell to see constraints
    </div>

    <template v-else-if="exclusions">
      <!-- Position info -->
      <div class="position-info" v-if="selectedCell">
        <span class="coord">X: {{ selectedCell.pos.x + 1 }}</span>
        <span class="coord">Y: {{ selectedCell.pos.y + 1 }}</span>
        <span class="coord">Z: {{ selectedCell.pos.z + 1 }}</span>
      </div>

      <!-- Available values -->
      <div class="candidates-section">
        <div class="section-title">Available</div>
        <div class="candidates-grid">
          <span
            v-for="n in 9"
            :key="n"
            class="candidate"
            :class="{ available: exclusions.candidates.has(n as CellValue), blocked: !exclusions.candidates.has(n as CellValue) }"
          >
            {{ n }}
          </span>
        </div>
      </div>

      <!-- Blocked values with reasons -->
      <div class="blocked-section" v-if="exclusions.blockedBy.size > 0">
        <div class="section-title">Blocked Values</div>
        <div class="blocked-list">
          <div
            v-for="[value, blockers] in exclusions.blockedBy"
            :key="value"
            class="blocked-item"
          >
            <span class="blocked-value">{{ value }}</span>
            <div class="blockers">
              <span
                v-for="(blocker, idx) in blockers.slice(0, 3)"
                :key="idx"
                class="blocker-tag"
                :style="{ borderColor: getPlaneColor(blocker.plane.axis) }"
                :title="blocker.description"
              >
                {{ getConstraintLabel(blocker.constraint) }}
              </span>
              <span v-if="blockers.length > 3" class="more-blockers">
                +{{ blockers.length - 3 }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div class="legend">
        <div class="legend-item">
          <span class="legend-dot" style="background: #4a90d9;"></span>
          <span>XY plane</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot" style="background: #4ad990;"></span>
          <span>XZ plane</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot" style="background: #d9a34a;"></span>
          <span>YZ plane</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cell-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  font-size: 0.875rem;
}

.header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.header svg {
  width: 16px;
  height: 16px;
  opacity: 0.7;
}

.no-selection {
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.8125rem;
  text-align: center;
  padding: 1rem 0;
}

.position-info {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.coord {
  color: rgba(255, 255, 255, 0.6);
  font-family: monospace;
}

.section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.375rem;
}

.candidates-section {
  padding-top: 0.25rem;
}

.candidates-grid {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.candidate {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-weight: 600;
  border-radius: 4px;
  font-size: 0.875rem;
}

.candidate.available {
  background: rgba(74, 217, 144, 0.2);
  color: #4ad990;
  border: 1px solid rgba(74, 217, 144, 0.4);
}

.candidate.blocked {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.25);
  text-decoration: line-through;
}

.blocked-section {
  max-height: 150px;
  overflow-y: auto;
}

.blocked-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.blocked-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
}

.blocked-value {
  font-weight: 700;
  color: rgba(255, 107, 107, 0.8);
  width: 1.25rem;
  text-align: center;
}

.blockers {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  flex: 1;
}

.blocker-tag {
  padding: 0.125rem 0.375rem;
  font-size: 0.6875rem;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid;
  border-radius: 3px;
  white-space: nowrap;
}

.more-blockers {
  padding: 0.125rem 0.25rem;
  font-size: 0.625rem;
  color: rgba(255, 255, 255, 0.4);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 0.25rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  color: rgba(255, 255, 255, 0.5);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

/* Scrollbar styling for blocked section */
.blocked-section::-webkit-scrollbar {
  width: 4px;
}

.blocked-section::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
}

.blocked-section::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}
</style>
