import type { Palette, PaletteColor, RGB } from './types';

const FORMAT = 'dotgen-palette';
const VERSION = 1;

interface PaletteFileColor {
  readonly hex: string;
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

interface PaletteFile {
  readonly format: string;
  readonly version: number;
  readonly colors: readonly PaletteFileColor[];
}

function clampChannel(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHexByte(n: number): string {
  return clampChannel(n).toString(16).padStart(2, '0');
}

export function rgbToHex({ r, g, b }: RGB): string {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

/** Serialize a palette to the dotgen palette JSON format (pretty-printed). */
export function paletteToJson(palette: Palette): string {
  const file: PaletteFile = {
    format: FORMAT,
    version: VERSION,
    colors: palette.map((c) => ({ hex: rgbToHex(c.rgb), r: c.rgb.r, g: c.rgb.g, b: c.rgb.b })),
  };
  return JSON.stringify(file, null, 2);
}

function parseHex(hex: string): RGB | null {
  const body = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(body)) {
    return {
      r: parseInt(body.slice(0, 2), 16),
      g: parseInt(body.slice(2, 4), 16),
      b: parseInt(body.slice(4, 6), 16),
    };
  }
  if (/^[0-9a-fA-F]{3}$/.test(body)) {
    return {
      r: parseInt(body[0] + body[0], 16),
      g: parseInt(body[1] + body[1], 16),
      b: parseInt(body[2] + body[2], 16),
    };
  }
  return null;
}

/** Coerce one entry into RGB; accepts "#hex", "hex", or {r,g,b} / {hex} objects. */
function coerceColor(raw: unknown): RGB | null {
  if (typeof raw === 'string') return parseHex(raw);
  if (raw !== null && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const hex = obj['hex'];
    if (typeof hex === 'string') {
      const parsed = parseHex(hex);
      if (parsed !== null) return parsed;
    }
    const r = obj['r'];
    const g = obj['g'];
    const b = obj['b'];
    if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
      return { r: clampChannel(r), g: clampChannel(g), b: clampChannel(b) };
    }
  }
  return null;
}

/**
 * Parse a palette from JSON text. Lenient about shape: accepts the dotgen
 * format, a bare array of colors, or `{ colors: [...] }`, where each color may
 * be a hex string or an `{r,g,b}` / `{hex}` object. Throws on invalid input.
 */
export function paletteFromJson(text: string): Palette {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('JSON 형식이 올바르지 않습니다.');
  }

  let rawColors: unknown;
  if (Array.isArray(data)) {
    rawColors = data;
  } else if (data !== null && typeof data === 'object') {
    rawColors = (data as Record<string, unknown>)['colors'];
  }
  if (!Array.isArray(rawColors)) {
    throw new Error('"colors" 배열을 찾을 수 없습니다.');
  }

  const colors: PaletteColor[] = [];
  for (const raw of rawColors) {
    const rgb = coerceColor(raw);
    if (rgb !== null) colors.push({ id: colors.length, rgb, population: 0 });
  }
  if (colors.length === 0) {
    throw new Error('유효한 색상이 없습니다.');
  }
  return colors;
}
