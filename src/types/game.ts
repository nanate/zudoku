/**
 * Game state and history type definitions
 */

import type { CubeData, Position, PlaneRef, CellValue } from './cube';

/** Difficulty levels */
export type Difficulty = 'beginner' | 'easy' | 'medium' | 'hard' | 'expert';

/** Difficulty configuration */
export interface DifficultyConfig {
  /** Approximate number of given cells (out of 729) */
  givens: number;
  /** Minimum givens per plane to ensure playability */
  minPerPlane: number;
  /** Display name */
  name: string;
  /** Maximum allowed errors before game over */
  maxErrors: number;
  /** Description of the difficulty */
  description: string;
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  beginner: { givens: 480, minPerPlane: 45, name: 'Beginner', maxErrors: 10, description: 'Perfect for learning 3D Sudoku' },
  easy: { givens: 400, minPerPlane: 38, name: 'Easy', maxErrors: 7, description: 'A gentle challenge' },
  medium: { givens: 320, minPerPlane: 30, name: 'Medium', maxErrors: 5, description: 'For experienced players' },
  hard: { givens: 240, minPerPlane: 22, name: 'Hard', maxErrors: 3, description: 'Test your skills' },
  expert: { givens: 180, minPerPlane: 17, name: 'Expert', maxErrors: 1, description: 'One mistake and you\'re out!' }
};

/** Game timer state */
export interface TimerState {
  /** Total elapsed time in seconds */
  elapsed: number;
  /** Whether the timer is paused */
  isPaused: boolean;
  /** Timestamp when paused (for resume calculation) */
  pausedAt: number | null;
  /** Timestamp when started/resumed */
  startedAt: number | null;
}

/** Game statistics for current game */
export interface GameStats {
  /** Number of incorrect inputs */
  errors: number;
  /** Number of hints used */
  hints: number;
  /** Cells filled by player */
  cellsFilled: number;
  /** Total empty cells at start */
  totalEmpty: number;
}

/** Types of actions that can be undone/redone */
export type HistoryActionType =
  | 'setValue'
  | 'clearValue'
  | 'togglePencilMark'
  | 'clearPencilMarks'
  | 'hint';

/** A single history entry for undo/redo */
export interface HistoryEntry {
  /** When the action was performed */
  timestamp: number;
  /** Type of action */
  type: HistoryActionType;
  /** Cell position */
  position: Position;
  /** Value before the action */
  previousValue: CellValue;
  /** Value after the action */
  newValue: CellValue;
  /** Pencil marks before (if applicable) */
  previousPencilMarks?: number[];
  /** Pencil marks after (if applicable) */
  newPencilMarks?: number[];
}

/** Complete game state */
export interface GameState {
  /** Unique game ID */
  id: string;
  /** The puzzle cube data */
  cube: CubeData;
  /** Current difficulty */
  difficulty: Difficulty;
  /** Currently active/visible plane */
  activePlane: PlaneRef;
  /** Currently selected cell */
  selectedCell: Position | null;
  /** Timer state */
  timer: TimerState;
  /** Game statistics */
  stats: GameStats;
  /** Undo history stack */
  history: HistoryEntry[];
  /** Redo stack (cleared on new action) */
  redoStack: HistoryEntry[];
  /** Whether pencil/notes mode is active */
  isPencilMode: boolean;
  /** Whether the puzzle is complete */
  isComplete: boolean;
  /** When the game was created */
  createdAt: number;
  /** When last saved */
  lastSavedAt: number | null;
}

/** Player statistics (persisted across games) */
export interface PlayerStats {
  /** Total games played */
  gamesPlayed: number;
  /** Total games won */
  gamesWon: number;
  /** Best times per difficulty (in seconds) */
  bestTimes: Partial<Record<Difficulty, number>>;
  /** Average times per difficulty */
  averageTimes: Partial<Record<Difficulty, number>>;
  /** Current win streak */
  currentStreak: number;
  /** Longest win streak ever */
  longestStreak: number;
  /** Total time played (seconds) */
  totalTimePlayed: number;
  /** Games completed without errors */
  perfectGames: number;
  /** Daily challenges completed */
  dailyChallengesCompleted: number;
}

/** User settings/preferences */
export interface UserSettings {
  /** Highlight related cells on selection */
  highlightRelated: boolean;
  /** Show errors immediately */
  showErrors: boolean;
  /** Auto-remove pencil marks when value placed */
  autoRemovePencilMarks: boolean;
  /** Sound effects enabled */
  soundEnabled: boolean;
  /** Animation speed multiplier (0.5 = slow, 1 = normal, 2 = fast) */
  animationSpeed: number;
  /** Show timer during game */
  showTimer: boolean;
  /** Theme (for future) */
  theme: 'dark' | 'light';
  /** Completed onboarding */
  hasCompletedOnboarding: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  highlightRelated: true,
  showErrors: true,
  autoRemovePencilMarks: true,
  soundEnabled: true,
  animationSpeed: 1,
  showTimer: true,
  theme: 'dark',
  hasCompletedOnboarding: false
};

/** Create initial timer state */
export function createTimerState(): TimerState {
  return {
    elapsed: 0,
    isPaused: true,
    pausedAt: null,
    startedAt: null
  };
}

/** Create initial game stats */
export function createGameStats(totalEmpty: number): GameStats {
  return {
    errors: 0,
    hints: 0,
    cellsFilled: 0,
    totalEmpty
  };
}

/** Create initial player stats */
export function createPlayerStats(): PlayerStats {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    bestTimes: {},
    averageTimes: {},
    currentStreak: 0,
    longestStreak: 0,
    totalTimePlayed: 0,
    perfectGames: 0,
    dailyChallengesCompleted: 0
  };
}

/** Generate a unique game ID */
export function generateGameId(): string {
  return `game_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
