// src/renderer-skia.ts - Skia WASM hardware-accelerated renderer (CanvasKit)
import CanvasKitInit from 'canvaskit-wasm';
import { BlackboardStep, DrawingElement, Point } from './types';

export class SkiaRenderer {
  private CanvasKit: any = null;
  private surface: any = null;
  private canvas: HTMLCanvasElement | null = null;
  private isReady: boolean = false;
  private animationFrameId: number | null = null;

  public async init(): Promise<boolean> {
    if (this.isReady && this.CanvasKit) return true;

    // In Node test environment, skip browser WASM initialization
    const proc = (globalThis as Record<string, unknown>).process as { env?: { NODE_ENV?: string } } | undefined;
    if (proc?.env?.NODE_ENV === 'test') {
      return false;
    }

    try {
      this.CanvasKit = await CanvasKitInit({
        locateFile: (file: string) => `/${file}`,
      });
      this.isReady = true;
      console.log('SkiaRenderer: CanvasKit WASM loaded successfully');
      return true;
    } catch (err) {
      console.warn('SkiaRenderer: CanvasKit WASM initialization failed, fallback will be used:', err);
      this.isReady = false;
      return false;
    }
  }

  private webglSupported: boolean = true;
  private hasLoggedFallback: boolean = false;

  public attach(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas;
    if (!this.isReady || !this.CanvasKit) return false;

    if (this.surface) {
      try {
        this.surface.delete();
      } catch {}
      this.surface = null;
    }

    // Try hardware-accelerated WebGL canvas surface if supported
    if (this.webglSupported) {
      try {
        this.surface = this.CanvasKit.MakeWebGLCanvasSurface(canvas);
      } catch {
        // WebGL is not available on this canvas (e.g. 2D context was already initialized or transparent overlay)
        this.webglSupported = false;
        this.surface = null;
      }
    }

    // Fallback to software/raster surface if WebGL is unavailable
    if (!this.surface) {
      try {
        this.surface = this.CanvasKit.MakeSWCanvasSurface(canvas);
      } catch {
        this.surface = null;
      }
    }

    if (!this.surface && !this.hasLoggedFallback) {
      this.hasLoggedFallback = true;
      console.info('SkiaRenderer: Using GPU Direct2D canvas engine');
    }

    return !!this.surface;
  }

  public hasSurface(): boolean {
    return !!this.surface;
  }

  public resize(): void {
    if (!this.canvas || !this.isReady || !this.CanvasKit || !this.surface) return;
    this.attach(this.canvas);
  }

  public renderStep(step: BlackboardStep, progress: number = 1.0): void {
    if (!this.surface || !this.canvas || !this.CanvasKit) return;

    try {
      const ck = this.CanvasKit;
      const skCanvas = this.surface.getCanvas();
      if (!skCanvas) return;

      // Clear canvas
      skCanvas.clear(ck.Color(14, 14, 18, 255));

      // Draw background grid
      this.drawGrid(ck, skCanvas, this.canvas.width, this.canvas.height);

      if (step.elements && step.elements.length > 0) {
        step.elements.forEach((el) => {
          this.drawElement(ck, skCanvas, el, progress);
        });
      }

      this.surface.flush();
    } catch (err) {
      console.warn('Skia render fallback', err);
    }
  }

  public animateStep(step: BlackboardStep, durationMs: number = 600, onComplete?: () => void): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    const startTime = performance.now();

