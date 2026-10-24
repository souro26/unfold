import { Conversation } from '../types';
import { escapeHtml } from '../utils/helpers';

export interface SidebarCallbacks {
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onToggleClickThrough: () => void;
  onDeleteConversation?: (id: string) => void;
}

export class SidebarComponent {
  private sidebarEl: HTMLElement;
  private listEl: HTMLElement;
  private toggleBtn: HTMLButtonElement;
  private newChatBtn: HTMLButtonElement;
  private settingsBtn: HTMLButtonElement;
  private clickThroughBtn: HTMLButtonElement;
  private ctStatusSpan: HTMLElement;
  private collapsed: boolean = false;
  private callbacks: SidebarCallbacks;

  constructor(callbacks: SidebarCallbacks) {
    this.callbacks = callbacks;
    this.sidebarEl = document.getElementById('sidebar') as HTMLElement;
    this.listEl = document.getElementById('conversationList') as HTMLElement;
    this.toggleBtn = document.getElementById('sidebarToggle') as HTMLButtonElement;
    this.newChatBtn = document.getElementById('newChatBtn') as HTMLButtonElement;
    this.settingsBtn = document.getElementById('settingsBtn') as HTMLButtonElement;
    this.clickThroughBtn = document.getElementById('clickThroughToggle') as HTMLButtonElement;
    this.ctStatusSpan = document.getElementById('ctStatus') as HTMLElement;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.toggleBtn?.addEventListener('click', () => this.toggleCollapse());
    this.newChatBtn?.addEventListener('click', () => this.callbacks.onNewChat());
    this.settingsBtn?.addEventListener('click', () => this.callbacks.onOpenSettings());
    this.clickThroughBtn?.addEventListener('click', () => this.callbacks.onToggleClickThrough());
  }

  public renderConversations(conversations: Conversation[], activeId: string | null): void {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';

    conversations.forEach((conv) => {
      const item = document.createElement('div');
      item.className = `conversation-item ${conv.id === activeId ? 'active' : ''}`;
      item.dataset.id = conv.id;
      item.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span class="title-text">${escapeHtml(conv.title || 'Conversation')}</span>
        <button class="delete-conv-btn" aria-label="Delete conversation" title="Delete conversation">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      `;

      item.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.delete-conv-btn')) return;
        this.callbacks.onSelectConversation(conv.id);
      });

      const delBtn = item.querySelector('.delete-conv-btn');
      delBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.callbacks.onDeleteConversation) {
          this.callbacks.onDeleteConversation(conv.id);
        }
      });

      this.listEl.appendChild(item);
    });
  }

  public toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    this.sidebarEl.classList.toggle('collapsed', this.collapsed);
  }

  public updateClickThrough(active: boolean): void {
    if (!this.clickThroughBtn || !this.ctStatusSpan) return;
    this.clickThroughBtn.classList.toggle('active', active);
    this.ctStatusSpan.textContent = active ? 'ON' : 'OFF';
  }
}
