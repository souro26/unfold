export type DrawingTool = 'select' | 'pen' | 'line' | 'rect' | 'circle' | 'arrow' | 'text' | 'eraser';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
  tiltX?: number;
  tiltY?: number;
}

export interface DrawingElement {
  id: string;
  type: DrawingTool;
  color: string;
  strokeWidth: number;
  points?: Point[];
  start?: Point;
  end?: Point;
  text?: string;
  width?: number;
  height?: number;
  radius?: number;
}

export interface DeepReasoningMetadata {
  pedagogicalStrategy?: string;
  spatialArchitecture?: string;
  mentalModel?: string;
  colorPalette?: string;
  rawJson?: string;
}

export interface BlackboardStep {
  step: number;
  title: string;
  explanation: string;
  code?: string;
  takeaway?: string;
  elements?: DrawingElement[];
  reasoning?: DeepReasoningMetadata | string;
}
