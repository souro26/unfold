import { BlackboardStep, DrawingElement, Point, Message } from '../types';
import { PedagogySpec, SpatialBlueprint, AgentReasoningTrace } from './AgentOrchestrator';
import { UNFOLD_SYSTEM_PROMPT, UNFOLD_VISION_SYSTEM_PROMPT } from './prompts';
import { getSettings, sendMessage } from './ipc';
import { DecisionEngineLogger } from './DecisionEngineLogger';

export type PipelineStageName =
  | 'intent'
  | 'pedagogy'
  | 'spatial'
  | 'synthesis'
  | 'inference'
  | 'validation'
  | 'complete';

export interface PipelineProgressStatus {
  stage: PipelineStageName;
  layer: 1 | 2 | 3;
  title: string;
  detail: string;
  progressPercent: number;
}

export interface PipelineExecutionInput {
  userPrompt: string;
  conversationId: string;
  screenImageBase64?: string;
  systemPromptOverride?: string;
  history?: Message[];
}

export interface PipelineExecutionOutput {
  plan: {
    steps: BlackboardStep[];
    reasoning?: any;
    rawJson?: string;
  };
  trace: AgentReasoningTrace;
  markdownResponse: string;
  executionMetrics: {
    totalDurationMs: number;
    inferenceDurationMs: number;
    stepsGenerated: number;
    elementsValidated: number;
  };
}

/**
 * World-class multi-stage teaching & blackboard compilation pipeline.
 * Formulates pedagogy, spatial geometry, prompt synthesis, resilient LLM inference,
 * strict schema validation, element normalization, and visual dispatch.
 */
export class PromptPipeline {
  private static instance: PromptPipeline;

  public static getInstance(): PromptPipeline {
    if (!PromptPipeline.instance) {
      PromptPipeline.instance = new PromptPipeline();
    }
    return PromptPipeline.instance;
  }

