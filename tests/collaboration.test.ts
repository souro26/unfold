import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CollaborationService } from '../src/services/collaboration';
import { BlackboardStep, DrawingElement } from '../src/types';

describe('Collaboration Service (Multi-Peer Shared Overlay)', () => {
  let collab: CollaborationService;

  beforeEach(() => {
    collab = CollaborationService.getInstance();
    collab.disconnect();
  });

  afterEach(() => {
    collab.disconnect();
  });

  it('connects to a collaboration room and exposes peer info', () => {
    expect(collab.isConnected()).toBe(false);

    collab.connect({
      roomId: 'room-algebra-101',
      userName: 'Professor Ada',
      userColor: '#00d4aa',
    });

    expect(collab.isConnected()).toBe(true);
    const myInfo = collab.getMyPeerInfo();
    expect(myInfo.name).toBe('Professor Ada');
    expect(myInfo.color).toBe('#00d4aa');
  });

  it('disconnects and clears peers cleanly', () => {
    collab.connect({
      roomId: 'room-raft-consensus',
      userName: 'Alice',
    });
    expect(collab.isConnected()).toBe(true);

    collab.disconnect();
    expect(collab.isConnected()).toBe(false);
    expect(collab.getPeers().length).toBe(0);
  });

  it('handles remote peer join, cursor updates, stroke events, and step syncing', () => {
    collab.connect({
      roomId: 'room-physics',
      userName: 'Bob',
    });

    const peersListener = vi.fn();
    const cursorListener = vi.fn();
    const strokeListener = vi.fn();
    const stepsListener = vi.fn();

    collab.onPeersChange(peersListener);
    collab.onRemoteCursor(cursorListener);
    collab.onRemoteStroke(strokeListener);
    collab.onRemoteSteps(stepsListener);

    // Simulate incoming peer_join message from another client
    (collab as any).handleMessage({
      type: 'peer_join',
      senderId: 'peer_carol_99',
      senderName: 'Carol',
      senderColor: '#ff3366',
      timestamp: Date.now(),
    });

    expect(collab.getPeers().length).toBe(1);
    expect(collab.getPeers()[0].name).toBe('Carol');
    expect(peersListener).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'Carol' })])
    );

    // Simulate incoming cursor move
    (collab as any).handleMessage({
      type: 'cursor_move',
      senderId: 'peer_carol_99',
      senderName: 'Carol',
      senderColor: '#ff3366',
      timestamp: Date.now(),
      payload: {
        cursor: { x: 350, y: 420, stepIndex: 1 },
      },
    });

    expect(cursorListener).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'peer_carol_99',
        cursor: { x: 350, y: 420, stepIndex: 1 },
      })
    );

    // Simulate incoming stroke
    const mockStroke: DrawingElement = {
      id: 'stroke-remote-1',
      type: 'rect',
      color: '#ff3366',
      strokeWidth: 3,
      start: { x: 100, y: 150 },
      width: 80,
      height: 50,
    };

    (collab as any).handleMessage({
      type: 'stroke_draw',
      senderId: 'peer_carol_99',
      senderName: 'Carol',
      senderColor: '#ff3366',
      timestamp: Date.now(),
      payload: { stroke: mockStroke },
    });

    expect(strokeListener).toHaveBeenCalledWith(mockStroke);

    // Simulate step synchronization
    const mockSteps: BlackboardStep[] = [
      { step: 1, title: 'Collaborative Intro', explanation: 'Shared whiteboard' },
    ];

    (collab as any).handleMessage({
      type: 'sync_steps',
      senderId: 'peer_carol_99',
      senderName: 'Carol',
      senderColor: '#ff3366',
      timestamp: Date.now(),
      payload: { steps: mockSteps },
    });

    expect(stepsListener).toHaveBeenCalledWith(mockSteps);

    // Simulate peer leave
    (collab as any).handleMessage({
      type: 'peer_leave',
      senderId: 'peer_carol_99',
      senderName: 'Carol',
      senderColor: '#ff3366',
      timestamp: Date.now(),
    });

    expect(collab.getPeers().length).toBe(0);
  });
});
