import { BlackboardStep, Point, DrawingElement } from '../types';
import { SpeechService } from '../services/speech';
import { SkiaRenderer } from '../renderer-skia';
import { ExportService } from '../services/export';
import { PluginManager } from '../services/PluginManager';
import { StylusService, StylusCurveProfile } from '../services/stylus';

export class BlackboardView {
  private overlayEl: HTMLElement;
  private canvasEl: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private closeBtn: HTMLButtonElement;
  private fullscreenBtn: HTMLButtonElement;
  private presentationBtn: HTMLButtonElement;
  private stepPrevBtn: HTMLButtonElement;
  private stepNextBtn: HTMLButtonElement;
  private stepPlayBtn: HTMLButtonElement;
  private stepVoiceBtn: HTMLButtonElement;
  private stepIndicator: HTMLElement;
  private titleEl: HTMLElement;
  private descEl: HTMLElement;

  // Export elements
  private exportBtn: HTMLButtonElement | null;
  private exportMenu: HTMLElement | null;
  private exportMermaidBtn: HTMLElement | null;
  private exportExcalidrawBtn: HTMLElement | null;
  private exportPlantUMLBtn: HTMLElement | null;
  private exportManimBtn: HTMLElement | null;

  // Presentation HUD elements
  private hudPrevBtn: HTMLButtonElement;
  private hudNextBtn: HTMLButtonElement;
  private hudPlayBtn: HTMLButtonElement;
  private hudExitBtn: HTMLButtonElement;
  private hudStepBadge: HTMLElement;

  private currentSteps: BlackboardStep[] = [];
  private currentStepIndex: number = 0;
  private isPlaying: boolean = false;
  private isPresentation: boolean = false;
  private playTimer: ReturnType<typeof setTimeout> | null = null;
  private skiaRenderer: SkiaRenderer;

  // Stylus pen drawing & pressure calibration state
  private stylusService: StylusService = new StylusService();
  private activeStroke: Point[] | null = null;
  private isDrawing: boolean = false;

  // Advanced gesture recognition state
  private viewport = {
    zoom: 1.0,
    rotation: 0,
    panX: 0,
    panY: 0,
  };
  private touchGesture = {
    initialDistance: 0,
    initialAngle: 0,
    initialZoom: 1.0,
    initialRotation: 0,
    lastPanX: 0,
    lastPanY: 0,
  };

  constructor() {
    this.overlayEl = document.getElementById('vizOverlay') as HTMLElement;
    this.canvasEl = document.getElementById('vizCanvas') as HTMLCanvasElement;
    this.closeBtn = document.getElementById('vizClose') as HTMLButtonElement;
    this.fullscreenBtn = document.getElementById('vizFullscreen') as HTMLButtonElement;
    this.presentationBtn = document.getElementById('vizPresentation') as HTMLButtonElement;
    this.stepPrevBtn = document.getElementById('stepPrev') as HTMLButtonElement;
    this.stepNextBtn = document.getElementById('stepNext') as HTMLButtonElement;
    this.stepPlayBtn = document.getElementById('stepPlay') as HTMLButtonElement;
    this.stepVoiceBtn = document.getElementById('stepVoice') as HTMLButtonElement;
    this.stepIndicator = document.getElementById('stepIndicator') as HTMLElement;
    this.titleEl = document.getElementById('vizTitle') as HTMLElement;
    this.descEl = document.getElementById('vizDescription') as HTMLElement;

    // Export elements
    this.exportBtn = document.getElementById('vizExportBtn') as HTMLButtonElement | null;
    this.exportMenu = document.getElementById('exportMenu') as HTMLElement | null;
    this.exportMermaidBtn = document.getElementById('exportMermaid');
    this.exportExcalidrawBtn = document.getElementById('exportExcalidraw');
    this.exportPlantUMLBtn = document.getElementById('exportPlantUML');
    this.exportManimBtn = document.getElementById('exportManim');

    // Presentation HUD
    this.hudPrevBtn = document.getElementById('hudPrev') as HTMLButtonElement;
    this.hudNextBtn = document.getElementById('hudNext') as HTMLButtonElement;
    this.hudPlayBtn = document.getElementById('hudPlay') as HTMLButtonElement;
    this.hudExitBtn = document.getElementById('hudExit') as HTMLButtonElement;
    this.hudStepBadge = document.getElementById('hudStepBadge') as HTMLElement;

    if (this.canvasEl) {
      this.ctx = this.canvasEl.getContext('2d');
    }

    this.skiaRenderer = new SkiaRenderer();
    this.bindEvents();
    this.setupGestureListeners();
    this.setupStylusListeners();
  }

