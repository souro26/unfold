import { BlackboardStep, DrawingElement, CollabConfig, CollabMessage, PeerInfo } from '../types';

export class CollaborationService {
  private static instance: CollaborationService;
  private channel: BroadcastChannel | null = null;
  private myId: string;
  private myName: string = 'Learner';
  private myColor: string = '#00d4aa';
  private roomId: string | null = null;
  private peers: Map<string, PeerInfo> = new Map();
  private connected: boolean = false;

  // Listeners
  private peersListeners: Set<(peers: PeerInfo[]) => void> = new Set();
  private cursorListeners: Set<(peer: PeerInfo) => void> = new Set();
  private strokeListeners: Set<(stroke: DrawingElement) => void> = new Set();
  private stepsListeners: Set<(steps: BlackboardStep[]) => void> = new Set();

  private constructor() {
    this.myId = 'peer_' + Math.random().toString(36).substring(2, 9);
    const colors = ['#00d4aa', '#00f0ff', '#ff3366', '#ffdd00', '#a855f7', '#3b82f6'];
    this.myColor = colors[Math.floor(Math.random() * colors.length)];
  }

  public static getInstance(): CollaborationService {
    if (!CollaborationService.instance) {
      CollaborationService.instance = new CollaborationService();
    }
    return CollaborationService.instance;
  }

  public connect(config: CollabConfig): void {
    if (this.connected && this.roomId === config.roomId) return;
    this.disconnect();

    this.roomId = config.roomId;
    this.myName = config.userName || 'Learner';
    if (config.userColor) this.myColor = config.userColor;

    const channelName = `unfold_collab_${config.roomId}`;
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(channelName);
      this.channel.onmessage = (event: MessageEvent<CollabMessage>) => {
        this.handleMessage(event.data);
      };
    }

    this.connected = true;

    // Announce presence
    this.broadcastMessage({
      type: 'peer_join',
      senderId: this.myId,
      senderName: this.myName,
      senderColor: this.myColor,
      timestamp: Date.now(),
    });
  }

  public disconnect(): void {
    if (!this.connected) return;

    if (this.channel) {
      this.broadcastMessage({
        type: 'peer_leave',
        senderId: this.myId,
        senderName: this.myName,
        senderColor: this.myColor,
        timestamp: Date.now(),
      });
      this.channel.close();
      this.channel = null;
    }

    this.peers.clear();
    this.connected = false;
    this.roomId = null;
    this.notifyPeersChange();
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getMyPeerInfo(): PeerInfo {
    return {
      id: this.myId,
      name: this.myName,
      color: this.myColor,
    };
  }

  public getPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }

  public broadcastCursor(x: number, y: number, stepIndex: number): void {
    if (!this.connected) return;
    this.broadcastMessage({
      type: 'cursor_move',
      senderId: this.myId,
      senderName: this.myName,
      senderColor: this.myColor,
      timestamp: Date.now(),
      payload: {
        cursor: { x, y, stepIndex },
      },
    });
  }

  public broadcastStroke(stroke: DrawingElement): void {
    if (!this.connected) return;
    this.broadcastMessage({
      type: 'stroke_draw',
      senderId: this.myId,
      senderName: this.myName,
      senderColor: this.myColor,
      timestamp: Date.now(),
      payload: { stroke },
    });
  }

  public broadcastSteps(steps: BlackboardStep[]): void {
    if (!this.connected) return;
    this.broadcastMessage({
      type: 'sync_steps',
      senderId: this.myId,
      senderName: this.myName,
      senderColor: this.myColor,
      timestamp: Date.now(),
      payload: { steps },
    });
  }

  public onPeersChange(cb: (peers: PeerInfo[]) => void): () => void {
    this.peersListeners.add(cb);
    return () => this.peersListeners.delete(cb);
  }

  public onRemoteCursor(cb: (peer: PeerInfo) => void): () => void {
    this.cursorListeners.add(cb);
    return () => this.cursorListeners.delete(cb);
  }

  public onRemoteStroke(cb: (stroke: DrawingElement) => void): () => void {
    this.strokeListeners.add(cb);
    return () => this.strokeListeners.delete(cb);
  }

  public onRemoteSteps(cb: (steps: BlackboardStep[]) => void): () => void {
    this.stepsListeners.add(cb);
    return () => this.stepsListeners.delete(cb);
  }

  private handleMessage(msg: CollabMessage): void {
    if (!msg || msg.senderId === this.myId) return;

    switch (msg.type) {
      case 'peer_join': {
        this.peers.set(msg.senderId, {
          id: msg.senderId,
          name: msg.senderName,
          color: msg.senderColor,
        });
        this.notifyPeersChange();

        // Respond with our presence so the new peer discovers us
        this.broadcastMessage({
          type: 'ping',
          senderId: this.myId,
          senderName: this.myName,
          senderColor: this.myColor,
          timestamp: Date.now(),
        });
        break;
      }

      case 'ping': {
        this.peers.set(msg.senderId, {
          id: msg.senderId,
          name: msg.senderName,
          color: msg.senderColor,
        });
        this.notifyPeersChange();
        break;
      }

      case 'peer_leave': {
        this.peers.delete(msg.senderId);
        this.notifyPeersChange();
        break;
      }

      case 'cursor_move': {
        if (msg.payload?.cursor) {
          const peer = this.peers.get(msg.senderId) || {
            id: msg.senderId,
            name: msg.senderName,
            color: msg.senderColor,
          };
          peer.cursor = msg.payload.cursor;
          this.peers.set(msg.senderId, peer);
          this.cursorListeners.forEach((fn) => fn(peer));
        }
        break;
      }

      case 'stroke_draw': {
        if (msg.payload?.stroke) {
          this.strokeListeners.forEach((fn) => fn(msg.payload!.stroke!));
        }
        break;
      }

      case 'sync_steps': {
        if (msg.payload?.steps) {
          this.stepsListeners.forEach((fn) => fn(msg.payload!.steps!));
        }
        break;
      }
    }
  }

  private broadcastMessage(msg: CollabMessage): void {
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (err) {
        console.error('Failed to post collaborative message:', err);
      }
    }
  }

  private notifyPeersChange(): void {
    const list = this.getPeers();
    this.peersListeners.forEach((fn) => fn(list));
  }
}
