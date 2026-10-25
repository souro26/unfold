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

    // Verify critical learning milestones: Circle -> Tangent Line -> Contrast with Secant -> Perpendicularity
    expect(pedagogy.progressionStages[0].title).toContain('Circle');
    expect(pedagogy.progressionStages[1].title).toContain('Tangent Line');
    expect(pedagogy.progressionStages[2].title).toContain('Secant');
    expect(pedagogy.progressionStages[3].title).toContain('Perpendicularity');

    // Verify common misconceptions identified
    expect(pedagogy.commonMisconceptions.length).toBeGreaterThan(0);
    expect(pedagogy.commonMisconceptions[0]).toContain('Confusing');
  });

  it('Layer 1: Universally deconstructs ANY topic into a 4-scene progressive whiteboard sequence', () => {
    // 1. Algorithms & Data Structures
    const algoPedagogy = orchestrator.deconstructPedagogy('explain binary search tree search');
    expect(algoPedagogy.domain).toBe('algorithms');
    expect(algoPedagogy.progressionStages.length).toBe(4);
    expect(algoPedagogy.progressionStages[0].title).toContain('Initial State');
    expect(algoPedagogy.progressionStages[1].title).toContain('Traversal');
    expect(algoPedagogy.progressionStages[2].title).toContain('Contrast');
    expect(algoPedagogy.progressionStages[3].title).toContain('Computational Invariant');

    // 2. Physics & Mechanics
    const physicsPedagogy = orchestrator.deconstructPedagogy('explain newtons second law of motion');
    expect(physicsPedagogy.domain).toBe('physics');
    expect(physicsPedagogy.progressionStages.length).toBe(4);
    expect(physicsPedagogy.progressionStages[0].title).toContain('Physical Anchor');
    expect(physicsPedagogy.progressionStages[1].title).toContain('Force');
    expect(physicsPedagogy.progressionStages[2].title).toContain('Equilibrium');
    expect(physicsPedagogy.progressionStages[3].title).toContain('Governing');

    // 3. Distributed Systems
    const sysPedagogy = orchestrator.deconstructPedagogy('explain microservices architecture and failover');
    expect(sysPedagogy.domain).toBe('systems');
    expect(sysPedagogy.progressionStages.length).toBe(4);
    expect(sysPedagogy.progressionStages[0].title).toContain('Topology');
    expect(sysPedagogy.progressionStages[1].title).toContain('Protocol');
    expect(sysPedagogy.progressionStages[2].title).toContain('Contrast');
    expect(sysPedagogy.progressionStages[3].title).toContain('System Invariant');

    // 4. General Concept
    const genPedagogy = orchestrator.deconstructPedagogy('how does photosynthesis work');
    expect(genPedagogy.domain).toBe('general');
    expect(genPedagogy.progressionStages.length).toBe(4);
    expect(genPedagogy.progressionStages[0].title).toContain('Visual Foundation');
    expect(genPedagogy.progressionStages[1].title).toContain('Core Mechanism');
    expect(genPedagogy.progressionStages[2].title).toContain('Critical Contrast');
    expect(genPedagogy.progressionStages[3].title).toContain('Definitive Takeaway');
  });

  it('Layer 2: Generates 4-scene spatial blueprints across all domains', () => {
    // Physics Blueprint
    const physicsPed = orchestrator.deconstructPedagogy('explain newtons second law of motion');
    const physicsSpatial = orchestrator.architectSpatialBlueprint(physicsPed);
    expect(physicsSpatial.stepBlueprints.length).toBe(4);
    expect(physicsSpatial.stepBlueprints[0].elements.some((e) => e.text?.includes('Mass'))).toBe(true);
    expect(physicsSpatial.stepBlueprints[1].elements.some((e) => e.text?.includes('Applied Force'))).toBe(true);
    expect(physicsSpatial.stepBlueprints[2].elements.some((e) => e.text?.includes('Equilibrium') || e.text?.includes('Net Force'))).toBe(true);
    expect(physicsSpatial.stepBlueprints[3].elements.some((e) => e.text?.includes('m·a'))).toBe(true);

    // Systems Blueprint
    const sysPed = orchestrator.deconstructPedagogy('explain microservices architecture');
    const sysSpatial = orchestrator.architectSpatialBlueprint(sysPed);
    expect(sysSpatial.stepBlueprints.length).toBe(4);
    expect(sysSpatial.stepBlueprints[0].elements.some((e) => e.text?.includes('Client'))).toBe(true);
    expect(sysSpatial.stepBlueprints[1].elements.some((e) => e.text?.includes('gRPC') || e.text?.includes('Payload'))).toBe(true);
    expect(sysSpatial.stepBlueprints[2].elements.some((e) => e.text?.includes('Circuit Break') || e.text?.includes('Cache'))).toBe(true);
    expect(sysSpatial.stepBlueprints[3].elements.some((e) => e.text?.includes('Availability'))).toBe(true);
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

    // Step 1: Must contain circle, Center O, and Point P
    const step1 = spatial.stepBlueprints[0];
    expect(step1.elements.some((e) => e.type === 'circle')).toBe(true);
    expect(step1.elements.some((e) => e.text?.includes('Point of Contact P'))).toBe(true);

    // Step 2: Must contain tangent line touching circle at point P
    const step2 = spatial.stepBlueprints[1];
    expect(step2.elements.some((e) => e.type === 'line' && e.text?.includes('Tangent Line'))).toBe(true);

    // Step 3: Must contrast Tangent with Secant line
    const step3 = spatial.stepBlueprints[2];
    expect(step3.elements.some((e) => e.type === 'line' && e.text?.includes('Secant Line'))).toBe(true);

    // Step 4: Must contain 90-degree perpendicular marker and tangential velocity vector arrow
    const step4 = spatial.stepBlueprints[3];
    expect(step4.elements.some((e) => e.type === 'arrow' && e.text?.includes('Velocity'))).toBe(true);
    expect(step4.elements.some((e) => e.type === 'path')).toBe(true);
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
