/**
 * Difficulty management and puzzle creation from solutions
 *
 * Creates playable puzzles by removing cells from complete solutions
 * while respecting difficulty constraints.
 */

import type { CubeData, CubeValues, CellValue, Position, PlaneRef } from '../types/cube';
import type { Difficulty } from '../types/game';
import { DIFFICULTY_CONFIGS } from '../types/game';
import { createEmptyCube, extractPlaneValues } from '../types/cube';

/** Seeded random for reproducible puzzle creation */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      const temp = result[i]!;
      result[i] = result[j]!;
      result[j] = temp;
    }
    return result;
  }
}

/**
 * Count how many cells are revealed (non-zero) in a plane
 */
function countPlaneGivens(values: CubeValues, plane: PlaneRef): number {
  const planeValues = extractPlaneValues(values, plane);
  let count = 0;
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (planeValues[row]![col] !== 0) count++;
    }
  }
  return count;
}

/**
 * Check if removing a cell would violate minimum givens constraint for any plane
 */
function canRemoveCell(
  puzzle: CubeValues,
  pos: Position,
  minPerPlane: number
): boolean {
  // Check XY plane at z
  const xyCount = countPlaneGivens(puzzle, { axis: 'XY', index: pos.z });
  if (xyCount <= minPerPlane) return false;

  // Check XZ plane at y
  const xzCount = countPlaneGivens(puzzle, { axis: 'XZ', index: pos.y });
  if (xzCount <= minPerPlane) return false;

  // Check YZ plane at x
  const yzCount = countPlaneGivens(puzzle, { axis: 'YZ', index: pos.x });
  if (yzCount <= minPerPlane) return false;

  return true;
}

/**
 * Create a puzzle by removing cells from a solution
 */
export function createPuzzle(
  solution: CubeValues,
  difficulty: Difficulty,
  seed?: number
): CubeData {
  const config = DIFFICULTY_CONFIGS[difficulty];
  const rng = new SeededRandom(seed ?? Date.now());

  // Create initial puzzle as copy of solution
  const puzzle: CubeValues = solution.map(layer =>
    layer.map(row => [...row])
  );

  // Count total cells and target to remove
  const totalCells = 729;
  const targetGivens = config.givens;
  const cellsToRemove = totalCells - targetGivens;

  // Get all cell positions and shuffle
  const allPositions: Position[] = [];
  for (let z = 0; z < 9; z++) {
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        allPositions.push({ x, y, z });
      }
    }
  }
  const shuffledPositions = rng.shuffle(allPositions);

  // Remove cells while respecting constraints
  let removed = 0;
  for (const pos of shuffledPositions) {
    if (removed >= cellsToRemove) break;

    // Skip already empty cells
    if (puzzle[pos.z]![pos.y]![pos.x] === 0) continue;

    // Check if we can remove this cell
    if (canRemoveCell(puzzle, pos, config.minPerPlane)) {
      puzzle[pos.z]![pos.y]![pos.x] = 0;
      removed++;
    }
  }

  // Convert to CubeData with full Cell objects
  const cubeData = createEmptyCube();

  for (let z = 0; z < 9; z++) {
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const value = puzzle[z]![y]![x]!;
        const solutionValue = solution[z]![y]![x]!;

        cubeData[z]![y]![x] = {
          value: value,
          solution: solutionValue,
          isGiven: value !== 0,
          pencilMarks: new Set(),
          isError: false
        };
      }
    }
  }

  return cubeData;
}

/**
 * Count empty cells in a puzzle
 */
export function countEmptyCells(cube: CubeData): number {
  let count = 0;
  for (let z = 0; z < 9; z++) {
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        if (cube[z]![y]![x]!.value === 0) count++;
      }
    }
  }
  return count;
}

/**
 * Check if puzzle is complete (all cells filled correctly)
 */
export function isPuzzleComplete(cube: CubeData): boolean {
  for (let z = 0; z < 9; z++) {
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const cell = cube[z]![y]![x]!;
        if (cell.value !== cell.solution) return false;
      }
    }
  }
  return true;
}

/**
 * Check if puzzle is filled (no empty cells, may have errors)
 */
export function isPuzzleFilled(cube: CubeData): boolean {
  for (let z = 0; z < 9; z++) {
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        if (cube[z]![y]![x]!.value === 0) return false;
      }
    }
  }
  return true;
}

/**
 * Get a hint for a specific cell (returns the solution value)
 */
export function getHint(cube: CubeData, pos: Position): CellValue {
  return cube[pos.z]![pos.y]![pos.x]!.solution;
}

/**
 * Get the first empty cell that can be hinted
 */
export function getNextHintCell(cube: CubeData): Position | null {
  for (let z = 0; z < 9; z++) {
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const cell = cube[z]![y]![x]!;
        if (cell.value === 0) {
          return { x, y, z };
        }
      }
    }
  }
  return null;
}
