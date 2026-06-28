import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adjustImage, NO_ADJUST, type EdgeAdjust } from '../lib/adjust';
import { fileToImageData } from '../lib/imageIO';
import { paletteFromJson } from '../lib/paletteIO';
import { applyPixelEdits } from '../lib/pixelEdits';
import { useMerge } from './useMerge';
import { usePaletteEdits } from './usePaletteEdits';
import { usePipelineWorker } from './usePipelineWorker';
import { usePixelEdits } from './usePixelEdits';
import { useResample, type ResampleSettings, type ResampleTuning } from './useResample';
import { useTransparency } from './useTransparency';
import type { Palette, PipelineParams, RGB } from '../lib/types';

/** Source alpha strictly below this is treated as transparent throughout. */
const ALPHA_THRESHOLD = 8;

export interface PixelArtState {
  readonly source: ImageData | null;
  readonly sourceName: string;
  /** Per-edge crop (negative) / edge-clamp extension (positive) of the source. */
  readonly edges: EdgeAdjust;
  /** Source dimensions after applying `edges` — what the pipeline actually sees. */
  readonly adjustedWidth: number;
  readonly adjustedHeight: number;
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly error: string | null;
  readonly colorCount: number;
  /** The analyzed palette (used for transparency selection and JSON export). */
  readonly palette: Palette;
  /** A loaded palette that recolors the finished image (null = analyze only). */
  readonly paletteOverride: Palette | null;
  /** Per-color RGB edits the user has applied (palette id → color). */
  readonly paletteEdits: ReadonlyMap<number, RGB>;
  /** Hand-painted per-pixel overrides on the final result (position key → color). */
  readonly pixelEdits: ReadonlyMap<string, RGB>;
  readonly transparentIds: ReadonlySet<number>;
  /** Groups of palette ids merged onto one representative color. */
  readonly mergeGroups: ReadonlyArray<ReadonlyArray<number>>;
  /** Every valid target width (the divisors of the source width), ascending. */
  readonly widthOptions: readonly number[];
  readonly resample: ResampleSettings;
  readonly result: ImageData | null;
  /** True while the worker is computing the result. */
  readonly processing: boolean;
}

export interface PixelArtActions {
  loadFile: (file: File) => Promise<void>;
  setColorCount: (count: number) => void;
  toggleTransparentMany: (ids: readonly number[]) => void;
  clearTransparent: () => void;
  mergeColors: (ids: readonly number[]) => void;
  unmergeColors: (ids: readonly number[]) => void;
  clearMerges: () => void;
  setTargetWidth: (width: number) => void;
  setEdges: (patch: Partial<EdgeAdjust>) => void;
  setResample: (patch: Partial<ResampleTuning>) => void;
  /** Override one palette color's RGB (live-recolors the result). */
  setColorRgb: (id: number, rgb: RGB) => void;
  /** Restore one palette color to its analyzed value. */
  resetColorEdit: (id: number) => void;
  /** Paint one output pixel the given color. */
  paintPixel: (x: number, y: number, rgb: RGB) => void;
  /** Revert one hand-painted pixel to the pipeline output. */
  erasePixel: (x: number, y: number) => void;
  /** Drop all hand-painted pixel overrides. */
  clearPixelEdits: () => void;
  importPaletteFile: (file: File) => Promise<void>;
  applyOverridePalette: (palette: Palette) => void;
  clearPaletteOverride: () => void;
}

export type UsePixelArt = PixelArtState & { readonly actions: PixelArtActions };

/**
 * Composes the independent feature hooks into the app's single view-model.
 * Each feature (transparency, merge, resample) owns its own state; this hook
 * only holds the source image + palette-override and orchestrates the few
 * genuinely cross-feature resets (a new image or palette invalidates them).
 */
