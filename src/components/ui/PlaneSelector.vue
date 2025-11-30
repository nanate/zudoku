<script setup lang="ts">
/**
 * PlaneSelector Component
 *
 * Controls for navigating depth within the current view plane.
 * The axis is automatically determined by camera orientation.
 * Index display is view-relative: 1 = back (furthest), 9 = front (nearest).
 */

import { computed } from 'vue';
import { useGameStore } from '../../stores/gameStore';

const store = useGameStore();

const currentAxis = computed(() => store.activePlane.axis);

// View-relative index (1=back, 9=front based on camera position)
const viewIndex = computed(() => store.viewRelativePlaneIndex);

// Display-friendly axis name
const axisLabel = computed(() => {
  switch (currentAxis.value) {
    case 'XY': return 'Front/Back';
    case 'XZ': return 'Top/Bottom';
    case 'YZ': return 'Left/Right';
  }
});

// Navigate in view-relative direction (forward = toward camera)
function navigateForward() {
  // Higher view index = closer to camera
  store.setPlaneByViewIndex(Math.min(9, viewIndex.value + 1));
}

function navigateBackward() {
  // Lower view index = further from camera
  store.setPlaneByViewIndex(Math.max(1, viewIndex.value - 1));
}
</script>

<template>
  <div class="plane-selector">
    <!-- Desktop layout -->
    <div class="desktop-layout">
      <!-- Show current axis (read-only, determined by camera) -->
      <div class="current-axis">
        <span class="axis-name">{{ currentAxis }}</span>
        <span class="axis-desc">{{ axisLabel }}</span>
      </div>

      <div class="plane-navigator">
        <button
          class="nav-btn"
          @click="navigateBackward"
          title="Move away from camera (back)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div class="plane-indicator">
          <span class="plane-number">{{ viewIndex }}</span>
          <span class="plane-label">/ 9</span>
        </div>

        <button
          class="nav-btn"
          @click="navigateForward"
          title="Move toward camera (front)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      <!-- Quick plane buttons (1=back, 9=front) - horizontal -->
      <div class="plane-quick-select">
        <button
          v-for="i in 9"
          :key="i"
          class="quick-btn"
          :class="{ active: viewIndex === i }"
          @click="store.setPlaneByViewIndex(i)"
        >
          {{ i }}
        </button>
      </div>
    </div>

    <!-- Mobile layout - vertical strip -->
    <div class="mobile-layout">
      <!-- Navigation arrows at top -->
      <div class="mobile-nav">
        <button
          class="nav-btn-mobile"
          @click="navigateBackward"
          title="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
        <button
          class="nav-btn-mobile"
          @click="navigateForward"
          title="Front"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>

      <!-- Vertical plane buttons (9-1, top to bottom, 9=front at top) -->
      <div class="plane-vertical-select">
        <button
          v-for="i in 9"
          :key="i"
          class="quick-btn-vertical"
          :class="{ active: viewIndex === (10 - i) }"
          @click="store.setPlaneByViewIndex(10 - i)"
        >
          {{ 10 - i }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plane-selector {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

/* Desktop layout */
.desktop-layout {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.mobile-layout {
  display: none;
}

.current-axis {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: rgba(74, 144, 217, 0.15);
  border-radius: 8px;
}

.axis-name {
  font-size: 1rem;
  font-weight: 700;
  color: #4a90d9;
}

.axis-desc {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
}

.plane-navigator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: white;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-btn:hover {
  background: rgba(74, 144, 217, 0.3);
}

.nav-btn svg {
  width: 24px;
  height: 24px;
}

.plane-indicator {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  min-width: 60px;
  justify-content: center;
}

.plane-number {
  font-size: 1.75rem;
  font-weight: 700;
  color: #4a90d9;
}

.plane-label {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.5);
}

.plane-quick-select {
  display: flex;
  gap: 0.25rem;
}

.quick-btn {
  flex: 1;
  padding: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.quick-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.quick-btn.active {
  background: #4a90d9;
  color: white;
}

/* Mobile layout styles */
@media (max-width: 768px) {
  .plane-selector {
    position: fixed;
    left: 0.25rem;
    top: 3.5rem; /* Below header */
    transform: none;
    padding: 0.25rem;
    width: auto;
    z-index: 50;
    gap: 0.125rem;
    background: transparent;
    border-radius: 0;
  }

  .desktop-layout {
    display: none;
  }

  .mobile-layout {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .mobile-nav {
    display: flex;
    gap: 0.125rem;
  }

  .nav-btn-mobile {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    color: white;
    background: rgba(255, 255, 255, 0.15);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .nav-btn-mobile:hover, .nav-btn-mobile:active {
    background: rgba(74, 144, 217, 0.4);
  }

  .nav-btn-mobile svg {
    width: 16px;
    height: 16px;
  }

  .plane-vertical-select {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .quick-btn-vertical {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.625rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid transparent;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .quick-btn-vertical:hover, .quick-btn-vertical:active {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .quick-btn-vertical.active {
    background: #4a90d9;
    color: white;
  }
}
</style>
