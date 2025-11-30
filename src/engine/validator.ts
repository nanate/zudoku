/**
 * O(1) Cube Validator using Bitmasks
 *
 * Maintains bitmasks for instant validation of cell placements.
 * Each bitmask tracks which digits 1-9 are present in a constraint unit
 * (row, column, or 3×3 block within any of the 27 planes).
 *
 * Bit layout: bit N (1-9) is set if digit N is present
 * Example: 0b0000000110 means digits 1 and 2 are present
 */

import type { CellValue, CubeData, Position, PlaneRef, Axis } from '../types/cube';
import { getBlockStart } from '../types/cube';

/** Conflict information for a cell */
export interface ConflictInfo {
  position: Position;
  conflictingCells: Position[];
  affectedPlanes: PlaneRef[];
}

/** Information about what blocks a specific value */
export interface BlockerInfo {
  position: Position;
  constraint: 'XY-row' | 'XY-col' | 'XY-block' | 'XZ-row' | 'XZ-col' | 'XZ-block' | 'YZ-row' | 'YZ-col' | 'YZ-block';
  plane: PlaneRef;
  description: string;
}

/** Detailed exclusion info for a cell */
export interface ExclusionInfo {
  candidates: Set<CellValue>;
  blockedBy: Map<CellValue, BlockerInfo[]>;
}

/**
 * High-performance cube validator using bitmasks
 */
export class CubeValidator {
  // Bitmasks for XY planes (9 planes × 9 rows × 9 cols × 9 blocks)
  // Index calculation: plane * 27 + unit_type * 9 + unit_index
  // unit_type: 0 = row, 1 = col, 2 = block
  private xyMasks: Uint16Array; // 9 * 27 = 243

  // Bitmasks for XZ planes
  private xzMasks: Uint16Array; // 9 * 27 = 243

  // Bitmasks for YZ planes
  private yzMasks: Uint16Array; // 9 * 27 = 243

  constructor() {
    this.xyMasks = new Uint16Array(243);
    this.xzMasks = new Uint16Array(243);
    this.yzMasks = new Uint16Array(243);
  }