  /**
   * Complete End-to-End Pipeline execution
   */
  public async execute(
    input: PipelineExecutionInput,
    onProgress?: (status: PipelineProgressStatus) => void
  ): Promise<PipelineExecutionOutput> {
    const startTime = Date.now();
    const cleanPrompt = input.userPrompt.trim();
    const logger = DecisionEngineLogger.getInstance();
    logger.startSession(cleanPrompt, input.conversationId, input.screenImageBase64);

    try {
      // -------------------------------------------------------------
      // STAGE 1: Pedagogical Intent Deconstruction (Layer 1)
      // -------------------------------------------------------------
      onProgress?.({
        stage: 'pedagogy',
        layer: 1,
        title: 'Stage 1: Pedagogical Deconstruction & Mental Model',
        detail: 'Deconstructing concept into first-principles intuition, learning hurdles, and 4-scene progression...',
        progressPercent: 20,
      });

      // Lazily import orchestrator to reuse domain-specific mathematical blueprints
      const { AgentOrchestrator } = await import('./AgentOrchestrator');
      const orchestrator = AgentOrchestrator.getInstance();

      const priorHistory = input.history || [];
      const pedagogy = orchestrator.deconstructPedagogy(cleanPrompt, priorHistory);
      logger.logFold1Pedagogy(pedagogy);

      // -------------------------------------------------------------
      // STAGE 2: Spatial Blueprint & Geometric Coordinate Layout (Layer 2)
      // -------------------------------------------------------------
      onProgress?.({
        stage: 'spatial',
        layer: 2,
        title: 'Stage 2: Spatial Architecture & Coordinate Geometry',
        detail: 'Calculating 900x560 canvas layout, vertical tiers (header, focal, footer), and semantic color coding...',
        progressPercent: 40,
      });

      const spatialBlueprint = orchestrator.architectSpatialBlueprint(pedagogy);
      logger.logFold2Spatial(spatialBlueprint);

      // -------------------------------------------------------------
      // STAGE 3: Master Prompt Compilation & Synthesis (Layer 3)
      // -------------------------------------------------------------
      onProgress?.({
        stage: 'synthesis',
        layer: 3,
        title: 'Stage 3: Master Prompt Synthesis & Context Injection',
        detail: 'Injecting pedagogical anchors, 4-scene constraints, and conversational dialogue history...',
        progressPercent: 60,
      });

      const finalAgentPrompt = this.compileMasterPrompt(
        cleanPrompt,
        pedagogy,
        spatialBlueprint,
        priorHistory,
        input.systemPromptOverride,
        Boolean(input.screenImageBase64)
      );
      logger.logFold3Prompt(finalAgentPrompt);

      const trace: AgentReasoningTrace = {
        pedagogicalReasoning: `Domain: ${pedagogy.domain.toUpperCase()}\nCore Intuition: ${pedagogy.coreIntuition}\nProgression:\n${pedagogy.progressionStages
          .map((s) => `  ${s.stageNumber}. ${s.title}: ${s.objective}`)
          .join('\n')}\nMisconceptions to Avoid:\n${pedagogy.commonMisconceptions.map((m) => `  - ${m}`).join('\n')}`,
        spatialBlueprintReasoning: `Canvas: 900x560, Origin at (${spatialBlueprint.coordinateFrame.origin.x}, ${spatialBlueprint.coordinateFrame.origin.y})\nColor Mapping:\n  Primary: ${spatialBlueprint.colorPalette.primary}\n  Secondary: ${spatialBlueprint.colorPalette.secondary}\n  Accent: ${spatialBlueprint.colorPalette.accent}\n  Auxiliary: ${spatialBlueprint.colorPalette.auxiliary}\n  Highlight: ${spatialBlueprint.colorPalette.highlight}`,
        synthesisReasoning: `Compiled master prompt enforcing 3Blue1Brown teacher voice, 4 progressive scenes, and strict JSON blackboard schema.`,
        finalPrompt: finalAgentPrompt,
      };

      // -------------------------------------------------------------
      // STAGE 4: Provider-Adaptive LLM Inference
      // -------------------------------------------------------------
      onProgress?.({
        stage: 'inference',
        layer: 3,
        title: 'Stage 4: LLM Inference & Cognitive Reasoning',
        detail: 'Executing inference with frontier reasoning model...',
        progressPercent: 75,
      });

      const settings = await getSettings();
      const llmStartTime = Date.now();
      const historyPayload = priorHistory.slice(-6).map((m) => {
        const clean = m.content
          .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
          .replace(/```(?:json)?[\s\S]*?```/gi, '')
          .trim();
        return {
          role: m.role,
          content: clean.slice(0, 1000),
        };
      });

      const rawResponse = await sendMessage(
        finalAgentPrompt,
        input.conversationId,
        input.screenImageBase64,
        historyPayload
      );
      const inferenceDurationMs = Date.now() - llmStartTime;

      logger.logFold4Inference(
        settings.llm_provider || 'nvidia',
        settings.model || 'nvidia/nemotron-3.5-bolt-e4b',
        inferenceDurationMs,
        rawResponse
      );

      // -------------------------------------------------------------
      // STAGE 5: Strict Validation, Extraction & Geometry Normalization
      // -------------------------------------------------------------
      onProgress?.({
        stage: 'validation',
        layer: 3,
        title: 'Stage 5: Schema Validation & Geometry Normalization',
        detail: 'Sanitizing elements, verifying bounds, and resolving vertical tier hierarchy...',
        progressPercent: 90,
      });

      const parsedPlan = this.parseAndNormalizePlan(rawResponse, spatialBlueprint);
      logger.logFold5Plan(parsedPlan, parsedPlan.rawJson);

      let totalElementsCount = 0;
      for (const step of parsedPlan.steps) {
        totalElementsCount += step.elements ? step.elements.length : 0;
      }

      // -------------------------------------------------------------
      // STAGE 6: Visual Dispatch & Blackboard Engine Logging
      // -------------------------------------------------------------
      onProgress?.({
        stage: 'complete',
        layer: 3,
        title: 'Stage 6: Visual Blackboard & Voice Narration Ready',
        detail: `Successfully prepared ${parsedPlan.steps.length} scenes with ${totalElementsCount} validated visual entities.`,
        progressPercent: 100,
      });

      logger.logFold6DrawingDispatch(
        parsedPlan.steps,
        'Rough.js Organic Chalkboard Engine (CanvasKit GPU Acceleration)',
        parsedPlan.steps.map((s) => s.explanation || s.title)
      );

      await logger.finalizeSession();

      const totalDurationMs = Date.now() - startTime;

      return {
        plan: parsedPlan,
        trace,
        markdownResponse: rawResponse,
        executionMetrics: {
          totalDurationMs,
          inferenceDurationMs,
          stepsGenerated: parsedPlan.steps.length,
          elementsValidated: totalElementsCount,
        },
      };
    } catch (err: any) {
      await logger.finalizeSession(err);
      throw err;
    }
  }

