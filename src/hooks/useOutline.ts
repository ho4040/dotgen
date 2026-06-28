import { useCallback, useState } from 'react';

export interface Outline {
  /** When true, draw a 1px darkest-color outline along transparent seams. */
  readonly outline: boolean;
  readonly setOutline: (on: boolean) => void;
}

/**
 * Owns the "draw a boundary outline" toggle. Self-contained: it knows nothing
 * about palettes or the pipeline — the worker reads the flag and does the work.
 */
export function useOutline(): Outline {
  const [outline, setOutlineState] = useState(false);
  const setOutline = useCallback((on: boolean): void => setOutlineState(on), []);
  return { outline, setOutline };
}
