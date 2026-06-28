import type { RGB } from './types';

/** Map key for a pixel position in the output image. */
export function pixelKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** Parse a {@link pixelKey} back into coordinates. */
export function parsePixelKey(key: string): { readonly x: number; readonly y: number } {
  const comma = key.indexOf(',');
  return { x: Number(key.slice(0, comma)), y: Number(key.slice(comma + 1)) };
}

/**
 * Paint per-pixel RGB overrides onto a copy of `image`. Each edit is written as
 * fully opaque — this is the final, hand-tweaked layer on top of the pipeline
 * output. Out-of-bounds edits are ignored. Returns `image` unchanged when there
 * is nothing to paint, so callers can compare references cheaply.
 */
export function applyPixelEdits(image: ImageData, edits: ReadonlyMap<string, RGB>): ImageData {
  if (edits.size === 0) return image;
  const out = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  const d = out.data;
  for (const [key, rgb] of edits) {
    const { x, y } = parsePixelKey(key);
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
    const i = (y * image.width + x) * 4;
    d[i] = rgb.r;
    d[i + 1] = rgb.g;
    d[i + 2] = rgb.b;
    d[i + 3] = 255;
  }
  return out;
}