  private bindEvents(): void {
    this.closeBtn?.addEventListener('click', () => this.close());
    this.fullscreenBtn?.addEventListener('click', () => this.toggleFullscreen());
    this.presentationBtn?.addEventListener('click', () => this.togglePresentationMode());
    this.stepPrevBtn?.addEventListener('click', () => this.prevStep());
    this.stepNextBtn?.addEventListener('click', () => this.nextStep());
    this.stepPlayBtn?.addEventListener('click', () => this.toggleAutoplay());
    this.stepVoiceBtn?.addEventListener('click', () => this.narrateCurrentStep());

    // Export dropdown events
    this.exportBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.exportMenu?.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (this.exportMenu && !this.exportMenu.contains(e.target as Node)) {
        this.exportMenu.classList.add('hidden');
      }
    });

    this.exportMermaidBtn?.addEventListener('click', () => this.exportDiagram('mermaid'));
    this.exportExcalidrawBtn?.addEventListener('click', () => this.exportDiagram('excalidraw'));
    this.exportPlantUMLBtn?.addEventListener('click', () => this.exportDiagram('plantuml'));
    this.exportManimBtn?.addEventListener('click', () => this.exportDiagram('manim'));

    // Presentation HUD events
    this.hudPrevBtn?.addEventListener('click', () => this.prevStep());
    this.hudNextBtn?.addEventListener('click', () => this.nextStep());
    this.hudPlayBtn?.addEventListener('click', () => this.toggleAutoplay());
    this.hudExitBtn?.addEventListener('click', () => this.exitPresentationMode());

    window.addEventListener('resize', () => {
      if (this.isOpen()) this.resizeCanvas();
    });

    // Keyboard navigation in blackboard / presentation mode
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen()) return;

      if (e.key === 'F5') {
        e.preventDefault();
        this.togglePresentationMode();
        return;
      }

      if (this.isPresentation) {
        if (e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault();
          this.nextStep();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.prevStep();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.exitPresentationMode();
        }
      }

      // Reset zoom and rotation with '0'
      if (e.key === '0' || e.key === 'r') {
        this.resetViewport();
      }
    });
  }

  private setupGestureListeners(): void {
    if (!this.canvasEl) return;

    // Trackpad / Mouse wheel pinch-to-zoom and pan
    this.canvasEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey) {
        // Pinch-zoom
        const zoomDelta = e.deltaY < 0 ? 1.08 : 0.92;
        this.handlePinchZoom(zoomDelta);
      } else {
        // Pan
        this.handlePan(-e.deltaX, -e.deltaY);
      }
    }, { passive: false });

    // Multi-touch pinch-to-zoom and rotation gestures
    this.canvasEl.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        this.touchGesture.initialDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        this.touchGesture.initialAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
        this.touchGesture.initialZoom = this.viewport.zoom;
        this.touchGesture.initialRotation = this.viewport.rotation;
        this.touchGesture.lastPanX = (t1.clientX + t2.clientX) / 2;
        this.touchGesture.lastPanY = (t1.clientY + t2.clientY) / 2;
      }
    }, { passive: false });

    this.canvasEl.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const currentAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);

        // Calculate pinch scale
        if (this.touchGesture.initialDistance > 0) {
          const scale = currentDistance / this.touchGesture.initialDistance;
          this.viewport.zoom = Math.max(0.2, Math.min(5.0, this.touchGesture.initialZoom * scale));
        }

        // Calculate rotation
        const angleDiff = currentAngle - this.touchGesture.initialAngle;
        this.viewport.rotation = this.touchGesture.initialRotation + angleDiff;

        // Calculate pan midpoint shift
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        this.viewport.panX += midX - this.touchGesture.lastPanX;
        this.viewport.panY += midY - this.touchGesture.lastPanY;
        this.touchGesture.lastPanX = midX;
        this.touchGesture.lastPanY = midY;

        this.drawCanvas();
      }
    }, { passive: false });

    this.canvasEl.addEventListener('dblclick', () => {
      this.resetViewport();
    });
  }

  private setupStylusListeners(): void {
    if (!this.canvasEl) return;

    this.canvasEl.style.touchAction = 'none';

    this.canvasEl.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;

      const rect = this.canvasEl.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      const cx = this.canvasEl.width / 2;
      const cy = this.canvasEl.height / 2;
      const pt = this.screenToCanvas(rawX, rawY, cx, cy);

      const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure : (e.pointerType === 'pen' ? 0.35 : 0.5);
      const point: Point = {
        x: pt.x,
        y: pt.y,
        pressure,
        tiltX: e.tiltX,
        tiltY: e.tiltY,
      };

      this.isDrawing = true;
      this.activeStroke = [point];

      try {
        if (typeof this.canvasEl.setPointerCapture === 'function') {
          this.canvasEl.setPointerCapture(e.pointerId);
        }
      } catch {}
    });

    this.canvasEl.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.isDrawing || !this.activeStroke) return;

      const rect = this.canvasEl.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      const cx = this.canvasEl.width / 2;
      const cy = this.canvasEl.height / 2;
      const pt = this.screenToCanvas(rawX, rawY, cx, cy);

      const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure : (e.pointerType === 'pen' ? 0.35 : 0.5);
      const point: Point = {
        x: pt.x,
        y: pt.y,
        pressure,
        tiltX: e.tiltX,
        tiltY: e.tiltY,
      };

      this.activeStroke.push(point);
      this.drawCanvas();
    });

    const endStroke = (e: PointerEvent) => {
      if (!this.isDrawing) return;
      this.isDrawing = false;

      if (this.activeStroke && this.activeStroke.length > 1) {
        const smoothed = this.stylusService.smoothPoints(this.activeStroke);
        const newElement: DrawingElement = {
          id: `pen_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type: 'pen',
          color: '#00f0ff',
          strokeWidth: 3,
          points: smoothed,
        };

        if (this.currentSteps.length > 0) {
          const step = this.currentSteps[this.currentStepIndex];
          if (!step.elements) step.elements = [];
          step.elements.push(newElement);
        }
      }

      this.activeStroke = null;
      try {
        if (typeof this.canvasEl.releasePointerCapture === 'function') {
          this.canvasEl.releasePointerCapture(e.pointerId);
        }
      } catch {}
      this.drawCanvas();
    };

    this.canvasEl.addEventListener('pointerup', endStroke);
    this.canvasEl.addEventListener('pointercancel', endStroke);
  }

  public screenToCanvas(screenX: number, screenY: number, cx: number, cy: number): { x: number; y: number } {
    let x = screenX - (cx + this.viewport.panX);
    let y = screenY - (cy + this.viewport.panY);

    if (this.viewport.rotation !== 0) {
      const cos = Math.cos(-this.viewport.rotation);
      const sin = Math.sin(-this.viewport.rotation);
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      x = rx;
      y = ry;
    }

    x = x / this.viewport.zoom + cx;
    y = y / this.viewport.zoom + cy;

    return { x, y };
  }

  public getStylusService(): StylusService {
    return this.stylusService;
  }

  public setStylusProfile(profile: StylusCurveProfile): void {
    this.stylusService.setProfile(profile);
  }

  public isDrawingActive(): boolean {
    return this.isDrawing;
  }

  public getActiveStroke(): Point[] | null {
    return this.activeStroke ? [...this.activeStroke] : null;
  }

  public getViewport(): { zoom: number; rotation: number; panX: number; panY: number } {
    return { ...this.viewport };
  }

  public resetViewport(): void {
    this.viewport = {
      zoom: 1.0,
      rotation: 0,
      panX: 0,
      panY: 0,
    };
    this.drawCanvas();
  }

  public handlePinchZoom(scaleMultiplier: number): void {
    this.viewport.zoom = Math.max(0.2, Math.min(5.0, this.viewport.zoom * scaleMultiplier));
    this.drawCanvas();
  }

  public handleRotate(radiansDelta: number): void {
    this.viewport.rotation += radiansDelta;
    this.drawCanvas();
  }

  public handlePan(dx: number, dy: number): void {
    this.viewport.panX += dx;
    this.viewport.panY += dy;
    this.drawCanvas();
  }

  public async open(steps: BlackboardStep[]): Promise<void> {
    this.currentSteps = steps;
    this.currentStepIndex = 0;
    this.overlayEl?.classList.add('visible');
    this.renderCurrentStep();

    // Attempt hardware-accelerated Skia WASM initialization
    const skiaLoaded = await this.skiaRenderer.init();
    this.resizeCanvas();

    if (skiaLoaded && this.canvasEl) {
      this.skiaRenderer.attach(this.canvasEl);
    }

    this.drawCanvas();
  }

  public close(): void {
    this.stopAutoplay();
    SpeechService.stop();
    this.exitPresentationMode();
    this.skiaRenderer.destroy();
    this.overlayEl?.classList.remove('visible');
  }

  public isOpen(): boolean {
    return this.overlayEl?.classList.contains('visible') || false;
  }

  public isPresentationMode(): boolean {
    return this.isPresentation;
  }

  public togglePresentationMode(): void {
    if (this.isPresentation) {
      this.exitPresentationMode();
    } else {
      this.enterPresentationMode();
    }
  }

  public enterPresentationMode(): void {
    this.isPresentation = true;
    this.overlayEl?.classList.add('presentation-mode');
    this.presentationBtn?.classList.add('active');
    this.resizeCanvas();
    this.renderCurrentStep();
  }

  public exitPresentationMode(): void {
    this.isPresentation = false;
    this.overlayEl?.classList.remove('presentation-mode');
    this.presentationBtn?.classList.remove('active');
    this.resizeCanvas();
    this.renderCurrentStep();
  }

  private resizeCanvas(): void {
    if (!this.canvasEl) return;
    const rect = this.canvasEl.parentElement?.getBoundingClientRect();
    if (rect) {
      this.canvasEl.width = rect.width;
      this.canvasEl.height = rect.height;
      this.skiaRenderer.resize();
      this.drawCanvas();
    }
  }

  public renderCurrentStep(): void {
    if (this.currentSteps.length === 0) return;
    const step = this.currentSteps[this.currentStepIndex];

    const stepLabel = `Step ${this.currentStepIndex + 1} of ${this.currentSteps.length}`;
    if (this.titleEl) this.titleEl.textContent = step.title;
    if (this.descEl) this.descEl.textContent = step.explanation;
    if (this.stepIndicator) this.stepIndicator.textContent = stepLabel;
    if (this.hudStepBadge) this.hudStepBadge.textContent = `${stepLabel}: ${step.title}`;

    const isFirst = this.currentStepIndex === 0;
    const isLast = this.currentStepIndex === this.currentSteps.length - 1;

    if (this.stepPrevBtn) this.stepPrevBtn.disabled = isFirst;
    if (this.stepNextBtn) this.stepNextBtn.disabled = isLast;
    if (this.hudPrevBtn) this.hudPrevBtn.disabled = isFirst;
    if (this.hudNextBtn) this.hudNextBtn.disabled = isLast;

    PluginManager.getInstance().notifyStepRender(step);
    this.drawCanvas();
  }

  private drawCanvas(): void {
    if (this.currentSteps.length === 0) return;
    const step = this.currentSteps[this.currentStepIndex];

    // Prefer hardware-accelerated Skia renderer if surface is active
    if (this.skiaRenderer.hasSurface()) {
      this.skiaRenderer.animateStep(step, 500);
      return;
    }

    // High quality 2D canvas fallback
    if (!this.ctx || !this.canvasEl) return;
    this.ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);

    this.ctx.save();
    const cx = this.canvasEl.width / 2;
    const cy = this.canvasEl.height / 2;
    this.ctx.translate(cx + this.viewport.panX, cy + this.viewport.panY);
    this.ctx.rotate(this.viewport.rotation);
    this.ctx.scale(this.viewport.zoom, this.viewport.zoom);
    this.ctx.translate(-cx, -cy);

    this.drawGrid();

    if (step.elements) {
      step.elements.forEach((el) => {
        if (!this.ctx) return;
        this.ctx.strokeStyle = el.color || '#00d4aa';
        this.ctx.lineWidth = el.strokeWidth || 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        if (el.type === 'rect' && el.start && el.width && el.height) {
          this.ctx.strokeRect(el.start.x, el.start.y, el.width, el.height);
        } else if (el.type === 'line' && el.start && el.end) {
          this.ctx.beginPath();
          this.ctx.moveTo(el.start.x, el.start.y);
          this.ctx.lineTo(el.end.x, el.end.y);
          this.ctx.stroke();
        } else if (el.type === 'pen' && el.points && el.points.length > 1) {
          for (let i = 0; i < el.points.length - 1; i++) {
            const p1 = el.points[i];
            const p2 = el.points[i + 1];
            const metrics = this.stylusService.calculateStrokeMetrics(p1, el.strokeWidth || 3);
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.lineWidth = metrics.width;
            this.ctx.globalAlpha = metrics.opacity;
            this.ctx.strokeStyle = el.color || '#00f0ff';
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.lineTo(p2.x, p2.y);
            this.ctx.stroke();
            this.ctx.restore();
          }
        } else {
          PluginManager.getInstance().renderCustomElement(this.ctx, el);
        }
      });
    }

    // Render active in-progress stylus stroke
    if (this.ctx && this.activeStroke && this.activeStroke.length > 1) {
      for (let i = 0; i < this.activeStroke.length - 1; i++) {
        const p1 = this.activeStroke[i];
        const p2 = this.activeStroke[i + 1];
        const metrics = this.stylusService.calculateStrokeMetrics(p1, 3);
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.lineWidth = metrics.width;
        this.ctx.globalAlpha = metrics.opacity;
        this.ctx.strokeStyle = '#00f0ff';
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();
        this.ctx.restore();
      }
    }

    this.ctx.restore();
  }

  private drawGrid(): void {
    if (!this.ctx || !this.canvasEl) return;
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    this.ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < this.canvasEl.width; x += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvasEl.height);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.canvasEl.height; y += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvasEl.width, y);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  public nextStep(): void {
    if (this.currentStepIndex < this.currentSteps.length - 1) {
      this.currentStepIndex++;
      this.renderCurrentStep();
    } else {
      this.stopAutoplay();
    }
  }

  public prevStep(): void {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.renderCurrentStep();
    }
  }

  public toggleAutoplay(): void {
    if (this.isPlaying) {
      this.stopAutoplay();
    } else {
      this.startAutoplay();
    }
  }

  private startAutoplay(): void {
    this.isPlaying = true;
    if (this.stepPlayBtn) this.stepPlayBtn.textContent = 'Pause';
    this.playNextLoop();
  }

  private playNextLoop(): void {
    if (!this.isPlaying) return;
    this.playTimer = setTimeout(() => {
      if (this.currentStepIndex < this.currentSteps.length - 1) {
        this.nextStep();
        this.playNextLoop();
      } else {
        this.stopAutoplay();
      }
    }, 3500);
  }

  private stopAutoplay(): void {
    this.isPlaying = false;
    if (this.playTimer) clearTimeout(this.playTimer);
    if (this.stepPlayBtn) this.stepPlayBtn.textContent = 'Autoplay';
  }

  public narrateCurrentStep(): void {
    const step = this.currentSteps[this.currentStepIndex];
    if (!step) return;

    if (SpeechService.isSpeaking()) {
      SpeechService.stop();
      if (this.stepVoiceBtn) this.stepVoiceBtn.textContent = 'Narrate';
      return;
    }

    if (this.stepVoiceBtn) this.stepVoiceBtn.textContent = 'Speaking...';

    SpeechService.speak(`${step.title}. ${step.explanation}`, {
      rate: 1.0,
      onEnd: () => {
        if (this.stepVoiceBtn) this.stepVoiceBtn.textContent = 'Narrate';
        if (this.isPlaying && this.currentStepIndex < this.currentSteps.length - 1) {
          setTimeout(() => this.nextStep(), 800);
        }
      },
      onError: () => {
        if (this.stepVoiceBtn) this.stepVoiceBtn.textContent = 'Narrate';
      },
    });
  }

  public exportDiagram(format: 'mermaid' | 'excalidraw' | 'plantuml' | 'manim' | string): void {
    this.exportMenu?.classList.add('hidden');
    if (this.currentSteps.length === 0) return;

    if (format === 'mermaid') {
      const code = ExportService.toMermaid(this.currentSteps);
      ExportService.downloadFile('diagram.mmd', code, 'text/vnd.mermaid');
    } else if (format === 'excalidraw') {
      const json = ExportService.toExcalidraw(this.currentSteps);
      ExportService.downloadFile('diagram.excalidraw', JSON.stringify(json, null, 2), 'application/json');
    } else if (format === 'plantuml') {
      const puml = ExportService.toPlantUML(this.currentSteps);
      ExportService.downloadFile('diagram.puml', puml, 'text/plain');
    } else if (format === 'manim') {
      const code = ExportService.toManim(this.currentSteps);
      ExportService.downloadFile('scene.py', code, 'text/x-python');
    } else {
      const pluginExport = PluginManager.getInstance().executeExport(format, this.currentSteps);
      if (pluginExport) {
        ExportService.downloadFile(pluginExport.filename, pluginExport.content, pluginExport.mimeType);
      }
    }
  }

  public toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      this.overlayEl?.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  }
}
