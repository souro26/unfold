import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginManager } from '../src/services/PluginManager';
import { BlackboardStep, DrawingElement, UnfoldPlugin } from '../src/types';

describe('Unfold Plugin System', () => {
  let manager: PluginManager;

  const mockSteps: BlackboardStep[] = [
    {
      step: 1,
      title: 'Initialize Cluster',
      explanation: 'Spinning up Raft consensus nodes',
      elements: [
        { id: 'node-1', type: 'rect', color: '#00d4aa', strokeWidth: 2, start: { x: 50, y: 50 }, width: 120, height: 60 },
        { id: 'node-2', type: 'rect', color: '#00f0ff', strokeWidth: 2, start: { x: 220, y: 50 }, width: 120, height: 60 },
      ],
    },
    {
      step: 2,
      title: 'Elect Leader',
      explanation: 'Term 1 leader election completed',
      elements: [
        { id: 'link-1', type: 'arrow', color: '#00d4aa', strokeWidth: 2, start: { x: 170, y: 80 }, end: { x: 220, y: 80 } },
      ],
    },
  ];

  beforeEach(() => {
    manager = PluginManager.getInstance();
  });

  it('initializes with built-in core plugins', () => {
    const plugins = manager.listPlugins();
    const ids = plugins.map((p) => p.id);
    expect(ids).toContain('core-graphviz-dot');
    expect(ids).toContain('core-latex-tikz');
    expect(ids).toContain('core-grid-layout');
  });

  it('built-in Graphviz DOT exporter produces valid digraph syntax', () => {
    const exportResult = manager.executeExport('dot', mockSteps);
    expect(exportResult).not.toBeNull();
    expect(exportResult?.filename).toBe('diagram.dot');
    expect(exportResult?.mimeType).toBe('text/vnd.graphviz');
    expect(exportResult?.content).toContain('digraph BlackboardExplanation {');
    expect(exportResult?.content).toContain('step_1 [label="1. Initialize Cluster\\nSpinning up Raft consensus nodes"]');
    expect(exportResult?.content).toContain('step_1 -> step_2;');
  });

  it('built-in LaTeX TikZ exporter produces valid standalone figure syntax', () => {
    const exportResult = manager.executeExport('tikz', mockSteps);
    expect(exportResult).not.toBeNull();
    expect(exportResult?.filename).toBe('diagram.tex');
    expect(exportResult?.mimeType).toBe('application/x-latex');
    expect(exportResult?.content).toContain('\\begin{tikzpicture}');
    expect(exportResult?.content).toContain('\\node[stepnode] (node1) {\\textbf{1. Initialize Cluster}};');
    expect(exportResult?.content).toContain('\\draw[arrow] (node1) -- (node2);');
    expect(exportResult?.content).toContain('\\end{tikzpicture}');
  });

  it('built-in Grid Layout reorganizes element coordinates into a 2D matrix', () => {
    const rearranged = manager.executeLayout('grid', mockSteps, { columns: 2 });
    expect(rearranged.length).toBe(2);

    const step1Els = rearranged[0].elements || [];
    expect(step1Els[0].start).toEqual({ x: 80, y: 80 });
    expect(step1Els[1].start).toEqual({ x: 400, y: 80 });
  });

  it('supports registering and unregistering custom plugins with lifecycle hooks', () => {
    const onInit = vi.fn();
    const onDestroy = vi.fn();
    const onStepRender = vi.fn();
    const renderStar = vi.fn();

    const testPlugin: UnfoldPlugin = {
      id: 'custom-star-plugin',
      name: 'Star Shape Plugin',
      version: '0.1.0',
      description: 'Draws star geometries',
      elements: {
        star: renderStar,
      },
      hooks: {
        onInit,
        onDestroy,
        onStepRender,
      },
    };

    manager.register(testPlugin);
    expect(onInit).toHaveBeenCalledTimes(1);
    expect(manager.hasElementRenderer('star')).toBe(true);

    // Test notifyStepRender
    manager.notifyStepRender(mockSteps[0]);
    expect(onStepRender).toHaveBeenCalledWith(mockSteps[0]);

    // Test renderCustomElement
    const mockCtx = {} as CanvasRenderingContext2D;
    const starEl: DrawingElement = {
      id: 'star-1',
      type: 'star' as any,
      color: '#ffdd00',
      strokeWidth: 3,
      start: { x: 100, y: 100 },
    };

    const rendered = manager.renderCustomElement(mockCtx, starEl);
    expect(rendered).toBe(true);
    expect(renderStar).toHaveBeenCalledWith(mockCtx, starEl);

    // Unregister
    manager.unregister('custom-star-plugin');
    expect(onDestroy).toHaveBeenCalledTimes(1);
    expect(manager.hasElementRenderer('star')).toBe(false);
  });
});
