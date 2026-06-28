import { quantize } from './quantize';
import { resample } from './resample';
import type { Palette, ResampleOptions } from './types';

export interface PipelineOptions {
  readonly resample: ResampleOptions;
  readonly palette: Palette;
  readonly transparentIds: ReadonlySet<number>;
  readonly alphaThreshold: number;
}

/**
 * Full pixel-art pipeline: resize first (no color mixing), then quantize the
 * small result to the palette. Quantizing after the resize guarantees every
 * output pixel is one of the palette colors.
 */
export function runPipeline(source: ImageData, opts: PipelineOptions): ImageData {
  const resized = resample(source, opts.resample);
  return quantize(resized, {
    palette: opts.palette,
    transparentIds: opts.transparentIds,
    alphaThreshold: opts.alphaThreshold,
  });
}
