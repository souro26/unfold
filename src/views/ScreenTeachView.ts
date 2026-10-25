export interface ScreenTeachViewCallbacks {
  onExit: () => void;
  onToggleAgent?: () => void;
}

export class ScreenTeachView {
  private active: boolean = false;
  private callbacks: ScreenTeachViewCallbacks;
  private backBtn: HTMLButtonElement | null = null;
  private agentToggleBtn: HTMLButtonElement | null = null;

  constructor(callbacks: ScreenTeachViewCallbacks) {
    this.callbacks = callbacks;
    this.backBtn = document.getElementById('screenTeachBackBtn') as HTMLButtonElement | null;
    this.agentToggleBtn = document.getElementById('screenAgentToggleBtn') as HTMLButtonElement | null;
    this.bindEvents();
  }

  private bindEvents(): void {
    this.backBtn?.addEventListener('click', () => {
      this.exit();
    });

    this.agentToggleBtn?.addEventListener('click', () => {
      this.callbacks.onToggleAgent?.();
    });
  }

  public enter(): void {
    this.active = true;
    document.body.classList.add('screen-overlay-mode');
    document.querySelector('.app')?.classList.add('screen-overlay-mode');
  }

  public exit(): void {
    if (!this.active) return;
    this.active = false;
    document.body.classList.remove('screen-overlay-mode');
    document.querySelector('.app')?.classList.remove('screen-overlay-mode');
    this.callbacks.onExit();
  }

  public isActive(): boolean {
    return this.active;
  }
}
