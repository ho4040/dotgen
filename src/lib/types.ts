/** Core domain types for the pixel-art quantization pipeline. */

/** 8-bit sRGB color (channels 0–255). */
export interface RGB {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** 8-bit sRGB color with alpha (channels 0–255). */
export interface RGBA extends RGB {
  readonly a: number;
}

/** Perceptual Oklab color used for clustering and nearest-color search. */
export interface Oklab {
  readonly L: number;
  readonly a: number;
  readonly b: number;
}

/** A single entry of a generated palette. */
export interface PaletteColor {
  /** Stable index of this color within its palette. */
  readonly id: number;
  readonly rgb: RGB;
  /** Number of source samples assigned to this cluster (for sorting/inspection). */
  readonly population: number;
}

export type Palette = readonly PaletteColor[];

/** Strategy for picking the source color of each output pixel. */
export const SAMPLING_MODES = ['point', 'dominant'] as const;
export type SamplingMode = (typeof SAMPLING_MODES)[number];

export interface ResampleOptions {
  readonly targetWidth: number;
  readonly targetHeight: number;
  /**
   * Fractional offset, in *source-pixel units*, added to the sampling grid.
   * Lets the user nudge sample points into the center of source cells so the
   * grid never lands on a color boundary (which would otherwise mix colors).
   */
  readonly offsetX: number;
  readonly offsetY: number;
  readonly mode: SamplingMode;
  /** Grid size per axis for `dominant` mode (>= 1). Ignored for `point`. */
  readonly supersample: number;
}

export interface QuantizeOptions {
  readonly palette: Palette;
  /** Palette color ids that should be rendered fully transparent. */
  readonly transparentIds: ReadonlySet<number>;
  /** Source alpha strictly below this (0–255) becomes transparent. */
  readonly alphaThreshold: number;
}

/**
 * Everything the worker needs to render one frame from a cached source image.
 * This single bag is the entire main-thread → worker contract: each pipeline
 * feature contributes one field here and is consumed in the worker, so adding
 * or changing a feature never touches the plumbing in between.
 */
export interface PipelineParams {
  readonly colorCount: number;
  /** Palette ids to render fully transparent. */
  readonly transparentIds: ReadonlySet<number>;
  /** Groups of palette ids to collapse onto one representative color. */
  readonly mergeGroups: ReadonlyArray<ReadonlyArray<number>>;
  readonly resample: ResampleOptions;
  /** Source alpha strictly below this (0–255) becomes transparent. */
  readonly alphaThreshold: number;
  /** Per-color RGB overrides (palette id → hand-tweaked color). */
  readonly paletteEdits: ReadonlyMap<number, RGB>;
  /** When set, recolor the finished image onto this palette as a final pass. */
  readonly paletteOverride: Palette | null;
}
