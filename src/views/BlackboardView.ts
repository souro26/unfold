import { BlackboardStep } from '../types';
import { SpeechService } from '../services/speech';

export class BlackboardView {
  private overlayEl: HTMLElement;
  private canvasEl: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private closeBtn: HTMLButtonElement;
  private fullscreenBtn: HTMLButtonElement;
  private stepPrevBtn: HTMLButtonElement;
  private stepNextBtn: HTMLButtonElement;
  private stepPlayBtn: HTMLButtonElement;
  private stepVoiceBtn: HTMLButtonElement;
  private stepIndicator: HTMLElement;
  private titleEl: HTMLElement;
  private descEl: HTMLElement;

  private currentSteps: BlackboardStep[] = [];
  private currentStepIndex: number = 0;
  private isPlaying: boolean = false;
  private playTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.overlayEl = document.getElementById('vizOverlay') as HTMLElement;
    this.canvasEl = document.getElementById('vizCanvas') as HTMLCanvasElement;
    this.closeBtn = document.getElementById('vizClose') as HTMLButtonElement;
    this.fullscreenBtn = document.getElementById('vizFullscreen') as HTMLButtonElement;
    this.stepPrevBtn = document.getElementById('stepPrev') as HTMLButtonElement;
    this.stepNextBtn = document.getElementById('stepNext') as HTMLButtonElement;
    this.stepPlayBtn = document.getElementById('stepPlay') as HTMLButtonElement;
    this.stepVoiceBtn = document.getElementById('stepVoice') as HTMLButtonElement;
    this.stepIndicator = document.getElementById('stepIndicator') as HTMLElement;
    this.titleEl = document.getElementById('vizTitle') as HTMLElement;
    this.descEl = document.getElementById('vizDescription') as HTMLElement;

    if (this.canvasEl) {
      this.ctx = this.canvasEl.getContext('2d');
    }

    this.bindEvents();
  }

  private bindEvents(): void {
    this.closeBtn?.addEventListener('click', () => this.close());
    this.fullscreenBtn?.addEventListener('click', () => this.toggleFullscreen());
    this.stepPrevBtn?.addEventListener('click', () => this.prevStep());
    this.stepNextBtn?.addEventListener('click', () => this.nextStep());
    this.stepPlayBtn?.addEventListener('click', () => this.toggleAutoplay());
    this.stepVoiceBtn?.addEventListener('click', () => this.narrateCurrentStep());

    window.addEventListener('resize', () => {
      if (this.isOpen()) this.resizeCanvas();
    });
  }

  public open(steps: BlackboardStep[]): void {
    this.currentSteps = steps;
    this.currentStepIndex = 0;
    this.overlayEl?.classList.add('visible');
    this.resizeCanvas();
    this.renderCurrentStep();
  }

  public close(): void {
    this.stopAutoplay();
    SpeechService.stop();
    this.overlayEl?.classList.remove('visible');
  }

  public isOpen(): boolean {
    return this.overlayEl?.classList.contains('visible') || false;
  }

  private resizeCanvas(): void {
    if (!this.canvasEl) return;
    const rect = this.canvasEl.parentElement?.getBoundingClientRect();
    if (rect) {
      this.canvasEl.width = rect.width;
      this.canvasEl.height = rect.height;
      this.drawCanvas();
    }
  }

  public renderCurrentStep(): void {
    if (this.currentSteps.length === 0) return;
    const step = this.currentSteps[this.currentStepIndex];

    if (this.titleEl) this.titleEl.textContent = step.title;
    if (this.descEl) this.descEl.textContent = step.explanation;
    if (this.stepIndicator) {
      this.stepIndicator.textContent = `Step ${this.currentStepIndex + 1} of ${this.currentSteps.length}`;
    }

    if (this.stepPrevBtn) this.stepPrevBtn.disabled = this.currentStepIndex === 0;
    if (this.stepNextBtn) this.stepNextBtn.disabled = this.currentStepIndex === this.currentSteps.length - 1;

    this.drawCanvas();
  }

  private drawCanvas(): void {
    if (!this.ctx || !this.canvasEl) return;
    this.ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);

    // Render background grid
    this.drawGrid();

    // Render elements for this step
    const step = this.currentSteps[this.currentStepIndex];
    if (step?.elements) {
      step.elements.forEach((el) => {
        if (!this.ctx) return;
        this.ctx.strokeStyle = el.color || '#00d4aa';
        this.ctx.lineWidth = el.strokeWidth || 2;

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
    if (step) {
      SpeechService.speak(`${step.title}. ${step.explanation}`);
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
