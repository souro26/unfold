export interface ComposerCallbacks {
  onSendMessage: (text: string) => void;
  onExitOverlay?: () => void;
}

export class ComposerComponent {
  private containerEl: HTMLElement | null;
  private wrapperEl: HTMLElement;
  private inputEl: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;
  private overlayCloseBtn: HTMLButtonElement | null;
  private callbacks: ComposerCallbacks;

  constructor(callbacks: ComposerCallbacks) {
    this.callbacks = callbacks;
    this.wrapperEl = document.getElementById('composerWrapper') as HTMLElement;
    this.containerEl = (document.getElementById('composerContainer') || this.wrapperEl?.closest('.composer')) as HTMLElement | null;
    this.inputEl = document.getElementById('composerInput') as HTMLTextAreaElement;
    this.sendBtn = document.getElementById('sendBtn') as HTMLButtonElement;
    this.overlayCloseBtn = document.getElementById('overlayCloseTrigger') as HTMLButtonElement | null;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.inputEl?.addEventListener('input', () => this.autoResize());
    this.inputEl?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.submit();
      }
    });

    this.sendBtn?.addEventListener('click', () => this.submit());
    this.overlayCloseBtn?.addEventListener('click', () => {
      if (this.callbacks.onExitOverlay) {
        this.callbacks.onExitOverlay();
      }
    });
  }

  public autoResize(): void {
    if (!this.inputEl) return;
    this.inputEl.style.height = 'auto';
    this.inputEl.style.height = `${Math.min(this.inputEl.scrollHeight, 200)}px`;
  }

  public submit(): void {
    const text = this.inputEl.value.trim();
    if (!text) return;
    this.inputEl.value = '';
    this.autoResize();
    this.callbacks.onSendMessage(text);
  }

  public getValue(): string {
    return this.inputEl?.value.trim() || '';
  }

  public setValue(val: string): void {
    if (!this.inputEl) return;
    this.inputEl.value = val;
    this.autoResize();
  }

  public setPlaceholder(text: string): void {
    if (this.inputEl) this.inputEl.placeholder = text;
  }

  public focus(): void {
    this.inputEl?.focus();
  }

  public setDisabled(disabled: boolean): void {
    if (this.inputEl) this.inputEl.disabled = disabled;
    if (this.sendBtn) this.sendBtn.disabled = disabled;
    this.wrapperEl?.classList.toggle('streaming', disabled);
  }

  public show(): void {
    if (this.containerEl) {
      this.containerEl.style.display = 'block';
      this.containerEl.classList.remove('hidden');
    }
  }

  public hide(): void {
    if (this.containerEl) {
      this.containerEl.style.display = 'none';
      this.containerEl.classList.add('hidden');
    }
  }

  public isVisible(): boolean {
    if (!this.containerEl) return false;
    return this.containerEl.style.display !== 'none' && !this.containerEl.classList.contains('hidden');
  }
}
