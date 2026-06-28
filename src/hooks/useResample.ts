import { useCallback, useEffect, useMemo, useState } from 'react';
import { divisors, nearestDivisor } from '../lib/factor';
import type { SamplingMode } from '../lib/types';

/** Sampling knobs the user tweaks; the target size is derived from factors. */
export interface ResampleTuning {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly mode: SamplingMode;
  readonly supersample: number;
}

export interface ResampleSettings extends ResampleTuning {
  readonly targetWidth: number;
  readonly targetHeight: number;
}

const DEFAULT_TUNING: ResampleTuning = {
  offsetX: 0,
  offsetY: 0,
  mode: 'point',
  supersample: 3,
};

/** Preferred starting width (px) — the nearest available divisor is chosen. */
const DEFAULT_TARGET_WIDTH = 64;

export interface UseResample {
  /** Full resample settings ready to hand to the pipeline. */
  readonly resample: ResampleSettings;
  /** Valid target widths (divisors of the adjusted source width), ascending. */
  readonly widthOptions: readonly number[];
  readonly setResample: (patch: Partial<ResampleTuning>) => void;
  readonly setTargetWidth: (width: number) => void;
  /** Re-center the within-block offset — call when the block size changes for a
   * reason outside this hook (e.g. the source was cropped). */
  readonly recenterOffset: () => void;
  /** Pick a sensible starting target width for a freshly loaded image. */
  readonly initForSource: (sourceWidth: number) => void;
}

/**
 * Owns the resize/resampling feature. Derives everything dimension-related from
 * the `adjustedSource` it's given and exposes a ready-to-use {@link ResampleSettings};
 * it shares no state with the palette, transparency, or merge features.
 */
export function useResample(adjustedSource: ImageData | null): UseResample {
  const [targetWidth, setTargetWidthState] = useState<number>(1);
  const [tuning, setTuning] = useState<ResampleTuning>(DEFAULT_TUNING);

  const widthOptions = useMemo<readonly number[]>(
    () => (adjustedSource === null ? [] : divisors(adjustedSource.width)),
    [adjustedSource],
  );

  // After a resize, only pull the target back if a crop made the source
  // narrower than it. We deliberately do NOT re-snap to the nearest divisor:
  // extending by 1px can land on a prime width whose only divisors are [1, w],
  // and snapping the previous target to that set would collapse it to 1. The
  // divisor chips (widthOptions) recompute regardless, so the user just picks a
  // clean ratio from the refreshed list.
  useEffect(() => {
    if (adjustedSource === null) return;
    const max = adjustedSource.width;
    setTargetWidthState((prev) => (prev <= max ? prev : max));
  }, [adjustedSource]);

  const targetHeight = useMemo<number>(() => {
    if (adjustedSource === null) return 1;
    return Math.max(1, Math.round((adjustedSource.height * targetWidth) / adjustedSource.width));
  }, [adjustedSource, targetWidth]);

  const resample = useMemo<ResampleSettings>(
    () => ({ ...tuning, targetWidth, targetHeight }),
    [tuning, targetWidth, targetHeight],
  );

  const recenterOffset = useCallback((): void => {
    // Block size N changed, so the within-block offset is reset to center.
    setTuning((prev) => (prev.offsetX === 0 && prev.offsetY === 0 ? prev : { ...prev, offsetX: 0, offsetY: 0 }));
  }, []);

  const setTargetWidth = useCallback(
    (width: number): void => {
      setTargetWidthState(Math.max(1, Math.round(width)));
      recenterOffset();
    },
    [recenterOffset],
  );

  const setResample = useCallback((patch: Partial<ResampleTuning>): void => {
    setTuning((prev) => ({ ...prev, ...patch }));
  }, []);

  const initForSource = useCallback((sourceWidth: number): void => {
    // Start small (nearest divisor to the default) so the first render is fast.
    setTargetWidthState(nearestDivisor(divisors(sourceWidth), DEFAULT_TARGET_WIDTH));
  }, []);

  return { resample, widthOptions, setResample, setTargetWidth, recenterOffset, initForSource };
}
