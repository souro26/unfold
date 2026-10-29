import { BlackboardStep, DrawingElement, Point, Message } from '../types';
import { getSettings, sendMessage } from './ipc';
import { DecisionEngineLogger } from './DecisionEngineLogger';
import { getConversationHistory } from './storage';
import { PromptPipeline } from './PromptPipeline';

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
    const logger = DecisionEngineLogger.getInstance();
    logger.startSession(cleanPrompt, conversationId, screenImageBase64);

    try {
      // -------------------------------------------------------------
      // Multi-Turn Context: Retrieve Prior Conversation History
      // -------------------------------------------------------------
      const allHistory: Message[] = conversationId ? getConversationHistory(conversationId) : [];
      // Prior turns excludes the current prompt (which was appended immediately before executePipeline)
      const priorHistory = allHistory.slice(0, -1);

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
      const pedagogy = this.deconstructPedagogy(cleanPrompt, priorHistory);
      logger.logFold1Pedagogy(pedagogy);

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
      logger.logFold2Spatial(spatialBlueprint);

      // -------------------------------------------------------------
      // LAYER 3: Master Drawing Prompt Synthesis & Compiler Agent
      // -------------------------------------------------------------
      onProgress?.({
        layer: 3,
        title: 'Layer 3: Drawing Agent Synthesis (Rough.js)',
        detail: 'Compiling structured execution plan and dispatching to drawing agent...',
      });

      const finalAgentPrompt = this.synthesizeDrawingPrompt(cleanPrompt, pedagogy, spatialBlueprint, priorHistory);
      logger.logFold3Prompt(finalAgentPrompt);

      const trace: AgentReasoningTrace = {
        pedagogicalReasoning: `Domain: ${pedagogy.domain.toUpperCase()}\nCore Intuition: ${pedagogy.coreIntuition}\nProgression:\n${pedagogy.progressionStages
          .map((s) => `  ${s.stageNumber}. ${s.title}: ${s.objective}`)
          .join('\n')}\nMisconceptions to Avoid:\n${pedagogy.commonMisconceptions.map((m) => `  - ${m}`).join('\n')}`,
        spatialBlueprintReasoning: `Canvas: 900x560, Origin at (${spatialBlueprint.coordinateFrame.origin.x}, ${spatialBlueprint.coordinateFrame.origin.y})\nColor Mapping:\n  Primary: ${spatialBlueprint.colorPalette.primary}\n  Secondary: ${spatialBlueprint.colorPalette.secondary}\n  Accent: ${spatialBlueprint.colorPalette.accent}\n  Highlight: ${spatialBlueprint.colorPalette.highlight}\nStep Layouts Generated: ${spatialBlueprint.stepBlueprints.length} visual blackboard scenes.`,
        synthesisReasoning: `Synthesized master drawing prompt fusing pedagogical progression with exact geometric constraints. Ready for organic Rough.js rendering.`,
        finalPrompt: finalAgentPrompt,
      };

      // -------------------------------------------------------------
      // LAYER 4: LLM Inference
      // -------------------------------------------------------------
      const settings = await getSettings();
      const llmStartTime = Date.now();
      const historyPayload = priorHistory.slice(-6).map((m) => {
        let clean = m.content
          .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
          .replace(/```(?:json)?[\s\S]*?```/gi, '')
          .trim();
        return {
          role: m.role,
          content: clean.slice(0, 1000),
        };
      });
      const rawResponse = await sendMessage(finalAgentPrompt, conversationId, screenImageBase64, historyPayload);
      const llmDurationMs = Date.now() - llmStartTime;

      logger.logFold4Inference(
        settings.llm_provider || 'nvidia',
        settings.model || 'nvidia/nemotron-3.5-bolt-e4b',
        llmDurationMs,
        rawResponse
      );

      // -------------------------------------------------------------
      // LAYER 5: Parse Plan
      // -------------------------------------------------------------
      const parsedPlan = this.parseAgentPlan(rawResponse, spatialBlueprint);
      logger.logFold5Plan(parsedPlan, parsedPlan.rawJson);

      // -------------------------------------------------------------
      // LAYER 6: Drawing Dispatch Log
      // -------------------------------------------------------------
      logger.logFold6DrawingDispatch(
        parsedPlan.steps,
        'Rough.js Chalkboard Engine (CanvasKit GPU Fallback)',
        parsedPlan.steps.map((s) => s.explanation || s.title)
      );

      // Persist full session log files to logs/ directory
      await logger.finalizeSession();

      return {
        plan: parsedPlan,
        trace,
        markdownResponse: rawResponse,
      };
    } catch (err: any) {
      await logger.finalizeSession(err);
      throw err;
    }
  }

  // =========================================================================
  // LAYER 1: Pedagogical Deconstruction
  // =========================================================================
  public deconstructPedagogy(prompt: string, history?: Message[]): PedagogySpec {
    const cleanPrompt = prompt.trim();
    let priorSubject = '';
    let isFollowUp = false;
    let followUpType: 'simpler' | 'example' | 'clarify' | 'general' = 'general';

    // Retrieve previous user subject from conversation history
    if (history && history.length > 0) {
      for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (msg.role === 'user') {
          const past = msg.content.trim();
          if (past && past !== cleanPrompt && past.length > 3) {
            priorSubject = past
              .replace(/^(?:teach\s+me|explain|what\s+is|how\s+does|draw|show\s+me|visualize)\s+(?:about\s+|what\s+|how\s+)?/i, '')
              .replace(/[?!.]/g, '')
              .trim();
            break;
          }
        }
      }
    }

    if (priorSubject) {
      const followUpRegex = /^(?:can\s+you\s+|could\s+you\s+|please\s+)?(?:explain\s+(?:it\s+)?(?:simpler|more\s+simply|in\s+simple\s+terms|again|further|more)|make\s+it\s+simpler|simplify|give\s+(?:me\s+)?(?:an|another)\s+example|why(?:\s+is\s+that)?|how\s+so|what\s+about|what\s+if|tell\s+me\s+more|elaborate|clarify|summarize)(?:[?!.,\s]|$)/i;
      const wordCount = cleanPrompt.split(/\s+/).length;
      const hasRelativePronoun = /\b(it|this|that|these|those|why|how)\b/i.test(cleanPrompt);

      if (followUpRegex.test(cleanPrompt) || hasRelativePronoun || wordCount <= 7) {
        isFollowUp = true;
        if (/simpler|simple|easier|layman/i.test(cleanPrompt)) {
          followUpType = 'simpler';
        } else if (/example|instance|case/i.test(cleanPrompt)) {
          followUpType = 'example';
        }
      }
    }

    // Universal Context Merging across turns
    const resolvedPrompt = (isFollowUp && priorSubject)
      ? (followUpType === 'simpler'
          ? `${priorSubject} (explained in simpler intuitive terms with everyday analogies)`
          : `${priorSubject} (${cleanPrompt})`)
      : cleanPrompt;

    const p = resolvedPrompt.toLowerCase();

    // 1. Classify domain
    let domain: PedagogySpec['domain'] = 'general';
    const isMath = /(tangent|derivative|calculus|integral|curve|circle|geometry|triangle|vector|sine|cosine|math|mathematics|algebra|matrix|tensor|parabola|set|union|intersection|venn|subset|probability|logic|combinatorics|permutation|discrete|statistic|domain|codomain|bijection|injection|surjection|relation)/i.test(p);
    const isCodingExplicit = !isMath && /(python|javascript|typescript|rust|golang|c\+\+|java\b|coding|software|code\b|script\b|def\s+|class\s+|variable|parameter|argument|return\s+value|for\s+loop|while\s+loop|method)/i.test(p);

    if (isMath) {
      domain = 'mathematics';
    } else if (isCodingExplicit) {
      domain = 'algorithms';
    } else if (/(tree|binary|sort|recursion|algorithm|graph|stack|queue|hash|search|array|linked\s*list|dynamic\s*programming|heap)/i.test(p)) {
      domain = 'algorithms';
    } else if (/(system|microservice|client|server|database|distributed|network|api|architecture|consensus|cache|docker|kubernetes|raft|paxos|failover)/i.test(p)) {
      domain = 'systems';
    } else if (/(velocity|\bforce\b|gravity|quantum|energy|\bwave\b|physics|orbit|momentum|newton|motion|acceleration|friction|thermodynamics|\bheat\b|\bhot\b|\bcold\b|\bcool\b|temperature|thermal|compress|pressure|refrigerat|engine|electric|magnet|\boptics?\b|sound|fluid|bernoulli)/i.test(p)) {
      domain = 'physics';
    }

    const topic = resolvedPrompt
      .replace(/^(?:teach\s+me|explain|what\s+is|how\s+does|draw|show\s+me|visualize)\s+(?:about\s+|what\s+|how\s+)?/i, '')
      .replace(/[?!.]/g, '')
      .trim() || 'Concept Overview';

    // Dedicated Mathematical Function Pedagogy (Domain, Codomain, Unique Mapping, Vertical Line Test)
    if (domain === 'mathematics' && /(function|mapping|domain|codomain|bijection|injection|surjection|relation)/i.test(p)) {
      return {
        concept: followUpType === 'simpler' ? 'Mathematical Functions (Simple Intuition)' : 'Mathematical Functions & Mappings',
        domain: 'mathematics',
        coreIntuition: followUpType === 'simpler'
          ? 'Imagine a magic vending machine: every time you press button 1, you ALWAYS get a specific soda. It never gives you two different sodas at once. That predictable, single-output rule is what makes it a function.'
          : 'A mathematical function f: X → Y is a deterministic relation between two sets where EVERY input x in Domain X is mapped to EXACTLY ONE output y in Codomain Y. An input can never split or produce multiple outputs.',
        commonMisconceptions: [
          'Confusing a general relation with a function (failing the Vertical Line Test: one input mapping to two outputs is NOT a function)',
          'Believing two different inputs cannot share the same output (e.g., (-2)² = 4 and 2² = 4 is completely valid and common)',
          'Assuming a function requires an algebraic formula rather than an arbitrary well-defined mapping table or relation',
        ],
        progressionStages: [
          {
            stageNumber: 1,
            title: 'Visual Foundation: Two Sets — Domain X and Codomain Y',
            objective: 'Draw the input set Domain X on the left and target set Codomain Y on the right with concrete elements {1, 2, 3} and {2, 4, 6}.',
            narrationScript:
              'Look at the board: to truly understand a mathematical function, we start with two separate worlds. On the left in cyan is our Domain, Set X, containing our inputs: 1, 2, and 3. On the right in emerald is our Codomain, Set Y, holding our possible outputs: 2, 4, and 6. A function is simply the bridge that connects these two sets.',
          },
          {
            stageNumber: 2,
            title: 'Core Concept in Action: Deterministic Mapping f(x) = y',
            objective: 'Draw directional mapping arrows from each Domain element to exactly one Codomain element f(1)=2, f(2)=4, f(3)=6.',
            narrationScript:
              'Now, watch our function f in action. Look at the arrows: 1 maps to 2, 2 maps to 4, and 3 maps to 6. Notice the ironclad rule of mathematics: every input in Set X shoots out exactly one arrow! No input is left behind, and no input is indecisive. This single-output guarantee is what makes f deterministic.',
          },
          {
            stageNumber: 3,
            title: 'Critical Contrast: Function vs Non-Function (Vertical Line Test)',
            objective: 'Illustrate the classic failure case: an input splitting to two outputs, and contrast with the curve Vertical Line Test.',
            narrationScript:
              'Why is that single-arrow rule so crucial? Look at the contrast badge at the top right: what if input 1 tried to shoot arrows to both 2 AND 4? In mathematics, that is a relation, but it fails to be a function! On a graph, this is the famous Vertical Line Test: if a vertical line slices a curve at more than one point, it fails to be a function.',
          },
          {
            stageNumber: 4,
            title: 'Universal Invariant: f: X → Y Uniqueness Guarantee',
            objective: 'Display the definitive mathematical invariant card: f: X → Y (Each x ∈ X maps to a unique y ∈ Y).',
            narrationScript:
              'And here is your definitive golden rule across the bottom of the board: A function is a rule of strict determinism. Multiple inputs can land on the same output—like negative 2 squared and positive 2 squared both equaling 4—but a single input can NEVER split into multiple outputs!',
          },
        ],
      };
    }

    // Dedicated Software / Programming Function Pedagogy (Only for explicit coding context)
    if (domain === 'algorithms' && isCodingExplicit && /(function|def\s+|method|routine)/i.test(p)) {
      return {
        concept: followUpType === 'simpler' ? 'Functions in Programming (Simple Intuition)' : (/(python)/i.test(p) ? 'Functions in Python' : 'Functions in Programming'),
        domain: 'algorithms',
        coreIntuition: followUpType === 'simpler'
          ? 'Imagine a magic bread-toaster: you drop in raw bread (arguments), the machine toasts it inside (function body), and out pops warm toast (return value). You can use that same toaster again and again.'
          : 'A function is a named, reusable machine in programming. It takes input arguments, executes structured logic inside its isolated body, and optionally returns a computed result, avoiding repetitive code.',
        commonMisconceptions: [
          'Confusing function definition (def) with function execution/call (parentheses () )',
          'Assuming a function without a return statement produces an error (it returns None in Python)',
          'Confusing parameters (placeholder names in definition) with arguments (actual values passed during call)',
        ],
        progressionStages: [
          {
            stageNumber: 1,
            title: 'Visual Foundation: The Reusable Machine (Input → Process → Output)',
            objective: 'Draw the Input Arguments hopper on the left, the central Function Box, and the Output Result tray on the right.',
            narrationScript:
              'Welcome! Think of a function like a specialized kitchen machine. You feed raw ingredients into the input slot on the left, something specific happens inside the box, and a finished product comes out of the output chute. Let us look at our board: on the left are our input arguments, in the center is our function machine, and on the right is our returned result.',
          },
          {
            stageNumber: 2,
            title: 'Core Mechanism: Python def Syntax & Execution Flow',
            objective: 'Trace the parameter binding, indented body execution, and return statement ejecting the result.',
            narrationScript:
              'Now, how do we write this in Python? We use the keyword def, which stands for define. Then we name it, like calculate, followed by parentheses holding our parameters. Look at the arrow in the center: incoming arguments flow inside, the indented body runs line by line, and the return statement delivers the result back to whoever asked for it.',
          },
          {
            stageNumber: 3,
            title: 'Critical Contrast: Reusable Function vs 50x Copy-Paste Duplication',
            objective: 'Contrast the clean modular function call against repetitive, bug-prone copy-paste spaghetti code.',
            narrationScript:
              'Why do functions matter so much? Look at the contrast badge at the top right: imagine having to write the exact same 15 lines of code every single time you need to compute a value! If you make one mistake, you have to fix it in fifty places. With a function, you write the logic once, and call it anywhere: f(10), f(50). Infinite reuse, zero duplication.',
          },
          {
            stageNumber: 4,
            title: 'Definitive Takeaway: Lifecycle & Return Value Invariant',
            objective: 'Display the summary card with the universal execution rule: Arguments In → Logic Executes → Return Value Out.',
            narrationScript:
              'And here is your definitive golden rule: A function packages inputs, operations, and outputs into a single reliable building block. Remember: if you do not write an explicit return statement, Python automatically hands back None. Functions turn chaotic code into clean, modular lego bricks!',
          },
        ],
      };
    }

    // Set Theory: Specifically Intersection
    if (domain === 'mathematics' && /(intersection|overlap|shared)/i.test(p) && !/union/i.test(cleanPrompt)) {
      return {
        concept: followUpType === 'simpler' ? 'Intersection in Set Theory (Simple Intuition)' : 'Intersection in Set Theory',
        domain: 'mathematics',
        coreIntuition: followUpType === 'simpler'
          ? 'Imagine two groups of friends: the Intersection is ONLY the people who belong to BOTH groups at the exact same time. If someone is only in group A or only in group B, they do not belong to the intersection.'
          : 'The Intersection of Set A and Set B (written A ∩ B) selects ONLY the elements that simultaneously belong to both collections—the shared overlap—excluding anything unique to only one set.',
        commonMisconceptions: [
          'Confusing Intersection (AND: elements strictly in both) with Union (OR: elements in either or both)',
          'Assuming disjoint sets have an undefined intersection (it is the empty set ∅)',
        ],
        progressionStages: [
          {
            stageNumber: 1,
            title: 'Visual Foundation: Two Overlapping Sets A & B',
            objective: 'Draw the universal set frame and two overlapping Venn circles representing Set A and Set B with concrete member elements.',
            narrationScript:
              'Look at the board: we start with two groups of friends. Circle A on the left in cyan has items 1 and 2. Circle B on the right in violet has items 4 and 5. Right in the middle, where both circles overlap, is item 3.',
          },
          {
            stageNumber: 2,
            title: 'Core Concept in Action: The Overlap Lens (A ∩ B)',
            objective: 'Highlight exclusively the narrow shared lens in the center to show only the common elements.',
            narrationScript:
              'Now, what is the Intersection, written A intersection B? Think of the word intersection like a street intersection where two roads cross: it is only where both overlap! Look at the glowing golden lens in the center. Only item 3 is in both A and B. So A intersection B is simply the set containing 3.',
          },
          {
            stageNumber: 3,
            title: 'Comparative Contrast: Intersection (AND) vs Union (OR)',
            objective: 'Contrast the exclusive intersection against the inclusive union and showcase disjoint sets.',
            narrationScript:
              'Notice the critical distinction: the Union says OR—bring everyone together, giving us 1, 2, 3, 4, 5. But Intersection says AND—you must be in A AND in B. If two sets share nothing, their intersection is empty, called the null set.',
          },
          {
            stageNumber: 4,
            title: 'Universal Invariant: Counting Formula for Intersection',
            objective: 'Display the formal cardinality formula card |A ∩ B| = |A| + |B| - |A ∪ B| and verify with our concrete counts.',
            narrationScript:
              'And here is our universal rule: the intersection size equals the size of A plus the size of B minus the union. In our example: 3 plus 3 minus 5 equals 1. Exactly our single shared item 3!',
          },
        ],
      };
    }

    // Set Theory: Union
    if (domain === 'mathematics' && /(set|union|venn|subset)/i.test(p)) {
      return {
        concept: followUpType === 'simpler' ? 'Union in Set Theory (Simple Intuition)' : 'Union and Operations in Set Theory',
        domain: 'mathematics',
        coreIntuition: followUpType === 'simpler'
          ? 'Imagine two boxes of toys: the Union means dumping all the toys together into one big toy box without putting two of the exact same toy inside.'
          : 'A set is a collection of distinct elements. The Union of Set A and Set B (written A ∪ B) merges all items from both sets into a single collection—including anything in A, anything in B, or in both—without ever duplicating shared items.',
        commonMisconceptions: [
          'Double-counting elements in the intersection when calculating the union size (|A| + |B|)',
          'Confusing Union (OR: elements in A, B, or both) with Intersection (AND: elements only in both)',
          'Assuming disjoint sets cannot form a union',
        ],
        progressionStages: [
          {
            stageNumber: 1,
            title: 'Visual Foundation: Two Overlapping Sets A & B',
            objective: 'Draw the universal set frame and two overlapping Venn circles representing Set A and Set B with concrete member elements.',
            narrationScript:
              'Imagine you have two groups of things. Look at the board: we draw two overlapping circles inside our universe. Circle A on the left in cyan has items 1 and 2. Circle B on the right in violet has items 4 and 5. Right in the middle, where both circles overlap, is item 3, which belongs to both sets.',
          },
          {
            stageNumber: 2,
            title: 'Core Concept in Action: The Grand Union (A ∪ B)',
            objective: 'Highlight the entire combined region across both circles to show all unique elements included together.',
            narrationScript:
              'Now, what is the Union, written A union B? The word union means bringing everything together. Look at the bright emerald boundary wrapping around both circles. Every single item—1, 2, 3, 4, and 5—now belongs to the Union. If an item belongs to A, or belongs to B, or belongs to both, it is welcomed into the Union.',
          },
          {
            stageNumber: 3,
            title: 'Comparative Contrast: The Double-Counting Trap vs Intersection',
            objective: 'Contrast the full union with the narrow intersection and demonstrate why simply adding |A| + |B| produces a double-counting error.',
            narrationScript:
              'Here is the trap that catches almost every student: if Set A has 3 items (1, 2, 3) and Set B has 3 items (3, 4, 5), how many items are in their union? If you just add 3 plus 3, you get 6. But count the items on our board: 1, 2, 3, 4, 5. There are only 5 items! Why? Because item 3 was counted twice—once in A and once in B.',
          },
          {
            stageNumber: 4,
            title: 'Universal Invariant: Principle of Inclusion-Exclusion',
            objective: 'Display the definitive formula card |A ∪ B| = |A| + |B| - |A ∩ B| and verify it with the concrete elements on the board.',
            narrationScript:
              'And that leads us to the universal rule of set theory: the Principle of Inclusion-Exclusion. The size of the union equals the size of A, plus the size of B, minus the intersection you double-counted. In our example: 3 plus 3 minus 1 equals 5. This elegant rule holds true for every set in mathematics.',
          },
        ],
      };
    }

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

    if (domain === 'mathematics' && /(tangent|derivative|calculus|secant|slope|rate\s+of\s+change)/i.test(p)) {
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

    if (domain === 'mathematics') {
      return {
        concept: topic,
        domain: 'mathematics',
        coreIntuition: `Understanding ${topic} by establishing foundational mathematical spaces, mapping transformations, contrasting with edge cases, and deriving the governing mathematical invariant.`,
        commonMisconceptions: ['Applying formulas mechanically without verifying prerequisites', 'Confusing input parameters with transformed outputs'],
        progressionStages: [
          {
            stageNumber: 1,
            title: `Visual Foundation: ${topic} Space & Setup`,
            objective: `Establish the foundational axes, input space, and anchor structures for ${topic}.`,
            narrationScript: `Welcome to our visual study of ${topic}. Look at the board: we start on the left with our baseline elements, setting up the exact mathematical context before any transformation begins.`,
          },
          {
            stageNumber: 2,
            title: `Core Operation: ${topic} in Action`,
            objective: `Illustrate the active mathematical mapping, geometric curve, or symbolic transformation.`,
            narrationScript: `Now, observe ${topic} in action. Notice how our entities interact across the center of the canvas: each step is governed by our foundational mathematical relation.`,
          },
          {
            stageNumber: 3,
            title: 'Critical Contrast: True Theorem vs Boundary Conditions',
            objective: `Contrast the valid mathematical rule against non-examples, discontinuities, or edge cases.`,
            narrationScript: `Look at the contrast badge at the top right: what makes this concept so powerful is knowing where it strictly applies versus where edge cases or boundary limits emerge.`,
          },
          {
            stageNumber: 4,
            title: 'Universal Invariant & Formula Card',
            objective: `Display the definitive formula, identity, or invariant property card governing ${topic}.`,
            narrationScript: `And here is your definitive takeaway across the bottom of the board: keep this invariant relationship in mind whenever you analyze or solve problems involving ${topic}.`,
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
      coreIntuition: `Breaking ${topic} down from intuitive visual foundation to dynamic transformation, comparative contrast, and definitive takeaway.`,
      commonMisconceptions: ['Abstracting without a concrete visual anchor', 'Confusing primary mechanisms with secondary side effects'],
      progressionStages: [
        {
          stageNumber: 1,
          title: `Visual Foundation: ${topic} Setup`,
          objective: `Establish the foundational anchor entities and visual context for ${topic}.`,
          narrationScript: `Welcome to our blackboard exploration of ${topic}. Look at the board: on the left, we establish our primary subject, and on the right, the interacting environment. Notice how these two baseline components are arranged cleanly before any process begins.`,
        },
        {
          stageNumber: 2,
          title: `The Core Mechanism: ${topic} in Action`,
          objective: `Draw the primary dynamic process, directional flows, and transformation connecting the entities.`,
          narrationScript: `Now, observe the core mechanism of ${topic} in action. Look at the directional flow arrow connecting our two components across the center. As energy or information moves through this active channel, the entire transformation takes place.`,
        },
        {
          stageNumber: 3,
          title: 'Critical Contrast: Misconceptions & Edge Cases',
          objective: `Contrast the true mechanism against common misunderstandings, alternative states, and failure modes.`,
          narrationScript: `Here is the critical distinction that catches most learners: notice the contrast badge at the top right. Many people assume this process happens passively, but in reality, without the active driving force we just drew, the system remains completely dormant.`,
        },
        {
          stageNumber: 4,
          title: 'Definitive Takeaway & Core Rule Card',
          objective: `Display the definitive takeaway card, governing relationship, and practical intuition.`,
          narrationScript: `And that brings us to our definitive takeaway rule. Look at the summary card across the bottom of the board: remember this foundational relationship whenever you analyze or reason about ${topic}.`,
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

    if (pedagogy.domain === 'mathematics' && /(function|mapping|domain|codomain)/i.test(pedagogy.concept)) {
      return this.buildMathFunctionSpatialBlueprint(origin, palette, pedagogy);
    }

    if (pedagogy.domain === 'mathematics' && /tangent/i.test(pedagogy.concept)) {
      return this.buildTangentSpatialBlueprint(origin, palette, pedagogy);
    }

    if (pedagogy.domain === 'mathematics' && /(set|union|intersection|venn|subset)/i.test(pedagogy.concept)) {
      return this.buildSetTheorySpatialBlueprint(origin, palette, pedagogy);
    }

    if (/(function|def\s+|method|routine)/i.test(pedagogy.concept) && (pedagogy.domain === 'algorithms' || /python|code|program/i.test(pedagogy.concept))) {
      return this.buildSoftwareFunctionSpatialBlueprint(origin, palette, pedagogy);
    }

    if (pedagogy.domain === 'mathematics' && /(tangent|derivative|calculus|secant|slope)/i.test(pedagogy.concept)) {
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

  private buildSetTheorySpatialBlueprint(origin: Point, palette: any, pedagogy: PedagogySpec): SpatialBlueprint {
    const isIntersection = /(intersection|overlap|shared)/i.test(pedagogy.concept) && !/union/i.test(pedagogy.concept);
    const cax = 370;
    const cbx = 530;
    const cy = 260;
    const r = 110;

    // Non-overlapping Vertical Zones:
    // Header Zone: y = 65 .. 125 (title badges, universe frame label, warnings)
    // Main Focal Zone: y = 150 .. 380 (Circles A & B, member dots, overlap lens)
    // Footer Zone: y = 410 .. 475 (Formula cards, definitive results, takeaways)

    // Scene 1: Universal Set frame, Circle A (Cyan), Circle B (Violet), member elements 1,2 in A, 3 in overlap, 4,5 in B
    const step1Elements: DrawingElement[] = [
      // Universe frame (height 410: y=65 to 475)
      { id: 'univ_frame', type: 'rect', color: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1.5, start: { x: 140, y: 65 }, width: 620, height: 410, text: 'Universal Set U' },
      // Circle A (Cyan) centered at (370, 260) -> y from 150 to 370
      { id: 'circle_a', type: 'circle', color: palette.primary, strokeWidth: 3, start: { x: cax, y: cy }, radius: r, text: 'Set A = {1, 2, 3}' },
      // Circle B (Violet) centered at (530, 260) -> y from 150 to 370
      { id: 'circle_b', type: 'circle', color: palette.accent, strokeWidth: 3, start: { x: cbx, y: cy }, radius: r, text: 'Set B = {3, 4, 5}' },
      // Member elements in A only (left crescent)
      { id: 'el_1', type: 'circle', color: palette.primary, strokeWidth: 2, start: { x: 305, y: 230 }, radius: 5, text: '• 1' },
      { id: 'el_2', type: 'circle', color: palette.primary, strokeWidth: 2, start: { x: 315, y: 290 }, radius: 5, text: '• 2' },
      // Member element in Intersection (middle overlap x=450)
      { id: 'el_3', type: 'circle', color: palette.secondary, strokeWidth: 3, start: { x: 450, y: 260 }, radius: 6, text: '• 3' },
      // Member elements in B only (right crescent)
      { id: 'el_4', type: 'circle', color: palette.accent, strokeWidth: 2, start: { x: 585, y: 230 }, radius: 5, text: '• 4' },
      { id: 'el_5', type: 'circle', color: palette.accent, strokeWidth: 2, start: { x: 595, y: 290 }, radius: 5, text: '• 5' },
      // Title badge in Header Zone
      { id: 'badge_1', type: 'rect', color: palette.primary, fill: 'rgba(0, 240, 255, 0.08)', strokeWidth: 1.5, start: { x: 160, y: 75 }, width: 280, height: 45, text: isIntersection ? 'Two Sets with Shared Overlap' : 'Two Overlapping Sets with Elements' },
    ];

    if (isIntersection) {
      // Intersection Blueprint: Highlights strictly the shared lens (A ∩ B)
      const step2Elements: DrawingElement[] = [
        ...step1Elements,
        // Glowing intersection lens
        { id: 'inter_lens', type: 'circle', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.2)', strokeWidth: 3, start: { x: 450, y: 260 }, radius: 45, text: 'Overlap (A ∩ B)' },
        // Result Card in Footer Zone
        { id: 'inter_card', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.15)', strokeWidth: 2, start: { x: 250, y: 410 }, width: 400, height: 55, text: 'A ∩ B = {3} (Elements strictly in BOTH)' },
      ];

      const step3Elements: DrawingElement[] = [
        ...step2Elements,
        // Contrast badge in Header Zone
        { id: 'contrast_badge', type: 'rect', color: palette.auxiliary, fill: 'rgba(255, 184, 108, 0.12)', strokeWidth: 2, start: { x: 480, y: 75 }, width: 320, height: 45, text: 'Contrast: Intersection (AND) vs Union (OR)' },
      ];

      const step4Elements: DrawingElement[] = [
        ...step3Elements,
        // Formula card in Footer Zone replacing/enhancing result card
        { id: 'formula_card', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.18)', strokeWidth: 2.5, start: { x: 190, y: 410 }, width: 520, height: 55, text: '|A ∩ B| = |A| + |B| - |A ∪ B| = 3 + 3 - 5 = 1' },
      ];

      return {
        coordinateFrame: { origin, width: 900, height: 560, showAxes: false },
        colorPalette: palette,
        stepBlueprints: [
          { stepNumber: 1, title: pedagogy.progressionStages[0]?.title || 'Foundation: Overlapping Sets', explanation: pedagogy.progressionStages[0]?.narrationScript || '', elements: step1Elements },
          { stepNumber: 2, title: pedagogy.progressionStages[1]?.title || 'Core Operation: The Overlap Lens', explanation: pedagogy.progressionStages[1]?.narrationScript || '', elements: step2Elements },
          { stepNumber: 3, title: pedagogy.progressionStages[2]?.title || 'Comparative Contrast: AND vs OR', explanation: pedagogy.progressionStages[2]?.narrationScript || '', elements: step3Elements },
          { stepNumber: 4, title: pedagogy.progressionStages[3]?.title || 'Universal Invariant: Intersection Counting', explanation: pedagogy.progressionStages[3]?.narrationScript || '', elements: step4Elements },
        ],
      };
    }

    // Union Blueprint
    // Scene 2: The Grand Union A ∪ B (all unique elements merged)
    const step2Elements: DrawingElement[] = [
      ...step1Elements,
      // Highlighted Union boundary envelope wrapping both circles
      { id: 'union_envelope', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.08)', strokeWidth: 2.5, start: { x: 235, y: 135 }, width: 430, height: 250, text: 'Grand Union A ∪ B' },
      // Result Card in Footer Zone
      { id: 'union_card', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.15)', strokeWidth: 2, start: { x: 250, y: 410 }, width: 400, height: 55, text: 'A ∪ B = {1, 2, 3, 4, 5} (5 unique items)' },
    ];

    // Scene 3: Comparative Contrast - Double-Counting Trap vs Intersection
    const step3Elements: DrawingElement[] = [
      ...step2Elements,
      // Highlight intersection element 3 with warning coral ring
      { id: 'warn_intersection_ring', type: 'circle', color: palette.highlight, strokeWidth: 3, start: { x: 450, y: 260 }, radius: 14 },
      // Warning card in Header Zone
      { id: 'double_count_warning', type: 'rect', color: palette.highlight, fill: 'rgba(255, 85, 85, 0.12)', strokeWidth: 2, start: { x: 480, y: 75 }, width: 320, height: 45, text: 'Double-Counting Trap: 3 + 3 = 6 ≠ 5' },
    ];

    // Scene 4: Universal Invariant - Principle of Inclusion-Exclusion
    const step4Elements: DrawingElement[] = [
      ...step3Elements,
      // Formula card in Footer Zone
      { id: 'formula_card', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.18)', strokeWidth: 2.5, start: { x: 190, y: 410 }, width: 520, height: 55, text: '|A ∪ B| = |A| + |B| - |A ∩ B| = 3 + 3 - 1 = 5' },
    ];

    return {
      coordinateFrame: { origin, width: 900, height: 560, showAxes: false },
      colorPalette: palette,
      stepBlueprints: [
        { stepNumber: 1, title: pedagogy.progressionStages[0]?.title || 'Foundation: Overlapping Sets', explanation: pedagogy.progressionStages[0]?.narrationScript || '', elements: step1Elements },
        { stepNumber: 2, title: pedagogy.progressionStages[1]?.title || 'Core Operation: The Grand Union', explanation: pedagogy.progressionStages[1]?.narrationScript || '', elements: step2Elements },
        { stepNumber: 3, title: pedagogy.progressionStages[2]?.title || 'Comparative Contrast: Double-Counting', explanation: pedagogy.progressionStages[2]?.narrationScript || '', elements: step3Elements },
        { stepNumber: 4, title: pedagogy.progressionStages[3]?.title || 'Universal Invariant: Inclusion-Exclusion', explanation: pedagogy.progressionStages[3]?.narrationScript || '', elements: step4Elements },
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

  private buildSoftwareFunctionSpatialBlueprint(origin: Point, palette: any, pedagogy: PedagogySpec): SpatialBlueprint {
    const isPython = /python/i.test(pedagogy.concept);
    const syntaxTitle = isPython ? 'def calculate(x, y):' : 'function calculate(x, y)';

    // Header Zone: y = 65 .. 120
    // Main Focal Zone: y = 160 .. 380 (Input on Left x=140, Box in Center x=375, Output on Right x=660)
    // Footer Takeaway Zone: y = 415 .. 475

    // Scene 1: The Machine Mental Model (Input hopper, Function machine, Output tray)
    const step1: DrawingElement[] = [
      // Title Badge in Header Zone
      { id: 'badge_title', type: 'rect', color: palette.primary, fill: 'rgba(0, 240, 255, 0.08)', strokeWidth: 1.5, start: { x: 120, y: 65 }, width: 340, height: 45, text: `${pedagogy.concept}: The Reusable Machine` },
      // Input Arguments card on Left (x: 140 .. 320, y: 175 .. 335)
      { id: 'input_hopper', type: 'rect', color: palette.primary, fill: 'rgba(0, 240, 255, 0.1)', strokeWidth: 2.5, start: { x: 140, y: 175 }, width: 180, height: 160, text: 'Input Arguments: (x, y)' },
      // Central Function Machine (x: 375 .. 595, y: 155 .. 355)
      { id: 'function_box', type: 'rect', color: palette.accent, fill: 'rgba(189, 147, 249, 0.12)', strokeWidth: 3, start: { x: 375, y: 155 }, width: 220, height: 200, text: syntaxTitle },
      // Output Tray on Right (x: 650 .. 820, y: 175 .. 335)
      { id: 'output_tray', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.1)', strokeWidth: 2.5, start: { x: 650, y: 175 }, width: 170, height: 160, text: 'Return Result' },
    ];

    // Scene 2: Flow arrows and execution lifecycle
    const step2: DrawingElement[] = [
      ...step1,
      // Arrow 1: Passing Arguments into Function
      { id: 'arrow_input', type: 'arrow', color: palette.primary, strokeWidth: 3, start: { x: 325, y: 255 }, end: { x: 370, y: 255 }, text: 'Pass Args' },
      // Arrow 2: Returning Result
      { id: 'arrow_output', type: 'arrow', color: palette.secondary, strokeWidth: 3, start: { x: 600, y: 255 }, end: { x: 645, y: 255 }, text: 'return' },
      // Internal execution callout inside Function Box
      { id: 'body_callout', type: 'rect', color: palette.text, fill: 'rgba(255, 255, 255, 0.05)', strokeWidth: 1, start: { x: 395, y: 245 }, width: 180, height: 75, text: 'result = x + y\nreturn result' },
    ];

    // Scene 3: Reusability vs Duplicate Code Contrast
    const step3: DrawingElement[] = [
      ...step2,
      // Contrast Badge in Header Zone on right
      { id: 'contrast_badge', type: 'rect', color: palette.auxiliary, fill: 'rgba(255, 184, 108, 0.12)', strokeWidth: 1.5, start: { x: 500, y: 65 }, width: 340, height: 45, text: 'Contrast: 1 Definition vs 50x Duplication' },
      // Reusable calls badge
      { id: 'calls_badge', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.08)', strokeWidth: 1.5, start: { x: 385, y: 365 }, width: 200, height: 35, text: 'calc(3, 5) → 8 | calc(10, 20) → 30' },
    ];

    // Scene 4: Definitive Takeaway Card
    const step4: DrawingElement[] = [
      ...step3,
      // Summary card in Footer Zone
      { id: 'summary_card', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.16)', strokeWidth: 2, start: { x: 160, y: 415 }, width: 580, height: 55, text: 'Golden Rule: Inputs (Arguments) → Logic (Body) → Output (return). Modular & Reusable!' },
    ];

    return {
      coordinateFrame: { origin, width: 900, height: 560, showAxes: false },
      colorPalette: palette,
      stepBlueprints: [
        { stepNumber: 1, title: pedagogy.progressionStages[0]?.title || 'The Reusable Machine', explanation: pedagogy.progressionStages[0]?.narrationScript || '', elements: step1 },
        { stepNumber: 2, title: pedagogy.progressionStages[1]?.title || 'Execution Flow', explanation: pedagogy.progressionStages[1]?.narrationScript || '', elements: step2 },
        { stepNumber: 3, title: pedagogy.progressionStages[2]?.title || 'Modular Reuse Contrast', explanation: pedagogy.progressionStages[2]?.narrationScript || '', elements: step3 },
        { stepNumber: 4, title: pedagogy.progressionStages[3]?.title || 'Definitive Takeaway', explanation: pedagogy.progressionStages[3]?.narrationScript || '', elements: step4 },
      ],
    };
  }

  private buildMathFunctionSpatialBlueprint(origin: Point, palette: any, pedagogy: PedagogySpec): SpatialBlueprint {
    const leftX = 230;
    const rightX = 670;

    // Header Zone: y = 65 .. 120
    // Focal Zone: y = 150 .. 390 (Domain on left, Codomain on right, arrows in center)
    // Footer Zone: y = 415 .. 475 (Invariant card)

    // Scene 1: Domain (Set X) on left with items 1, 2, 3; Codomain (Set Y) on right with items 2, 4, 6
    const step1: DrawingElement[] = [
      { id: 'badge_title', type: 'rect', color: palette.primary, fill: 'rgba(0, 240, 255, 0.08)', strokeWidth: 1.5, start: { x: 120, y: 65 }, width: 340, height: 45, text: 'Mathematical Function: f: X → Y' },
      // Domain Oval / Capsule on Left
      { id: 'domain_box', type: 'rect', color: palette.primary, fill: 'rgba(0, 240, 255, 0.06)', strokeWidth: 2.5, start: { x: leftX - 70, y: 150 }, width: 150, height: 215, text: 'Domain (Set X)' },
      { id: 'in_pt1', type: 'circle', color: palette.primary, strokeWidth: 2, start: { x: leftX, y: 195 }, radius: 14, text: '1' },
      { id: 'in_pt2', type: 'circle', color: palette.primary, strokeWidth: 2, start: { x: leftX, y: 255 }, radius: 14, text: '2' },
      { id: 'in_pt3', type: 'circle', color: palette.primary, strokeWidth: 2, start: { x: leftX, y: 315 }, radius: 14, text: '3' },
      // Codomain Oval / Capsule on Right
      { id: 'codomain_box', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.06)', strokeWidth: 2.5, start: { x: rightX - 70, y: 150 }, width: 150, height: 215, text: 'Codomain (Set Y)' },
      { id: 'out_pt1', type: 'circle', color: palette.secondary, strokeWidth: 2, start: { x: rightX, y: 195 }, radius: 14, text: '2' },
      { id: 'out_pt2', type: 'circle', color: palette.secondary, strokeWidth: 2, start: { x: rightX, y: 255 }, radius: 14, text: '4' },
      { id: 'out_pt3', type: 'circle', color: palette.secondary, strokeWidth: 2, start: { x: rightX, y: 315 }, radius: 14, text: '6' },
    ];

    // Scene 2: Deterministic Mapping Arrows f(x) = 2x across the center
    const step2: DrawingElement[] = [
      ...step1,
      { id: 'map_arr1', type: 'arrow', color: palette.accent, strokeWidth: 3, start: { x: leftX + 25, y: 195 }, end: { x: rightX - 25, y: 195 }, text: 'f(1) = 2' },
      { id: 'map_arr2', type: 'arrow', color: palette.accent, strokeWidth: 3, start: { x: leftX + 25, y: 255 }, end: { x: rightX - 25, y: 255 }, text: 'f(2) = 4' },
      { id: 'map_arr3', type: 'arrow', color: palette.accent, strokeWidth: 3, start: { x: leftX + 25, y: 315 }, end: { x: rightX - 25, y: 315 }, text: 'f(3) = 6' },
      { id: 'rule_badge', type: 'rect', color: palette.accent, fill: 'rgba(189, 147, 249, 0.12)', strokeWidth: 1.5, start: { x: 335, y: 145 }, width: 230, height: 40, text: 'Rule: f(x) = 2x (Deterministic)' },
    ];

    // Scene 3: Contrast with Non-Function (Split arrow failing Vertical Line Test)
    const step3: DrawingElement[] = [
      ...step2,
      { id: 'contrast_badge', type: 'rect', color: palette.highlight, fill: 'rgba(255, 85, 85, 0.12)', strokeWidth: 1.5, start: { x: 500, y: 65 }, width: 340, height: 45, text: 'Contrast: Relation vs Function (Vertical Line Test)' },
      { id: 'fail_arrow', type: 'arrow', color: palette.highlight, strokeWidth: 2.5, start: { x: leftX + 25, y: 195 }, end: { x: rightX - 25, y: 255 }, text: 'Split? 1 → 4 (FAILS)' },
      { id: 'fail_card', type: 'rect', color: palette.highlight, fill: 'rgba(255, 85, 85, 0.15)', strokeWidth: 1.5, start: { x: 340, y: 365 }, width: 220, height: 40, text: 'Violates: 1 input → 2 outputs' },
    ];

    // Scene 4: Definitive Invariant Card
    const step4: DrawingElement[] = [
      ...step3,
      { id: 'invariant_card', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.16)', strokeWidth: 2, start: { x: 160, y: 420 }, width: 580, height: 50, text: 'Golden Invariant: Every x ∈ X maps to EXACTLY ONE y ∈ Y. Deterministic!' },
    ];

    return {
      coordinateFrame: { origin, width: 900, height: 560, showAxes: false },
      colorPalette: palette,
      stepBlueprints: [
        { stepNumber: 1, title: pedagogy.progressionStages[0]?.title || 'Foundation: Sets X & Y', explanation: pedagogy.progressionStages[0]?.narrationScript || '', elements: step1 },
        { stepNumber: 2, title: pedagogy.progressionStages[1]?.title || 'Deterministic Mapping', explanation: pedagogy.progressionStages[1]?.narrationScript || '', elements: step2 },
        { stepNumber: 3, title: pedagogy.progressionStages[2]?.title || 'Vertical Line Test / Contrast', explanation: pedagogy.progressionStages[2]?.narrationScript || '', elements: step3 },
        { stepNumber: 4, title: pedagogy.progressionStages[3]?.title || 'Uniqueness Invariant', explanation: pedagogy.progressionStages[3]?.narrationScript || '', elements: step4 },
      ],
    };
  }

  private buildGeneralSpatialBlueprint(origin: Point, palette: any, pedagogy: PedagogySpec): SpatialBlueprint {
    // Universal Clean Layout Blueprint:
    // Header Zone: y = 65 .. 120 (Title badges, context callouts)
    // Main Focal Zone: y = 160 .. 380 (Spaced horizontally across x = 140 .. 760)
    // Footer Takeaway Zone: y = 415 .. 475 (Takeaway summary card)

    // Scene 1: Baseline Entities & Context Setup
    const step1: DrawingElement[] = [
      // Primary Subject on the Left
      { id: 'entity_a', type: 'rect', color: palette.primary, strokeWidth: 2.5, start: { x: 150, y: 170 }, width: 220, height: 150, text: `${pedagogy.concept}: Subject A` },
      // Interacting Target / Environment on the Right
      { id: 'entity_b', type: 'rect', color: palette.secondary, strokeWidth: 2.5, start: { x: 530, y: 170 }, width: 220, height: 150, text: `${pedagogy.concept}: Context B` },
      // Title badge in Header Zone
      { id: 'badge_title', type: 'rect', color: palette.primary, fill: 'rgba(0, 240, 255, 0.08)', strokeWidth: 1.5, start: { x: 120, y: 65 }, width: 340, height: 45, text: `${pedagogy.concept}: Foundation` },
    ];

    // Scene 2: The Core Mechanism in Action
    const step2: DrawingElement[] = [
      ...step1,
      // Operational Arrow across the center gap (x: 375 to 525)
      { id: 'mechanism_arrow', type: 'arrow', color: palette.accent, strokeWidth: 3.5, start: { x: 375, y: 245 }, end: { x: 525, y: 245 }, text: 'Active Process' },
      // Central indicator dot
      { id: 'center_indicator', type: 'circle', color: palette.highlight, strokeWidth: 2.5, start: { x: 450, y: 200 }, radius: 18, text: 'Action' },
    ];

    // Scene 3: Critical Contrast & Counterexamples
    const step3: DrawingElement[] = [
      ...step2,
      // Contrast Badge in Header Zone on the right
      { id: 'contrast_badge', type: 'rect', color: palette.auxiliary, fill: 'rgba(255, 184, 108, 0.12)', strokeWidth: 1.5, start: { x: 500, y: 65 }, width: 300, height: 45, text: 'Contrast: Key Distinction' },
    ];

    // Scene 4: Definitive Takeaway Rule Card
    const step4: DrawingElement[] = [
      ...step3,
      // Takeaway Card in Footer Zone
      { id: 'summary_card', type: 'rect', color: palette.secondary, fill: 'rgba(80, 250, 123, 0.15)', strokeWidth: 2, start: { x: 180, y: 415 }, width: 540, height: 55, text: `Key Principle: Core Invariant for ${pedagogy.concept}` },
    ];

    return {
      coordinateFrame: { origin, width: 900, height: 560, showAxes: false },
      colorPalette: palette,
      stepBlueprints: [
        { stepNumber: 1, title: pedagogy.progressionStages[0]?.title || 'Visual Foundation', explanation: pedagogy.progressionStages[0]?.narrationScript || '', elements: step1 },
        { stepNumber: 2, title: pedagogy.progressionStages[1]?.title || 'Core Mechanism', explanation: pedagogy.progressionStages[1]?.narrationScript || '', elements: step2 },
        { stepNumber: 3, title: pedagogy.progressionStages[2]?.title || 'Critical Contrast', explanation: pedagogy.progressionStages[2]?.narrationScript || '', elements: step3 },
        { stepNumber: 4, title: pedagogy.progressionStages[3]?.title || 'Definitive Takeaway', explanation: pedagogy.progressionStages[3]?.narrationScript || '', elements: step4 },
      ],
    };
  }

  // =========================================================================
  // LAYER 3: Master Drawing Prompt Synthesis
  // =========================================================================
  public synthesizeDrawingPrompt(
    rawPrompt: string,
    pedagogy: PedagogySpec,
    spatial: SpatialBlueprint,
    history?: Message[]
  ): string {
    const layoutOverview = spatial.stepBlueprints
      .map(
        (s) => `Step ${s.stepNumber} [${s.title}]:\n  Visual Focal Points: ${s.elements.map((e) => e.id + (e.text ? ` ("${e.text}")` : '')).join(', ')}`
      )
      .join('\n');

    const conversationContext = history && history.length > 0
      ? `\nONGOING TUTORIAL DIALOGUE HISTORY (Maintain continuous conversational memory across turns):\n` +
        history
          .slice(-6)
          .map((m) => {
            let clean = m.content.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '').replace(/```(?:json)?[\s\S]*?```/gi, '').trim();
            return `${m.role === 'user' ? 'Student' : 'Master Teacher'}: "${clean.slice(0, 300)}"`;
          })
          .join('\n') + '\n'
      : '';

    return `[UNFOLD MULTI-LAYER REASONING TRACE]
The pedagogical reasoner and spatial architect have completed analysis of the learner's request.
${conversationContext}
LEARNER REQUEST: "${rawPrompt}"
IDENTIFIED DOMAIN: ${pedagogy.domain.toUpperCase()}
CORE MENTAL MODEL: ${pedagogy.coreIntuition}

UNIVERSAL 4-SCENE CONTINUOUS WHITEBOARD PEDAGOGY:
${pedagogy.progressionStages.map((p) => `Scene ${p.stageNumber} [${p.title}]:\n  - Objective: ${p.objective}\n  - Teacher Voice Script: "${p.narrationScript}"`).join('\n\n')}

SPATIAL BLUEPRINT CONSTRAINTS (Canvas 900x560):
- Origin: (${spatial.coordinateFrame.origin.x}, ${spatial.coordinateFrame.origin.y})
- Semantic Color Palette: Cyan (${spatial.colorPalette.primary}), Emerald (${spatial.colorPalette.secondary}), Violet (${spatial.colorPalette.accent}), Orange (${spatial.colorPalette.auxiliary}), Coral (${spatial.colorPalette.highlight})
- Planned Layout Sequence:
${layoutOverview}

INSTRUCTIONS FOR DRAWING AGENT & VOICE TEACHER:
1. DELIVER A MASTER-TEACHER LESSON:
   Your spoken narration (both in Markdown headers ### Step X: and in the JSON "explanation" field) MUST BE LITERALLY WHAT A MASTER TEACHER (like 3Blue1Brown or Feynman) SPEAKS ALOUD DIRECTLY TO A STUDENT at the blackboard.
   - Speak in the warm, conversational second person: "Look at the board: we start with...", "Notice what happens when...", "Why does this matter? Because...".
   - DOMAIN CONSISTENCY: If the domain is MATHEMATICS, NEVER speak about Python, \`def\`, coding variables, or software syntax! Teach the pure mathematical intuition, sets, mappings, curves, or geometry.
   - EMOTIONAL PAUSES & PACING: Punctuate your speech naturally with questions (?), exclamations (!), and commas (,). The speech engine pauses and modulates pitch on punctuation to produce warm, human pacing.
   - NEVER use robotic developer engineering commands (like "Establish entity...", "Render diagram...").
   - Do NOT worry about video or narration length: make each step's spoken explanation as rich, complete, and thorough as necessary to genuinely teach the concept.

2. DRAW SPREAD OUT, MEANINGFUL FIGURES ACROSS THE FULL SCREEN:
   - SPREAD ACROSS THE CANVAS: Use the full horizontal width (X from 100 to 800) and height (Y from 65 to 480). DO NOT bunch everything into the top-left corner!
   - STRICT NON-OVERLAPPING ZONES:
     * TOP ZONE (Y = 65..120): Title badges, context callouts, or contrast tags.
     * CENTER FOCAL ZONE (Y = 150..390): Main diagram shapes, bodies, curves, arrows, or interacting nodes.
     * BOTTOM FOOTER ZONE (Y = 415..480): Definitive takeaway cards, formulas, or invariant rules.
     * NEVER draw cards, text, or arrows directly on top of other shapes!
   - Every shape drawn MUST have conceptual integrity for whatever topic is being taught (physics bodies & force vectors, mathematical curves & tangents, software service nodes & protocol arrows, biological systems & process flows, or everyday mechanisms).

3. CONTINUOUS WHITEBOARD SCENES:
   - Each step in your JSON array represents the full visual state of the blackboard for that scene.
   - Assign clean, consistent IDs so updated elements transition smoothly without duplicating or cluttering the canvas.
4. Output your reasoning in a <reasoning> block detailing your pedagogical choices.
5. In your \`\`\`json block, provide the 4 progressive steps with explicit coordinates ("rect", "circle", "line", "arrow", "path", "text") matching the canvas layout, and the full spoken teacher script in "explanation".`;
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

    // Extract rich teacher speech from Markdown step headers if present
    const stepMarkdownMap = new Map<number, string>();
    const stepHeaderRegex = /###\s+Step\s+(\d+)[:\s]+[^\n]*\n+([\s\S]*?)(?=(?:###\s+Step\s+\d+|```|<reasoning|$))/gi;
    let headerMatch: RegExpExecArray | null;
    while ((headerMatch = stepHeaderRegex.exec(response)) !== null) {
      const stepNum = parseInt(headerMatch[1], 10);
      const text = headerMatch[2].trim();
      if (text && text.length > 15) {
        stepMarkdownMap.set(stepNum, text);
      }
    }

    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const rawJson = jsonMatch[1].trim();
        const parsed = JSON.parse(rawJson);
        const stepsList = Array.isArray(parsed) ? parsed : parsed.steps || [];
        if (stepsList.length > 0) {
          const steps: BlackboardStep[] = stepsList.map((s: any, idx: number) => {
            const stepNum = s.step || idx + 1;
            const mdSpeech = stepMarkdownMap.get(stepNum);
            // Detect if JSON explanation is a developer imperative or too short
            const isJsonRobotic = /^(establish|present|show|create|draw|display|render)\s+/i.test(s.explanation || '');
            let explanation = s.explanation || s.description || '';
            if (mdSpeech && (isJsonRobotic || mdSpeech.length > explanation.length)) {
              explanation = mdSpeech;
            }
            if (!explanation && fallbackSpatial.stepBlueprints[idx]?.explanation) {
              explanation = fallbackSpatial.stepBlueprints[idx].explanation;
            }

            const rawElements = (s.elements && s.elements.length > 0) ? s.elements : fallbackSpatial.stepBlueprints[idx]?.elements || [];
            const normalizedElements = PromptPipeline.getInstance().validateAndNormalizeElements(
              rawElements,
              fallbackSpatial.stepBlueprints[idx]?.elements || []
            );

            return {
              step: stepNum,
              title: s.title || fallbackSpatial.stepBlueprints[idx]?.title || `Step ${stepNum}`,
              explanation,
              elements: normalizedElements,
            };
          });

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
