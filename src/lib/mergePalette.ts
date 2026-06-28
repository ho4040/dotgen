import { oklabToRgb, rgbToOklab } from './color';
import type { Palette, PaletteColor } from './types';

function pack(r: number, g: number, b: number): number {
  return ((r << 16) | (g << 8) | b) >>> 0;
}

/**
 * Recolor merged groups in-place: pixels whose color is any member of a group
 * are rewritten to that group's representative color (population-weighted Oklab
 * average). Matching/assignment is left untouched (done earlier against the
 * original palette), so merging only collapses the *output* colors of regions
 * that were already assigned — it never reassigns pixels to other colors.
 */
export function recolorMerged(
  image: ImageData,
  palette: Palette,
  groups: ReadonlyArray<ReadonlyArray<number>>,
): void {
  if (groups.length === 0) return;

  const byId = new Map<number, PaletteColor>();
  for (const color of palette) byId.set(color.id, color);

  const remap = new Map<number, readonly [number, number, number]>();
  for (const group of groups) {
    const members = group
      .map((id) => byId.get(id))
      .filter((c): c is PaletteColor => c !== undefined);
    if (members.length < 2) continue;

    let sumL = 0;
    let sumA = 0;
    let sumB = 0;
    let weight = 0;
    for (const member of members) {
      const lab = rgbToOklab(member.rgb);
      const w = Math.max(1, member.population);
      sumL += lab.L * w;
      sumA += lab.a * w;
      sumB += lab.b * w;
      weight += w;
    }
    const rep = oklabToRgb({ L: sumL / weight, a: sumA / weight, b: sumB / weight });
    for (const member of members) {
      remap.set(pack(member.rgb.r, member.rgb.g, member.rgb.b), [rep.r, rep.g, rep.b]);
    }
  }
  if (remap.size === 0) return;

  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const rep = remap.get(pack(d[i], d[i + 1], d[i + 2]));
    if (rep !== undefined) {
      d[i] = rep[0];
      d[i + 1] = rep[1];
      d[i + 2] = rep[2];
    }
  }
}
