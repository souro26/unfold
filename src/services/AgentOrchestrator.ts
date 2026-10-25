import { BlackboardStep, DrawingElement, Point } from '../types';
import { sendMessage } from './ipc';

export interface PedagogyMilestone {
  stageNumber: number;
  title: string;
  objective: string;
  narrationScript: string;
}

export interface PedagogySpec {
  concept: string;
  domain: 'mathematics' | 'algorithms' | 'systems' | 'physics' | 'general';
  coreIntuition: string;
  commonMisconceptions: string[];
  progressionStages: PedagogyMilestone[];
}

export interface SpatialBlueprint {
  coordinateFrame: {
    origin: Point;
    width: number;
    height: number;
    showAxes: boolean;
  };
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    auxiliary: string;
    highlight: string;
    text: string;
  };
  stepBlueprints: {
    stepNumber: number;
    title: string;
    explanation: string;
    elements: DrawingElement[];
  }[];
}

export interface AgentReasoningTrace {
  pedagogicalReasoning: string;
  spatialBlueprintReasoning: string;
  synthesisReasoning: string;
  finalPrompt: string;
}

export interface AgentProgressStatus {
  layer: 1 | 2 | 3;
  title: string;
  detail: string;
}

export interface AgentExecutionResult {
  plan: {
    steps: BlackboardStep[];
    reasoning?: any;
    rawJson?: string;
  };
  trace: AgentReasoningTrace;
  markdownResponse: string;
}

export class AgentOrchestrator {
  private static instance: AgentOrchestrator;

  public static getInstance(): AgentOrchestrator {
    if (!AgentOrchestrator.instance) {
      AgentOrchestrator.instance = new AgentOrchestrator();
    }
    return AgentOrchestrator.instance;
  }

  /**
   * Complete Multi-Layer Agent Pipeline executed behind the scenes.
   */
  public async executePipeline(
    userPrompt: string,
    conversationId: string,
    screenImageBase64?: string,
    onProgress?: (status: AgentProgressStatus) => void
  ): Promise<AgentExecutionResult> {
    const cleanPrompt = userPrompt.trim();

    // -------------------------------------------------------------
    // LAYER 1: Intent & Pedagogical Deconstruction Agent
    // -------------------------------------------------------------
    onProgress?.({
      layer: 1,
      title: 'Layer 1: Concept & Pedagogical Deconstruction',
      detail: 'Analyzing cognitive hurdles, mental models, and progressive learning milestones...',
    });

    // Small micro-delay allows UI to render the agent thinking state
    await new Promise((r) => setTimeout(r, 120));
    const pedagogy = this.deconstructPedagogy(cleanPrompt);

    // -------------------------------------------------------------
    // LAYER 2: Spatial Blueprint & Geometric Coordinate Agent
    // -------------------------------------------------------------
    onProgress?.({
      layer: 2,
      title: 'Layer 2: Spatial Blueprint & Coordinate Geometry',
      detail: 'Calculating 2D chalkboard layout, coordinate anchors, SVG paths, and color semantics...',
    });

    await new Promise((r) => setTimeout(r, 120));
    const spatialBlueprint = this.architectSpatialBlueprint(pedagogy);

    // -------------------------------------------------------------
    // LAYER 3: Master Drawing Prompt Synthesis & Compiler Agent
    // -------------------------------------------------------------
    onProgress?.({
      layer: 3,
      title: 'Layer 3: Drawing Agent Synthesis (Rough.js)',
      detail: 'Compiling structured execution plan and dispatching to drawing agent...',
    });

    const finalAgentPrompt = this.synthesizeDrawingPrompt(cleanPrompt, pedagogy, spatialBlueprint);

    const trace: AgentReasoningTrace = {
      pedagogicalReasoning: `Domain: ${pedagogy.domain.toUpperCase()}\nCore Intuition: ${pedagogy.coreIntuition}\nProgression:\n${pedagogy.progressionStages
        .map((s) => `  ${s.stageNumber}. ${s.title}: ${s.objective}`)
        .join('\n')}\nMisconceptions to Avoid:\n${pedagogy.commonMisconceptions.map((m) => `  - ${m}`).join('\n')}`,
      spatialBlueprintReasoning: `Canvas: 900x560, Origin at (${spatialBlueprint.coordinateFrame.origin.x}, ${spatialBlueprint.coordinateFrame.origin.y})\nColor Mapping:\n  Primary: ${spatialBlueprint.colorPalette.primary}\n  Secondary: ${spatialBlueprint.colorPalette.secondary}\n  Accent: ${spatialBlueprint.colorPalette.accent}\n  Highlight: ${spatialBlueprint.colorPalette.highlight}\nStep Layouts Generated: ${spatialBlueprint.stepBlueprints.length} visual blackboard scenes.`,
      synthesisReasoning: `Synthesized master drawing prompt fusing pedagogical progression with exact geometric constraints. Ready for organic Rough.js rendering.`,
      finalPrompt: finalAgentPrompt,
    };

    const rawResponse = await sendMessage(finalAgentPrompt, conversationId, screenImageBase64);

    // Parse the generated response
    const parsedPlan = this.parseAgentPlan(rawResponse, spatialBlueprint);

    return {
      plan: parsedPlan,
      trace,
      markdownResponse: rawResponse,
    };
  }

