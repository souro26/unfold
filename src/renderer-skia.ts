// src/renderer-skia.ts - Skia WASM renderer (CanvasKit)
import CanvasKitInit from 'canvaskit-wasm';

type Tool = 'pen' | 'highlighter' | 'eraser' | 'arrow' | 'text';
type Point = { x: number; y: number; pressure?: number; time?: number };
type Stroke = { points: Point[]; tool: Tool; color: string; width: number };

let CanvasKit: any = null;
let canvasKitReady = false;

export async function initSkia(): Promise<any> {
  if (CanvasKit) return CanvasKit;
  
  const Module = await CanvasKitInit({
    locateFile: (file: string) => `/${file}`,
  });
  
  CanvasKit = Module;
  canvasKitReady = true;
  console.log('CanvasKit initialized');
  return CanvasKit;
}

export function isSkiaReady(): boolean {
  return canvasKitReady && CanvasKit !== null;
}

export function hexToSkColor(ck: any, hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return ck.Color(r, g, b, 255);
}

export function drawStroke(ck: any, canvas: any, stroke: Stroke, progress = 1) {
  if (!stroke.points || stroke.points.length < 2) return;
  
  const color = hexToSkColor(ck, stroke.color);
  const width = stroke.width;
  
  const paint = ck.Paint();
  paint.setAntiAlias(true);
  paint.setColor(color);
  paint.setStrokeWidth(width);
  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeCap(ck.PaintCap.Round);
  paint.setStrokeJoin(ck.PaintJoin.Round);
  paint.setAlphaf(progress);
  
  if (stroke.tool === 'highlighter') {
    paint.setBlendMode(ck.BlendMode.Plus);
  } else if (stroke.tool === 'eraser') {
    paint.setBlendMode(ck.BlendMode.Clear);
  }
  
  const path = ck.Path();
  const pts = stroke.points;
  
  path.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2];
    
    for (let t = 0; t <= 10; t++) {
      const tt = t / 10;
      const pos = catmullRom(p0, p1, p2, p3, tt);
      path.lineTo(pos.x, pos.y);
    }
  }
  
  if (pts.length >= 2) {
    const last = pts[pts.length - 1];
    path.lineTo(last.x, last.y);
  }
  
  canvas.drawPath(path, paint);
  
  paint.delete();
  path.delete();
}

function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): { x: number; y: number } {
  const t2 = t * t, t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

export function drawArrow(ck: any, canvas: any, start: Point, end: Point, color: string, width: number, progress = 1) {
  const skColor = hexToSkColor(ck, color);
  const paint = ck.Paint();
  paint.setAntiAlias(true);
  paint.setColor(skColor);
  paint.setStrokeWidth(width);
  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeCap(ck.PaintCap.Round);
  paint.setStrokeJoin(ck.PaintJoin.Round);
  paint.setAlphaf(progress);
  
  const path = ck.Path();
  path.moveTo(start.x, start.y);
  path.lineTo(end.x, end.y);
  
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const headLen = 15;
  path.moveTo(end.x, end.y);
  path.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
  path.moveTo(end.x, end.y);
  path.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
  
  canvas.drawPath(path, paint);
  paint.delete();
  path.delete();
}

export function drawText(ck: any, canvas: any, pos: Point, text: string, color: string, size: number, progress = 1) {
  const skColor = hexToSkColor(ck, color);
  const paint = ck.Paint();
  paint.setAntiAlias(true);
  paint.setColor(skColor);
  paint.setAlphaf(progress);
  
  const font = ck.Font(null, size);
  canvas.drawText(text, pos.x, pos.y + size, font, paint);
  
  paint.delete();
  font.delete();
}

export { CanvasKit, type Stroke, type Point, type Tool };