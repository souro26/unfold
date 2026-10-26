import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DecisionEngineLogger } from '../src/services/DecisionEngineLogger';
import { AgentOrchestrator } from '../src/services/AgentOrchestrator';
import * as ipc from '../src/services/ipc';

describe('DecisionEngineLogger & Full-Pipeline Audit Logging', () => {
  let writtenFiles: Record<string, string> = {};
  let appendedFiles: Record<string, string> = {};

  beforeEach(() => {
    writtenFiles = {};
    appendedFiles = {};

    vi.spyOn(ipc, 'writeLogFile').mockImplementation(async (filename: string, content: string) => {
      writtenFiles[filename] = content;
      return `logs/${filename}`;
    });

    vi.spyOn(ipc, 'appendLogFile').mockImplementation(async (filename: string, content: string) => {
      appendedFiles[filename] = (appendedFiles[filename] || '') + content;
      return `logs/${filename}`;
    });
  });

  it('Captures every single fold of the decision engine and drawing mechanism', async () => {
    const logger = DecisionEngineLogger.getInstance();
    logger.startSession('explain a tangent', 'test-conv-101');

    // Fold 1
    logger.logFold1Pedagogy({
      concept: 'Tangent to a Circle',
      domain: 'mathematics',
      coreIntuition: 'Instantaneous direction of a curve at a single point.',
      commonMisconceptions: ['Confusing tangent with secant'],
      progressionStages: [
        { stageNumber: 1, title: 'The Circle', objective: 'Draw circle and radius', narrationScript: 'We begin with a circle.' },
        { stageNumber: 2, title: 'The Tangent Line', objective: 'Draw line touching at 1 point', narrationScript: 'Line touches at point P.' },
        { stageNumber: 3, title: 'Secant vs Tangent', objective: 'Contrast with 2-point secant', narrationScript: 'Secant cuts through 2 points.' },
        { stageNumber: 4, title: 'Perpendicularity', objective: 'Show 90 degree angle', narrationScript: 'Tangent is at 90 degrees.' },
      ],
    });

    // Fold 2
    logger.logFold2Spatial({
      coordinateFrame: { origin: { x: 440, y: 250 }, width: 900, height: 560, showAxes: true },
      colorPalette: {
        primary: '#00f0ff',
        secondary: '#50fa7b',
        accent: '#bd93f9',
        highlight: '#ff79c6',
        auxiliary: '#ffb86c',
        text: '#f8f8f2',
      },
      stepBlueprints: [
        {
          stepNumber: 1,
          title: 'The Circle',
          explanation: 'Circle centered at (440,250)',
          elements: [
            { id: 'c1', type: 'circle', color: '#00f0ff', strokeWidth: 3, start: { x: 440, y: 250 }, radius: 120 },
            { id: 'p', type: 'circle', color: '#50fa7b', strokeWidth: 4, start: { x: 440, y: 130 }, radius: 7, text: 'P' },
          ],
        },
      ],
    });

    // Fold 3
    const testMasterPrompt = '[UNFOLD MASTER PROMPT] Synthesize 4 scenes with exact coordinates';
    logger.logFold3Prompt(testMasterPrompt);

    // Fold 4
    logger.logFold4Inference('nvidia', 'nvidia/nemotron-3.5-bolt-e4b', 850, '```json\n{"steps":[{"step":1,"title":"The Circle","elements":[]}]}\n```');

    // Fold 5
    logger.logFold5Plan({
      steps: [
        {
          step: 1,
          title: 'The Circle',
          explanation: 'Step 1 explanation',
          elements: [{ id: 'c1', type: 'circle', color: '#00f0ff', start: { x: 440, y: 250 }, radius: 120 }],
        },
      ],
    });

    // Fold 6
    logger.logFold6DrawingDispatch(
      [
        {
          step: 1,
          title: 'The Circle',
          explanation: 'Step 1 narration',
          elements: [{ id: 'c1', type: 'circle', color: '#00f0ff', start: { x: 440, y: 250 }, radius: 120 }],
        },
      ],
      'Rough.js Chalkboard Engine',
      ['We begin with a circle centered at O.']
    );

    const logOutput = await logger.finalizeSession();

    // Verify written log files: latest.log, decision_engine_*.log, decision_engine_*.json, history.log
    expect(writtenFiles['latest.log']).toBeDefined();
    expect(writtenFiles['latest.log']).toContain('UNFOLD DECISION ENGINE & DRAWING MECHANISM AUDIT LOG');
    expect(writtenFiles['latest.log']).toContain('[FOLD 1: INTENT & PEDAGOGICAL DECONSTRUCTION AGENT]');
    expect(writtenFiles['latest.log']).toContain('[FOLD 2: SPATIAL BLUEPRINT & COORDINATE GEOMETRY AGENT]');
    expect(writtenFiles['latest.log']).toContain('[FOLD 3: MASTER DRAWING AGENT PROMPT SYNTHESIS]');
    expect(writtenFiles['latest.log']).toContain('[FOLD 4: LLM INFERENCE & RAW MODEL RESPONSE]');
    expect(writtenFiles['latest.log']).toContain('[FOLD 5: PLAN COMPILATION & JSON VALIDATION]');
    expect(writtenFiles['latest.log']).toContain('[FOLD 6: DRAWING MECHANISM DISPATCH (WHAT GOES TO THE DRAWING MECHANISM)]');

    // Verify exact prompt and elements recorded
    expect(writtenFiles['latest.log']).toContain(testMasterPrompt);
    expect(writtenFiles['latest.log']).toContain('nvidia/nemotron-3.5-bolt-e4b');
    expect(writtenFiles['latest.log']).toContain('Rough.js Chalkboard Engine');
    expect(writtenFiles['latest.log']).toContain('We begin with a circle centered at O.');
    expect(writtenFiles['latest.log']).toContain('start=(440,250)');

    // Verify history.log append
    expect(appendedFiles['history.log']).toBeDefined();
    expect(appendedFiles['history.log']).toContain('explain a tangent');
  });

  it('Automatically logs all folds when AgentOrchestrator.executePipeline is called', async () => {
    vi.spyOn(ipc, 'sendMessage').mockResolvedValue(`
# Understanding Tangents
\`\`\`json
{
  "steps": [
    { "step": 1, "title": "The Circle", "explanation": "Circle foundation", "elements": [] }
  ]
}
\`\`\`
    `);

    const orchestrator = AgentOrchestrator.getInstance();
    await orchestrator.executePipeline('explain gravity and freefall', 'test-conv-202');

    expect(writtenFiles['latest.log']).toBeDefined();
    expect(writtenFiles['latest.log']).toContain('explain gravity and freefall');
    expect(writtenFiles['latest.log']).toContain('PHYSICS');
    expect(writtenFiles['latest.log']).toContain('[FOLD 1: INTENT & PEDAGOGICAL DECONSTRUCTION AGENT]');
    expect(writtenFiles['latest.log']).toContain('[FOLD 2: SPATIAL BLUEPRINT & COORDINATE GEOMETRY AGENT]');
    expect(writtenFiles['latest.log']).toContain('[FOLD 3: MASTER DRAWING AGENT PROMPT SYNTHESIS]');
    expect(writtenFiles['latest.log']).toContain('[FOLD 4: LLM INFERENCE & RAW MODEL RESPONSE]');
    expect(writtenFiles['latest.log']).toContain('[FOLD 6: DRAWING MECHANISM DISPATCH (WHAT GOES TO THE DRAWING MECHANISM)]');
  });
});
