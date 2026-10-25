import { Point } from '../types';

export type StylusCurveProfile = 'linear' | 'soft' | 'firm' | 'calligraphic';

export interface StylusCalibrationConfig {
  profile: StylusCurveProfile;
  minWidthFactor: number;
  maxWidthFactor: number;
  tiltShading: boolean;
  smoothingTolerance: number;
  deadbandThreshold: number;
}

export const DEFAULT_STYLUS_CONFIG: StylusCalibrationConfig = {
  profile: 'soft',
  minWidthFactor: 0.35,
  maxWidthFactor: 1.85,
  tiltShading: true,
  smoothingTolerance: 2.0,
  deadbandThreshold: 0.02,
};

export class StylusService {
  private config: StylusCalibrationConfig;

  constructor(config: Partial<StylusCalibrationConfig> = {}) {
    this.config = { ...DEFAULT_STYLUS_CONFIG, ...config };
  }

  public getConfig(): StylusCalibrationConfig {
    return { ...this.config };
  }

  public setProfile(profile: StylusCurveProfile): void {
    this.config.profile = profile;
  }

  public setConfig(config: Partial<StylusCalibrationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Applies the non-linear calibration curve to raw hardware stylus pressure.
   * Input: raw pressure [0.0, 1.0]
   * Output: calibrated pressure [0.0, 1.0]
   */
  public calibratePressure(rawPressure: number, profile: StylusCurveProfile = this.config.profile): number {
    if (rawPressure <= this.config.deadbandThreshold) {
      return 0.0;
    }

    // Normalize above deadband
    const normalized = Math.min(
      1.0,
      (rawPressure - this.config.deadbandThreshold) / (1.0 - this.config.deadbandThreshold)
    );

    switch (profile) {
      case 'soft':
        // Square-root curve: light touch yields responsive, confident ink
        return Math.pow(normalized, 0.65);
      case 'firm':
        // Power curve: requires deliberate, controlled force for thick strokes
        return Math.pow(normalized, 1.6);
      case 'calligraphic':
        // S-curve (sigmoid-like Hermite blend): emphasizes delicate hairlines and bold downstrokes
        return normalized * normalized * (3.0 - 2.0 * normalized);
      case 'linear':
      default:
        return normalized;
    }
  }

  /**
   * Calculates effective stroke width and aspect ratio from calibrated pressure and hardware pen tilt.
   */
  public calculateStrokeMetrics(
    point: Point,
    baseWidth: number = 2.5
  ): {
    width: number;
    opacity: number;
    angle: number;
    aspectRatio: number;
  } {
    const rawP = point.pressure !== undefined ? point.pressure : 0.5;
    const p = this.calibratePressure(rawP);

    // Scale width between min and max factor
    const widthRange = this.config.maxWidthFactor - this.config.minWidthFactor;
    let effectiveWidth = baseWidth * (this.config.minWidthFactor + p * widthRange);

    // Tilt calculations
    const tiltX = point.tiltX || 0;
    const tiltY = point.tiltY || 0;
    const tiltMag = Math.min(1.0, Math.hypot(tiltX, tiltY) / 90.0);
    const angle = Math.atan2(tiltY, tiltX);

    let aspectRatio = 1.0;
    if (this.config.tiltShading && tiltMag > 0.15) {
      // Flatter pen angle produces calligraphic ribbon width
      effectiveWidth *= 1.0 + tiltMag * 0.75;
      aspectRatio = 1.0 + tiltMag * 1.5;
    }

    const opacity = Math.min(1.0, 0.45 + p * 0.55);

    return {
      width: Math.max(0.75, effectiveWidth),
      opacity,
      angle,
      aspectRatio,
    };
  }

  /**
   * Smooths raw pointer stroke points using Catmull-Rom spline interpolation.
   */
  public smoothPoints(points: Point[], segmentsPerSpan: number = 4): Point[] {
    if (points.length < 3) return points;

    const result: Point[] = [points[0]];

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < points.length - 2 ? points[i + 2] : p2;

      for (let t = 1; t <= segmentsPerSpan; t++) {
        const u = t / segmentsPerSpan;
        const u2 = u * u;
        const u3 = u2 * u;

        // Catmull-Rom basis
        const x =
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * u +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3);

        const y =
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * u +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3);

        // Interpolate pressure & tilt
        const p1Pres = p1.pressure !== undefined ? p1.pressure : 0.5;
        const p2Pres = p2.pressure !== undefined ? p2.pressure : 0.5;
        const pressure = p1Pres + (p2Pres - p1Pres) * u;

        const tiltX = (p1.tiltX || 0) + ((p2.tiltX || 0) - (p1.tiltX || 0)) * u;
        const tiltY = (p1.tiltY || 0) + ((p2.tiltY || 0) - (p1.tiltY || 0)) * u;

        result.push({ x, y, pressure, tiltX, tiltY });
      }
    }

    return result;
  }
}