  // =========================================================================
  // LAYER 1: Pedagogical Deconstruction
  // =========================================================================
  public deconstructPedagogy(prompt: string): PedagogySpec {
    const p = prompt.toLowerCase();

    // 1. Classify domain
    let domain: PedagogySpec['domain'] = 'general';
    if (/(tangent|derivative|calculus|integral|curve|circle|geometry|triangle|vector|function|sine|cosine|math)/i.test(p)) {
      domain = 'mathematics';
    } else if (/(tree|binary|sort|recursion|algorithm|graph|stack|queue|hash|search|array|linked\s*list)/i.test(p)) {
      domain = 'algorithms';
    } else if (/(system|microservice|client|server|database|distributed|network|api|architecture|consensus)/i.test(p)) {
      domain = 'systems';
    } else if (/(velocity|force|gravity|quantum|energy|wave|physics|orbit|momentum)/i.test(p)) {
      domain = 'physics';
    }

    const topic = prompt
      .replace(/^(?:teach\s+me|explain|what\s+is|how\s+does|draw|show\s+me|visualize)\s+(?:about\s+|what\s+|how\s+)?/i, '')
      .replace(/[?!.]/g, '')
      .trim() || 'Concept Overview';

    if (domain === 'mathematics' && /tangent/i.test(p)) {
      return {
        concept: 'Tangent to a Curve / Circle',
        domain: 'mathematics',
        coreIntuition:
          'A tangent is the instantaneous direction of a curve at a single point of contact, formally reached as the limit of a secant line when two points converge to zero distance (Δx → 0). At that point, it is strictly perpendicular (90°) to the radius or normal vector.',
        commonMisconceptions: [
          'Confusing a tangent with a secant (thinking a tangent can cross through the interior).',
          'Believing tangents only exist for circles rather than any differentiable smooth curve.',
          'Missing the connection between the geometric tangent line and the physical velocity vector.',
        ],
        progressionStages: [
          {
            stageNumber: 1,
            title: 'The Curve & Secant Line',
            objective: 'Show the initial curve and a secant line cutting through two separate points P and Q.',
            narrationScript:
              'To understand a tangent, we must begin with a secant line. Notice how this line intersects our curve at two distinct points, P and Q.',
          },
          {
            stageNumber: 2,
            title: 'The Limiting Process (Δx → 0)',
            objective: 'Animate Q sliding down the curve toward P. Show the secant line rotating toward its limit.',
            narrationScript:
              'Now, imagine point Q sliding along the curve toward point P. As the horizontal distance delta x approaches zero, the secant line tilts closer to its boundary position.',
          },
          {
            stageNumber: 3,
            title: 'The Tangent Line Established',
            objective: 'Point Q merges with P into a single point of contact. The line touches the curve without crossing it.',
            narrationScript:
              'At the exact moment Q reaches P, our secant becomes a true tangent line. It touches the curve at exactly one point, capturing its instantaneous slope.',
          },
          {
            stageNumber: 4,
            title: 'Perpendicularity & Velocity Vector',
            objective: 'Draw the 90° right-angle marker to the radius/normal, and the tangential velocity vector.',
            narrationScript:
              'Here is the definitive takeaway: the tangent line forms a strict ninety-degree angle with the normal. In physics, if an object spinning in a circle is released, it flies off along this exact tangential velocity vector.',
          },
        ],
      };
    }

    if (domain === 'algorithms') {
      return {
        concept: topic,
        domain: 'algorithms',
        coreIntuition: `Algorithmic state transformation where structured data transitions deterministically across each operational step.`,
        commonMisconceptions: ['Overcomplicating the base condition', 'Losing track of pointer updates or call frames'],
        progressionStages: [
          {
            stageNumber: 1,
            title: 'Initial State & Input Setup',
            objective: 'Lay out the initial data structures and entry pointers.',
            narrationScript: `Let us begin with our initial state. Notice the structured elements arranged cleanly before processing begins.`,
          },
          {
            stageNumber: 2,
            title: 'Core Traversal & Decision Logic',
            objective: 'Highlight comparison steps, splits, or iterative transformations.',
            narrationScript: `In step two, the algorithm evaluates conditions and traverses the structure, narrowing down possibilities.`,
          },
          {
            stageNumber: 3,
            title: 'Resolution & Definitive Takeaway',
            objective: 'Show the finalized sorted or found state and computational complexity.',
            narrationScript: `Finally, our operation completes. The result is verified with optimal logarithmic or linear efficiency.`,
          },
        ],
      };
    }

    // General fallback pedagogy
    return {
      concept: topic,
      domain,
      coreIntuition: `Breaking ${topic} down from intuitive foundation to dynamic interaction and practical takeaway.`,
      commonMisconceptions: ['Abstracting without a concrete visual anchor'],
      progressionStages: [
        {
          stageNumber: 1,
          title: `Foundation: ${topic}`,
          objective: 'Establish the core visual metaphor and baseline entities.',
          narrationScript: `Welcome to our blackboard exploration of ${topic}. Let us look at the foundational components first.`,
        },
        {
          stageNumber: 2,
          title: 'Interaction & Mechanism',
          objective: 'Show relationships, dynamic connections, and causal arrows.',
          narrationScript: `Now, observe how these elements interact. The flow lines and directional markers demonstrate the underlying process.`,
        },
        {
          stageNumber: 3,
          title: 'Definitive Takeaway',
          objective: 'Summarize key principles, invariants, and practical real-world intuition.',
          narrationScript: `Here is the key takeaway: remember this central relationship whenever you work with ${topic}.`,
        },
      ],
    };
  }

