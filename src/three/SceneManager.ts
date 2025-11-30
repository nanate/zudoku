/**
 * Three.js Scene Manager
 *
 * Handles the 3D scene setup, rendering, and lifecycle management.
 * This is the core integration point for Three.js with Vue.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CubeData, Position, PlaneRef, CellValue } from '../types';
import { CubeRenderer } from './CubeRenderer';

export interface SceneManagerOptions {
  antialias?: boolean;
  pixelRatio?: number;
}

/**
 * Main scene manager for the 3D Sudoku visualization
 */
export class SceneManager {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls | null = null;
  private cubeRenderer: CubeRenderer | null = null;
  private animationFrameId: number | null = null;
  private isInitialized = false;
  private resizeObserver: ResizeObserver | null = null;

  // Event callbacks
  private onCellClick: ((pos: Position) => void) | null = null;
  private onCellHover: ((pos: Position | null) => void) | null = null;
  private onPlaneChange: ((axis: 'XY' | 'XZ' | 'YZ', index: number, cameraOnPositiveSide: boolean) => void) | null = null;
  private currentDominantAxis: 'XY' | 'XZ' | 'YZ' = 'XY';
  private currentPlaneIndex: number = 0;
  // Track if user was viewing front (true) or back (false) plane
  private viewingFrontPlane: boolean = true;
  // Track camera side for view-relative index display
  private cameraOnPositiveSide: boolean = true;

  // Raycasting for cell selection
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  // Debounce plane changes to prevent jitter
  private lastPlaneChangeTime: number = 0;
  private readonly planeChangeDebounceMs: number = 150;

  private options: SceneManagerOptions;

  constructor(options: SceneManagerOptions = {}) {
    this.options = options;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  }

