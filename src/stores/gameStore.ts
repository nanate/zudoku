/**
 * Main Game Store
 *
 * Central state management for the Zudoku game using Pinia.
 * Handles game state, cell updates, undo/redo, and persistence.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  Position, PlaneRef, CellValue
} from '../types/cube';
import type {
  GameState, Difficulty, HistoryEntry
} from '../types/game';
import {
  createTimerState, createGameStats, generateGameId, DIFFICULTY_CONFIGS
} from '../types/game';
import { extractPlane } from '../types/cube';
import { generateSolution, getDailySeed } from '../engine/generator';
import { createPuzzle, countEmptyCells, isPuzzleComplete } from '../engine/difficulty';
import { CubeValidator, type ExclusionInfo } from '../engine/validator';

export const useGameStore = defineStore('game', () => {
  // ============ State ============
  const gameState = ref<GameState | null>(null);
  const validator = ref<CubeValidator | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Track cell updates for reactive 3D rendering
  const lastCellUpdate = ref<{ pos: Position; value: CellValue; isGiven: boolean; isError: boolean } | null>(null);

  // Camera viewing direction - true if camera is on positive side of dominant axis
  // Used to make plane index display view-relative (1=back, 9=front)
  const cameraOnPositiveSide = ref(true);

  // Hints visibility - only shown when user explicitly requests hints
  const showHints = ref(false);

  // ============ Getters/Computed ============
  const cube = computed(() => gameState.value?.cube ?? null);

  const activePlane = computed(() => gameState.value?.activePlane ?? { axis: 'XY', index: 0 });

  // View-relative plane index: 1 = furthest from camera, 9 = closest to camera
  const viewRelativePlaneIndex = computed(() => {
    const index = activePlane.value.index;
    // If camera is on positive side, higher indices are closer (front)
    // So display: index 8 -> "9" (front), index 0 -> "1" (back)
    // If camera is on negative side, lower indices are closer (front)
    // So display: index 0 -> "9" (front), index 8 -> "1" (back)
    if (cameraOnPositiveSide.value) {
      return index + 1; // 0->1, 8->9
    } else {
      return 9 - index; // 0->9, 8->1
    }
  });

  const selectedCell = computed(() => gameState.value?.selectedCell ?? null);

  const currentPlane = computed(() => {
    if (!gameState.value?.cube) return null;
    return extractPlane(gameState.value.cube, gameState.value.activePlane);
  });

  const progress = computed(() => {
    if (!gameState.value) return 0;
    const stats = gameState.value.stats;
    if (stats.totalEmpty === 0) return 1;
    return stats.cellsFilled / stats.totalEmpty;
  });

  const isComplete = computed(() => gameState.value?.isComplete ?? false);

  const isGameOver = computed(() => {
    if (!gameState.value) return false;
    const maxErrors = DIFFICULTY_CONFIGS[gameState.value.difficulty].maxErrors;
    return gameState.value.stats.errors >= maxErrors;
  });

  const maxErrors = computed(() => {
    if (!gameState.value) return 5;
    return DIFFICULTY_CONFIGS[gameState.value.difficulty].maxErrors;
  });

  const canUndo = computed(() => (gameState.value?.history.length ?? 0) > 0);

  const canRedo = computed(() => (gameState.value?.redoStack.length ?? 0) > 0);

  const selectedCellExclusions = computed((): ExclusionInfo | null => {
    if (!gameState.value?.selectedCell || !validator.value || !gameState.value.cube) return null;
    const pos = gameState.value.selectedCell;
    const cell = gameState.value.cube[pos.z]?.[pos.y]?.[pos.x];
    if (!cell || cell.isGiven || cell.value !== 0) return null;
    return validator.value.getExclusions(pos.x, pos.y, pos.z, gameState.value.cube);
  });

  const timer = computed(() => gameState.value?.timer ?? createTimerState());

  const stats = computed(() => gameState.value?.stats ?? createGameStats(0));

  const difficulty = computed(() => gameState.value?.difficulty ?? 'medium');

  // ============ Actions ============

  /**
   * Start a new game with specified difficulty
   */
  async function newGame(diff: Difficulty, seed?: string | number): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      // Generate puzzle (may take a moment)
      const solution = generateSolution(seed);
      const puzzle = createPuzzle(solution, diff, typeof seed === 'number' ? seed : undefined);
      const emptyCount = countEmptyCells(puzzle);

      // Create validator
      const newValidator = new CubeValidator();
      newValidator.initFromCube(puzzle);
      validator.value = newValidator;

      // Create game state
      gameState.value = {
        id: generateGameId(),
        cube: puzzle,
        difficulty: diff,
        activePlane: { axis: 'XY', index: 0 },
        selectedCell: null,
        timer: createTimerState(),
        stats: createGameStats(emptyCount),
        history: [],
        redoStack: [],
        isPencilMode: false,
        isComplete: false,
        createdAt: Date.now(),
        lastSavedAt: null
      };

      // Start timer
      startTimer();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to generate puzzle';
      console.error('Failed to generate puzzle:', e);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Start a daily challenge
   */
  async function startDailyChallenge(): Promise<void> {
    const seed = getDailySeed();
    await newGame('medium', seed);
  }

  // Track last wrong attempt for UI feedback
  const lastWrongAttempt = ref<{ pos: Position; value: CellValue; timestamp: number } | null>(null);

  /**
   * Set cell value - rejects incorrect entries but tallies them
   */
  function setCellValue(pos: Position, value: CellValue): void {
    if (!gameState.value || !validator.value) return;

    const cell = gameState.value.cube[pos.z]?.[pos.y]?.[pos.x];
    if (!cell) return;

    // Can't modify given cells
    if (cell.isGiven) return;

    const oldValue = cell.value;

    // Don't record if same value
    if (oldValue === value) return;

    // Allow clearing (value === 0), but check incorrect entries
    if (value !== 0 && value !== cell.solution) {
      // Wrong answer - tally the error but don't place the value
      gameState.value.stats.errors++;
      lastWrongAttempt.value = { pos: { ...pos }, value, timestamp: Date.now() };

      // Check if game is now over (too many errors)
      const maxErr = DIFFICULTY_CONFIGS[gameState.value.difficulty].maxErrors;
      if (gameState.value.stats.errors >= maxErr) {
        pauseTimer();
      }

      // Don't place the value - just return after incrementing error count
      return;
    }

    // Correct value or clearing - proceed with placement
    // Record history
    const historyEntry: HistoryEntry = {
      timestamp: Date.now(),
      type: value === 0 ? 'clearValue' : 'setValue',
      position: { ...pos },
      previousValue: oldValue,
      newValue: value
    };

    gameState.value.history.push(historyEntry);
    gameState.value.redoStack = []; // Clear redo on new action

    // Update cell
    cell.value = value;
    cell.isError = false; // Correct values are never errors

    // Notify 3D renderer of cell update (reactive trigger)
    lastCellUpdate.value = { pos: { ...pos }, value, isGiven: cell.isGiven, isError: cell.isError };

    // Update validator
    validator.value.updateCell(pos.x, pos.y, pos.z, oldValue, value);

    // Update stats
    if (oldValue === 0 && value !== 0) {
      gameState.value.stats.cellsFilled++;
    } else if (oldValue !== 0 && value === 0) {
      gameState.value.stats.cellsFilled--;
    }

    // Check completion
    if (isPuzzleComplete(gameState.value.cube)) {
      gameState.value.isComplete = true;
      pauseTimer();
    }

    // Auto-save (debounced in real implementation)
    saveGame();
  }

  /**
   * Toggle pencil mark
   */
  function togglePencilMark(pos: Position, value: CellValue): void {
    if (!gameState.value || value === 0) return;

    const cell = gameState.value.cube[pos.z]?.[pos.y]?.[pos.x];
    if (!cell) return;

    // Can't add pencil marks to given or filled cells
    if (cell.isGiven || cell.value !== 0) return;

    const previousMarks = [...cell.pencilMarks];

    if (cell.pencilMarks.has(value)) {
      cell.pencilMarks.delete(value);
    } else {
      cell.pencilMarks.add(value);
    }

    // Record history
    const historyEntry: HistoryEntry = {
      timestamp: Date.now(),
      type: 'togglePencilMark',
      position: { ...pos },
      previousValue: 0,
      newValue: 0,
      previousPencilMarks: previousMarks,
      newPencilMarks: [...cell.pencilMarks]
    };

    gameState.value.history.push(historyEntry);
    gameState.value.redoStack = [];
  }

  /**
   * Select a cell
   */
  function selectCell(pos: Position | null): void {
    if (!gameState.value) return;
    gameState.value.selectedCell = pos ? { ...pos } : null;
    // Hide hints when selection changes
    showHints.value = false;
  }

  /**
   * Toggle hints visibility for selected cell
   */
  function toggleHints(): void {
    if (!gameState.value?.selectedCell) return;
    showHints.value = !showHints.value;
  }

  /**
   * Set active plane
   */
  function setActivePlane(plane: PlaneRef): void {
    if (!gameState.value) return;
    gameState.value.activePlane = { ...plane };
  }

  /**
   * Update camera viewing direction (called from SceneManager)
   */
  function setCameraDirection(onPositiveSide: boolean): void {
    cameraOnPositiveSide.value = onPositiveSide;
  }

  /**
   * Set plane by view-relative index (1=back/furthest, 9=front/nearest)
   */
  function setPlaneByViewIndex(viewIndex: number): void {
    if (!gameState.value) return;
    // Convert view-relative index to actual index
    let actualIndex: number;
    if (cameraOnPositiveSide.value) {
      actualIndex = viewIndex - 1; // 1->0, 9->8
    } else {
      actualIndex = 9 - viewIndex; // 1->8, 9->0
    }
    actualIndex = Math.max(0, Math.min(8, actualIndex));
    setActivePlane({ axis: gameState.value.activePlane.axis, index: actualIndex });
  }

  /**
   * Navigate to next plane in current axis
   */
  function nextPlane(): void {
    if (!gameState.value) return;
    const current = gameState.value.activePlane;
    const newIndex = (current.index + 1) % 9;
    setActivePlane({ axis: current.axis, index: newIndex });
  }

  /**
   * Navigate to previous plane in current axis
   */
  function prevPlane(): void {
    if (!gameState.value) return;
    const current = gameState.value.activePlane;
    const newIndex = (current.index + 8) % 9; // +8 is same as -1 mod 9
    setActivePlane({ axis: current.axis, index: newIndex });
  }

  /**
   * Switch axis
   */
  function switchAxis(axis: 'XY' | 'XZ' | 'YZ'): void {
    if (!gameState.value) return;
    setActivePlane({ axis, index: gameState.value.activePlane.index });
  }

  /**
   * Undo last action
   */
  function undo(): void {
    if (!gameState.value || !validator.value || gameState.value.history.length === 0) return;

    const entry = gameState.value.history.pop()!;
    gameState.value.redoStack.push(entry);

    const cell = gameState.value.cube[entry.position.z]?.[entry.position.y]?.[entry.position.x];
    if (!cell) return;

    if (entry.type === 'setValue' || entry.type === 'clearValue') {
      // Restore value
      const newValue = entry.previousValue;
      const oldValue = cell.value;

      cell.value = newValue;
      validator.value.updateCell(
        entry.position.x, entry.position.y, entry.position.z,
        oldValue, newValue
      );

      // Update error state
      cell.isError = newValue !== 0 && newValue !== cell.solution;

      // Update stats
      if (oldValue === 0 && newValue !== 0) {
        gameState.value.stats.cellsFilled++;
      } else if (oldValue !== 0 && newValue === 0) {
        gameState.value.stats.cellsFilled--;
      }
    } else if (entry.type === 'togglePencilMark' && entry.previousPencilMarks) {
      cell.pencilMarks = new Set(entry.previousPencilMarks);
    }
  }

  /**
   * Redo last undone action
   */
  function redo(): void {
    if (!gameState.value || !validator.value || gameState.value.redoStack.length === 0) return;

    const entry = gameState.value.redoStack.pop()!;
    gameState.value.history.push(entry);

    const cell = gameState.value.cube[entry.position.z]?.[entry.position.y]?.[entry.position.x];
    if (!cell) return;

    if (entry.type === 'setValue' || entry.type === 'clearValue') {
      const newValue = entry.newValue;
      const oldValue = cell.value;

      cell.value = newValue;
      validator.value.updateCell(
        entry.position.x, entry.position.y, entry.position.z,
        oldValue, newValue
      );

      cell.isError = newValue !== 0 && newValue !== cell.solution;

      if (oldValue === 0 && newValue !== 0) {
        gameState.value.stats.cellsFilled++;
      } else if (oldValue !== 0 && newValue === 0) {
        gameState.value.stats.cellsFilled--;
      }
    } else if (entry.type === 'togglePencilMark' && entry.newPencilMarks) {
      cell.pencilMarks = new Set(entry.newPencilMarks);
    }
  }

  /**
   * Get hint for selected cell
   */
  function useHint(): void {
    if (!gameState.value || !gameState.value.selectedCell) return;

    const pos = gameState.value.selectedCell;
    const cell = gameState.value.cube[pos.z]?.[pos.y]?.[pos.x];
    if (!cell) return;

    if (cell.isGiven || cell.value === cell.solution) return;

    // Set the cell to solution value
    setCellValue(pos, cell.solution);
    gameState.value.stats.hints++;
  }

  /**
   * Toggle pencil mode
   */
  function togglePencilMode(): void {
    if (!gameState.value) return;
    gameState.value.isPencilMode = !gameState.value.isPencilMode;
  }

  // ============ Timer ============
  let timerInterval: number | null = null;

  function startTimer(): void {
    if (!gameState.value) return;

    gameState.value.timer.isPaused = false;
    gameState.value.timer.startedAt = Date.now();

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = window.setInterval(() => {
      if (gameState.value && !gameState.value.timer.isPaused) {
        gameState.value.timer.elapsed++;
      }
    }, 1000);
  }

  function pauseTimer(): void {
    if (!gameState.value) return;

    gameState.value.timer.isPaused = true;
    gameState.value.timer.pausedAt = Date.now();

    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function resumeTimer(): void {
    if (!gameState.value || !gameState.value.timer.isPaused) return;
    startTimer();
  }

  // ============ Persistence ============
  async function saveGame(): Promise<void> {
    if (!gameState.value) return;

    try {
      gameState.value.lastSavedAt = Date.now();
      // In a real implementation, save to IndexedDB
      localStorage.setItem(`zudoku_game_${gameState.value.id}`, JSON.stringify(gameState.value));
    } catch (e) {
      console.error('Failed to save game:', e);
    }
  }

  async function loadGame(id: string): Promise<boolean> {
    try {
      const saved = localStorage.getItem(`zudoku_game_${id}`);
      if (!saved) return false;

      const parsed = JSON.parse(saved) as GameState;

      // Reconstruct Sets from arrays
      for (let z = 0; z < 9; z++) {
        for (let y = 0; y < 9; y++) {
          for (let x = 0; x < 9; x++) {
            const cell = parsed.cube[z]?.[y]?.[x];
            if (cell) {
              cell.pencilMarks = new Set(cell.pencilMarks as any);
            }
          }
        }
      }

      gameState.value = parsed;

      // Rebuild validator
      validator.value = new CubeValidator();
      validator.value.initFromCube(parsed.cube);

      if (!parsed.isComplete && !parsed.timer.isPaused) {
        startTimer();
      }

      return true;
    } catch (e) {
      console.error('Failed to load game:', e);
      return false;
    }
  }

  // Cleanup on unmount
  function cleanup(): void {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // Reset game state (for returning to menu)
  function resetGame(): void {
    cleanup();
    gameState.value = null;
    validator.value = null;
    showHints.value = false;
  }

  return {
    // State
    gameState,
    isLoading,
    error,
    lastWrongAttempt,
    lastCellUpdate,

    // Computed
    cube,
    activePlane,
    viewRelativePlaneIndex,
    cameraOnPositiveSide,
    showHints,
    selectedCell,
    currentPlane,
    progress,
    isComplete,
    isGameOver,
    maxErrors,
    canUndo,
    canRedo,
    selectedCellExclusions,
    timer,
    stats,
    difficulty,

    // Actions
    newGame,
    startDailyChallenge,
    setCellValue,
    togglePencilMark,
    selectCell,
    setActivePlane,
    setCameraDirection,
    setPlaneByViewIndex,
    nextPlane,
    prevPlane,
    switchAxis,
    undo,
    redo,
    useHint,
    toggleHints,
    togglePencilMode,
    startTimer,
    pauseTimer,
    resumeTimer,
    saveGame,
    loadGame,
    cleanup,
    resetGame
  };
});
