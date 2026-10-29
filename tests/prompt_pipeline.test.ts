import { describe, it, expect, vi } from 'vitest';
import { PromptPipeline } from '../src/services/PromptPipeline';
import { UNFOLD_SYSTEM_PROMPT, UNFOLD_VISION_SYSTEM_PROMPT } from '../src/services/prompts';
import { DrawingElement } from '../src/types';

describe('Unfold Master System Prompt & Proper Pipeline', () => {
  const pipeline = PromptPipeline.getInstance();

  describe('1. Master System Prompt Architecture & Directives', () => {
    it('enforces 3Blue1Brown & Feynman pedagogical philosophy', () => {
      expect(UNFOLD_SYSTEM_PROMPT).toContain('3BLUE1BROWN / FEYNMAN / KHAN ACADEMY STANDARD');
      expect(UNFOLD_SYSTEM_PROMPT).toContain('NEVER START WITH ABSTRACT FORMULAS');
      expect(UNFOLD_SYSTEM_PROMPT).toContain('STREAMED WHITEBOARD VIDEO');
      expect(UNFOLD_SYSTEM_PROMPT).toContain('CONVERSATIONAL TEACHER VOICE');
      expect(UNFOLD_SYSTEM_PROMPT).toContain('STRICTLY FORBIDDEN: Developer or engineering commands');
    });

    it('mandates the 4-scene continuous whiteboard pedagogy', () => {
      expect(UNFOLD_SYSTEM_PROMPT).toContain('MANDATORY 4-SCENE CONTINUOUS WHITEBOARD PEDAGOGY');
      expect(UNFOLD_SYSTEM_PROMPT).toContain('Scene 1: Visual Foundation & Spatial Anchor');
      expect(UNFOLD_SYSTEM_PROMPT).toContain('Scene 2: Core Concept in Action & Dynamic Transformation');
      expect(UNFOLD_SYSTEM_PROMPT).toContain('Scene 3: Comparative Contrast & Misconception Annihilation');
      expect(UNFOLD_SYSTEM_PROMPT).toContain('Scene 4: Universal Invariant, Governing Law & Definitive Takeaway');
    });

    it('enforces strict 900x560 canvas layout with non-overlapping vertical tiers', () => {
      expect(UNFOLD_SYSTEM_PROMPT).toContain('CANVAS GEOMETRY & SPATIAL ARCHITECTURE (Canvas: 900 x 560)');
      expect(UNFOLD_SYSTEM_PROMPT).toContain('TOP HEADER ZONE (Y: 65 to 120)');
      expect(UNFOLD_SYSTEM_PROMPT).toContain('CENTER FOCAL ZONE (Y: 150 to 390)');
      expect(UNFOLD_SYSTEM_PROMPT).toContain('BOTTOM FOOTER ZONE (Y: 415 to 480)');
      expect(UNFOLD_SYSTEM_PROMPT).toContain('HORIZONTAL SPREAD (X: 100 to 800)');
    });

    it('defines semantic color harmony tokens', () => {
      expect(UNFOLD_SYSTEM_PROMPT).toContain('#00f0ff'); // Cyan
      expect(UNFOLD_SYSTEM_PROMPT).toContain('#50fa7b'); // Emerald
      expect(UNFOLD_SYSTEM_PROMPT).toContain('#bd93f9'); // Violet
      expect(UNFOLD_SYSTEM_PROMPT).toContain('#ffb86c'); // Orange
      expect(UNFOLD_SYSTEM_PROMPT).toContain('#ff5555'); // Coral
      expect(UNFOLD_SYSTEM_PROMPT).toContain('#f8f8f2'); // Chalk White
    });

    it('includes multimodal screen-teach context directives', () => {
      expect(UNFOLD_SYSTEM_PROMPT).toContain('MULTIMODAL SCREEN CONTEXT (SCREEN TEACH MODE)');
      expect(UNFOLD_SYSTEM_PROMPT).toContain('Actively inspect the user\'s active screen');
      expect(UNFOLD_VISION_SYSTEM_PROMPT).toContain('screen tutor');
      expect(UNFOLD_VISION_SYSTEM_PROMPT).toContain('multimodal vision access');
    });

    it('enforces strict 3-phase generation pipeline output contract', () => {
      expect(UNFOLD_SYSTEM_PROMPT).toContain('STRICT 3-PHASE GENERATION PIPELINE');
      expect(UNFOLD_SYSTEM_PROMPT).toContain('PHASE 1: MULTI-LAYER DEEP REASONING (<reasoning> block)');
      expect(UNFOLD_SYSTEM_PROMPT).toContain('PHASE 2: PROGRESSIVE VISUAL LESSON (Markdown)');
      expect(UNFOLD_SYSTEM_PROMPT).toContain('PHASE 3: INTERACTIVE BLACKBOARD SPECIFICATION (JSON)');
    });
  });

  describe('2. Pipeline Stage 3: Master Prompt Compilation & Synthesis', () => {
    it('compiles master prompt incorporating pedagogy, spatial layout, and history', async () => {
      const { AgentOrchestrator } = await import('../src/services/AgentOrchestrator');
      const orchestrator = AgentOrchestrator.getInstance();

      const pedagogy = orchestrator.deconstructPedagogy('explain how a refrigerator works');
      const spatial = orchestrator.architectSpatialBlueprint(pedagogy);

      const compiledPrompt = pipeline.compileMasterPrompt(
        'explain how a refrigerator works',
        pedagogy,
        spatial,
        [
          { id: '1', role: 'user', content: 'hello', timestamp: Date.now() },
          { id: '2', role: 'assistant', content: 'Welcome to Unfold!', timestamp: Date.now() },
        ]
      );

      expect(compiledPrompt).toContain('[UNFOLD SYSTEM DIRECTIVE]');
      expect(compiledPrompt).toContain('3BLUE1BROWN / FEYNMAN');
      expect(compiledPrompt).toContain('[PEDAGOGICAL & SPATIAL REASONING BLUEPRINT]');
      expect(compiledPrompt).toContain('IDENTIFIED DOMAIN: PHYSICS');
      expect(compiledPrompt).toContain('UNIVERSAL 4-SCENE CONTINUOUS WHITEBOARD PEDAGOGY');
      expect(compiledPrompt).toContain('SPATIAL BLUEPRINT CONSTRAINTS (Canvas 900x560)');
      expect(compiledPrompt).toContain('ONGOING TUTORIAL DIALOGUE HISTORY');
    });

    it('switches to vision system prompt when screen image is attached', async () => {
      const { AgentOrchestrator } = await import('../src/services/AgentOrchestrator');
      const orchestrator = AgentOrchestrator.getInstance();

      const pedagogy = orchestrator.deconstructPedagogy('explain this diagram on my screen');
      const spatial = orchestrator.architectSpatialBlueprint(pedagogy);

      const compiledPrompt = pipeline.compileMasterPrompt(
        'explain this diagram on my screen',
        pedagogy,
        spatial,
        [],
        undefined,
        true // isScreenAttached
      );

      expect(compiledPrompt).toContain('multimodal vision access');
      expect(compiledPrompt).toContain('screen tutor');
    });

    it('allows custom user system prompt override from settings', async () => {
      const { AgentOrchestrator } = await import('../src/services/AgentOrchestrator');
      const orchestrator = AgentOrchestrator.getInstance();

      const pedagogy = orchestrator.deconstructPedagogy('teach me calculus');
      const spatial = orchestrator.architectSpatialBlueprint(pedagogy);

      const customPrompt = 'You are Professor Xavier, a telepathic teaching master.';
      const compiledPrompt = pipeline.compileMasterPrompt(
        'teach me calculus',
        pedagogy,
        spatial,
        [],
        customPrompt
      );

      expect(compiledPrompt).toContain('Professor Xavier');
      expect(compiledPrompt).not.toContain('3BLUE1BROWN / FEYNMAN / KHAN ACADEMY STANDARD');
    });
  });

  describe('3. Pipeline Stage 5: Element Normalization & Schema Validation', () => {
    it('normalizes element synonyms (box -> rect, point -> circle, vector -> arrow)', () => {
      const rawElements = [
        { id: 'b1', type: 'box', start: { x: 100, y: 150 }, width: 200, height: 100 },
        { id: 'p1', type: 'point', start: { x: 300, y: 250 }, radius: 20 },
        { id: 'v1', type: 'vector', start: { x: 300, y: 250 }, end: { x: 450, y: 250 } },
        { id: 't1', type: 'label', start: { x: 100, y: 80 }, text: 'Header Badge' },
      ];

      const normalized = pipeline.validateAndNormalizeElements(rawElements);

      expect(normalized[0].type).toBe('rect');
      expect(normalized[1].type).toBe('circle');
      expect(normalized[2].type).toBe('arrow');
      expect(normalized[3].type).toBe('text');
    });

    it('clamps out-of-bounds coordinates to safe canvas region [20, 880] x [40, 520]', () => {
      const rawElements = [
        { id: 'out1', type: 'rect', start: { x: -150, y: -200 }, width: 150, height: 80 },
        { id: 'out2', type: 'circle', start: { x: 1500, y: 999 }, radius: 30 },
      ];

      const normalized = pipeline.validateAndNormalizeElements(rawElements);

      expect(normalized[0].start.x).toBe(20);
      expect(normalized[0].start.y).toBe(40);
      expect(normalized[1].start.x).toBe(880);
      expect(normalized[1].start.y).toBe(520);
    });

    it('ensures zero-length arrows or lines receive visible separation', () => {
      const rawElements = [
        { id: 'zero_arrow', type: 'arrow', start: { x: 300, y: 300 }, end: { x: 300, y: 300 } },
      ];

      const normalized = pipeline.validateAndNormalizeElements(rawElements);

      expect(normalized[0].end?.x).toBeGreaterThan(normalized[0].start.x);
    });

    it('falls back to deterministic spatial blueprint when raw elements are empty or invalid', () => {
      const fallbackElements: DrawingElement[] = [
        { id: 'fb1', type: 'rect', color: '#00f0ff', strokeWidth: 2, start: { x: 150, y: 150 }, width: 100, height: 50 },
      ];

      const normalized = pipeline.validateAndNormalizeElements([], fallbackElements);

      expect(normalized).toEqual(fallbackElements);
    });
  });

  describe('4. Full Pipeline Execution Flow', () => {
    it('executes full pipeline with progress callbacks and returns rich metrics', async () => {
      const ipc = await import('../src/services/ipc');
      const mockSend = vi.spyOn(ipc, 'sendMessage').mockResolvedValue(`
<reasoning>
### Layer 1: Pedagogical Architecture
Anchor on the coordinate plane first, then show the tangent limit.
### Layer 2: Spatial Geometry
Center at (450, 260) with 900x560 canvas.
### Layer 3: Spoken Voice Scripting
Warm second-person address.
</reasoning>

# Understanding the Derivative

### Step 1: The Coordinate Anchor
Look at the board: we start with our curve y = f(x) and anchor our reference point P.

### Step 2: The Instantaneous Tangent Line
Now, notice how this magenta line touches our curve at exactly one point P.

### Step 3: Contrasting with a Secant Line
Notice the difference: an ordinary secant cuts through two distinct points.

### Step 4: The Derivative Invariant
Here is your definitive takeaway: the slope of the tangent is the derivative dy/dx!

\`\`\`json
{
  "reasoning": {
    "pedagogy": "Secant limit convergence to instantaneous rate",
    "spatial_layout": "Canvas 900x560",
    "color_palette": "Cyan, Violet, Emerald"
  },
  "steps": [
    {
      "step": 1,
      "title": "The Coordinate Anchor",
      "explanation": "Establish curve and point P",
      "elements": [
        { "id": "curve", "type": "path", "color": "#00f0ff", "start": { "x": 150, "y": 300 }, "d": "M 150 300 Q 400 100 700 300" }
      ]
    },
    {
      "step": 2,
      "title": "The Instantaneous Tangent Line",
      "explanation": "Show tangent line",
      "elements": [
        { "id": "tangent", "type": "line", "color": "#bd93f9", "start": { "x": 250, "y": 250 }, "end": { "x": 650, "y": 150 } }
      ]
    },
    {
      "step": 3,
      "title": "Contrasting with a Secant Line",
      "explanation": "Contrast secant",
      "elements": [
        { "id": "secant", "type": "line", "color": "#ffb86c", "start": { "x": 200, "y": 280 }, "end": { "x": 600, "y": 180 } }
      ]
    },
    {
      "step": 4,
      "title": "The Derivative Invariant",
      "explanation": "Present formula",
      "elements": [
        { "id": "formula_card", "type": "rect", "color": "#50fa7b", "start": { "x": 250, "y": 420 }, "width": 400, "height": 60, "text": "f'(x) = lim(h->0) [f(x+h)-f(x)]/h" }
      ]
    }
  ]
}
\`\`\`
      `);

      const progressUpdates: any[] = [];
      const result = await pipeline.execute(
        {
          userPrompt: 'what is a derivative',
          conversationId: 'test-pipe-1',
        },
        (status) => progressUpdates.push(status)
      );

      // Verify pipeline progress stages fired in proper sequence
      expect(progressUpdates.some((p) => p.stage === 'pedagogy')).toBe(true);
      expect(progressUpdates.some((p) => p.stage === 'spatial')).toBe(true);
      expect(progressUpdates.some((p) => p.stage === 'synthesis')).toBe(true);
      expect(progressUpdates.some((p) => p.stage === 'inference')).toBe(true);
      expect(progressUpdates.some((p) => p.stage === 'validation')).toBe(true);
      expect(progressUpdates.some((p) => p.stage === 'complete')).toBe(true);

      // Verify speech replacement: robotic developer imperatives replaced by warm teacher Markdown speech
      expect(result.plan.steps[0].explanation).toContain('Look at the board: we start with our curve');
      expect(result.plan.steps[1].explanation).toContain('Now, notice how this magenta line touches');

      // Verify execution metrics
      expect(result.executionMetrics.stepsGenerated).toBe(4);
      expect(result.executionMetrics.elementsValidated).toBeGreaterThan(0);
      expect(result.executionMetrics.totalDurationMs).toBeGreaterThanOrEqual(0);

      mockSend.mockRestore();
    });
  });
});
