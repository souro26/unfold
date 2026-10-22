// src/main.ts - Chat-based teaching overlay with visualization support
import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { initSkia, drawStroke as skiaDrawStroke, hexToSkColor } from './renderer-skia';

// ── Tauri / Browser bridge ───────────────────────────────────────────────────
// When running with `npm run dev` (plain browser), window.__TAURI_INTERNALS__
// is absent. All invoke() calls below use this wrapper so the UI stays
// functional for development without crashing.
const isTauri = () => typeof (window as any).__TAURI_INTERNALS__ !== 'undefined';

const LOCAL_SETTINGS_KEY = 'unfold_settings';
const DEFAULT_SETTINGS = {
  llm_provider: 'gemini', api_key: null as string | null,
  model: 'gemini-1.5-flash', theme: 'dark', screen_capture_permission: false,
};
function getLocalSettings() {
  try { return JSON.parse(localStorage.getItem(LOCAL_SETTINGS_KEY) || 'null'); } catch { return null; }
}
function saveLocalSettings(s: unknown) {
  try { localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) return tauriInvoke<T>(cmd, args);
  // Browser-only mock so every button still works during dev
  switch (cmd) {
    case 'get_settings':         return (getLocalSettings() ?? DEFAULT_SETTINGS) as T;
    case 'update_settings':      saveLocalSettings((args as any)?.settings); return undefined as T;
    case 'toggle_click_through': return false as T;
    case 'set_click_through':    return false as T;
    case 'toggle_overlay':       return true as T;
    case 'send_message': {
      const p = (args as any)?.prompt ?? '';
      return `[Browser preview — Tauri not running]\n\nYou asked: "${p}"\n\nFor real AI replies launch with **npm run tauri dev**.` as T;
    }
    case 'list_monitors':
      return [{ index: 0, name: 'Primary Monitor', width: window.screen.width, height: window.screen.height, is_primary: true }] as T;
    case 'capture_screen':             return { image_base64: '', width: 0, height: 0, format: 'png' } as T;
    case 'capture_screen_with_vision': return { content: '[Screen capture requires Tauri]', model: '', provider: '' } as T;
    case 'get_screen_capture_permission': return false as T;
    case 'set_screen_capture_permission': return undefined as T;
    default:
      console.warn(`[mock] unknown invoke: ${cmd}`);
      return undefined as T;
  }
}
// ────────────────────────────────────────────────────────────────────────────


interface ChatMessage {
  role: string;
  content: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  streaming?: boolean;
  image_base64?: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

interface ScreenCaptureResponse {
  image_base64: string;
  width: number;
  height: number;
  format: string;
}

interface VisionResponse {
  content: string;
  model: string;
  provider: string;
  usage?: UsageInfo;
}

interface UsageInfo {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface MonitorInfo {
  index: number;
  name: string;
  width: number;
  height: number;
  is_primary: boolean;
}

let currentConversationId: string | null = null;
let conversations: Conversation[] = [];
let isStreaming = false;
let currentStreamController: AbortController | null = null;

// UI Elements
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const sidebar = document.getElementById('sidebar')!;
const sidebarToggle = document.getElementById('sidebarToggle')!;
const sidebarOverlay = document.getElementById('sidebarOverlay')!;
const newChatBtn = document.getElementById('newChatBtn')!;
const searchBtn = document.getElementById('searchBtn')!;
const settingsBtn = document.getElementById('settingsBtn')!;
const conversationList = document.getElementById('conversationList')!;
const emptyState = document.getElementById('emptyState')!;
const messagesContainer = document.getElementById('messages')!;
const suggestionsContainer = document.getElementById('suggestions');
const composerInput = document.getElementById('composerInput') as HTMLTextAreaElement;
const composerWrapper = document.getElementById('composerWrapper')!;
const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement;
const vizOverlay = document.getElementById('vizOverlay')!;
const vizTitle = document.getElementById('vizTitle')!;
const vizClose = document.getElementById('vizClose')!;
const vizFullscreen = document.getElementById('vizFullscreen')!;
const vizCanvas = document.getElementById('vizCanvas') as HTMLCanvasElement;
const ctIndicator = document.getElementById('ctIndicator')!;
const tint = document.getElementById('tint');

// Screen Overlay Mode Top Bar Buttons
const overlayRetakeBtn = document.getElementById('overlayRetakeBtn');
const overlayDrawBtn = document.getElementById('overlayDrawBtn');
const overlayDrawLabel = document.getElementById('overlayDrawLabel');
const overlayClickThroughBtn = document.getElementById('overlayClickThroughBtn');
const overlayCtLabel = document.getElementById('overlayCtLabel');
const overlayExitBtn = document.getElementById('overlayExitBtn');

let clickThrough = false;
let isDrawingOnScreen = false;
let activeScreenOverlayMode = false;
let latestScreenContext: string | null = null;
let tintOpacity = 0;
let _skia: any = null;
let useSkia = false;
let _isDrawing = false;
let _currentStroke: Point[] = [];
let _strokes: Stroke[] = [];
let currentTool: Tool = 'pen';

type Tool = 'pen' | 'highlighter' | 'eraser' | 'arrow' | 'text';
type Point = { x: number; y: number; pressure?: number; time?: number };
type Stroke = { points: Point[]; tool: Tool; color: string; width: number };

const toolSettings: Record<Tool, { color: string; width: number }> = {
  pen: { color: '#00f0ff', width: 3 },
  highlighter: { color: '#ffb800', width: 30 },
  eraser: { color: '#000000', width: 30 },
  arrow: { color: '#00d4aa', width: 3 },
  text: { color: '#ffffff', width: 16 },
};

async function initRenderer() {
  try {
    _skia = await initSkia();
    useSkia = true;
    console.log('Skia renderer initialized');
  } catch (e) {
    console.warn('Skia init failed, falling back to Canvas 2D:', e);
    useSkia = false;
  }
  setupCanvas();
}

function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  if (!useSkia) {
    ctx.scale(dpr, dpr);
  }
}

function setupVizCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = vizCanvas.getBoundingClientRect();
  vizCanvas.width = rect.width * dpr;
  vizCanvas.height = rect.height * dpr;
  vizCanvas.style.width = rect.width + 'px';
  vizCanvas.style.height = rect.height + 'px';
  if (!useSkia) {
    const vizCtx = vizCanvas.getContext('2d')!;
    vizCtx.scale(dpr, dpr);
  }
}

