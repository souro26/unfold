import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { App } from '../src/main';
import { SettingsModalComponent } from '../src/components/SettingsModal';
import { SidebarComponent } from '../src/components/Sidebar';
import { ComposerComponent } from '../src/components/Composer';
import { BlackboardView } from '../src/views/BlackboardView';
import { ScreenTeachView } from '../src/views/ScreenTeachView';
import { HomeView } from '../src/views/HomeView';
import * as storage from '../src/services/storage';
import * as ipc from '../src/services/ipc';
import { ExportService } from '../src/services/export';
import { SpeechService } from '../src/services/speech';

function setupFullDOM(): void {
  document.body.innerHTML = `
    <div class="app">
      <div id="sidebar" class="sidebar">
        <button id="sidebarToggle" class="sidebar-toggle"></button>
        <button id="newChatBtn" class="sidebar-btn"></button>
        <button id="clickThroughToggle" class="click-through-toggle">
          <span id="ctStatus" class="ct-status">OFF</span>
        </button>
        <div id="conversationList" class="conversation-list"></div>
        <button id="settingsBtn" class="sidebar-btn"></button>
      </div>

      <main class="main" id="mainArea">
        <div class="conversation-area" id="conversationArea">
          <div id="emptyState" class="empty-state">
            <button id="screenTeachMode" class="mode-card"></button>
            <button id="blackboardMode" class="mode-card"></button>
          </div>
          <div class="messages" id="messages" style="display: none;"></div>
        </div>

        <div class="composer">
          <div class="composer-inner">
            <div class="composer-wrapper" id="composerWrapper">
              <textarea id="composerInput" placeholder="Message Unfold…"></textarea>
              <div class="composer-actions">
                <button class="composer-btn" id="attachBtn"></button>
                <button class="composer-btn send" id="sendBtn"></button>
                <button class="composer-btn overlay-close-trigger" id="overlayCloseTrigger"></button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Blackboard Visualization Overlay -->
    <div class="visualization-overlay" id="vizOverlay">
      <div class="viz-header">
        <div class="title" id="vizTitle">Visualization</div>
        <div class="viz-actions">
          <button class="viz-btn" id="vizPresentation"></button>
          <div class="export-dropdown-container">
            <button class="viz-btn" id="vizExportBtn"></button>
            <div class="export-menu hidden" id="exportMenu">
              <button class="export-menu-item" id="exportMermaid">Mermaid</button>
              <button class="export-menu-item" id="exportExcalidraw">Excalidraw</button>
              <button class="export-menu-item" id="exportPlantUML">PlantUML</button>
              <button class="export-menu-item" id="exportManim">Manim</button>
            </div>
          </div>
          <button class="viz-btn" id="vizFullscreen"></button>
          <button class="viz-btn" id="vizClose"></button>
        </div>
      </div>
      <div class="viz-body">
        <canvas id="vizCanvas"></canvas>
      </div>
      <div class="viz-controls">
        <span class="viz-step-title" id="stepIndicator">Step 1</span>
        <span class="viz-step-desc" id="vizDescription"></span>
        <button class="viz-btn" id="stepPrev">Previous</button>
        <button class="viz-btn" id="stepPlay">Autoplay</button>
        <button class="viz-btn" id="stepNext">Next</button>
        <button class="viz-btn" id="stepVoice">Narrate</button>
      </div>
      <div class="presentation-hud" id="presentationHud">
        <button class="hud-btn" id="hudPrev"></button>
        <span class="hud-step-badge" id="hudStepBadge">Step 1</span>
        <button class="hud-btn" id="hudPlay"></button>
        <button class="hud-btn" id="hudNext"></button>
        <button class="hud-btn" id="hudExit"></button>
      </div>
    </div>
  `;
}

