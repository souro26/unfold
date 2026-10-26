import { BlackboardStep, DrawingElement } from '../types';
import type { PedagogyMilestone, PedagogySpec, SpatialBlueprint } from './AgentOrchestrator';
import { appendLogFile, writeLogFile } from './ipc';

export interface DecisionLogSessionData {
  sessionId: string;
  timestamp: string;
  localTime: string;
  userPrompt: string;
  conversationId: string;
  hasScreenCapture: boolean;
  screenCaptureBytes?: number;

  // Fold 1
  pedagogy?: PedagogySpec;

  // Fold 2
  spatialBlueprint?: SpatialBlueprint;

  // Fold 3
  masterPrompt?: string;

  // Fold 4
  llmInference?: {
    provider: string;
    model: string;
    durationMs: number;
    rawResponse: string;
  };

  // Fold 5
  planParsing?: {
    success: boolean;
    stepsCount: number;
    totalElements: number;
    extractedJson?: string;
  };

  // Fold 6
  drawingDispatch?: {
    engine: string;
    stepsCount: number;
    totalElementsCount: number;
    narrationScripts: string[];
    steps: BlackboardStep[];
  };

  durationMs?: number;
  status: 'IN_PROGRESS' | 'SUCCESS' | 'ERROR';
  errorMessage?: string;
}

export class DecisionEngineLogger {
  private static instance: DecisionEngineLogger;
  private currentSession: DecisionLogSessionData | null = null;
  private sessionStartTime: number = 0;

  private constructor() {}

  public static getInstance(): DecisionEngineLogger {
    if (!DecisionEngineLogger.instance) {
      DecisionEngineLogger.instance = new DecisionEngineLogger();
    }
    return DecisionEngineLogger.instance;
  }

  /**
   * Starts a new audit session for an incoming user prompt.
   */
  public startSession(userPrompt: string, conversationId: string = 'default', imageBase64?: string): void {
    const now = new Date();
    const timestamp = now.toISOString();
    const localTime = now.toLocaleString();
    const slug = userPrompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .slice(0, 32)
      .replace(/^_+|_+$/g, '') || 'prompt';
    const sessionId = `session_${timestamp.replace(/[:.]/g, '-')}_${slug}`;

    this.sessionStartTime = Date.now();
    this.currentSession = {
      sessionId,
      timestamp,
      localTime,
      userPrompt,
      conversationId,
      hasScreenCapture: Boolean(imageBase64 && imageBase64.length > 0),
      screenCaptureBytes: imageBase64 ? imageBase64.length : 0,
      status: 'IN_PROGRESS',
    };

    console.log(`%c[UNFOLD DECISION ENGINE: SESSION STARTED] %c"${userPrompt}" (ID: ${sessionId})`, 'color: #00f0ff; font-weight: bold;', 'color: #fff;');
  }

  /**
   * Fold 1: Pedagogical Deconstruction Logging
   */
  public logFold1Pedagogy(pedagogy: PedagogySpec): void {
    if (!this.currentSession) return;
    this.currentSession.pedagogy = pedagogy;

    console.groupCollapsed(`%c[FOLD 1: PEDAGOGY] Domain: ${pedagogy.domain.toUpperCase()} | Concept: "${pedagogy.concept}"`, 'color: #50fa7b; font-weight: bold;');
    console.log('Core Mental Model:', pedagogy.coreIntuition);
    console.log('Misconceptions:', pedagogy.commonMisconceptions);
    console.log('Progression Stages:', pedagogy.progressionStages);
    console.groupEnd();
  }

  /**
   * Fold 2: Spatial Blueprint Logging
   */
  public logFold2Spatial(spatial: SpatialBlueprint): void {
    if (!this.currentSession) return;
    this.currentSession.spatialBlueprint = spatial;

    const totalElements = spatial.stepBlueprints.reduce((acc: number, s) => acc + s.elements.length, 0);
    console.groupCollapsed(`%c[FOLD 2: SPATIAL BLUEPRINT] Canvas: ${spatial.coordinateFrame.width}x${spatial.coordinateFrame.height} | Scenes: ${spatial.stepBlueprints.length} | Elements: ${totalElements}`, 'color: #bd93f9; font-weight: bold;');
    console.log('Coordinate Frame:', spatial.coordinateFrame);
    console.log('Color Palette:', spatial.colorPalette);
    console.log('Scenes Blueprint:', spatial.stepBlueprints);
    console.groupEnd();
  }

  /**
   * Fold 3: Master Drawing Agent Prompt Logging
   */
  public logFold3Prompt(masterPrompt: string): void {
    if (!this.currentSession) return;
    this.currentSession.masterPrompt = masterPrompt;

    console.groupCollapsed(`%c[FOLD 3: MASTER PROMPT SENT TO LLM] Length: ${masterPrompt.length} chars`, 'color: #ffb86c; font-weight: bold;');
    console.log(masterPrompt);
    console.groupEnd();
  }

