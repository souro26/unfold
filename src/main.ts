import 'katex/dist/katex.min.css';
import { Conversation, Message, BlackboardStep } from './types';
import {
  loadConversations,
  createNewConversation,
  addMessageToConversation,
  setActiveConversationId,
  deleteConversation,
} from './services/storage';
import { setClickThrough, toggleOverlay, sendMessage, captureScreen } from './services/ipc';
import { renderMarkdown } from './utils/markdown';
import { formatTime } from './utils/helpers';
import { SidebarComponent } from './components/Sidebar';
import { ComposerComponent } from './components/Composer';
import { SettingsModalComponent } from './components/SettingsModal';
import { AgentPanelComponent } from './components/AgentPanel';
import { HomeView } from './views/HomeView';
import { ScreenTeachView } from './views/ScreenTeachView';
import { BlackboardView } from './views/BlackboardView';

export class App {
  private sidebar: SidebarComponent;
  private composer: ComposerComponent;
  private settingsModal: SettingsModalComponent;
  private agentPanel: AgentPanelComponent;
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

    this.agentPanel = new AgentPanelComponent({
      onClear: () => this.clearMessages(),
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
        this.composer.hide();
        this.agentPanel.close();
        this.homeView.show();
      },
      onToggleAgent: () => this.toggleAgentPanel(),
    });

    this.blackboardView = new BlackboardView({
      onBack: () => {
        this.composer.setPlaceholder('Message Unfold…');
        this.composer.hide();
        this.agentPanel.close();
        this.homeView.show();
      },
      onToggleAgent: () => this.toggleAgentPanel(),
    });

    this.init();
  }

  private init(): void {
    this.conversations = loadConversations();
    // If the latest conversation is empty, select it; otherwise start fresh on launch with clean Home View
    const latest = this.conversations[0];
    if (latest && latest.messages.length === 0) {
      this.selectConversation(latest.id);
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
      this.composer.show();
      this.agentPanel.open();
      this.renderMessages(conv.messages);
    } else {
      this.homeView.show();
      this.composer.hide();
      this.agentPanel.close();
      this.clearMessages();
    }
  }

  public startNewChat(): void {
    const conv = createNewConversation('New chat');
    this.conversations = loadConversations();
    this.selectConversation(conv.id);
    this.homeView.show();
    this.composer.hide();
    this.agentPanel.close();
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
    const area = document.getElementById('agentPanelBody') || document.getElementById('conversationArea');
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
    this.composer.show();
    this.agentPanel.open();
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
    this.conversations = loadConversations();
    this.sidebar.renderConversations(this.conversations, this.activeConversationId);
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

      // If blackboard view is open, generate interactive blackboard steps from the AI response!
      if (this.blackboardView.isOpen()) {
        const steps = this.parseResponseToBlackboardSteps(response, text);
        if (steps.length > 0) {
          this.blackboardView.open(steps);
        }
      }

      addMessageToConversation(this.activeConversationId!, assistantMsg);
      this.conversations = loadConversations();
      this.sidebar.renderConversations(this.conversations, this.activeConversationId);
    } catch (err) {
      console.error('Failed to get AI response:', err);
      const errText = 'Error: Failed to get response. Please check your API key in Settings.';
      textEl.innerHTML = `<span style="color:var(--danger-color)">${errText}</span>`;
      assistantMsg.content = errText;
      assistantMsg.streaming = false;
      addMessageToConversation(this.activeConversationId!, assistantMsg);
      this.conversations = loadConversations();
      this.sidebar.renderConversations(this.conversations, this.activeConversationId);
    } finally {
      this.isStreaming = false;
      this.composer.setDisabled(false);
      this.composer.focus();
      this.scrollToBottom();
    }
  }

  public toggleAgentPanel(forceState?: boolean): void {
    if (forceState !== undefined) {
      if (forceState) this.agentPanel.open();
      else this.agentPanel.close();
    } else {
      this.agentPanel.toggle();
    }
    if (this.agentPanel.isOpen()) {
      this.composer.show();
      this.composer.focus();
    }
  }

  public enterScreenOverlay(): void {
    this.screenTeachView.enter();
    this.homeView.hide();
    this.composer.show();
    this.agentPanel.open();
    this.composer.setPlaceholder("Ask anything about what's on your screen… (Esc to exit)");
    this.composer.focus();
  }

  public exitScreenOverlay(): void {
    this.screenTeachView.exit();
    this.composer.hide();
    this.agentPanel.close();
    this.homeView.show();
  }

  public enterBlackboard(): void {
    this.homeView.hide();
    this.blackboardView.open([]);
    this.composer.show();
    this.agentPanel.open();
    this.composer.setPlaceholder("Ask what you want to learn on the blackboard…");
    this.composer.focus();
  }

  private parseResponseToBlackboardSteps(response: string, userPrompt: string): BlackboardStep[] {
    // 0. Specialized diagram matching for Set Theory / Venn diagrams / Circles
    const isSetTheory = /set\s*theory|venn|circle|intersection|union|subset/i.test(userPrompt + ' ' + response);
    if (isSetTheory) {
      return [
        {
          step: 1,
          title: 'Sets as Collections: Set A & Set B',
          explanation: 'In set theory, a set is a collection of distinct elements. Here, Circle A represents Set A = {1, 2, 3} and Circle B represents Set B = {3, 4, 5}.',
          elements: [
            { id: 'set_a_circ', type: 'circle', color: '#00d4aa', strokeWidth: 3, start: { x: 340, y: 230 }, radius: 100, text: '{1, 2, 3}' },
            { id: 'set_b_circ', type: 'circle', color: '#7928ca', strokeWidth: 3, start: { x: 540, y: 230 }, radius: 100, text: '{3, 4, 5}' },
            { id: 'label_a', type: 'text', color: '#00d4aa', strokeWidth: 1, start: { x: 340, y: 105 }, text: 'Set A' },
            { id: 'label_b', type: 'text', color: '#a77dff', strokeWidth: 1, start: { x: 540, y: 105 }, text: 'Set B' },
          ],
        },
        {
          step: 2,
          title: 'Intersection (A ∩ B): Common Elements',
          explanation: 'The intersection A ∩ B contains only the elements that belong to BOTH Set A and Set B simultaneously: element {3}.',
          elements: [
            { id: 'set_a_overlap', type: 'circle', color: 'rgba(0, 212, 170, 0.85)', strokeWidth: 3, start: { x: 390, y: 230 }, radius: 110 },
            { id: 'set_b_overlap', type: 'circle', color: 'rgba(121, 40, 202, 0.85)', strokeWidth: 3, start: { x: 490, y: 230 }, radius: 110 },
            { id: 'intersect_text', type: 'text', color: '#ffb86c', strokeWidth: 2, start: { x: 440, y: 230 }, text: 'A ∩ B = {3}' },
            { id: 'a_only', type: 'text', color: '#00d4aa', strokeWidth: 1, start: { x: 320, y: 230 }, text: '{1, 2}' },
            { id: 'b_only', type: 'text', color: '#a77dff', strokeWidth: 1, start: { x: 560, y: 230 }, text: '{4, 5}' },
          ],
        },
        {
          step: 3,
          title: 'Union (A ∪ B) & Universal Set U',
          explanation: 'The union A ∪ B combines all unique elements from both sets: {1, 2, 3, 4, 5}. The outer rectangle represents the Universal Set U.',
          elements: [
            { id: 'univ_box', type: 'rect', color: 'rgba(255, 255, 255, 0.3)', strokeWidth: 2, start: { x: 220, y: 80 }, width: 440, height: 300 },
            { id: 'univ_label', type: 'text', color: 'rgba(255, 255, 255, 0.6)', strokeWidth: 1, start: { x: 300, y: 110 }, text: 'Universal Set U' },
            { id: 'set_a_u', type: 'circle', color: '#00d4aa', strokeWidth: 3, start: { x: 390, y: 240 }, radius: 100 },
            { id: 'set_b_u', type: 'circle', color: '#7928ca', strokeWidth: 3, start: { x: 490, y: 240 }, radius: 100 },
            { id: 'union_card', type: 'text', color: '#00f0ff', strokeWidth: 2, start: { x: 440, y: 350 }, text: 'Union A ∪ B = {1, 2, 3, 4, 5}' },
          ],
        },
      ];
    }

    // 1. Try parsing JSON block if present
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        const list = Array.isArray(parsed) ? parsed : (parsed.steps || []);
        if (list.length > 0 && list[0].title) {
          return list.map((s: any, idx: number) => ({
            step: s.step || idx + 1,
            title: s.title || `Step ${idx + 1}`,
            explanation: s.explanation || s.description || '',
            elements: s.elements || [
              { id: `el_${idx}_1`, type: 'rect', color: '#00d4aa', strokeWidth: 2, start: { x: 140, y: 160 }, width: 220, height: 100 },
              { id: `el_${idx}_2`, type: 'line', color: '#00f0ff', strokeWidth: 2, start: { x: 360, y: 210 }, end: { x: 500, y: 210 } },
              { id: `el_${idx}_3`, type: 'rect', color: '#7928ca', strokeWidth: 2, start: { x: 500, y: 160 }, width: 220, height: 100 },
            ],
          }));
        }
      } catch {}
    }

    // 2. Try parsing markdown step headings (e.g. ### Step 1: ..., ## 1. ..., **Step 1:**)
    const stepRegex = /(?:^|\n)(?:###?\s*(?:Step\s*(\d+)[:.]?|(\d+)[\.:])\s*|\*\*(?:Step\s*(\d+)[:.]?|(\d+)[\.:])\s*)([^\n]+)/gi;
    const matches: { index: number; title: string; stepNum: number }[] = [];
    let m;
    while ((m = stepRegex.exec(response)) !== null) {
      const stepNum = parseInt(m[1] || m[2] || m[3] || m[4] || `${matches.length + 1}`, 10);
      const title = m[5].replace(/\*\*/g, '').trim();
      matches.push({ index: m.index, title, stepNum });
    }

    if (matches.length >= 2) {
      const parsedSteps: BlackboardStep[] = [];
      for (let i = 0; i < matches.length; i++) {
        const current = matches[i];
        const nextIndex = i < matches.length - 1 ? matches[i + 1].index : response.length;
        const bodyText = response.substring(current.index, nextIndex)
          .replace(/^[^\n]+\n/, '')
          .replace(/[#*`_]/g, '')
          .trim();
        const firstSentence = bodyText.split('\n')[0] || bodyText;

        parsedSteps.push({
          step: i + 1,
          title: current.title || `Step ${i + 1}`,
          explanation: firstSentence.slice(0, 200),
          elements: [
            { id: `st_${i}_box1`, type: 'rect', color: i % 2 === 0 ? '#00d4aa' : '#7928ca', strokeWidth: 2, start: { x: 120 + i * 40, y: 160 }, width: 200, height: 100 },
            { id: `st_${i}_line`, type: 'line', color: '#00f0ff', strokeWidth: 2, start: { x: 320 + i * 40, y: 210 }, end: { x: 460 + i * 40, y: 210 } },
            { id: `st_${i}_box2`, type: 'rect', color: '#ffb86c', strokeWidth: 2, start: { x: 460 + i * 40, y: 160 }, width: 180, height: 100 },
          ],
        });
      }
      return parsedSteps;
    }

    // 3. Fallback: Parse paragraphs into 3 clean progressive steps
    const cleanParagraphs = response
      .split('\n\n')
      .map(p => p.replace(/[#*`_]/g, '').trim())
      .filter(p => p.length > 25);

    const step1Text = cleanParagraphs[0] || response.slice(0, 180);
    const step2Text = cleanParagraphs[1] || response.slice(180, 360) || step1Text;
    const step3Text = cleanParagraphs[2] || 'Key takeaway: concept mastered with step-by-step breakdown.';

    return [
      {
        step: 1,
        title: `Core Concept: ${userPrompt.slice(0, 35)}`,
        explanation: step1Text.slice(0, 220),
        elements: [
          { id: 'bb_1_rect', type: 'rect', color: '#00d4aa', strokeWidth: 2, start: { x: 140, y: 160 }, width: 220, height: 110 },
          { id: 'bb_1_arrow', type: 'line', color: '#00f0ff', strokeWidth: 2, start: { x: 360, y: 215 }, end: { x: 500, y: 215 } },
          { id: 'bb_1_box2', type: 'rect', color: '#7928ca', strokeWidth: 2, start: { x: 500, y: 160 }, width: 220, height: 110 },
        ],
      },
      {
        step: 2,
        title: 'Mechanism & Deep Dive',
        explanation: step2Text.slice(0, 220),
        elements: [
          { id: 'bb_2_line1', type: 'line', color: '#00f0ff', strokeWidth: 2, start: { x: 250, y: 160 }, end: { x: 430, y: 100 } },
          { id: 'bb_2_line2', type: 'line', color: '#ffb86c', strokeWidth: 2, start: { x: 430, y: 100 }, end: { x: 610, y: 160 } },
          { id: 'bb_2_rect', type: 'rect', color: '#ffb86c', strokeWidth: 2, start: { x: 330, y: 70 }, width: 200, height: 70 },
          { id: 'bb_2_base', type: 'rect', color: '#00d4aa', strokeWidth: 2, start: { x: 200, y: 240 }, width: 460, height: 90 },
        ],
      },
      {
        step: 3,
        title: 'Definitive Takeaway Card',
        explanation: step3Text.slice(0, 220),
        elements: [
          { id: 'bb_3_card', type: 'rect', color: '#00f0ff', strokeWidth: 3, start: { x: 220, y: 140 }, width: 440, height: 160 },
          { id: 'bb_3_accent', type: 'line', color: '#ffb86c', strokeWidth: 3, start: { x: 220, y: 180 }, end: { x: 660, y: 180 } },
        ],
      },
    ];
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
        if (this.blackboardView.isOpen()) {
          this.blackboardView.close();
          this.homeView.show();
          return;
        }
        if (this.settingsModal.isOpen()) {
          this.settingsModal.close();
          return;
        }
        if (this.agentPanel.isOpen()) {
          this.agentPanel.close();
          return;
        }
      }

      // Ctrl/Cmd + Shift + A: Toggle AI Agent Side Panel
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        this.toggleAgentPanel();
        return;
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