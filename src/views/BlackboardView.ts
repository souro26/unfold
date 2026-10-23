import { BlackboardStep } from '../types';
import { SpeechService } from '../services/speech';
import { SkiaRenderer } from '../renderer-skia';
import { ExportService } from '../services/export';

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
    });
  }

  public async open(steps: BlackboardStep[]): Promise<void> {
    this.currentSteps = steps;
    this.currentStepIndex = 0;
    this.overlayEl?.classList.add('visible');

    // Attempt hardware-accelerated Skia WASM initialization
    const skiaLoaded = await this.skiaRenderer.init();
    this.resizeCanvas();

    if (skiaLoaded && this.canvasEl) {
      this.skiaRenderer.attach(this.canvasEl);
    }

    this.renderCurrentStep();
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
          this.ctx.beginPath();
          this.ctx.moveTo(el.points[0].x, el.points[0].y);
          for (let i = 1; i < el.points.length; i++) {
            this.ctx.lineTo(el.points[i].x, el.points[i].y);
          }
          this.ctx.stroke();
        }
      });
    }
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

  public exportDiagram(format: 'mermaid' | 'excalidraw' | 'plantuml'): void {
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