window.addEventListener('resize', () => {
  setupCanvas();
  if (vizOverlay.classList.contains('visible')) {
    setupVizCanvas();
  }
  redraw();
});

function redraw() {
  if (useSkia) {
    redrawSkia();
  } else {
    redrawCanvas2D();
  }
}

function redrawSkia() {
  if (!_skia) return;
  let surface: any = null;
  try {
    surface = _skia.MakeCanvasSurface(canvas);
  } catch (err) {
    console.warn('Skia MakeCanvasSurface failed, falling back to Canvas 2D:', err);
  }
  if (!surface) {
    useSkia = false;
    redrawCanvas2D();
    return;
  }
  const ckCanvas = surface.getCanvas();
  ckCanvas.clear(_skia.TRANSPARENT);
  if (tintOpacity > 0) {
    const paint = _skia.Paint();
    paint.setColor(hexToSkColor(_skia, '#000000'));
    paint.setAlphaf(tintOpacity);
    ckCanvas.drawPaint(paint);
    paint.delete();
  }
  for (const stroke of _strokes) {
    skiaDrawStroke(_skia, ckCanvas, stroke, 1);
  }
  if (_isDrawing && _currentStroke.length > 1) {
    const s = toolSettings[currentTool];
    skiaDrawStroke(_skia, ckCanvas, { points: _currentStroke, tool: currentTool, color: s.color, width: s.width }, 1);
  }
  surface.flush();
  surface.delete();
}

function redrawCanvas2D() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  if (tintOpacity > 0) {
    ctx.fillStyle = `rgba(0,0,0,${tintOpacity})`;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  }
  for (const stroke of _strokes) {
    drawStrokeCanvas2D(stroke, 1);
  }
  if (_isDrawing && _currentStroke.length > 1) {
    drawStrokeCanvas2D({ points: _currentStroke, tool: currentTool, color: toolSettings[currentTool].color, width: toolSettings[currentTool].width }, 1);
  }
}

function drawStrokeCanvas2D(stroke: Stroke, progress: number) {
  if (stroke.points.length < 2) return;
  const { color, width } = stroke;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = progress;
  if (stroke.tool === 'pen' || stroke.tool === 'highlighter') {
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length - 2; i++) {
      const p0 = stroke.points[i-1];
      const p1 = stroke.points[i];
      const p2 = stroke.points[i+1];
      const p3 = stroke.points[i+2];
      for (let t = 0; t <= 10; t++) {
        const tt = t / 10;
        const pos = catmullRom(p0, p1, p2, p3, tt);
        ctx.lineTo(pos.x, pos.y);
      }
    }
    ctx.stroke();
  } else if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number) {
  const t2 = t*t, t3 = t2*t;
  return {
    x: 0.5 * ((2*p1.x) + (-p0.x+p2.x)*t + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    y: 0.5 * ((2*p1.y) + (-p0.y+p2.y)*t + (2*p0.y-5*p1.y+4*p2.y-p3.y)*t2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*t3)
  };
}

sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  sidebarOverlay.classList.toggle('visible', window.innerWidth <= 1000 && !sidebar.classList.contains('collapsed'));
});

const clickThroughToggle = document.getElementById('clickThroughToggle')!;
const ctStatus = document.getElementById('ctStatus')!;

function updateOverlayClickThroughUI() {
  overlayClickThroughBtn?.classList.toggle('active', clickThrough);
  if (overlayCtLabel) {
    overlayCtLabel.textContent = clickThrough ? 'Click-Through: ON' : 'Click-Through: OFF';
  }
}

function updateOverlayDrawBtnUI() {
  overlayDrawBtn?.classList.toggle('active', isDrawingOnScreen);
  if (overlayDrawLabel) {
    overlayDrawLabel.textContent = isDrawingOnScreen ? 'Drawing: ON' : 'Draw';
  }
}

function updateClickThroughUI() {
  clickThroughToggle.classList.toggle('active', clickThrough);
  ctStatus.textContent = clickThrough ? 'ON' : 'OFF';
  ctStatus.classList.toggle('bg-teal', clickThrough);
  ctStatus.classList.toggle('bg-red', !clickThrough);
  clickThroughToggle.title = `Click-through: ${clickThrough ? 'ON' : 'OFF'} (Ctrl+Shift+X to toggle)`;
  updateOverlayClickThroughUI();
}

clickThroughToggle.addEventListener('click', async () => {
  await toggleClickThrough();
  updateClickThroughUI();
});

// Initialize UI
updateClickThroughUI();

sidebarOverlay.addEventListener('click', () => {
  sidebar.classList.add('collapsed');
  sidebarOverlay.classList.remove('visible');
});

newChatBtn.addEventListener('click', startNewChat);

function startNewChat() {
  currentConversationId = null;
  conversations = conversations.filter(c => c.messages.length > 0);
  renderConversationList();
  showEmptyState();
  composerInput.value = '';
  composerInput.style.height = 'auto';
  composerInput.focus();
}

async function createNewConversation(firstMessage: string): Promise<string> {
  const id = 'conv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');
  const conversation: Conversation = {
    id,
    title,
    messages: [],
    createdAt: Date.now()
  };
  conversations.unshift(conversation);
  await saveConversations();
  renderConversationList();
  return id;
}

