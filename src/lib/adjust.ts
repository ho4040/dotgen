/** Source-image cropping / edge-clamp extension applied before resampling. */

/** Per-edge pixel deltas. Negative crops that edge; positive extends it by
 * repeating (clamping) the boundary pixel — never an interpolated stretch. */
export interface EdgeAdjust {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export const NO_ADJUST: EdgeAdjust = { left: 0, right: 0, top: 0, bottom: 0 };

export function hasAdjust(edges: EdgeAdjust): boolean {
  return edges.left !== 0 || edges.right !== 0 || edges.top !== 0 || edges.bottom !== 0;
}

/** Width after applying the horizontal edges (never below 1px). */
export function adjustedWidth(sourceWidth: number, edges: EdgeAdjust): number {
  return Math.max(1, sourceWidth + edges.left + edges.right);
}

/** Height after applying the vertical edges (never below 1px). */
export function adjustedHeight(sourceHeight: number, edges: EdgeAdjust): number {
  return Math.max(1, sourceHeight + edges.top + edges.bottom);
}

/**
 * Crop and/or edge-extend `source` per `edges`, returning new pixels. Output
 * pixels that fall outside the source copy the nearest boundary pixel (clamp),
 * so extension repeats the edge rather than scaling the whole image. Returns the
 * input unchanged when no edge is adjusted.
 */
export function adjustImage(source: ImageData, edges: EdgeAdjust): ImageData {
  if (!hasAdjust(edges)) return source;

  const sw = source.width;
  const sh = source.height;
  const nw = adjustedWidth(sw, edges);
  const nh = adjustedHeight(sh, edges);
  const src = source.data;
  const out = new Uint8ClampedArray(nw * nh * 4);

  for (let y = 0; y < nh; y++) {
    // Map output row back to source, clamping into the original bounds.
    let sy = y - edges.top;
    if (sy < 0) sy = 0;
    else if (sy >= sh) sy = sh - 1;
    const srcRow = sy * sw;
    const outRow = y * nw;
    for (let x = 0; x < nw; x++) {
      let sx = x - edges.left;
      if (sx < 0) sx = 0;
      else if (sx >= sw) sx = sw - 1;
      const si = (srcRow + sx) * 4;
      const oi = (outRow + x) * 4;
      out[oi] = src[si];
      out[oi + 1] = src[si + 1];
      out[oi + 2] = src[si + 2];
      out[oi + 3] = src[si + 3];
    }
  }

  return new ImageData(out, nw, nh);
}
