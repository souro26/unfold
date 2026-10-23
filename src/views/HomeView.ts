export interface HomeViewCallbacks {
  onStartScreenTeach: () => void;
  onStartBlackboard: () => void;
}

export class HomeView {
  private emptyStateEl: HTMLElement;
  private screenTeachBtn: HTMLButtonElement;
  private blackboardBtn: HTMLButtonElement;
  private callbacks: HomeViewCallbacks;

  constructor(callbacks: HomeViewCallbacks) {
    this.callbacks = callbacks;
    this.emptyStateEl = document.getElementById('emptyState') as HTMLElement;
    this.screenTeachBtn = document.getElementById('screenTeachMode') as HTMLButtonElement;
    this.blackboardBtn = document.getElementById('blackboardMode') as HTMLButtonElement;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.screenTeachBtn?.addEventListener('click', () => {
      this.callbacks.onStartScreenTeach();
    });

    this.blackboardBtn?.addEventListener('click', () => {
      this.callbacks.onStartBlackboard();
    });
  }

  public show(): void {
    if (!this.emptyStateEl) return;
    this.emptyStateEl.classList.remove('hidden');
    this.emptyStateEl.style.display = 'flex';
  }

  public hide(): void {
    if (!this.emptyStateEl) return;
    this.emptyStateEl.classList.add('hidden');
    this.emptyStateEl.style.display = 'none';
  }

  public isVisible(): boolean {
    return this.emptyStateEl ? !this.emptyStateEl.classList.contains('hidden') : false;
  }
}
