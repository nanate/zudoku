/**
 * Cube Renderer
 *
 * Handles the 3D rendering of the 9×9×9 Sudoku cube using Three.js.
 * Uses InstancedMesh for efficient rendering of 729 cells.
 */

import * as THREE from 'three';
import type { CubeData, Position, PlaneRef, CellValue } from '../types';
import { planeToPosition } from '../types';
import { TextureManager } from './TextureManager';

/** Colors for different cell states */
const COLORS = {
  cellDefault: 0x3d3d5c,
  cellGiven: 0x4a4a6a,
  cellFilled: 0x2d4a6d,
  // Selected cell - bright cyan/teal for maximum visibility
  cellSelected: 0x00d4aa,
  cellHovered: 0x5a8a9a,
  cellRelated: 0x3a5a6a,
  cellError: 0xcc4444,
  cellInactivePlane: 0x1a1a2a,
  // Active plane cells - distinct blue-purple tint
  cellActivePlane: 0x5566aa,
  cellActivePlaneGiven: 0x6677bb,
  textDefault: 0xffffff,
  textGiven: 0xe0e0ff,
  textError: 0xff6666
};

/** Cell state for tracking */
interface CellState {
  value: CellValue;
  isGiven: boolean;
  isError: boolean;
  isSelected: boolean;
  isHovered: boolean;
  isRelated: boolean;
  isInActivePlane: boolean;
}

/**
 * Renders the 3D Sudoku cube
 */
export class CubeRenderer {
  private scene: THREE.Scene;
  private cubeGroup: THREE.Group;
  private cellMeshes: THREE.Mesh[][][] = [];
  private textSprites: THREE.Sprite[][][] = [];
  private textureManager: TextureManager;
  private cellStates: CellState[][][] = [];

  // Current state
  private activePlane: PlaneRef | null = null;
  private selectedCell: Position | null = null;
  private hoveredCell: Position | null = null;

  // Geometry and materials (reused)
  private cellGeometry: THREE.BoxGeometry;
  private cellMaterials: Map<string, THREE.MeshStandardMaterial> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.cubeGroup = new THREE.Group();
    this.scene.add(this.cubeGroup);

    this.textureManager = new TextureManager();
    this.cellGeometry = new THREE.BoxGeometry(0.85, 0.85, 0.85);

