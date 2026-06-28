import { useCallback, useState } from 'react';

export interface Transparency {
  /** Palette ids currently marked transparent. */
  readonly transparentIds: ReadonlySet<number>;
  /** Toggle a batch of ids: turn all on, or — if all are already on — all off. */
  readonly toggleMany: (ids: readonly number[]) => void;
  /** Drop every selection (also the reset when the palette identities change). */
  readonly clear: () => void;
}

/**
 * Owns the "which palette colors render transparent" feature. Self-contained:
 * it knows nothing about palettes, merges, or the pipeline — callers just read
 * `transparentIds` and invoke the actions.
 */
export function useTransparency(): Transparency {
  const [transparentIds, setTransparentIds] = useState<ReadonlySet<number>>(new Set());

  const toggleMany = useCallback((ids: readonly number[]): void => {
    if (ids.length === 0) return;
    setTransparentIds((prev) => {
      const allOn = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const clear = useCallback((): void => {
    setTransparentIds((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  return { transparentIds, toggleMany, clear };
}
