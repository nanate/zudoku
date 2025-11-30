/**
 * Core type definitions for the 3D Sudoku cube
 */

/** Valid cell values: 0 = empty, 1-9 = filled */
export type CellValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** The three axes/orientations for viewing planes */
export type Axis = 'XY' | 'XZ' | 'YZ';

/** 3D position within the cube */
export interface Position {
  x: number; // 0-8 (column in XY view)
  y: number; // 0-8 (row in XY view)
  z: number; // 0-8 (depth/layer)
}

/** Individual cell state */
export interface Cell {
  /** Current value (0 = empty) */
  value: CellValue;
  /** The correct solution value */
  solution: CellValue;
  /** Whether this is a pre-filled clue (immutable) */
  isGiven: boolean;
  /** Pencil marks / candidate notes */
  pencilMarks: Set<number>;
  /** Whether this cell currently has a conflict */
  isError: boolean;
}

/**
 * The complete cube state as a 3D array
 * Indexed as cube[z][y][x] for intuitive layer-first access
 */
export type CubeData = Cell[][][];

/**
 * Raw values only (for generation/validation)
 * Indexed as values[z][y][x]
 */
export type CubeValues = CellValue[][][];

/** Reference to a specific plane/slice */
export interface PlaneRef {
  axis: Axis;
  index: number; // 0-8
}

/** A 9x9 plane extracted from the cube */
export type Plane = Cell[][];

/** A 9x9 plane of just values */
export type PlaneValues = CellValue[][];

/**
 * Coordinate mapping for different axes
 * Given a PlaneRef and (row, col) within the plane,
 * returns the (x, y, z) position in the cube
 */
export function planeToPosition(plane: PlaneRef, row: number, col: number): Position {
  switch (plane.axis) {
    case 'XY':
      // XY plane at fixed z: row=y, col=x
      return { x: col, y: row, z: plane.index };
    case 'XZ':
      // XZ plane at fixed y: row=z, col=x
      return { x: col, y: plane.index, z: row };
    case 'YZ':
      // YZ plane at fixed x: row=z, col=y
      return { x: plane.index, y: col, z: row };
  }
}

/**
 * Get the row and column within a plane for a given 3D position
 */
export function positionToPlane(pos: Position, axis: Axis): { row: number; col: number; index: number } {
  switch (axis) {
    case 'XY':
      return { row: pos.y, col: pos.x, index: pos.z };
    case 'XZ':
      return { row: pos.z, col: pos.x, index: pos.y };
    case 'YZ':
      return { row: pos.z, col: pos.y, index: pos.x };
  }
}

/**
 * Extract a 9x9 plane from the cube
 */
export function extractPlane(cube: CubeData, plane: PlaneRef): Plane {
  const result: Plane = [];
  for (let row = 0; row < 9; row++) {
    const rowData: Cell[] = [];
    for (let col = 0; col < 9; col++) {
      const pos = planeToPosition(plane, row, col);
      rowData.push(cube[pos.z]![pos.y]![pos.x]!);
    }
    result.push(rowData);
  }
  return result;
}

/**
 * Extract plane values only (for validation)
 */
export function extractPlaneValues(values: CubeValues, plane: PlaneRef): PlaneValues {
  const result: PlaneValues = [];
  for (let row = 0; row < 9; row++) {
    const rowData: CellValue[] = [];
    for (let col = 0; col < 9; col++) {
      const pos = planeToPosition(plane, row, col);
      rowData.push(values[pos.z]![pos.y]![pos.x]!);
    }
    result.push(rowData);
  }
  return result;
}

/**
 * Get the 3x3 block index (0-8) for a row/col position within a plane
 */
export function getBlockIndex(row: number, col: number): number {
  return Math.floor(row / 3) * 3 + Math.floor(col / 3);
}

/**
 * Get the top-left corner of a 3x3 block
 */
export function getBlockStart(row: number, col: number): { row: number; col: number } {
  return {
    row: Math.floor(row / 3) * 3,
    col: Math.floor(col / 3) * 3
  };
}

/**
 * Create an empty cube (all cells with value 0)
 */
export function createEmptyCube(): CubeData {
  const cube: CubeData = [];
  for (let z = 0; z < 9; z++) {
    const layer: Cell[][] = [];
    for (let y = 0; y < 9; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < 9; x++) {
        row.push({
          value: 0,
          solution: 0,
          isGiven: false,
          pencilMarks: new Set(),
          isError: false
        });
      }
      layer.push(row);
    }
    cube.push(layer);
  }
  return cube;
}

/**
 * Create an empty values array
 */
export function createEmptyValues(): CubeValues {
  const values: CubeValues = [];
  for (let z = 0; z < 9; z++) {
    const layer: CellValue[][] = [];
    for (let y = 0; y < 9; y++) {
      layer.push(Array(9).fill(0) as CellValue[]);
    }
    values.push(layer);
  }
  return values;
}

/**
 * Convert a position to a unique string key
 */
export function positionKey(pos: Position): string {
  return `${pos.x},${pos.y},${pos.z}`;
}

/**
 * Parse a position key back to a Position
 */
export function parsePositionKey(key: string): Position {
  const parts = key.split(',').map(Number);
  return { x: parts[0]!, y: parts[1]!, z: parts[2]! };
}

/**
 * Check if two positions are equal
 */
export function positionsEqual(a: Position | null, b: Position | null): boolean {
  if (!a || !b) return a === b;
  return a.x === b.x && a.y === b.y && a.z === b.z;
}