  /**
   * Fold 4: LLM Inference Result Logging
   */
  public logFold4Inference(provider: string, model: string, durationMs: number, rawResponse: string): void {
    if (!this.currentSession) return;
    this.currentSession.llmInference = {
      provider,
      model,
      durationMs,
      rawResponse,
    };

    console.groupCollapsed(`%c[FOLD 4: LLM INFERENCE] Provider: ${provider} | Model: ${model} | ${durationMs}ms`, 'color: #ff79c6; font-weight: bold;');
    console.log('Raw Model Output:\n', rawResponse);
    console.groupEnd();
  }

  /**
   * Fold 5: Plan Parsing Logging
   */
  public logFold5Plan(plan: { steps: BlackboardStep[] }, rawJson?: string): void {
    if (!this.currentSession) return;
    const totalElements = plan.steps.reduce((acc: number, s: BlackboardStep) => acc + (s.elements ? s.elements.length : 0), 0);
    this.currentSession.planParsing = {
      success: plan.steps.length > 0,
      stepsCount: plan.steps.length,
      totalElements,
      extractedJson: rawJson,
    };

    console.groupCollapsed(`%c[FOLD 5: PLAN COMPILATION] Parsed ${plan.steps.length} steps | ${totalElements} total visual elements`, 'color: #8be9fd; font-weight: bold;');
    console.log('Parsed Steps:', plan.steps);
    console.groupEnd();
  }

  /**
   * Fold 6: Drawing Mechanism Dispatch Logging
   */
  public logFold6DrawingDispatch(
    steps: BlackboardStep[],
    engine: string = 'Rough.js Chalkboard (CanvasKit GPU Fallback)',
    narrationScripts: string[] = []
  ): void {
    if (!this.currentSession) return;
    const totalElementsCount = steps.reduce((acc: number, s: BlackboardStep) => acc + (s.elements ? s.elements.length : 0), 0);
    const scripts = narrationScripts.length > 0 ? narrationScripts : steps.map((s) => s.explanation || s.title);

    this.currentSession.drawingDispatch = {
      engine,
      stepsCount: steps.length,
      totalElementsCount,
      narrationScripts: scripts,
      steps,
    };

    console.groupCollapsed(`%c[FOLD 6: DRAWING DISPATCH] Dispatched to ${engine} | ${steps.length} scenes | ${totalElementsCount} elements`, 'color: #f1fa8c; font-weight: bold;');
    console.log('Drawing Steps Dispatched:', steps);
    console.log('Narration Scripts Queued:', scripts);
    console.groupEnd();
  }

  /**
   * Finalizes the session, writes all formatted log files to the logs folder:
   * 1. `logs/decision_engine_<timestamp>_<slug>.log`
   * 2. `logs/decision_engine_<timestamp>_<slug>.json`
   * 3. `logs/latest.log` (always contains the most recent run)
   * 4. Appends one-line index entry to `logs/history.log`
   */
  public async finalizeSession(error?: Error | string): Promise<string> {
    if (!this.currentSession) return '';

    this.currentSession.durationMs = Date.now() - this.sessionStartTime;
    if (error) {
      this.currentSession.status = 'ERROR';
      this.currentSession.errorMessage = typeof error === 'string' ? error : error.message;
    } else {
      this.currentSession.status = 'SUCCESS';
    }

    const session = this.currentSession;
    const formattedLog = this.formatHumanReadableLog(session);
    const jsonLog = JSON.stringify(session, null, 2);

    const safeSlug = session.userPrompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .slice(0, 24)
      .replace(/^_+|_+$/g, '') || 'run';
    const timestampKey = session.timestamp.replace(/[:.]/g, '-');
    const filenameLog = `decision_engine_${timestampKey}_${safeSlug}.log`;
    const filenameJson = `decision_engine_${timestampKey}_${safeSlug}.json`;

    try {
      // 1. Write dedicated timestamped .log
      await writeLogFile(filenameLog, formattedLog);

      // 2. Write dedicated timestamped .json
      await writeLogFile(filenameJson, jsonLog);

      // 3. Update latest.log with the latest full output
      await writeLogFile('latest.log', formattedLog);

      // 4. Append to chronological history.log
      const historyEntry = `[${session.timestamp}] [${session.status}] (${session.durationMs}ms) Prompt: "${session.userPrompt}" -> Domain: ${session.pedagogy?.domain || 'unknown'} -> Steps: ${session.drawingDispatch?.stepsCount || 0} -> Log: ${filenameLog}\n`;
      await appendLogFile('history.log', historyEntry);

      console.log(`%c[UNFOLD DECISION ENGINE: AUDIT LOG SAVED] %clogs/${filenameLog} & logs/latest.log`, 'color: #50fa7b; font-weight: bold;', 'color: #fff;');
    } catch (writeErr) {
      console.warn('Failed to persist audit log to disk:', writeErr);
    }

    return formattedLog;
  }

