/**
 * Dedicated worker: runs the heavy palette clustering + resample/quantize off
 * the main thread so the UI never blocks, regardless of image size.
 *
 * Protocol:
 *  - main → worker `setSource`: cache the source pixels (sent once per upload).
 *  - main → worker `render`:    compute palette + result for the given params.
 *  - worker → main `rendered`:  palette + result pixels (buffer transferred).
 */
import { applyDedither } from './dedither';
import { buildPalette } from './kmeans';
import { recolorMerged } from './mergePalette';
import { applyOutline } from './outline';
import { applyPaletteEdits } from './paletteEdit';
import { runPipeline } from './pipeline';
import { quantize } from './quantize';
import type { Palette, PipelineParams } from './types';

interface SetSourceMessage {
  readonly type: 'setSource';
  readonly width: number;
  readonly height: number;
  readonly buffer: ArrayBuffer;
}

interface RenderMessage {
  readonly type: 'render';
  readonly requestId: number;
  /** The whole pipeline configuration — see {@link PipelineParams}. */
  readonly params: PipelineParams;
}

export type InboundMessage = SetSourceMessage | RenderMessage;

export interface RenderedMessage {
  readonly type: 'rendered';
  readonly requestId: number;
  readonly palette: Palette;
  readonly width: number;
  readonly height: number;
  readonly buffer: ArrayBuffer;
}

/** Minimal view of the worker global that avoids needing the "webworker" lib. */
interface WorkerScope {
  onmessage: ((event: MessageEvent<InboundMessage>) => void) | null;
  postMessage: (message: RenderedMessage, transfer: Transferable[]) => void;
}

const ctx = self as unknown as WorkerScope;
let source: ImageData | null = null;

ctx.onmessage = (event: MessageEvent<InboundMessage>): void => {
  const message = event.data;

  if (message.type === 'setSource') {
    source = new ImageData(new Uint8ClampedArray(message.buffer), message.width, message.height);
    return;
  }

  if (source === null) return;

  const params = message.params;

  // Stage 1: analyze + resize + quantize to the auto palette + drop transparent.
  // The auto palette (with any per-color RGB edits applied) is returned to the
  // UI as-is; merging only affects output.
  const palette = applyPaletteEdits(
    buildPalette(source, {
      colorCount: params.colorCount,
      alphaThreshold: params.alphaThreshold,
    }),
    params.paletteEdits,
  );
  let result = runPipeline(source, {
    resample: params.resample,
    palette,
    transparentIds: params.transparentIds,
    alphaThreshold: params.alphaThreshold,
  });

  // Collapse merged groups' regions onto their representative color (the
  // assignment above used the original palette, so regions stay put).
  recolorMerged(result, palette, params.mergeGroups);

  // Stage 2 (optional): recolor the finished image onto the override palette.
  // Already-transparent pixels (alpha 0) stay transparent.
  const override = params.paletteOverride;
  if (override !== null && override.length > 0) {
    result = quantize(result, {
      palette: override,
      transparentIds: new Set(),
      alphaThreshold: 1,
    });
  }

  // Clean up dithered regions before outlining, so the outline traces the
  // flattened silhouette. Runs after merge/override so it sees final colors.
  if (params.dedither !== null) applyDedither(result, params.dedither);

  // Final pass: outline the transparent/opaque seam with the darkest output
  // color. Runs last so it uses the effective (merged/overridden) colors and
  // the dark line is never re-quantized away.
  if (params.outline) applyOutline(result);

  ctx.postMessage(
    {
      type: 'rendered',
      requestId: message.requestId,
      palette,
      width: result.width,
      height: result.height,
      buffer: result.data.buffer,
    },
    [result.data.buffer],
  );
};
