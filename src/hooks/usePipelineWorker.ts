import { useCallback, useEffect, useRef, useState } from 'react';
import type { InboundMessage, RenderedMessage } from '../lib/pipelineWorker';
import type { Palette, PipelineParams } from '../lib/types';

export interface PipelineOutput {
  readonly palette: Palette;
  readonly result: ImageData | null;
  /** True while a render is in flight or queued. */
  readonly processing: boolean;
}

interface Request {
  readonly source: ImageData;
  readonly params: PipelineParams;
}

/**
 * Runs the pixel pipeline in a Web Worker. At most one render is in flight at a
 * time; rapid input changes are coalesced into a single trailing request, so
 * dragging a slider never floods the worker or blocks the UI.
 *
 * The whole pipeline configuration travels as one {@link PipelineParams} bag, so
 * this hook never names individual features — adding one needs no change here.
 */
export function usePipelineWorker(source: ImageData | null, params: PipelineParams): PipelineOutput {
  const [palette, setPalette] = useState<Palette>([]);
  const [result, setResult] = useState<ImageData | null>(null);
  const [processing, setProcessing] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const pendingRef = useRef<Request | null>(null);
  const sentSourceRef = useRef<ImageData | null>(null);

  const post = useCallback((req: Request): void => {
    const worker = workerRef.current;
    if (worker === null) return;

    // Send the source pixels once per upload (transfer a private copy so the
    // main thread keeps its own buffer for the original-image preview).
    if (sentSourceRef.current !== req.source) {
      sentSourceRef.current = req.source;
      const copy = new Uint8ClampedArray(req.source.data);
      const setSource: InboundMessage = {
        type: 'setSource',
        width: req.source.width,
        height: req.source.height,
        buffer: copy.buffer,
      };
      worker.postMessage(setSource, [copy.buffer]);
    }

    const render: InboundMessage = {
      type: 'render',
      requestId: ++requestIdRef.current,
      params: req.params,
    };
    worker.postMessage(render);
  }, []);

  const request = useCallback(
    (req: Request): void => {
      setProcessing(true);
      if (inFlightRef.current) {
        pendingRef.current = req; // coalesce: keep only the latest
        return;
      }
      inFlightRef.current = true;
      post(req);
    },
    [post],
  );

  useEffect(() => {
    const worker = new Worker(new URL('../lib/pipelineWorker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<RenderedMessage>): void => {
      const message = event.data;
      inFlightRef.current = false;
      // Ignore stale replies (a newer request was issued meanwhile).
      if (message.requestId === requestIdRef.current) {
        setPalette(message.palette);
        setResult(new ImageData(new Uint8ClampedArray(message.buffer), message.width, message.height));
      }
      const next = pendingRef.current;
      if (next !== null) {
        pendingRef.current = null;
        inFlightRef.current = true;
        post(next);
      } else {
        setProcessing(false);
      }
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
      sentSourceRef.current = null;
      inFlightRef.current = false;
      pendingRef.current = null;
    };
  }, [post]);

  useEffect(() => {
    if (source === null) {
      setPalette([]);
      setResult(null);
      setProcessing(false);
      return;
    }
    request({ source, params });
    // `params` is memoized by the caller, so this fires only on real changes.
  }, [source, params, request]);

  return { palette, result, processing };
}
