// src/main.ts - Chat-based teaching overlay with visualization support
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { initSkia, type Stroke, type Point, type Tool } from './renderer-skia';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  streaming?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
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
const suggestionsContainer = document.getElementById('suggestions')!;
const composerInput = document.getElementById('composerInput') as HTMLTextAreaElement;
const composerWrapper = document.getElementById('composerWrapper')!;
const sendBtn = document.getElementById('sendBtn')!;
const attachBtn = document.getElementById('attachBtn')!;
const vizOverlay = document.getElementById('vizOverlay')!;
const vizTitle = document.getElementById('vizTitle')!;
const vizClose = document.getElementById('vizClose')!;
const vizFullscreen = document.getElementById('vizFullscreen')!;
const vizCanvas = document.getElementById('vizCanvas') as HTMLCanvasElement;
const ctIndicator = document.getElementById('ctIndicator')!;
const tint = document.getElementById('tint')!;

let clickThrough = false;
let tintOpacity = 0;
let skia: any = null;
let useSkia = false;
let currentTool: Tool = 'pen';
let isDrawing = false;
let currentStroke: Point[] = [];
let strokes: Stroke[] = [];

const toolSettings: Record<Tool, { color: string; width: number }> = {
  pen: { color: '#00f0ff', width: 3 },
  highlighter: { color: '#ffb800', width: 30 },
  eraser: { color: '#000000', width: 30 },
  arrow: { color: '#00d4aa', width: 3 },
  text: { color: '#ffffff', width: 16 },
};

// Initialize
async function initRenderer() {
  try {
    skia = await initSkia();
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
}

// Sidebar toggle
sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  sidebarOverlay.classList.toggle('visible', window.innerWidth <= 1000 && !sidebar.classList.contains('collapsed'));
});

sidebarOverlay.addEventListener('click', () => {
  sidebar.classList.add('collapsed');
  sidebarOverlay.classList.remove('visible');
});

// New chat
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

// Empty state
function showEmptyState() {
  emptyState.style.display = 'flex';
  messagesContainer.style.display = 'none';
  emptyState.scrollIntoView({ behavior: 'smooth' });
}

function showConversation(conv: Conversation) {
  emptyState.style.display = 'none';
  messagesContainer.style.display = 'flex';
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

// Composer
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
  const text = composerInput.value.trim();
  if (!text || isStreaming) return;
  
  composerInput.value = '';
  autoResizeTextarea(composerInput);
  hideEmptyState();
  
  if (!currentConversationId) {
    currentConversationId = await createNewConversation(text);
  }
  
  const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
  addMessageToConversation(currentConversationId, userMsg);
  appendMessage(userMsg);
  scrollToBottom();
  
  await sendToAI(text);
}

function addMessageToConversation(convId: string, msg: Message) {
  const conv = conversations.find(c => c.id === convId);
  if (conv) {
    conv.messages.push(msg);
    saveConversations();
  }
}

function hideEmptyState() {
  emptyState.style.display = 'none';
  messagesContainer.style.display = 'flex';
}

async function sendToAI(prompt: string) {
  isStreaming = true;
  currentStreamController = new AbortController();
  sendBtn.disabled = true;
  composerInput.disabled = true;
  composerWrapper.classList.add('streaming');
  
  // Add streaming placeholder
  const assistantMsg: Message = { role: 'assistant', content: '', timestamp: Date.now(), streaming: true };
  addMessageToConversation(currentConversationId!, assistantMsg);
  const msgDiv = appendStreamingPlaceholder();
  
  try {
    const response = await invoke<string>('send_message', { 
      prompt, 
      conversation_id: currentConversationId 
    });
    
    // Simulate streaming for now - in reality would use SSE
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
    
    // Update conversation
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

function scrollToBottom() {
  const convArea = document.getElementById('conversationArea')!;
  convArea.scrollTop = convArea.scrollHeight;
}

// Suggestion cards
suggestionsContainer.addEventListener('click', (e) => {
  const card = (e.target as HTMLElement).closest('.suggestion-card');
  if (card) {
    const prompt = card.dataset.prompt!;
    composerInput.value = prompt;
    autoResizeTextarea(composerInput);
    hideEmptyState();
    sendMessage();
  }
});

// Settings
settingsBtn.addEventListener('click', () => {
  // TODO: Open settings
  console.log('Settings clicked');
});

// Search
searchBtn.addEventListener('click', () => {
  // TODO: Search conversations
  console.log('Search clicked');
});

// Settings load
async function loadSettings() {
  try {
    const settings = await invoke<{theme: string}>('get_settings');
    if (settings.theme === 'dark') tintOpacity = 0.25;
    tint.style.backgroundColor = 'rgba(0,0,0,' + tintOpacity + ')';
  } catch {}
}

// Persistence
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

// Visualization
function showVisualization(title: string) {
  vizTitle.textContent = title;
  vizOverlay.classList.add('visible');
  setupVizCanvas();
  // TODO: Render visualization using Skia
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

// Click-through
async function toggleClickThrough() {
  clickThrough = !clickThrough;
  await invoke('toggle_click_through');
  ctIndicator.classList.toggle('visible', clickThrough);
  if (clickThrough) {
    canvas.style.pointerEvents = 'none';
    vizCanvas.style.pointerEvents = 'none';
    (document.querySelector('.composer') as HTMLElement).style.pointerEvents = 'auto';
    sidebar.style.pointerEvents = 'auto';
  } else {
    canvas.style.pointerEvents = 'auto';
    vizCanvas.style.pointerEvents = 'auto';
  }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
    if (e.key === 'Escape') {
      (e.target as HTMLElement).blur();
    }
    return;
  }
  
  if (e.key === 'Escape') {
    toggleClickThrough();
    if (vizOverlay.classList.contains('visible')) {
      vizOverlay.classList.remove('visible');
    }
  }
  
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    startNewChat();
  }
  
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    // TODO: Search
  }
  
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    if (!isStreaming && composerInput.value.trim()) {
      sendMessage();
    }
  }
});

// Initialize
async function main() {
  await initRenderer();
  await loadSettings();
  loadConversations();
  
  function animate() { redraw(); requestAnimationFrame(animate); }
  requestAnimationFrame(animate);
  
  console.log('Unfold overlay ready (Skia: ' + (useSkia ? 'enabled' : 'fallback Canvas 2D') + ')');
}

main();

// Types
type Tool = 'pen' | 'highlighter' | 'eraser' | 'arrow' | 'text';
type Point = { x: number; y: number; pressure?: number; time?: number };
type Stroke = { points: Point[]; tool: Tool; color: string; width: number };
