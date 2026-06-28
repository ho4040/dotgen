/**
 * Browser-only palette storage backed by IndexedDB.
 *
 * Saved palettes (metadata + colors), the source PNG, and a small thumbnail all
 * live in the user's browser — no server. The public surface mirrors the old
 * network client so callers stay unchanged, except thumbnails are now carried
 * inline as data URLs (`thumbDataUrl`) instead of a server URL.
 */
import type { Palette } from './types';

const DB_NAME = 'dotgen';
const DB_VERSION = 1;
const STORE = 'palettes';

/** A saved palette as returned to the UI (source PNG blob omitted). */
export interface SavedPalette {
  readonly id: string;
  readonly name: string;
  readonly sourceName: string;
  readonly colorCount: number;
  readonly width: number;
  readonly height: number;
  /** Inline thumbnail data URL, or null when no source image was saved. */
  readonly thumbDataUrl: string | null;
  readonly createdAt: number;
  readonly colors: ReadonlyArray<{ r: number; g: number; b: number; population: number }>;
}

/** The full record persisted in IndexedDB (keeps the original PNG for re-export). */
interface StoredPalette extends Omit<SavedPalette, 'thumbDataUrl'> {
  readonly thumbDataUrl: string | null;
  readonly original: Blob | null;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('이 브라우저는 로컬 저장소(IndexedDB)를 지원하지 않습니다'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB를 열지 못했습니다'));
  });
  return dbPromise;
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('저장소 트랜잭션 실패'));
    tx.onabort = () => reject(tx.error ?? new Error('저장소 트랜잭션 중단'));
  });
}

function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('저장소 요청 실패'));
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('썸네일 인코딩 실패'));
    reader.readAsDataURL(blob);
  });
}

function toSaved(record: StoredPalette): SavedPalette {
  const { original: _original, ...rest } = record;
  void _original;
  return rest;
}

/** List saved palettes, newest first. */
export async function listSavedPalettes(): Promise<SavedPalette[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const all = await req(tx.objectStore(STORE).getAll() as IDBRequest<StoredPalette[]>);
  await txDone(tx);
  return all.map(toSaved).sort((a, b) => b.createdAt - a.createdAt);
}

export interface SavePaletteInput {
  readonly name: string;
  readonly sourceName: string;
  readonly palette: Palette;
  readonly width: number;
  readonly height: number;
  /** Source image PNG; omitted when no image is loaded. */
  readonly original: Blob | null;
  readonly thumbnail: Blob | null;
}

/** Persist a palette (and optional source image) to IndexedDB. */
export async function savePalette(input: SavePaletteInput): Promise<SavedPalette> {
  const thumbDataUrl = input.thumbnail ? await blobToDataUrl(input.thumbnail) : null;
  const record: StoredPalette = {
    id: crypto.randomUUID(),
    name: input.name,
    sourceName: input.sourceName,
    colorCount: input.palette.length,
    width: input.width,
    height: input.height,
    thumbDataUrl,
    original: input.original,
    createdAt: Date.now(),
    colors: input.palette.map((c) => ({
      r: c.rgb.r,
      g: c.rgb.g,
      b: c.rgb.b,
      population: c.population,
    })),
  };

  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(record);
  await txDone(tx);
  return toSaved(record);
}

export async function deleteSavedPalette(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
}

/** Convert a saved palette's colors into the app's `Palette` shape. */
export function savedPaletteToPalette(saved: SavedPalette): Palette {
  return saved.colors.map((c, i) => ({
    id: i,
    rgb: { r: c.r, g: c.g, b: c.b },
    population: c.population,
  }));
}
