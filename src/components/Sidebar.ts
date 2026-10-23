import { Conversation } from '../types';
import { escapeHtml } from '../utils/helpers';

export interface SidebarCallbacks {
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onToggleClickThrough: () => void;
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
      const btn = document.createElement('button');
      btn.className = `conversation-item ${conv.id === activeId ? 'active' : ''}`;
      btn.dataset.id = conv.id;
      btn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span class="title-text">${escapeHtml(conv.title || 'Conversation')}</span>
      `;

      btn.addEventListener('click', () => {
        this.callbacks.onSelectConversation(conv.id);
      });

      this.listEl.appendChild(btn);
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