function selectConversation(id: string) {
  const conv = conversations.find(c => c.id === id);
  if (!conv) return;
  currentConversationId = id;
  renderConversationList();
  showConversation(conv);
  composerInput.focus();
}

function renderConversationList() {
  conversationList.innerHTML = '';
  conversations.forEach(conv => {
    const item = document.createElement('button');
    item.className = 'conversation-item' + (conv.id === currentConversationId ? ' active' : '');
    item.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span class="title-text">${escapeHtml(conv.title)}</span>
    `;
    item.addEventListener('click', () => selectConversation(conv.id));
    conversationList.appendChild(item);
  });
  if (conversations.length === 0) {
    conversationList.innerHTML = '<div style="padding: 16px; color: #666; font-size: 12px; text-align: center;">No conversations yet</div>';
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showEmptyState() {
  emptyState.classList.remove('hidden');
  emptyState.classList.add('visible');
  messagesContainer.classList.add('hidden');
  messagesContainer.classList.remove('visible');
  emptyState.scrollIntoView({ behavior: 'smooth' });
}

function showConversation(conv: Conversation) {
  emptyState.classList.add('hidden');
  emptyState.classList.remove('visible');
  messagesContainer.classList.remove('hidden');
  messagesContainer.classList.add('visible');
  messagesContainer.innerHTML = '';
  conv.messages.forEach(msg => {
    if (!msg.streaming) {
      appendMessage(msg);
    }
  });
  scrollToBottom();
}

function appendMessage(msg: Message) {
  const div = document.createElement('div');
  div.className = 'message ' + msg.role;
  div.dataset.msgId = String(msg.timestamp);

  const imageHtml = msg.image_base64 ? `
    <div class="screen-context-card">
      <img class="screen-context-thumb" src="data:image/png;base64,${msg.image_base64}" alt="Screen Context" title="Click to open full snapshot" onclick="window.open('data:image/png;base64,${msg.image_base64}', '_blank')"/>
      <div class="screen-context-details">
        <div class="screen-context-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
          Active Screen Context
        </div>
        <div class="screen-context-subtitle">Screen snapshot attached to this question</div>
      </div>
    </div>
  ` : '';

  div.innerHTML = `
    <div class="message-avatar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${msg.role === 'user'
          ? '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'
          : '<path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/>'}
      </svg>
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="role">${msg.role === 'user' ? 'You' : 'Unfold'}</span>
        <span class="time">${formatTime(msg.timestamp)}</span>
      </div>
      ${imageHtml}
      <div class="message-text">${renderMarkdown(msg.content)}</div>
    </div>
  `;
  messagesContainer.appendChild(div);
  return div;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderMarkdown(text: string): string {
  return text
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
      '<pre><code class="' + (lang || '') + '">' + escapeHtml(code.trim()) + '</code></pre>'
    )
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function autoResizeTextarea(textarea: HTMLTextAreaElement) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

composerInput.addEventListener('input', () => autoResizeTextarea(composerInput));

composerInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    await sendMessage();
  }
  autoResizeTextarea(composerInput);
});

sendBtn.addEventListener('click', sendMessage);

async function sendMessage() {
  if (blackboardMode) {
    await sendBlackboardMessage();
    return;
  }
  
  const text = composerInput.value.trim();
  if (!text || isStreaming) return;

  composerInput.value = '';
  autoResizeTextarea(composerInput);
  hideEmptyState();

  if (!currentConversationId) {
    currentConversationId = await createNewConversation(text);
  }

  let screenImageBase64: string | undefined = undefined;
  if (activeScreenOverlayMode) {
    try {
      const captureResult = await invoke<ScreenCaptureResponse>('capture_screen', {
        request: {
          region: { x: selectedMonitorIndex, y: 0, width: 0, height: 0 },
          include_cursor: false
        }
      });
      screenImageBase64 = captureResult.image_base64;
      latestScreenContext = captureResult.image_base64;
    } catch (err) {
      console.warn('Screen capture failed:', err);
    }
  }

  const userMsg: Message = { 
    role: 'user', 
    content: text, 
    timestamp: Date.now(),
    image_base64: screenImageBase64 
  };
  addMessageToConversation(currentConversationId, userMsg);
  appendMessage(userMsg);
  scrollToBottom();

  await sendToAI(text, screenImageBase64);
}

function addMessageToConversation(convId: string, msg: Message) {
  const conv = conversations.find(c => c.id === convId);
  if (conv) {
    conv.messages.push(msg);
    saveConversations();
  }
}

function hideEmptyState() {
  emptyState.classList.add('hidden');
  emptyState.classList.remove('visible');
  messagesContainer.classList.remove('hidden');
  messagesContainer.classList.add('visible');
}

async function sendToAI(prompt: string, screenImageBase64?: string) {
  isStreaming = true;
  currentStreamController = new AbortController();
  sendBtn.disabled = true;
  composerInput.disabled = true;
  composerWrapper.classList.add('streaming');

  const assistantMsg: Message = { role: 'assistant', content: '', timestamp: Date.now(), streaming: true };
  addMessageToConversation(currentConversationId!, assistantMsg);
  appendStreamingPlaceholder();

  try {
    const imgToSend = screenImageBase64 || ((activeScreenOverlayMode && latestScreenContext) ? latestScreenContext : undefined);
    const response = await invoke<string>('send_message', {
      prompt,
      conversation_id: currentConversationId,
      image_base64: imgToSend,
      request: {
        prompt,
        conversation_id: currentConversationId,
        image_base64: imgToSend
      }
    });

    let fullResponse = response;
    let displayed = '';
    const chunks = fullResponse.split(' ');

    for (let i = 0; i < chunks.length; i++) {
      if (currentStreamController?.signal.aborted) break;
      displayed += (i > 0 ? ' ' : '') + chunks[i];
      updateStreamingMessage(displayed + ' ');
      await new Promise(r => setTimeout(r, 30));
    }

    finalizeMessage(fullResponse);
  } catch (error) {
    console.error('AI request failed:', error);
    finalizeMessage('Sorry, I encountered an error. Please try again.');
  } finally {
    isStreaming = false;
    currentStreamController = null;
    sendBtn.disabled = false;
    composerInput.disabled = false;
    composerWrapper.classList.remove('streaming');
    composerInput.focus();
  }
}

function appendStreamingPlaceholder(): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'message assistant streaming';
  div.dataset.msgId = 'streaming_' + Date.now();
  div.innerHTML = `
    <div class="message-avatar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/></svg>
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="role">Unfold</span>
        <span class="time">Just now</span>
      </div>
      <div class="message-text">
        <span class="streaming-indicator">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
          <span>Thinking...</span>
        </span>
      </div>
    </div>
  `;
  messagesContainer.appendChild(div);
  scrollToBottom();
  return div;
}

function updateStreamingMessage(text: string) {
  const streamingDiv = messagesContainer.querySelector('.message.streaming');
  if (streamingDiv) {
    const textDiv = streamingDiv.querySelector('.message-text');
    if (textDiv) {
      textDiv.innerHTML = text.replace(/\n/g, '<br>');
      scrollToBottom();
    }
  }
}

function finalizeMessage(content: string) {
  const streamingDiv = messagesContainer.querySelector('.message.streaming');
  if (streamingDiv) {
    streamingDiv.classList.remove('streaming');
    const textDiv = streamingDiv.querySelector('.message-text');
    if (textDiv) {
      textDiv.innerHTML = renderMarkdown(content);
    }
    streamingDiv.querySelector('.message-header .time')!.textContent = formatTime(Date.now());

    if (currentConversationId) {
      const conv = conversations.find(c => c.id === currentConversationId);
      if (conv) {
        const msgIndex = conv.messages.findIndex(m => m.streaming);
        if (msgIndex >= 0) {
          conv.messages[msgIndex] = { role: 'assistant', content, timestamp: Date.now() };
          saveConversations();
        }
      }
    }
    scrollToBottom();
  }
}

suggestionsContainer?.addEventListener('click', (e) => {
  const card = (e.target as HTMLElement).closest('.suggestion-card') as HTMLElement | null;
  if (card) {
    const prompt = card.dataset.prompt!;
    composerInput.value = prompt;
    autoResizeTextarea(composerInput);
    hideEmptyState();
    sendMessage();
  }
});

// Teaching mode handlers
const screenTeachBtn = document.getElementById('screenTeachMode')!;
const blackboardBtn = document.getElementById('blackboardMode')!;

console.log('screenTeachBtn:', screenTeachBtn);
console.log('blackboardBtn:', blackboardBtn);

screenTeachBtn.addEventListener('click', () => {
  console.log('screenTeachBtn clicked!');
  enterScreenTeachMode();
});

blackboardBtn.addEventListener('click', () => {
  console.log('blackboardBtn clicked!');
  enterBlackboardMode();
});

let screenTeachState: 'idle' | 'selecting_monitor' | 'capturing' | 'analyzing' = 'idle';
let selectedMonitorIndex = 0;

async function enterScreenTeachMode() {
  console.log('enterScreenTeachMode called, state:', screenTeachState);
  if (screenTeachState !== 'idle') return;

  // Transform Unfold into a see-through tinted overlay on the user's desktop!
  document.body.classList.add('screen-overlay-mode');
  document.querySelector('.app')?.classList.add('screen-overlay-mode');
  activeScreenOverlayMode = true;
  hideEmptyState();

  composerInput.placeholder = "Ask anything about what's on your screen… (Esc to exit)";
  composerInput.focus();

  // If user already typed something in composerInput, send it with screen context!
  const existingQuestion = composerInput.value.trim();
  if (existingQuestion) {
    await sendMessage();
  }
}

function exitScreenOverlayMode() {
  activeScreenOverlayMode = false;
  isDrawingOnScreen = false;
  document.body.classList.remove('screen-overlay-mode');
  document.body.classList.remove('drawing-active');
  document.querySelector('.app')?.classList.remove('screen-overlay-mode');
  composerInput.placeholder = 'Message Unfold…';
  updateOverlayDrawBtnUI();
  const conv = conversations.find(c => c.id === currentConversationId);
  if (!conv || conv.messages.length === 0) {
    showEmptyState();
  }
}

const overlayCloseTrigger = document.getElementById('overlayCloseTrigger');
overlayCloseTrigger?.addEventListener('click', exitScreenOverlayMode);

overlayRetakeBtn?.addEventListener('click', async () => {
  await captureAndAnalyzeScreen(selectedMonitorIndex, 'Analyze what is currently on my screen and answer any visible issues.');
});

overlayDrawBtn?.addEventListener('click', () => {
  isDrawingOnScreen = !isDrawingOnScreen;
  document.body.classList.toggle('drawing-active', isDrawingOnScreen);
  updateOverlayDrawBtnUI();
});

overlayClickThroughBtn?.addEventListener('click', async () => {
  const next = !clickThrough;
  clickThrough = await invoke<boolean>('set_click_through', { enabled: next });
  updateClickThroughUI();
});

overlayExitBtn?.addEventListener('click', exitScreenOverlayMode);

async function captureAndAnalyzeScreen(monitorIndex: number, userQuestion?: string) {
  if (screenTeachState === 'capturing' || screenTeachState === 'analyzing') return;
  screenTeachState = 'capturing';

  const capturingDiv = document.createElement('div');
  capturingDiv.className = 'capturing-overlay';
  capturingDiv.innerHTML = `
    <div class="capturing-content">
      <div class="spinner"></div>
      <p id="capturingStatusText">Scanning your screen context...</p>
    </div>
  `;
  document.body.appendChild(capturingDiv);

  try {
    const captureResult = await invoke<ScreenCaptureResponse>('capture_screen', {
      request: {
        region: { x: monitorIndex, y: 0, width: 0, height: 0 },
        include_cursor: false
      }
    });

    latestScreenContext = captureResult.image_base64;

    const statusText = capturingDiv.querySelector('#capturingStatusText');
    if (statusText) statusText.textContent = 'Analyzing screen with AI...';
    screenTeachState = 'analyzing';

    const settings = await invoke<{llm_provider: string, api_key: string | null, model: string}>('get_settings');
    if (!settings.api_key) {
      throw new Error('No API key configured. Please configure your API key in Settings.');
    }

    if (!currentConversationId) {
      currentConversationId = await createNewConversation(userQuestion ? `Screen: ${userQuestion.slice(0, 20)}...` : 'Screen Analysis');
    }

    const promptText = userQuestion || 'Teach me what is on my screen step by step.';
    const userMsg: Message = {
      role: 'user',
      content: `📸 **Screen Context Captured**\n\n"${promptText}"`,
      timestamp: Date.now(),
      image_base64: captureResult.image_base64
    };
    addMessageToConversation(currentConversationId, userMsg);
    appendMessage(userMsg);
    scrollToBottom();

    const visionPrompt = userQuestion
      ? `[User Screen Context Question]: ${userQuestion}\n\nContext: The user is looking at this screen. Analyze what is shown and provide a clear, direct, and comprehensive answer to their question.`
      : 'Teach me what is on this screen. Break down what you see clearly, explain the key elements step by step, and provide practical insights.';

    const visionResult = await invoke<VisionResponse>('capture_screen_with_vision', {
      request: {
        region: { x: monitorIndex, y: 0, width: 0, height: 0 },
        include_cursor: false
      },
      vision_request: {
        prompt: visionPrompt,
        image_base64: captureResult.image_base64,
        model: settings.model,
        provider: settings.llm_provider,
        api_key: settings.api_key,
        conversation_history: currentConversationId ? getConversationHistory() : undefined
      }
    });

    capturingDiv.remove();
    screenTeachState = 'idle';

    const assistantMsg: Message = {
      role: 'assistant',
      content: visionResult.content,
      timestamp: Date.now()
    };
    addMessageToConversation(currentConversationId, assistantMsg);
    appendMessage(assistantMsg);
    scrollToBottom();

    renderScreenFollowupChips();

    setTimeout(() => {
      offerBlackboardFollowup(visionResult.content);
    }, 600);

  } catch (error) {
    capturingDiv.remove();
    screenTeachState = 'idle';
    console.error('Screen teach failed:', error);

    const errorMsg: Message = {
      role: 'assistant',
      content: `❌ Screen analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: Date.now()
    };
    if (currentConversationId) {
      addMessageToConversation(currentConversationId, errorMsg);
      appendMessage(errorMsg);
      scrollToBottom();
    }
  }
}

