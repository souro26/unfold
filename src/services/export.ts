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
