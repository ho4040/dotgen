import { useCallback, useState } from 'react';
import { pixelKey } from '../lib/pixelEdits';
import type { RGB } from '../lib/types';

export interface PixelEdits {
  /** Per-position RGB overrides, keyed by {@link pixelKey}. */
  readonly edits: ReadonlyMap<string, RGB>;
  /** Paint one pixel the given color. */
  readonly paint: (x: number, y: number, rgb: RGB) => void;
  /** Drop the override at one pixel (revert it to the pipeline output). */
  readonly erase: (x: number, y: number) => void;
  /** Drop every override (also the reset when the output geometry changes). */
  readonly clear: () => void;
}

/**
 * Owns the manual pixel-painting feature: a sparse map of position → color laid
 * over the finished result. Self-contained — it knows nothing about the palette
 * or pipeline; callers apply the map with {@link applyPixelEdits}.
 */
export function usePixelEdits(): PixelEdits {
  const [edits, setEdits] = useState<ReadonlyMap<string, RGB>>(new Map());

  const paint = useCallback((x: number, y: number, rgb: RGB): void => {
    setEdits((prev) => {
      const key = pixelKey(x, y);
      const existing = prev.get(key);
      if (existing !== undefined && existing.r === rgb.r && existing.g === rgb.g && existing.b === rgb.b) {
        return prev; // no-op: same color already painted there
      }
      const next = new Map(prev);
      next.set(key, rgb);
      return next;
    });
  }, []);

  const erase = useCallback((x: number, y: number): void => {
    setEdits((prev) => {
      const key = pixelKey(x, y);
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const clear = useCallback((): void => {
    setEdits((prev) => (prev.size === 0 ? prev : new Map()));
  }, []);

  return { edits, paint, erase, clear };
}
