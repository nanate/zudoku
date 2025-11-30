/**
 * 3D Sudoku Cube Generator - FAST ALGEBRAIC APPROACH
 *
 * Generates a valid 9×9×9 cube where ALL 27 planes (9 XY + 9 XZ + 9 YZ)
 * are valid Sudoku puzzles.
 *
 * ALGORITHM: Algebraic Seed + Permutation Method
 *
 * Phase 1: Direct Construction - O(729)
 *   Compute each cell value directly from an algebraic formula
 *   based on a precomputed 3×3×3 seed that tiles correctly.
 *
 * Phase 2: Randomization - O(729)
 *   Apply validity-preserving transformations:
 *   - Digit relabeling (permute 1-9)
 *   - Row/column swaps within bands
 *   - Band permutations
 *
 * Total: < 10ms generation time (vs seconds with backtracking)
 */

import type { CellValue, CubeValues } from '../types/cube';
import { createEmptyValues } from '../types/cube';

/** Seeded random number generator for reproducible puzzles */
class SeededRandom {
  private seed: number;

  constructor(seed: number | string) {
    if (typeof seed === 'string') {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
      }
      this.seed = Math.abs(hash) || 1;
    } else {
      this.seed = seed || 1;
    }
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
 * Compute cell value using Z₃ × Z₃ algebraic formula
 *
 * This formula is mathematically proven to satisfy ALL 486 constraints:
 * - 243 line constraints (81 X-lines + 81 Y-lines + 81 Z-lines)
 * - 243 block constraints (81 XY-blocks + 81 XZ-blocks + 81 YZ-blocks)
 *
 * The formula maps each (x,y,z) to an element of Z₃ × Z₃, giving 9 unique values.
 */
function computeCell(x: number, y: number, z: number): number {
  // Block coordinates (which 3×3×3 block we're in)
  const bx = Math.floor(x / 3);
  const by = Math.floor(y / 3);
  const bz = Math.floor(z / 3);

  // Position within the 3×3×3 block (0-2)
  const px = x % 3;
  const py = y % 3;
  const pz = z % 3;

  // Z₃ × Z₃ algebraic formula
  // i determines which "row" in output (values 1-3, 4-6, or 7-9)
  // j determines position within that row
  const i = (px + py + pz) % 3;
  const j = (bx + by + bz + py + 2 * pz) % 3;

  return i * 3 + j + 1;  // Returns 1-9
}

/**
 * Generate the base cube using algebraic construction
 */
function generateBaseCube(): CubeValues {
  const cube = createEmptyValues();

  for (let z = 0; z < 9; z++) {
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        cube[z]![y]![x] = computeCell(x, y, z) as CellValue;
      }
    }
  }

  return cube;
}

/**
 * Swap rows within a band for a specific z-plane
 */
function swapRowsInBand(cube: CubeValues, z: number, band: number, perm: number[]): void {
  const baseRow = band * 3;
  const rows = [
    cube[z]![baseRow]!,
    cube[z]![baseRow + 1]!,
    cube[z]![baseRow + 2]!
  ];

  cube[z]![baseRow] = rows[perm[0]!]!;
  cube[z]![baseRow + 1] = rows[perm[1]!]!;
  cube[z]![baseRow + 2] = rows[perm[2]!]!;
}

/**
 * Swap columns within a band for a specific z-plane
 */
function swapColsInBand(cube: CubeValues, z: number, band: number, perm: number[]): void {
  const baseCol = band * 3;
  const cols = [baseCol, baseCol + 1, baseCol + 2];

  for (let y = 0; y < 9; y++) {
    const temp = [
      cube[z]![y]![cols[0]!]!,
      cube[z]![y]![cols[1]!]!,
      cube[z]![y]![cols[2]!]!
    ];
    cube[z]![y]![cols[0]!] = temp[perm[0]!]!;
    cube[z]![y]![cols[1]!] = temp[perm[1]!]!;
    cube[z]![y]![cols[2]!] = temp[perm[2]!]!;
  }
}

/**
 * Swap entire row bands (groups of 3 rows)
 */
function swapRowBands(cube: CubeValues, perm: number[]): void {
  for (let z = 0; z < 9; z++) {
    const bands = [
      [cube[z]![0]!, cube[z]![1]!, cube[z]![2]!],
      [cube[z]![3]!, cube[z]![4]!, cube[z]![5]!],
      [cube[z]![6]!, cube[z]![7]!, cube[z]![8]!]
    ];

    for (let i = 0; i < 3; i++) {
      const srcBand = perm[i]!;
      cube[z]![i * 3] = bands[srcBand]![0]!;
      cube[z]![i * 3 + 1] = bands[srcBand]![1]!;
      cube[z]![i * 3 + 2] = bands[srcBand]![2]!;
    }
  }
}