  /**
   * Compiles the master prompt synthesizing pedagogy, spatial anchors, and instructions
   */
  public compileMasterPrompt(
    rawPrompt: string,
    pedagogy: PedagogySpec,
    spatial: SpatialBlueprint,
    history?: Message[],
    customSystemPrompt?: string,
    isScreenAttached: boolean = false
  ): string {
    const layoutOverview = spatial.stepBlueprints
      .map(
        (s) =>
          `Step ${s.stepNumber} [${s.title}]:\n  Focal Entities: ${s.elements
            .map((e) => `${e.id} (${e.type}${e.text ? `: "${e.text}"` : ''})`)
            .join(', ')}`
      )
      .join('\n');

    const conversationContext =
      history && history.length > 0
        ? `\nONGOING TUTORIAL DIALOGUE HISTORY:\n` +
          history
            .slice(-6)
            .map((m) => {
              const clean = m.content
                .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
                .replace(/```(?:json)?[\s\S]*?```/gi, '')
                .trim();
              return `${m.role === 'user' ? 'Student' : 'Master Teacher'}: "${clean.slice(0, 300)}"`;
            })
            .join('\n') +
          '\n'
        : '';

    const systemPromptBase = customSystemPrompt?.trim() || (isScreenAttached ? UNFOLD_VISION_SYSTEM_PROMPT : UNFOLD_SYSTEM_PROMPT);

    return `[UNFOLD SYSTEM DIRECTIVE]
${systemPromptBase}

[PEDAGOGICAL & SPATIAL REASONING BLUEPRINT]
LEARNER TOPIC: "${rawPrompt}"
IDENTIFIED DOMAIN: ${pedagogy.domain.toUpperCase()}
CORE MENTAL MODEL: ${pedagogy.coreIntuition}
${conversationContext}
UNIVERSAL 4-SCENE CONTINUOUS WHITEBOARD PEDAGOGY:
${pedagogy.progressionStages
  .map(
    (p) =>
      `Scene ${p.stageNumber} [${p.title}]:\n  - Objective: ${p.objective}\n  - Teacher Voice Script: "${p.narrationScript}"`
  )
  .join('\n\n')}

SPATIAL BLUEPRINT CONSTRAINTS (Canvas 900x560):
- Origin Anchor: (${spatial.coordinateFrame.origin.x}, ${spatial.coordinateFrame.origin.y})
- Semantic Palette: Cyan (${spatial.colorPalette.primary}), Emerald (${spatial.colorPalette.secondary}), Violet (${spatial.colorPalette.accent}), Orange (${spatial.colorPalette.auxiliary}), Coral (${spatial.colorPalette.highlight})
- Planned Layout Sequence:
${layoutOverview}

INSTRUCTIONS FOR DRAWING AGENT & VOICE TEACHER:
1. MASTER-TEACHER VOICE (3Blue1Brown / Feynman):
   In BOTH Phase 2 (Markdown ### Step X) and Phase 3 (JSON "explanation" field):
   - Script LITERALLY what a master teacher speaks aloud to a student standing at the blackboard.
   - Use warm second person ("Look at this curve...", "Notice what happens when...").
   - ZERO robotic engineering directives ("Establish Set A...", "Render box at...").
   - Domain Consistency: In mathematics, NEVER speak of Python syntax or coding variables.
2. CANVAS GEOMETRY:
   - Full screen width (X: 100 to 800), height (Y: 65 to 480).
   - Strict vertical zones: Top Header (Y: 65..120), Center Focal (Y: 150..390), Bottom Footer (Y: 415..480).
3. CONTINUOUS WHITEBOARD ACCUMULATION:
   - Each step builds upon earlier elements without jarring canvas wipes.
4. Deliver all 3 phases in order:
   Phase 1: <reasoning> block with 3 deep layers (Pedagogy, Geometry, Voice Scripting).
   Phase 2: Markdown visual lesson with headers ### Step 1 through ### Step 4.
   Phase 3: Valid \`\`\`json block with "reasoning" and "steps" containing valid "elements".`;
  }

