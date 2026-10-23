export interface ScreenTeachViewCallbacks {
  onExit: () => void;
}

export class ScreenTeachView {
  private active: boolean = false;
  private callbacks: ScreenTeachViewCallbacks;

  constructor(callbacks: ScreenTeachViewCallbacks) {
    this.callbacks = callbacks;
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
