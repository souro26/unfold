import { describe, it, expect } from 'vitest';
import { ExportService } from '../src/services/export';
import { SpeechService } from '../src/services/speech';
import { BlackboardStep } from '../src/types';

describe('Export Service', () => {
  const mockSteps: BlackboardStep[] = [
    {
      step: 1,
      title: 'Initialize System',
      explanation: 'Bootstraps cluster state',
      elements: [
        { id: '1', type: 'rect', color: '#00d4aa', strokeWidth: 2, start: { x: 50, y: 50 }, width: 100, height: 60 },
      ],
    },
    {
      step: 2,
      title: 'Leader Election',
      explanation: 'Nodes elect leader via heartbeat timeout',
      elements: [
        { id: '2', type: 'line', color: '#00f0ff', strokeWidth: 2, start: { x: 150, y: 80 }, end: { x: 250, y: 80 } },
        { id: '3', type: 'arrow', color: '#00d4aa', strokeWidth: 2, start: { x: 250, y: 80 }, end: { x: 350, y: 80 } },
      ],
    },
  ];

  it('toMermaid should generate valid flowchart with steps and arrows', () => {
    const mermaid = ExportService.toMermaid(mockSteps);
    expect(mermaid).toContain('flowchart TD');
    expect(mermaid).toContain('step_1["1. Initialize System"]');
    expect(mermaid).toContain('step_2["2. Leader Election"]');
    expect(mermaid).toContain('step_1 --> step_2');
  });

  it('toPlantUML should generate valid PlantUML component diagram', () => {
    const puml = ExportService.toPlantUML(mockSteps);
    expect(puml).toContain('@startuml');
    expect(puml).toContain('rectangle "Initialize System" as Step1');
    expect(puml).toContain('rectangle "Leader Election" as Step2');
    expect(puml).toContain('Step1 --> Step2');
    expect(puml).toContain('@enduml');
  });

  it('toExcalidraw should generate schema-compliant Excalidraw JSON', () => {
    const excalidraw = ExportService.toExcalidraw(mockSteps);
    expect(excalidraw.type).toBe('excalidraw');
    expect(excalidraw.version).toBe(2);
    expect(Array.isArray(excalidraw.elements)).toBe(true);

    const types = excalidraw.elements.map((el: any) => el.type);
    expect(types).toContain('text');
    expect(types).toContain('rectangle');
    expect(types).toContain('line');
    expect(types).toContain('arrow');
  });

  it('toManim should generate valid Python Manim Scene code with animations', () => {
    const manim = ExportService.toManim(mockSteps);
    expect(manim).toContain('from manim import *');
    expect(manim).toContain('class UnfoldScene(Scene):');
    expect(manim).toContain('title_1 = Text(r"1. Initialize System"');
    expect(manim).toContain('desc_1 = Text(r"Bootstraps cluster state"');
    expect(manim).toContain('Rectangle(');
    expect(manim).toContain('Line(');
    expect(manim).toContain('Arrow(');
    expect(manim).toContain('self.play(Write(title_1), FadeIn(desc_1))');
    expect(manim).toContain('self.play(FadeOut(Group(');
  });
});

describe('SpeechService SSML Parser', () => {
  it('parseSSML should convert break tags into natural speech pauses', () => {
    const ssml = 'Step one.<break time="500ms"/>Now proceeding to step two.';
    const parsed = SpeechService.parseSSML(ssml);
    expect(parsed).toContain('Step one. ... Now proceeding to step two.');
  });

  it('parseSSML should strip emphasis and prosody tags while preserving words', () => {
    const ssml = 'This is <emphasis level="strong">very important</emphasis> concept.';
    const parsed = SpeechService.parseSSML(ssml);
    expect(parsed).toBe('This is very important concept.');
  });

  it('parseSSML should strip markdown code and asterisks', () => {
    const markdown = 'Run `cargo test` to verify **all** packages.';
    const parsed = SpeechService.parseSSML(markdown);
    expect(parsed).toBe('Run cargo test to verify all packages.');
  });
});
