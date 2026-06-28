import { useCallback, useState } from 'react';

export interface Merge {
  /** Groups of palette ids collapsed onto one representative color. */
  readonly mergeGroups: ReadonlyArray<ReadonlyArray<number>>;
  /** Merge a selection, absorbing any existing groups it overlaps. */
  readonly merge: (ids: readonly number[]) => void;
  /** Break apart any group touching one of these ids. */
  readonly unmerge: (ids: readonly number[]) => void;
  /** Drop every group (also the reset when the palette identities change). */
  readonly clear: () => void;
}

/**
 * Owns the "collapse several palette colors into one" feature. Self-contained:
 * it operates purely on id groups and shares no state with other features.
 */
export function useMerge(): Merge {
  const [mergeGroups, setMergeGroups] = useState<ReadonlyArray<ReadonlyArray<number>>>([]);

  const merge = useCallback((ids: readonly number[]): void => {
    setMergeGroups((prev) => {
      // Union the selection with any existing groups it overlaps.
      const involved = new Set<number>(ids);
      const remaining: number[][] = [];
      for (const group of prev) {
        if (group.some((id) => involved.has(id))) group.forEach((id) => involved.add(id));
        else remaining.push([...group]);
      }
      if (involved.size < 2) return prev;
      const newGroup = [...involved].sort((a, b) => a - b);
      return [...remaining, newGroup];
    });
  }, []);

  const unmerge = useCallback((ids: readonly number[]): void => {
    const target = new Set(ids);
    setMergeGroups((prev) => prev.filter((group) => !group.some((id) => target.has(id))));
  }, []);

  const clear = useCallback((): void => {
    setMergeGroups((prev) => (prev.length === 0 ? prev : []));
  }, []);

  return { mergeGroups, merge, unmerge, clear };
}
