import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadConversations,
  saveConversations,
  createNewConversation,
  addMessageToConversation,
  deleteConversation,
  getActiveConversationId,
  setActiveConversationId,
  exportConversationsJSON,
  importConversationsJSON,
} from '../src/services/storage';

describe('Storage Service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadConversations should return empty array when storage is empty', () => {
    expect(loadConversations()).toEqual([]);
  });

  it('createNewConversation should add a new conversation and set it as active', () => {
    const conv = createNewConversation('Test Chat');
    expect(conv.title).toBe('Test Chat');
    expect(conv.messages).toEqual([]);
    expect(getActiveConversationId()).toBe(conv.id);

    const list = loadConversations();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(conv.id);
  });

  it('addMessageToConversation should append a message to the specified conversation', () => {
    const conv = createNewConversation('Chat with Messages');
    const msg = {
      role: 'user' as const,
      content: 'Hello, Unfold!',
      timestamp: Date.now(),
    };

    const updated = addMessageToConversation(conv.id, msg);
    expect(updated[0].messages.length).toBe(1);
    expect(updated[0].messages[0].content).toBe('Hello, Unfold!');

    const reloaded = loadConversations();
    expect(reloaded[0].messages[0].content).toBe('Hello, Unfold!');
  });

  it('deleteConversation should remove conversation from list', () => {
    const conv1 = createNewConversation('Chat 1');
    const conv2 = createNewConversation('Chat 2');

    expect(loadConversations().length).toBe(2);

    const remaining = deleteConversation(conv1.id);
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(conv2.id);
  });

  it('setActiveConversationId and getActiveConversationId work as expected', () => {
    setActiveConversationId('conv_123');
    expect(getActiveConversationId()).toBe('conv_123');

    setActiveConversationId(null);
    expect(getActiveConversationId()).toBeNull();
  });

  it('addMessageToConversation auto-titles new conversations based on first user message', () => {
    const conv = createNewConversation('New chat');
    addMessageToConversation(conv.id, {
      role: 'user',
      content: 'Explain quantum computing basics in detail',
      timestamp: Date.now(),
    });

    const list = loadConversations();
    expect(list[0].title).toBe('Explain quantum computing basics in ');
  });

  it('exportConversationsJSON and importConversationsJSON successfully backup and restore chats', () => {
    createNewConversation('Backup Test Chat');
    const json = exportConversationsJSON();
    expect(json).toContain('Backup Test Chat');

    localStorage.clear();
    const success = importConversationsJSON(json);
    expect(success).toBe(true);

    const reloaded = loadConversations();
    expect(reloaded.some((c) => c.title === 'Backup Test Chat')).toBe(true);
  });
});
