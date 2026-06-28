import { oklabToRgb, rgbToOklab } from './color';
import { parsePixelKey } from './pixelEdits';
import type { DeditherParams } from './types';

function pack(r: number, g: number, b: number): number {
  return ((r << 16) | (g << 8) | b) >>> 0;
}

/**
 * Detect dithered regions and flatten each to a single "middle" color.
 *
 * A pixel is considered *dithered* when its surrounding window holds only a few
 * distinct colors (≤ `maxColors`) yet those colors alternate at high spatial
 * frequency — the fraction of neighbouring opaque pixel pairs that differ is at
 * least `threshold`. This catches both ordered (checkerboard) and error-diffusion
 * dither while leaving flat fills and clean edges alone (their alternation is low
 * or their color count is high).
 *
 * Dithered pixels are grouped into 4-connected regions; regions below
 * `minRegion` pixels are ignored (noise / intentional texture). Each surviving
 * region is filled with the population-weighted Oklab average of its original
 * colors — either used directly (`new`) or snapped to the nearest color already
 * present in the image (`snap`, keeps the color count from growing).
 *
 * `mask` (output "x,y" position keys) limits which pixels may be flattened; an
 * empty mask means the whole image. Operates in place.
 */
export function applyDedither(image: ImageData, params: DeditherParams): void {
  const { width, height, data } = image;
  const { radius, maxColors, threshold, minRegion, replaceMode, mask } = params;
  const n = width * height;

  // Resolve the mask to a set of pixel indices, or null for "everywhere".
  let maskSet: Set<number> | null = null;
  if (mask.size > 0) {
    maskSet = new Set<number>();
    for (const key of mask) {
      const { x, y } = parsePixelKey(key);
      if (x >= 0 && y >= 0 && x < width && y < height) maskSet.add(y * width + x);
    }
    if (maskSet.size === 0) return;
  }

  // Phase 1: flag each opaque (and in-mask) pixel whose window looks dithered.
  const dithered = new Uint8Array(n);
  const counts = new Map<number, number>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (data[p * 4 + 3] === 0) continue;
      if (maskSet !== null && !maskSet.has(p)) continue;

      counts.clear();
      let pairs = 0;
      let diffPairs = 0;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(height - 1, y + radius);
      for (let wy = y0; wy <= y1; wy++) {
        for (let wx = x0; wx <= x1; wx++) {
          const q = wy * width + wx;
          const qi = q * 4;
          if (data[qi + 3] === 0) continue;
          const key = pack(data[qi], data[qi + 1], data[qi + 2]);
          counts.set(key, (counts.get(key) ?? 0) + 1);
          if (wx < x1) {
            const ri = (q + 1) * 4;
            if (data[ri + 3] !== 0) {
              pairs++;
              if (pack(data[ri], data[ri + 1], data[ri + 2]) !== key) diffPairs++;
            }
          }
          if (wy < y1) {
            const ri = (q + width) * 4;
            if (data[ri + 3] !== 0) {
              pairs++;
              if (pack(data[ri], data[ri + 1], data[ri + 2]) !== key) diffPairs++;
            }
          }
        }
      }
      const distinct = counts.size;
      if (distinct < 2 || distinct > maxColors || pairs === 0) continue;
      if (diffPairs / pairs >= threshold) dithered[p] = 1;
    }
  }

  // For snap mode, gather the distinct opaque colors present once (before any
  // writes), with their Oklab coords, to snap each region's average onto.
  let snap: Array<{ r: number; g: number; b: number; L: number; a: number; bb: number }> | null = null;
  if (replaceMode === 'snap') {
    snap = [];
    const seen = new Set<number>();
    for (let p = 0; p < n; p++) {
      const i = p * 4;
      if (data[i + 3] === 0) continue;
      const key = pack(data[i], data[i + 1], data[i + 2]);
      if (seen.has(key)) continue;
      seen.add(key);
      const lab = rgbToOklab({ r: data[i], g: data[i + 1], b: data[i + 2] });
      snap.push({ r: data[i], g: data[i + 1], b: data[i + 2], L: lab.L, a: lab.a, bb: lab.b });
    }
  }

  // Phase 2: flood-fill 4-connected dithered regions; fill the big ones with
  // their average color. Components are disjoint and each is averaged from the
  // original colors before being overwritten, so in-place writes are safe.
  const visited = new Uint8Array(n);
  const stack: number[] = [];
  const comp: number[] = [];
  for (let start = 0; start < n; start++) {
    if (dithered[start] === 0 || visited[start] === 1) continue;

    comp.length = 0;
    stack.length = 0;
    stack.push(start);
    visited[start] = 1;
    while (stack.length > 0) {
      const p = stack.pop() as number;
      comp.push(p);
      const px = p % width;
      if (px > 0 && dithered[p - 1] === 1 && visited[p - 1] === 0) {
        visited[p - 1] = 1;
        stack.push(p - 1);
      }
      if (px < width - 1 && dithered[p + 1] === 1 && visited[p + 1] === 0) {
        visited[p + 1] = 1;
        stack.push(p + 1);
      }
      if (p - width >= 0 && dithered[p - width] === 1 && visited[p - width] === 0) {
        visited[p - width] = 1;
        stack.push(p - width);
      }
      if (p + width < n && dithered[p + width] === 1 && visited[p + width] === 0) {
        visited[p + width] = 1;
        stack.push(p + width);
      }
    }
    if (comp.length < minRegion) continue;

    let sL = 0;
    let sa = 0;
    let sb = 0;
    for (const p of comp) {
      const i = p * 4;
      const lab = rgbToOklab({ r: data[i], g: data[i + 1], b: data[i + 2] });
      sL += lab.L;
      sa += lab.a;
      sb += lab.b;
    }
    const w = comp.length;
    const tL = sL / w;
    const ta = sa / w;
    const tb = sb / w;

    let mid = oklabToRgb({ L: tL, a: ta, b: tb });
    if (snap !== null && snap.length > 0) {
      let best = snap[0];
      let bestDist = Number.POSITIVE_INFINITY;
      for (const c of snap) {
        const dL = tL - c.L;
        const da = ta - c.a;
        const db = tb - c.bb;
        const d = dL * dL + da * da + db * db;
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      mid = { r: best.r, g: best.g, b: best.b };
    }

    for (const p of comp) {
      const i = p * 4;
      data[i] = mid.r;
      data[i + 1] = mid.g;
      data[i + 2] = mid.b;
      data[i + 3] = 255;
    }
  }
}