  // =========================================================================
  // LAYER 2: Spatial Blueprint & Geometric Coordinate Layout
  // =========================================================================
  public architectSpatialBlueprint(pedagogy: PedagogySpec): SpatialBlueprint {
    const origin: Point = { x: 450, y: 280 };
    const palette = {
      primary: '#00f0ff', // Cyan (curves, primary entities)
      secondary: '#50fa7b', // Emerald (points of contact, active states)
      accent: '#bd93f9', // Violet/Purple (tangents, transformations)
      auxiliary: '#ffb86c', // Orange (radii, normals, secants)
      highlight: '#ff5555', // Coral (velocity vectors, key warnings)
      text: '#f8f8f2', // Crisp Chalk White
    };

    if (pedagogy.domain === 'mathematics' && /tangent/i.test(pedagogy.concept)) {
      return this.buildTangentSpatialBlueprint(origin, palette, pedagogy);
    }

    if (pedagogy.domain === 'algorithms') {
      return this.buildAlgorithmSpatialBlueprint(origin, palette, pedagogy);
    }

    return this.buildGeneralSpatialBlueprint(origin, palette, pedagogy);
  }

  private buildTangentSpatialBlueprint(origin: Point, palette: any, pedagogy: PedagogySpec): SpatialBlueprint {
    const cx = 440;
    const cy = 250;
    const r = 120;
    const px = cx;
    const py = cy - r; // Point of tangency at top apex (440, 130)

    // Step 1: Circle + Center + Secant Line through P and Q
    const qx1 = cx + 85;
    const qy1 = cy - Math.sqrt(r * r - 85 * 85); // Point Q on circle (approx 440+85, 250-84 = 166)

    const step1Elements: DrawingElement[] = [
      // Coordinate grid lines
      { id: 'axis_x', type: 'line', color: 'rgba(255,255,255,0.15)', strokeWidth: 1, start: { x: 120, y: cy }, end: { x: 760, y: cy } },
      { id: 'axis_y', type: 'line', color: 'rgba(255,255,255,0.15)', strokeWidth: 1, start: { x: cx, y: 50 }, end: { x: cx, y: 450 } },
      // Circle
      { id: 'circle_main', type: 'circle', color: palette.primary, strokeWidth: 3, start: { x: cx, y: cy }, radius: r },
      { id: 'center_dot', type: 'circle', color: palette.text, strokeWidth: 2, start: { x: cx, y: cy }, radius: 4, text: 'O (Center)' },
      // Point P (Apex)
      { id: 'pt_p', type: 'circle', color: palette.secondary, strokeWidth: 3, start: { x: px, y: py }, radius: 6, text: 'P (x₀, y₀)' },
      // Point Q (Secant point)
      { id: 'pt_q', type: 'circle', color: palette.auxiliary, strokeWidth: 3, start: { x: qx1, y: qy1 }, radius: 6, text: 'Q (x₀+Δx, y₀+Δy)' },
      // Secant Line cutting through P and Q
      { id: 'secant_line', type: 'line', color: palette.auxiliary, strokeWidth: 2.5, start: { x: px - 80, y: py - 24 }, end: { x: qx1 + 100, y: qy1 + 30 }, text: 'Secant Line' },
      // Info card
      { id: 'badge_1', type: 'rect', color: 'rgba(255, 184, 108, 0.2)', fill: 'rgba(255, 184, 108, 0.08)', strokeWidth: 1.5, start: { x: 120, y: 70 }, width: 220, height: 60, text: 'Secant cuts at 2 points' },
    ];

    // Step 2: Q sliding toward P (Δx -> 0)
    const qx2 = cx + 35;
    const qy2 = cy - Math.sqrt(r * r - 35 * 35);
    const step2Elements: DrawingElement[] = [
      { id: 'axis_x', type: 'line', color: 'rgba(255,255,255,0.15)', strokeWidth: 1, start: { x: 120, y: cy }, end: { x: 760, y: cy } },
      { id: 'axis_y', type: 'line', color: 'rgba(255,255,255,0.15)', strokeWidth: 1, start: { x: cx, y: 50 }, end: { x: cx, y: 450 } },
      { id: 'circle_main', type: 'circle', color: palette.primary, strokeWidth: 3, start: { x: cx, y: cy }, radius: r },
      { id: 'center_dot', type: 'circle', color: palette.text, strokeWidth: 2, start: { x: cx, y: cy }, radius: 4, text: 'O' },
      { id: 'pt_p', type: 'circle', color: palette.secondary, strokeWidth: 3, start: { x: px, y: py }, radius: 6, text: 'P' },
      { id: 'pt_q2', type: 'circle', color: palette.auxiliary, strokeWidth: 3, start: { x: qx2, y: qy2 }, radius: 6, text: 'Q → P' },
      // Arrow showing motion Q -> P
      { id: 'motion_arrow', type: 'arrow', color: palette.highlight, strokeWidth: 2, start: { x: qx1, y: qy1 - 15 }, end: { x: qx2 + 10, y: qy2 - 10 } },
      // Tilting Secant line
      { id: 'secant_line_2', type: 'line', color: palette.auxiliary, strokeWidth: 2.5, start: { x: px - 120, y: py - 12 }, end: { x: qx2 + 140, y: qy2 + 14 }, text: 'Tilting towards Tangent' },
      { id: 'badge_2', type: 'rect', color: 'rgba(80, 250, 123, 0.2)', fill: 'rgba(80, 250, 123, 0.08)', strokeWidth: 1.5, start: { x: 120, y: 70 }, width: 230, height: 60, text: 'Limit: Δx → 0' },
    ];

    // Step 3: True Tangent Line at P
    const step3Elements: DrawingElement[] = [
      { id: 'axis_x', type: 'line', color: 'rgba(255,255,255,0.15)', strokeWidth: 1, start: { x: 120, y: cy }, end: { x: 760, y: cy } },
      { id: 'axis_y', type: 'line', color: 'rgba(255,255,255,0.15)', strokeWidth: 1, start: { x: cx, y: 50 }, end: { x: cx, y: 450 } },
      { id: 'circle_main', type: 'circle', color: palette.primary, strokeWidth: 3, start: { x: cx, y: cy }, radius: r },
      { id: 'center_dot', type: 'circle', color: palette.text, strokeWidth: 2, start: { x: cx, y: cy }, radius: 4, text: 'O' },
      // Radius line O -> P
      { id: 'radius_line', type: 'line', color: palette.auxiliary, strokeWidth: 2.5, start: { x: cx, y: cy }, end: { x: px, y: py }, text: 'Radius r' },
      // Tangent point P
      { id: 'pt_p', type: 'circle', color: palette.secondary, strokeWidth: 4, start: { x: px, y: py }, radius: 7, text: 'Point of Contact P' },
      // True horizontal Tangent Line
      { id: 'tangent_line', type: 'line', color: palette.accent, strokeWidth: 3.5, start: { x: px - 240, y: py }, end: { x: px + 240, y: py }, text: 'Tangent Line T(x)' },
      // 90 degree marker
      { id: 'right_angle', type: 'path', color: palette.secondary, strokeWidth: 2, d: `M ${px - 14} ${py} L ${px - 14} ${py + 14} L ${px} ${py + 14}` },
      { id: 'badge_3', type: 'rect', color: 'rgba(189, 147, 249, 0.25)', fill: 'rgba(189, 147, 249, 0.1)', strokeWidth: 1.5, start: { x: 100, y: 70 }, width: 250, height: 60, text: 'Touches at exactly ONE point' },
    ];

    // Step 4: Perpendicularity & Physical Velocity Vector
    const step4Elements: DrawingElement[] = [
      { id: 'axis_x', type: 'line', color: 'rgba(255,255,255,0.15)', strokeWidth: 1, start: { x: 120, y: cy }, end: { x: 760, y: cy } },
      { id: 'axis_y', type: 'line', color: 'rgba(255,255,255,0.15)', strokeWidth: 1, start: { x: cx, y: 50 }, end: { x: cx, y: 450 } },
      { id: 'circle_main', type: 'circle', color: palette.primary, strokeWidth: 3, start: { x: cx, y: cy }, radius: r },
      { id: 'radius_line', type: 'line', color: palette.auxiliary, strokeWidth: 2.5, start: { x: cx, y: cy }, end: { x: px, y: py }, text: 'Radius ⊥ Tangent' },
      { id: 'tangent_line', type: 'line', color: palette.accent, strokeWidth: 3, start: { x: px - 220, y: py }, end: { x: px + 220, y: py } },
      { id: 'right_angle', type: 'path', color: palette.secondary, strokeWidth: 2, d: `M ${px - 14} ${py} L ${px - 14} ${py + 14} L ${px} ${py + 14}` },
      // Tangential velocity vector
      { id: 'vel_vector', type: 'arrow', color: palette.highlight, strokeWidth: 4, start: { x: px, y: py }, end: { x: px + 180, y: py }, text: 'Velocity v⃗' },
      { id: 'pt_p', type: 'circle', color: palette.secondary, strokeWidth: 4, start: { x: px, y: py }, radius: 7 },
      // Definitive Formula Card
      { id: 'formula_card', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.1)', strokeWidth: 2, start: { x: 530, y: 350 }, width: 260, height: 80, text: 'Slope m = dy/dx = f\'(x₀)' },
      { id: 'text_rule', type: 'text', color: palette.text, strokeWidth: 2, start: { x: 540, y: 410 }, text: 'Angle: θ = 90° to Normal' },
    ];

