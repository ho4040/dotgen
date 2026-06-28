import { rgbToOklab } from './color';

/**
 * Trace a 1px outline where opaque pixels meet transparency.
 *
 * Every opaque pixel that has at least one fully-transparent 4-neighbour is
 * recolored to the darkest opaque color present in the image. "Darkest" is the
 * lowest Oklab lightness among the colors that actually appear, so it naturally
 * reflects merges, overrides, and per-color edits (the merged/effective output).
 * A boundary pixel that is already the darkest color is left untouched.
 *
 * Operates in place. Out-of-bounds neighbours count as non-transparent, so the
 * image border itself is not outlined — only true transparent/opaque seams are.
 * Alpha is never modified, so the boundary test (which reads alpha) is immune to
 * the color writes and a single pass is correct.
 */
export function applyOutline(image: ImageData): void {
  const { width, height, data } = image;

  // Darkest opaque color by Oklab lightness, caching L per packed RGB so a color
  // that repeats across many pixels is only converted once.
  const lightnessByColor = new Map<number, number>();
  let darkR = -1;
  let darkG = 0;
  let darkB = 0;
  let minL = Number.POSITIVE_INFINITY;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = (r << 16) | (g << 8) | b;
    let L = lightnessByColor.get(key);
    if (L === undefined) {
      L = rgbToOklab({ r, g, b }).L;
      lightnessByColor.set(key, L);
    }
    if (L < minL) {
      minL = L;
      darkR = r;
      darkG = g;
      darkB = b;
    }
  }
  if (darkR < 0) return; // fully transparent image — nothing to outline

  const isTransparent = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    return data[(y * width + x) * 4 + 3] === 0;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] === 0) continue; // transparent pixel, never an outline
      const onBorder =
        isTransparent(x - 1, y) ||
        isTransparent(x + 1, y) ||
        isTransparent(x, y - 1) ||
        isTransparent(x, y + 1);
      if (!onBorder) continue;
      // Already the darkest color — skip (the outline pixel "already exists").
      if (data[idx] === darkR && data[idx + 1] === darkG && data[idx + 2] === darkB) continue;
      data[idx] = darkR;
      data[idx + 1] = darkG;
      data[idx + 2] = darkB;
    }
  }
}
