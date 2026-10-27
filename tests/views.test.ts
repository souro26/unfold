import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HomeView } from '../src/views/HomeView';
import { ScreenTeachView } from '../src/views/ScreenTeachView';
import { BlackboardView } from '../src/views/BlackboardView';
import { RoughRenderer } from '../src/renderer-rough';
import { ExportService } from '../src/services/export';

describe('Views and Navigation', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="emptyState" class="empty-state">
        <button id="screenTeachMode"></button>
        <button id="blackboardMode"></button>
      </div>
      <div class="app"></div>
      <div class="screen-teach-container" id="screenTeachContainer">
        <video class="screen-teach-video" id="screenTeachVideo"></video>
        <div class="screen-teach-status-pill" id="screenTeachStatusPill">
          <span class="pulse-indicator"></span>
          <span id="screenTeachStatusText">Observing Screen</span>
          <button id="screenTeachChangeBtn"></button>
        </div>
        <div class="screen-teach-prompt-card" id="screenTeachPromptCard">
          <p>Select screen</p>
          <button id="screenTeachGrantBtn"></button>
        </div>
      </div>
      <div id="vizOverlay" class="visualization-overlay">
        <canvas id="vizCanvas"></canvas>
        <button id="vizRenderModeBtn"><span id="vizRenderModeLabel">🎨 Chalkboard</span></button>
        <button id="vizPresentation"></button>
        <button id="vizClose"></button>
        <button id="vizFullscreen"></button>
        <button id="stepPrev"></button>
        <button id="stepNext"></button>
        <button id="stepPlay"></button>
        <button id="stepVoice"></button>
        <span id="stepIndicator"></span>
        <span id="vizTitle"></span>
        <span id="vizDescription"></span>

        <div id="presentationHud" class="presentation-hud">
          <button id="hudPrev"></button>
          <span id="hudStepBadge"></span>
          <button id="hudPlay"></button>
          <button id="hudNext"></button>
          <button id="hudExit"></button>
        </div>
      </div>
    `;
  });

  it('HomeView shows and hides properly and triggers callbacks', () => {
    const onStartScreenTeach = vi.fn();
    const onStartBlackboard = vi.fn();
    const homeView = new HomeView({ onStartScreenTeach, onStartBlackboard });

    expect(homeView.isVisible()).toBe(true);
    homeView.hide();
    expect(homeView.isVisible()).toBe(false);
    homeView.show();
    expect(homeView.isVisible()).toBe(true);

    const screenBtn = document.getElementById('screenTeachMode');
    screenBtn?.click();
    expect(onStartScreenTeach).toHaveBeenCalledTimes(1);

    const bbBtn = document.getElementById('blackboardMode');
    bbBtn?.click();
    expect(onStartBlackboard).toHaveBeenCalledTimes(1);
  });

  it('ScreenTeachView toggles screen-overlay-mode classes on enter and exit', () => {
    const onExit = vi.fn();
    const screenView = new ScreenTeachView({ onExit });

    expect(screenView.isActive()).toBe(false);
    screenView.enter();
    expect(screenView.isActive()).toBe(true);
    expect(document.body.classList.contains('screen-overlay-mode')).toBe(true);

    screenView.exit();
    expect(screenView.isActive()).toBe(false);
    expect(document.body.classList.contains('screen-overlay-mode')).toBe(false);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('ScreenTeachView manages live screen sharing stream and handles stream ending', async () => {
    const onExit = vi.fn();
    const screenView = new ScreenTeachView({ onExit });

    const mockTrack = {
      stop: vi.fn(),
      addEventListener: vi.fn(),
      onended: null as any,
    };
    const mockStream = {
      active: true,
      getVideoTracks: vi.fn().mockReturnValue([mockTrack]),
      getTracks: vi.fn().mockReturnValue([mockTrack]),
    };

    // Mock navigator.mediaDevices.getDisplayMedia
    const originalMediaDevices = navigator.mediaDevices;
    (navigator as any).mediaDevices = {
      getDisplayMedia: vi.fn().mockResolvedValue(mockStream),
    };

    const statusPill = document.getElementById('screenTeachStatusPill');
    const promptCard = document.getElementById('screenTeachPromptCard');
    const video = document.getElementById('screenTeachVideo') as HTMLVideoElement;
    if (video) {
      video.play = vi.fn().mockResolvedValue(undefined);
    }

    await screenView.enter();
    expect(screenView.isActive()).toBe(true);
    expect(statusPill?.classList.contains('active')).toBe(true);
    expect(promptCard?.classList.contains('hidden')).toBe(true);
    expect(video?.classList.contains('has-stream')).toBe(true);

    // Simulate user ending stream from browser banner
    if (mockTrack.onended) {
      mockTrack.onended(new Event('ended'));
    }
    expect(statusPill?.classList.contains('active')).toBe(false);
    expect(promptCard?.classList.contains('hidden')).toBe(false);

    // Re-share and test exit() stopping active tracks
    await screenView.requestScreenShare();
    expect(statusPill?.classList.contains('active')).toBe(true);
    screenView.exit();
    expect(screenView.isActive()).toBe(false);
    expect(mockTrack.stop).toHaveBeenCalled();

    (navigator as any).mediaDevices = originalMediaDevices;
  });

  it('BlackboardView opens steps and navigates between steps', async () => {
    const bbView = new BlackboardView();
    expect(bbView.isOpen()).toBe(false);

    const steps = [
      { step: 1, title: 'Step 1 Title', explanation: 'Step 1 Details' },
      { step: 2, title: 'Step 2 Title', explanation: 'Step 2 Details' },
    ];

    await bbView.open(steps);
    expect(bbView.isOpen()).toBe(true);
    expect(document.getElementById('vizTitle')?.textContent).toBe('Step 1 Title');

    bbView.nextStep();
    expect(document.getElementById('vizTitle')?.textContent).toBe('Step 2 Title');

    bbView.prevStep();
    expect(document.getElementById('vizTitle')?.textContent).toBe('Step 1 Title');

    bbView.close();
    expect(bbView.isOpen()).toBe(false);
  });

  it('BlackboardView enters and exits Presentation Mode cleanly', async () => {
    const bbView = new BlackboardView();
    const steps = [
      { step: 1, title: 'Architecture Overview', explanation: 'Node topologies' },
      { step: 2, title: 'State Replication', explanation: 'Log consensus' },
    ];

    await bbView.open(steps);
    expect(bbView.isPresentationMode()).toBe(false);

    // Enter presentation mode
    bbView.enterPresentationMode();
    expect(bbView.isPresentationMode()).toBe(true);
    expect(document.getElementById('vizOverlay')?.classList.contains('presentation-mode')).toBe(true);
    expect(document.getElementById('hudStepBadge')?.textContent).toContain('Step 1 of 2');

    // Next step in presentation
    bbView.nextStep();
    expect(document.getElementById('hudStepBadge')?.textContent).toContain('Step 2 of 2');

    // Exit presentation mode
    bbView.exitPresentationMode();
    expect(bbView.isPresentationMode()).toBe(false);
    expect(document.getElementById('vizOverlay')?.classList.contains('presentation-mode')).toBe(false);
  });

  it('BlackboardView exportDiagram triggers ExportService download for all supported formats', async () => {
    const bbView = new BlackboardView();
    const steps = [
      { step: 1, title: 'Step 1 Title', explanation: 'Step 1 Details' },
    ];
    await bbView.open(steps);

    const downloadSpy = vi.spyOn(ExportService, 'downloadFile').mockImplementation(() => {});

    bbView.exportDiagram('manim');
    expect(downloadSpy).toHaveBeenCalledWith('scene.py', expect.stringContaining('from manim import *'), 'text/x-python');

    bbView.exportDiagram('mermaid');
    expect(downloadSpy).toHaveBeenCalledWith('diagram.mmd', expect.stringContaining('flowchart TD'), 'text/vnd.mermaid');

    bbView.exportDiagram('plantuml');
    expect(downloadSpy).toHaveBeenCalledWith('diagram.puml', expect.stringContaining('@startuml'), 'text/plain');

    bbView.exportDiagram('excalidraw');
    expect(downloadSpy).toHaveBeenCalledWith('diagram.excalidraw', expect.stringContaining('"type": "excalidraw"'), 'application/json');

    downloadSpy.mockRestore();
  });

  it('BlackboardView handles advanced gestures: pinch-zoom, rotate, pan, and reset', async () => {
    const bbView = new BlackboardView();
    const steps = [
      { step: 1, title: 'Step 1 Title', explanation: 'Step 1 Details' },
    ];
    await bbView.open(steps);

    // Initial viewport
    expect(bbView.getViewport()).toEqual({
      zoom: 1.0,
      rotation: 0,
      panX: 0,
      panY: 0,
    });

    // Pinch-zoom
    bbView.handlePinchZoom(1.5);
    expect(bbView.getViewport().zoom).toBe(1.5);

    // Rotate
    bbView.handleRotate(Math.PI / 4);
    expect(bbView.getViewport().rotation).toBeCloseTo(Math.PI / 4, 4);

    // Pan
    bbView.handlePan(45, -30);
    expect(bbView.getViewport().panX).toBe(45);
    expect(bbView.getViewport().panY).toBe(-30);

    // Reset viewport
    bbView.resetViewport();
    expect(bbView.getViewport()).toEqual({
      zoom: 1.0,
      rotation: 0,
      panX: 0,
      panY: 0,
    });
  });

  it('BlackboardView toggles between Motion Graphics, Chalkboard, and Precision render engines', async () => {
    const bbView = new BlackboardView();
    expect(bbView.getRenderEngine()).toBe('motion');

    // Toggle via method: motion -> rough
    bbView.toggleRenderEngine();
    expect(bbView.getRenderEngine()).toBe('rough');
    expect(document.getElementById('vizRenderModeLabel')?.textContent).toBe('🎨 Chalkboard');

    // Toggle via method: rough -> skia
    bbView.toggleRenderEngine();
    expect(bbView.getRenderEngine()).toBe('skia');
    expect(document.getElementById('vizRenderModeLabel')?.textContent).toBe('📐 Precision');

    // Toggle via UI button click: skia -> motion
    const toggleBtn = document.getElementById('vizRenderModeBtn');
    toggleBtn?.click();
    expect(bbView.getRenderEngine()).toBe('motion');
    expect(document.getElementById('vizRenderModeLabel')?.textContent).toBe('🎬 Motion Video');
  });

  it('RoughRenderer handles step rendering, SVG paths, shapes, and progressive animation safely', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;

    const renderer = new RoughRenderer();
    renderer.attach(canvas);

    const step = {
      step: 1,
      title: 'Geometric Chalkboard Concepts',
      explanation: 'Rough sketch with shapes and SVG path',
      elements: [
        { id: '1', type: 'rect' as const, start: { x: 50, y: 50 }, width: 120, height: 80, text: 'Block A' },
        { id: '2', type: 'circle' as const, start: { x: 300, y: 150 }, radius: 45, text: 'Origin' },
        { id: '3', type: 'line' as const, start: { x: 50, y: 50 }, end: { x: 200, y: 120 }, text: 'Vector' },
        { id: '4', type: 'arrow' as const, start: { x: 200, y: 120 }, end: { x: 350, y: 220 }, text: 'Flow' },
        { id: '5', type: 'path' as const, d: 'M 10 80 Q 95 10 180 80 T 350 80', text: 'Bezier Curve' },
        { id: '6', type: 'pen' as const, points: [{ x: 10, y: 10 }, { x: 20, y: 25 }, { x: 40, y: 35 }] },
        { id: '7', type: 'text' as const, start: { x: 100, y: 300 }, text: 'Definitive Takeaway' },
      ],
    };

    // Safe execution without crashing in node/JSDOM
    expect(() => {
      renderer.renderStep(step, { zoom: 1.2, rotation: 15, panX: 10, panY: -20 });
    }).not.toThrow();

    expect(() => {
      renderer.animateStep(step, 100);
      renderer.stopAnimation();
    }).not.toThrow();

    renderer.detach();
    expect(renderer.isAvailable()).toBe(false);
  });

  it('BlackboardView accumulates elements across scenes for continuous whiteboard video drawing', async () => {
    const bbView = new BlackboardView();
    const steps = [
      {
        step: 1,
        title: 'Circle Foundation',
        explanation: 'We draw the base circle with center O.',
        elements: [
          { id: 'c1', type: 'circle' as const, start: { x: 450, y: 280 }, radius: 100 },
          { id: 'pt_o', type: 'circle' as const, start: { x: 450, y: 280 }, radius: 4, text: 'O' },
        ],
      },
      {
        step: 2,
        title: 'Tangent Line',
        explanation: 'Now we draw the tangent line touching at point P.',
        elements: [
          { id: 'tangent_line', type: 'line' as const, start: { x: 200, y: 180 }, end: { x: 700, y: 180 }, text: 'Tangent Line' },
        ],
      },
    ];

    await bbView.open(steps);

    // Scene 1: Has 2 elements (circle + center O)
    const acc1 = bbView.getAccumulatedStep(0);
    expect(acc1.elements.length).toBe(2);
    expect(acc1.elements.some((e) => e.id === 'c1')).toBe(true);

    // Scene 2: Retains Scene 1 elements and adds tangent line (total 3 elements)
    const acc2 = bbView.getAccumulatedStep(1);
    expect(acc2.elements.length).toBe(3);
    expect(acc2.elements.some((e) => e.id === 'c1')).toBe(true);
    expect(acc2.elements.some((e) => e.id === 'tangent_line')).toBe(true);

    bbView.close();
  });

  it('BlackboardView video stream scrubber, speed cycling, and seeking work smoothly', async () => {
    const bbView = new BlackboardView();
    const steps = [
      {
        step: 1,
        title: 'Scene 1: Introduction to Curvature',
        explanation: 'Here is our detailed overview of geometric curvature in Cartesian space.',
      },
      {
        step: 2,
        title: 'Scene 2: Tangent Vector Analysis',
        explanation: 'Examining the derivative and instantaneous velocity vector.',
      },
    ];

    await bbView.open(steps);
    expect(bbView.getVideoTotalDuration()).toBeGreaterThan(0);

    // Initial state: starts at 0s
    expect(bbView.getVideoCurrentTime()).toBe(0);

    // Seek to 8 seconds
    bbView.seekToTime(8);
    expect(bbView.getVideoCurrentTime()).toBe(8);

    // Speed cycling: 1.0x -> 1.25x -> 1.5x -> 2.0x -> 1.0x
    expect(bbView.getPlaybackSpeed()).toBe(1.0);
    bbView.cyclePlaybackSpeed();
    expect(bbView.getPlaybackSpeed()).toBe(1.25);
    bbView.cyclePlaybackSpeed();
    expect(bbView.getPlaybackSpeed()).toBe(1.5);
    bbView.cyclePlaybackSpeed();
    expect(bbView.getPlaybackSpeed()).toBe(2.0);
    bbView.cyclePlaybackSpeed();
    expect(bbView.getPlaybackSpeed()).toBe(1.0);

    // Mute toggle
    bbView.toggleMute();
    bbView.toggleMute();

    bbView.close();
  });
});
