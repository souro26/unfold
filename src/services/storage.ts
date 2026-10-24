import { Conversation, Message } from '../types';
import { generateId } from '../utils/helpers';

const STORAGE_KEY = 'unfold_conversations';
const CURRENT_CONV_KEY = 'unfold_current_conv_id';

let memoryCache: Conversation[] | null = null;

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      memoryCache = [];
      return [];
    }
    const list = JSON.parse(raw);
    memoryCache = list;
    return list;
  } catch (err) {
    console.error('Failed to load conversations from storage, using memory cache:', err);
    return memoryCache || [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  memoryCache = conversations;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (err) {
    console.error('Failed to save conversations to storage:', err);
  }
}

export function getActiveConversationId(): string | null {
  try {
    return localStorage.getItem(CURRENT_CONV_KEY);
  } catch {
    return null;
  }
}

export function setActiveConversationId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(CURRENT_CONV_KEY, id);
    } else {
      localStorage.removeItem(CURRENT_CONV_KEY);
    }
  } catch (err) {
    console.error('Failed to set active conversation in local storage:', err);
  }
}

export function createNewConversation(title: string = 'New Conversation'): Conversation {
  const conv: Conversation = {
    id: generateId('conv'),
    title,
    messages: [],
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  const list = loadConversations();
  list.unshift(conv);
  saveConversations(list);
  setActiveConversationId(conv.id);
  return conv;
}

export function addMessageToConversation(convId: string, message: Message): Conversation[] {
  const list = loadConversations();
  const conv = list.find((c) => c.id === convId);
  if (conv) {
    // Auto-update conversation title from initial user message if title is default
    if ((conv.title === 'New Conversation' || conv.title === 'New chat') && message.role === 'user') {
      const cleanSnippet = message.content.trim().slice(0, 36);
      if (cleanSnippet) {
        conv.title = cleanSnippet;
      }
    }
    conv.messages.push(message);
    conv.updated_at = Date.now();
    saveConversations(list);
  }
  return list;
}

export function deleteConversation(convId: string): Conversation[] {
  let list = loadConversations();
  list = list.filter((c) => c.id !== convId);
  saveConversations(list);
  if (getActiveConversationId() === convId) {
    setActiveConversationId(list.length > 0 ? list[0].id : null);
  }
  return list;
}

export function exportConversationsJSON(): string {
  return JSON.stringify(loadConversations(), null, 2);
}

export function importConversationsJSON(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed)) {
      saveConversations(parsed);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