  /**
   * Initialize validator from a cube state
   */
  initFromCube(cube: CubeData): void {
    // Reset all masks
    this.xyMasks.fill(0);
    this.xzMasks.fill(0);
    this.yzMasks.fill(0);

    // Scan cube and set bits
    for (let z = 0; z < 9; z++) {
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          const value = cube[z]![y]![x]!.value;
          if (value !== 0) {
            this.addValue(x, y, z, value);
          }
        }
      }
    }
  }

  /**
   * Check if placing a value at position is valid
   * O(1) time complexity
   */
  isValidPlacement(x: number, y: number, z: number, value: CellValue): boolean {
    if (value === 0) return true;

    const bit = 1 << value;

    // Check XY plane (at layer z)
    const xyRow = this.xyMasks[z * 27 + 0 * 9 + y]!;
    const xyCol = this.xyMasks[z * 27 + 1 * 9 + x]!;
    const xyBlock = this.xyMasks[z * 27 + 2 * 9 + this.getBlockIndex(y, x)]!;
    if ((xyRow | xyCol | xyBlock) & bit) return false;

    // Check XZ plane (at slice y)
    const xzRow = this.xzMasks[y * 27 + 0 * 9 + z]!;
    const xzCol = this.xzMasks[y * 27 + 1 * 9 + x]!;
    const xzBlock = this.xzMasks[y * 27 + 2 * 9 + this.getBlockIndex(z, x)]!;
    if ((xzRow | xzCol | xzBlock) & bit) return false;

    // Check YZ plane (at slice x)
    const yzRow = this.yzMasks[x * 27 + 0 * 9 + z]!;
    const yzCol = this.yzMasks[x * 27 + 1 * 9 + y]!;
    const yzBlock = this.yzMasks[x * 27 + 2 * 9 + this.getBlockIndex(z, y)]!;
    if ((yzRow | yzCol | yzBlock) & bit) return false;

    return true;
  }

  /**
   * Update masks when a cell value changes
   * O(1) time complexity
   */
  updateCell(x: number, y: number, z: number, oldValue: CellValue, newValue: CellValue): void {
    if (oldValue !== 0) {
      this.removeValue(x, y, z, oldValue);
    }
    if (newValue !== 0) {
      this.addValue(x, y, z, newValue);
    }
  }

  /**
   * Get all cells that conflict with placing a value at position
   */
  getConflicts(x: number, y: number, z: number, value: CellValue, cube: CubeData): Position[] {
    if (value === 0) return [];

    const conflicts: Position[] = [];
    const seen = new Set<string>();

    const addConflict = (cx: number, cy: number, cz: number) => {
      const key = `${cx},${cy},${cz}`;
      if (!seen.has(key) && cube[cz]![cy]![cx]!.value === value) {
        seen.add(key);
        conflicts.push({ x: cx, y: cy, z: cz });
      }
    };

    // XY plane conflicts
    for (let i = 0; i < 9; i++) {
      if (i !== x) addConflict(i, y, z); // Row
      if (i !== y) addConflict(x, i, z); // Column
    }
    const xyBlock = getBlockStart(y, x);
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const cx = xyBlock.col + dx;
        const cy = xyBlock.row + dy;
        if (cx !== x || cy !== y) addConflict(cx, cy, z);
      }
    }

    // XZ plane conflicts
    for (let i = 0; i < 9; i++) {
      if (i !== z) addConflict(x, y, i); // Z-column (row in XZ)
    }
    const xzBlock = getBlockStart(z, x);
    for (let dz = 0; dz < 3; dz++) {
      for (let dx = 0; dx < 3; dx++) {
        const cx = xzBlock.col + dx;
        const cz = xzBlock.row + dz;
        if (cx !== x || cz !== z) addConflict(cx, y, cz);
      }
    }

    // YZ plane conflicts
    const yzBlock = getBlockStart(z, y);
    for (let dz = 0; dz < 3; dz++) {
      for (let dy = 0; dy < 3; dy++) {
        const cy = yzBlock.col + dy;
        const cz = yzBlock.row + dz;
        if (cy !== y || cz !== z) addConflict(x, cy, cz);
      }
    }

    return conflicts;
  }

  /**
   * Get all current conflicts in the cube
   */
  getAllConflicts(cube: CubeData): Map<string, ConflictInfo> {
    const conflicts = new Map<string, ConflictInfo>();

    for (let z = 0; z < 9; z++) {
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          const cell = cube[z]![y]![x]!;
          if (cell.value !== 0 && !cell.isGiven) {
            const cellConflicts = this.getConflicts(x, y, z, cell.value, cube);
            if (cellConflicts.length > 0) {
              const key = `${x},${y},${z}`;
              conflicts.set(key, {
                position: { x, y, z },
                conflictingCells: cellConflicts,
                affectedPlanes: this.getAffectedPlanes(x, y, z)
              });
            }
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Get candidates (valid values) for a cell
   */
  getCandidates(x: number, y: number, z: number): Set<CellValue> {
    const candidates = new Set<CellValue>();

    for (let v = 1; v <= 9; v++) {
      if (this.isValidPlacement(x, y, z, v as CellValue)) {
        candidates.add(v as CellValue);
      }
    }

    return candidates;
  }

  /**
   * Get detailed exclusion info for a cell - which values are blocked and by what constraint
   */
  getExclusions(x: number, y: number, z: number, cube: CubeData): ExclusionInfo {
    const exclusions: ExclusionInfo = {
      candidates: new Set(),
      blockedBy: new Map()
    };

    for (let v = 1; v <= 9; v++) {
      const value = v as CellValue;
      const blockers = this.getBlockersForValue(x, y, z, value, cube);

      if (blockers.length === 0) {
        exclusions.candidates.add(value);
      } else {
        exclusions.blockedBy.set(value, blockers);
      }
    }

    return exclusions;
  }

  /**
   * Get all cells that block a specific value at a position
   */
  private getBlockersForValue(x: number, y: number, z: number, value: CellValue, cube: CubeData): BlockerInfo[] {
    const blockers: BlockerInfo[] = [];
    const bit = 1 << value;

    // Check XY plane constraints (at layer z)
    const xyRow = this.xyMasks[z * 27 + 0 * 9 + y]!;
    if (xyRow & bit) {
      // Find the cell in this row that has the value
      for (let cx = 0; cx < 9; cx++) {
        if (cube[z]![y]![cx]!.value === value) {
          blockers.push({
            position: { x: cx, y, z },
            constraint: 'XY-row',
            plane: { axis: 'XY', index: z },
            description: `Row ${y + 1} in XY plane ${z + 1}`
          });
          break;
        }
      }
    }

    const xyCol = this.xyMasks[z * 27 + 1 * 9 + x]!;
    if (xyCol & bit) {
      for (let cy = 0; cy < 9; cy++) {
        if (cube[z]![cy]![x]!.value === value) {
          blockers.push({
            position: { x, y: cy, z },
            constraint: 'XY-col',
            plane: { axis: 'XY', index: z },
            description: `Column ${x + 1} in XY plane ${z + 1}`
          });
          break;
        }
      }
    }

    const xyBlockIdx = this.getBlockIndex(y, x);
    const xyBlock = this.xyMasks[z * 27 + 2 * 9 + xyBlockIdx]!;
    if (xyBlock & bit) {
      const blockStart = getBlockStart(y, x);
      outer: for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          const cy = blockStart.row + dy;
          const cx = blockStart.col + dx;
          if (cube[z]![cy]![cx]!.value === value) {
            blockers.push({
              position: { x: cx, y: cy, z },
              constraint: 'XY-block',
              plane: { axis: 'XY', index: z },
              description: `Block in XY plane ${z + 1}`
            });
            break outer;
          }
        }
      }
    }

    // Check XZ plane constraints (at slice y)
    const xzRow = this.xzMasks[y * 27 + 0 * 9 + z]!;
    if (xzRow & bit) {
      for (let cx = 0; cx < 9; cx++) {
        if (cube[z]![y]![cx]!.value === value) {
          // Already found in XY, skip duplicate
          if (!blockers.some(b => b.constraint.startsWith('XY') && b.position.x === cx && b.position.y === y && b.position.z === z)) {
            blockers.push({
              position: { x: cx, y, z },
              constraint: 'XZ-row',
              plane: { axis: 'XZ', index: y },
              description: `Row ${z + 1} in XZ plane ${y + 1}`
            });
          }
          break;
        }
      }
    }

    const xzCol = this.xzMasks[y * 27 + 1 * 9 + x]!;
    if (xzCol & bit) {
      for (let cz = 0; cz < 9; cz++) {
        if (cube[cz]![y]![x]!.value === value) {
          blockers.push({
            position: { x, y, z: cz },
            constraint: 'XZ-col',
            plane: { axis: 'XZ', index: y },
            description: `Column ${x + 1} in XZ plane ${y + 1}`
          });
          break;
        }
      }
    }

    const xzBlockIdx = this.getBlockIndex(z, x);
    const xzBlock = this.xzMasks[y * 27 + 2 * 9 + xzBlockIdx]!;
    if (xzBlock & bit) {
      const blockStart = getBlockStart(z, x);
      outer: for (let dz = 0; dz < 3; dz++) {
        for (let dx = 0; dx < 3; dx++) {
          const cz = blockStart.row + dz;
          const cx = blockStart.col + dx;
          if (cube[cz]![y]![cx]!.value === value) {
            blockers.push({
              position: { x: cx, y, z: cz },
              constraint: 'XZ-block',
              plane: { axis: 'XZ', index: y },
              description: `Block in XZ plane ${y + 1}`
            });
            break outer;
          }
        }
      }
    }

    // Check YZ plane constraints (at slice x)
    const yzRow = this.yzMasks[x * 27 + 0 * 9 + z]!;
    if (yzRow & bit) {
      for (let cy = 0; cy < 9; cy++) {
        if (cube[z]![cy]![x]!.value === value) {
          if (!blockers.some(b => b.position.x === x && b.position.y === cy && b.position.z === z)) {
            blockers.push({
              position: { x, y: cy, z },
              constraint: 'YZ-row',
              plane: { axis: 'YZ', index: x },
              description: `Row ${z + 1} in YZ plane ${x + 1}`
            });
          }
          break;
        }
      }
    }

    const yzCol = this.yzMasks[x * 27 + 1 * 9 + y]!;
    if (yzCol & bit) {
      for (let cz = 0; cz < 9; cz++) {
        if (cube[cz]![y]![x]!.value === value) {
          if (!blockers.some(b => b.position.x === x && b.position.y === y && b.position.z === cz)) {
            blockers.push({
              position: { x, y, z: cz },
              constraint: 'YZ-col',
              plane: { axis: 'YZ', index: x },
              description: `Column ${y + 1} in YZ plane ${x + 1}`
            });
          }
          break;
        }
      }
    }

    const yzBlockIdx = this.getBlockIndex(z, y);
    const yzBlock = this.yzMasks[x * 27 + 2 * 9 + yzBlockIdx]!;
    if (yzBlock & bit) {
      const blockStart = getBlockStart(z, y);
      outer: for (let dz = 0; dz < 3; dz++) {
        for (let dy = 0; dy < 3; dy++) {
          const cz = blockStart.row + dz;
          const cy = blockStart.col + dy;
          if (cube[cz]![cy]![x]!.value === value) {
            blockers.push({
              position: { x, y: cy, z: cz },
              constraint: 'YZ-block',
              plane: { axis: 'YZ', index: x },
              description: `Block in YZ plane ${x + 1}`
            });
            break outer;
          }
        }
      }
    }

    // Remove duplicates (same position can block via multiple constraints)
    const uniqueBlockers: BlockerInfo[] = [];
    const seen = new Set<string>();
    for (const blocker of blockers) {
      const key = `${blocker.position.x},${blocker.position.y},${blocker.position.z}-${blocker.constraint}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueBlockers.push(blocker);
      }
    }

    return uniqueBlockers;
  }

  /**
   * Get the planes that a cell belongs to
   */
  private getAffectedPlanes(x: number, y: number, z: number): PlaneRef[] {
    return [
      { axis: 'XY' as Axis, index: z },
      { axis: 'XZ' as Axis, index: y },
      { axis: 'YZ' as Axis, index: x }
    ];
  }

  /**
   * Add a value to all relevant masks
   */
  private addValue(x: number, y: number, z: number, value: CellValue): void {
    const bit = 1 << value;

    // XY plane
    this.xyMasks[z * 27 + 0 * 9 + y] = (this.xyMasks[z * 27 + 0 * 9 + y]! | bit); // Row
    this.xyMasks[z * 27 + 1 * 9 + x] = (this.xyMasks[z * 27 + 1 * 9 + x]! | bit); // Column
    this.xyMasks[z * 27 + 2 * 9 + this.getBlockIndex(y, x)] = (this.xyMasks[z * 27 + 2 * 9 + this.getBlockIndex(y, x)]! | bit); // Block

    // XZ plane
    this.xzMasks[y * 27 + 0 * 9 + z] = (this.xzMasks[y * 27 + 0 * 9 + z]! | bit); // Row (z)
    this.xzMasks[y * 27 + 1 * 9 + x] = (this.xzMasks[y * 27 + 1 * 9 + x]! | bit); // Column (x)
    this.xzMasks[y * 27 + 2 * 9 + this.getBlockIndex(z, x)] = (this.xzMasks[y * 27 + 2 * 9 + this.getBlockIndex(z, x)]! | bit); // Block

    // YZ plane
    this.yzMasks[x * 27 + 0 * 9 + z] = (this.yzMasks[x * 27 + 0 * 9 + z]! | bit); // Row (z)
    this.yzMasks[x * 27 + 1 * 9 + y] = (this.yzMasks[x * 27 + 1 * 9 + y]! | bit); // Column (y)
    this.yzMasks[x * 27 + 2 * 9 + this.getBlockIndex(z, y)] = (this.yzMasks[x * 27 + 2 * 9 + this.getBlockIndex(z, y)]! | bit); // Block
  }

  /**
   * Remove a value from all relevant masks
   */
  private removeValue(x: number, y: number, z: number, value: CellValue): void {
    const bit = ~(1 << value);

    // XY plane
    this.xyMasks[z * 27 + 0 * 9 + y] = (this.xyMasks[z * 27 + 0 * 9 + y]! & bit);
    this.xyMasks[z * 27 + 1 * 9 + x] = (this.xyMasks[z * 27 + 1 * 9 + x]! & bit);
    this.xyMasks[z * 27 + 2 * 9 + this.getBlockIndex(y, x)] = (this.xyMasks[z * 27 + 2 * 9 + this.getBlockIndex(y, x)]! & bit);

    // XZ plane
    this.xzMasks[y * 27 + 0 * 9 + z] = (this.xzMasks[y * 27 + 0 * 9 + z]! & bit);
    this.xzMasks[y * 27 + 1 * 9 + x] = (this.xzMasks[y * 27 + 1 * 9 + x]! & bit);
    this.xzMasks[y * 27 + 2 * 9 + this.getBlockIndex(z, x)] = (this.xzMasks[y * 27 + 2 * 9 + this.getBlockIndex(z, x)]! & bit);

    // YZ plane
    this.yzMasks[x * 27 + 0 * 9 + z] = (this.yzMasks[x * 27 + 0 * 9 + z]! & bit);
    this.yzMasks[x * 27 + 1 * 9 + y] = (this.yzMasks[x * 27 + 1 * 9 + y]! & bit);
    this.yzMasks[x * 27 + 2 * 9 + this.getBlockIndex(z, y)] = (this.yzMasks[x * 27 + 2 * 9 + this.getBlockIndex(z, y)]! & bit);
  }

  /**
   * Get the 3×3 block index (0-8) from row and column
   */
  private getBlockIndex(row: number, col: number): number {
    return Math.floor(row / 3) * 3 + Math.floor(col / 3);
  }
}

/**
 * Validate an entire plane as a valid Sudoku
 */
export function validatePlane(values: CellValue[][]): boolean {
  // Check rows
  for (let row = 0; row < 9; row++) {
    const seen = new Set<CellValue>();
    for (let col = 0; col < 9; col++) {
      const v = values[row]![col]!;
      if (v !== 0) {
        if (seen.has(v)) return false;
        seen.add(v);
      }
    }
  }

  // Check columns
  for (let col = 0; col < 9; col++) {
    const seen = new Set<CellValue>();
    for (let row = 0; row < 9; row++) {
      const v = values[row]![col]!;
      if (v !== 0) {
        if (seen.has(v)) return false;
        seen.add(v);
      }
    }
  }

  // Check 3×3 blocks
  for (let blockRow = 0; blockRow < 3; blockRow++) {
    for (let blockCol = 0; blockCol < 3; blockCol++) {
      const seen = new Set<CellValue>();
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          const v = values[blockRow * 3 + dy]![blockCol * 3 + dx]!;
          if (v !== 0) {
            if (seen.has(v)) return false;
            seen.add(v);
          }
        }
      }
    }
  }

  return true;
}