function renderScreenFollowupChips() {
  const chipsDiv = document.createElement('div');
  chipsDiv.className = 'screen-prompt-chips';
  chipsDiv.innerHTML = `
    <button class="screen-chip" data-prompt="Explain this error or bug in detail">🐛 Explain Error</button>
    <button class="screen-chip" data-prompt="Step by step tutorial on what to do next with this">📋 What do I do next?</button>
    <button class="screen-chip" data-prompt="Summarize the key information on this screen">📝 Summarize Screen</button>
    <button class="screen-chip" data-prompt="Draw and visualize the architecture or flow of this">🎨 Visualize this</button>
  `;

  chipsDiv.querySelectorAll('.screen-chip').forEach(btn => {
    btn.addEventListener('click', async () => {
      const p = (btn as HTMLElement).dataset.prompt;
      if (p) {
        chipsDiv.remove();
        composerInput.value = p;
        await sendMessage();
      }
    });
  });

  messagesContainer.appendChild(chipsDiv);
  scrollToBottom();
}

function getConversationHistory(): ChatMessage[] {
  if (!currentConversationId) return [];
  const conv = conversations.find(c => c.id === currentConversationId);
  if (!conv) return [];
  return conv.messages
    .filter(m => !m.streaming)
    .map(m => ({ role: m.role, content: m.content }));
}

