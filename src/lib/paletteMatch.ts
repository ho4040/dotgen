import { oklabDistanceSq, rgbToOklab } from './color';
import type { Palette, RGB } from './types';

/**
 * Id of the palette color nearest to `rgb` in Oklab — the same metric the
 * quantizer uses, so for an un-recolored result pixel this returns the exact
 * color that produced it. Returns null for an empty palette.
 */
export function nearestPaletteId(palette: Palette, rgb: RGB): number | null {
  if (palette.length === 0) return null;
  const target = rgbToOklab(rgb);
  let bestId = palette[0].id;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const color of palette) {
    const d = oklabDistanceSq(target, rgbToOklab(color.rgb));
    if (d < bestDist) {
      bestDist = d;
      bestId = color.id;
    }
  }
  return bestId;
}
