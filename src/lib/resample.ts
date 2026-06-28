import { packRgba } from './color';
import type { ResampleOptions } from './types';

/** Clamp an integer index into [0, max]. */
function clampIndex(value: number, max: number): number {
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
}

/**
 * Resize an image WITHOUT blending colors.
 *
 * `point` mode: each output pixel copies exactly one source pixel. The sample
 * coordinate is `(out + 0.5) * scale + offset` in source-pixel units, so the
 * fractional `offset` lets the caller align the grid to the center of source
 * cells and avoid landing on color boundaries.
 *
 * `dominant` mode: each output pixel inspects a `supersample × supersample`
 * grid inside its source footprint and picks the most frequent exact color —
 * still never mixing channels, but more robust for noisy downscales.
 */
export function resample(source: ImageData, opts: ResampleOptions): ImageData {
  const targetWidth = Math.max(1, Math.floor(opts.targetWidth));
  const targetHeight = Math.max(1, Math.floor(opts.targetHeight));
  const out = new ImageData(targetWidth, targetHeight);

  const scaleX = source.width / targetWidth;
  const scaleY = source.height / targetHeight;
  const maxX = source.width - 1;
  const maxY = source.height - 1;

  if (opts.mode === 'point') {
    samplePoint(source, out, scaleX, scaleY, maxX, maxY, opts.offsetX, opts.offsetY);
  } else {
    const grid = Math.max(1, Math.floor(opts.supersample));
    sampleDominant(source, out, scaleX, scaleY, maxX, maxY, opts.offsetX, opts.offsetY, grid);
  }
  return out;
}

function copyPixel(src: Uint8ClampedArray, si: number, dst: Uint8ClampedArray, di: number): void {
  dst[di] = src[si];
  dst[di + 1] = src[si + 1];
  dst[di + 2] = src[si + 2];
  dst[di + 3] = src[si + 3];
}

function samplePoint(
  source: ImageData,
  out: ImageData,
  scaleX: number,
  scaleY: number,
  maxX: number,
  maxY: number,
  offsetX: number,
  offsetY: number,
): void {
  const src = source.data;
  const dst = out.data;
  for (let oy = 0; oy < out.height; oy++) {
    const sy = clampIndex(Math.floor((oy + 0.5) * scaleY + offsetY), maxY);
    const rowBase = sy * source.width;
    for (let ox = 0; ox < out.width; ox++) {
      const sx = clampIndex(Math.floor((ox + 0.5) * scaleX + offsetX), maxX);
      copyPixel(src, (rowBase + sx) * 4, dst, (oy * out.width + ox) * 4);
    }
  }
}

function sampleDominant(
  source: ImageData,
  out: ImageData,
  scaleX: number,
  scaleY: number,
  maxX: number,
  maxY: number,
  offsetX: number,
  offsetY: number,
  grid: number,
): void {
  const src = source.data;
  const dst = out.data;
  const cellX = scaleX / grid;
  const cellY = scaleY / grid;

  // Reused per output pixel: map packed color -> count, remember the winner.
  const tally = new Map<number, number>();

  for (let oy = 0; oy < out.height; oy++) {
    const topY = oy * scaleY + offsetY;
    for (let ox = 0; ox < out.width; ox++) {
      const leftX = ox * scaleX + offsetX;
      tally.clear();

      let bestCount = 0;
      let bestIndex = 0;

      for (let gy = 0; gy < grid; gy++) {
        const sy = clampIndex(Math.floor(topY + (gy + 0.5) * cellY), maxY);
        const rowBase = sy * source.width;
        for (let gx = 0; gx < grid; gx++) {
          const sx = clampIndex(Math.floor(leftX + (gx + 0.5) * cellX), maxX);
          const si = (rowBase + sx) * 4;
          const key = packRgba(src[si], src[si + 1], src[si + 2], src[si + 3]);
          const next = (tally.get(key) ?? 0) + 1;
          tally.set(key, next);
          if (next > bestCount) {
            bestCount = next;
            bestIndex = si;
          }
        }
      }

      copyPixel(src, bestIndex, dst, (oy * out.width + ox) * 4);
    }
  }
}
