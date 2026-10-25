export interface AgentPanelCallbacks {
  onClose?: () => void;
  onClear?: () => void;
}

export class AgentPanelComponent {
  private panelEl: HTMLElement | null;
  private closeBtn: HTMLButtonElement | null;
  private clearBtn: HTMLButtonElement | null;
  private callbacks: AgentPanelCallbacks;
  private openState: boolean = false;

  constructor(callbacks: AgentPanelCallbacks = {}) {
    this.callbacks = callbacks;
    this.panelEl = document.getElementById('agentPanel');
    this.closeBtn = document.getElementById('closeAgentPanelBtn') as HTMLButtonElement | null;
    this.clearBtn = document.getElementById('agentPanelClearBtn') as HTMLButtonElement | null;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.closeBtn?.addEventListener('click', () => {
      this.close();
      if (this.callbacks.onClose) {
        this.callbacks.onClose();
      }
    });

    this.clearBtn?.addEventListener('click', () => {
      if (this.callbacks.onClear) {
        this.callbacks.onClear();
      }
    });
  }

  public open(): void {
    if (!this.panelEl) return;
    this.openState = true;
    this.panelEl.classList.add('open');
    this.panelEl.removeAttribute('aria-hidden');
  }

  public close(): void {
    if (!this.panelEl) return;
    if (document.activeElement && this.panelEl.contains(document.activeElement)) {
      (document.activeElement as HTMLElement).blur();
    }
    this.openState = false;
    this.panelEl.classList.remove('open');
    this.panelEl.setAttribute('aria-hidden', 'true');
  }

  public toggle(): boolean {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
    return this.isOpen();
  }

  public isOpen(): boolean {
    return this.openState || (this.panelEl ? this.panelEl.classList.contains('open') : false);
  }

  public getElement(): HTMLElement | null {
    return this.panelEl;
  }
}
