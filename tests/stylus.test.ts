import { describe, it, expect, beforeEach } from 'vitest';
import { StylusService } from '../src/services/stylus';
import { BlackboardView } from '../src/views/BlackboardView';
import { Point } from '../src/types';

describe('Hardware Stylus & Pressure Calibration Suite', () => {
  let stylus: StylusService;

  beforeEach(() => {
    stylus = new StylusService();
  });

  it('deadband threshold filters out accidental micro-touches', () => {
    expect(stylus.calibratePressure(0.01)).toBe(0.0);
    expect(stylus.calibratePressure(0.02)).toBe(0.0);
    expect(stylus.calibratePressure(0.05)).toBeGreaterThan(0.0);
  });

  it('calibrates pressure with soft, firm, and calligraphic curves', () => {
    const raw = 0.5;

    const soft = stylus.calibratePressure(raw, 'soft');
    const linear = stylus.calibratePressure(raw, 'linear');
    const firm = stylus.calibratePressure(raw, 'firm');
    const calligraphic = stylus.calibratePressure(raw, 'calligraphic');

    // Soft should be most responsive (higher output for mid-range input)
    expect(soft).toBeGreaterThan(linear);
    // Firm requires more pressure (lower output for mid-range input)
    expect(firm).toBeLessThan(linear);
    expect(calligraphic).toBeGreaterThan(0.0);
    expect(calligraphic).toBeLessThan(1.0);
  });

  it('calculateStrokeMetrics dynamically scales width and opacity with pressure', () => {
    const lightPoint: Point = { x: 10, y: 10, pressure: 0.1 };
    const heavyPoint: Point = { x: 20, y: 20, pressure: 0.9 };

    const lightMetrics = stylus.calculateStrokeMetrics(lightPoint, 4.0);
    const heavyMetrics = stylus.calculateStrokeMetrics(heavyPoint, 4.0);

    expect(heavyMetrics.width).toBeGreaterThan(lightMetrics.width);
    expect(heavyMetrics.opacity).toBeGreaterThan(lightMetrics.opacity);
  });

  it('tilt angles produce calligraphic ribbon dynamics', () => {
    const uprightPen: Point = { x: 10, y: 10, pressure: 0.5, tiltX: 0, tiltY: 0 };
    const tiltedPen: Point = { x: 10, y: 10, pressure: 0.5, tiltX: 60, tiltY: 45 };

    const upright = stylus.calculateStrokeMetrics(uprightPen, 3.0);
    const tilted = stylus.calculateStrokeMetrics(tiltedPen, 3.0);

    expect(tilted.width).toBeGreaterThan(upright.width);
    expect(tilted.aspectRatio).toBeGreaterThan(upright.aspectRatio);
  });

  it('smoothPoints generates smooth Catmull-Rom spline curves with interpolated pressure', () => {
    const rawPoints: Point[] = [
      { x: 0, y: 0, pressure: 0.2, tiltX: 10, tiltY: 10 },
      { x: 50, y: 80, pressure: 0.8, tiltX: 20, tiltY: 20 },
      { x: 100, y: 0, pressure: 0.3, tiltX: 10, tiltY: 10 },
    ];

    const smoothed = stylus.smoothPoints(rawPoints, 3);
    expect(smoothed.length).toBeGreaterThan(rawPoints.length);
    expect(smoothed[0].x).toBe(0);
    expect(smoothed[smoothed.length - 1].x).toBe(100);

    // Midpoint pressure should be interpolated
    const midPoint = smoothed[Math.floor(smoothed.length / 2)];
    expect(midPoint.pressure).toBeDefined();
    expect(midPoint.pressure).toBeGreaterThan(0.2);
  });

  it('BlackboardView provides stylus service configuration and profile switching', () => {
    document.body.innerHTML = `
      <div id="vizOverlay">
        <canvas id="vizCanvas"></canvas>
      </div>
    `;

    const bbView = new BlackboardView();
    expect(bbView.getStylusService()).toBeDefined();

    bbView.setStylusProfile('firm');
    expect(bbView.getStylusService().getConfig().profile).toBe('firm');

    expect(bbView.isDrawingActive()).toBe(false);
  });
});
