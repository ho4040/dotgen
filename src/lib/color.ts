import type { Oklab, RGB } from './types';

/** Clamp a number into the inclusive [0, 1] range. */
function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/** sRGB channel (0–255) → linear-light component (0–1). */
export function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Linear-light RGB (0–1) → Oklab. */
export function linearRgbToOklab(r: number, g: number, b: number): Oklab {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const lCbrt = Math.cbrt(l);
  const mCbrt = Math.cbrt(m);
  const sCbrt = Math.cbrt(s);

  return {
    L: 0.2104542553 * lCbrt + 0.793617785 * mCbrt - 0.0040720468 * sCbrt,
    a: 1.9779984951 * lCbrt - 2.428592205 * mCbrt + 0.4505937099 * sCbrt,
    b: 0.0259040371 * lCbrt + 0.7827717662 * mCbrt - 0.808675766 * sCbrt,
  };
}

/** Linear-light component (0–1) → sRGB channel rounded to 0–255. */
function linearToSrgb(linear: number): number {
  const v = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
  return Math.round(clamp01(v) * 255);
}

/**
 * Convert an 8-bit sRGB color to Oklab.
 * Oklab gives a perceptually uniform space, so Euclidean distance there is a
 * good proxy for perceived color difference — ideal for clustering & matching.
 */
export function rgbToOklab(rgb: RGB): Oklab {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const lCbrt = Math.cbrt(l);
  const mCbrt = Math.cbrt(m);
  const sCbrt = Math.cbrt(s);

  return {
    L: 0.2104542553 * lCbrt + 0.793617785 * mCbrt - 0.0040720468 * sCbrt,
    a: 1.9779984951 * lCbrt - 2.428592205 * mCbrt + 0.4505937099 * sCbrt,
    b: 0.0259040371 * lCbrt + 0.7827717662 * mCbrt - 0.808675766 * sCbrt,
  };
}

/** Convert an Oklab color back to an 8-bit sRGB color. */
export function oklabToRgb(lab: Oklab): RGB {
  const lCbrt = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const mCbrt = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const sCbrt = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;

  const l = lCbrt ** 3;
  const m = mCbrt ** 3;
  const s = sCbrt ** 3;

  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return { r: linearToSrgb(r), g: linearToSrgb(g), b: linearToSrgb(b) };
}

/** Squared Euclidean distance in Oklab. Cheaper than the true distance and
 * monotonic, so it is sufficient for nearest-color comparisons. */
export function oklabDistanceSq(a: Oklab, b: Oklab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return dL * dL + da * da + db * db;
}

/** Pack an RGBA color into a single uint32 key (for fast counting / dedup). */
export function packRgba(r: number, g: number, b: number, a: number): number {
  return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
}
