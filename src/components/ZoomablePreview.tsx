import { useCallback, useEffect, useRef, useState } from 'react';
import type { RGBA } from '../lib/types';
import { CanvasView } from './CanvasView';

interface ZoomablePreviewProps {
  readonly image: ImageData;
  /** Approximate display width (px) used to pick the initial "fit" zoom. */
  readonly fitWidth?: number;
  /** Called with the color of a clicked pixel (a click, not a pan/drag). */
  readonly onPickColor?: (color: RGBA) => void;
  /** When set, the viewer enters paint mode: click/drag paints the pixel under
   * the pointer (panning is disabled) and color-picking is off. */
  readonly onPaintPixel?: (x: number, y: number) => void;
  /** In paint mode, Alt+click/drag samples the pixel under the pointer instead
   * of painting (eyedropper). */
  readonly onEyedrop?: (x: number, y: number) => void;
}

/** Pointer travel (client px) below which a press-release counts as a click. */
const CLICK_SLOP = 4;

const MIN_ZOOM = 1;
const MAX_ZOOM = 64;

function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(zoom)));
}

/** Integer zoom that makes the image roughly `fitWidth` px wide. */
function fitZoom(imageWidth: number, fitWidth: number): number {
  return clampZoom(fitWidth / imageWidth);
}

interface PanOrigin {
  readonly x: number;
  readonly y: number;
  readonly left: number;
  readonly top: number;
}

/** Result viewer: zoom in/out buttons, drag-to-pan, and a fit reset. */
export function ZoomablePreview({ image, fitWidth = 320, onPickColor, onPaintPixel, onEyedrop }: ZoomablePreviewProps) {
  const [zoom, setZoom] = useState<number>(() => fitZoom(image.width, fitWidth));
  const [panning, setPanning] = useState(false);
  const lastDimsRef = useRef<string>(`${image.width}x${image.height}`);
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<PanOrigin | null>(null);
  // Pointer-down position, kept for every press (even when panning is
  // impossible) so pointer-up can tell a click apart from a drag.
  const downRef = useRef<{ x: number; y: number } | null>(null);
  const paintingRef = useRef(false);
  const paintMode = onPaintPixel !== undefined;

  // Re-fit synchronously when the output dimensions change, so we never commit
  // a frame at a stale zoom (which could lay out a huge canvas and jank).
  const dims = `${image.width}x${image.height}`;
  if (lastDimsRef.current !== dims) {
    lastDimsRef.current = dims;
    setZoom(fitZoom(image.width, fitWidth));
  }

  const fit = useCallback((): void => {
    setZoom(fitZoom(image.width, fitWidth));
    const node = viewportRef.current;
    if (node !== null) node.scrollTo(0, 0);
  }, [image.width, fitWidth]);

  const step = useCallback((delta: number): void => {
    setZoom((prev) => clampZoom(prev + delta));
  }, []);

  // Native (non-passive) wheel listener so we can preventDefault page scroll.
  useEffect(() => {
    const node = viewportRef.current;
    if (node === null) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      setZoom((prev) => clampZoom(prev + (event.deltaY < 0 ? 1 : -1)));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  const canPan = (node: HTMLDivElement): boolean =>
    node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight;

  // Map a client coordinate to the image pixel under it, accounting for the
  // canvas's rendered rect (any zoom/scroll). Returns null when outside.
  const pixelAt = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = viewportRef.current?.querySelector('canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const px = Math.floor(((clientX - rect.left) / rect.width) * image.width);
    const py = Math.floor(((clientY - rect.top) / rect.height) * image.height);
    if (px < 0 || py < 0 || px >= image.width || py >= image.height) return null;
    return { x: px, y: py };
  };

  const pickAt = (clientX: number, clientY: number): void => {
    if (onPickColor === undefined) return;
    const p = pixelAt(clientX, clientY);
    if (p === null) return;
    const i = (p.y * image.width + p.x) * 4;
    const d = image.data;
    onPickColor({ r: d[i], g: d[i + 1], b: d[i + 2], a: d[i + 3] });
  };

  // In paint mode: Alt samples (eyedropper) when an onEyedrop handler is set,
  // otherwise paints the pixel under the pointer.
  const actAt = (clientX: number, clientY: number, alt: boolean): void => {
    const p = pixelAt(clientX, clientY);
    if (p === null) return;
    if (alt && onEyedrop !== undefined) onEyedrop(p.x, p.y);
    else if (onPaintPixel !== undefined) onPaintPixel(p.x, p.y);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (paintMode) {
      paintingRef.current = true;
      viewportRef.current?.setPointerCapture(event.pointerId);
      actAt(event.clientX, event.clientY, event.altKey);
      return;
    }
    downRef.current = { x: event.clientX, y: event.clientY };
    const node = viewportRef.current;
    if (node === null || !canPan(node)) return;
    node.setPointerCapture(event.pointerId);
    panRef.current = { x: event.clientX, y: event.clientY, left: node.scrollLeft, top: node.scrollTop };
    setPanning(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (paintMode) {
      if (paintingRef.current) actAt(event.clientX, event.clientY, event.altKey);
      return;
    }
    const node = viewportRef.current;
    const origin = panRef.current;
    if (node === null || origin === null) return;
    node.scrollLeft = origin.left - (event.clientX - origin.x);
    node.scrollTop = origin.top - (event.clientY - origin.y);
  };

  const releaseCapture = (event: React.PointerEvent<HTMLDivElement>): void => {
    const node = viewportRef.current;
    if (node !== null && panRef.current !== null) {
      try {
        node.releasePointerCapture(event.pointerId);
      } catch {
        // pointer already released — ignore
      }
    }
    panRef.current = null;
    setPanning(false);
  };

  const endPaint = (event: React.PointerEvent<HTMLDivElement>): void => {
    paintingRef.current = false;
    try {
      viewportRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // pointer already released — ignore
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (paintMode) {
      endPaint(event);
      return;
    }
    const down = downRef.current;
    downRef.current = null;
    releaseCapture(event);
    // A press that barely moved is a click: pick the pixel under it.
    if (down !== null && Math.abs(event.clientX - down.x) + Math.abs(event.clientY - down.y) <= CLICK_SLOP) {
      pickAt(event.clientX, event.clientY);
    }
  };

  const onPointerCancel = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (paintMode) {
      endPaint(event);
      return;
    }
    downRef.current = null;
    releaseCapture(event);
  };

  return (
    <div className="zoom">
      <div className="zoom__bar">
        <button type="button" onClick={() => step(-1)} disabled={zoom <= MIN_ZOOM} aria-label="축소">
          −
        </button>
        <span className="zoom__value">{zoom}×</span>
        <button type="button" onClick={() => step(1)} disabled={zoom >= MAX_ZOOM} aria-label="확대">
          +
        </button>
        <button type="button" className="zoom__fit" onClick={fit}>
          맞춤
        </button>
      </div>
      <div
        className={`zoom__viewport${panning ? ' zoom__viewport--panning' : ''}${paintMode ? ' zoom__viewport--paint' : ''}`}
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <CanvasView image={image} displayWidth={image.width * zoom} className="checker pixelated" />
      </div>
      <p className="muted zoom__hint">
        {paintMode
          ? `휠로 확대/축소 · 클릭/드래그로 칠하기${onEyedrop !== undefined ? ' · Alt+클릭 스포이드' : ''}`
          : '휠로 확대/축소 · 드래그로 이동'}{' '}
        ·{' '}
        {image.width * zoom}×{image.height * zoom}px 표시
      </p>
    </div>
  );
}
