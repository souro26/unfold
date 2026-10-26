// src/renderer-motion.ts - Clean, high-production Vector Motion Animation Engine (YouTube Explainer / 3Blue1Brown style)
import { BlackboardStep, DrawingElement } from './types';
import { PluginManager } from './services/PluginManager';

export interface MotionRendererOptions {
  showGrid?: boolean;
  glowEffects?: boolean;
}

export class MotionVectorRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationId: number | null = null;
  private showGrid: boolean = true;
  private glowEffects: boolean = true;
  public onRenderError: ((err: any) => void) | null = null;

  constructor(options?: MotionRendererOptions) {
    if (options?.showGrid !== undefined) this.showGrid = options.showGrid;
    if (options?.glowEffects !== undefined) this.glowEffects = options.glowEffects;
  }

  public isAvailable(): boolean {
    return !!(this.canvas && this.ctx);
  }

  public attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    if (canvas && typeof canvas.getContext === 'function') {
      try {
        this.ctx = canvas.getContext('2d');
      } catch (err) {
        console.warn('MotionVectorRenderer: Failed to get 2d context:', err);
      }
    }
  }

  public resize(): void {
    // Canvas dimensions updated by parent view
  }

  public stopAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  public calculateAutoFit(
    step: BlackboardStep,
    width: number,
    height: number
  ): { scale: number; transX: number; transY: number } {
    const elements = step.elements || [];
    if (elements.length === 0) {
      return { scale: 1.0, transX: 0, transY: 0 };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const el of elements) {
      if (el.start) {
        const r = el.radius || (el.width ? el.width / 2 : 0);
        const w = el.width || (el.end ? Math.abs(el.end.x - el.start.x) : 0);
        const h = el.height || (el.end ? Math.abs(el.end.y - el.start.y) : 0);
        minX = Math.min(minX, el.start.x - r);
        maxX = Math.max(maxX, el.start.x + r + w);
        minY = Math.min(minY, el.start.y - r);
        maxY = Math.max(maxY, el.start.y + r + h);
      }
      if (el.end) {
        minX = Math.min(minX, el.end.x);
        maxX = Math.max(maxX, el.end.x);
        minY = Math.min(minY, el.end.y);
        maxY = Math.max(maxY, el.end.y);
      }
    }

    if (!isFinite(minX) || !isFinite(maxX) || minX >= maxX) {
      minX = 80;
      maxX = 820;
    }
    if (!isFinite(minY) || !isFinite(maxY) || minY >= maxY) {
      minY = 50;
      maxY = 510;
    }

    const boundsW = Math.max(320, maxX - minX);
    const boundsH = Math.max(220, maxY - minY);
    const boundsCenterX = (minX + maxX) / 2;
    const boundsCenterY = (minY + maxY) / 2;

    const paddingX = 80;
    const paddingTop = 75;
    const paddingBottom = 85;
    const availW = Math.max(200, width - paddingX * 2);
    const availH = Math.max(200, height - (paddingTop + paddingBottom));

    let scale = Math.min(availW / boundsW, availH / boundsH);
    scale = Math.max(0.75, Math.min(2.6, scale));

    const targetCenterX = width / 2;
    const targetCenterY = paddingTop + availH / 2;

    const transX = targetCenterX - boundsCenterX * scale;
    const transY = targetCenterY - boundsCenterY * scale;

    return { scale, transX, transY };
  }

  public renderStep(
    step: BlackboardStep,
    viewport?: { zoom: number; rotation: number; panX: number; panY: number },
    precomputedFit?: { scale: number; transX: number; transY: number },
    animationProgress: number = 1.0
  ): boolean {
    if (!this.canvas || !this.ctx) return false;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    try {
      ctx.save();
      ctx.clearRect(0, 0, width, height);

      // 1. YouTube Studio Slate Background with radial depth vignette
      this.drawStudioBackground(ctx, width, height);

      // 2. Subtle Coordinate Grid
      if (this.showGrid) {
        this.drawStudioGrid(ctx, width, height);
      }

      // 3. Auto-fit centering and scale
      const fit = precomputedFit || this.calculateAutoFit(step, width, height);

      // Viewport transformations (zoom, pan, rotation)
      if (viewport) {
        ctx.translate(width / 2 + viewport.panX, height / 2 + viewport.panY);
        if (viewport.rotation !== 0) ctx.rotate((viewport.rotation * Math.PI) / 180);
        if (viewport.zoom !== 1) ctx.scale(viewport.zoom, viewport.zoom);
        ctx.translate(-width / 2, -height / 2);
      }

      ctx.translate(fit.transX, fit.transY);
      ctx.scale(fit.scale, fit.scale);

      // 4. Render elements with animated motion progress
      const elements = step.elements || [];
      const totalElements = elements.length;

      for (let i = 0; i < totalElements; i++) {
        const el = elements[i];
        // Stagger element animation so base elements draw first, then arrows, then labels
        const elemStartProgress = totalElements > 1 ? (i / totalElements) * 0.45 : 0;
        const elemDurationFraction = totalElements > 1 ? (1.0 - elemStartProgress) : 1.0;
        const rawElemProgress = Math.max(0, Math.min(1.0, (animationProgress - elemStartProgress) / elemDurationFraction));
        // Smooth cubic-out easing
        const elemProgress = 1 - Math.pow(1 - rawElemProgress, 3);

        if (elemProgress > 0) {
          this.drawMotionElement(ctx, el, elemProgress);
        }
      }

      ctx.restore();
      return true;
    } catch (err) {
      console.warn('MotionVectorRenderer: Render failed:', err);
      try { ctx.restore(); } catch {}
      return false;
    }
  }

  public animateStep(
    step: BlackboardStep,
    durationMs: number = 650,
    viewport?: { zoom: number; rotation: number; panX: number; panY: number }
  ): void {
    this.stopAnimation();

    if (!this.canvas || !this.ctx) return;
    const elements = step.elements || [];
    if (elements.length === 0) {
      this.renderStep(step, viewport);
      return;
    }

    const fit = this.calculateAutoFit(step, this.canvas.width, this.canvas.height);
    const startTime = performance.now();

    const frame = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);

      this.renderStep(step, viewport, fit, progress);

      if (progress < 1.0) {
        this.animationId = requestAnimationFrame(frame);
      } else {
        this.animationId = null;
      }
    };

    this.animationId = requestAnimationFrame(frame);
  }

  private drawMotionElement(ctx: CanvasRenderingContext2D, el: DrawingElement, progress: number): void {
    ctx.save();
    ctx.globalAlpha = Math.min(1.0, progress * 1.25);

    const color = el.color || '#00f0ff';
    const strokeWidth = el.strokeWidth || 2.5;

    // Optional glow effect for active/accented figures
    if (this.glowEffects && !color.startsWith('rgba(255,255,255,0.')) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (el.type) {
      case 'rect': {
        const x = el.start?.x ?? 100;
        const y = el.start?.y ?? 100;
        const w = el.width ?? (el.end ? Math.abs(el.end.x - x) : 180);
        const h = el.height ?? (el.end ? Math.abs(el.end.y - y) : 80);
        const radius = 10;

        // Card scale pop-in
        const scale = 0.92 + 0.08 * progress;
        const cx = x + w / 2;
        const cy = y + h / 2;

        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);

        // Glassmorphic translucent background fill
        ctx.fillStyle = el.fill || 'rgba(15, 23, 42, 0.75)';
        this.drawRoundedRectPath(ctx, x, y, w, h, radius);
        ctx.fill();

        // Stroke border with subtle gradient/glow
        ctx.strokeStyle = color;
        ctx.stroke();

        if (el.text) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#ffffff';
          ctx.font = '600 14px "Inter", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(el.text, cx, cy);
        }
        break;
      }

      case 'circle': {
        const x = el.start?.x ?? 200;
        const y = el.start?.y ?? 200;
        const radius = el.radius ?? 50;

        // Animated circular sweep: angle from -PI/2 up to -PI/2 + 2*PI*progress
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + Math.PI * 2 * progress;

        if (el.fill || progress >= 0.7) {
          ctx.save();
          ctx.shadowBlur = 0;
          ctx.fillStyle = el.fill || 'rgba(0, 240, 255, 0.08)';
          ctx.globalAlpha = Math.min(1.0, progress * 0.7);
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(x, y, radius, startAngle, endAngle);
        ctx.stroke();

        if (el.text && progress >= 0.5) {
          ctx.save();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#f8fafc';
          ctx.font = '600 14px "Inter", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(el.text, x, y);
          ctx.restore();
        }
        break;
      }

      case 'line': {
        if (!el.start || !el.end) break;
        const currentEndX = el.start.x + (el.end.x - el.start.x) * progress;
        const currentEndY = el.start.y + (el.end.y - el.start.y) * progress;

        ctx.beginPath();
        ctx.moveTo(el.start.x, el.start.y);
        ctx.lineTo(currentEndX, currentEndY);
        ctx.stroke();

        if (el.text && progress >= 0.6) {
          ctx.save();
          ctx.shadowBlur = 0;
          ctx.fillStyle = color;
          ctx.font = '500 13px "Inter", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          const midX = (el.start.x + el.end.x) / 2;
          const midY = (el.start.y + el.end.y) / 2 - 6;
          ctx.fillText(el.text, midX, midY);
          ctx.restore();
        }
        break;
      }

      case 'arrow': {
        if (!el.start || !el.end) break;
        const currentEndX = el.start.x + (el.end.x - el.start.x) * progress;
        const currentEndY = el.start.y + (el.end.y - el.start.y) * progress;

        ctx.beginPath();
        ctx.moveTo(el.start.x, el.start.y);
        ctx.lineTo(currentEndX, currentEndY);
        ctx.stroke();

        // Arrowhead emerges as the line reaches destination
        if (progress > 0.85) {
          const arrowProgress = (progress - 0.85) / 0.15;
          const angle = Math.atan2(el.end.y - el.start.y, el.end.x - el.start.x);
          const headLen = 14 * arrowProgress;
          ctx.beginPath();
          ctx.moveTo(currentEndX, currentEndY);
          ctx.lineTo(
            currentEndX - headLen * Math.cos(angle - Math.PI / 6),
            currentEndY - headLen * Math.sin(angle - Math.PI / 6)
          );
          ctx.moveTo(currentEndX, currentEndY);
          ctx.lineTo(
            currentEndX - headLen * Math.cos(angle + Math.PI / 6),
            currentEndY - headLen * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
        }

        if (el.text && progress >= 0.65) {
          ctx.save();
          ctx.shadowBlur = 0;
          ctx.fillStyle = color;
          ctx.font = '600 13px "Inter", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          const midX = (el.start.x + el.end.x) / 2;
          const midY = (el.start.y + el.end.y) / 2 - 8;
          ctx.fillText(el.text, midX, midY);
          ctx.restore();
        }
        break;
      }

      case 'path': {
        const pathData = el.d || (el as any).path;
        if (!pathData) break;
        try {
          const p2d = new Path2D(pathData);
          if (el.fill) {
            ctx.save();
            ctx.fillStyle = el.fill;
            ctx.globalAlpha = 0.8 * progress;
            ctx.fill(p2d);
            ctx.restore();
          }
          ctx.stroke(p2d);
        } catch {
          // If Path2D parse fails, fallback safely
        }
        break;
      }

      case 'text': {
        if (!el.start || !el.text) break;
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.fillStyle = color;
        ctx.font = '600 15px "Inter", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(el.text, el.start.x, el.start.y);
        ctx.restore();
        break;
      }

      default: {
        PluginManager.getInstance().renderCustomElement(ctx, el);
        break;
      }
    }

    ctx.restore();
  }

  private drawRoundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private drawStudioBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Elegant deep space / educational video slate gradient
    const bgGrad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      60,
      width / 2,
      height / 2,
      width * 0.75
    );
    bgGrad.addColorStop(0, '#131826');
    bgGrad.addColorStop(0.65, '#0b0e17');
    bgGrad.addColorStop(1, '#06070a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  private drawStudioGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    const step = 45;
    for (let x = 20; x < width; x += step) {
      for (let y = 20; y < height; y += step) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }
    ctx.restore();
  }
}
