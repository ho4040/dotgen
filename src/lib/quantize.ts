import { rgbToOklab } from './color';
import type { QuantizeOptions } from './types';

/** sRGB channel (0–255) → linear-light (0–1). Inlined so the hot loop allocates nothing. */
function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Map every pixel of `image` onto its nearest palette color and write the
 * result into a new ImageData. Output pixels therefore only ever use colors
 * from the supplied palette — the palette is authoritative.
 *
 * Nearest is measured by squared distance in Oklab.
 *
 * Pixels assigned to a `transparentIds` color, or whose source alpha is below
 * `alphaThreshold`, are written as fully transparent.
 */
export function quantize(image: ImageData, opts: QuantizeOptions): ImageData {
  const out = new ImageData(image.width, image.height);
  const src = image.data;
  const dst = out.data;

  const { palette } = opts;
  if (palette.length === 0) {
    dst.set(src);
    return out;
  }

  // Flatten palette into parallel typed arrays for the hot loop.
  const count = palette.length;
  const labL = new Float64Array(count);
  const labA = new Float64Array(count);
  const labB = new Float64Array(count);
  const outR = new Uint8ClampedArray(count);
  const outG = new Uint8ClampedArray(count);
  const outB = new Uint8ClampedArray(count);
  const transparent = new Uint8Array(count);

  for (let c = 0; c < count; c++) {
    const entry = palette[c];
    const lab = rgbToOklab(entry.rgb);
    labL[c] = lab.L;
    labA[c] = lab.a;
    labB[c] = lab.b;
    outR[c] = entry.rgb.r;
    outG[c] = entry.rgb.g;
    outB[c] = entry.rgb.b;
    transparent[c] = opts.transparentIds.has(entry.id) ? 1 : 0;
  }

  const pixelCount = image.width * image.height;
  for (let p = 0; p < pixelCount; p++) {
    const i = p * 4;
    if (src[i + 3] < opts.alphaThreshold) {
      dst[i + 3] = 0;
      continue;
    }

    const lr = srgbToLinear(src[i]);
    const lg = srgbToLinear(src[i + 1]);
    const lb = srgbToLinear(src[i + 2]);

    const lCbrt = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const mCbrt = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const sCbrt = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    const pL = 0.2104542553 * lCbrt + 0.793617785 * mCbrt - 0.0040720468 * sCbrt;
    const pA = 1.9779984951 * lCbrt - 2.428592205 * mCbrt + 0.4505937099 * sCbrt;
    const pB = 0.0259040371 * lCbrt + 0.7827717662 * mCbrt - 0.808675766 * sCbrt;

    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let c = 0; c < count; c++) {
      const dL = pL - labL[c];
      const da = pA - labA[c];
      const db = pB - labB[c];
      const d = dL * dL + da * da + db * db;
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }

    if (transparent[best] === 1) {
      dst[i + 3] = 0;
      continue;
    }
    dst[i] = outR[best];
    dst[i + 1] = outG[best];
    dst[i + 2] = outB[best];
    dst[i + 3] = 255;
  }

  return out;
}
