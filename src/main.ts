import { Conversation, Message, BlackboardStep } from './types';
import {
  loadConversations,
  createNewConversation,
  addMessageToConversation,
  getActiveConversationId,
  setActiveConversationId,
  deleteConversation,
} from './services/storage';
import { setClickThrough, toggleOverlay, sendMessage, captureScreen } from './services/ipc';
import { renderMarkdown } from './utils/markdown';
import { formatTime } from './utils/helpers';
import { SidebarComponent } from './components/Sidebar';
import { ComposerComponent } from './components/Composer';
import { SettingsModalComponent } from './components/SettingsModal';
import { HomeView } from './views/HomeView';
import { ScreenTeachView } from './views/ScreenTeachView';
import { BlackboardView } from './views/BlackboardView';

export class App {
  private sidebar: SidebarComponent;
  private composer: ComposerComponent;
  private settingsModal: SettingsModalComponent;
  private homeView: HomeView;
  private screenTeachView: ScreenTeachView;
  private blackboardView: BlackboardView;

  private conversations: Conversation[] = [];
  private activeConversationId: string | null = null;
  private isClickThrough: boolean = false;
  private isStreaming: boolean = false;
  private messagesContainer: HTMLElement;

  constructor() {
    this.messagesContainer = document.getElementById('messages') as HTMLElement;

    // Initialize Components
    this.sidebar = new SidebarComponent({
      onSelectConversation: (id) => this.selectConversation(id),
      onNewChat: () => this.startNewChat(),
      onOpenSettings: () => this.settingsModal.open(),
      onToggleClickThrough: () => this.toggleClickThrough(),
      onDeleteConversation: (id) => this.handleDeleteConversation(id),
    });

    this.composer = new ComposerComponent({
      onSendMessage: (text) => this.handleSendMessage(text),
      onExitOverlay: () => this.exitScreenOverlay(),
    });

    this.settingsModal = new SettingsModalComponent();

    // Initialize Views
    this.homeView = new HomeView({
      onStartScreenTeach: () => this.enterScreenOverlay(),
      onStartBlackboard: () => this.enterBlackboard(),
    });

    this.screenTeachView = new ScreenTeachView({
      onExit: () => {
        this.composer.setPlaceholder('Message Unfold…');
        const active = this.getActiveConversation();
        if (!active || active.messages.length === 0) {
          this.homeView.show();
        }
      },
    });

    this.blackboardView = new BlackboardView();

    this.init();
  }

  private init(): void {
    this.conversations = loadConversations();
    this.activeConversationId = getActiveConversationId();

    if (this.activeConversationId && this.conversations.some((c) => c.id === this.activeConversationId)) {
      this.selectConversation(this.activeConversationId);
    } else if (this.conversations.length > 0) {
      this.selectConversation(this.conversations[0].id);
    } else {
      this.startNewChat();
    }

    this.bindGlobalKeyboardShortcuts();
  }

  public getActiveConversation(): Conversation | undefined {
    return this.conversations.find((c) => c.id === this.activeConversationId);
  }

  public selectConversation(id: string): void {
    this.conversations = loadConversations();
    this.activeConversationId = id;
    setActiveConversationId(id);
    this.sidebar.renderConversations(this.conversations, id);

    const conv = this.getActiveConversation();
    if (conv && conv.messages.length > 0) {
      this.homeView.hide();
      this.renderMessages(conv.messages);
    } else {
      this.homeView.show();
      this.clearMessages();
    }
  }

  public startNewChat(): void {
    const conv = createNewConversation('New chat');
    this.conversations = loadConversations();
    this.selectConversation(conv.id);
    this.homeView.show();
    this.composer.focus();
  }

  public handleDeleteConversation(id: string): void {
    deleteConversation(id);
    this.conversations = loadConversations();
    if (this.activeConversationId === id) {
      if (this.conversations.length > 0) {
        this.selectConversation(this.conversations[0].id);
      } else {
        this.startNewChat();
      }
    } else {
      this.sidebar.renderConversations(this.conversations, this.activeConversationId);
    }
  }

  public renderMessages(messages: Message[]): void {
    if (!this.messagesContainer) return;
    this.messagesContainer.style.display = 'flex';
    this.messagesContainer.innerHTML = '';

    messages.forEach((msg) => this.appendMessageDOM(msg));
    this.scrollToBottom();
  }

  public clearMessages(): void {
    if (!this.messagesContainer) return;
    this.messagesContainer.innerHTML = '';
    this.messagesContainer.style.display = 'none';
  }

