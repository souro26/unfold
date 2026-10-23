import { Conversation, Message } from '../types';
import { generateId } from '../utils/helpers';

const STORAGE_KEY = 'unfold_conversations';
const CURRENT_CONV_KEY = 'unfold_current_conv_id';

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load conversations from storage:', err);
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (err) {
    console.error('Failed to save conversations to storage:', err);
  }
}

export function getActiveConversationId(): string | null {
  return localStorage.getItem(CURRENT_CONV_KEY);
}

export function setActiveConversationId(id: string | null): void {
  if (id) {
    localStorage.setItem(CURRENT_CONV_KEY, id);
  } else {
    localStorage.removeItem(CURRENT_CONV_KEY);
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
