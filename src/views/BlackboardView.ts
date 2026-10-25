import { BlackboardStep, Point, DrawingElement } from '../types';
import { SpeechService } from '../services/speech';
import { SkiaRenderer } from '../renderer-skia';
import { RoughRenderer } from '../renderer-rough';
import { ExportService } from '../services/export';
import { PluginManager } from '../services/PluginManager';
import { StylusService, StylusCurveProfile } from '../services/stylus';

export interface BlackboardViewCallbacks {
  onBack?: () => void;
  onToggleAgent?: () => void;
}

export class BlackboardView {
  private callbacks?: BlackboardViewCallbacks;
  private overlayEl: HTMLElement;
  private canvasEl: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private backBtn: HTMLButtonElement | null = null;
  private agentToggleBtn: HTMLButtonElement | null = null;
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

  // Render Engine (Rough.js Chalkboard primary, Skia / 2D fallback)
  private roughRenderer: RoughRenderer;
  private renderModeBtn: HTMLButtonElement | null = null;
  private renderModeLabel: HTMLElement | null = null;
  private renderEngine: 'rough' | 'skia' = 'rough';

  // Video Stream Player Elements
  private videoStreamBar: HTMLElement | null = null;
  private videoSubtitles: HTMLElement | null = null;
  private videoSubtitlesText: HTMLElement | null = null;
  private videoCurrentTimeEl: HTMLElement | null = null;
  private videoTotalTimeEl: HTMLElement | null = null;
  private videoScrubber: HTMLInputElement | null = null;
  private videoProgressFill: HTMLElement | null = null;
  private videoPlayPauseBtn: HTMLButtonElement | null = null;
  private videoPlayLabel: HTMLElement | null = null;
  private videoPlayIcon: SVGElement | null = null;
  private videoReplayBtn: HTMLButtonElement | null = null;
  private videoSceneIndicator: HTMLElement | null = null;
  private videoSpeedBtn: HTMLButtonElement | null = null;
  private videoMuteBtn: HTMLButtonElement | null = null;

  // Video Streaming State
  private isVideoPlaying: boolean = false;
  private videoCurrentTime: number = 0;
  private videoTotalDuration: number = 40;
  private playbackSpeed: number = 1.0;
  private isMuted: boolean = false;
  private videoAnimFrameId: number | null = null;
  private lastFrameTimestamp: number = 0;
  private sceneTimeRanges: { start: number; end: number; duration: number; step: BlackboardStep }[] = [];

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
  private hudInspectBtn: HTMLButtonElement | null = null;

  // Inspector elements
  private inspectBtn: HTMLButtonElement | null = null;
  private inspectDrawer: HTMLElement | null = null;
  private inspectCloseBtn: HTMLButtonElement | null = null;
  private inspectTabReasoningBtn: HTMLButtonElement | null = null;
  private inspectTabElementsBtn: HTMLButtonElement | null = null;
  private inspectTabRawBtn: HTMLButtonElement | null = null;
  private inspectPaneReasoning: HTMLElement | null = null;
  private inspectPaneElements: HTMLElement | null = null;
  private inspectPaneRaw: HTMLElement | null = null;
  private inspectReasoningPedagogy: HTMLElement | null = null;
  private inspectReasoningSpatial: HTMLElement | null = null;
  private inspectElemCount: HTMLElement | null = null;
  private inspectCurrentStepTitle: HTMLElement | null = null;
  private inspectElementsList: HTMLElement | null = null;
  private inspectRawJsonText: HTMLElement | null = null;
  private inspectCopyJsonBtn: HTMLButtonElement | null = null;

  // Reasoning & raw blueprint cache
  private currentReasoning?: any;
  private currentRawJson?: string;

  private currentSteps: BlackboardStep[] = [];
  private currentStepIndex: number = 0;
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

