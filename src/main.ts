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

      // If blackboard view is open, OR if the prompt is asking to draw/teach/blackboard
      const isBlackboardIntent = this.blackboardView.isOpen() || /blackboard|draw|diagram|visualiz|sketch|canvas|teach\s+me/i.test(text);
      if (isBlackboardIntent) {
        if (!this.blackboardView.isOpen()) {
          this.enterBlackboard();
        }
        const plan = this.parseResponseToBlackboardPlan(response, text);
        if (plan.steps.length > 0) {
          this.blackboardView.open(plan.steps, plan.reasoning, plan.rawJson);
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

  public parseResponseToBlackboardSteps(response: string, userPrompt: string): BlackboardStep[] {
    return this.parseResponseToBlackboardPlan(response, userPrompt).steps;
  }

  private parseResponseToBlackboardPlan(response: string, userPrompt: string): { steps: BlackboardStep[]; reasoning?: any; rawJson?: string } {
    // 0. Extract explicit <reasoning> or <thought> if emitted by LLM
    let extractedReasoning: any = null;
    const reasoningMatch = response.match(/<(?:reasoning|thought)>([\s\S]*?)<\/(?:reasoning|thought)>/i);
    if (reasoningMatch) {
      const rawThought = reasoningMatch[1].trim();
      extractedReasoning = {
        pedagogicalStrategy: rawThought,
        spatialArchitecture: 'LLM Multi-Layer CoT Reasoning Spec',
      };
    }

    // Clean topic name for display
    const cleanTopic = userPrompt
      .replace(/^(?:teach\s+me|explain|what\s+is|how\s+does|draw|show\s+me|visualize)\s+(?:about\s+|what\s+|how\s+)?/i, '')
      .replace(/[?!.]/g, '')
      .trim() || 'Concept Overview';

    // 1. Try parsing JSON block if present from AI
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const rawJsonString = jsonMatch[1].trim();
        const parsed = JSON.parse(rawJsonString);
        const list = Array.isArray(parsed) ? parsed : (parsed.steps || []);
        if (list.length > 0 && (list[0].title || list[0].explanation)) {
          const steps: BlackboardStep[] = list.map((s: any, idx: number) => {
            const rawElements: any[] = s.elements || [];
            const sanitizedElements = rawElements.map((el: any, elIdx: number) => {
              const type = el.type || 'rect';
              const color = el.color || (elIdx % 2 === 0 ? '#00d4aa' : '#00f0ff');
              const strokeWidth = el.strokeWidth || 2;
              const start = el.start || { x: 180 + elIdx * 120, y: 180 };
              return {
                id: el.id || `json_el_${idx}_${elIdx}`,
                type,
                color,
                strokeWidth,
                start,
                end: el.end || (type === 'arrow' || type === 'line' ? { x: start.x + 120, y: start.y } : undefined),
                width: el.width || (type === 'rect' ? 180 : undefined),
                height: el.height || (type === 'rect' ? 90 : undefined),
                radius: el.radius || (type === 'circle' ? 65 : undefined),
                text: el.text || el.label || undefined,
              };
            });

            return {
              step: s.step || idx + 1,
              title: s.title || `Step ${idx + 1}: ${cleanTopic}`,
              explanation: s.explanation || s.description || '',
              elements: sanitizedElements.length > 0 ? sanitizedElements : [
                { id: `el_${idx}_box`, type: 'rect', color: '#00d4aa', strokeWidth: 2, start: { x: 180, y: 160 }, width: 220, height: 100, text: s.title || cleanTopic },
                { id: `el_${idx}_arr`, type: 'arrow', color: '#00f0ff', strokeWidth: 2, start: { x: 400, y: 210 }, end: { x: 520, y: 210 } },
                { id: `el_${idx}_node`, type: 'circle', color: '#7928ca', strokeWidth: 2, start: { x: 600, y: 210 }, radius: 60, text: `State ${idx + 1}` },
              ],
            };
          });

          const reasoning = parsed.reasoning || extractedReasoning;
          return { steps, reasoning, rawJson: rawJsonString };
        }
      } catch {}
    }

    // 2. Extract step headings and texts from Markdown
    const stepRegex = /(?:^|\n)(?:###?\s*(?:Step\s*(\d+)[:.]?|(\d+)[\.:])\s*|\*\*(?:Step\s*(\d+)[:.]?|(\d+)[\.:])\s*)([^\n]+)/gi;
    const headings: { title: string; body: string }[] = [];
    const rawMatches: { index: number; title: string }[] = [];
    let m;
    while ((m = stepRegex.exec(response)) !== null) {
      const title = m[5].replace(/\*\*/g, '').trim();
      rawMatches.push({ index: m.index, title });
    }

    if (rawMatches.length >= 2) {
      for (let i = 0; i < rawMatches.length; i++) {
        const current = rawMatches[i];
        const nextIndex = i < rawMatches.length - 1 ? rawMatches[i + 1].index : response.length;
        const bodyText = response.substring(current.index, nextIndex)
          .replace(/^[^\n]+\n/, '')
          .replace(/[#*`_]/g, '')
          .trim();
        headings.push({ title: current.title, body: bodyText.split('\n')[0] || bodyText });
      }
    } else {
      const cleanParagraphs = response
        .split('\n\n')
        .map(p => p.replace(/[#*`_]/g, '').trim())
        .filter(p => p.length > 20);

      headings.push({
        title: `1. Foundation: ${cleanTopic.slice(0, 30)}`,
        body: cleanParagraphs[0] || response.slice(0, 180),
      });
      headings.push({
        title: `2. Mechanism & Execution`,
        body: cleanParagraphs[1] || response.slice(180, 360) || 'Core process and operational interactions.',
      });
      headings.push({
        title: `3. Definitive Takeaway`,
        body: cleanParagraphs[2] || 'Key principle and synthesis of the concept.',
      });
    }

    const combinedText = (userPrompt + ' ' + response).toLowerCase();

    // 3. Domain Pattern A: Tangent Line, Curves & Circle Geometry
    if (/tangent|secant|point\s*of\s*tangenc|radius\s*tangent|tangent\s*line/i.test(combinedText)) {
      const tangentSteps: BlackboardStep[] = [
        {
          step: 1,
          title: 'Circle, Center O, and Point of Tangency P',
          explanation: 'A tangent describes the exact instantaneous direction of a curve at a single point. Here is a circle with center O(0,0) and radius r, with point of tangency P chosen on the perimeter.',
          elements: [
            // Coordinate Axes
            { id: 'tan_axis_x', type: 'line', color: 'rgba(255, 255, 255, 0.25)', strokeWidth: 1, start: { x: 220, y: 260 }, end: { x: 740, y: 260 } },
            { id: 'tan_axis_y', type: 'line', color: 'rgba(255, 255, 255, 0.25)', strokeWidth: 1, start: { x: 480, y: 70 }, end: { x: 480, y: 440 } },
            { id: 'tan_lbl_x', type: 'text', color: 'rgba(255, 255, 255, 0.6)', strokeWidth: 1, start: { x: 755, y: 265 }, text: 'X' },
            { id: 'tan_lbl_y', type: 'text', color: 'rgba(255, 255, 255, 0.6)', strokeWidth: 1, start: { x: 480, y: 55 }, text: 'Y' },
            // The Circle
            { id: 'tan_circle', type: 'circle', color: '#00f0ff', strokeWidth: 3, start: { x: 480, y: 260 }, radius: 120 },
            // Center O
            { id: 'tan_center', type: 'circle', color: '#ffb86c', strokeWidth: 3, start: { x: 480, y: 260 }, radius: 6 },
            { id: 'tan_center_lbl', type: 'text', color: '#ffb86c', strokeWidth: 1, start: { x: 435, y: 285 }, text: 'Center O(0,0)' },
            // Radius line OP
            { id: 'tan_radius', type: 'line', color: '#ffb86c', strokeWidth: 2, start: { x: 480, y: 260 }, end: { x: 565, y: 175 } },
            { id: 'tan_rad_lbl', type: 'text', color: '#ffb86c', strokeWidth: 1, start: { x: 510, y: 230 }, text: 'Radius r' },
            // Point of Tangency P
            { id: 'tan_pt_p', type: 'circle', color: '#50fa7b', strokeWidth: 4, start: { x: 565, y: 175 }, radius: 8 },
            { id: 'tan_pt_lbl', type: 'text', color: '#50fa7b', strokeWidth: 2, start: { x: 675, y: 165 }, text: 'Point of Tangency P(x₀, y₀)' },
            // Definition Card
            { id: 'tan_eq_card', type: 'rect', color: '#00d4aa', strokeWidth: 2, start: { x: 190, y: 85 }, width: 230, height: 50, text: 'Circle: x² + y² = r²' },
          ],
        },
        {
          step: 2,
          title: 'Secant Line vs. Tangent Line (The Calculus Limit As Δx → 0)',
          explanation: 'A secant line slices through TWO points, P and Q. In calculus, as point Q moves along the circumference closer to P (Δx → 0), the secant line rotates, converging precisely into the tangent line.',
          elements: [
            // Coordinate frame & Circle
            { id: 'tan_axis_x2', type: 'line', color: 'rgba(255, 255, 255, 0.15)', strokeWidth: 1, start: { x: 220, y: 260 }, end: { x: 740, y: 260 } },
            { id: 'tan_axis_y2', type: 'line', color: 'rgba(255, 255, 255, 0.15)', strokeWidth: 1, start: { x: 480, y: 70 }, end: { x: 480, y: 440 } },
            { id: 'tan_circle2', type: 'circle', color: 'rgba(0, 240, 255, 0.5)', strokeWidth: 2, start: { x: 480, y: 260 }, radius: 120 },
            // Point P and Point Q
            { id: 'tan_pt_p2', type: 'circle', color: '#50fa7b', strokeWidth: 4, start: { x: 565, y: 175 }, radius: 8 },
            { id: 'tan_pt_q', type: 'circle', color: '#a77dff', strokeWidth: 3, start: { x: 596, y: 229 }, radius: 7 },
            { id: 'tan_lbl_q', type: 'text', color: '#a77dff', strokeWidth: 1, start: { x: 650, y: 235 }, text: 'Point Q(x₁, y₁)' },
            // Secant line cutting through P and Q
            { id: 'tan_secant', type: 'line', color: '#a77dff', strokeWidth: 2, start: { x: 520, y: 95 }, end: { x: 650, y: 325 } },
            { id: 'tan_sec_lbl', type: 'text', color: '#a77dff', strokeWidth: 1, start: { x: 705, y: 335 }, text: 'Secant Line (Crosses P & Q)' },
            // Limit convergence arrow Q -> P
            { id: 'tan_limit_arr', type: 'arrow', color: '#ffb86c', strokeWidth: 2, start: { x: 605, y: 220 }, end: { x: 578, y: 185 } },
            { id: 'tan_limit_lbl', type: 'text', color: '#ffb86c', strokeWidth: 1, start: { x: 690, y: 195 }, text: 'Limit: Q → P (Δx → 0)' },
            // Derivative Definition Card
            { id: 'tan_calc_card', type: 'rect', color: '#00f0ff', strokeWidth: 2, start: { x: 190, y: 85 }, width: 250, height: 50, text: 'Slope m = lim(Δx→0) Δy/Δx' },
          ],
        },
        {
          step: 3,
          title: 'The Tangent Line: Strictly Perpendicular (90° to Radius)',
          explanation: 'The fundamental theorem: The tangent line touches the circle at EXACTLY ONE point and is strictly perpendicular (90° right angle) to the radius OP at point P.',
          elements: [
            // Circle & Radius
            { id: 'tan_circle3', type: 'circle', color: '#00f0ff', strokeWidth: 3, start: { x: 480, y: 260 }, radius: 120 },
            { id: 'tan_radius3', type: 'line', color: '#ffb86c', strokeWidth: 3, start: { x: 480, y: 260 }, end: { x: 565, y: 175 } },
            // Tangent Line T with dual arrows
            { id: 'tan_line_t', type: 'line', color: '#00d4aa', strokeWidth: 4, start: { x: 425, y: 35 }, end: { x: 705, y: 315 } },
            { id: 'tan_arr_up', type: 'arrow', color: '#00d4aa', strokeWidth: 4, start: { x: 565, y: 175 }, end: { x: 425, y: 35 } },
            { id: 'tan_arr_dn', type: 'arrow', color: '#00d4aa', strokeWidth: 4, start: { x: 565, y: 175 }, end: { x: 705, y: 315 } },
            { id: 'tan_pt_p3', type: 'circle', color: '#50fa7b', strokeWidth: 4, start: { x: 565, y: 175 }, radius: 8 },
            // 90° Perpendicular Square Marker
            { id: 'tan_sq_1', type: 'line', color: '#ffb86c', strokeWidth: 2, start: { x: 555, y: 185 }, end: { x: 545, y: 175 } },
            { id: 'tan_sq_2', type: 'line', color: '#ffb86c', strokeWidth: 2, start: { x: 545, y: 175 }, end: { x: 555, y: 165 } },
            { id: 'tan_90_lbl', type: 'text', color: '#ffb86c', strokeWidth: 2, start: { x: 450, y: 155 }, text: '90° (Tangent ⟂ Radius)' },
            // Theorem badge
            { id: 'tan_t_badge', type: 'rect', color: '#00d4aa', strokeWidth: 2, start: { x: 180, y: 85 }, width: 280, height: 50, text: 'Tangent: Touches at 1 Point' },
          ],
        },
        {
          step: 4,
          title: 'Physics & Real-World Meaning: Instantaneous Velocity',
          explanation: 'In physics, if an object whirls in a circle and is released, it flies off along the tangent—the direction of instantaneous velocity. In calculus, the tangent slope is the instantaneous rate of change.',
          elements: [
            // Circular Orbit
            { id: 'tan_orbit', type: 'circle', color: 'rgba(0, 240, 255, 0.35)', strokeWidth: 2, start: { x: 480, y: 260 }, radius: 120 },
            // Orbiting particle P
            { id: 'tan_particle', type: 'circle', color: '#ff5555', strokeWidth: 4, start: { x: 565, y: 175 }, radius: 10, text: 'm' },
            // Instantaneous Velocity Vector
            { id: 'tan_vel_arr', type: 'arrow', color: '#50fa7b', strokeWidth: 4, start: { x: 565, y: 175 }, end: { x: 390, y: 0 } },
            { id: 'tan_vel_lbl', type: 'text', color: '#50fa7b', strokeWidth: 2, start: { x: 360, y: 35 }, text: 'Velocity Vector v⃗ (Instantaneous)' },
            // Centripetal acceleration
            { id: 'tan_acc_arr', type: 'arrow', color: '#ffb86c', strokeWidth: 3, start: { x: 565, y: 175 }, end: { x: 505, y: 235 } },
            { id: 'tan_acc_lbl', type: 'text', color: '#ffb86c', strokeWidth: 1, start: { x: 565, y: 250 }, text: 'Centripetal Force F_c' },
            // Derivative Formula Card
            { id: 'tan_deriv_card', type: 'rect', color: '#00f0ff', strokeWidth: 2, start: { x: 170, y: 340 }, width: 280, height: 60, text: 'Calculus: dy/dx = f\'(x₀)' },
            // Takeaway Card
            { id: 'tan_takeaway', type: 'rect', color: '#7928ca', strokeWidth: 3, start: { x: 480, y: 330 }, width: 420, height: 80, text: 'Takeaway: Tangent = Instantaneous Direction' },
          ],
        },
      ];
      const tangentReasoning = {
        pedagogicalStrategy: "Deconstruct the tangent line conceptually from foundational geometry to calculus limits and instantaneous physics.\n\n• Step 1: Establish the circular coordinate frame, center O(0,0), radius r, and point of tangency P(x₀, y₀).\n• Step 2: Introduce the secant line intersecting at P and Q, demonstrating the limiting process as Δx → 0 and Q → P.\n• Step 3: Reveal the true tangent line touching strictly at P, highlighting the fundamental theorem of 90° perpendicularity (T ⊥ OP).\n• Step 4: Physical intuition with instantaneous velocity vector v directed along the tangent and centripetal force Fc directed toward center O.",
        spatialArchitecture: "Canvas 850×520 bounding area:\n• Coordinate origin & axes: x-axis y=260, y-axis x=480.\n• Main circle: Center (480, 260), radius r=120px (Cyan #00f0ff).\n• Point of tangency P: (565, 175) (Emerald #50fa7b).\n• Radius vector OP: (480, 260) to (565, 175) (Orange #ffb86c).\n• Secant line: Passing through P(565, 175) and Q(596, 229).\n• Tangent line: Linear slope m = -1 through P with dual arrowheads (Purple #00d4aa).\n• Right angle: Exact 90° square marker at P aligned between radius and tangent.\n• Particle velocity: Mass dot at P with instantaneous velocity vector v pointing along tangent line (Coral #ff5555).",
        mentalModel: "A tangent is the linear approximation of a curve at a single point, representing instantaneous rate of change.",
      };
      return { steps: tangentSteps, reasoning: tangentReasoning, rawJson: JSON.stringify({ reasoning: tangentReasoning, steps: tangentSteps }, null, 2) };
    }

    let finalSteps: BlackboardStep[] = [];
    let domainReasoning: any = null;

    // 4. Domain Pattern B: Set Theory / Venn Diagrams / Overlapping Groups
    if (/set\s*theory|venn|intersection|union|subset|disjoint/i.test(combinedText)) {
      domainReasoning = {
        pedagogicalStrategy: "Set Theory pedagogy begins with discrete boundaries, then explores relational overlap (intersection), and culminates in the complete universe (union).\n\n• Step 1: Separate sets A and B with discrete elements.\n• Step 2: Overlapping intersection (A ∩ B) isolating shared members.\n• Step 3: Global union (A ∪ B) inside Universal Set U.",
        spatialArchitecture: "Dual intersecting circles: Center A at (390, 230), Center B at (490, 230), radius 110px. Universal bounding rectangle (220, 80) 440×300px.",
        mentalModel: "Sets are mathematical containers; Venn diagrams turn logical operations into spatial geometry.",
      };
      finalSteps = [
        {
          step: 1,
          title: headings[0]?.title || 'Sets as Distinct Collections: Set A & Set B',
          explanation: headings[0]?.body || 'A set is a well-defined collection of distinct elements. Here Set A and Set B represent two discrete collections.',
          elements: [
            { id: 'set_a_circ', type: 'circle', color: '#00d4aa', strokeWidth: 3, start: { x: 340, y: 230 }, radius: 100, text: '{1, 2, 3}' },
            { id: 'set_b_circ', type: 'circle', color: '#7928ca', strokeWidth: 3, start: { x: 540, y: 230 }, radius: 100, text: '{3, 4, 5}' },
            { id: 'label_a', type: 'text', color: '#00d4aa', strokeWidth: 1, start: { x: 340, y: 105 }, text: 'Set A' },
            { id: 'label_b', type: 'text', color: '#a77dff', strokeWidth: 1, start: { x: 540, y: 105 }, text: 'Set B' },
          ],
        },
        {
          step: 2,
          title: headings[1]?.title || 'Intersection (A ∩ B): Common Overlap',
          explanation: headings[1]?.body || 'The intersection contains only elements that exist in BOTH sets simultaneously: {3}.',
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
          title: headings[2]?.title || 'Union (A ∪ B) & Universal Set U',
          explanation: headings[2]?.body || 'The union joins all unique elements from both sets: {1, 2, 3, 4, 5}. The outer boundary is the Universal Set U.',
          elements: [
            { id: 'univ_box', type: 'rect', color: 'rgba(255, 255, 255, 0.3)', strokeWidth: 2, start: { x: 220, y: 80 }, width: 440, height: 300, text: 'Universal Set U' },
            { id: 'set_a_u', type: 'circle', color: '#00d4aa', strokeWidth: 3, start: { x: 390, y: 240 }, radius: 100 },
            { id: 'set_b_u', type: 'circle', color: '#7928ca', strokeWidth: 3, start: { x: 490, y: 240 }, radius: 100 },
            { id: 'union_card', type: 'text', color: '#00f0ff', strokeWidth: 2, start: { x: 440, y: 350 }, text: 'Union A ∪ B = {1, 2, 3, 4, 5}' },
          ],
        },
      ];
      return { steps: finalSteps, reasoning: domainReasoning, rawJson: JSON.stringify({ reasoning: domainReasoning, steps: finalSteps }, null, 2) };
    }

    // 5. Domain Pattern C: Trees / Search / Recursion / Hierarchy / Sorting
    if (/tree|binary|search|bst|recursion|recursive|sort|heap|graph|traversal|dfs|bfs/i.test(combinedText)) {
      domainReasoning = {
        pedagogicalStrategy: "Hierarchical data structures are best taught through recursive descent: starting at the root, applying branching decisions, and returning base case resolutions.\n\n• Step 1: Examine root node and compare search key against target.\n• Step 2: Branch navigation (left vs right subtree based on ordering invariant).\n• Step 3: Base case match and stack unwinding.",
        spatialArchitecture: "Root node at (440, 120), left child at (290, 240), right child at (590, 240). Directed arrows with decision annotations.",
        mentalModel: "Trees partition a search space logarithmically at each decision node.",
      };
      finalSteps = [
        {
          step: 1,
          title: headings[0]?.title || `1. Root Node & Initial Target`,
          explanation: headings[0]?.body || `Beginning traversal at the root node to evaluate the search condition.`,
          elements: [
            { id: 'tree_root', type: 'circle', color: '#00d4aa', strokeWidth: 3, start: { x: 440, y: 130 }, radius: 45, text: 'Root: 50' },
            { id: 'tree_target', type: 'rect', color: '#ffb86c', strokeWidth: 2, start: { x: 180, y: 90 }, width: 140, height: 60, text: 'Target: 25' },
            { id: 'tree_start_arr', type: 'arrow', color: '#ffb86c', strokeWidth: 2, start: { x: 320, y: 120 }, end: { x: 395, y: 130 } },
          ],
        },
        {
          step: 2,
          title: headings[1]?.title || `2. Recursive Branching & Evaluation`,
          explanation: headings[1]?.body || `Comparing target against current node; navigating the left branch since 25 < 50.`,
          elements: [
            { id: 'tree_root_2', type: 'circle', color: '#00d4aa', strokeWidth: 3, start: { x: 440, y: 120 }, radius: 40, text: '50' },
            { id: 'edge_left', type: 'arrow', color: '#00f0ff', strokeWidth: 3, start: { x: 410, y: 150 }, end: { x: 310, y: 220 } },
            { id: 'edge_right', type: 'line', color: 'rgba(255,255,255,0.25)', strokeWidth: 2, start: { x: 470, y: 150 }, end: { x: 570, y: 220 } },
            { id: 'tree_left', type: 'circle', color: '#00f0ff', strokeWidth: 3, start: { x: 290, y: 240 }, radius: 40, text: '25' },
            { id: 'tree_right', type: 'circle', color: 'rgba(255,255,255,0.3)', strokeWidth: 2, start: { x: 590, y: 240 }, radius: 40, text: '75' },
            { id: 'decision_badge', type: 'text', color: '#ffb86c', strokeWidth: 2, start: { x: 320, y: 175 }, text: '25 < 50 (Go Left)' },
          ],
        },
        {
          step: 3,
          title: headings[2]?.title || `3. Match Reached / Base Case Return`,
          explanation: headings[2]?.body || `Target found at node 25! Base case return unwinds call stack with O(log n) efficiency.`,
          elements: [
            { id: 'tree_root_3', type: 'circle', color: 'rgba(255,255,255,0.4)', strokeWidth: 2, start: { x: 440, y: 120 }, radius: 35, text: '50' },
            { id: 'edge_found', type: 'arrow', color: '#50fa7b', strokeWidth: 3, start: { x: 410, y: 150 }, end: { x: 310, y: 220 } },
            { id: 'tree_found', type: 'circle', color: '#50fa7b', strokeWidth: 4, start: { x: 290, y: 240 }, radius: 45, text: 'MATCH: 25' },
            { id: 'return_card', type: 'rect', color: '#00f0ff', strokeWidth: 2, start: { x: 460, y: 210 }, width: 220, height: 90, text: 'O(log n) Target Resolved' },
          ],
        },
      ];
      return { steps: finalSteps, reasoning: domainReasoning, rawJson: JSON.stringify({ reasoning: domainReasoning, steps: finalSteps }, null, 2) };
    }

    // 6. Domain Pattern D: Systems / Client-Server / Networking / Web
    if (/server|client|api|database|network|http|cloud|microservice|auth|rest|tcp/i.test(combinedText)) {
      domainReasoning = {
        pedagogicalStrategy: "Distributed systems are deconstructed through request-response lifecycles and architectural boundaries.\n\n• Step 1: Client egress with HTTP protocol metadata.\n• Step 2: Server ingress, business logic validation, and database tier querying.\n• Step 3: Response payload serialization and client terminal resolution.",
        spatialArchitecture: "Three-tier topology: Client (160, 170), Server (490, 170), Database (690, 215). Bidirectional request and response vectors.",
        mentalModel: "Network architectures isolate concerns between presentation, compute, and persistence layers.",
      };
      finalSteps = [
        {
          step: 1,
          title: headings[0]?.title || '1. Client Request Initiation',
          explanation: headings[0]?.body || 'Client device originates an HTTPS request towards the API Gateway / Server.',
          elements: [
            { id: 'sys_client', type: 'rect', color: '#00d4aa', strokeWidth: 2, start: { x: 160, y: 170 }, width: 170, height: 90, text: 'Client App' },
            { id: 'sys_req_arr', type: 'arrow', color: '#00f0ff', strokeWidth: 2, start: { x: 330, y: 215 }, end: { x: 490, y: 215 } },
            { id: 'sys_req_text', type: 'text', color: '#ffb86c', strokeWidth: 1, start: { x: 410, y: 195 }, text: 'GET /api/data' },
            { id: 'sys_server', type: 'rect', color: '#7928ca', strokeWidth: 2, start: { x: 490, y: 170 }, width: 180, height: 90, text: 'API Server' },
          ],
        },
        {
          step: 2,
          title: headings[1]?.title || '2. Processing & Database Query',
          explanation: headings[1]?.body || 'Server authenticates request, executes business logic, and queries the database.',
          elements: [
            { id: 'sys_server_2', type: 'rect', color: '#7928ca', strokeWidth: 2, start: { x: 340, y: 170 }, width: 180, height: 90, text: 'API Server' },
            { id: 'sys_db_arr', type: 'arrow', color: '#ffb86c', strokeWidth: 2, start: { x: 520, y: 215 }, end: { x: 640, y: 215 } },
            { id: 'sys_db', type: 'circle', color: '#00d4aa', strokeWidth: 3, start: { x: 690, y: 215 }, radius: 55, text: 'Database' },
            { id: 'sys_auth_badge', type: 'rect', color: '#00f0ff', strokeWidth: 1, start: { x: 340, y: 80 }, width: 180, height: 50, text: 'Auth & Validation' },
          ],
        },
        {
          step: 3,
          title: headings[2]?.title || '3. Response Payload & Resolution',
          explanation: headings[2]?.body || 'Database returns record set; server sends 200 OK JSON payload back to client.',
          elements: [
            { id: 'sys_res_client', type: 'rect', color: '#00d4aa', strokeWidth: 2, start: { x: 160, y: 170 }, width: 170, height: 90, text: 'Client App' },
            { id: 'sys_res_arr', type: 'arrow', color: '#50fa7b', strokeWidth: 3, start: { x: 490, y: 215 }, end: { x: 330, y: 215 } },
            { id: 'sys_res_label', type: 'text', color: '#50fa7b', strokeWidth: 2, start: { x: 410, y: 195 }, text: '200 OK (JSON)' },
            { id: 'sys_res_server', type: 'rect', color: '#7928ca', strokeWidth: 2, start: { x: 490, y: 170 }, width: 180, height: 90, text: 'API Server' },
          ],
        },
      ];
      return { steps: finalSteps, reasoning: domainReasoning, rawJson: JSON.stringify({ reasoning: domainReasoning, steps: finalSteps }, null, 2) };
    }

    // 7. Domain Pattern E: Pipelines / Cycles / Science / Machine Learning
    if (/pipeline|flow|stream|cycle|loop|compiler|train|photo|engine|process|model|learn/i.test(combinedText)) {
      domainReasoning = {
        pedagogicalStrategy: "Sequential transformation pipelines deconstruct inputs, state mutations, feedback loops, and output validation.\n\n• Step 1: Ingestion and multi-stream intake.\n• Step 2: Core processing engine with feedback convergence.\n• Step 3: Verified output delivery.",
        spatialArchitecture: "Pipeline stage boxes spanning left to right from (200, 200) to (640, 225) with closed feedback loops.",
        mentalModel: "Pipelines transform data continuously through chained invariant stages.",
      };
      finalSteps = [
        {
          step: 1,
          title: headings[0]?.title || '1. Inputs & Primary Ingestion',
          explanation: headings[0]?.body || `Source data and raw inputs prepared for the transformation stage.`,
          elements: [
            { id: 'pipe_in1', type: 'circle', color: '#00d4aa', strokeWidth: 2, start: { x: 200, y: 170 }, radius: 50, text: 'Input A' },
            { id: 'pipe_in2', type: 'circle', color: '#7928ca', strokeWidth: 2, start: { x: 200, y: 290 }, radius: 50, text: 'Input B' },
            { id: 'pipe_arr1', type: 'arrow', color: '#00f0ff', strokeWidth: 2, start: { x: 250, y: 170 }, end: { x: 370, y: 210 } },
            { id: 'pipe_arr2', type: 'arrow', color: '#00f0ff', strokeWidth: 2, start: { x: 250, y: 290 }, end: { x: 370, y: 250 } },
            { id: 'pipe_stage1', type: 'rect', color: '#ffb86c', strokeWidth: 2, start: { x: 370, y: 190 }, width: 180, height: 80, text: 'Ingestion Engine' },
          ],
        },
        {
          step: 2,
          title: headings[1]?.title || '2. Processing & Transformation Stage',
          explanation: headings[1]?.body || `Core mechanism executes state transitions and continuous processing logic.`,
          elements: [
            { id: 'pipe_core', type: 'rect', color: '#00d4aa', strokeWidth: 3, start: { x: 240, y: 170 }, width: 220, height: 110, text: 'Core Processor' },
            { id: 'pipe_flow', type: 'arrow', color: '#00f0ff', strokeWidth: 3, start: { x: 460, y: 225 }, end: { x: 580, y: 225 } },
            { id: 'pipe_state', type: 'circle', color: '#ffb86c', strokeWidth: 3, start: { x: 640, y: 225 }, radius: 60, text: 'Transformed' },
            { id: 'pipe_feedback', type: 'arrow', color: 'rgba(255,255,255,0.4)', strokeWidth: 2, start: { x: 640, y: 165 }, end: { x: 350, y: 120 } },
            { id: 'pipe_feed_lbl', type: 'text', color: '#a77dff', strokeWidth: 1, start: { x: 490, y: 130 }, text: 'Feedback Loop' },
          ],
        },
        {
          step: 3,
          title: headings[2]?.title || '3. Output Synthesis & Delivery',
          explanation: headings[2]?.body || `Synthesized artifact produced with verified status and high fidelity.`,
          elements: [
            { id: 'pipe_out_card', type: 'rect', color: '#50fa7b', strokeWidth: 3, start: { x: 260, y: 160 }, width: 360, height: 120, text: 'Final Validated Output' },
            { id: 'pipe_badge', type: 'circle', color: '#00f0ff', strokeWidth: 3, start: { x: 440, y: 320 }, radius: 45, text: '100% Ready' },
          ],
        },
      ];
      return { steps: finalSteps, reasoning: domainReasoning, rawJson: JSON.stringify({ reasoning: domainReasoning, steps: finalSteps }, null, 2) };
    }

    // 8. Universal General Fallback for EVERY other prompt
    domainReasoning = {
      pedagogicalStrategy: `Pedagogical deconstruction of ${cleanTopic}:\n\n• Step 1: Establish primary entities and foundational principles.\n• Step 2: Unpack dynamic interactions, state transitions, and mechanisms.\n• Step 3: Synthesize definitive takeaways and practical mental models.`,
      spatialArchitecture: "Canvas layout organized into source entity, transformation core, and destination state with clear directional arrows.",
      mentalModel: `Conceptual breakdown of ${cleanTopic} into progressive interactive stages.`,
    };
    finalSteps = [
      {
        step: 1,
        title: headings[0]?.title || `1. Core Foundation: ${cleanTopic.slice(0, 30)}`,
        explanation: headings[0]?.body || `Foundational overview of ${cleanTopic} establishing key entities and principles.`,
        elements: [
          { id: 'gen_subj', type: 'rect', color: '#00d4aa', strokeWidth: 2, start: { x: 180, y: 170 }, width: 220, height: 95, text: cleanTopic.slice(0, 24) },
          { id: 'gen_arr1', type: 'arrow', color: '#00f0ff', strokeWidth: 2, start: { x: 400, y: 217 }, end: { x: 530, y: 217 } },
          { id: 'gen_entity', type: 'circle', color: '#7928ca', strokeWidth: 3, start: { x: 595, y: 217 }, radius: 65, text: 'Core Entity' },
          { id: 'gen_init_lbl', type: 'text', color: '#ffb86c', strokeWidth: 1, start: { x: 465, y: 195 }, text: 'Initialize' },
        ],
      },
      {
        step: 2,
        title: headings[1]?.title || '2. Mechanism & Dynamic Interactions',
        explanation: headings[1]?.body || `Examining the functional relationships, internal execution, and interactions.`,
        elements: [
          { id: 'gen_box_a', type: 'rect', color: '#00d4aa', strokeWidth: 2, start: { x: 160, y: 170 }, width: 170, height: 90, text: 'Component A' },
          { id: 'gen_arr_mid', type: 'arrow', color: '#00f0ff', strokeWidth: 2, start: { x: 330, y: 215 }, end: { x: 460, y: 215 } },
          { id: 'gen_core_box', type: 'rect', color: '#ffb86c', strokeWidth: 2, start: { x: 460, y: 170 }, width: 180, height: 90, text: 'Process Core' },
          { id: 'gen_arr_out', type: 'arrow', color: '#50fa7b', strokeWidth: 2, start: { x: 640, y: 215 }, end: { x: 730, y: 215 } },
          { id: 'gen_badge', type: 'circle', color: '#7928ca', strokeWidth: 2, start: { x: 770, y: 215 }, radius: 40, text: 'State B' },
        ],
      },
      {
        step: 3,
        title: headings[2]?.title || '3. Synthesis & Definitive Takeaway',
        explanation: headings[2]?.body || `Key principle and practical summary synthesized for lasting retention.`,
        elements: [
          { id: 'gen_card', type: 'rect', color: '#00f0ff', strokeWidth: 3, start: { x: 220, y: 150 }, width: 440, height: 130, text: `Key Takeaway: ${cleanTopic.slice(0, 28)}` },
          { id: 'gen_accent', type: 'line', color: '#ffb86c', strokeWidth: 3, start: { x: 220, y: 200 }, end: { x: 660, y: 200 } },
          { id: 'gen_verified', type: 'circle', color: '#50fa7b', strokeWidth: 3, start: { x: 440, y: 320 }, radius: 35, text: '✓ Mastered' },
        ],
      },
    ];
    return { steps: finalSteps, reasoning: domainReasoning, rawJson: JSON.stringify({ reasoning: domainReasoning, steps: finalSteps }, null, 2) };
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