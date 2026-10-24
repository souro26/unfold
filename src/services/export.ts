import { BlackboardStep } from '../types';

export class ExportService {
  /**
   * Export blackboard steps to Mermaid flowchart syntax
   */
  public static toMermaid(steps: BlackboardStep[]): string {
    const lines: string[] = ['flowchart TD'];

    steps.forEach((step, idx) => {
      const stepId = `step_${idx + 1}`;
      const safeTitle = step.title.replace(/["\n]/g, ' ');
      lines.push(`  ${stepId}["${idx + 1}. ${safeTitle}"]`);

      if (idx > 0) {
        lines.push(`  step_${idx} --> ${stepId}`);
      }
    });

    return lines.join('\n');
  }

  /**
   * Export blackboard steps to PlantUML syntax
   */
  public static toPlantUML(steps: BlackboardStep[]): string {
    const lines: string[] = ['@startuml', '!theme plain', 'skinparam defaultFontName sans-serif'];

    steps.forEach((step, idx) => {
      const stepId = `Step${idx + 1}`;
      const safeTitle = step.title.replace(/["\n]/g, ' ');
      lines.push(`rectangle "${safeTitle}" as ${stepId}`);

      if (idx > 0) {
        lines.push(`Step${idx} --> ${stepId}`);
      }
    });

    lines.push('@enduml');
    return lines.join('\n');
  }

  /**
   * Export blackboard steps to Manim Community Edition Python scene code
   */
  public static toManim(steps: BlackboardStep[]): string {
    const lines: string[] = [
      'from manim import *',
      '',
      'class UnfoldScene(Scene):',
      '    """',
      '    Auto-generated visual explanation scene by Unfold.',
      '    Render using: manim -pql scene.py UnfoldScene',
      '    """',
      '    def construct(self):',
      '        self.camera.background_color = "#121214"',
      '',
    ];

    if (steps.length === 0) {
      lines.push('        pass');
      return lines.join('\n');
    }

    steps.forEach((step, idx) => {
      const stepNum = idx + 1;
      const safeTitle = step.title.replace(/["\\]/g, '\\$&').replace(/\n/g, ' ');
      const safeExp = (step.explanation || '').replace(/["\\]/g, '\\$&').replace(/\n/g, ' ');

      lines.push(`        # --- Step ${stepNum}: ${safeTitle} ---`);
      lines.push(`        title_${stepNum} = Text(r"${stepNum}. ${safeTitle}", font_size=32, color="#00d4aa").to_edge(UP)`);
      if (safeExp) {
        lines.push(`        desc_${stepNum} = Text(r"${safeExp}", font_size=20, color="#9ca3af").next_to(title_${stepNum}, DOWN, buff=0.25)`);
      }

      // Collect geometric elements
      const elementVarNames: string[] = [];
      if (step.elements && step.elements.length > 0) {
        step.elements.forEach((el, elIdx) => {
          const varName = `elem_${stepNum}_${elIdx + 1}`;
          const colorHex = el.color || '#00d4aa';

          if (el.type === 'rect' && el.start) {
            const w = ((el.width || 100) / 100).toFixed(2);
            const h = ((el.height || 60) / 100).toFixed(2);
            const cx = ((el.start.x + (el.width || 100) / 2 - 500) / 100).toFixed(2);
            const cy = (-(el.start.y + (el.height || 60) / 2 - 350) / 100).toFixed(2);
            lines.push(`        ${varName} = Rectangle(width=${w}, height=${h}, color="${colorHex}", fill_opacity=0.15).move_to([${cx}, ${cy}, 0])`);
            elementVarNames.push(varName);
          } else if (el.type === 'circle' && el.start) {
            const r = ((el.radius || 40) / 100).toFixed(2);
            const cx = ((el.start.x - 500) / 100).toFixed(2);
            const cy = (-(el.start.y - 350) / 100).toFixed(2);
            lines.push(`        ${varName} = Circle(radius=${r}, color="${colorHex}", fill_opacity=0.15).move_to([${cx}, ${cy}, 0])`);
            elementVarNames.push(varName);
          } else if (el.type === 'line' && el.start && el.end) {
            const x1 = ((el.start.x - 500) / 100).toFixed(2);
            const y1 = (-(el.start.y - 350) / 100).toFixed(2);
            const x2 = ((el.end.x - 500) / 100).toFixed(2);
            const y2 = (-(el.end.y - 350) / 100).toFixed(2);
            lines.push(`        ${varName} = Line(start=[${x1}, ${y1}, 0], end=[${x2}, ${y2}, 0], color="${colorHex}")`);
            elementVarNames.push(varName);
          } else if (el.type === 'arrow' && el.start && el.end) {
            const x1 = ((el.start.x - 500) / 100).toFixed(2);
            const y1 = (-(el.start.y - 350) / 100).toFixed(2);
            const x2 = ((el.end.x - 500) / 100).toFixed(2);
            const y2 = (-(el.end.y - 350) / 100).toFixed(2);
            lines.push(`        ${varName} = Arrow(start=[${x1}, ${y1}, 0], end=[${x2}, ${y2}, 0], color="${colorHex}", buff=0)`);
            elementVarNames.push(varName);
          } else if (el.type === 'text' && el.start && el.text) {
            const safeText = el.text.replace(/["\\]/g, '\\$&');
            const cx = ((el.start.x - 500) / 100).toFixed(2);
            const cy = (-(el.start.y - 350) / 100).toFixed(2);
            lines.push(`        ${varName} = Text(r"${safeText}", font_size=20, color="${colorHex}").move_to([${cx}, ${cy}, 0])`);
            elementVarNames.push(varName);
          }
        });
      }

      // Play animations
      const showAnim = safeExp
        ? `self.play(Write(title_${stepNum}), FadeIn(desc_${stepNum}))`
        : `self.play(Write(title_${stepNum}))`;
      lines.push(`        ${showAnim}`);

      if (elementVarNames.length > 0) {
        lines.push(`        self.play(${elementVarNames.map((v) => `Create(${v})`).join(', ')})`);
      }

      lines.push('        self.wait(1.5)');

      if (idx < steps.length - 1) {
        const fadeGroup = [
          `title_${stepNum}`,
          ...(safeExp ? [`desc_${stepNum}`] : []),
          ...elementVarNames,
        ].join(', ');
        lines.push(`        self.play(FadeOut(Group(${fadeGroup})))`);
        lines.push('');
      }
    });

    lines.push('        self.wait(2)');
    return lines.join('\n');
  }

  /**
   * Export blackboard elements to Excalidraw JSON format
   */
  public static toExcalidraw(steps: BlackboardStep[]): Record<string, any> {
    const excalidrawElements: any[] = [];
    let currentY = 100;

    steps.forEach((step, stepIndex) => {
      // Step title text
      excalidrawElements.push({
        id: `title_${stepIndex}`,
        type: 'text',
        x: 100,
        y: currentY,
        width: 300,
        height: 30,
        text: `Step ${stepIndex + 1}: ${step.title}`,
        fontSize: 20,
        fontFamily: 1,
        textAlign: 'left',
        verticalAlign: 'top',
        strokeColor: '#00d4aa',
        backgroundColor: 'transparent',
      });

      currentY += 50;

      // Render step visual elements
      if (step.elements) {
        step.elements.forEach((el, elIdx) => {
          const baseId = `el_${stepIndex}_${elIdx}`;
          if (el.type === 'rect' && el.start && el.width && el.height) {
            excalidrawElements.push({
              id: baseId,
              type: 'rectangle',
              x: el.start.x,
              y: currentY + el.start.y,
              width: el.width,
              height: el.height,
              strokeColor: el.color || '#00d4aa',
              backgroundColor: 'transparent',
              strokeWidth: el.strokeWidth || 2,
              roughness: 1,
            });
          } else if (el.type === 'line' && el.start && el.end) {
            excalidrawElements.push({
              id: baseId,
              type: 'line',
              x: el.start.x,
              y: currentY + el.start.y,
              width: el.end.x - el.start.x,
              height: el.end.y - el.start.y,
              points: [
                [0, 0],
                [el.end.x - el.start.x, el.end.y - el.start.y],
              ],
              strokeColor: el.color || '#00f0ff',
              strokeWidth: el.strokeWidth || 2,
            });
          } else if (el.type === 'arrow' && el.start && el.end) {
            excalidrawElements.push({
              id: baseId,
              type: 'arrow',
              x: el.start.x,
              y: currentY + el.start.y,
              width: el.end.x - el.start.x,
              height: el.end.y - el.start.y,
              points: [
                [0, 0],
                [el.end.x - el.start.x, el.end.y - el.start.y],
              ],
              strokeColor: el.color || '#00d4aa',
              strokeWidth: el.strokeWidth || 2,
            });
          }
        });
      }

      currentY += 200;
    });

    return {
      type: 'excalidraw',
      version: 2,
      source: 'https://unfold.app',
      elements: excalidrawElements,
      appState: {
        viewBackgroundColor: '#121214',
        gridSize: 20,
      },
      files: {},
    };
  }

  /**
   * Helper to trigger browser download of text file
   */
  public static downloadFile(filename: string, content: string, mimeType: string = 'text/plain'): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
