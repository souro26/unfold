import { describe, it, expect, vi } from 'vitest';
import { AgentOrchestrator } from '../src/services/AgentOrchestrator';

describe('AgentOrchestrator Multi-Layer Reasoning System', () => {
  const orchestrator = AgentOrchestrator.getInstance();

  it('Layer 1: Deconstructs mathematical concept (e.g. tangent) into deep pedagogy', () => {
    const pedagogy = orchestrator.deconstructPedagogy('teach me what a tangent is');

    expect(pedagogy.domain).toBe('mathematics');
    expect(pedagogy.concept).toContain('Tangent');
    expect(pedagogy.coreIntuition).toContain('limit of a secant line');
    expect(pedagogy.progressionStages.length).toBeGreaterThanOrEqual(4);

    // Verify critical learning milestones
    expect(pedagogy.progressionStages[0].title).toContain('Secant');
    expect(pedagogy.progressionStages[1].title).toContain('Limiting Process');
    expect(pedagogy.progressionStages[2].title).toContain('Tangent Line');
    expect(pedagogy.progressionStages[3].title).toContain('Perpendicularity');

    // Verify common misconceptions identified
    expect(pedagogy.commonMisconceptions.length).toBeGreaterThan(0);
    expect(pedagogy.commonMisconceptions[0]).toContain('Confusing');
  });

  it('Layer 1: Deconstructs computer science / algorithm concepts properly', () => {
    const pedagogy = orchestrator.deconstructPedagogy('explain binary search tree search');

    expect(pedagogy.domain).toBe('algorithms');
    expect(pedagogy.progressionStages.length).toBeGreaterThanOrEqual(3);
    expect(pedagogy.coreIntuition).toContain('state transformation');
  });

  it('Layer 2: Generates spatial blueprint with exact geometric coordinates and semantic color palette', () => {
    const pedagogy = orchestrator.deconstructPedagogy('what is a tangent');
    const spatial = orchestrator.architectSpatialBlueprint(pedagogy);

    expect(spatial.coordinateFrame.width).toBe(900);
    expect(spatial.coordinateFrame.height).toBe(560);
    expect(spatial.coordinateFrame.showAxes).toBe(true);
    expect(spatial.colorPalette.primary).toBe('#00f0ff');
    expect(spatial.colorPalette.secondary).toBe('#50fa7b');
    expect(spatial.colorPalette.accent).toBe('#bd93f9');

    // Step 1: Must contain circle, P, Q, and secant line
    const step1 = spatial.stepBlueprints[0];
    expect(step1.elements.some((e) => e.type === 'circle')).toBe(true);
    expect(step1.elements.some((e) => e.type === 'line' && e.text === 'Secant Line')).toBe(true);

    // Step 3: Must contain tangent line touching at P and 90 degree marker
    const step3 = spatial.stepBlueprints[2];
    expect(step3.elements.some((e) => e.type === 'line' && e.text?.includes('Tangent Line'))).toBe(true);
    expect(step3.elements.some((e) => e.type === 'path')).toBe(true);

    // Step 4: Must contain tangential velocity vector arrow
    const step4 = spatial.stepBlueprints[3];
    expect(step4.elements.some((e) => e.type === 'arrow' && e.text?.includes('Velocity'))).toBe(true);
  });

  it('Layer 3: Synthesizes master drawing prompt incorporating pedagogy and spatial blueprint', () => {
    const pedagogy = orchestrator.deconstructPedagogy('what is a tangent');
    const spatial = orchestrator.architectSpatialBlueprint(pedagogy);
    const finalPrompt = orchestrator.synthesizeDrawingPrompt('what is a tangent', pedagogy, spatial);

    expect(finalPrompt).toContain('[UNFOLD MULTI-LAYER REASONING TRACE]');
    expect(finalPrompt).toContain('IDENTIFIED DOMAIN: MATHEMATICS');
    expect(finalPrompt).toContain('CORE MENTAL MODEL:');
    expect(finalPrompt).toContain('SPATIAL BLUEPRINT CONSTRAINTS');
    expect(finalPrompt).toContain('INSTRUCTIONS FOR DRAWING AGENT');
  });

  it('Executes the multi-layer pipeline behind the scenes with live layer progress callbacks', async () => {
    const ipc = await import('../src/services/ipc');
    const mockSend = vi.spyOn(ipc, 'sendMessage').mockResolvedValue(`
# Understanding Tangents

### Step 1: Secant Line
A secant intersects at two points.

\`\`\`json
{
  "steps": [
    { "step": 1, "title": "Secant Line", "explanation": "Cuts at two points", "elements": [] }
  ]
}
\`\`\`
    `);

    const progressUpdates: any[] = [];
    const onProgress = (status: any) => {
      progressUpdates.push(status);
    };

    const result = await orchestrator.executePipeline(
      'what is a tangent',
      'test-conv-1',
      undefined,
      onProgress
    );

    // Progress updates should have passed through layers 1, 2, and 3
    expect(progressUpdates.some((p) => p.layer === 1)).toBe(true);
    expect(progressUpdates.some((p) => p.layer === 2)).toBe(true);
    expect(progressUpdates.some((p) => p.layer === 3)).toBe(true);

    // Verified output plan
    expect(result.plan.steps.length).toBeGreaterThanOrEqual(1);
    expect(result.plan.steps[0].title).toContain('Secant');
    expect(result.trace.pedagogicalReasoning).toContain('MATHEMATICS');
    expect(result.trace.spatialBlueprintReasoning).toContain('900x560');
    expect(result.markdownResponse).toContain('Tangent');

    mockSend.mockRestore();
  });
});
