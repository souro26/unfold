import { BlackboardStep, DrawingElement } from './blackboard';

export type CustomElementRenderer = (ctx: CanvasRenderingContext2D, element: DrawingElement) => void;

export type LayoutAlgorithm = (
  steps: BlackboardStep[],
  options?: Record<string, unknown>
) => BlackboardStep[];

export interface ExportSerializer {
  name: string;
  extension: string;
  mimeType: string;
  serialize: (steps: BlackboardStep[]) => string;
}

export interface PluginHooks {
  onInit?: () => void;
  onDestroy?: () => void;
  onStepRender?: (step: BlackboardStep) => void;
}

export interface UnfoldPlugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  elements?: Record<string, CustomElementRenderer>;
  layouts?: Record<string, LayoutAlgorithm>;
  exporters?: Record<string, ExportSerializer>;
  hooks?: PluginHooks;
}