/**
 * Swap entire column bands (groups of 3 columns)
 */
function swapColBands(cube: CubeValues, perm: number[]): void {
  for (let z = 0; z < 9; z++) {
    for (let y = 0; y < 9; y++) {
      const bands = [
        [cube[z]![y]![0]!, cube[z]![y]![1]!, cube[z]![y]![2]!],
        [cube[z]![y]![3]!, cube[z]![y]![4]!, cube[z]![y]![5]!],
        [cube[z]![y]![6]!, cube[z]![y]![7]!, cube[z]![y]![8]!]
      ];

      for (let i = 0; i < 3; i++) {
        const srcBand = perm[i]!;
        cube[z]![y]![i * 3] = bands[srcBand]![0]!;
        cube[z]![y]![i * 3 + 1] = bands[srcBand]![1]!;
        cube[z]![y]![i * 3 + 2] = bands[srcBand]![2]!;
      }
    }
  }
}

/**
 * Swap z-layers within a band
 */
function swapZLayersInBand(cube: CubeValues, band: number, perm: number[]): void {
  const baseZ = band * 3;
  const layers = [
    cube[baseZ]!.map(row => [...row]),
    cube[baseZ + 1]!.map(row => [...row]),
    cube[baseZ + 2]!.map(row => [...row])
  ];

  for (let i = 0; i < 3; i++) {
    const srcLayer = perm[i]!;
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        cube[baseZ + i]![y]![x] = layers[srcLayer]![y]![x]!;
      }
    }
  }
}

/**
 * Swap entire z-bands (groups of 3 z-layers)
 */
function swapZBands(cube: CubeValues, perm: number[]): void {
  const bands = [
    [0, 1, 2].map(z => cube[z]!.map(row => [...row])),
    [3, 4, 5].map(z => cube[z]!.map(row => [...row])),
    [6, 7, 8].map(z => cube[z]!.map(row => [...row]))
  ];

  for (let bandIdx = 0; bandIdx < 3; bandIdx++) {
    const srcBand = perm[bandIdx]!;
    for (let i = 0; i < 3; i++) {
      const z = bandIdx * 3 + i;
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          cube[z]![y]![x] = bands[srcBand]![i]![y]![x]!;
        }
      }
    }
  }
}

/**
 * Apply randomization transforms to the cube
 *
 * CRITICAL: To preserve 3D validity, transformations must be applied
 * CONSISTENTLY across all z-planes. The old code applied different
 * permutations per z-plane, which broke XZ and YZ plane constraints.
 */
function applyRandomTransformations(cube: CubeValues, rng: SeededRandom): void {
  // 1. Digit relabeling (9! possibilities) - ALWAYS SAFE
  const digitMap = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (let z = 0; z < 9; z++) {
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const oldVal = cube[z]![y]![x]!;
        cube[z]![y]![x] = digitMap[oldVal - 1]! as CellValue;
      }
    }
  }

  // 2. Permute rows within bands - SAME permutation for ALL z-planes
  for (let band = 0; band < 3; band++) {
    const perm = rng.shuffle([0, 1, 2]);
    for (let z = 0; z < 9; z++) {
      swapRowsInBand(cube, z, band, perm);
    }
  }

  // 3. Permute columns within bands - SAME permutation for ALL z-planes
  for (let band = 0; band < 3; band++) {
    const perm = rng.shuffle([0, 1, 2]);
    for (let z = 0; z < 9; z++) {
      swapColsInBand(cube, z, band, perm);
    }
  }

  // 4. Permute entire row bands (groups of 3 rows)
  const rowBandPerm = rng.shuffle([0, 1, 2]);
  swapRowBands(cube, rowBandPerm);

  // 5. Permute entire column bands (groups of 3 columns)
  const colBandPerm = rng.shuffle([0, 1, 2]);
  swapColBands(cube, colBandPerm);

  // 6. Permute z-layers within bands
  for (let band = 0; band < 3; band++) {
    const perm = rng.shuffle([0, 1, 2]);
    swapZLayersInBand(cube, band, perm);
  }

  // 7. Permute entire z-bands
  const zBandPerm = rng.shuffle([0, 1, 2]);
  swapZBands(cube, zBandPerm);
}

/**
 * Verify that a cube is a valid 3D Sudoku
 */