  /**
   * Initialize the scene with a canvas element
   */
  init(canvas: HTMLCanvasElement): void {
    if (this.isInitialized) {
      console.warn('SceneManager already initialized');
      return;
    }

    this.canvas = canvas;

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.options.antialias ?? true,
      alpha: true
    });

    const pixelRatio = this.options.pixelRatio ?? Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setClearColor(0x1a1a2e, 1);

    // Enable sorting for proper transparency rendering
    this.renderer.sortObjects = true;

    // Setup camera
    this.camera.position.set(15, 12, 15);
    this.camera.lookAt(0, 0, 0);

    // Setup controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 50;
    this.controls.enablePan = false;

    // Setup lighting
    this.setupLighting();

    // Create cube renderer
    this.cubeRenderer = new CubeRenderer(this.scene);

    // Handle resize
    this.setupResizeObserver();
    this.handleResize();

    // Setup mouse events
    this.setupMouseEvents();

    this.isInitialized = true;
  }

  /**
   * Setup scene lighting
   */
  private setupLighting(): void {
    // Ambient light for overall illumination
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    // Main directional light
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(10, 20, 10);
    this.scene.add(directional);

    // Fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-10, 5, -10);
    this.scene.add(fillLight);
  }

  /**
   * Setup resize observer for responsive rendering
   */
  private setupResizeObserver(): void {
    if (!this.canvas) return;

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });

    // Observe the canvas's parent container
    if (this.canvas.parentElement) {
      this.resizeObserver.observe(this.canvas.parentElement);
    }
  }

  /**
   * Handle canvas resize
   */
  private handleResize(): void {
    if (!this.canvas || !this.renderer) return;

    const container = this.canvas.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  /**
   * Setup mouse event handlers for cell selection
   */
  private setupMouseEvents(): void {
    if (!this.canvas) return;

    this.canvas.addEventListener('mousemove', (event) => {
      this.updateMousePosition(event);
      this.handleHover();
    });

    this.canvas.addEventListener('click', (event) => {
      this.updateMousePosition(event);
      this.handleClick();
    });

    // Touch support
    this.canvas.addEventListener('touchstart', (event) => {
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        if (touch) {
          this.updateMousePosition(touch);
        }
      }
    });

    this.canvas.addEventListener('touchend', (event) => {
      // Handle tap
      if (event.changedTouches.length === 1) {
        const touch = event.changedTouches[0];
        if (touch) {
          this.updateMousePosition(touch);
          this.handleClick();
        }
      }
    });
  }

  /**
   * Update mouse position for raycasting
   */
  private updateMousePosition(event: MouseEvent | Touch): void {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * Handle mouse hover for cell highlighting
   */
  private handleHover(): void {
    if (!this.cubeRenderer) return;

    const intersectedCell = this.getIntersectedCell();
    this.onCellHover?.(intersectedCell);

    if (intersectedCell) {
      this.cubeRenderer.setHoveredCell(intersectedCell);
    } else {
      this.cubeRenderer.clearHoveredCell();
    }
  }

  /**
   * Handle mouse click for cell selection
   */
  private handleClick(): void {
    const intersectedCell = this.getIntersectedCell();
    if (intersectedCell) {
      this.onCellClick?.(intersectedCell);
    }
  }

  /**
   * Get the cell position under the mouse cursor
   */
  private getIntersectedCell(): Position | null {
    if (!this.cubeRenderer) return null;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.cubeRenderer.raycastCell(this.raycaster);
  }

  /**
   * Create/update the cube from game data
   */
  createCube(cubeData: CubeData): void {
    this.cubeRenderer?.createCube(cubeData);
  }

  /**
   * Update a single cell's value
   */
  updateCell(pos: Position, value: CellValue, isGiven: boolean, isError: boolean): void {
    this.cubeRenderer?.updateCell(pos, value, isGiven, isError);
  }

  /**
   * Set the selected cell
   */
  setSelectedCell(pos: Position | null): void {
    this.cubeRenderer?.setSelectedCell(pos);
  }

  /**
   * Highlight a plane and animate camera to focus on it
   */
  highlightPlane(plane: PlaneRef): void {
    this.cubeRenderer?.highlightPlane(plane);
    // Update our tracking of which "depth" user is viewing
    this.updateViewingPosition(plane.index);
    this.currentPlaneIndex = plane.index;
    this.currentDominantAxis = plane.axis;

    // Animate camera target toward the active plane for better visibility
    this.animateCameraToPlane(plane);
  }

  /**
   * Animate camera target to focus on the active plane
   * This subtly shifts the view to keep the selected plane centered
   */
  private animateCameraToPlane(plane: PlaneRef): void {
    if (!this.controls) return;

    // Calculate the offset for the plane center
    // Planes are at positions -4 to +4 in world space (9 planes, centered at 0)
    // So plane index 0 = -4, index 4 = 0, index 8 = +4
    const planeOffset = plane.index - 4;

    // Create target position based on which axis we're looking at
    let targetX = 0;
    let targetY = 0;
    let targetZ = 0;

    switch (plane.axis) {
      case 'XY':
        // Plane varies in Z, shift target slightly toward it
        targetZ = planeOffset * 0.3;
        break;
      case 'XZ':
        // Plane varies in Y, shift target slightly toward it
        targetY = planeOffset * 0.3;
        break;
      case 'YZ':
        // Plane varies in X, shift target slightly toward it
        targetX = planeOffset * 0.3;
        break;
    }

    // Smoothly animate the controls target
    const currentTarget = this.controls.target;
    const animationDuration = 300; // ms
    const startTarget = { x: currentTarget.x, y: currentTarget.y, z: currentTarget.z };
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      this.controls!.target.set(
        startTarget.x + (targetX - startTarget.x) * eased,
        startTarget.y + (targetY - startTarget.y) * eased,
        startTarget.z + (targetZ - startTarget.z) * eased
      );

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  /**
   * Show related cells (same row/col/block/depth)
   */
  showRelatedCells(pos: Position): void {
    this.cubeRenderer?.showRelatedCells(pos);
  }

  /**
   * Clear all highlights
   */
  clearHighlights(): void {
    this.cubeRenderer?.clearHighlights();
  }

  /**
   * Flash a cell red to indicate wrong entry
   */
  flashCellError(pos: Position): void {
    this.cubeRenderer?.flashCellError(pos);
  }

  /**
   * Set event callback for cell clicks
   */
  onCellClicked(callback: (pos: Position) => void): void {
    this.onCellClick = callback;
  }

  /**
   * Set event callback for cell hover
   */
  onCellHovered(callback: (pos: Position | null) => void): void {
    this.onCellHover = callback;
  }

  /**
   * Set event callback for plane/orientation change
   * The callback receives axis, index, and whether camera is on positive side
   */
  onPlaneChanged(callback: (axis: 'XY' | 'XZ' | 'YZ', index: number, cameraOnPositiveSide: boolean) => void): void {
    this.onPlaneChange = callback;
  }

  /**
   * Get whether the camera is looking from positive or negative direction
   * along the current axis. Returns true if camera is on the positive side
   * (meaning higher indices are "closer" to camera, i.e., "front").
   */
  isCameraOnPositiveSide(): boolean {
    const camPos = this.camera.position;
    const absX = Math.abs(camPos.x);
    const absY = Math.abs(camPos.y);
    const absZ = Math.abs(camPos.z);

    // Determine which side the camera is on for the dominant axis
    if (absZ >= absX && absZ >= absY) {
      return camPos.z > 0;
    } else if (absY >= absX && absY >= absZ) {
      return camPos.y > 0;
    } else {
      return camPos.x > 0;
    }
  }

  /**
   * Determine which plane is most face-on to the camera
   * Returns the axis and calculates index based on whether we're viewing front or back
   * Uses hysteresis to prevent rapid switching at axis boundaries
   */
  private getDominantViewAxisAndIndex(): { axis: 'XY' | 'XZ' | 'YZ'; index: number } {
    // Camera position determines which plane we're looking at
    const camPos = this.camera.position;

    // Get absolute values to determine dominant axis
    const absX = Math.abs(camPos.x);
    const absY = Math.abs(camPos.y);
    const absZ = Math.abs(camPos.z);

    // Threshold: new axis must be this much more dominant to trigger a switch
    // This creates "stickiness" to the current axis
    const threshold = 2.0; // 100% more dominant required to switch

    let axis: 'XY' | 'XZ' | 'YZ';
    let frontIndex: number;
    let backIndex: number;

    // Check if we should stick with current axis (hysteresis)
    let currentAxisValue: number;
    switch (this.currentDominantAxis) {
      case 'XY': currentAxisValue = absZ; break;
      case 'XZ': currentAxisValue = absY; break;
      case 'YZ': currentAxisValue = absX; break;
    }

    // Find the would-be new dominant axis
    const maxValue = Math.max(absX, absY, absZ);

    // Only switch if new axis is significantly more dominant than current
    if (currentAxisValue * threshold >= maxValue) {
      // Stick with current axis
      axis = this.currentDominantAxis;
    } else {
      // Switch to new dominant axis
      if (absZ >= absX && absZ >= absY) {
        axis = 'XY';
      } else if (absY >= absX && absY >= absZ) {
        axis = 'XZ';
      } else {
        axis = 'YZ';
      }
    }

    // Calculate front/back indices based on the chosen axis
    switch (axis) {
      case 'XY':
        frontIndex = camPos.z > 0 ? 8 : 0;
        backIndex = camPos.z > 0 ? 0 : 8;
        break;
      case 'XZ':
        frontIndex = camPos.y > 0 ? 8 : 0;
        backIndex = camPos.y > 0 ? 0 : 8;
        break;
      case 'YZ':
        frontIndex = camPos.x > 0 ? 8 : 0;
        backIndex = camPos.x > 0 ? 0 : 8;
        break;
    }

    // Maintain the same relative position (front vs back) when axis changes
    const index = this.viewingFrontPlane ? frontIndex : backIndex;
    return { axis, index };
  }

  /**
   * Update whether we're viewing front or back based on current plane index
   */
  updateViewingPosition(currentIndex: number): void {
    // Determine if current index is closer to front or back
    // Front planes are 8, 7, 6... Back planes are 0, 1, 2...
    this.viewingFrontPlane = currentIndex >= 4;
  }

  /**
   * Check and update dominant plane based on camera position
   * Triggers when axis changes OR when camera side changes
   * When switching axes, maps the plane to maintain the same view-relative position
   * Includes debouncing to prevent rapid jittery changes
   */
  private checkPlaneChange(): void {
    const { axis } = this.getDominantViewAxisAndIndex();
    const newCameraSide = this.isCameraOnPositiveSide();

    const axisChanged = axis !== this.currentDominantAxis;
    const cameraSideChanged = newCameraSide !== this.cameraOnPositiveSide;

    if (axisChanged || cameraSideChanged) {
      // Debounce: don't trigger changes too rapidly
      const now = performance.now();
      if (now - this.lastPlaneChangeTime < this.planeChangeDebounceMs) {
        return;
      }
      this.lastPlaneChangeTime = now;

      // Calculate the current view-relative index (1-9, where 1=back, 9=front)
      let viewRelativeIndex: number;
      if (this.cameraOnPositiveSide) {
        viewRelativeIndex = this.currentPlaneIndex + 1; // 0->1, 8->9
      } else {
        viewRelativeIndex = 9 - this.currentPlaneIndex; // 0->9, 8->1
      }

      // Convert view-relative index to actual index for the new camera side
      let newActualIndex: number;
      if (newCameraSide) {
        newActualIndex = viewRelativeIndex - 1; // 1->0, 9->8
      } else {
        newActualIndex = 9 - viewRelativeIndex; // 1->8, 9->0
      }

      this.currentDominantAxis = axis;
      this.currentPlaneIndex = newActualIndex;
      this.cameraOnPositiveSide = newCameraSide;
      this.onPlaneChange?.(axis, newActualIndex, newCameraSide);
    }
  }

  /**
   * Start the animation loop
   */
  startAnimationLoop(): void {
    if (this.animationFrameId !== null) return;

    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);

      // Update controls
      this.controls?.update();

      // Check if camera orientation changed
      this.checkPlaneChange();

      // Update cube renderer animations
      this.cubeRenderer?.update();

      // Render scene
      this.renderer?.render(this.scene, this.camera);
    };

    animate();
  }

  /**
   * Stop the animation loop
   */
  stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.stopAnimationLoop();

    // Dispose cube renderer
    this.cubeRenderer?.dispose();

    // Dispose controls
    this.controls?.dispose();

    // Dispose renderer
    this.renderer?.dispose();

    // Disconnect resize observer
    this.resizeObserver?.disconnect();

    // Clear references
    this.canvas = null;
    this.renderer = null;
    this.controls = null;
    this.cubeRenderer = null;
    this.resizeObserver = null;
    this.isInitialized = false;
  }

  /**
   * Get the camera for external manipulation
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * Get the controls for external manipulation
   */
  getControls(): OrbitControls | null {
    return this.controls;
  }

  /**
   * Reset camera to default position
   */
  resetCamera(): void {
    this.camera.position.set(15, 12, 15);
    this.camera.lookAt(0, 0, 0);
    this.controls?.reset();
  }
}
