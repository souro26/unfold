import { BlackboardStep, DrawingElement, UnfoldPlugin, CustomElementRenderer, LayoutAlgorithm, ExportSerializer } from '../types';

export class PluginManager {
  private static instance: PluginManager;
  private plugins: Map<string, UnfoldPlugin> = new Map();
  private elementRenderers: Map<string, CustomElementRenderer> = new Map();
  private layoutAlgorithms: Map<string, LayoutAlgorithm> = new Map();
  private exportSerializers: Map<string, ExportSerializer> = new Map();

  private constructor() {
    this.registerBuiltInPlugins();
  }

  public static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager();
    }
    return PluginManager.instance;
  }

  /**
   * Register a new Unfold plugin
   */
  public register(plugin: UnfoldPlugin): void {
    if (this.plugins.has(plugin.id)) {
      this.unregister(plugin.id);
    }

    this.plugins.set(plugin.id, plugin);

    // Register custom element renderers
    if (plugin.elements) {
      Object.entries(plugin.elements).forEach(([type, renderer]) => {
        this.elementRenderers.set(type, renderer);
      });
    }

    // Register layout algorithms
    if (plugin.layouts) {
      Object.entries(plugin.layouts).forEach(([name, layout]) => {
        this.layoutAlgorithms.set(name, layout);
      });
    }

    // Register export serializers
    if (plugin.exporters) {
      Object.entries(plugin.exporters).forEach(([format, serializer]) => {
        this.exportSerializers.set(format.toLowerCase(), serializer);
      });
    }

    // Run onInit hook
    try {
      plugin.hooks?.onInit?.();
    } catch (e) {
      console.error(`Plugin ${plugin.id} onInit error:`, e);
    }
  }

  /**
   * Unregister an existing plugin by ID
   */
  public unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    // Run onDestroy hook
    try {
      plugin.hooks?.onDestroy?.();
    } catch (e) {
      console.error(`Plugin ${pluginId} onDestroy error:`, e);
    }

    // Unbind element renderers
    if (plugin.elements) {
      Object.keys(plugin.elements).forEach((type) => {
        this.elementRenderers.delete(type);
      });
    }

    // Unbind layouts
    if (plugin.layouts) {
      Object.keys(plugin.layouts).forEach((name) => {
        this.layoutAlgorithms.delete(name);
      });
    }

    // Unbind exporters
    if (plugin.exporters) {
      Object.keys(plugin.exporters).forEach((format) => {
        this.exportSerializers.delete(format.toLowerCase());
      });
    }

    this.plugins.delete(pluginId);
  }

  public getPlugin(pluginId: string): UnfoldPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  public listPlugins(): UnfoldPlugin[] {
    return Array.from(this.plugins.values());
  }

  public hasElementRenderer(type: string): boolean {
    return this.elementRenderers.has(type);
  }

  /**
   * Render a custom element if a registered plugin handles its type
   */
  public renderCustomElement(ctx: CanvasRenderingContext2D, element: DrawingElement): boolean {
    const renderer = this.elementRenderers.get(element.type);
    if (renderer) {
      try {
        renderer(ctx, element);
        return true;
      } catch (err) {
        console.error(`Error rendering custom element of type "${element.type}":`, err);
      }
    }
    return false;
  }

  /**
   * Execute a registered layout algorithm on steps
   */
  public executeLayout(
    algorithmName: string,
    steps: BlackboardStep[],
    options?: Record<string, unknown>
  ): BlackboardStep[] {
    const layout = this.layoutAlgorithms.get(algorithmName);
    if (!layout) {
      throw new Error(`Layout algorithm "${algorithmName}" not found.`);
    }
    return layout(steps, options);
  }

  /**
   * Execute a registered export serializer
   */
  public executeExport(
    format: string,
    steps: BlackboardStep[]
  ): { filename: string; content: string; mimeType: string } | null {
    const serializer = this.exportSerializers.get(format.toLowerCase());
    if (!serializer) return null;

    const content = serializer.serialize(steps);
    const filename = `diagram.${serializer.extension.replace(/^\./, '')}`;
    return {
      filename,
      content,
      mimeType: serializer.mimeType,
    };
  }

  public listExportFormats(): Array<{ format: string; name: string; extension: string }> {
    return Array.from(this.exportSerializers.entries()).map(([format, ser]) => ({
      format,
      name: ser.name,
      extension: ser.extension,
    }));
  }

  /**
   * Notify plugins of step render
   */
  public notifyStepRender(step: BlackboardStep): void {
    this.plugins.forEach((plugin) => {
      try {
        plugin.hooks?.onStepRender?.(step);
      } catch (e) {
        console.error(`Plugin ${plugin.id} onStepRender error:`, e);
      }
    });
  }

  /**
   * Register default built-in plugins for Graphviz DOT, LaTeX TikZ, and Grid Layout
   */
  private registerBuiltInPlugins(): void {
    // 1. Graphviz DOT Exporter Plugin
    this.register({
      id: 'core-graphviz-dot',
      name: 'Graphviz DOT Exporter',
      version: '1.0.0',
      description: 'Exports blackboard steps as a Graphviz DOT directed graph',
      exporters: {
        dot: {
          name: 'Graphviz (.dot)',
          extension: 'dot',
          mimeType: 'text/vnd.graphviz',
          serialize: (steps: BlackboardStep[]) => {
            const lines: string[] = [
              'digraph BlackboardExplanation {',
              '  graph [bgcolor="#121214", fontcolor="#e4e4e7", fontname="Helvetica"];',
              '  node [shape=box, style="filled,rounded", fillcolor="#1f1f23", fontcolor="#e4e4e7", color="#00d4aa", fontname="Helvetica"];',
              '  edge [color="#00f0ff", fontcolor="#9ca3af", fontname="Helvetica"];',
              '',
            ];

            steps.forEach((step, idx) => {
              const safeTitle = step.title.replace(/"/g, '\\"');
              const safeExp = (step.explanation || '').replace(/"/g, '\\"');
              lines.push(`  step_${idx + 1} [label="${idx + 1}. ${safeTitle}\\n${safeExp}"];`);

              if (idx > 0) {
                lines.push(`  step_${idx} -> step_${idx + 1};`);
              }
            });

            lines.push('}');
            return lines.join('\n');
          },
        },
      },
    });

    // 2. LaTeX TikZ Exporter Plugin
    this.register({
      id: 'core-latex-tikz',
      name: 'LaTeX TikZ Exporter',
      version: '1.0.0',
      description: 'Exports blackboard steps as a LaTeX TikZ standalone figure',
      exporters: {
        tikz: {
          name: 'LaTeX TikZ (.tex)',
          extension: 'tex',
          mimeType: 'application/x-latex',
          serialize: (steps: BlackboardStep[]) => {
            const lines: string[] = [
              '% Generated by Unfold',
              '\\documentclass[tikz,border=10pt]{standalone}',
              '\\usetikzlibrary{shapes,arrows.meta,positioning}',
              '\\begin{document}',
              '\\begin{tikzpicture}[',
              '  stepnode/.style={rectangle, rounded corners, draw=teal, fill=black!5, thick, inner sep=8pt, text width=5cm, align=center},',
              '  arrow/.style={-Latex, thick, cyan}',
              ']',
              '',
            ];

            steps.forEach((step, idx) => {
              const safeTitle = step.title.replace(/[#$%&_~^\\]/g, ' ');
              const nodeName = `node${idx + 1}`;

              if (idx === 0) {
                lines.push(`  \\node[stepnode] (${nodeName}) {\\textbf{${idx + 1}. ${safeTitle}}};`);
              } else {
                const prevNode = `node${idx}`;
                lines.push(`  \\node[stepnode, below=1.2cm of ${prevNode}] (${nodeName}) {\\textbf{${idx + 1}. ${safeTitle}}};`);
                lines.push(`  \\draw[arrow] (${prevNode}) -- (${nodeName});`);
              }
            });

            lines.push('\\end{tikzpicture}');
            lines.push('\\end{document}');
            return lines.join('\n');
          },
        },
      },
    });

    // 3. Grid Layout Plugin
    this.register({
      id: 'core-grid-layout',
      name: 'Grid Layout Engine',
      version: '1.0.0',
      description: 'Arranges elements in blackboard steps across an evenly spaced grid',
      layouts: {
        grid: (steps: BlackboardStep[], options?: Record<string, unknown>) => {
          const cols = (options?.columns as number) || 2;
          const colWidth = 320;
          const rowHeight = 220;
          const startX = 80;
          const startY = 80;

          return steps.map((step) => {
            if (!step.elements) return step;

            const updatedElements = step.elements.map((el, i) => {
              const col = i % cols;
              const row = Math.floor(i / cols);
              const x = startX + col * colWidth;
              const y = startY + row * rowHeight;

              return {
                ...el,
                start: { x, y },
                ...(el.end ? { end: { x: x + 150, y } } : {}),
              };
            });

            return {
              ...step,
              elements: updatedElements,
            };
          });
        },
      },
    });
  }
}