function offerBlackboardFollowup(explanation: string) {
  // Check if explanation mentions diagrams, equations, algorithms, etc.
  const vizKeywords = ['diagram', 'chart', 'graph', 'equation', 'formula', 'algorithm', 'flowchart', 'visualize', 'draw', 'plot', 'structure', 'architecture', 'neural network'];
  const shouldOffer = vizKeywords.some(kw => explanation.toLowerCase().includes(kw));
  
  if (shouldOffer) {
    const offerDiv = document.createElement('div');
    offerDiv.className = 'message assistant suggestion-offer';
    offerDiv.innerHTML = `
      <div class="message-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/></svg>
      </div>
      <div class="message-content">
        <div class="message-header"><span class="role">Unfold</span><span class="time">Just now</span></div>
        <div class="message-text">
          Would you like me to create a visual diagram on the blackboard to illustrate this concept?
        </div>
        <div class="suggestion-actions">
          <button class="btn-primary" id="openBlackboardBtn">Open Blackboard</button>
          <button class="btn-secondary" id="dismissOfferBtn">Not now</button>
        </div>
      </div>
    `;
    messagesContainer.appendChild(offerDiv);
    scrollToBottom();
    
    offerDiv.querySelector('#openBlackboardBtn')?.addEventListener('click', () => {
      offerDiv.remove();
      enterBlackboardMode();
    });
    
    offerDiv.querySelector('#dismissOfferBtn')?.addEventListener('click', () => {
      offerDiv.remove();
    });
  }
}

// Blackboard mode - dedicated visualization workspace
let blackboardMode = false;

