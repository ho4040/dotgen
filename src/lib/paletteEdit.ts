import type { Palette, RGB } from './types';

/**
 * Return `palette` with each edited id's color replaced by the user's value.
 * Ids and populations are preserved, so applying this right after analysis lets
 * the edited colors flow through quantize, merge, display, and export uniformly.
 * Returns the input unchanged when there are no edits.
 */
export function applyPaletteEdits(palette: Palette, edits: ReadonlyMap<number, RGB>): Palette {
  if (edits.size === 0) return palette;
  return palette.map((color) => {
    const rgb = edits.get(color.id);
    return rgb === undefined ? color : { ...color, rgb };
  });
}
