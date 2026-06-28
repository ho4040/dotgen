/** Browser-side helpers for getting pixels in and PNGs out. */
import { parsePixelKey } from './pixelEdits';
import type { RGB } from './types';

/**
 * Return a copy of `image` with the `mask` positions blended toward `tint` so
 * the user can see which pixels a region effect covers. Opaque pixels are
 * tinted 50%; transparent ones are shown as a translucent tint patch.
 */
export function overlayMask(image: ImageData, mask: ReadonlySet<string>, tint: RGB): ImageData {
  if (mask.size === 0) return image;
  const out = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  const d = out.data;
  for (const key of mask) {
    const { x, y } = parsePixelKey(key);
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
    const i = (y * image.width + x) * 4;
    if (d[i + 3] === 0) {
      d[i] = tint.r;
      d[i + 1] = tint.g;
      d[i + 2] = tint.b;
      d[i + 3] = 110;
      continue;
    }
    d[i] = (d[i] + tint.r) >> 1;
    d[i + 1] = (d[i + 1] + tint.g) >> 1;
    d[i + 2] = (d[i + 2] + tint.b) >> 1;
  }
  return out;
}

function require2dContext(canvas: HTMLCanvasElement | OffscreenCanvas): CanvasRenderingContext2D {
  const ctx = (canvas as HTMLCanvasElement).getContext('2d', { willReadFrequently: true });
  if (ctx === null) throw new Error('2D canvas context is unavailable');
  return ctx;
}

/** Decode an uploaded image file into raw RGBA pixels. */
export async function fileToImageData(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = require2dContext(canvas);
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

/**
 * Fetch an image from a URL and wrap it in a `File` for the normal load path.
 *
 * Subject to CORS: the host must send `Access-Control-Allow-Origin`, otherwise
 * the fetch is blocked (this is a static, server-only app — no proxy to work
 * around it). The thrown messages explain that to the user.
 */
export async function fetchImageFile(url: string): Promise<File> {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('http(s):// 로 시작하는 이미지 주소를 입력하세요');
  }

  let res: Response;
  try {
    res = await fetch(trimmed, { mode: 'cors' });
  } catch {
    throw new Error('이미지를 가져오지 못했습니다 (CORS 미허용 주소이거나 네트워크 오류)');
  }
  if (!res.ok) throw new Error(`이미지 요청 실패 (HTTP ${res.status})`);

  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) {
    throw new Error('이미지가 아닌 응답입니다 (직접 이미지 파일 주소를 사용하세요)');
  }

  let name = 'image';
  try {
    const base = new URL(trimmed).pathname.split('/').pop();
    if (base) name = decodeURIComponent(base);
  } catch {
    /* keep fallback name */
  }
  return new File([blob], name, { type: blob.type });
}

/** Render ImageData to a canvas, optionally upscaled with nearest-neighbor. */
export function imageDataToCanvas(image: ImageData, scale = 1): HTMLCanvasElement {
  const factor = Math.max(1, Math.floor(scale));
  const base = document.createElement('canvas');
  base.width = image.width;
  base.height = image.height;
  require2dContext(base).putImageData(image, 0, 0);

  if (factor === 1) return base;

  const scaled = document.createElement('canvas');
  scaled.width = image.width * factor;
  scaled.height = image.height * factor;
  const ctx = require2dContext(scaled);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0, scaled.width, scaled.height);
  return scaled;
}

/** Encode a canvas as a PNG blob. */
function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(new Error('Failed to encode PNG'));
      else resolve(blob);
    }, 'image/png');
  });
}

/** Encode ImageData as a PNG blob (nearest-neighbor upscaled if `scale > 1`). */
export async function imageDataToPngBlob(image: ImageData, scale = 1): Promise<Blob> {
  return await canvasToPngBlob(imageDataToCanvas(image, scale));
}

/**
 * Encode ImageData as a smoothly downscaled PNG thumbnail whose longest side is
 * at most `maxSize` px (never upscaled). Used for saved-palette previews.
 */
export async function imageDataToThumbnailBlob(image: ImageData, maxSize = 256): Promise<Blob> {
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));

  const src = document.createElement('canvas');
  src.width = image.width;
  src.height = image.height;
  require2dContext(src).putImageData(image, 0, 0);

  const dst = document.createElement('canvas');
  dst.width = w;
  dst.height = h;
  const ctx = require2dContext(dst);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  return await canvasToPngBlob(dst);
}

/** Trigger a browser download for a blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
