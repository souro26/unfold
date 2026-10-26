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

  it('Deconstructs set theory and generates authentic Venn diagrams with concrete member elements', () => {
    const setPed = orchestrator.deconstructPedagogy('what is Union in Set theory?');
    expect(setPed.domain).toBe('mathematics');
    expect(setPed.concept).toContain('Set');
    expect(setPed.progressionStages.length).toBe(4);
    expect(setPed.progressionStages[0].title).toContain('Sets A & B');
    expect(setPed.progressionStages[1].title).toContain('Grand Union');
    expect(setPed.progressionStages[2].title).toContain('Double-Counting');
    expect(setPed.progressionStages[3].title).toContain('Inclusion-Exclusion');

    const setSpatial = orchestrator.architectSpatialBlueprint(setPed);
    expect(setSpatial.stepBlueprints.length).toBe(4);

    // Scene 1: Must contain circles for Set A and Set B, and member element dots (1, 2, 3, 4, 5)
    const s1 = setSpatial.stepBlueprints[0];
    expect(s1.elements.some((e) => e.text?.includes('Set A'))).toBe(true);
    expect(s1.elements.some((e) => e.text?.includes('Set B'))).toBe(true);
    expect(s1.elements.some((e) => e.text?.includes('• 1'))).toBe(true);
    expect(s1.elements.some((e) => e.text?.includes('• 3'))).toBe(true);
    expect(s1.elements.some((e) => e.text?.includes('• 5'))).toBe(true);

    // Scene 2: Grand union card
    const s2 = setSpatial.stepBlueprints[1];
    expect(s2.elements.some((e) => e.text?.includes('A ∪ B'))).toBe(true);

    // Scene 3: Double-counting warning card
    const s3 = setSpatial.stepBlueprints[2];
    expect(s3.elements.some((e) => e.text?.includes('Double-Counting'))).toBe(true);

    // Scene 4: Inclusion-Exclusion formula card
    const s4 = setSpatial.stepBlueprints[3];
    expect(s4.elements.some((e) => e.text?.includes('|A ∪ B| = |A| + |B| - |A ∩ B|'))).toBe(true);
  });

  it('Extracts rich conversational master-teacher narration from Markdown headers over robotic developer directives', async () => {
    const ipc = await import('../src/services/ipc');
    const mockSend = vi.spyOn(ipc, 'sendMessage').mockResolvedValue(`
# Union in Set Theory

### Step 1: Overlapping Sets
Imagine you have two groups of things. Look at the board: we draw two overlapping circles inside our universe. Circle A has items 1 and 2, Circle B has items 4 and 5, and right in the middle is item 3.

### Step 2: The Grand Union
Now, look at the bright emerald boundary wrapping around both circles. Every single item belongs to the Union.

\`\`\`json
{
  "steps": [
    {
      "step": 1,
      "title": "Overlapping Sets",
      "explanation": "Establish Set A and Set B with overlap",
      "elements": [
        { "id": "c_a", "type": "circle", "color": "#00f0ff", "start": { "x": 370, "y": 250 }, "radius": 115 }
      ]
    },
    {
      "step": 2,
      "title": "The Grand Union",
      "explanation": "Show resulting union",
      "elements": []
    }
  ]
}
\`\`\`
    `);

    const result = await orchestrator.executePipeline(
      'what is union in set theory',
      'test-conv-teacher',
      undefined
    );

    // Verify robotic developer imperatives were replaced by the warm conversational teacher speech
    expect(result.plan.steps[0].explanation).toContain('Imagine you have two groups of things');
    expect(result.plan.steps[0].explanation).not.toBe('Establish Set A and Set B with overlap');

    expect(result.plan.steps[1].explanation).toContain('Now, look at the bright emerald boundary');
    expect(result.plan.steps[1].explanation).not.toBe('Show resulting union');

    mockSend.mockRestore();
  });

  it('Retains conversation context across turns when user asks follow-up queries like "explain simpler"', () => {
    // Simulated prior conversation turns in the same chat
    const priorHistory = [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: 'please teach me what intersection in set theory is/',
        timestamp: Date.now() - 60000,
      },
      {
        id: 'msg-2',
        role: 'assistant' as const,
        content: 'Intersection is the shared overlap between sets...',
        timestamp: Date.now() - 30000,
      },
    ];

    // Follow-up prompt from user with no explicit subject noun
    const followUpPedagogy = orchestrator.deconstructPedagogy('can you explain it simpler please?', priorHistory);

    expect(followUpPedagogy.domain).toBe('mathematics');
    expect(followUpPedagogy.concept).toContain('Intersection');
    expect(followUpPedagogy.concept).toContain('Simple Intuition');
    expect(followUpPedagogy.coreIntuition).toContain('groups of friends');
    expect(followUpPedagogy.progressionStages[1].narrationScript).toContain('glowing golden lens');
  });

  it('Distinctly differentiates Set Intersection from Set Union in both pedagogy and spatial blueprint', () => {
    // 1. Intersection
    const interPed = orchestrator.deconstructPedagogy('explain intersection in set theory');
    expect(interPed.concept).toContain('Intersection');
    const interSpatial = orchestrator.architectSpatialBlueprint(interPed);
    expect(interSpatial.stepBlueprints[1].elements.some((e) => e.text?.includes('A ∩ B'))).toBe(true);
    expect(interSpatial.stepBlueprints[3].elements.some((e) => e.text?.includes('|A ∩ B| = |A| + |B| - |A ∪ B|'))).toBe(true);

    // 2. Union
    const unionPed = orchestrator.deconstructPedagogy('explain union in set theory');
    expect(unionPed.concept).toContain('Union');
    const unionSpatial = orchestrator.architectSpatialBlueprint(unionPed);
    expect(unionSpatial.stepBlueprints[1].elements.some((e) => e.text?.includes('A ∪ B'))).toBe(true);
    expect(unionSpatial.stepBlueprints[3].elements.some((e) => e.text?.includes('|A ∪ B| = |A| + |B| - |A ∩ B|'))).toBe(true);
  });

  it('Spatial blueprints enforce clean non-overlapping vertical zones', () => {
    const interPed = orchestrator.deconstructPedagogy('explain intersection in set theory');
    const spatial = orchestrator.architectSpatialBlueprint(interPed);

    for (const step of spatial.stepBlueprints) {
      // Find header badge
      const headerBadge = step.elements.find((e) => e.id.includes('badge'));
      // Find circles
      const circleA = step.elements.find((e) => e.id === 'circle_a');
      // Find footer card
      const footerCard = step.elements.find((e) => e.id.includes('card'));

      if (headerBadge && circleA) {
        // Header badge bottom must be above circle top (circle cy - r = 260 - 110 = 150)
        const badgeBottom = (headerBadge.start?.y || 0) + (headerBadge.height || 0);
        const circleTop = (circleA.start?.y || 0) - (circleA.radius || 0);
        expect(badgeBottom).toBeLessThanOrEqual(circleTop);
      }

      if (circleA && footerCard) {
        // Circle bottom (260 + 110 = 370) must be above footer card top (410)
        const circleBottom = (circleA.start?.y || 0) + (circleA.radius || 0);
        const footerCardTop = footerCard.start?.y || 0;
        expect(circleBottom).toBeLessThanOrEqual(footerCardTop);
      }
    }
  });

  it('RoughRenderer auto-fit scales and centers drawings to utilize full screen instead of top-left corner', async () => {
    const { RoughRenderer } = await import('../src/renderer-rough');
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const renderer = new RoughRenderer(canvas);

    // Test auto-fit calculation for a 900x560 diagram on a 1920x1080 canvas
    const sampleStep = {
      step: 1,
      title: 'Test',
      elements: [
        { id: '1', type: 'rect' as const, color: '#fff', start: { x: 140, y: 65 }, width: 620, height: 410 },
      ],
    };

    const fit = (renderer as any).calculateAutoFit(sampleStep, 1920, 1080);
    // Should scale up (> 1.2x) to fill screen comfortably (not exceed maxScale 2.6)
    expect(fit.scale).toBeGreaterThan(1.2);
    expect(fit.scale).toBeLessThanOrEqual(2.6);
    // Should be centered with defined translation offsets
    expect(typeof fit.transX).toBe('number');
    expect(typeof fit.transY).toBe('number');
  });

  it('Universally retains conversation memory across diverse topics (e.g. physics, engineering, everyday science)', () => {
    // Turn 1 was about how a refrigerator works
    const priorPhysicsHistory = [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: 'explain how a refrigerator works',
        timestamp: Date.now() - 60000,
      },
      {
        id: 'msg-2',
        role: 'assistant' as const,
        content: 'A refrigerator works via compression and expansion cycles...',
        timestamp: Date.now() - 30000,
      },
    ];

    // Turn 2 follow-up asking about a specific part
    const followUp = orchestrator.deconstructPedagogy('why does the compressor get hot?', priorPhysicsHistory);
    expect(followUp.domain).toBe('physics');
    expect(followUp.concept.toLowerCase()).toContain('refrigerator');
    expect(followUp.progressionStages.length).toBe(4);

    // Turn 3 follow-up asking for everyday analogy
    const followUpSimpler = orchestrator.deconstructPedagogy('can you explain it simpler please?', priorPhysicsHistory);
    expect(followUpSimpler.domain).toBe('physics');
    expect(followUpSimpler.concept.toLowerCase()).toContain('refrigerator');
  });

  it('BlackboardView deduplicates elements and resolves overlapping bounding boxes into clean vertical tiers', async () => {
    const { BlackboardView } = await import('../src/views/BlackboardView');
    const view = new BlackboardView();

    // Simulated colliding elements output by an LLM with overlapping cards and focal elements
    const collidingElements = [
      // Title badge placed in focal area (y = 200)
      { id: 'badge_title', type: 'rect' as const, color: '#00f0ff', start: { x: 100, y: 200 }, width: 250, height: 50, text: 'Foundation Setup' },
      // Focal circle
      { id: 'focal_center', type: 'circle' as const, color: '#ff5555', start: { x: 450, y: 250 }, radius: 60, text: 'Core Mechanism' },
      // Summary card placed right over the focal circle (y = 250)
      { id: 'summary_card', type: 'rect' as const, color: '#50fa7b', start: { x: 250, y: 250 }, width: 400, height: 70, text: 'Key Takeaway Invariant' },
    ];

    const resolved = view.resolveElementOverlaps(collidingElements);

    const badge = resolved.find((e) => e.id === 'badge_title');
    const focal = resolved.find((e) => e.id === 'focal_center');
    const card = resolved.find((e) => e.id === 'summary_card');

    // Badge should be pulled up to Header Zone (y <= 120)
    expect(badge?.start?.y).toBeLessThanOrEqual(120);

    // Focal circle stays in center focal zone (y ~ 250)
    expect(focal?.start?.y).toBe(250);

    // Summary card should be pushed down into Footer Zone (y >= 400)
    expect(card?.start?.y).toBeGreaterThanOrEqual(400);
  });

  it('Layer 1 & 2: Accurately classifies Python function requests as software/algorithms and builds reusable machine blueprint', () => {
    const pyPedagogy = orchestrator.deconstructPedagogy('what is a function in python? what does it do? just the basics please');

    // Should NOT be classified as calculus geometry
    expect(pyPedagogy.domain).toBe('algorithms');
    expect(pyPedagogy.concept).toContain('Function');
    expect(pyPedagogy.coreIntuition).toContain('reusable machine');
    expect(pyPedagogy.coreIntuition).not.toContain('tangent');
    expect(pyPedagogy.coreIntuition).not.toContain('secant');

    // Verify milestones: Machine Mental Model -> Python def Syntax -> Reusability Contrast -> Execution Lifecycle
    expect(pyPedagogy.progressionStages[0].title).toContain('Machine');
    expect(pyPedagogy.progressionStages[1].title).toContain('Syntax');
    expect(pyPedagogy.progressionStages[2].title).toContain('Contrast');
    expect(pyPedagogy.progressionStages[3].title).toContain('Takeaway');

    // Verify Spatial Blueprint: Input hopper (left), Function machine (center), Output tray (right)
    const blueprint = orchestrator.architectSpatialBlueprint(pyPedagogy);
    expect(blueprint.stepBlueprints.length).toBe(4);
    const step1 = blueprint.stepBlueprints[0].elements;
    expect(step1.some((e) => e.id === 'input_hopper')).toBe(true);
    expect(step1.some((e) => e.id === 'function_box')).toBe(true);
    expect(step1.some((e) => e.id === 'output_tray')).toBe(true);
  });
});