    return {
      coordinateFrame: { origin, width: 900, height: 560, showAxes: true },
      colorPalette: palette,
      stepBlueprints: [
        { stepNumber: 1, title: pedagogy.progressionStages[0].title, explanation: pedagogy.progressionStages[0].narrationScript, elements: step1Elements },
        { stepNumber: 2, title: pedagogy.progressionStages[1].title, explanation: pedagogy.progressionStages[1].narrationScript, elements: step2Elements },
        { stepNumber: 3, title: pedagogy.progressionStages[2].title, explanation: pedagogy.progressionStages[2].narrationScript, elements: step3Elements },
        { stepNumber: 4, title: pedagogy.progressionStages[3].title, explanation: pedagogy.progressionStages[3].narrationScript, elements: step4Elements },
      ],
    };
  }

  private buildAlgorithmSpatialBlueprint(origin: Point, palette: any, pedagogy: PedagogySpec): SpatialBlueprint {
    const rootX = 450;
    const rootY = 120;

    const step1: DrawingElement[] = [
      { id: 't_root', type: 'circle', color: palette.primary, strokeWidth: 3, start: { x: rootX, y: rootY }, radius: 45, text: 'Root [50]' },
      { id: 't_l1', type: 'circle', color: palette.auxiliary, strokeWidth: 2.5, start: { x: rootX - 140, y: rootY + 120 }, radius: 40, text: 'Left [25]' },
      { id: 't_r1', type: 'circle', color: palette.auxiliary, strokeWidth: 2.5, start: { x: rootX + 140, y: rootY + 120 }, radius: 40, text: 'Right [75]' },
      { id: 'edge_l', type: 'arrow', color: 'rgba(255,255,255,0.4)', strokeWidth: 2, start: { x: rootX - 25, y: rootY + 35 }, end: { x: rootX - 110, y: rootY + 95 } },
      { id: 'edge_r', type: 'arrow', color: 'rgba(255,255,255,0.4)', strokeWidth: 2, start: { x: rootX + 25, y: rootY + 35 }, end: { x: rootX + 110, y: rootY + 95 } },
      { id: 'badge_info', type: 'rect', color: palette.primary, fill: 'rgba(0, 240, 255, 0.08)', strokeWidth: 1.5, start: { x: 100, y: 70 }, width: 220, height: 60, text: 'Binary Hierarchy Setup' },
    ];

    const step2: DrawingElement[] = [
      ...step1,
      { id: 'active_query', type: 'circle', color: palette.highlight, strokeWidth: 3.5, start: { x: rootX - 140, y: rootY + 120 }, radius: 48, text: 'Target [25]' },
      { id: 'decision_badge', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.1)', strokeWidth: 2, start: { x: 100, y: 220 }, width: 240, height: 70, text: 'Query 25 < 50 → Go Left' },
    ];

    const step3: DrawingElement[] = [
      ...step2,
      { id: 'found_card', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.15)', strokeWidth: 2, start: { x: 310, y: 380 }, width: 280, height: 80, text: 'Node Matched! Time: O(log N)' },
    ];

    return {
      coordinateFrame: { origin, width: 900, height: 560, showAxes: false },
      colorPalette: palette,
      stepBlueprints: [
        { stepNumber: 1, title: pedagogy.progressionStages[0]?.title || 'Initial State', explanation: pedagogy.progressionStages[0]?.narrationScript || '', elements: step1 },
        { stepNumber: 2, title: pedagogy.progressionStages[1]?.title || 'Traversal', explanation: pedagogy.progressionStages[1]?.narrationScript || '', elements: step2 },
        { stepNumber: 3, title: pedagogy.progressionStages[2]?.title || 'Resolution', explanation: pedagogy.progressionStages[2]?.narrationScript || '', elements: step3 },
      ],
    };
  }

  private buildGeneralSpatialBlueprint(origin: Point, palette: any, pedagogy: PedagogySpec): SpatialBlueprint {
    const cx = 450;
    const cy = 250;

    const step1: DrawingElement[] = [
      { id: 'box_a', type: 'rect', color: palette.primary, strokeWidth: 2.5, start: { x: cx - 240, y: cy - 70 }, width: 200, height: 140, text: 'Core Foundation' },
      { id: 'box_b', type: 'rect', color: palette.secondary, strokeWidth: 2.5, start: { x: cx + 40, y: cy - 70 }, width: 200, height: 140, text: 'Interacting Target' },
      { id: 'flow_arrow', type: 'arrow', color: palette.accent, strokeWidth: 3, start: { x: cx - 40, y: cy }, end: { x: cx + 40, y: cy }, text: 'Relationship' },
    ];

    const step2: DrawingElement[] = [
      ...step1,
      { id: 'center_hub', type: 'circle', color: palette.highlight, strokeWidth: 3, start: { x: cx, y: cy + 120 }, radius: 55, text: 'Mechanism' },
      { id: 'hub_arrow1', type: 'arrow', color: palette.auxiliary, strokeWidth: 2, start: { x: cx - 140, y: cy + 70 }, end: { x: cx - 45, y: cy + 105 } },
      { id: 'hub_arrow2', type: 'arrow', color: palette.auxiliary, strokeWidth: 2, start: { x: cx + 45, y: cy + 105 }, end: { x: cx + 140, y: cy + 70 } },
    ];

    const step3: DrawingElement[] = [
      ...step2,
      { id: 'summary_card', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.1)', strokeWidth: 2, start: { x: cx - 220, y: cy - 180 }, width: 440, height: 60, text: 'Definitive Takeaway Rule' },
    ];

    return {
      coordinateFrame: { origin, width: 900, height: 560, showAxes: false },
      colorPalette: palette,
      stepBlueprints: [
        { stepNumber: 1, title: pedagogy.progressionStages[0]?.title || 'Foundation', explanation: pedagogy.progressionStages[0]?.narrationScript || '', elements: step1 },
        { stepNumber: 2, title: pedagogy.progressionStages[1]?.title || 'Mechanism', explanation: pedagogy.progressionStages[1]?.narrationScript || '', elements: step2 },
        { stepNumber: 3, title: pedagogy.progressionStages[2]?.title || 'Takeaway', explanation: pedagogy.progressionStages[2]?.narrationScript || '', elements: step3 },
      ],
    };
  }

  // =========================================================================
  // LAYER 3: Master Drawing Prompt Synthesis
  // =========================================================================
  public synthesizeDrawingPrompt(rawPrompt: string, pedagogy: PedagogySpec, spatial: SpatialBlueprint): string {
    const layoutOverview = spatial.stepBlueprints
      .map(
        (s) => `Step ${s.stepNumber} [${s.title}]: ${s.elements.length} geometric entities planned (${s.elements.map((e) => e.type).join(', ')})`
      )
      .join('\n');

    return `[UNFOLD MULTI-LAYER REASONING TRACE]
The pedagogical reasoner and spatial architect have completed analysis of the learner's request.

LEARNER REQUEST: "${rawPrompt}"
IDENTIFIED DOMAIN: ${pedagogy.domain.toUpperCase()}
CORE MENTAL MODEL: ${pedagogy.coreIntuition}

PEDAGOGICAL PROGRESSION:
${pedagogy.progressionStages.map((p) => `${p.stageNumber}. ${p.title} -> ${p.objective}`).join('\n')}

SPATIAL BLUEPRINT CONSTRAINTS (Canvas 900x560):
- Origin: (${spatial.coordinateFrame.origin.x}, ${spatial.coordinateFrame.origin.y})
- Semantic Color Palette: Cyan (${spatial.colorPalette.primary}), Emerald (${spatial.colorPalette.secondary}), Violet (${spatial.colorPalette.accent}), Orange (${spatial.colorPalette.auxiliary}), Coral (${spatial.colorPalette.highlight})
- Planned Layout Sequence:
${layoutOverview}

INSTRUCTIONS FOR DRAWING AGENT:
1. Deliver a brilliant, crystal-clear visual explanation following the exact progression above.
2. Output your reasoning in a <reasoning> block detailing your mathematical/spatial choices.
3. Write clean, natural spoken scripts for each step in Markdown headers (### Step 1: ..., ### Step 2: ...).
4. Output a verified, executable \`\`\`json block adhering to the spatial coordinate layout.
Every step MUST contain geometric elements ("rect", "circle", "line", "arrow", "path", "text") with explicit coordinates, colors, and concise text labels.`;
  }

  // =========================================================================
  // Execution & Plan Parser
  // =========================================================================
  private parseAgentPlan(
    response: string,
    fallbackSpatial: SpatialBlueprint
  ): { steps: BlackboardStep[]; reasoning?: any; rawJson?: string } {
    let extractedReasoning: any = null;
    const reasoningMatch = response.match(/<(?:reasoning|thought)>([\s\S]*?)<\/(?:reasoning|thought)>/i);
    if (reasoningMatch) {
      extractedReasoning = {
        pedagogicalStrategy: reasoningMatch[1].trim(),
        spatialArchitecture: 'Synthesized Multi-Layer Agent CoT',
      };
    }

    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const rawJson = jsonMatch[1].trim();
        const parsed = JSON.parse(rawJson);
        const stepsList = Array.isArray(parsed) ? parsed : parsed.steps || [];
        if (stepsList.length > 0) {
          const steps: BlackboardStep[] = stepsList.map((s: any, idx: number) => ({
            step: s.step || idx + 1,
            title: s.title || `Step ${idx + 1}`,
            explanation: s.explanation || s.description || '',
            elements: (s.elements && s.elements.length > 0) ? s.elements : fallbackSpatial.stepBlueprints[idx]?.elements || [],
          }));

          return {
            steps,
            reasoning: parsed.reasoning || extractedReasoning,
            rawJson,
          };
        }
      } catch (err) {
        console.warn('Failed to parse AI JSON, falling back to spatial blueprint:', err);
      }
    }

    // Direct fallback to spatial blueprint
    return {
      steps: fallbackSpatial.stepBlueprints.map((s) => ({
        step: s.stepNumber,
        title: s.title,
        explanation: s.explanation,
        elements: s.elements,
      })),
      reasoning: extractedReasoning,
      rawJson: JSON.stringify(fallbackSpatial.stepBlueprints, null, 2),
    };
  }

  public compileDirectVerifiedPlan(
    _prompt: string,
    pedagogy: PedagogySpec,
    spatial: SpatialBlueprint,
    trace: AgentReasoningTrace
  ): AgentExecutionResult {
    const steps: BlackboardStep[] = spatial.stepBlueprints.map((s) => ({
      step: s.stepNumber,
      title: s.title,
      explanation: s.explanation,
      elements: s.elements,
    }));

    const markdown = `# ${pedagogy.concept}\n\n${pedagogy.coreIntuition}\n\n` +
      steps.map((s) => `### Step ${s.step}: ${s.title}\n${s.explanation}\n`).join('\n\n');

    return {
      plan: {
        steps,
        reasoning: {
          pedagogy: pedagogy.coreIntuition,
          spatial_layout: trace.spatialBlueprintReasoning,
        },
        rawJson: JSON.stringify(steps, null, 2),
      },
      trace,
      markdownResponse: markdown,
    };
  }
}
