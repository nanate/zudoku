/**
 * Texture Manager
 *
 * Pre-generates and caches textures for digit rendering.
 * Uses Canvas API to create crisp text textures.
 */

import * as THREE from 'three';
import type { CellValue } from '../types';

/**
 * Manages digit textures for cell rendering
 */
export class TextureManager {
  private digitTextures: Map<number, THREE.CanvasTexture> = new Map();
  private canvasSize = 128;

  constructor() {
    this.generateAllTextures();
  }

  /**
   * Generate textures for digits 1-9
   */
  private generateAllTextures(): void {
    for (let digit = 1; digit <= 9; digit++) {
      const texture = this.createDigitTexture(digit);
      this.digitTextures.set(digit, texture);
    }
  }

  /**
   * Create a texture for a single digit with outline for visibility
   */
  private createDigitTexture(digit: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = this.canvasSize;
    canvas.height = this.canvasSize;

    const ctx = canvas.getContext('2d')!;

    // Clear with transparent background
    ctx.clearRect(0, 0, this.canvasSize, this.canvasSize);

    const fontSize = this.canvasSize * 0.75;
    ctx.font = `bold ${fontSize}px "Segoe UI", system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerX = this.canvasSize / 2;
    const centerY = this.canvasSize / 2;

    // Draw dark outline/shadow for better visibility
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.strokeText(String(digit), centerX, centerY);

    // Draw white fill
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(digit), centerX, centerY);

    // Add subtle glow
    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(String(digit), centerX, centerY);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    return texture;
  }

  /**
   * Get texture for a digit
   */
  getDigitTexture(digit: CellValue): THREE.CanvasTexture | null {
    if (digit === 0) return null;
    return this.digitTextures.get(digit) ?? null;
  }

  /**
   * Dispose of all textures
   */
  dispose(): void {
    for (const texture of this.digitTextures.values()) {
      texture.dispose();
    }
    this.digitTextures.clear();
  }
}