function enterBlackboardMode() {
  console.log('enterBlackboardMode called, blackboardMode:', blackboardMode);
  if (blackboardMode) return;
  
  blackboardMode = true;
  
  hideEmptyState();
  _showVisualization('Blackboard');
  console.log('Visualization overlay shown');
  
  // Add blackboard-specific UI
  setupBlackboardUI();
  
  // Send initial prompt if new conversation
  if (!currentConversationId) {
    composerInput.value = 'Teach me on the blackboard - start with a blank canvas';
    autoResizeTextarea(composerInput);
    sendMessage();
  } else {
    composerInput.value = '';
    autoResizeTextarea(composerInput);
    composerInput.placeholder = 'Ask a follow-up question about the diagram...';
  }
}

function setupBlackboardUI() {
  // Add blackboard controls to viz overlay
  const controlsDiv = document.createElement('div');
  controlsDiv.id = 'blackboardControls';
  controlsDiv.className = 'blackboard-controls';
  controlsDiv.innerHTML = `
    <div class="blackboard-tools">
      <button class="tool-btn" data-tool="pen" title="Pen (P)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg></button>
      <button class="tool-btn" data-tool="highlighter" title="Highlighter (H)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18"/><path d="M17 3v18"/><path d="M22 3v18"/><path d="M7 3v18"/><path d="M2 3v18"/></svg></button>
      <button class="tool-btn" data-tool="arrow" title="Arrow (A)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
      <button class="tool-btn" data-tool="text" title="Text (T)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg></button>
      <button class="tool-btn" data-tool="eraser" title="Eraser (E)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20H7L2 15l9-9 9 9"/><path d="M15 7l5 5"/></svg></button>
    </div>
    <div class="blackboard-actions">
      <button class="btn-icon" id="clearBlackboard" title="Clear Canvas"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      <button class="btn-icon" id="undoBlackboard" title="Undo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg></button>
      <button class="btn-icon" id="redoBlackboard" title="Redo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg></button>
      <button class="btn-icon" id="zoomFitBlackboard" title="Zoom to Fit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
    </div>
    <div class="blackboard-status">
      <span>Blackboard Mode</span>
      <button class="btn-text" id="exitBlackboard">Exit Blackboard</button>
    </div>
  `;
  
  vizOverlay.querySelector('.viz-header')?.appendChild(controlsDiv);
  
  // Bind tool buttons
  controlsDiv.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      controlsDiv.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = (btn as HTMLElement).dataset.tool as Tool;
    });
  });
  
  // Set initial active tool
  controlsDiv.querySelector('[data-tool="pen"]')?.classList.add('active');
  
  // Bind action buttons
  controlsDiv.querySelector('#clearBlackboard')?.addEventListener('click', clearBlackboard);
  controlsDiv.querySelector('#undoBlackboard')?.addEventListener('click', undoBlackboard);
  controlsDiv.querySelector('#redoBlackboard')?.addEventListener('click', redoBlackboard);
  controlsDiv.querySelector('#zoomFitBlackboard')?.addEventListener('click', zoomFitBlackboard);
  controlsDiv.querySelector('#exitBlackboard')?.addEventListener('click', exitBlackboardMode);
}

function clearBlackboard() {
  _strokes = [];
  redraw();
}

function undoBlackboard() {
  if (_strokes.length > 0) {
    _strokes.pop();
    redraw();
  }
}

function redoBlackboard() {
  // Would need a redo stack - simplified for now
}

function zoomFitBlackboard() {
  // Reset zoom/pan - would need viewport state
  setupVizCanvas();
  redraw();
}

function exitBlackboardMode() {
  blackboardMode = false;
  
  // Remove blackboard controls
  const controls = document.getElementById('blackboardControls');
  controls?.remove();
  
  // Hide visualization overlay
  vizOverlay.classList.remove('visible');
  
  // Restore normal composer
  composerInput.placeholder = 'Ask a question...';
  composerInput.focus();
}

async function sendBlackboardMessage() {
  const text = composerInput.value.trim();
  if (!text || isStreaming) return;
  
  composerInput.value = '';
  autoResizeTextarea(composerInput);
  
  if (!currentConversationId) {
    currentConversationId = await createNewConversation(text);
  }
  
  const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
  addMessageToConversation(currentConversationId, userMsg);
  appendMessage(userMsg);
  scrollToBottom();
  
  await sendToAIWithBlackboardContext(text);
}

async function sendToAIWithBlackboardContext(prompt: string) {
  isStreaming = true;
  currentStreamController = new AbortController();
  sendBtn.disabled = true;
  composerInput.disabled = true;
  composerWrapper.classList.add('streaming');

  const assistantMsg: Message = { role: 'assistant', content: '', timestamp: Date.now(), streaming: true };
  addMessageToConversation(currentConversationId!, assistantMsg);
  appendStreamingPlaceholder();

  try {
    // Get conversation history including any visualization context
    const history = getConversationHistory();
    const historyText = history.length > 0 
      ? '\n\nPrevious messages:\n' + history.map(m => `${m.role}: ${m.content}`).join('\n')
      : '';
    
    // Build enhanced prompt with blackboard context
    const enhancedPrompt = `[Blackboard Mode] ${prompt}${historyText}\n\nContext: The user is interacting with a visual blackboard. They may ask for diagrams, equations, flowcharts, or modifications to existing drawings. If you need to create a visualization, use the <<<VISUALIZATION:type:params>>> format.`;
    
    const response = await invoke<string>('send_message', {
      prompt: enhancedPrompt,
      conversation_id: currentConversationId,
      image_base64: (activeScreenOverlayMode && latestScreenContext) ? latestScreenContext : undefined,
      request: {
        prompt: enhancedPrompt,
        conversation_id: currentConversationId,
        image_base64: (activeScreenOverlayMode && latestScreenContext) ? latestScreenContext : undefined
      }
    });

    let fullResponse = response;
    let displayed = '';
    const chunks = fullResponse.split(' ');

    for (let i = 0; i < chunks.length; i++) {
      if (currentStreamController?.signal.aborted) break;
      displayed += (i > 0 ? ' ' : '') + chunks[i];
      updateStreamingMessage(displayed + ' ');
      await new Promise(r => setTimeout(r, 30));
    }

    // Check for visualization markers in response
    checkForVisualization(fullResponse);
    
    finalizeMessage(fullResponse);
  } catch (error) {
    console.error('AI request failed:', error);
    finalizeMessage('Sorry, I encountered an error. Please try again.');
  } finally {
    isStreaming = false;
    currentStreamController = null;
    sendBtn.disabled = false;
    composerInput.disabled = false;
    composerWrapper.classList.remove('streaming');
    composerInput.focus();
  }
}