export function verifyCube(cube: CubeValues): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check all XY planes (9 planes, each at fixed z)
  for (let z = 0; z < 9; z++) {
    // Check rows
    for (let y = 0; y < 9; y++) {
      const seen = new Set<number>();
      for (let x = 0; x < 9; x++) {
        const v = cube[z]![y]![x]!;
        if (v < 1 || v > 9) {
          errors.push(`Invalid value ${v} at (${x},${y},${z})`);
        } else if (seen.has(v)) {
          errors.push(`Duplicate ${v} in XY row y=${y}, z=${z}`);
        }
        seen.add(v);
      }
    }
    // Check columns
    for (let x = 0; x < 9; x++) {
      const seen = new Set<number>();
      for (let y = 0; y < 9; y++) {
        const v = cube[z]![y]![x]!;
        if (seen.has(v)) {
          errors.push(`Duplicate ${v} in XY col x=${x}, z=${z}`);
        }
        seen.add(v);
      }
    }
    // Check 3x3 blocks
    for (let by = 0; by < 3; by++) {
      for (let bx = 0; bx < 3; bx++) {
        const seen = new Set<number>();
        for (let dy = 0; dy < 3; dy++) {
          for (let dx = 0; dx < 3; dx++) {
            const v = cube[z]![by * 3 + dy]![bx * 3 + dx]!;
            if (seen.has(v)) {
              errors.push(`Duplicate ${v} in XY block (${bx},${by}), z=${z}`);
            }
            seen.add(v);
          }
        }
      }
    }
  }

  // Check all XZ planes (9 planes, each at fixed y)
  for (let y = 0; y < 9; y++) {
    // Check rows (x direction) - already covered by XY rows
    // Check columns (z direction)
    for (let x = 0; x < 9; x++) {
      const seen = new Set<number>();
      for (let z = 0; z < 9; z++) {
        const v = cube[z]![y]![x]!;
        if (seen.has(v)) {
          errors.push(`Duplicate ${v} in XZ col x=${x}, y=${y}`);
        }
        seen.add(v);
      }
    }
    // Check 3x3 blocks
    for (let bz = 0; bz < 3; bz++) {
      for (let bx = 0; bx < 3; bx++) {
        const seen = new Set<number>();
        for (let dz = 0; dz < 3; dz++) {
          for (let dx = 0; dx < 3; dx++) {
            const v = cube[bz * 3 + dz]![y]![bx * 3 + dx]!;
            if (seen.has(v)) {
              errors.push(`Duplicate ${v} in XZ block (${bx},${bz}), y=${y}`);
            }
            seen.add(v);
          }
        }
      }
    }
  }

  // Check all YZ planes (9 planes, each at fixed x)
  for (let x = 0; x < 9; x++) {
    // Check rows (y direction) - already covered by XY cols
    // Check columns (z direction) - already covered by XZ cols
    // Check 3x3 blocks
    for (let bz = 0; bz < 3; bz++) {
      for (let by = 0; by < 3; by++) {
        const seen = new Set<number>();
        for (let dz = 0; dz < 3; dz++) {
          for (let dy = 0; dy < 3; dy++) {
            const v = cube[bz * 3 + dz]![by * 3 + dy]![x]!;
            if (seen.has(v)) {
              errors.push(`Duplicate ${v} in YZ block (${by},${bz}), x=${x}`);
            }
            seen.add(v);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Main cube generator class
 */
export class CubeGenerator {
  private rng: SeededRandom;

  constructor(seed?: number | string) {
    this.rng = new SeededRandom(seed ?? Date.now());
  }

  /**
   * Generate a complete valid cube solution
   * Uses fast algebraic construction + randomization
   */
  generate(): CubeValues {
    // Phase 1: Generate base cube algebraically (O(729))
    const cube = generateBaseCube();

    // Phase 2: Apply random transformations (O(729))
    applyRandomTransformations(cube, this.rng);

    // Verify (for debugging - can be removed in production)
    const verification = verifyCube(cube);
    if (!verification.valid) {
      console.error('Generation produced invalid cube:', verification.errors.slice(0, 5));
    }

    return cube;
  }
}

/**
 * Generate a complete cube solution with optional seed
 */
export function generateSolution(seed?: number | string): CubeValues {
  const generator = new CubeGenerator(seed);
  return generator.generate();
}

/**
 * Generate a daily puzzle seed based on date
 */
export function getDailySeed(date?: Date): string {
  const d = date ?? new Date();
  return `daily_${d.getFullYear()}_${d.getMonth() + 1}_${d.getDate()}`;
}