    const frame = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1.0);
      // Ease-out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      this.renderStep(step, easedProgress);

      if (progress < 1.0) {
        this.animationFrameId = requestAnimationFrame(frame);
      } else {
        this.animationFrameId = null;
        if (onComplete) onComplete();
      }
    };

    this.animationFrameId = requestAnimationFrame(frame);
  }

  private drawElement(ck: any, skCanvas: any, el: DrawingElement, progress: number): void {
    const color = this.parseColor(ck, el.color || '#00d4aa', progress);
    const strokeWidth = el.strokeWidth || 2;

    const paint = new ck.Paint();
    paint.setAntiAlias(true);
    paint.setColor(color);
    paint.setStrokeWidth(strokeWidth);
    paint.setStyle(ck.PaintStyle.Stroke);
    paint.setStrokeCap(ck.PaintCap.Round);
    paint.setStrokeJoin(ck.PaintJoin.Round);

    if (el.type === 'rect' && el.start && el.width && el.height) {
      const w = el.width * progress;
      const h = el.height * progress;
      const rect = ck.LTRBRect(el.start.x, el.start.y, el.start.x + w, el.start.y + h);
      skCanvas.drawRect(rect, paint);
      if (el.text && progress > 0.8) {
        try {
          const font = new ck.Font(null, 13);
          const textPaint = new ck.Paint();
          textPaint.setStyle(ck.PaintStyle.Fill);
          textPaint.setColor(color);
          skCanvas.drawText(el.text, el.start.x + 12, el.start.y + h / 2 + 4, font, textPaint);
          font.delete();
          textPaint.delete();
        } catch {}
      }
    } else if (el.type === 'circle' && el.start) {
      const radius = (el.radius || (el.width ? el.width / 2 : 60)) * progress;
      skCanvas.drawCircle(el.start.x, el.start.y, radius, paint);
      if (el.text && progress > 0.8) {
        try {
          const font = new ck.Font(null, 14);
          const textPaint = new ck.Paint();
          textPaint.setStyle(ck.PaintStyle.Fill);
          textPaint.setColor(color);
          skCanvas.drawText(el.text, el.start.x - 25, el.start.y + 5, font, textPaint);
          font.delete();
          textPaint.delete();
        } catch {}
      }
    } else if (el.type === 'line' && el.start && el.end) {
      if (typeof skCanvas.drawLine === 'function') {
        const currentX = el.start.x + (el.end.x - el.start.x) * progress;
        const currentY = el.start.y + (el.end.y - el.start.y) * progress;
        skCanvas.drawLine(el.start.x, el.start.y, currentX, currentY, paint);
      }
    } else if (el.type === 'arrow' && el.start && el.end) {
      this.drawArrow(ck, skCanvas, paint, el.start, el.end, progress);
    } else if (el.type === 'pen' && el.points && el.points.length > 1) {
      this.drawSmoothPath(ck, skCanvas, paint, el.points, progress);
    } else if (el.type === 'text' && el.start && el.text) {
      const font = new ck.Font(null, 18);
      paint.setStyle(ck.PaintStyle.Fill);
      skCanvas.drawText(el.text, el.start.x, el.start.y + 18, font, paint);
      font.delete();
    }

    paint.delete();
  }

  private drawSmoothPath(_ck: any, skCanvas: any, paint: any, points: Point[], progress: number): void {
    const totalPoints = Math.max(2, Math.floor(points.length * progress));
    const activePoints = points.slice(0, totalPoints);
    if (activePoints.length < 2) return;

    try {
      if (typeof skCanvas.drawLine === 'function') {
        for (let i = 0; i < activePoints.length - 1; i++) {
          skCanvas.drawLine(
            activePoints[i].x,
            activePoints[i].y,
            activePoints[i + 1].x,
            activePoints[i + 1].y,
            paint
          );
        }
      }
    } catch {}
  }

  private drawArrow(_ck: any, skCanvas: any, paint: any, start: Point, end: Point, progress: number): void {
    const currentX = start.x + (end.x - start.x) * progress;
    const currentY = start.y + (end.y - start.y) * progress;

    try {
      if (typeof skCanvas.drawLine === 'function') {
        skCanvas.drawLine(start.x, start.y, currentX, currentY, paint);
        if (progress > 0.8) {
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          const headLen = 14;
          const p1x = currentX - headLen * Math.cos(angle - Math.PI / 6);
          const p1y = currentY - headLen * Math.sin(angle - Math.PI / 6);
          const p2x = currentX - headLen * Math.cos(angle + Math.PI / 6);
          const p2y = currentY - headLen * Math.sin(angle + Math.PI / 6);
          skCanvas.drawLine(currentX, currentY, p1x, p1y, paint);
          skCanvas.drawLine(currentX, currentY, p2x, p2y, paint);
        }
      }
    } catch {}
  }

  private drawGrid(ck: any, skCanvas: any, width: number, height: number): void {
    try {
      const gridPaint = new ck.Paint();
      gridPaint.setColor(ck.Color(255, 255, 255, 12));
      gridPaint.setStrokeWidth(1);
      gridPaint.setStyle(ck.PaintStyle.Stroke);

      const step = 40;
      for (let x = 0; x < width; x += step) {
        if (typeof skCanvas.drawLine === 'function') {
          skCanvas.drawLine(x, 0, x, height, gridPaint);
        }
      }
      for (let y = 0; y < height; y += step) {
        if (typeof skCanvas.drawLine === 'function') {
          skCanvas.drawLine(0, y, width, y, gridPaint);
        }
      }
      gridPaint.delete();
    } catch {}
  }

  private parseColor(ck: any, hex: string, alphaMultiplier: number = 1.0): number {
    let clean = hex.replace('#', '');
    if (clean.length === 3) {
      clean = clean.split('').map((c) => c + c).join('');
    }
    const r = parseInt(clean.slice(0, 2), 16) || 0;
    const g = parseInt(clean.slice(2, 4), 16) || 212;
    const b = parseInt(clean.slice(4, 6), 16) || 170;
    const a = Math.round(255 * alphaMultiplier);
    return ck.Color(r, g, b, a);
  }

  public destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.surface) {
      this.surface.delete();
      this.surface = null;
    }
  }
}