export type DrawingTool = 'select' | 'pen' | 'line' | 'rect' | 'circle' | 'arrow' | 'text' | 'eraser';

export interface Point {
  x: number;
  y: number;
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

export interface BlackboardStep {
  step: number;
  title: string;
  explanation: string;
  code?: string;
  takeaway?: string;
  elements?: DrawingElement[];
}