  constructor(callbacks?: BlackboardViewCallbacks) {
    this.callbacks = callbacks;
    this.overlayEl = document.getElementById('vizOverlay') as HTMLElement;
    this.canvasEl = document.getElementById('vizCanvas') as HTMLCanvasElement;
    this.backBtn = document.getElementById('vizBackBtn') as HTMLButtonElement | null;
    this.agentToggleBtn = document.getElementById('vizAgentToggleBtn') as HTMLButtonElement | null;
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

    // Video Stream Player Elements
    this.videoStreamBar = document.getElementById('videoStreamBar');
    this.videoSubtitles = document.getElementById('videoSubtitles');
    this.videoSubtitlesText = document.getElementById('videoSubtitlesText');
    this.videoCurrentTimeEl = document.getElementById('videoCurrentTime');
    this.videoTotalTimeEl = document.getElementById('videoTotalTime');
    this.videoScrubber = document.getElementById('videoScrubber') as HTMLInputElement | null;
    this.videoProgressFill = document.getElementById('videoProgressFill');
    this.videoPlayPauseBtn = document.getElementById('videoPlayPauseBtn') as HTMLButtonElement | null;
    this.videoPlayLabel = document.getElementById('videoPlayLabel');
    this.videoPlayIcon = document.getElementById('videoPlayIcon') as unknown as SVGElement | null;
    this.videoReplayBtn = document.getElementById('videoReplayBtn') as HTMLButtonElement | null;
    this.videoSceneIndicator = document.getElementById('videoSceneIndicator');
    this.videoSpeedBtn = document.getElementById('videoSpeedBtn') as HTMLButtonElement | null;
    this.videoMuteBtn = document.getElementById('videoMuteBtn') as HTMLButtonElement | null;

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
    this.hudInspectBtn = document.getElementById('hudInspect') as HTMLButtonElement | null;

    // Inspector elements
    this.inspectBtn = document.getElementById('vizInspectBtn') as HTMLButtonElement | null;
    this.inspectDrawer = document.getElementById('vizInspectDrawer');
    this.inspectCloseBtn = document.getElementById('vizInspectCloseBtn') as HTMLButtonElement | null;
    this.inspectTabReasoningBtn = document.getElementById('inspectTabReasoningBtn') as HTMLButtonElement | null;
    this.inspectTabElementsBtn = document.getElementById('inspectTabElementsBtn') as HTMLButtonElement | null;
    this.inspectTabRawBtn = document.getElementById('inspectTabRawBtn') as HTMLButtonElement | null;
    this.inspectPaneReasoning = document.getElementById('inspectPaneReasoning');
    this.inspectPaneElements = document.getElementById('inspectPaneElements');
    this.inspectPaneRaw = document.getElementById('inspectPaneRaw');
    this.inspectReasoningPedagogy = document.getElementById('inspectReasoningPedagogy');
    this.inspectReasoningSpatial = document.getElementById('inspectReasoningSpatial');
    this.inspectElemCount = document.getElementById('inspectElemCount');
    this.inspectCurrentStepTitle = document.getElementById('inspectCurrentStepTitle');
    this.inspectElementsList = document.getElementById('inspectElementsList');
    this.inspectRawJsonText = document.getElementById('inspectRawJsonText');
    this.inspectCopyJsonBtn = document.getElementById('inspectCopyJsonBtn') as HTMLButtonElement | null;

    // Render mode toggle button
    this.renderModeBtn = document.getElementById('vizRenderModeBtn') as HTMLButtonElement | null;
    this.renderModeLabel = document.getElementById('vizRenderModeLabel');

    if (this.canvasEl) {
      this.ctx = this.canvasEl.getContext('2d');
    }

    // Initialize RoughRenderer as Primary chalk engine
    this.roughRenderer = new RoughRenderer();
    if (this.canvasEl) {
      this.roughRenderer.attach(this.canvasEl);
    }
    this.roughRenderer.onRenderError = () => {
      console.warn('RoughRenderer failed, falling back to Skia / 2D');
      this.drawCanvas();
    };

    // Skia WASM fallback renderer
    this.skiaRenderer = new SkiaRenderer();
    this.skiaRenderer.onRenderError = () => {
      this.drawCanvas2D();
    };
    this.bindEvents();
    this.setupGestureListeners();
    this.setupStylusListeners();
  }

