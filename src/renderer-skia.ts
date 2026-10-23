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
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
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

  public attach(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas;
    if (!this.isReady || !this.CanvasKit) return false;

    try {
      if (this.surface) {
        this.surface.delete();
        this.surface = null;
      }

      // Try hardware-accelerated WebGL canvas surface first
      this.surface = this.CanvasKit.MakeWebGLCanvasSurface(canvas);
      if (!this.surface) {
        // Fallback to software/raster surface
        this.surface = this.CanvasKit.MakeSWCanvasSurface(canvas);
      }

      return !!this.surface;
    } catch (err) {
      console.warn('SkiaRenderer: Surface creation error, falling back to 2D:', err);
      this.surface = null;
      return false;
    }
  }

  public hasSurface(): boolean {
    return !!this.surface;
  }

  public resize(): void {
    if (!this.canvas || !this.isReady || !this.CanvasKit) return;
    this.attach(this.canvas);
  }

  public renderStep(step: BlackboardStep, progress: number = 1.0): void {
    if (!this.surface || !this.canvas || !this.CanvasKit) return;

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
    } else if (el.type === 'line' && el.start && el.end) {
      const currentX = el.start.x + (el.end.x - el.start.x) * progress;
      const currentY = el.start.y + (el.end.y - el.start.y) * progress;
      const path = new ck.Path();
      path.moveTo(el.start.x, el.start.y);
      path.lineTo(currentX, currentY);
      skCanvas.drawPath(path, paint);
      path.delete();
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

  private drawSmoothPath(ck: any, skCanvas: any, paint: any, points: Point[], progress: number): void {
    const totalPoints = Math.max(2, Math.floor(points.length * progress));
    const activePoints = points.slice(0, totalPoints);
    if (activePoints.length < 2) return;

    const path = new ck.Path();
    path.moveTo(activePoints[0].x, activePoints[0].y);

    for (let i = 1; i < activePoints.length - 2; i++) {
      const p0 = activePoints[i - 1];
      const p1 = activePoints[i];
      const p2 = activePoints[i + 1];
      const p3 = activePoints[i + 2];

      for (let t = 0; t <= 5; t++) {
        const tt = t / 5;
        const pt = this.catmullRom(p0, p1, p2, p3, tt);
        path.lineTo(pt.x, pt.y);
      }
    }

    const last = activePoints[activePoints.length - 1];
    path.lineTo(last.x, last.y);
    skCanvas.drawPath(path, paint);
    path.delete();
  }

  private drawArrow(ck: any, skCanvas: any, paint: any, start: Point, end: Point, progress: number): void {
    const currentX = start.x + (end.x - start.x) * progress;
    const currentY = start.y + (end.y - start.y) * progress;

    const path = new ck.Path();
    path.moveTo(start.x, start.y);
    path.lineTo(currentX, currentY);

    if (progress > 0.8) {
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLen = 14;
      path.moveTo(currentX, currentY);
      path.lineTo(
        currentX - headLen * Math.cos(angle - Math.PI / 6),
        currentY - headLen * Math.sin(angle - Math.PI / 6)
      );
      path.moveTo(currentX, currentY);
      path.lineTo(
        currentX - headLen * Math.cos(angle + Math.PI / 6),
        currentY - headLen * Math.sin(angle + Math.PI / 6)
      );
    }

    skCanvas.drawPath(path, paint);
    path.delete();
  }

  private drawGrid(ck: any, skCanvas: any, width: number, height: number): void {
    const gridPaint = new ck.Paint();
    gridPaint.setColor(ck.Color(255, 255, 255, 12));
    gridPaint.setStrokeWidth(1);
    gridPaint.setStyle(ck.PaintStyle.Stroke);

    const step = 40;
    const path = new ck.Path();

    for (let x = 0; x < width; x += step) {
      path.moveTo(x, 0);
      path.lineTo(x, height);
    }
    for (let y = 0; y < height; y += step) {
      path.moveTo(0, y);
      path.lineTo(width, y);
    }

    skCanvas.drawPath(path, gridPaint);
    path.delete();
    gridPaint.delete();
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

  private catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    };
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