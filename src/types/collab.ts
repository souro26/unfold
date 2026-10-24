import { BlackboardStep, DrawingElement } from './blackboard';

export interface PeerInfo {
  id: string;
  name: string;
  color: string;
  cursor?: {
    x: number;
    y: number;
    stepIndex: number;
  };
}

export type CollabMessageType =
  | 'peer_join'
  | 'peer_leave'
  | 'cursor_move'
  | 'stroke_draw'
  | 'sync_steps'
  | 'ping';

export interface CollabMessage {
  type: CollabMessageType;
  senderId: string;
  senderName: string;
  senderColor: string;
  timestamp: number;
  payload?: {
    cursor?: { x: number; y: number; stepIndex: number };
    stroke?: DrawingElement;
    steps?: BlackboardStep[];
  };
}

export interface CollabConfig {
  roomId: string;
  userName: string;
  userColor?: string;
  signalingUrl?: string;
}