function checkForVisualization(content: string) {
  // Look for <<<VISUALIZATION:type:params>>> markers
  const vizRegex = /<<<VISUALIZATION:(\w+):(\{[\s\S]*?\})>>>/g;
  let match;
  
  while ((match = vizRegex.exec(content)) !== null) {
    const type = match[1];
    let params: any;
    try {
      params = JSON.parse(match[2]);
    } catch {
      continue;
    }
    
    renderVisualization(type, params);
  }
}

function renderVisualization(type: string, params: any) {
  // This would render the visualization on the blackboard canvas
  // For now, just log and show a notification
  console.log('Rendering visualization:', type, params);
  
  const vizDiv = document.createElement('div');
  vizDiv.className = 'message assistant visualization-result';
  vizDiv.innerHTML = `
    <div class="message-avatar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/></svg>
    </div>
    <div class="message-content">
      <div class="message-header"><span class="role">Unfold</span><span class="time">Just now</span></div>
      <div class="message-text">
        Created ${type} visualization on blackboard.
      </div>
    </div>
  `;
  messagesContainer.appendChild(vizDiv);
  scrollToBottom();
  
  // Actually draw on the blackboard canvas
  drawVisualizationOnCanvas(type, params);
}

function drawVisualizationOnCanvas(type: string, params: any) {
  // This would use the Skia/Canvas2D renderer to draw the visualization
  // Implementation depends on the visualization schema
  // For now, clear and draw a simple placeholder
  _strokes = [];
  
  if (type === 'algorithm' || type === 'flowchart') {
    drawFlowchart(params);
  } else if (type === 'chart') {
    drawChart(params);
  } else if (type === 'equation') {
    drawEquation(params);
  } else if (type === 'diagram') {
    drawDiagram(params);
  }
  
  redraw();
}

function drawFlowchart(_params: any) {
  // Placeholder - would use layout engine to draw flowchart
  const nodes = _params.nodes || [];
  const edges = _params.edges || [];
  
  // Simple layout - just draw boxes and arrows
  nodes.forEach((_node: any, i: number) => {
    const x = 100 + (i % 3) * 250;
    const y = 100 + Math.floor(i / 3) * 150;
    
    // Draw box
    _strokes.push({
      points: [
        { x, y }, { x: x + 200, y },
        { x: x + 200, y: y + 80 }, { x, y: y + 80 },
        { x, y }
      ],
      tool: 'pen',
      color: '#00d4aa',
      width: 2
    });
    
    // Text would be drawn with text tool
  });
  
  edges.forEach((_edge: any) => {
    // Draw arrow between nodes
  });
}

function drawChart(_params: any) {
  // Placeholder for chart drawing
}

function drawEquation(_params: any) {
  // Placeholder for equation rendering
}

function drawDiagram(_params: any) {
  // Placeholder for diagram drawing
}

// (Interfaces defined above at top of file — duplicates removed)

settingsBtn.addEventListener('click', () => {
  showSettingsModal();
});

searchBtn.addEventListener('click', () => {
  console.log('Search clicked');
});

function showSettingsModal() {
  const existing = document.querySelector('.settings-modal');
  if (existing) return;

  const renderModal = (currentSettings: Settings) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal settings-modal">
        <div class="modal-header">
          <h3>Settings</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="setting-group">
            <label>AI Provider</label>
            <select id="providerSelect" class="setting-input">
              <option value="gemini" ${currentSettings.llm_provider === 'gemini' ? 'selected' : ''}>Google Gemini</option>
              <option value="openrouter" ${currentSettings.llm_provider === 'openrouter' ? 'selected' : ''}>OpenRouter</option>
              <option value="openai" ${currentSettings.llm_provider === 'openai' ? 'selected' : ''}>OpenAI</option>
              <option value="ollama" ${currentSettings.llm_provider === 'ollama' ? 'selected' : ''}>Ollama (Local)</option>
            </select>
          </div>
          <div class="setting-group">
            <label>Model</label>
            <input type="text" id="modelInput" class="setting-input" value="${escapeHtml(currentSettings.model || 'gemini-1.5-flash')}" placeholder="e.g. gemini-1.5-flash">
          </div>
          <div class="setting-group">
            <label>API Key</label>
            <div class="api-key-input-wrapper">
              <input type="password" id="apiKeyInput" class="setting-input" value="${escapeHtml(currentSettings.api_key || '')}" placeholder="Enter your API key">
              <button class="btn-icon toggle-visibility" id="toggleApiKey" title="Show/Hide">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
            <p class="setting-hint">Get a free key at <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a></p>
          </div>
          <div class="setting-group">
            <label>
              <input type="checkbox" id="screenCapturePermission" ${currentSettings.screen_capture_permission ? 'checked' : ''}>
              Allow screen capture
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="cancelSettingsBtn">Cancel</button>
          <button class="btn-primary" id="saveSettingsBtn">Save Settings</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Toggle API key visibility
    const apiKeyInput = modal.querySelector('#apiKeyInput') as HTMLInputElement;
    const toggleBtn = modal.querySelector('#toggleApiKey') as HTMLButtonElement;
    toggleBtn?.addEventListener('click', () => {
      apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
    });
    
    // Provider change updates model placeholder
    const providerSelect = modal.querySelector('#providerSelect') as HTMLSelectElement;
    const modelInput = modal.querySelector('#modelInput') as HTMLInputElement;
    providerSelect?.addEventListener('change', () => {
      const defaults: Record<string, string> = {
        'gemini': 'gemini-1.5-flash',
        'openrouter': 'google/gemini-flash-1.5',
        'openai': 'gpt-4o-mini',
        'ollama': 'llava:13b'
      };
      modelInput.value = defaults[providerSelect.value] || '';
    });
    
    const cleanup = () => modal.remove();
    
    modal.querySelector('#saveSettingsBtn')?.addEventListener('click', async () => {
      const newSettings: Settings = {
        llm_provider: providerSelect.value,
        model: modelInput.value,
        api_key: apiKeyInput.value || null,
        theme: currentSettings.theme,
        screen_capture_permission: (modal.querySelector('#screenCapturePermission') as HTMLInputElement).checked
      };
      
      saveLocalSettings(newSettings);
      try {
        await invoke('update_settings', { settings: newSettings });
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
      cleanup();
    });
    
    modal.querySelector('#cancelSettingsBtn')?.addEventListener('click', cleanup);
    modal.querySelector('.modal-close')?.addEventListener('click', cleanup);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cleanup();
    });
  };

  // Get current settings first with fallback
  invoke<Settings>('get_settings')
    .then(currentSettings => renderModal(currentSettings || (getLocalSettings() ?? DEFAULT_SETTINGS)))
    .catch(() => {
      renderModal((getLocalSettings() ?? DEFAULT_SETTINGS) as Settings);
    });
}