    this.initializeCellStates();
  }

  /**
   * Initialize cell states array
   */
  private initializeCellStates(): void {
    this.cellStates = [];
    for (let z = 0; z < 9; z++) {
      const layer: CellState[][] = [];
      for (let y = 0; y < 9; y++) {
        const row: CellState[] = [];
        for (let x = 0; x < 9; x++) {
          row.push({
            value: 0,
            isGiven: false,
            isError: false,
            isSelected: false,
            isHovered: false,
            isRelated: false,
            isInActivePlane: true
          });
        }
        layer.push(row);
      }
      this.cellStates.push(layer);
    }
  }

  /**
   * Create the cube from game data
   */
  createCube(cubeData: CubeData): void {
    // Clear existing meshes
    this.clearMeshes();

    // Initialize arrays
    this.cellMeshes = [];
    this.textSprites = [];

    for (let z = 0; z < 9; z++) {
      const cellLayer: THREE.Mesh[][] = [];
      const textLayer: THREE.Sprite[][] = [];

      for (let y = 0; y < 9; y++) {
        const cellRow: THREE.Mesh[] = [];
        const textRow: THREE.Sprite[] = [];

        for (let x = 0; x < 9; x++) {
          const cell = cubeData[z]![y]![x]!;

          // Update state
          this.cellStates[z]![y]![x] = {
            value: cell.value,
            isGiven: cell.isGiven,
            isError: cell.isError,
            isSelected: false,
            isHovered: false,
            isRelated: false,
            isInActivePlane: true
          };

          // Create cell mesh
          const cellMesh = this.createCellMesh(x, y, z, cell.isGiven, cell.isError);
          this.cubeGroup.add(cellMesh);
          cellRow.push(cellMesh);

          // Create text sprite if cell has value
          if (cell.value !== 0) {
            const textSprite = this.createTextSprite(x, y, z, cell.value, cell.isGiven);
            if (textSprite) {
              this.cubeGroup.add(textSprite);
              textRow.push(textSprite);
            } else {
              textRow.push(null as any);
            }
          } else {
            textRow.push(null as any);
          }
        }
        cellLayer.push(cellRow);
        textLayer.push(textRow);
      }
      this.cellMeshes.push(cellLayer);
      this.textSprites.push(textLayer);
    }

    // Add subtle grid lines for 3×3 blocks
    this.addBlockLines();
  }

  /**
   * Create a cell mesh
   */
  private createCellMesh(
    x: number, y: number, z: number,
    isGiven: boolean, isError: boolean
  ): THREE.Mesh {
    const material = this.getCellMaterial(isGiven, isError, false, false, false, true);
    const mesh = new THREE.Mesh(this.cellGeometry, material);

    // Position: center the cube at origin
    mesh.position.set(x - 4, y - 4, z - 4);

    // Store position in userData for raycasting
    mesh.userData.cellPosition = { x, y, z };

    return mesh;
  }

  /**
   * Create a text sprite for the cell value (always faces camera)
   */
  private createTextSprite(
    x: number, y: number, z: number,
    value: CellValue, isGiven: boolean
  ): THREE.Sprite | null {
    if (value === 0) return null;

    const texture = this.textureManager.getDigitTexture(value);
    if (!texture) return null;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,  // Always render on top of geometry
      depthWrite: false,
      color: isGiven ? 0xffffff : 0x88ccff,  // Given cells are white, player cells are blue-tinted
      sizeAttenuation: true
    });

    const sprite = new THREE.Sprite(material);

    // Position at center of cell
    sprite.position.set(x - 4, y - 4, z - 4);

    // Scale the sprite to be visible
    sprite.scale.set(0.8, 0.8, 1);

    // Set render order to ensure sprites are rendered after cubes
    sprite.renderOrder = 1;

    return sprite;
  }

  /**
   * Get or create a cell material with specified state
   */
  private getCellMaterial(
    isGiven: boolean,
    isError: boolean,
    isSelected: boolean,
    isHovered: boolean,
    isRelated: boolean,
    isInActivePlane: boolean
  ): THREE.MeshStandardMaterial {
    // Create key for caching
    const key = `${isGiven}-${isError}-${isSelected}-${isHovered}-${isRelated}-${isInActivePlane}`;

    if (!this.cellMaterials.has(key)) {
      let color = COLORS.cellDefault;
      let opacity = 1;
      let emissive = 0x000000;
      let emissiveIntensity = 0;

      if (!isInActivePlane) {
        // Inactive plane cells are very ghosted/transparent
        color = COLORS.cellInactivePlane;
        opacity = 0.12;
      } else if (isSelected) {
        // Selected cell - bright with glow effect
        color = COLORS.cellSelected;
        emissive = COLORS.cellSelected;
        emissiveIntensity = 0.4;
      } else if (isError) {
        color = COLORS.cellError;
        emissive = COLORS.cellError;
        emissiveIntensity = 0.2;
      } else if (isHovered) {
        color = COLORS.cellHovered;
        emissive = COLORS.cellHovered;
        emissiveIntensity = 0.15;
      } else if (isRelated) {
        color = COLORS.cellRelated;
      } else if (isGiven) {
        // Active plane given cells have distinct color
        color = COLORS.cellActivePlaneGiven;
      } else {
        // Active plane cells have a brighter, distinct color
        color = COLORS.cellActivePlane;
      }

      const material = new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity,
        roughness: 0.5,
        metalness: 0.15,
        emissive,
        emissiveIntensity,
        depthWrite: isInActivePlane
      });

      this.cellMaterials.set(key, material);
    }

    return this.cellMaterials.get(key)!;
  }

  /**
   * Add lines to show 3×3 block boundaries
   */
  private addBlockLines(): void {
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x5a5a7a,
      transparent: true,
      opacity: 0.4
    });

    // Create lines at block boundaries
    for (let i = 0; i <= 3; i++) {
      const offset = i * 3 - 4.5;

      // XY plane lines (at each z)
      for (let z = 0; z < 9; z++) {
        // Horizontal line
        const hGeom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-4.5, offset, z - 4),
          new THREE.Vector3(4.5, offset, z - 4)
        ]);
        const hLine = new THREE.Line(hGeom, lineMaterial);
        this.cubeGroup.add(hLine);

        // Vertical line
        const vGeom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(offset, -4.5, z - 4),
          new THREE.Vector3(offset, 4.5, z - 4)
        ]);
        const vLine = new THREE.Line(vGeom, lineMaterial);
        this.cubeGroup.add(vLine);
      }
    }
  }

  /**
   * Update a single cell
   */
  updateCell(pos: Position, value: CellValue, isGiven: boolean, isError: boolean): void {
    const { x, y, z } = pos;

    // Update state
    const state = this.cellStates[z]?.[y]?.[x];
    if (state) {
      state.value = value;
      state.isGiven = isGiven;
      state.isError = isError;
    }

    // Update cell material
    this.updateCellMaterial(x, y, z);

    // Update text sprite
    this.updateTextSprite(x, y, z, value, isGiven);
  }

  /**
   * Flash a cell red briefly to indicate wrong entry
   */
  flashCellError(pos: Position): void {
    const { x, y, z } = pos;
    const mesh = this.cellMeshes[z]?.[y]?.[x];
    if (!mesh) return;

    // Create temporary red material
    const errorMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 1,
      roughness: 0.5,
      metalness: 0.15,
      emissive: 0xff4444,
      emissiveIntensity: 0.5
    });

    const originalMaterial = mesh.material as THREE.MeshStandardMaterial;
    mesh.material = errorMaterial;

    // Restore after 300ms
    setTimeout(() => {
      mesh.material = originalMaterial;
      errorMaterial.dispose();
    }, 300);
  }

  /**
   * Update cell material based on state
   */
  private updateCellMaterial(x: number, y: number, z: number): void {
    const state = this.cellStates[z]?.[y]?.[x];
    const mesh = this.cellMeshes[z]?.[y]?.[x];

    if (mesh && state) {
      mesh.material = this.getCellMaterial(
        state.isGiven,
        state.isError,
        state.isSelected,
        state.isHovered,
        state.isRelated,
        state.isInActivePlane
      );
    }
  }

  /**
   * Update text sprite for a cell
   */
  private updateTextSprite(
    x: number, y: number, z: number,
    value: CellValue, isGiven: boolean
  ): void {
    const existingSprite = this.textSprites[z]?.[y]?.[x];

    // Remove existing text sprite
    if (existingSprite) {
      this.cubeGroup.remove(existingSprite);
      (existingSprite.material as THREE.Material).dispose();
    }

    // Create new text sprite if value is set
    if (value !== 0) {
      const newSprite = this.createTextSprite(x, y, z, value, isGiven);
      if (newSprite && this.textSprites[z]?.[y]) {
        this.cubeGroup.add(newSprite);
        this.textSprites[z]![y]![x] = newSprite;

        // Apply correct opacity based on active plane
        const state = this.cellStates[z]?.[y]?.[x];
        if (state) {
          const mat = newSprite.material as THREE.SpriteMaterial;
          mat.opacity = state.isInActivePlane ? 1.0 : 0.15;
          newSprite.renderOrder = state.isInActivePlane ? 2 : 0;
        }
      }
    } else if (this.textSprites[z]?.[y]) {
      this.textSprites[z]![y]![x] = null as any;
    }
  }

  /**
   * Set the selected cell
   */
  setSelectedCell(pos: Position | null): void {
    // Clear previous selection
    if (this.selectedCell) {
      const { x, y, z } = this.selectedCell;
      const prevState = this.cellStates[z]?.[y]?.[x];
      if (prevState) {
        prevState.isSelected = false;
        this.updateCellMaterial(x, y, z);
      }
    }

    this.selectedCell = pos;

    // Set new selection
    if (pos) {
      const newState = this.cellStates[pos.z]?.[pos.y]?.[pos.x];
      if (newState) {
        newState.isSelected = true;
        this.updateCellMaterial(pos.x, pos.y, pos.z);
      }
    }
  }

  /**
   * Set the hovered cell
   */
  setHoveredCell(pos: Position): void {
    // Clear previous hover
    if (this.hoveredCell) {
      const { x, y, z } = this.hoveredCell;
      const prevState = this.cellStates[z]?.[y]?.[x];
      if (prevState) {
        prevState.isHovered = false;
        this.updateCellMaterial(x, y, z);
      }
    }

    this.hoveredCell = pos;

    // Set new hover
    const newState = this.cellStates[pos.z]?.[pos.y]?.[pos.x];
    if (newState) {
      newState.isHovered = true;
      this.updateCellMaterial(pos.x, pos.y, pos.z);
    }
  }

  /**
   * Clear hovered cell
   */
  clearHoveredCell(): void {
    if (this.hoveredCell) {
      const { x, y, z } = this.hoveredCell;
      const state = this.cellStates[z]?.[y]?.[x];
      if (state) {
        state.isHovered = false;
        this.updateCellMaterial(x, y, z);
      }
      this.hoveredCell = null;
    }
  }

  /**
   * Highlight a plane (show it prominently, dim others)
   */
  highlightPlane(plane: PlaneRef): void {
    this.activePlane = plane;

    // Update all cells
    for (let z = 0; z < 9; z++) {
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          const isInPlane = this.isCellInPlane(x, y, z, plane);
          const state = this.cellStates[z]?.[y]?.[x];
          if (state) {
            state.isInActivePlane = isInPlane;
            this.updateCellMaterial(x, y, z);
          }

          // Update text visibility and opacity
          const textSprite = this.textSprites[z]?.[y]?.[x];
          if (textSprite) {
            textSprite.visible = true;  // Always visible
            const mat = textSprite.material as THREE.SpriteMaterial;
            // Active plane numbers are fully visible, inactive are very dim
            mat.opacity = isInPlane ? 1.0 : 0.15;
            // Active plane sprites render on top
            textSprite.renderOrder = isInPlane ? 2 : 0;
          }
        }
      }
    }
  }

  /**
   * Check if a cell is in a plane
   */
  private isCellInPlane(x: number, y: number, z: number, plane: PlaneRef): boolean {
    switch (plane.axis) {
      case 'XY': return z === plane.index;
      case 'XZ': return y === plane.index;
      case 'YZ': return x === plane.index;
    }
  }

  /**
   * Show related cells (same row/col/block in active plane)
   */
  showRelatedCells(pos: Position): void {
    this.clearRelatedHighlights();

    // Only highlight cells in the active plane
    for (let z = 0; z < 9; z++) {
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          if (x === pos.x && y === pos.y && z === pos.z) continue;

          const state = this.cellStates[z]?.[y]?.[x];
          if (!state || !state.isInActivePlane) continue;

          // Check if cell is in same row, column, or 3x3 block
          const onXLine = y === pos.y && z === pos.z;
          const onYLine = x === pos.x && z === pos.z;
          const sameBlock = z === pos.z &&
            Math.floor(x / 3) === Math.floor(pos.x / 3) &&
            Math.floor(y / 3) === Math.floor(pos.y / 3);

          if (onXLine || onYLine || sameBlock) {
            state.isRelated = true;
            this.updateCellMaterial(x, y, z);
          }
        }
      }
    }
  }

  /**
   * Clear related cell highlights
   */
  private clearRelatedHighlights(): void {
    for (let z = 0; z < 9; z++) {
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          const state = this.cellStates[z]?.[y]?.[x];
          if (state?.isRelated) {
            state.isRelated = false;
            this.updateCellMaterial(x, y, z);
          }
        }
      }
    }
  }

  /**
   * Clear all highlights
   */
  clearHighlights(): void {
    this.setSelectedCell(null);
    this.clearHoveredCell();
    this.clearRelatedHighlights();
  }

  /**
   * Raycast to find cell under cursor
   */
  raycastCell(raycaster: THREE.Raycaster): Position | null {
    const meshes: THREE.Mesh[] = [];

    // Only check cells in active plane for efficiency
    if (this.activePlane) {
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          const pos = planeToPosition(this.activePlane, row, col);
          const mesh = this.cellMeshes[pos.z]?.[pos.y]?.[pos.x];
          if (mesh) meshes.push(mesh);
        }
      }
    } else {
      // Check all visible cells
      for (let z = 0; z < 9; z++) {
        for (let y = 0; y < 9; y++) {
          for (let x = 0; x < 9; x++) {
            const mesh = this.cellMeshes[z]?.[y]?.[x];
            if (mesh) meshes.push(mesh);
          }
        }
      }
    }

    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const firstIntersect = intersects[0];
      if (firstIntersect) {
        const userData = firstIntersect.object.userData;
        if (userData.cellPosition) {
          return userData.cellPosition as Position;
        }
      }
    }

    return null;
  }

  /**
   * Update animations (called each frame)
   */
  update(): void {
    // Animation updates can go here
  }

  /**
   * Clear all meshes
   */
  private clearMeshes(): void {
    while (this.cubeGroup.children.length > 0) {
      const child = this.cubeGroup.children[0]!;
      this.cubeGroup.remove(child);

      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      } else if (child instanceof THREE.Sprite) {
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    }
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.clearMeshes();
    this.scene.remove(this.cubeGroup);
    this.cellGeometry.dispose();

    for (const material of this.cellMaterials.values()) {
      material.dispose();
    }

    this.textureManager.dispose();
  }
}