  /**
   * Resilient Parser, Schema Validator & Geometry Normalizer
   */
  public parseAndNormalizePlan(
    rawResponse: string,
    fallbackSpatial: SpatialBlueprint
  ): { steps: BlackboardStep[]; reasoning?: any; rawJson?: string } {
    let extractedReasoning: any = null;
    const reasoningMatch = rawResponse.match(/<(?:reasoning|thought)>([\s\S]*?)<\/(?:reasoning|thought)>/i);
    if (reasoningMatch) {
      extractedReasoning = {
        pedagogicalStrategy: reasoningMatch[1].trim(),
        spatialArchitecture: 'Synthesized Multi-Layer Pipeline Reasoning',
      };
    }

    // Extract rich teacher speech from Markdown step headers
    const stepMarkdownMap = new Map<number, string>();
    const stepHeaderRegex = /###\s+Step\s+(\d+)[:\s]+[^\n]*\n+([\s\S]*?)(?=(?:###\s+Step\s+\d+|```|<reasoning|$))/gi;
    let headerMatch: RegExpExecArray | null;
    while ((headerMatch = stepHeaderRegex.exec(rawResponse)) !== null) {
      const stepNum = parseInt(headerMatch[1], 10);
      const text = headerMatch[2].trim();
      if (text && text.length > 15) {
        stepMarkdownMap.set(stepNum, text);
      }
    }

    const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const rawJson = jsonMatch[1].trim();
        const parsed = JSON.parse(rawJson);
        const stepsList = Array.isArray(parsed) ? parsed : parsed.steps || [];

        if (stepsList.length > 0) {
          const steps: BlackboardStep[] = stepsList.map((s: any, idx: number) => {
            const stepNum = s.step || idx + 1;
            const mdSpeech = stepMarkdownMap.get(stepNum);

            // Filter out developer imperatives
            const isJsonRobotic = /^(establish|present|show|create|draw|display|render)\s+/i.test(
              s.explanation || ''
            );
            let explanation = s.explanation || s.description || '';
            if (mdSpeech && (isJsonRobotic || mdSpeech.length > explanation.length)) {
              explanation = mdSpeech;
            }
            if (!explanation && fallbackSpatial.stepBlueprints[idx]?.explanation) {
              explanation = fallbackSpatial.stepBlueprints[idx].explanation;
            }

            // Normalize and sanitize visual elements
            const rawElements = Array.isArray(s.elements) && s.elements.length > 0
              ? s.elements
              : fallbackSpatial.stepBlueprints[idx]?.elements || [];

            const normalizedElements = this.validateAndNormalizeElements(
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
        console.warn('Pipeline JSON parse error, falling back to deterministic spatial blueprint:', err);
      }
    }

    // Direct fallback to deterministic blueprint (preserving rich markdown teacher speech if available)
    return {
      steps: fallbackSpatial.stepBlueprints.map((s) => ({
        step: s.stepNumber,
        title: s.title,
        explanation: stepMarkdownMap.get(s.stepNumber) || s.explanation,
        elements: s.elements,
      })),
      reasoning: extractedReasoning,
      rawJson: JSON.stringify(fallbackSpatial.stepBlueprints, null, 2),
    };
  }

  /**
   * Sanitizes, clamps bounds, and normalizes visual drawing elements
   */
  public validateAndNormalizeElements(
    rawElements: any[],
    fallbackElements: DrawingElement[] = []
  ): DrawingElement[] {
    if (!Array.isArray(rawElements) || rawElements.length === 0) {
      return fallbackElements;
    }

    const normalized: DrawingElement[] = [];

    for (let i = 0; i < rawElements.length; i++) {
      const el = rawElements[i];
      if (!el || typeof el !== 'object') continue;

      const rawType = String(el.type || '').toLowerCase().trim();
      let type: DrawingElement['type'];
      if (rawType === 'rect' || rawType === 'box' || rawType === 'rectangle') {
        type = 'rect';
      } else if (rawType === 'circle' || rawType === 'point' || rawType === 'dot') {
        type = 'circle';
      } else if (rawType === 'arrow' || rawType === 'vector') {
        type = 'arrow';
      } else if (rawType === 'line' || rawType === 'segment') {
        type = 'line';
      } else if (rawType === 'path' || rawType === 'curve' || rawType === 'svg') {
        type = 'path';
      } else if (rawType === 'text' || rawType === 'label') {
        type = 'text';
      } else {
        if (typeof el.radius === 'number') type = 'circle';
        else if (typeof el.width === 'number' && typeof el.height === 'number') type = 'rect';
        else if (el.end) type = 'arrow';
        else if (el.d) type = 'path';
        else type = 'text';
      }

      const id = String(el.id || `el_${i}_${Date.now()}`);
      const color = typeof el.color === 'string' && el.color.trim() ? el.color.trim() : '#00f0ff';
      const strokeWidth =
        typeof el.strokeWidth === 'number' && el.strokeWidth > 0 ? el.strokeWidth : 2;

      // Validate & Clamp Start Point within safe canvas [20, 880], [40, 520]
      let sx = typeof el.start?.x === 'number' && !isNaN(el.start.x) ? el.start.x : 100;
      let sy = typeof el.start?.y === 'number' && !isNaN(el.start.y) ? el.start.y : 100;
      sx = Math.max(20, Math.min(880, sx));
      sy = Math.max(40, Math.min(520, sy));
      const start: Point = { x: sx, y: sy };

      const baseElement: DrawingElement = {
        id,
        type,
        color,
        strokeWidth,
        start,
      };

      if (el.text && typeof el.text === 'string') {
        baseElement.text = el.text.trim();
      }

      if (el.fill && typeof el.fill === 'string') {
        baseElement.fill = el.fill.trim();
      }

      if (type === 'rect') {
        const width = typeof el.width === 'number' && el.width > 0 ? Math.min(el.width, 860) : 160;
        const height = typeof el.height === 'number' && el.height > 0 ? Math.min(el.height, 480) : 90;
        baseElement.width = width;
        baseElement.height = height;
      } else if (type === 'circle') {
        const radius = typeof el.radius === 'number' && el.radius > 0 ? Math.min(el.radius, 260) : 25;
        baseElement.radius = radius;
      } else if (type === 'line' || type === 'arrow') {
        let ex = typeof el.end?.x === 'number' && !isNaN(el.end.x) ? el.end.x : sx + 80;
        let ey = typeof el.end?.y === 'number' && !isNaN(el.end.y) ? el.end.y : sy;
        ex = Math.max(20, Math.min(880, ex));
        ey = Math.max(40, Math.min(520, ey));
        if (ex === sx && ey === sy) {
          ex += 60;
        }
        baseElement.end = { x: ex, y: ey };
      } else if (type === 'path') {
        baseElement.d = typeof el.d === 'string' ? el.d : 'M 0 0 L 50 50';
      }

      normalized.push(baseElement);
    }

    return normalized.length > 0 ? normalized : fallbackElements;
  }
}
