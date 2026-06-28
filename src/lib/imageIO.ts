/** Browser-side helpers for getting pixels in and PNGs out. */

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