  /**
   * Generates a comprehensive, human-readable markdown/text log report.
   */
  private formatHumanReadableLog(s: DecisionLogSessionData): string {
    const sep = '='.repeat(80);
    const subSep = '-'.repeat(80);

    let output = '';
    output += `${sep}\n`;
    output += `UNFOLD DECISION ENGINE & DRAWING MECHANISM AUDIT LOG\n`;
    output += `${sep}\n`;
    output += `Session ID:       ${s.sessionId}\n`;
    output += `Timestamp:        ${s.timestamp} (Local: ${s.localTime})\n`;
    output += `Conversation ID:  ${s.conversationId}\n`;
    output += `Status:           ${s.status}${s.errorMessage ? ` (Error: ${s.errorMessage})` : ''}\n`;
    output += `Total Duration:   ${s.durationMs ?? 0} ms\n`;
    output += `User Prompt:      "${s.userPrompt}"\n`;
    output += `Screen Capture:   ${s.hasScreenCapture ? `Yes (${s.screenCaptureBytes} bytes base64)` : 'No'}\n`;
    output += `${sep}\n\n`;

    // ---------------------------------------------------------
    // Fold 1: Pedagogical Deconstruction
    // ---------------------------------------------------------
    output += `${subSep}\n`;
    output += `[FOLD 1: INTENT & PEDAGOGICAL DECONSTRUCTION AGENT]\n`;
    output += `${subSep}\n`;
    if (s.pedagogy) {
      output += `Identified Domain:       ${s.pedagogy.domain.toUpperCase()}\n`;
      output += `Clean Concept/Topic:     "${s.pedagogy.concept}"\n`;
      output += `Core Mental Intuition:   ${s.pedagogy.coreIntuition}\n\n`;

      output += `Common Misconceptions Identified:\n`;
      s.pedagogy.commonMisconceptions.forEach((m: string, idx: number) => {
        output += `  ${idx + 1}. ${m}\n`;
      });
      output += `\n`;

      output += `Progressive Pedagogical Stages (${s.pedagogy.progressionStages.length} Scenes):\n`;
      s.pedagogy.progressionStages.forEach((stage: PedagogyMilestone) => {
        output += `  [Scene ${stage.stageNumber}] Title: "${stage.title}"\n`;
        output += `    Objective:        ${stage.objective}\n`;
        output += `    Narration Script: "${stage.narrationScript}"\n`;
      });
    } else {
      output += `(Fold 1 pedagogy not executed or pending)\n`;
    }
    output += `\n`;

    // ---------------------------------------------------------
    // Fold 2: Spatial Blueprint & Coordinate Geometry
    // ---------------------------------------------------------
    output += `${subSep}\n`;
    output += `[FOLD 2: SPATIAL BLUEPRINT & COORDINATE GEOMETRY AGENT]\n`;
    output += `${subSep}\n`;
    if (s.spatialBlueprint) {
      const cf = s.spatialBlueprint.coordinateFrame;
      output += `Coordinate Frame Bounds: ${cf.width} x ${cf.height} (Origin: x=${cf.origin.x}, y=${cf.origin.y}, Axes=${cf.showAxes})\n`;
      output += `Semantic Color Palette:\n`;
      output += `  Primary:    ${s.spatialBlueprint.colorPalette.primary}\n`;
      output += `  Secondary:  ${s.spatialBlueprint.colorPalette.secondary}\n`;
      output += `  Accent:     ${s.spatialBlueprint.colorPalette.accent}\n`;
      output += `  Highlight:  ${s.spatialBlueprint.colorPalette.highlight}\n`;
      output += `  Auxiliary:  ${s.spatialBlueprint.colorPalette.auxiliary}\n`;
      output += `  Text Chalk: ${s.spatialBlueprint.colorPalette.text}\n\n`;

      output += `Spatial Scene Blueprints (${s.spatialBlueprint.stepBlueprints.length} Scenes):\n`;
      s.spatialBlueprint.stepBlueprints.forEach((sb: any) => {
        output += `  Scene ${sb.stepNumber}: "${sb.title}" (${sb.elements.length} elements)\n`;
        output += `    Explanation: "${sb.explanation}"\n`;
        output += `    Elements:\n`;
        sb.elements.forEach((el: DrawingElement, elIdx: number) => {
          output += `      [${elIdx + 1}] type=${el.type} id="${el.id}" color=${el.color} strokeWidth=${el.strokeWidth || 2}`;
          if (el.start) output += ` start=(${el.start.x},${el.start.y})`;
          if (el.end) output += ` end=(${el.end.x},${el.end.y})`;
          if (el.radius !== undefined) output += ` radius=${el.radius}`;
          if (el.width !== undefined && el.height !== undefined) output += ` size=${el.width}x${el.height}`;
          if (el.text) output += ` text="${el.text}"`;
          if (el.d) output += ` path="${el.d}"`;
          output += `\n`;
        });
      });
    } else {
      output += `(Fold 2 spatial blueprint not executed or pending)\n`;
    }
    output += `\n`;

    // ---------------------------------------------------------
    // Fold 3: Master Drawing Agent Prompt
    // ---------------------------------------------------------
    output += `${subSep}\n`;
    output += `[FOLD 3: MASTER DRAWING AGENT PROMPT SYNTHESIS]\n`;
    output += `${subSep}\n`;
    output += `EXACT VERBATIM PROMPT SENT TO LLM / DRAWING AGENT:\n`;
    output += `${subSep}\n`;
    output += s.masterPrompt || '(No master prompt generated)';
    output += `\n${subSep}\n\n`;

    // ---------------------------------------------------------
    // Fold 4: LLM Inference & Raw Model Output
    // ---------------------------------------------------------
    output += `${subSep}\n`;
    output += `[FOLD 4: LLM INFERENCE & RAW MODEL RESPONSE]\n`;
    output += `${subSep}\n`;
    if (s.llmInference) {
      output += `Provider:         ${s.llmInference.provider}\n`;
      output += `Model:            ${s.llmInference.model}\n`;
      output += `Inference Time:   ${s.llmInference.durationMs} ms\n`;
      output += `EXACT VERBATIM RAW MODEL RESPONSE:\n`;
      output += `${subSep}\n`;
      output += s.llmInference.rawResponse;
      output += `\n${subSep}\n`;
    } else {
      output += `(Fold 4 LLM inference not recorded or pending)\n`;
    }
    output += `\n`;

    // ---------------------------------------------------------
    // Fold 5: Plan Compilation & Parsing
    // ---------------------------------------------------------
    output += `${subSep}\n`;
    output += `[FOLD 5: PLAN COMPILATION & JSON VALIDATION]\n`;
    output += `${subSep}\n`;
    if (s.planParsing) {
      output += `Parsing Success:      ${s.planParsing.success}\n`;
      output += `Extracted Steps:      ${s.planParsing.stepsCount}\n`;
      output += `Total Elements:       ${s.planParsing.totalElements}\n`;
      if (s.planParsing.extractedJson) {
        output += `Extracted JSON Block:\n`;
        output += s.planParsing.extractedJson;
        output += `\n`;
      }
    } else {
      output += `(Fold 5 plan parsing not recorded)\n`;
    }
    output += `\n`;

    // ---------------------------------------------------------
    // Fold 6: Drawing Mechanism Dispatch
    // ---------------------------------------------------------
    output += `${subSep}\n`;
    output += `[FOLD 6: DRAWING MECHANISM DISPATCH (WHAT GOES TO THE DRAWING MECHANISM)]\n`;
    output += `${subSep}\n`;
    if (s.drawingDispatch) {
      output += `Drawing Engine:            ${s.drawingDispatch.engine}\n`;
      output += `Dispatched Scenes:         ${s.drawingDispatch.stepsCount}\n`;
      output += `Total Visual Elements:     ${s.drawingDispatch.totalElementsCount}\n\n`;

      output += `Step-by-Step Drawing & Narration Payloads:\n`;
      s.drawingDispatch.steps.forEach((step, stepIdx) => {
        output += `  [Step ${step.step ?? stepIdx + 1}] Title: "${step.title}"\n`;
        const script = s.drawingDispatch?.narrationScripts[stepIdx] || step.explanation || '';
        output += `    Narration Script (Web Speech API): "${script}"\n`;
        output += `    Visual Elements Dispatched to Canvas (${step.elements?.length || 0}):\n`;
        (step.elements || []).forEach((el: DrawingElement, eIdx: number) => {
          output += `      (${eIdx + 1}) type=${el.type} id="${el.id}" color=${el.color} strokeWidth=${el.strokeWidth || 2}`;
          if (el.start) output += ` start=(${el.start.x},${el.start.y})`;
          if (el.end) output += ` end=(${el.end.x},${el.end.y})`;
          if (el.radius !== undefined) output += ` radius=${el.radius}`;
          if (el.width !== undefined && el.height !== undefined) output += ` size=${el.width}x${el.height}`;
          if (el.text) output += ` text="${el.text}"`;
          if (el.d) output += ` path="${el.d}"`;
          output += `\n`;
        });
      });
    } else {
      output += `(Fold 6 drawing dispatch not recorded)\n`;
    }

    output += `\n${sep}\n`;
    output += `END OF AUDIT LOG - UNFOLD DECISION ENGINE\n`;
    output += `${sep}\n`;

    return output;
  }
}
