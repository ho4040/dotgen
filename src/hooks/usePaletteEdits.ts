import { useCallback, useState } from 'react';
import type { RGB } from '../lib/types';

export interface PaletteEdits {
  /** Palette id → hand-tweaked RGB. Absent ids keep their analyzed color. */
  readonly edits: ReadonlyMap<number, RGB>;
  /** Set (or replace) the RGB of one palette color. */
  readonly setColor: (id: number, rgb: RGB) => void;
  /** Drop one color's edit, restoring its analyzed value. */
  readonly resetColor: (id: number) => void;
  /** Drop every edit (also the reset when palette identities change). */
  readonly clear: () => void;
}

/**
 * Owns the "hand-edit a palette color's RGB" feature. Self-contained: it keeps a
 * sparse id → RGB map and shares no state with other features. The pipeline
 * applies these onto the analyzed palette before any downstream stage.
 */
export function usePaletteEdits(): PaletteEdits {
  const [edits, setEdits] = useState<ReadonlyMap<number, RGB>>(new Map());

  const setColor = useCallback((id: number, rgb: RGB): void => {
    setEdits((prev) => {
      const next = new Map(prev);
      next.set(id, rgb);
      return next;
    });
  }, []);

  const resetColor = useCallback((id: number): void => {
    setEdits((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const clear = useCallback((): void => {
    setEdits((prev) => (prev.size === 0 ? prev : new Map()));
  }, []);

  return { edits, setColor, resetColor, clear };
}