describe('End-to-End UI & QA Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    setupFullDOM();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Application Bootstrap & Navigation QA', () => {
    it('initializes cleanly, creates initial conversation, and renders empty state', () => {
      const app = new App();
      expect(app.getActiveConversation()).toBeDefined();
      expect(document.getElementById('emptyState')?.style.display).not.toBe('none');
      expect(document.getElementById('messages')?.style.display).toBe('none');
    });

    it('clicking Screen Teach card activates translucent overlay mode with bottom composer', () => {
      new App();
      const screenTeachBtn = document.getElementById('screenTeachMode');
      screenTeachBtn?.click();

      expect(document.body.classList.contains('screen-overlay-mode')).toBe(true);
      const input = document.getElementById('composerInput') as HTMLTextAreaElement;
      expect(input.placeholder).toContain("Ask anything about what's on your screen");
    });

    it('exiting Screen Teach mode via trigger button or Escape restores normal view', () => {
      new App();
      document.getElementById('screenTeachMode')?.click();
      expect(document.body.classList.contains('screen-overlay-mode')).toBe(true);

      // Press Escape
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(document.body.classList.contains('screen-overlay-mode')).toBe(false);

      const input = document.getElementById('composerInput') as HTMLTextAreaElement;
      expect(input.placeholder).toBe('Message Unfold…');
    });

    it('clicking Blackboard mode card opens visualization overlay with animated steps', () => {
      new App();
      document.getElementById('blackboardMode')?.click();

      const overlay = document.getElementById('vizOverlay');
      expect(overlay?.classList.contains('visible')).toBe(true);
      expect(document.getElementById('vizTitle')?.textContent).toContain('Introduction');
    });
  });

  describe('2. Conversation Lifecycle & Edge Cases QA', () => {
    it('supports creating multiple chats and switching between them with full message sync', () => {
      const app = new App();
      const firstChatId = app.getActiveConversation()!.id;

      // Add a message to first chat
      storage.addMessageToConversation(firstChatId, {
        role: 'user',
        content: 'Hello in chat 1',
        timestamp: Date.now(),
      });
      app.selectConversation(firstChatId);
      expect(document.getElementById('messages')?.innerHTML).toContain('Hello in chat 1');

      // Create new chat
      app.startNewChat();
      const secondChatId = app.getActiveConversation()!.id;
      expect(secondChatId).not.toBe(firstChatId);
      expect(document.getElementById('messages')?.style.display).toBe('none');

      // Switch back to first chat
      app.selectConversation(firstChatId);
      expect(app.getActiveConversation()!.id).toBe(firstChatId);
      expect(document.getElementById('messages')?.innerHTML).toContain('Hello in chat 1');
    });

    it('deleting conversation falls back to remaining chat or creates clean chat if empty', () => {
      const app = new App();
      const firstId = app.getActiveConversation()!.id;

      // Add second chat
      const secondConv = storage.createNewConversation('Chat 2');
      app.selectConversation(secondConv.id);

      // Delete active chat 2
      app.handleDeleteConversation(secondConv.id);
      expect(app.getActiveConversation()!.id).toBe(firstId);

      // Delete remaining chat 1
      app.handleDeleteConversation(firstId);
      expect(app.getActiveConversation()).toBeDefined();
      expect(app.getActiveConversation()!.id).not.toBe(firstId);
    });

    it('delete button inside conversation list triggers deletion without selecting item', () => {
      const app = new App();
      const conv1 = app.getActiveConversation()!;
      const conv2 = storage.createNewConversation('Chat To Delete');

      const delSpy = vi.spyOn(app, 'handleDeleteConversation');
      app.selectConversation(conv1.id);

      const items = document.querySelectorAll('.conversation-item');
      const itemToDelete = Array.from(items).find(
        (el) => (el as HTMLElement).dataset.id === conv2.id
      );
      const delBtn = itemToDelete?.querySelector('.delete-conv-btn') as HTMLButtonElement;
      delBtn?.click();

      expect(delSpy).toHaveBeenCalledWith(conv2.id);
    });
  });

  describe('3. Composer & Messaging Interactions QA', () => {
    it('ignores empty or whitespace-only messages', async () => {
      const app = new App();
      const sendSpy = vi.spyOn(ipc, 'sendMessage');

      await app.handleSendMessage('');
      await app.handleSendMessage('     ');
      await app.handleSendMessage('\n\n\t  ');

      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('submits message, shows streaming indicator, disables inputs, and displays markdown result', async () => {
      const app = new App();
      vi.spyOn(ipc, 'sendMessage').mockResolvedValue(
        '# Response\nHere is a formula: $E = mc^2$\n```python\nprint("hello")\n```'
      );

      const input = document.getElementById('composerInput') as HTMLTextAreaElement;
      input.value = 'Explain mass-energy equivalence';

      const submitPromise = app.handleSendMessage(input.value);

      // During sending
      expect(input.disabled).toBe(true);
      expect(document.getElementById('composerWrapper')?.classList.contains('streaming')).toBe(true);

      await submitPromise;

      // After receiving response
      expect(input.disabled).toBe(false);
      expect(document.getElementById('composerWrapper')?.classList.contains('streaming')).toBe(false);

      const msgsHtml = document.getElementById('messages')?.innerHTML || '';
      expect(msgsHtml).toContain('Explain mass-energy equivalence');
      expect(msgsHtml).toContain('katex'); // Rendered formula
      expect(msgsHtml).toContain('copy-code-btn'); // Rendered code block
    });

    it('code copy button copies code content to clipboard and shows temporary feedback', async () => {
      const app = new App();
      const writeTextSpy = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextSpy,
        },
      });

      const msgEl = app.appendMessageDOM({
        role: 'assistant',
        content: '```rust\nfn main() {}\n```',
        timestamp: Date.now(),
      });

      const copyBtn = msgEl.querySelector('.copy-code-btn') as HTMLButtonElement;
      expect(copyBtn).toBeTruthy();

      copyBtn.click();
      expect(writeTextSpy).toHaveBeenCalledWith('fn main() {}');
      expect(copyBtn.textContent).toBe('Copied!');
    });

    it('handles API error gracefully and displays styled error toast without breaking app', async () => {
      const app = new App();
      vi.spyOn(ipc, 'sendMessage').mockRejectedValue(new Error('Network offline or rate limit'));

      await app.handleSendMessage('What is consensus?');

      const msgsHtml = document.getElementById('messages')?.innerHTML || '';
      expect(msgsHtml).toContain('Error: Failed to get response');
      expect(document.getElementById('composerInput')).not.toBeNull();
    });
  });

  describe('4. Blackboard View, Gestures & Presentation QA', () => {
    it('guards against empty steps and handles single-step boundaries gracefully', async () => {
      const bbView = new BlackboardView();

      // Empty steps guard
      await bbView.open([]);
      expect(bbView.isOpen()).toBe(true);
      bbView.nextStep();
      bbView.prevStep();

      // Single step edge case
      await bbView.open([{ step: 1, title: 'Solo Step', explanation: 'Only one step exists' }]);
      expect(document.getElementById('stepIndicator')?.textContent).toBe('Step 1 of 1');
      const prevBtn = document.getElementById('stepPrev') as HTMLButtonElement;
      const nextBtn = document.getElementById('stepNext') as HTMLButtonElement;
      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(true);

      bbView.close();
      expect(bbView.isOpen()).toBe(false);
    });

    it('autoplay cycles through steps and stops automatically at the final step', async () => {
      vi.useFakeTimers();
      const bbView = new BlackboardView();
      const steps = [
        { step: 1, title: 'S1', explanation: 'E1' },
        { step: 2, title: 'S2', explanation: 'E2' },
        { step: 3, title: 'S3', explanation: 'E3' },
      ];
      await bbView.open(steps);

      bbView.toggleAutoplay();
      expect(document.getElementById('stepPlay')?.textContent).toBe('Pause');

      // Fast forward
      vi.advanceTimersByTime(3600);
      expect(document.getElementById('vizTitle')?.textContent).toBe('S2');

      vi.advanceTimersByTime(3600);
      expect(document.getElementById('vizTitle')?.textContent).toBe('S3');

      // At end of steps, autoplay stops
      vi.advanceTimersByTime(3600);
      expect(document.getElementById('stepPlay')?.textContent).toBe('Autoplay');

      vi.useRealTimers();
      bbView.close();
    });

    it('presentation mode toggles via F5 and handles Esc to exit cleanly', async () => {
      const bbView = new BlackboardView();
      await bbView.open([{ step: 1, title: 'Pres Step', explanation: 'Pres details' }]);

      expect(bbView.isPresentationMode()).toBe(false);

      // Press F5 to enter
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5' }));
      expect(bbView.isPresentationMode()).toBe(true);

      // Press Esc to exit
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(bbView.isPresentationMode()).toBe(false);

      bbView.close();
    });

    it('handles mouse/trackpad wheel gestures for pinch-zoom and pan', async () => {
      const bbView = new BlackboardView();
      await bbView.open([{ step: 1, title: 'Zoom Test', explanation: 'Testing canvas zoom' }]);

      const canvas = document.getElementById('vizCanvas') as HTMLCanvasElement;

      // Wheel pinch-zoom (ctrlKey)
      canvas.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -100 }));
      expect(bbView.getViewport().zoom).toBeGreaterThan(1.0);

      // Wheel pan
      canvas.dispatchEvent(new WheelEvent('wheel', { ctrlKey: false, deltaX: 20, deltaY: 30 }));
      expect(bbView.getViewport().panX).toBe(-20);
      expect(bbView.getViewport().panY).toBe(-30);

      // Press '0' to reset viewport
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '0' }));
      expect(bbView.getViewport()).toEqual({ zoom: 1.0, rotation: 0, panX: 0, panY: 0 });

      bbView.close();
    });
  });

  describe('5. Settings Modal QA & Edge Cases', () => {
    it('opens modal, changes provider to llama_cpp, updates hints, and saves', async () => {
      const saveSpy = vi.spyOn(ipc, 'saveSettings').mockResolvedValue();
      const modal = new SettingsModalComponent();

      await modal.open();
      expect(modal.isOpen()).toBe(true);

      const providerSelect = document.getElementById('providerSelect') as HTMLSelectElement;
      const apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;
      const apiKeyHint = document.getElementById('apiKeyHint') as HTMLElement;

      // Switch to llama_cpp local sidecar
      providerSelect.value = 'llama_cpp';
      providerSelect.dispatchEvent(new Event('change'));

      expect(apiKeyHint.textContent).toContain('Optional for local models');
      expect(apiKeyInput.placeholder).toBe('Optional');

      // Click save and await
      await modal.save();

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          llm_provider: 'llama_cpp',
          model: 'nemotron-3-4b-int4',
        })
      );

      expect(modal.isOpen()).toBe(false);
    });

    it('closes on cancel button, backdrop click, or Escape key', async () => {
      const modal = new SettingsModalComponent();

      // Cancel button
      await modal.open();
      expect(modal.isOpen()).toBe(true);
      document.getElementById('cancelSettingsBtn')?.click();
      expect(modal.isOpen()).toBe(false);

      // Backdrop click
      await modal.open();
      expect(modal.isOpen()).toBe(true);
      document.getElementById('settingsModal')?.click();
      expect(modal.isOpen()).toBe(false);

      // Escape key
      await modal.open();
      expect(modal.isOpen()).toBe(true);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(modal.isOpen()).toBe(false);
    });
  });

  describe('6. Click-Through Toggle QA', () => {
    it('toggles click-through state and updates UI badge', async () => {
      const app = new App();
      vi.spyOn(ipc, 'setClickThrough').mockResolvedValue(true);

      await app.toggleClickThrough();
      expect(document.getElementById('ctStatus')?.textContent).toBe('ON');
      expect(document.getElementById('clickThroughToggle')?.classList.contains('active')).toBe(true);

      vi.spyOn(ipc, 'setClickThrough').mockResolvedValue(false);
      await app.toggleClickThrough();
      expect(document.getElementById('ctStatus')?.textContent).toBe('OFF');
      expect(document.getElementById('clickThroughToggle')?.classList.contains('active')).toBe(false);
    });
  });
});
