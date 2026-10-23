import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HomeView } from '../src/views/HomeView';
import { ScreenTeachView } from '../src/views/ScreenTeachView';
import { BlackboardView } from '../src/views/BlackboardView';

describe('Views and Navigation', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="emptyState" class="empty-state">
        <button id="screenTeachMode"></button>
        <button id="blackboardMode"></button>
      </div>
      <div class="app"></div>
      <div id="vizOverlay" class="visualization-overlay">
        <canvas id="vizCanvas"></canvas>
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
});