  private bindEvents(): void {
    this.renderModeBtn?.addEventListener('click', () => this.toggleRenderEngine());
    this.backBtn?.addEventListener('click', () => {
      this.close();
      if (this.callbacks?.onBack) {
        this.callbacks.onBack();
      }
    });
    this.agentToggleBtn?.addEventListener('click', () => {
      if (this.callbacks?.onToggleAgent) {
        this.callbacks.onToggleAgent();
      }
    });
    this.closeBtn?.addEventListener('click', () => {
      this.close();
      if (this.callbacks?.onBack) {
        this.callbacks.onBack();
      }
    });
    this.fullscreenBtn?.addEventListener('click', () => this.toggleFullscreen());
    this.presentationBtn?.addEventListener('click', () => this.togglePresentationMode());
    this.stepPrevBtn?.addEventListener('click', () => this.prevStep());
    this.stepNextBtn?.addEventListener('click', () => this.nextStep());
    this.stepPlayBtn?.addEventListener('click', () => this.toggleAutoplay());
    this.stepVoiceBtn?.addEventListener('click', () => this.narrateCurrentStep());

    // Video Stream Player events
    this.videoPlayPauseBtn?.addEventListener('click', () => this.toggleVideoPlayback());
    this.videoReplayBtn?.addEventListener('click', () => this.restartVideo());
    this.videoScrubber?.addEventListener('input', (e) => this.onScrubberSeek(e));
    this.videoSpeedBtn?.addEventListener('click', () => this.cyclePlaybackSpeed());
    this.videoMuteBtn?.addEventListener('click', () => this.toggleMute());

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
    this.hudInspectBtn?.addEventListener('click', () => this.toggleInspectDrawer());
    this.hudExitBtn?.addEventListener('click', () => this.exitPresentationMode());

    // Blueprint & Reasoning Inspector events
    this.inspectBtn?.addEventListener('click', () => this.toggleInspectDrawer());
    this.inspectCloseBtn?.addEventListener('click', () => this.closeInspectDrawer());
    this.inspectTabReasoningBtn?.addEventListener('click', () => this.switchInspectTab('reasoning'));
    this.inspectTabElementsBtn?.addEventListener('click', () => this.switchInspectTab('elements'));
    this.inspectTabRawBtn?.addEventListener('click', () => this.switchInspectTab('raw'));
    this.inspectCopyJsonBtn?.addEventListener('click', () => {
      const code = this.inspectRawJsonText?.textContent || '';
      if (code) {
        navigator.clipboard.writeText(code);
        if (this.inspectCopyJsonBtn) {
          this.inspectCopyJsonBtn.textContent = 'Copied!';
          setTimeout(() => {
            if (this.inspectCopyJsonBtn) this.inspectCopyJsonBtn.textContent = 'Copy JSON';
          }, 2000);
        }
      }
    });

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

      // 'i' or 'I' toggles the inspector drawer when not in text input
      if ((e.key === 'i' || e.key === 'I') && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        this.toggleInspectDrawer();
        return;
      }

      // Space bar toggles video playback when not typing in text input
      if ((e.key === ' ' || e.code === 'Space') && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        this.toggleVideoPlayback();
        return;
      }

      // Left/Right arrow keys seek in video mode
      if (!['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        if (e.key === 'ArrowRight' && !this.isPresentation) {
          e.preventDefault();
          this.seekToTime(this.videoCurrentTime + 5);
          return;
        } else if (e.key === 'ArrowLeft' && !this.isPresentation) {
          e.preventDefault();
          this.seekToTime(this.videoCurrentTime - 5);
          return;
        }
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
        } else {
          this.currentSteps = [{
            step: 1,
            title: 'Blackboard Sketch',
            explanation: 'Freehand drawings and notes on the blackboard canvas.',
            elements: [newElement],
          }];
          this.currentStepIndex = 0;
          this.renderCurrentStep();
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

  public toggleRenderEngine(): void {
    this.setRenderEngine(this.renderEngine === 'rough' ? 'skia' : 'rough');
  }

  public setRenderEngine(engine: 'rough' | 'skia'): void {
    this.renderEngine = engine;
    if (this.renderModeLabel) {
      if (engine === 'rough') {
        this.renderModeLabel.textContent = '🎨 Chalkboard';
      } else {
        this.renderModeLabel.textContent = '📐 Precision';
      }
    }
    this.drawCanvas();
  }

  public getRenderEngine(): 'rough' | 'skia' {
    return this.renderEngine;
  }

  public async open(steps: BlackboardStep[], reasoning?: any, rawJson?: string): Promise<void> {
    this.currentSteps = steps;
    this.currentStepIndex = 0;
    this.videoCurrentTime = 0;
    this.currentReasoning = reasoning;
    this.currentRawJson = rawJson;
    this.calculateVideoTimeline();
    this.overlayEl?.classList.add('visible');
    this.renderCurrentStep();

    // Attach RoughRenderer as Primary chalk engine
    if (this.canvasEl) {
      this.roughRenderer.attach(this.canvasEl);
    }

    // Attempt hardware-accelerated Skia WASM initialization as fallback
    const skiaLoaded = await this.skiaRenderer.init();
    if (skiaLoaded && this.canvasEl) {
      this.skiaRenderer.attach(this.canvasEl);
    }
    this.resizeCanvas();
    this.drawCanvas();
    this.videoStreamBar?.classList.remove('hidden');

    // Automatically begin video playback with speech narration
    if (steps.length > 0) {
      this.startVideoPlayback();
    }
  }

  public close(): void {
    this.pauseVideoPlayback();
    this.stopVideoClock();
    SpeechService.stop();
    this.videoStreamBar?.classList.add('hidden');
    this.exitPresentationMode();
    this.closeInspectDrawer();
    this.roughRenderer.stopAnimation();
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
    if (this.isOpen()) {
      this.resizeCanvas();
      this.renderCurrentStep();
    }
  }

  private resizeCanvas(): void {
    if (!this.canvasEl) return;
    const rect = this.canvasEl.parentElement?.getBoundingClientRect();
    if (rect) {
      this.canvasEl.width = rect.width;
      this.canvasEl.height = rect.height;
      this.roughRenderer.resize();
      this.skiaRenderer.resize();
      this.drawCanvas();
    }
  }

  public getAccumulatedStep(targetIndex: number): BlackboardStep {
    if (this.currentSteps.length === 0) {
      return { step: 1, title: '', explanation: '', elements: [] };
    }
    const safeIndex = Math.max(0, Math.min(this.currentSteps.length - 1, targetIndex));
    const accumulatedElements: DrawingElement[] = [];
    for (let i = 0; i <= safeIndex; i++) {
      const stepElements = this.currentSteps[i]?.elements;
      if (stepElements && Array.isArray(stepElements)) {
        accumulatedElements.push(...stepElements);
      }
    }
    return {
      step: safeIndex + 1,
      title: this.currentSteps[safeIndex]?.title || '',
      explanation: this.currentSteps[safeIndex]?.explanation || '',
      elements: accumulatedElements,
    };
  }

  public renderCurrentStep(): void {
    if (this.currentSteps.length === 0) {
      if (this.titleEl) this.titleEl.textContent = 'Blackboard';
      if (this.descEl) this.descEl.textContent = 'Ask what you want to learn in the AI Agent panel, or sketch ideas on the canvas.';
      if (this.stepIndicator) this.stepIndicator.textContent = 'Blank Canvas';
      if (this.hudStepBadge) this.hudStepBadge.textContent = 'Blackboard: Blank Canvas';
      if (this.stepPrevBtn) this.stepPrevBtn.disabled = true;
      if (this.stepNextBtn) this.stepNextBtn.disabled = true;
      if (this.hudPrevBtn) this.hudPrevBtn.disabled = true;
      if (this.hudNextBtn) this.hudNextBtn.disabled = true;
      if (this.videoSubtitles) this.videoSubtitles.classList.add('hidden');
      this.drawCanvas();
      return;
    }
    const step = this.currentSteps[this.currentStepIndex];

    const stepLabel = `Step ${this.currentStepIndex + 1} of ${this.currentSteps.length}`;
    if (this.titleEl) this.titleEl.textContent = step.title;
    if (this.descEl) this.descEl.textContent = step.explanation;
    if (this.stepIndicator) this.stepIndicator.textContent = stepLabel;
    if (this.hudStepBadge) this.hudStepBadge.textContent = `${stepLabel}: ${step.title}`;
    this.updateSubtitles();
    this.updateVideoTimelineUI();

    const isFirst = this.currentStepIndex === 0;
    const isLast = this.currentStepIndex === this.currentSteps.length - 1;

    if (this.stepPrevBtn) this.stepPrevBtn.disabled = isFirst;
    if (this.stepNextBtn) this.stepNextBtn.disabled = isLast;
    if (this.hudPrevBtn) this.hudPrevBtn.disabled = isFirst;
    if (this.hudNextBtn) this.hudNextBtn.disabled = isLast;

    PluginManager.getInstance().notifyStepRender(step);
    this.updateInspectDrawer();

    const accumulatedStep = this.getAccumulatedStep(this.currentStepIndex);

    // Primary: Rough.js organic chalk sketching animation
    if (this.renderEngine === 'rough') {
      this.roughRenderer.animateStep(accumulatedStep, 450, this.viewport);
      return;
    }

    // Fallback 1: Skia GPU
    if (this.skiaRenderer.hasSurface()) {
      try {
        this.skiaRenderer.animateStep(accumulatedStep, 450);
        return;
      } catch (err) {
        console.warn('Skia animation failed, falling back to 2D:', err);
      }
    }

    // Fallback 2: Canvas 2D
    this.drawCanvas();
  }

  private drawCanvas(): void {
    if (this.currentSteps.length === 0) {
      this.drawCanvas2D();
      return;
    }

    const step = this.getAccumulatedStep(this.currentStepIndex);

    // Primary: Rough.js Chalkboard engine
    if (this.renderEngine === 'rough') {
      try {
        const rendered = this.roughRenderer.renderStep(step, this.viewport);
        if (rendered) {
          this.drawActiveStylusStroke();
          return;
        }
      } catch (err) {
        console.warn('RoughRenderer renderStep failed, falling back:', err);
      }
    }

    // Fallback 1: Skia GPU
    if (this.skiaRenderer.hasSurface()) {
      try {
        this.skiaRenderer.animateStep(step, 500);
        return;
      } catch (err) {
        console.warn('Skia animation failed, falling back to 2D:', err);
      }
    }

    // Fallback 2: HTML5 2D Canvas
    this.drawCanvas2D();
  }

  private drawActiveStylusStroke(): void {
    if (!this.ctx || !this.canvasEl || !this.activeStroke || this.activeStroke.length <= 1) return;
    this.ctx.save();
    const cx = this.canvasEl.width / 2;
    const cy = this.canvasEl.height / 2;
    this.ctx.translate(cx + this.viewport.panX, cy + this.viewport.panY);
    this.ctx.rotate(this.viewport.rotation);
    this.ctx.scale(this.viewport.zoom, this.viewport.zoom);
    this.ctx.translate(-cx, -cy);

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
    this.ctx.restore();
  }

  public drawCanvas2D(): void {
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

    if (this.currentSteps.length > 0) {
      const step = this.getAccumulatedStep(this.currentStepIndex);
      if (step && step.elements) {
      step.elements.forEach((el) => {
        if (!this.ctx) return;
        this.ctx.strokeStyle = el.color || '#00d4aa';
        this.ctx.lineWidth = el.strokeWidth || 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        if (el.type === 'rect' && el.start && el.width && el.height) {
          this.ctx.strokeRect(el.start.x, el.start.y, el.width, el.height);
          if (el.text) {
            this.ctx.save();
            this.ctx.fillStyle = el.color || '#ffffff';
            this.ctx.font = '13px Inter, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(el.text, el.start.x + el.width / 2, el.start.y + el.height / 2);
            this.ctx.restore();
          }
        } else if (el.type === 'circle' && el.start) {
          const radius = el.radius || (el.width ? el.width / 2 : 60);
          this.ctx.beginPath();
          this.ctx.arc(el.start.x, el.start.y, radius, 0, Math.PI * 2);
          this.ctx.stroke();
          if (el.text) {
            this.ctx.save();
            this.ctx.fillStyle = el.color || '#ffffff';
            this.ctx.font = '14px Inter, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(el.text, el.start.x, el.start.y);
            this.ctx.restore();
          }
        } else if (el.type === 'line' && el.start && el.end) {
          this.ctx.beginPath();
          this.ctx.moveTo(el.start.x, el.start.y);
          this.ctx.lineTo(el.end.x, el.end.y);
          this.ctx.stroke();
        } else if (el.type === 'arrow' && el.start && el.end) {
          this.ctx.beginPath();
          this.ctx.moveTo(el.start.x, el.start.y);
          this.ctx.lineTo(el.end.x, el.end.y);
          this.ctx.stroke();
          const angle = Math.atan2(el.end.y - el.start.y, el.end.x - el.start.x);
          const headLen = 12;
          this.ctx.beginPath();
          this.ctx.moveTo(el.end.x, el.end.y);
          this.ctx.lineTo(el.end.x - headLen * Math.cos(angle - Math.PI / 6), el.end.y - headLen * Math.sin(angle - Math.PI / 6));
          this.ctx.moveTo(el.end.x, el.end.y);
          this.ctx.lineTo(el.end.x - headLen * Math.cos(angle + Math.PI / 6), el.end.y - headLen * Math.sin(angle + Math.PI / 6));
          this.ctx.stroke();
        } else if (el.type === 'text' && el.start && el.text) {
          this.ctx.save();
          this.ctx.fillStyle = el.color || '#ffffff';
          this.ctx.font = '15px Inter, sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(el.text, el.start.x, el.start.y);
          this.ctx.restore();
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

  // ── Video Stream Timeline & Playback Engine ───────────────────
  public calculateVideoTimeline(): void {
    if (this.currentSteps.length === 0) {
      this.videoTotalDuration = 0;
      this.sceneTimeRanges = [];
      this.updateVideoTimelineUI();
      return;
    }

    let runningTime = 0;
    this.sceneTimeRanges = this.currentSteps.map((step) => {
      const words = `${step.title} ${step.explanation}`.trim().split(/\s+/).length;
      // Speech rate: ~2.2 words per second.
      // Short test labels (<= 4 words) use 3.5s. Full sentences use word count / 2.2 (e.g. 10-18s)
      const duration = words <= 4 ? 3.5 : Math.max(6, Math.ceil(words / 2.2));
      const start = runningTime;
      const end = runningTime + duration;
      runningTime = end;
      return { start, end, duration, step };
    });

    this.videoTotalDuration = runningTime;
    if (this.videoScrubber) {
      this.videoScrubber.min = '0';
      this.videoScrubber.max = this.videoTotalDuration.toString();
      this.videoScrubber.step = '0.1';
    }
    this.updateVideoTimelineUI();
  }

  public updateVideoTimelineUI(): void {
    if (this.videoCurrentTimeEl) {
      this.videoCurrentTimeEl.textContent = this.formatVideoTime(this.videoCurrentTime);
    }
    if (this.videoTotalTimeEl) {
      this.videoTotalTimeEl.textContent = this.formatVideoTime(this.videoTotalDuration);
    }
    if (this.videoScrubber) {
      this.videoScrubber.value = this.videoCurrentTime.toFixed(1);
    }
    if (this.videoProgressFill) {
      const pct = this.videoTotalDuration > 0 ? (this.videoCurrentTime / this.videoTotalDuration) * 100 : 0;
      this.videoProgressFill.style.width = `${pct}%`;
    }
    if (this.videoSceneIndicator) {
      const total = this.currentSteps.length;
      this.videoSceneIndicator.textContent = total > 0 ? `Scene ${this.currentStepIndex + 1} of ${total}` : 'Scene 0 of 0';
    }
  }

  public formatVideoTime(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  public toggleVideoPlayback(): void {
    if (this.isVideoPlaying) {
      this.pauseVideoPlayback();
    } else {
      this.startVideoPlayback();
    }
  }

  public startVideoPlayback(): void {
    if (this.currentSteps.length === 0) return;
    if (this.videoCurrentTime >= this.videoTotalDuration) {
      this.videoCurrentTime = 0;
      this.currentStepIndex = 0;
      this.renderCurrentStep();
    }
    this.isVideoPlaying = true;
    this.updateVideoPlayPauseUI(true);
    this.lastFrameTimestamp = performance.now();
    this.startVideoClock();
    this.syncSpeechToCurrentScene();
  }

  public pauseVideoPlayback(): void {
    this.isVideoPlaying = false;
    this.updateVideoPlayPauseUI(false);
    this.stopVideoClock();
    if (this.playTimer) {
      clearTimeout(this.playTimer);
      this.playTimer = null;
    }
    SpeechService.pause();
  }

  public restartVideo(): void {
    this.videoCurrentTime = 0;
    this.currentStepIndex = 0;
    this.renderCurrentStep();
    this.updateVideoTimelineUI();
    this.startVideoPlayback();
  }

  private updateVideoPlayPauseUI(playing: boolean): void {
    if (this.videoPlayLabel) {
      this.videoPlayLabel.textContent = playing ? 'Pause' : 'Play';
    }
    if (this.videoPlayIcon) {
      if (playing) {
        this.videoPlayIcon.innerHTML = '<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>';
      } else {
        this.videoPlayIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>';
      }
    }
    if (this.stepPlayBtn) {
      this.stepPlayBtn.textContent = playing ? 'Pause' : 'Autoplay';
    }
    this.updateHudPlayIcon(playing);
  }

  private startVideoClock(): void {
    this.stopVideoClock();
    const tick = (now: number) => {
      if (!this.isVideoPlaying) return;
      const deltaSec = (now - this.lastFrameTimestamp) / 1000;
      this.lastFrameTimestamp = now;

      this.videoCurrentTime += deltaSec * this.playbackSpeed;

      if (this.videoCurrentTime >= this.videoTotalDuration) {
        this.videoCurrentTime = this.videoTotalDuration;
        this.updateVideoTimelineUI();
        this.pauseVideoPlayback();
        return;
      }

      this.updateVideoTimelineUI();

      // Check which scene corresponds to videoCurrentTime
      const activeRangeIndex = this.sceneTimeRanges.findIndex(
        (r) => this.videoCurrentTime >= r.start && this.videoCurrentTime < r.end
      );

      const targetIndex = activeRangeIndex >= 0 ? activeRangeIndex : (this.currentSteps.length - 1);
      if (targetIndex !== this.currentStepIndex) {
        this.currentStepIndex = targetIndex;
        this.renderCurrentStep();
        this.syncSpeechToCurrentScene();
      }

      this.videoAnimFrameId = requestAnimationFrame(tick);
    };

    this.videoAnimFrameId = requestAnimationFrame(tick);
  }

  private stopVideoClock(): void {
    if (this.videoAnimFrameId !== null) {
      cancelAnimationFrame(this.videoAnimFrameId);
      this.videoAnimFrameId = null;
    }
  }

  public seekToTime(time: number): void {
    this.videoCurrentTime = Math.max(0, Math.min(this.videoTotalDuration, time));
    this.updateVideoTimelineUI();

    const activeRangeIndex = this.sceneTimeRanges.findIndex(
      (r) => this.videoCurrentTime >= r.start && this.videoCurrentTime <= r.end
    );
    const targetIndex = activeRangeIndex >= 0 ? activeRangeIndex : (this.currentSteps.length - 1);
    if (targetIndex !== this.currentStepIndex) {
      this.currentStepIndex = targetIndex;
    }
    this.renderCurrentStep();
    if (this.isVideoPlaying) {
      this.syncSpeechToCurrentScene();
    } else {
      SpeechService.stop();
      this.updateSubtitles();
    }
  }

  public onScrubberSeek(e: Event): void {
    const val = parseFloat((e.target as HTMLInputElement).value);
    this.seekToTime(val);
  }

  public cyclePlaybackSpeed(): void {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(this.playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    this.playbackSpeed = speeds[nextIndex];
    if (this.videoSpeedBtn) {
      this.videoSpeedBtn.textContent = `${this.playbackSpeed}x`;
    }
    if (this.isVideoPlaying) {
      this.syncSpeechToCurrentScene();
    }
  }

  public toggleMute(): void {
    this.isMuted = !this.isMuted;
    if (this.videoMuteBtn) {
      this.videoMuteBtn.textContent = this.isMuted ? 'Unmute' : 'Mute';
      this.videoMuteBtn.classList.toggle('active', this.isMuted);
    }
    if (this.isMuted) {
      SpeechService.stop();
    } else if (this.isVideoPlaying) {
      this.syncSpeechToCurrentScene();
    }
  }

  private updateSubtitles(): void {
    const step = this.currentSteps[this.currentStepIndex];
    if (!step) {
      if (this.videoSubtitles) this.videoSubtitles.classList.add('hidden');
      return;
    }
    if (this.videoSubtitles) this.videoSubtitles.classList.remove('hidden');
    if (this.videoSubtitlesText) {
      this.videoSubtitlesText.textContent = step.explanation;
    }
  }

  private syncSpeechToCurrentScene(): void {
    const step = this.currentSteps[this.currentStepIndex];
    if (!step) return;

    this.updateSubtitles();

    if (this.playTimer) {
      clearTimeout(this.playTimer);
      this.playTimer = null;
    }

    const currentRange = this.sceneTimeRanges[this.currentStepIndex];
    const durationMs = ((currentRange?.duration || 3.5) * 1000) / this.playbackSpeed;

    this.playTimer = setTimeout(() => {
      if (!this.isVideoPlaying) return;
      if (this.currentStepIndex < this.currentSteps.length - 1) {
        this.nextStep();
      } else {
        this.pauseVideoPlayback();
      }
    }, durationMs);

    if (this.isMuted) {
      SpeechService.stop();
      return;
    }

    const textToSpeak = `${step.title}. ${step.explanation}`;
    SpeechService.speak(textToSpeak, {
      rate: this.playbackSpeed,
      onStart: () => {
        if (this.stepVoiceBtn) this.stepVoiceBtn.textContent = 'Speaking...';
      },
      onEnd: () => {
        if (this.stepVoiceBtn) this.stepVoiceBtn.textContent = 'Narrate';
        if (this.isVideoPlaying && this.playTimer) {
          clearTimeout(this.playTimer);
          this.playTimer = setTimeout(() => {
            if (!this.isVideoPlaying) return;
            if (this.currentStepIndex < this.currentSteps.length - 1) {
              this.nextStep();
            } else {
              this.pauseVideoPlayback();
            }
          }, 800 / this.playbackSpeed);
        }
      },
      onError: () => {
        if (this.stepVoiceBtn) this.stepVoiceBtn.textContent = 'Narrate';
      },
    });
  }

  public playCurrentStepWithNarration(): void {
    this.syncSpeechToCurrentScene();
  }

  public nextStep(): void {
    if (this.currentStepIndex < this.currentSteps.length - 1) {
      this.currentStepIndex++;
      const range = this.sceneTimeRanges[this.currentStepIndex];
      if (range) {
        this.videoCurrentTime = range.start;
      }
      this.renderCurrentStep();
      if (this.isVideoPlaying) {
        this.syncSpeechToCurrentScene();
      }
    } else {
      this.pauseVideoPlayback();
    }
  }

  public prevStep(): void {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      const range = this.sceneTimeRanges[this.currentStepIndex];
      if (range) {
        this.videoCurrentTime = range.start;
      }
      this.renderCurrentStep();
      if (this.isVideoPlaying) {
        this.syncSpeechToCurrentScene();
      }
    }
  }

  public toggleAutoplay(): void {
    this.toggleVideoPlayback();
  }

  public startAutoplay(): void {
    this.startVideoPlayback();
  }

  public stopAutoplay(): void {
    this.pauseVideoPlayback();
  }

  public narrateCurrentStep(): void {
    this.toggleVideoPlayback();
  }

  private updateHudPlayIcon(isPlaying: boolean): void {
    const icon = document.getElementById('hudPlayIcon');
    if (icon) {
      if (isPlaying) {
        icon.innerHTML = '<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>';
      } else {
        icon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>';
      }
    }
  }

  public getPlaybackSpeed(): number {
    return this.playbackSpeed;
  }

  public getVideoCurrentTime(): number {
    return this.videoCurrentTime;
  }

  public getVideoTotalDuration(): number {
    return this.videoTotalDuration;
  }

  public isVideoPlayingActive(): boolean {
    return this.isVideoPlaying;
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
      this.overlayEl?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  // ── Blueprint & Reasoning Inspector Methods ───────────────────
  public toggleInspectDrawer(): void {
    if (this.inspectDrawer?.classList.contains('hidden')) {
      this.openInspectDrawer();
    } else {
      this.closeInspectDrawer();
    }
  }

  public openInspectDrawer(): void {
    this.inspectDrawer?.classList.remove('hidden');
    this.inspectBtn?.classList.add('active');
    this.updateInspectDrawer();
  }

  public closeInspectDrawer(): void {
    this.inspectDrawer?.classList.add('hidden');
    this.inspectBtn?.classList.remove('active');
  }

  public switchInspectTab(tab: 'reasoning' | 'elements' | 'raw'): void {
    this.inspectTabReasoningBtn?.classList.toggle('active', tab === 'reasoning');
    this.inspectTabElementsBtn?.classList.toggle('active', tab === 'elements');
    this.inspectTabRawBtn?.classList.toggle('active', tab === 'raw');

    this.inspectPaneReasoning?.classList.toggle('active', tab === 'reasoning');
    this.inspectPaneElements?.classList.toggle('active', tab === 'elements');
    this.inspectPaneRaw?.classList.toggle('active', tab === 'raw');
  }

  public updateInspectDrawer(): void {
    if (!this.inspectDrawer || this.inspectDrawer.classList.contains('hidden')) return;

    const currentStep = this.currentSteps[this.currentStepIndex];

    // 1. Update Reasoning Pane
    let pedagogyText = '';
    let spatialText = '';

    if (this.currentReasoning) {
      if (typeof this.currentReasoning === 'object') {
        pedagogyText = this.currentReasoning.pedagogicalStrategy || this.currentReasoning.pedagogy || this.currentReasoning.mentalModel || '';
        spatialText = this.currentReasoning.spatialArchitecture || this.currentReasoning.spatial_layout || '';
      } else if (typeof this.currentReasoning === 'string') {
        pedagogyText = this.currentReasoning;
      }
    }

    if (!pedagogyText && currentStep) {
      pedagogyText = `Target Concept: ${currentStep.title}\n\n• Core Mental Model: Visualizing the step-by-step evolution of ${currentStep.title} with explicit semantic primitives.\n• Pedagogical Strategy: Step ${this.currentStepIndex + 1} of ${this.currentSteps.length} isolates key interactions before introducing secondary properties.\n• Spoken Explanation Script: "${currentStep.explanation}"`;
    }

    if (!spatialText && currentStep) {
      spatialText = `• Coordinate Frame: Canvas viewport scaled to fit 850x520 bounding area.\n• Visual Primitives: ${currentStep.elements?.length || 0} distinct vector elements on current slide.\n• Focus Center: Balanced geometry centered around (480, 260) with high-contrast color highlights.`;
    }

    if (this.inspectReasoningPedagogy) {
      this.inspectReasoningPedagogy.textContent = pedagogyText || 'No pedagogical metadata available.';
    }
    if (this.inspectReasoningSpatial) {
      this.inspectReasoningSpatial.textContent = spatialText || 'No spatial layout metadata available.';
    }

    // 2. Update Elements Pane
    const elements = currentStep?.elements || [];
    if (this.inspectElemCount) {
      this.inspectElemCount.textContent = `${elements.length}`;
    }
    if (this.inspectCurrentStepTitle) {
      this.inspectCurrentStepTitle.textContent = currentStep ? `Step ${this.currentStepIndex + 1}: ${currentStep.title}` : 'No active step';
    }

    if (this.inspectElementsList) {
      if (elements.length === 0) {
        this.inspectElementsList.innerHTML = `<div style="font-size:12px;color:#888;padding:12px 0;">No visual elements on this step.</div>`;
      } else {
        this.inspectElementsList.innerHTML = elements.map((el, i) => {
          let coords = '';
          if (el.start) coords += `start: (${Math.round(el.start.x)}, ${Math.round(el.start.y)})`;
          if (el.end) coords += ` → end: (${Math.round(el.end.x)}, ${Math.round(el.end.y)})`;
          if (el.radius) coords += ` | r: ${Math.round(el.radius)}px`;
          if (el.width && el.height) coords += ` | ${Math.round(el.width)}×${Math.round(el.height)}px`;
          if (el.text) coords += ` | text: "${el.text}"`;

          return `
            <div class="inspect-element-card">
              <div class="inspect-element-top">
                <span class="inspect-element-type">${i + 1}. ${el.type}</span>
                <span class="inspect-element-color">
                  <span class="inspect-color-swatch" style="background:${el.color};"></span>
                  ${el.color}
                </span>
              </div>
              <div class="inspect-element-coords">${coords}</div>
            </div>
          `;
        }).join('');
      }
    }

    // 3. Update Raw JSON Pane
    if (this.inspectRawJsonText) {
      if (this.currentRawJson) {
        this.inspectRawJsonText.textContent = this.currentRawJson;
      } else {
        const payload = {
          reasoning: this.currentReasoning || {
            pedagogicalStrategy: pedagogyText,
            spatialArchitecture: spatialText,
          },
          steps: this.currentSteps,
        };
        this.inspectRawJsonText.textContent = JSON.stringify(payload, null, 2);
      }
    }
  }
}