  public appendMessageDOM(msg: Message): HTMLElement {
    const div = document.createElement('div');
    div.className = `message ${msg.role}`;
    const formattedTime = formatTime(msg.timestamp);

    div.innerHTML = `
      <div class="message-avatar">
        ${
          msg.role === 'user'
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`
        }
      </div>
      <div class="message-content">
        <div class="message-header">
          <span class="role">${msg.role === 'user' ? 'You' : 'Unfold'}</span>
          <span class="time">${formattedTime}</span>
        </div>
        <div class="message-text">${renderMarkdown(msg.content)}</div>
      </div>
    `;

    // Attach copy button listeners for code blocks
    div.querySelectorAll('.copy-code-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const code = (btn as HTMLElement).dataset.code || '';
        navigator.clipboard.writeText(code);
        btn.textContent = 'Copied!';
        setTimeout(() => (btn.textContent = 'Copy'), 2000);
      });
    });

    this.messagesContainer.appendChild(div);
    return div;
  }

  public scrollToBottom(): void {
    const area = document.getElementById('conversationArea');
    if (area) area.scrollTop = area.scrollHeight;
  }

  public async handleSendMessage(text: string): Promise<void> {
    const trimmed = text ? text.trim() : '';
    if (!trimmed || this.isStreaming) return;
    text = trimmed;

    if (!this.activeConversationId) {
      this.startNewChat();
    }

    this.homeView.hide();
    this.messagesContainer.style.display = 'flex';

    let screenImageBase64: string | undefined = undefined;
    if (this.screenTeachView.isActive()) {
      try {
        const capture = await captureScreen();
        screenImageBase64 = capture.image_base64;
      } catch (err) {
        console.warn('Screen capture failed:', err);
      }
    }

    const userMsg: Message = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
      image_base64: screenImageBase64,
    };

    addMessageToConversation(this.activeConversationId!, userMsg);
    this.appendMessageDOM(userMsg);
    this.scrollToBottom();

    // Stream / Request AI response
    this.isStreaming = true;
    this.composer.setDisabled(true);

    const assistantMsg: Message = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      streaming: true,
    };
    const msgEl = this.appendMessageDOM(assistantMsg);
    const textEl = msgEl.querySelector('.message-text') as HTMLElement;
    textEl.innerHTML = `
      <div class="streaming-indicator">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    `;

    try {
      const response = await sendMessage(text, this.activeConversationId!, screenImageBase64);
      assistantMsg.content = response;
      assistantMsg.streaming = false;
      textEl.innerHTML = renderMarkdown(response);

      // Re-bind code copy buttons
      msgEl.querySelectorAll('.copy-code-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const code = (btn as HTMLElement).dataset.code || '';
          navigator.clipboard.writeText(code);
          btn.textContent = 'Copied!';
          setTimeout(() => (btn.textContent = 'Copy'), 2000);
        });
      });

      addMessageToConversation(this.activeConversationId!, assistantMsg);
      this.conversations = loadConversations();
      this.sidebar.renderConversations(this.conversations, this.activeConversationId);
    } catch (err) {
      console.error('Failed to get AI response:', err);
      textEl.innerHTML = `<span style="color:var(--danger-color)">Error: Failed to get response. Please check your API key in Settings.</span>`;
    } finally {
      this.isStreaming = false;
      this.composer.setDisabled(false);
      this.composer.focus();
      this.scrollToBottom();
    }
  }

  public enterScreenOverlay(): void {
    this.screenTeachView.enter();
    this.homeView.hide();
    this.composer.setPlaceholder("Ask anything about what's on your screen… (Esc to exit)");
    this.composer.focus();
  }

  public exitScreenOverlay(): void {
    this.screenTeachView.exit();
  }

  public enterBlackboard(): void {
    const sampleSteps: BlackboardStep[] = [
      {
        step: 1,
        title: 'Introduction & Core Concept',
        explanation: 'Every distributed system begins with isolated nodes communicating over a network.',
        elements: [
          { id: '1', type: 'rect', color: '#00d4aa', strokeWidth: 2, start: { x: 100, y: 150 }, width: 140, height: 80 },
          { id: '2', type: 'line', color: '#00f0ff', strokeWidth: 2, start: { x: 240, y: 190 }, end: { x: 380, y: 190 } },
          { id: '3', type: 'rect', color: '#00d4aa', strokeWidth: 2, start: { x: 380, y: 150 }, width: 140, height: 80 },
        ],
      },
      {
        step: 2,
        title: 'Consensus & Message Flow',
        explanation: 'Raft consensus guarantees leader election and replicated state machines across clusters.',
        elements: [
          { id: '4', type: 'pen', color: '#ffb86c', strokeWidth: 3, points: [{ x: 100, y: 150 }, { x: 250, y: 80 }, { x: 380, y: 150 }] },
        ],
      },
    ];
    this.blackboardView.open(sampleSteps);
  }

  public async toggleClickThrough(): Promise<void> {
    try {
      this.isClickThrough = await setClickThrough(!this.isClickThrough);
      this.sidebar.updateClickThrough(this.isClickThrough);
    } catch (err) {
      console.error('Failed to toggle click through:', err);
    }
  }

  private bindGlobalKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Escape key exits overlay or modals
      if (e.key === 'Escape') {
        if (this.screenTeachView.isActive()) {
          this.exitScreenOverlay();
          return;
        }
        if (this.settingsModal.isOpen()) {
          this.settingsModal.close();
          return;
        }
        if (this.blackboardView.isOpen()) {
          this.blackboardView.close();
          return;
        }
      }

      // Ctrl/Cmd + Shift + U: Toggle Overlay visibility
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        toggleOverlay().catch(console.error);
        return;
      }

      // Ctrl/Cmd + N: New Chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        this.startNewChat();
      }

      // Ctrl/Cmd + Shift + S: Screen Teach Mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.enterScreenOverlay();
      }

      // Ctrl/Cmd + Shift + B: Blackboard Mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        this.enterBlackboard();
      }
    });
  }
}

// Bootstrap on DOM ready
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    new App();
  });
}