export function usePixelArt(): UsePixelArt {
  const [source, setSource] = useState<ImageData | null>(null);
  const [sourceName, setSourceName] = useState<string>('');
  const [status, setStatus] = useState<PixelArtState['status']>('idle');
  const [error, setError] = useState<string | null>(null);
  const [colorCount, setColorCountState] = useState<number>(16);
  const [edges, setEdgesState] = useState<EdgeAdjust>(NO_ADJUST);
  const [paletteOverride, setPaletteOverride] = useState<Palette | null>(null);

  const { transparentIds, toggleMany: toggleTransparentMany, clear: clearTransparent } = useTransparency();
  const { mergeGroups, merge: mergeColors, unmerge: unmergeColors, clear: clearMerges } = useMerge();
  const {
    edits: paletteEdits,
    setColor: setColorRgb,
    resetColor: resetColorEdit,
    clear: clearPaletteEdits,
  } = usePaletteEdits();
  const { edits: pixelEdits, paint: paintPixel, erase: erasePixel, clear: clearPixelEdits } = usePixelEdits();

  // The cropped/extended source that the rest of the pipeline operates on; the
  // raw `source` is kept only for the original-image preview.
  const adjustedSource = useMemo<ImageData | null>(
    () => (source === null ? null : adjustImage(source, edges)),
    [source, edges],
  );
  const adjustedWidth = adjustedSource?.width ?? 0;
  const adjustedHeight = adjustedSource?.height ?? 0;

  const { resample, widthOptions, setResample, setTargetWidth, recenterOffset, initForSource } =
    useResample(adjustedSource);

  const loadFile = useCallback(
    async (file: File): Promise<void> => {
      setStatus('loading');
      setError(null);
      try {
        const image = await fileToImageData(file);
        setSource(image);
        setSourceName(file.name);
        setEdgesState(NO_ADJUST);
        initForSource(image.width);
        clearTransparent();
        clearMerges();
        clearPaletteEdits();
        clearPixelEdits();
        setStatus('ready');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Failed to load image');
        setStatus('error');
      }
    },
    [initForSource, clearTransparent, clearMerges, clearPaletteEdits, clearPixelEdits],
  );

  const params = useMemo<PipelineParams>(
    () => ({
      colorCount,
      transparentIds,
      mergeGroups,
      resample,
      alphaThreshold: ALPHA_THRESHOLD,
      paletteEdits,
      paletteOverride,
    }),
    [colorCount, transparentIds, mergeGroups, resample, paletteEdits, paletteOverride],
  );

  const { palette, result: workerResult, processing } = usePipelineWorker(adjustedSource, params);

  // Hand-painted pixels are the final layer, applied on the main thread so each
  // stroke is instant and the worker pipeline stays untouched. The PNG export
  // and preview both read this overlaid result.
  const result = useMemo<ImageData | null>(
    () => (workerResult === null ? null : applyPixelEdits(workerResult, pixelEdits)),
    [workerResult, pixelEdits],
  );

  // Pixel overrides are keyed by position at the result's size; once the output
  // geometry changes (resolution, crop, new image), those positions point at
  // different pixels, so drop them.
  const lastDimsRef = useRef<string>('');
  useEffect(() => {
    const dims = workerResult === null ? '' : `${workerResult.width}x${workerResult.height}`;
    if (dims !== lastDimsRef.current) {
      lastDimsRef.current = dims;
      clearPixelEdits();
    }
  }, [workerResult, clearPixelEdits]);

  const setColorCount = useCallback(
    (count: number): void => {
      // The palette is about to be regenerated, so previously-selected
      // transparent ids, merges, and color edits no longer refer to the same colors.
      setColorCountState(Math.max(1, Math.min(256, Math.round(count))));
      clearTransparent();
      clearMerges();
      clearPaletteEdits();
    },
    [clearTransparent, clearMerges, clearPaletteEdits],
  );

  const setEdges = useCallback(
    (patch: Partial<EdgeAdjust>): void => {
      setEdgesState((prev) => ({ ...prev, ...patch }));
      // Block sizes shift with the new dimensions, so re-center the within-block
      // offset (the resample hook re-clamps the target width in an effect).
      recenterOffset();
    },
    [recenterOffset],
  );

  const importPaletteFile = useCallback(async (file: File): Promise<void> => {
    try {
      setPaletteOverride(paletteFromJson(await file.text()));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '팔레트를 불러올 수 없습니다');
    }
  }, []);

  const applyOverridePalette = useCallback((palette: Palette): void => {
    setPaletteOverride(palette.length > 0 ? palette : null);
    setError(null);
  }, []);

  const clearPaletteOverride = useCallback((): void => {
    setPaletteOverride(null);
  }, []);

  return {
    source,
    sourceName,
    edges,
    adjustedWidth,
    adjustedHeight,
    status,
    error,
    colorCount,
    palette,
    paletteOverride,
    paletteEdits,
    pixelEdits,
    transparentIds,
    mergeGroups,
    widthOptions,
    resample,
    result,
    processing,
    actions: {
      loadFile,
      setColorCount,
      toggleTransparentMany,
      clearTransparent,
      mergeColors,
      unmergeColors,
      clearMerges,
      setTargetWidth,
      setEdges,
      setResample,
      setColorRgb,
      resetColorEdit,
      paintPixel,
      erasePixel,
      clearPixelEdits,
      importPaletteFile,
      applyOverridePalette,
      clearPaletteOverride,
    },
  };
}
