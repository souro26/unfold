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
    if (/(tangent|derivative|calculus|integral|curve|circle|geometry|triangle|vector|function|sine|cosine|math|algebra|matrix|tensor|parabola)/i.test(p)) {
      domain = 'mathematics';
    } else if (/(tree|binary|sort|recursion|algorithm|graph|stack|queue|hash|search|array|linked\s*list|dynamic\s*programming|heap)/i.test(p)) {
      domain = 'algorithms';
    } else if (/(system|microservice|client|server|database|distributed|network|api|architecture|consensus|cache|docker|kubernetes|raft|paxos|failover)/i.test(p)) {
      domain = 'systems';
    } else if (/(velocity|force|gravity|quantum|energy|wave|physics|orbit|momentum|newton|motion|acceleration|friction|thermodynamics)/i.test(p)) {
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
            title: 'The Circle & Point on Boundary',
            objective: 'Draw the circle with center O, radius r, and select point of contact P.',
            narrationScript:
              'To understand what a tangent is, we start with a circle centered at point O with radius r, and mark a point P on its boundary.',
          },
          {
            stageNumber: 2,
            title: 'The Tangent Line (Touches at One Point)',
            objective: 'Draw a straight line that touches the circle at one and only one exact point P.',
            narrationScript:
              'By definition, a tangent is a straight line that touches the circle at one and only one point. Notice line T: it touches point P without cutting inside the circle.',
          },
          {
            stageNumber: 3,
            title: 'Secant vs Tangent vs Exterior Line',
            objective: 'Contrast the tangent with a secant line (cutting 2 points) and an exterior line (0 points).',
            narrationScript:
              'Notice what makes a tangent special. A secant line cuts through at two points. An exterior line never touches at all. The tangent is the unique boundary line that touches at exactly point P.',
          },
          {
            stageNumber: 4,
            title: 'Perpendicularity & Tangential Velocity',
            objective: 'Demonstrate the 90° right angle to the radius and tangential velocity vector.',
            narrationScript:
              'Here is the key rule: the tangent is always strictly perpendicular—at ninety degrees—to the radius at point P. In physics, if a spinning object is released, it flies off along this exact tangential velocity vector.',
          },
        ],
      };
    }

    if (domain === 'mathematics') {
      return {
        concept: topic,
        domain: 'mathematics',
        coreIntuition: `Mathematical geometry and calculus deconstructed from foundational axes and baseline curves, through instantaneous transformation, contrast against average secant chords, to universal derivative and geometric invariants.`,
        commonMisconceptions: [
          'Confusing instantaneous rates of change with average secant intervals',
          'Missing the perpendicularity relationship between tangential vectors and radial normal vectors',
        ],
        progressionStages: [
          {
            stageNumber: 1,
            title: `Foundation: ${topic} & Coordinate System`,
            objective: `Draw the baseline coordinate axes, origin anchor, and initial ${topic} curve or geometric shape.`,
            narrationScript: `To understand ${topic}, we establish our coordinate frame and draw the primary baseline curve. Notice our anchor point clearly marked before any transformations occur.`,
          },
          {
            stageNumber: 2,
            title: `Core Operation: Active ${topic} Definition`,
            objective: `Draw the exact instantaneous line, rate of change, or geometric entity touching at a single point.`,
            narrationScript: `Now, observe the core definition of ${topic} in action. We draw the exact entity touching our curve at one exact point, capturing its instantaneous direction.`,
          },
          {
            stageNumber: 3,
            title: 'Critical Contrast: Secant Chord vs Instantaneous Tangent',
            objective: 'Contrast the single-point tangent with a 2-point secant line to demonstrate the limiting process as Δx approaches zero.',
            narrationScript: `Notice what makes this unique: an ordinary secant line cuts through two separate points. As the distance between those points shrinks to zero, the secant converges into our unique tangent.`,
          },
          {
            stageNumber: 4,
            title: 'Universal Invariant & Formula Card',
            objective: 'Demonstrate perpendicularity (90° right angle), physical velocity vector, and the fundamental limit equation.',
            narrationScript: `Here is the definitive takeaway: the tangent is strictly perpendicular to the normal radius, yielding the instantaneous slope m = dy/dx and the direction of physical velocity.`,
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
            title: `Initial State & Data Hierarchy: ${topic}`,
            objective: 'Lay out the initial data structures, unmutated elements, and entry pointers.',
            narrationScript: `Let us begin with our initial state for ${topic}. Notice the structured elements arranged cleanly before processing begins.`,
          },
          {
            stageNumber: 2,
            title: 'Core Traversal & Operational Decision',
            objective: 'Highlight comparison steps, active pointers, splits, or iterative transformations.',
            narrationScript: `In step two, the algorithm evaluates conditions and traverses the structure, narrowing down possibilities with active pointers.`,
          },
          {
            stageNumber: 3,
            title: 'Critical Contrast: Optimal Path vs Worst-Case Edge Cases',
            objective: 'Contrast the efficient traversal path against worst-case unpartitioned structures or search misses.',
            narrationScript: `Notice the critical distinction: an unbalanced branch degrades performance, while our structured division eliminates half the search space at every step.`,
          },
          {
            stageNumber: 4,
            title: 'Resolution & Big-O Computational Invariant',
            objective: 'Show the finalized sorted or found state and computational complexity guarantee card.',
            narrationScript: `Finally, our operation completes. The result is verified with optimal logarithmic or linear efficiency, giving us our definitive algorithmic guarantee.`,
          },
        ],
      };
    }

    if (domain === 'physics') {
      return {
        concept: topic,
        domain: 'physics',
        coreIntuition: `Physical forces and conservation laws acting dynamically on bodies within an inertial reference frame.`,
        commonMisconceptions: ['Confusing velocity with acceleration', 'Believing motion requires a continuous net force rather than inertia'],
        progressionStages: [
          {
            stageNumber: 1,
            title: `Physical Anchor & Reference Plane: ${topic}`,
            objective: 'Draw the baseline coordinate surface, mass m, and resting equilibrium state.',
            narrationScript: `To understand ${topic}, we establish our physical reference plane and place our mass at its resting equilibrium anchor.`,
          },
          {
            stageNumber: 2,
            title: 'Applied Force & Dynamic Motion Vector',
            objective: 'Draw the applied force vector F, velocity arrow v, and direction of displacement.',
            narrationScript: `Now, observe the primary physical force in action. The directional vector arrows show the magnitude and orientation of applied energy.`,
          },
          {
            stageNumber: 3,
            title: 'Critical Contrast: Equilibrium vs Net Acceleration',
            objective: 'Contrast balanced equilibrium forces (ΣF = 0) against net unbalanced acceleration and opposing friction.',
            narrationScript: `Notice what governs motion: when opposing forces balance out, velocity stays constant. When net force is unbalanced, the mass accelerates in the direction of the resultant vector.`,
          },
          {
            stageNumber: 4,
            title: 'Universal Law & Governing Equation Card',
            objective: 'Display the governing law (F = ma / Conservation), energy balance, and physical takeaway.',
            narrationScript: `Here is the core law: net force directly determines mass acceleration, preserving momentum across the entire physical system.`,
          },
        ],
      };
    }

    if (domain === 'systems') {
      return {
        concept: topic,
        domain: 'systems',
        coreIntuition: `Distributed architectural topologies coordinating reliable communication, data consistency, and fault tolerance.`,
        commonMisconceptions: ['Assuming zero-latency networks', 'Neglecting boundary isolation and failover paths'],
        progressionStages: [
          {
            stageNumber: 1,
            title: `Architectural Baseline & Node Topology: ${topic}`,
            objective: 'Draw the client interface, API gateway, and baseline service boundary nodes.',
            narrationScript: `Let us begin with our baseline system topology for ${topic}. Notice the distinct service nodes and storage boundaries cleanly separated.`,
          },
          {
            stageNumber: 2,
            title: 'Active Request & Message Protocol Flow',
            objective: 'Draw directional request payloads, RPC communication channels, and active queue processing.',
            narrationScript: `Now, trace the active request flow. Incoming payloads are routed seamlessly through the pipeline to ensure decoupled processing.`,
          },
          {
            stageNumber: 3,
            title: 'Critical Contrast: Low-Latency Hit vs Failover Isolation',
            objective: 'Contrast normal cached low-latency paths against network partition, timeout, and circuit breaker fallbacks.',
            narrationScript: `Notice how resilience is maintained: when a primary node suffers latency, circuit breakers isolate the fault and gracefully route traffic to replicas.`,
          },
          {
            stageNumber: 4,
            title: 'System Invariant & SLA Guarantee Card',
            objective: 'Display consistency guarantees (ACID / CAP theorem), high-availability metrics, and architectural takeaway.',
            narrationScript: `Here is the architectural takeaway: robust boundary isolation ensures continuous availability and predictable sub-millisecond response times.`,
          },
        ],
      };
    }

    // General fallback pedagogy (Strict 4-Scene Progressive Sequence)
    return {
      concept: topic,
      domain,
      coreIntuition: `Breaking ${topic} down from intuitive foundation to dynamic interaction, comparative contrast, and practical takeaway.`,
      commonMisconceptions: ['Abstracting without a concrete visual anchor', 'Confusing primary mechanisms with secondary side effects'],
      progressionStages: [
        {
          stageNumber: 1,
          title: `Visual Foundation: ${topic} Setup`,
          objective: 'Establish the core visual metaphor and baseline anchor entities.',
          narrationScript: `Welcome to our blackboard exploration of ${topic}. Let us look at the foundational components first.`,
        },
        {
          stageNumber: 2,
          title: `The Core Mechanism: ${topic} in Action`,
          objective: 'Show direct relationships, dynamic connections, and causal operational arrows.',
          narrationScript: `Now, observe the core mechanism in action. The flow lines and directional markers demonstrate the underlying process.`,
        },
        {
          stageNumber: 3,
          title: 'Critical Contrast: Misconceptions & Edge Cases',
          objective: 'Juxtapose against common misconceptions, alternative states, and failure modes.',
          narrationScript: `Notice the critical distinction: contrasting the true mechanism against common misconceptions reveals what makes ${topic} uniquely effective.`,
        },
        {
          stageNumber: 4,
          title: 'Definitive Takeaway & Core Rule Card',
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

    if (pedagogy.domain === 'mathematics') {
      return this.buildMathSpatialBlueprint(origin, palette, pedagogy);
    }

    if (pedagogy.domain === 'algorithms') {
      return this.buildAlgorithmSpatialBlueprint(origin, palette, pedagogy);
    }

    if (pedagogy.domain === 'physics') {
      return this.buildPhysicsSpatialBlueprint(origin, palette, pedagogy);
    }

    if (pedagogy.domain === 'systems') {
      return this.buildSystemsSpatialBlueprint(origin, palette, pedagogy);
    }

    return this.buildGeneralSpatialBlueprint(origin, palette, pedagogy);
  }

  private buildTangentSpatialBlueprint(origin: Point, palette: any, pedagogy: PedagogySpec): SpatialBlueprint {
    const cx = 440;
    const cy = 250;
    const r = 120;
    const px = cx;
    const py = cy - r; // Point of tangency at top apex (440, 130)

    // Scene 1: Circle with Center O, Radius r, and Point of Contact P on boundary
    const step1Elements: DrawingElement[] = [
      { id: 'axis_x', type: 'line', color: 'rgba(255,255,255,0.12)', strokeWidth: 1, start: { x: 120, y: cy }, end: { x: 760, y: cy } },
      { id: 'axis_y', type: 'line', color: 'rgba(255,255,255,0.12)', strokeWidth: 1, start: { x: cx, y: 50 }, end: { x: cx, y: 450 } },
      // Circle
      { id: 'circle_main', type: 'circle', color: palette.primary, strokeWidth: 3, start: { x: cx, y: cy }, radius: r },
      { id: 'center_dot', type: 'circle', color: palette.text, strokeWidth: 2, start: { x: cx, y: cy }, radius: 4, text: 'Center O' },
      // Radius line O -> P
      { id: 'radius_line', type: 'line', color: palette.auxiliary, strokeWidth: 2.5, start: { x: cx, y: cy }, end: { x: px, y: py }, text: 'Radius r' },
      // Point P on circumference
      { id: 'pt_p', type: 'circle', color: palette.secondary, strokeWidth: 4, start: { x: px, y: py }, radius: 7, text: 'Point of Contact P' },
      // Title badge
      { id: 'badge_1', type: 'rect', color: palette.primary, fill: 'rgba(0, 240, 255, 0.08)', strokeWidth: 1.5, start: { x: 100, y: 70 }, width: 250, height: 60, text: 'Circle with Center O and Radius r' },
    ];

    // Scene 2: The Tangent Line (Touches at One and Only One Point)
    const step2Elements: DrawingElement[] = [
      ...step1Elements,
      // Tangent line touching apex P (horizontal line through P)
      { id: 'tangent_line', type: 'line', color: palette.accent, strokeWidth: 3.5, start: { x: px - 250, y: py }, end: { x: px + 250, y: py }, text: 'Tangent Line T' },
      // Highlight contact point P
      { id: 'pt_p_active', type: 'circle', color: palette.secondary, strokeWidth: 4, start: { x: px, y: py }, radius: 8 },
      // Badge: Definition of Tangent
      { id: 'badge_2', type: 'rect', color: palette.accent, fill: 'rgba(189, 147, 249, 0.12)', strokeWidth: 2, start: { x: 520, y: 70 }, width: 280, height: 65, text: 'Touches at ONE and ONLY ONE point' },
    ];

    // Scene 3: Secant vs Tangent vs Exterior Line
    const step3Elements: DrawingElement[] = [
      ...step2Elements,
      // Secant line cutting through two points
      { id: 'secant_line', type: 'line', color: palette.auxiliary, strokeWidth: 2.5, start: { x: px - 180, y: cy - 40 }, end: { x: px + 180, y: cy - 40 }, text: 'Secant Line: cuts at 2 points' },
      { id: 'sec_pt1', type: 'circle', color: palette.auxiliary, strokeWidth: 2, start: { x: px - 113, y: cy - 40 }, radius: 4 },
      { id: 'sec_pt2', type: 'circle', color: palette.auxiliary, strokeWidth: 2, start: { x: px + 113, y: cy - 40 }, radius: 4 },
      // Exterior line that misses completely
      { id: 'ext_line', type: 'line', color: 'rgba(255,255,255,0.3)', strokeWidth: 1.5, start: { x: px - 200, y: py - 40 }, end: { x: px + 200, y: py - 40 }, text: 'Exterior Line: 0 points' },
    ];

    // Scene 4: Perpendicularity (90° Angle) & Tangential Velocity Vector
    const step4Elements: DrawingElement[] = [
      { id: 'axis_x', type: 'line', color: 'rgba(255,255,255,0.12)', strokeWidth: 1, start: { x: 120, y: cy }, end: { x: 760, y: cy } },
      { id: 'axis_y', type: 'line', color: 'rgba(255,255,255,0.12)', strokeWidth: 1, start: { x: cx, y: 50 }, end: { x: cx, y: 450 } },
      { id: 'circle_main', type: 'circle', color: palette.primary, strokeWidth: 3, start: { x: cx, y: cy }, radius: r },
      { id: 'center_dot', type: 'circle', color: palette.text, strokeWidth: 2, start: { x: cx, y: cy }, radius: 4, text: 'Center O' },
      { id: 'radius_line', type: 'line', color: palette.auxiliary, strokeWidth: 2.5, start: { x: cx, y: cy }, end: { x: px, y: py }, text: 'Radius ⊥ Tangent' },
      { id: 'tangent_line', type: 'line', color: palette.accent, strokeWidth: 3.5, start: { x: px - 240, y: py }, end: { x: px + 240, y: py }, text: 'Tangent Line T' },
      { id: 'pt_p', type: 'circle', color: palette.secondary, strokeWidth: 4, start: { x: px, y: py }, radius: 7, text: 'P' },
      // 90 degree perpendicular marker
      { id: 'right_angle', type: 'path', color: palette.secondary, strokeWidth: 2, d: `M ${px - 14} ${py} L ${px - 14} ${py + 14} L ${px} ${py + 14}` },
      // Tangential velocity vector
      { id: 'vel_vector', type: 'arrow', color: palette.highlight, strokeWidth: 4, start: { x: px, y: py }, end: { x: px + 190, y: py }, text: 'Tangential Velocity v⃗' },
      // Formula card
      { id: 'formula_card', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.1)', strokeWidth: 2, start: { x: 500, y: 340 }, width: 290, height: 80, text: 'Angle: θ = 90° to Radius' },
      { id: 'text_rule', type: 'text', color: palette.text, strokeWidth: 2, start: { x: 515, y: 400 }, text: 'Instantaneous Slope: m = dy/dx' },
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

  private buildMathSpatialBlueprint(origin: Point, palette: any, pedagogy: PedagogySpec): SpatialBlueprint {
    const cy = 270;

    // Scene 1: Coordinate axes, origin, and smooth function curve
    const step1: DrawingElement[] = [
      { id: 'axis_x', type: 'line', color: 'rgba(255,255,255,0.2)', strokeWidth: 1.5, start: { x: 120, y: cy + 100 }, end: { x: 780, y: cy + 100 }, text: 'X Axis' },
      { id: 'axis_y', type: 'line', color: 'rgba(255,255,255,0.2)', strokeWidth: 1.5, start: { x: 200, y: 80 }, end: { x: 200, y: cy + 140 }, text: 'Y Axis' },
      { id: 'curve_f', type: 'path', color: palette.primary, strokeWidth: 3, d: `M 220 ${cy + 80} Q 360 ${cy + 60} 450 ${cy - 20} T 680 ${cy - 120}`, text: 'Curve y = f(x)' },
      { id: 'pt_anchor', type: 'circle', color: palette.secondary, strokeWidth: 3, start: { x: 450, y: cy - 20 }, radius: 6, text: 'P(x, f(x))' },
      { id: 'badge_title', type: 'rect', color: palette.primary, fill: 'rgba(0, 240, 255, 0.08)', strokeWidth: 1.5, start: { x: 120, y: 40 }, width: 260, height: 50, text: `${pedagogy.concept}: Foundation` },
    ];

    // Scene 2: Active tangent slope through point P
    const step2: DrawingElement[] = [
      ...step1,
      { id: 'tangent_line', type: 'line', color: palette.accent, strokeWidth: 3.5, start: { x: 300, y: cy + 60 }, end: { x: 600, y: cy - 100 }, text: 'Instantaneous Tangent Slope' },
      { id: 'delta_box', type: 'rect', color: palette.accent, fill: 'rgba(189, 147, 249, 0.1)', strokeWidth: 1.5, start: { x: 550, y: 60 }, width: 260, height: 55, text: 'Direction of Instantaneous Change' },
    ];

    // Scene 3: Secant line contrast (Δx interval)
    const step3: DrawingElement[] = [
      ...step2,
      { id: 'secant_line', type: 'line', color: palette.auxiliary, strokeWidth: 2, start: { x: 320, y: cy + 75 }, end: { x: 570, y: cy - 75 }, text: 'Average Secant: cuts at P & Q' },
      { id: 'pt_q', type: 'circle', color: palette.auxiliary, strokeWidth: 3, start: { x: 540, y: cy - 65 }, radius: 5, text: 'Q(x+Δx)' },
      { id: 'dx_line', type: 'line', color: 'rgba(255,255,255,0.4)', strokeWidth: 1.5, start: { x: 450, y: cy - 20 }, end: { x: 540, y: cy - 20 }, text: 'Δx' },
      { id: 'dy_line', type: 'line', color: 'rgba(255,255,255,0.4)', strokeWidth: 1.5, start: { x: 540, y: cy - 20 }, end: { x: 540, y: cy - 65 }, text: 'Δy' },
    ];

    // Scene 4: Limit formula & perpendicular gradient
    const step4: DrawingElement[] = [
      ...step3,
      { id: 'right_angle', type: 'path', color: palette.secondary, strokeWidth: 2, d: `M 438 ${cy - 26} L 444 ${cy - 38} L 456 ${cy - 32}` },
      { id: 'gradient_vector', type: 'arrow', color: palette.highlight, strokeWidth: 3.5, start: { x: 450, y: cy - 20 }, end: { x: 410, y: cy - 80 }, text: 'Normal ∇f' },
      { id: 'formula_card', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.12)', strokeWidth: 2, start: { x: 480, y: 320 }, width: 330, height: 75, text: "Derivative: f'(x) = lim(Δy/Δx)" },
    ];

    return {
      coordinateFrame: { origin, width: 900, height: 560, showAxes: true },
      colorPalette: palette,
      stepBlueprints: [
        { stepNumber: 1, title: pedagogy.progressionStages[0]?.title || 'Foundation', explanation: pedagogy.progressionStages[0]?.narrationScript || '', elements: step1 },
        { stepNumber: 2, title: pedagogy.progressionStages[1]?.title || 'Core Operation', explanation: pedagogy.progressionStages[1]?.narrationScript || '', elements: step2 },
        { stepNumber: 3, title: pedagogy.progressionStages[2]?.title || 'Secant vs Tangent', explanation: pedagogy.progressionStages[2]?.narrationScript || '', elements: step3 },
        { stepNumber: 4, title: pedagogy.progressionStages[3]?.title || 'Derivative Limit', explanation: pedagogy.progressionStages[3]?.narrationScript || '', elements: step4 },
      ],
    };
  }

  private buildAlgorithmSpatialBlueprint(origin: Point, palette: any, pedagogy: PedagogySpec): SpatialBlueprint {
    const rootX = 450;
    const rootY = 120;

    // Scene 1: Initial tree hierarchy and data cells
    const step1: DrawingElement[] = [
      { id: 't_root', type: 'circle', color: palette.primary, strokeWidth: 3, start: { x: rootX, y: rootY }, radius: 45, text: 'Root [50]' },
      { id: 't_l1', type: 'circle', color: palette.auxiliary, strokeWidth: 2.5, start: { x: rootX - 140, y: rootY + 120 }, radius: 40, text: 'Left [25]' },
      { id: 't_r1', type: 'circle', color: palette.auxiliary, strokeWidth: 2.5, start: { x: rootX + 140, y: rootY + 120 }, radius: 40, text: 'Right [75]' },
      { id: 'edge_l', type: 'arrow', color: 'rgba(255,255,255,0.4)', strokeWidth: 2, start: { x: rootX - 25, y: rootY + 35 }, end: { x: rootX - 110, y: rootY + 95 } },
      { id: 'edge_r', type: 'arrow', color: 'rgba(255,255,255,0.4)', strokeWidth: 2, start: { x: rootX + 25, y: rootY + 35 }, end: { x: rootX + 110, y: rootY + 95 } },
      { id: 'badge_info', type: 'rect', color: palette.primary, fill: 'rgba(0, 240, 255, 0.08)', strokeWidth: 1.5, start: { x: 100, y: 70 }, width: 220, height: 60, text: `${pedagogy.concept} Hierarchy` },
    ];

    // Scene 2: Active comparison traversal
    const step2: DrawingElement[] = [
      ...step1,
      { id: 'active_query', type: 'circle', color: palette.highlight, strokeWidth: 3.5, start: { x: rootX - 140, y: rootY + 120 }, radius: 48, text: 'Target [25]' },
      { id: 'decision_badge', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.1)', strokeWidth: 2, start: { x: 100, y: 220 }, width: 240, height: 70, text: 'Query 25 < 50 → Go Left' },
    ];

    // Scene 3: Contrast against worst-case unpruned path
    const step3: DrawingElement[] = [
      ...step2,
      { id: 'pruned_branch', type: 'circle', color: 'rgba(255,255,255,0.2)', strokeWidth: 1.5, start: { x: rootX + 140, y: rootY + 120 }, radius: 40, text: 'Pruned [75]' },
      { id: 'contrast_badge', type: 'rect', color: palette.auxiliary, fill: 'rgba(255, 184, 108, 0.1)', strokeWidth: 1.5, start: { x: 550, y: 220 }, width: 260, height: 65, text: 'Half Sub-Tree Pruned in 1 Step' },
    ];

    // Scene 4: Final resolution and Big-O complexity guarantee
    const step4: DrawingElement[] = [
      ...step3,
      { id: 'found_card', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.15)', strokeWidth: 2, start: { x: 310, y: 380 }, width: 280, height: 80, text: 'Node Matched! Time: O(log N)' },
    ];

    return {
      coordinateFrame: { origin, width: 900, height: 560, showAxes: false },
      colorPalette: palette,
      stepBlueprints: [
        { stepNumber: 1, title: pedagogy.progressionStages[0]?.title || 'Initial State', explanation: pedagogy.progressionStages[0]?.narrationScript || '', elements: step1 },
        { stepNumber: 2, title: pedagogy.progressionStages[1]?.title || 'Traversal', explanation: pedagogy.progressionStages[1]?.narrationScript || '', elements: step2 },
        { stepNumber: 3, title: pedagogy.progressionStages[2]?.title || 'Pruning Contrast', explanation: pedagogy.progressionStages[2]?.narrationScript || '', elements: step3 },
        { stepNumber: 4, title: pedagogy.progressionStages[3]?.title || 'Complexity Guarantee', explanation: pedagogy.progressionStages[3]?.narrationScript || '', elements: step4 },
      ],
    };
  }

  private buildPhysicsSpatialBlueprint(origin: Point, palette: any, pedagogy: PedagogySpec): SpatialBlueprint {
    const cx = 450;
    const cy = 260;

    // Scene 1: Reference surface, stationary mass m, anchor
    const step1: DrawingElement[] = [
      { id: 'surface_line', type: 'line', color: 'rgba(255,255,255,0.25)', strokeWidth: 2, start: { x: 120, y: cy + 80 }, end: { x: 780, y: cy + 80 }, text: 'Reference Plane' },
      { id: 'mass_box', type: 'rect', color: palette.primary, fill: 'rgba(0, 240, 255, 0.1)', strokeWidth: 3, start: { x: cx - 60, y: cy - 20 }, width: 120, height: 100, text: 'Mass [m]' },
      { id: 'center_dot', type: 'circle', color: palette.text, strokeWidth: 2, start: { x: cx, y: cy + 30 }, radius: 5, text: 'Center of Mass' },
      { id: 'gravity_vec', type: 'arrow', color: palette.auxiliary, strokeWidth: 2.5, start: { x: cx, y: cy + 30 }, end: { x: cx, y: cy + 140 }, text: 'W = m·g' },
      { id: 'badge_title', type: 'rect', color: palette.primary, fill: 'rgba(0, 240, 255, 0.08)', strokeWidth: 1.5, start: { x: 100, y: 60 }, width: 260, height: 50, text: `${pedagogy.concept}: Setup` },
    ];

    // Scene 2: Applied Force vector F and velocity vector v
    const step2: DrawingElement[] = [
      ...step1,
      { id: 'applied_force', type: 'arrow', color: palette.highlight, strokeWidth: 4, start: { x: cx + 60, y: cy + 30 }, end: { x: cx + 240, y: cy + 30 }, text: 'Applied Force F⃗' },
      { id: 'vel_vector', type: 'arrow', color: palette.accent, strokeWidth: 3, start: { x: cx - 60, y: cy - 50 }, end: { x: cx + 100, y: cy - 50 }, text: 'Velocity v⃗' },
    ];

    // Scene 3: Opposing friction and equilibrium contrast
    const step3: DrawingElement[] = [
      ...step2,
      { id: 'friction_force', type: 'arrow', color: palette.auxiliary, strokeWidth: 3, start: { x: cx - 60, y: cy + 75 }, end: { x: cx - 180, y: cy + 75 }, text: 'Friction f⃗' },
      { id: 'contrast_card', type: 'rect', color: palette.auxiliary, fill: 'rgba(255, 184, 108, 0.1)', strokeWidth: 1.5, start: { x: 530, y: 60 }, width: 280, height: 60, text: 'Net Force: F_net = F_app - f' },
    ];

    // Scene 4: Governing equation card (F = ma) and acceleration vector
    const step4: DrawingElement[] = [
      ...step3,
      { id: 'accel_vector', type: 'arrow', color: palette.secondary, strokeWidth: 4, start: { x: cx + 60, y: cy - 20 }, end: { x: cx + 220, y: cy - 20 }, text: 'Acceleration a⃗' },
      { id: 'law_card', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.15)', strokeWidth: 2, start: { x: 300, y: 360 }, width: 300, height: 75, text: "Newton's 2nd Law: F_net = m·a" },
    ];

    return {
      coordinateFrame: { origin, width: 900, height: 560, showAxes: true },
      colorPalette: palette,
      stepBlueprints: [
        { stepNumber: 1, title: pedagogy.progressionStages[0]?.title || 'Physical Anchor', explanation: pedagogy.progressionStages[0]?.narrationScript || '', elements: step1 },
        { stepNumber: 2, title: pedagogy.progressionStages[1]?.title || 'Applied Force', explanation: pedagogy.progressionStages[1]?.narrationScript || '', elements: step2 },
        { stepNumber: 3, title: pedagogy.progressionStages[2]?.title || 'Friction & Equilibrium', explanation: pedagogy.progressionStages[2]?.narrationScript || '', elements: step3 },
        { stepNumber: 4, title: pedagogy.progressionStages[3]?.title || 'Governing Law', explanation: pedagogy.progressionStages[3]?.narrationScript || '', elements: step4 },
      ],
    };
  }

  private buildSystemsSpatialBlueprint(origin: Point, palette: any, pedagogy: PedagogySpec): SpatialBlueprint {
    const cy = 230;

    // Scene 1: Client node, Gateway, and Backend service boundaries
    const step1: DrawingElement[] = [
      { id: 'client_box', type: 'rect', color: palette.primary, strokeWidth: 2.5, start: { x: 120, y: cy - 40 }, width: 140, height: 90, text: 'Client Layer' },
      { id: 'gateway_box', type: 'rect', color: palette.secondary, strokeWidth: 2.5, start: { x: 380, y: cy - 40 }, width: 150, height: 90, text: 'API Gateway' },
      { id: 'service_box', type: 'rect', color: palette.accent, strokeWidth: 2.5, start: { x: 650, y: cy - 40 }, width: 150, height: 90, text: 'Microservice' },
      { id: 'badge_title', type: 'rect', color: palette.primary, fill: 'rgba(0, 240, 255, 0.08)', strokeWidth: 1.5, start: { x: 100, y: 50 }, width: 280, height: 50, text: `${pedagogy.concept}: Architecture` },
    ];

    // Scene 2: Active request and RPC communication payload
    const step2: DrawingElement[] = [
      ...step1,
      { id: 'req_arrow1', type: 'arrow', color: palette.secondary, strokeWidth: 3, start: { x: 260, y: cy }, end: { x: 380, y: cy }, text: 'HTTPS' },
      { id: 'req_arrow2', type: 'arrow', color: palette.secondary, strokeWidth: 3, start: { x: 530, y: cy }, end: { x: 650, y: cy }, text: 'gRPC' },
    ];

    // Scene 3: Cache / circuit breaker fallback contrast
    const step3: DrawingElement[] = [
      ...step2,
      { id: 'cache_box', type: 'rect', color: palette.auxiliary, strokeWidth: 2, start: { x: 380, y: cy + 100 }, width: 150, height: 75, text: 'Distributed Cache' },
      { id: 'cache_flow', type: 'arrow', color: palette.auxiliary, strokeWidth: 2, start: { x: 455, y: cy + 50 }, end: { x: 455, y: cy + 100 }, text: 'Cache Hit: <2ms' },
      { id: 'failover_arrow', type: 'arrow', color: palette.highlight, strokeWidth: 2, start: { x: 725, y: cy + 50 }, end: { x: 725, y: cy + 110 }, text: 'Timeout / Circuit Break' },
    ];

    // Scene 4: SLA guarantee and consistency card
    const step4: DrawingElement[] = [
      ...step3,
      { id: 'sla_card', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.12)', strokeWidth: 2, start: { x: 280, y: 360 }, width: 340, height: 70, text: 'Guarantee: 99.99% Availability & P99 < 15ms' },
    ];

    return {
      coordinateFrame: { origin, width: 900, height: 560, showAxes: false },
      colorPalette: palette,
      stepBlueprints: [
        { stepNumber: 1, title: pedagogy.progressionStages[0]?.title || 'Node Topology', explanation: pedagogy.progressionStages[0]?.narrationScript || '', elements: step1 },
        { stepNumber: 2, title: pedagogy.progressionStages[1]?.title || 'Message Protocol', explanation: pedagogy.progressionStages[1]?.narrationScript || '', elements: step2 },
        { stepNumber: 3, title: pedagogy.progressionStages[2]?.title || 'Fault Isolation', explanation: pedagogy.progressionStages[2]?.narrationScript || '', elements: step3 },
        { stepNumber: 4, title: pedagogy.progressionStages[3]?.title || 'SLA Guarantee', explanation: pedagogy.progressionStages[3]?.narrationScript || '', elements: step4 },
      ],
    };
  }

  private buildGeneralSpatialBlueprint(origin: Point, palette: any, pedagogy: PedagogySpec): SpatialBlueprint {
    const cx = 450;
    const cy = 240;

    // Scene 1: Baseline Entities & Context Setup
    const step1: DrawingElement[] = [
      { id: 'box_a', type: 'rect', color: palette.primary, strokeWidth: 2.5, start: { x: cx - 250, y: cy - 70 }, width: 200, height: 130, text: 'Core Foundation' },
      { id: 'box_b', type: 'rect', color: palette.secondary, strokeWidth: 2.5, start: { x: cx + 50, y: cy - 70 }, width: 200, height: 130, text: 'Interacting Subject' },
      { id: 'badge_title', type: 'rect', color: palette.primary, fill: 'rgba(0, 240, 255, 0.08)', strokeWidth: 1.5, start: { x: 100, y: 50 }, width: 270, height: 50, text: `${pedagogy.concept}: Foundation` },
    ];

    // Scene 2: The Core Mechanism in Action
    const step2: DrawingElement[] = [
      ...step1,
      { id: 'flow_arrow', type: 'arrow', color: palette.accent, strokeWidth: 3.5, start: { x: cx - 50, y: cy - 5 }, end: { x: cx + 50, y: cy - 5 }, text: 'Primary Operation' },
      { id: 'center_hub', type: 'circle', color: palette.highlight, strokeWidth: 3, start: { x: cx, y: cy + 100 }, radius: 50, text: 'Mechanism' },
    ];

    // Scene 3: Critical Contrast & Counterexamples
    const step3: DrawingElement[] = [
      ...step2,
      { id: 'contrast_arrow', type: 'arrow', color: palette.auxiliary, strokeWidth: 2, start: { x: cx - 150, y: cy + 60 }, end: { x: cx - 50, y: cy + 100 }, text: 'Alternative Path' },
      { id: 'misconception_card', type: 'rect', color: palette.highlight, fill: 'rgba(255, 85, 85, 0.1)', strokeWidth: 1.5, start: { x: 530, y: 50 }, width: 270, height: 60, text: 'Common Misconception Busted' },
    ];

    // Scene 4: Definitive Takeaway Rule Card
    const step4: DrawingElement[] = [
      ...step3,
      { id: 'summary_card', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.15)', strokeWidth: 2, start: { x: cx - 220, y: 350 }, width: 440, height: 75, text: `Key Principle: Remember this rule for ${pedagogy.concept}` },
    ];

    return {
      coordinateFrame: { origin, width: 900, height: 560, showAxes: false },
      colorPalette: palette,
      stepBlueprints: [
        { stepNumber: 1, title: pedagogy.progressionStages[0]?.title || 'Foundation', explanation: pedagogy.progressionStages[0]?.narrationScript || '', elements: step1 },
        { stepNumber: 2, title: pedagogy.progressionStages[1]?.title || 'Core Mechanism', explanation: pedagogy.progressionStages[1]?.narrationScript || '', elements: step2 },
        { stepNumber: 3, title: pedagogy.progressionStages[2]?.title || 'Critical Contrast', explanation: pedagogy.progressionStages[2]?.narrationScript || '', elements: step3 },
        { stepNumber: 4, title: pedagogy.progressionStages[3]?.title || 'Definitive Takeaway', explanation: pedagogy.progressionStages[3]?.narrationScript || '', elements: step4 },
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

UNIVERSAL 4-SCENE CONTINUOUS WHITEBOARD PEDAGOGY:
${pedagogy.progressionStages.map((p) => `Scene ${p.stageNumber} [${p.title}]:\n  - Objective: ${p.objective}\n  - Audio Script: "${p.narrationScript}"`).join('\n\n')}

SPATIAL BLUEPRINT CONSTRAINTS (Canvas 900x560):
- Origin: (${spatial.coordinateFrame.origin.x}, ${spatial.coordinateFrame.origin.y})
- Semantic Color Palette: Cyan (${spatial.colorPalette.primary}), Emerald (${spatial.colorPalette.secondary}), Violet (${spatial.colorPalette.accent}), Orange (${spatial.colorPalette.auxiliary}), Coral (${spatial.colorPalette.highlight})
- Planned Layout Sequence:
${layoutOverview}

INSTRUCTIONS FOR DRAWING AGENT:
1. Deliver a brilliant, crystal-clear visual explanation following this exact 4-scene progressive build for the concept:
   - Scene 1: Foundational Visual Anchor (establish base shape/context first before transformations)
   - Scene 2: Core Concept in Action (draw the primary active entity touching or transforming the foundation)
   - Scene 3: Critical Contrast & Misconceptions (juxtapose against counterexamples or alternative states)
   - Scene 4: Universal Invariant, Formula Card & Definitive Takeaway (equation, rule card, physical summary)
2. Retain earlier foundational elements across scenes so the drawing builds up continuously like a real video stream without clearing past work.
3. Output your reasoning in a <reasoning> block detailing your mathematical/spatial choices.
4. Write clean, natural spoken scripts for each step in Markdown headers (### Step 1: ..., ### Step 2: ...).
5. Output a verified, executable \`\`\`json block adhering to the spatial coordinate layout.
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
