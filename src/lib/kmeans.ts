import { linearRgbToOklab, oklabToRgb, srgbToLinear } from './color';
import type { Palette, PaletteColor } from './types';

export interface PaletteOptions {
  /** Target number of palette colors (k). */
  readonly colorCount: number;
  /** Upper bound on pixels fed into k-means (the rest are strided out). */
  readonly maxSamples?: number;
  /** Maximum Lloyd iterations. */
  readonly maxIterations?: number;
  /** Deterministic seed so the same image+settings yield the same palette. */
  readonly seed?: number;
  /** Source alpha strictly below this (0–255) is excluded from clustering. */
  readonly alphaThreshold?: number;
}

const DEFAULTS = {
  maxSamples: 16_384,
  maxIterations: 24,
  seed: 0x9e3779b9,
  alphaThreshold: 8,
} as const;

/** Small, fast, fully deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

interface Samples {
  /** Flat Oklab coordinates (L,a,b per sample). */
  readonly data: Float64Array;
  readonly count: number;
}

/** Collect a strided subset of opaque pixels as a flat Oklab buffer. */
function collectSamples(image: ImageData, maxSamples: number, alphaThreshold: number): Samples {
  const { data, width, height } = image;
  const pixelCount = width * height;
  const stride = Math.max(1, Math.ceil(pixelCount / maxSamples));

  const samples: number[] = [];
  for (let p = 0; p < pixelCount; p += stride) {
    const i = p * 4;
    if (data[i + 3] < alphaThreshold) continue;
    const lr = srgbToLinear(data[i]);
    const lg = srgbToLinear(data[i + 1]);
    const lb = srgbToLinear(data[i + 2]);
    const lab = linearRgbToOklab(lr, lg, lb);
    samples.push(lab.L, lab.a, lab.b);
  }
  return { data: Float64Array.from(samples), count: samples.length / 3 };
}

/** k-means++ seeding: spread initial centroids by distance-weighted sampling. */
function seedCentroids(samples: Float64Array, n: number, k: number, rng: () => number): Float64Array {
  const centroids = new Float64Array(k * 3);

  const first = Math.min(n - 1, Math.floor(rng() * n));
  centroids[0] = samples[first * 3];
  centroids[1] = samples[first * 3 + 1];
  centroids[2] = samples[first * 3 + 2];

  const dist = new Float64Array(n).fill(Number.POSITIVE_INFINITY);

  for (let c = 1; c < k; c++) {
    const prev = (c - 1) * 3;
    let total = 0;
    for (let p = 0; p < n; p++) {
      const o = p * 3;
      const dL = samples[o] - centroids[prev];
      const da = samples[o + 1] - centroids[prev + 1];
      const db = samples[o + 2] - centroids[prev + 2];
      const d = dL * dL + da * da + db * db;
      if (d < dist[p]) dist[p] = d;
      total += dist[p];
    }

    let target = rng() * total;
    let chosen = 0;
    for (let p = 0; p < n; p++) {
      target -= dist[p];
      if (target <= 0) {
        chosen = p;
        break;
      }
    }
    centroids[c * 3] = samples[chosen * 3];
    centroids[c * 3 + 1] = samples[chosen * 3 + 1];
    centroids[c * 3 + 2] = samples[chosen * 3 + 2];
  }
  return centroids;
}

/**
 * Build a palette by clustering the image's colors in Oklab. Each output color
 * is the mean of the colors assigned to its cluster, so palette colors stay
 * true to the image. Returns at most `colorCount` colors, most common first.
 */
export function buildPalette(image: ImageData, options: PaletteOptions): Palette {
  const maxSamples = options.maxSamples ?? DEFAULTS.maxSamples;
  const maxIterations = options.maxIterations ?? DEFAULTS.maxIterations;
  const seed = options.seed ?? DEFAULTS.seed;
  const alphaThreshold = options.alphaThreshold ?? DEFAULTS.alphaThreshold;

  const { data: samples, count: n } = collectSamples(image, maxSamples, alphaThreshold);
  if (n === 0) return [];

  const k = Math.max(1, Math.min(options.colorCount, n));
  const rng = mulberry32(seed);
  const centroids = seedCentroids(samples, n, k, rng);

  const assignment = new Int32Array(n);
  const sumL = new Float64Array(k);
  const sumA = new Float64Array(k);
  const sumB = new Float64Array(k);
  const counts = new Float64Array(k);

  for (let iter = 0; iter < maxIterations; iter++) {
    let moved = false;

    for (let p = 0; p < n; p++) {
      const o = p * 3;
      const sL = samples[o];
      const sA = samples[o + 1];
      const sB = samples[o + 2];

      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let c = 0; c < k; c++) {
        const co = c * 3;
        const dL = sL - centroids[co];
        const da = sA - centroids[co + 1];
        const db = sB - centroids[co + 2];
        const d = dL * dL + da * da + db * db;
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      if (assignment[p] !== best) {
        assignment[p] = best;
        moved = true;
      }
    }

    sumL.fill(0);
    sumA.fill(0);
    sumB.fill(0);
    counts.fill(0);
    for (let p = 0; p < n; p++) {
      const c = assignment[p];
      const o = p * 3;
      sumL[c] += samples[o];
      sumA[c] += samples[o + 1];
      sumB[c] += samples[o + 2];
      counts[c] += 1;
    }
    for (let c = 0; c < k; c++) {
      const cnt = counts[c];
      if (cnt === 0) continue;
      centroids[c * 3] = sumL[c] / cnt;
      centroids[c * 3 + 1] = sumA[c] / cnt;
      centroids[c * 3 + 2] = sumB[c] / cnt;
    }

    if (!moved) break;
  }

  // Each centroid is already the mean Oklab of its cluster, and `counts` holds
  // the final cluster sizes — so the palette reads straight off them.
  const palette: PaletteColor[] = [];
  for (let c = 0; c < k; c++) {
    const cnt = counts[c];
    if (cnt === 0) continue;
    palette.push({
      id: c,
      rgb: oklabToRgb({ L: centroids[c * 3], a: centroids[c * 3 + 1], b: centroids[c * 3 + 2] }),
      population: cnt,
    });
  }

  palette.sort((x, y) => y.population - x.population);
  return palette.map((color, index) => ({ ...color, id: index }));
}
