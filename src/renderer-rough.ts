import rough from 'roughjs';
import { BlackboardStep, DrawingElement } from './types';
import { PluginManager } from './services/PluginManager';

export interface RoughRendererOptions {
  roughness?: number;
  bowing?: number;
  chalkDust?: boolean;
}

export class RoughRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rc: any = null;
  private animationId: number | null = null;
  private roughness: number = 1.4;
  private bowing: number = 1.2;
  private showChalkDust: boolean = true;
  private seed: number = 12345;
  public onRenderError: ((err: any) => void) | null = null;

  constructor(options?: RoughRendererOptions) {
    if (options?.roughness !== undefined) this.roughness = options.roughness;
    if (options?.bowing !== undefined) this.bowing = options.bowing;
    if (options?.chalkDust !== undefined) this.showChalkDust = options.chalkDust;
  }

  public isAvailable(): boolean {
    return !!(this.canvas && this.ctx && this.rc);
  }

  public attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    if (canvas && typeof canvas.getContext === 'function') {
      try {
        this.ctx = canvas.getContext('2d');
        this.rc = rough.canvas(canvas);
      } catch (err) {
        console.warn('RoughRenderer: Failed to initialize rough.canvas:', err);
      }
    }
  }

  public resize(): void {
    if (this.canvas && typeof this.canvas.getContext === 'function') {
      try {
        this.ctx = this.canvas.getContext('2d');
        this.rc = rough.canvas(this.canvas);
      } catch (err) {
        console.warn('RoughRenderer: Failed to rebind rough.canvas on resize:', err);
      }
    }
  }

  public stopAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  public detach(): void {
    this.stopAnimation();
    this.canvas = null;
    this.ctx = null;
    this.rc = null;
  }

  public calculateAutoFit(step: BlackboardStep, width: number, height: number): { scale: number; transX: number; transY: number } {
    const elements = step.elements || [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const el of elements) {
      if (el.start) {
        const r = el.radius || 0;
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

    // Available drawing area reserving margins for top title/toolbar and bottom video timeline controls
    const paddingX = 80;
    const paddingTop = 75;
    const paddingBottom = 85;
    const availW = Math.max(200, width - paddingX * 2);
    const availH = Math.max(200, height - (paddingTop + paddingBottom));

    // Calculate scale factor to comfortably fill ~85% of screen (between 0.75x and 2.6x)
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
    precomputedFit?: { scale: number; transX: number; transY: number }
  ): boolean {
    if (!this.canvas || !this.ctx || !this.rc) return false;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    try {
      ctx.save();
      ctx.clearRect(0, 0, width, height);

      // Blackboard background & subtle chalk dust texture
      this.drawBlackboardBackground(ctx, width, height);

      // Compute or use auto-fit centering & scaling so drawings utilize the FULL screen
      const fit = precomputedFit || this.calculateAutoFit(step, width, height);

      // Viewport transformations (user zoom, pan, rotation around screen center)
      if (viewport) {
        ctx.translate(width / 2 + viewport.panX, height / 2 + viewport.panY);
        if (viewport.rotation !== 0) ctx.rotate((viewport.rotation * Math.PI) / 180);
        if (viewport.zoom !== 1) ctx.scale(viewport.zoom, viewport.zoom);
        ctx.translate(-width / 2, -height / 2);
      }

      // Auto-fit centering and scale
      ctx.translate(fit.transX, fit.transY);
      ctx.scale(fit.scale, fit.scale);

      // Draw all elements for the step
      const elements = step.elements || [];
      for (const el of elements) {
        this.drawElement(el);
      }

      ctx.restore();
      return true;
    } catch (err) {
      console.warn('RoughRenderer: Rendering failed, falling back:', err);
      try { ctx.restore(); } catch {}
      return false;
    }
  }

  public animateStep(step: BlackboardStep, durationMs: number = 600, viewport?: { zoom: number; rotation: number; panX: number; panY: number }): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (!this.canvas || !this.ctx || !this.rc) return;
    const elements = step.elements || [];
    if (elements.length === 0) {
      this.renderStep(step, viewport);
      return;
    }

    // Precompute auto-fit layout based on FULL accumulated step so coordinate frame stays rock-solid
    const fit = this.calculateAutoFit(step, this.canvas.width, this.canvas.height);
    const startTime = performance.now();
    const totalElements = elements.length;

    const frame = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);

      // Calculate how many elements to reveal progressively
      const visibleCount = Math.max(1, Math.min(totalElements, Math.ceil(progress * totalElements)));
      const partialStep: BlackboardStep = {
        ...step,
        elements: elements.slice(0, visibleCount),
      };

      this.renderStep(partialStep, viewport, fit);

      if (progress < 1.0) {
        this.animationId = requestAnimationFrame(frame);
      } else {
        this.animationId = null;
      }
    };

    this.animationId = requestAnimationFrame(frame);
  }

  private drawElement(el: DrawingElement): void {
    if (!this.rc || !this.ctx) return;
    const rc = this.rc;

    const roughness = el.roughness ?? this.roughness;
    const stroke = el.color || '#e2f0d9';
    const strokeWidth = el.strokeWidth || 2;
    const fill = el.fill || undefined;
    const fillStyle = el.fillStyle || (fill ? 'hachure' : undefined);

    const roughOptions: any = {
      stroke,
      strokeWidth,
      roughness,
      bowing: this.bowing,
      seed: this.seed++,
    };

    if (fill) {
      roughOptions.fill = fill;
      roughOptions.fillStyle = fillStyle || 'hachure';
      roughOptions.hachureGap = 6;
      roughOptions.hachureAngle = 60;
    }

    switch (el.type) {
      case 'rect': {
        const x = el.start?.x ?? 100;
        const y = el.start?.y ?? 100;
        const w = el.width ?? (el.end ? Math.abs(el.end.x - x) : 160);
        const h = el.height ?? (el.end ? Math.abs(el.end.y - y) : 80);
        rc.rectangle(x, y, w, h, roughOptions);

        if (el.text) {
          this.drawChalkText(el.text, x + w / 2, y + h / 2 + 5, stroke, 14, true);
        }
        break;
      }

      case 'circle': {
        const x = el.start?.x ?? 200;
        const y = el.start?.y ?? 200;
        const radius = el.radius ?? 50;
        rc.circle(x, y, radius * 2, roughOptions);

        if (el.text) {
          this.drawChalkText(el.text, x, y + 4, stroke, 13, true);
        }
        break;
      }

      case 'line': {
        const x1 = el.start?.x ?? 0;
        const y1 = el.start?.y ?? 0;
        const x2 = el.end?.x ?? x1 + 100;
        const y2 = el.end?.y ?? y1;
        rc.line(x1, y1, x2, y2, roughOptions);

        if (el.text) {
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2 - 12;
          this.drawChalkText(el.text, midX, midY, stroke, 12, true);
        }
        break;
      }

      case 'arrow': {
        const x1 = el.start?.x ?? 0;
        const y1 = el.start?.y ?? 0;
        const x2 = el.end?.x ?? x1 + 100;
        const y2 = el.end?.y ?? y1;

        // Draw main shaft with rough line
        rc.line(x1, y1, x2, y2, roughOptions);

        // Arrowhead geometry
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLength = Math.max(12, strokeWidth * 4.5);
        const headAngle = Math.PI / 6; // 30 degrees

        const ax1 = x2 - headLength * Math.cos(angle - headAngle);
        const ay1 = y2 - headLength * Math.sin(angle - headAngle);
        const ax2 = x2 - headLength * Math.cos(angle + headAngle);
        const ay2 = y2 - headLength * Math.sin(angle + headAngle);

        rc.line(x2, y2, ax1, ay1, roughOptions);
        rc.line(x2, y2, ax2, ay2, roughOptions);

        if (el.text) {
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2 - 12;
          this.drawChalkText(el.text, midX, midY, stroke, 12, true);
        }
        break;
      }

      case 'path': {
        const pathData = el.d || (el as any).pathDescription;
        if (pathData) {
          rc.path(pathData, roughOptions);
        }
        if (el.text && el.start) {
          this.drawChalkText(el.text, el.start.x, el.start.y - 10, stroke, 12, true);
        }
        break;
      }

      case 'pen': {
        const points = el.points || [];
        if (points.length >= 2) {
          const ptArray: [number, number][] = points.map(p => [p.x, p.y]);
          rc.curve(ptArray, roughOptions);
        }
        break;
      }

      case 'text': {
        const x = el.start?.x ?? 100;
        const y = el.start?.y ?? 100;
        const text = el.text || '';
        this.drawChalkText(text, x, y, stroke, 14, false);
        break;
      }

      default: {
        // Fallback drawing for any custom plugin or unhandled primitive
        if (this.ctx) {
          try {
            PluginManager.getInstance().renderCustomElement(this.ctx, el);
          } catch {}
        }
        if (el.start && el.end) {
          rc.line(el.start.x, el.start.y, el.end.x, el.end.y, roughOptions);
        }
        break;
      }
    }
  }

  private drawChalkText(text: string, x: number, y: number, color: string, fontSize: number = 14, center: boolean = false): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `500 ${fontSize}px "Outfit", "Inter", -apple-system, sans-serif`;
    ctx.textAlign = center ? 'center' : 'left';
    ctx.textBaseline = 'middle';

    // Subtle chalk dust glow behind text
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  private drawBlackboardBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Rich chalkboard slate background
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width * 0.7);
    bgGrad.addColorStop(0, '#1c1e24');
    bgGrad.addColorStop(1, '#0e1014');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    if (!this.showChalkDust) return;

    // Organic chalk dust particles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    const count = 48;
    for (let i = 0; i < count; i++) {
      const px = ((Math.sin(i * 91 + 17) * 0.5 + 0.5) * width);
      const py = ((Math.cos(i * 47 + 23) * 0.5 + 0.5) * height);
      ctx.fillRect(px, py, 1.5, 1.5);
    }
  }
}
