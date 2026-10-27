export interface ScreenTeachViewCallbacks {
  onExit: () => void;
  onToggleAgent?: () => void;
}

export class ScreenTeachView {
  private active: boolean = false;
  private callbacks: ScreenTeachViewCallbacks;
  private backBtn: HTMLButtonElement | null = null;
  private agentToggleBtn: HTMLButtonElement | null = null;

  // Screen observation DOM elements
  private container: HTMLElement | null = null;
  private video: HTMLVideoElement | null = null;
  private promptCard: HTMLElement | null = null;
  private grantBtn: HTMLButtonElement | null = null;
  private statusPill: HTMLElement | null = null;
  private statusText: HTMLElement | null = null;
  private changeBtn: HTMLButtonElement | null = null;

  // Active media stream for live screen feed
  private mediaStream: MediaStream | null = null;

  constructor(callbacks: ScreenTeachViewCallbacks) {
    this.callbacks = callbacks;
    this.backBtn = document.getElementById('screenTeachBackBtn') as HTMLButtonElement | null;
    this.agentToggleBtn = document.getElementById('screenAgentToggleBtn') as HTMLButtonElement | null;
    this.container = document.getElementById('screenTeachContainer');
    this.video = document.getElementById('screenTeachVideo') as HTMLVideoElement | null;
    this.promptCard = document.getElementById('screenTeachPromptCard');
    this.grantBtn = document.getElementById('screenTeachGrantBtn') as HTMLButtonElement | null;
    this.statusPill = document.getElementById('screenTeachStatusPill');
    this.statusText = document.getElementById('screenTeachStatusText');
    this.changeBtn = document.getElementById('screenTeachChangeBtn') as HTMLButtonElement | null;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.backBtn?.addEventListener('click', () => {
      this.exit();
    });

    this.agentToggleBtn?.addEventListener('click', () => {
      this.callbacks.onToggleAgent?.();
    });

    this.grantBtn?.addEventListener('click', () => {
      this.requestScreenShare();
    });

    this.changeBtn?.addEventListener('click', () => {
      this.requestScreenShare();
    });
  }

  public async enter(): Promise<void> {
    this.active = true;
    document.body.classList.add('screen-overlay-mode');
    document.querySelector('.app')?.classList.add('screen-overlay-mode');

    // In web browser mode (or whenever native transparency is not active), request live screen feed
    if (!this.isTauri()) {
      if (this.mediaStream && this.mediaStream.active) {
        this.showStreamUI();
      } else {
        await this.requestScreenShare();
      }
    }
  }

  public exit(): void {
    if (!this.active) return;
    this.active = false;
    this.stopScreenShare();
    document.body.classList.remove('screen-overlay-mode');
    document.querySelector('.app')?.classList.remove('screen-overlay-mode');
    this.callbacks.onExit();
  }

  public isActive(): boolean {
    return this.active;
  }

  public async requestScreenShare(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      this.showPromptCard('Screen observation is not supported in this browser environment.');
      return false;
    }

    try {
      this.stopScreenShare();

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
        } as any,
        audio: false,
      });

      this.mediaStream = stream;

      if (this.video) {
        this.video.srcObject = stream;
        this.video.classList.add('has-stream');
        await this.video.play().catch((e) => console.warn('Screen video playback error:', e));
      }

      this.showStreamUI();

      // Handle user stopping screen share via browser's bottom control bar
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.onended = () => {
          this.handleStreamEnded();
        };
      }

      return true;
    } catch (err: any) {
      console.warn('Screen share request dismissed or failed:', err);
      if (this.active) {
        this.showPromptCard();
      }
      return false;
    }
  }

  public async captureCurrentFrame(): Promise<string | undefined> {
    // 1. If we have an active video stream in the web viewport, grab current frame directly
    if (this.video && this.video.videoWidth > 0 && this.video.videoHeight > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          return dataUrl.split(',')[1];
        }
      } catch (err) {
        console.warn('Failed to snapshot frame from live video:', err);
      }
    }

    // 2. In native desktop mode, invoke platform screen capture
    if (this.isTauri()) {
      try {
        const { captureScreen } = await import('../services/ipc');
        const capture = await captureScreen();
        return capture.image_base64;
      } catch (err) {
        console.warn('Native screen capture failed:', err);
      }
    }

    return undefined;
  }

  private showStreamUI(): void {
    if (this.container) {
      this.container.classList.add('observing');
    }
    if (this.promptCard) {
      this.promptCard.classList.add('hidden');
    }
    if (this.video) {
      this.video.classList.add('has-stream');
    }
    if (this.statusPill) {
      this.statusPill.classList.add('active');
    }
    if (this.statusText) {
      this.statusText.textContent = 'Observing Screen';
    }
  }

  private showPromptCard(customMsg?: string): void {
    if (this.container) {
      this.container.classList.remove('observing');
    }
    if (this.statusPill) {
      this.statusPill.classList.remove('active');
    }
    if (this.video) {
      this.video.classList.remove('has-stream');
    }
    if (this.promptCard) {
      this.promptCard.classList.remove('hidden');
      if (customMsg) {
        const p = this.promptCard.querySelector('p');
        if (p) p.textContent = customMsg;
      }
    }
  }

  private handleStreamEnded(): void {
    this.mediaStream = null;
    if (this.video) {
      this.video.srcObject = null;
      this.video.classList.remove('has-stream');
    }
    if (this.statusPill) {
      this.statusPill.classList.remove('active');
    }
    this.showPromptCard('Screen observation paused. Click below to share your screen or window again.');
  }

  private stopScreenShare(): void {
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch {}
      this.mediaStream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video.classList.remove('has-stream');
    }
    if (this.statusPill) {
      this.statusPill.classList.remove('active');
    }
  }

  private isTauri(): boolean {
    return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
  }
}