interface Settings {
  llm_provider: string;
  model: string;
  api_key: string | null;
  theme: string;
  screen_capture_permission: boolean;
}

async function loadSettings() {
  try {
    const settings = await invoke<{theme: string}>('get_settings');
    if (settings.theme === 'dark') {
      tintOpacity = 0.25;
      tint?.classList.add('bg-tint');
    }
  } catch {}
}

async function saveConversations() {
  try {
    localStorage.setItem('unfold_conversations', JSON.stringify(conversations));
  } catch {}
}

function loadConversations() {
  try {
    const stored = localStorage.getItem('unfold_conversations');
    if (stored) {
      conversations = JSON.parse(stored);
      renderConversationList();
    }
  } catch {}
}

// @ts-ignore
function _showVisualization(title: string) {
  vizTitle.textContent = title;
  vizOverlay.classList.add('visible');
  setupVizCanvas();
}

vizClose.addEventListener('click', () => {
  vizOverlay.classList.remove('visible');
});

vizFullscreen.addEventListener('click', () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    vizOverlay.requestFullscreen();
  }
});

async function toggleClickThrough() {
  clickThrough = !clickThrough;
  await invoke('toggle_click_through');
  ctIndicator.classList.toggle('visible', clickThrough);
  updateClickThroughUI();
  if (clickThrough) {
    canvas.classList.add('pointer-none');
    vizCanvas.classList.add('pointer-none');
    (document.querySelector('.composer') as HTMLElement).classList.add('pointer-auto');
    sidebar.classList.add('pointer-auto');
  } else {
    canvas.classList.remove('pointer-none');
    vizCanvas.classList.remove('pointer-none');
    (document.querySelector('.composer') as HTMLElement).classList.remove('pointer-auto');
    sidebar.classList.remove('pointer-auto');
  }
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'u') {
    e.preventDefault();
    invoke('toggle_overlay').catch(console.error);
    return;
  }

  if (e.key === 'Escape') {
    if (activeScreenOverlayMode) {
      exitScreenOverlayMode();
      return;
    }
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
      modal.remove();
      return;
    }
    if (vizOverlay.classList.contains('visible')) {
      vizOverlay.classList.remove('visible');
      return;
    }
  }

  if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    startNewChat();
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    if (!isStreaming && composerInput.value.trim()) {
      sendMessage();
    }
  }

  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 's') {
    e.preventDefault();
    enterScreenTeachMode();
  }

  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'b') {
    e.preventDefault();
    enterBlackboardMode();
  }
});

async function main() {
  await initRenderer();
  await loadSettings();
  
  // Force click-through OFF on startup (explicitly false, never toggle!)
  clickThrough = false;
  await invoke('set_click_through', { enabled: false }).catch(() => {});
  ctIndicator.classList.remove('visible');
  canvas.classList.remove('pointer-none');
  canvas.classList.add('pointer-auto');
  vizCanvas.classList.remove('pointer-none');
  vizCanvas.classList.add('pointer-auto');
  updateClickThroughUI();
  
  if (isTauri()) {
    listen('overlay:show-command-palette-bottom', () => {
      composerInput?.focus();
    }).catch(console.error);

    listen('overlay:show-command-palette', () => {
      composerInput?.focus();
    }).catch(console.error);

    listen<boolean>('overlay:click-through-changed', (event) => {
      clickThrough = event.payload;
      ctIndicator.classList.toggle('visible', clickThrough);
      updateClickThroughUI();
      if (clickThrough) {
        canvas.classList.add('pointer-none');
        vizCanvas.classList.add('pointer-none');
      } else {
        canvas.classList.remove('pointer-none');
        vizCanvas.classList.remove('pointer-none');
      }
    }).catch(console.error);
  }
  
  loadConversations();

  function animate() { redraw(); requestAnimationFrame(animate); }
  requestAnimationFrame(animate);

  console.log('Unfold overlay ready (Skia: ' + (useSkia ? 'enabled' : 'fallback Canvas 2D') + ')');
}

main();