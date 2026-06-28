import { useCallback, useState } from 'react';
import { pixelKey } from '../lib/pixelEdits';
import type { DeditherReplaceMode } from '../lib/types';

/** The tunable de-dither settings (everything except the mask). */
export interface DeditherSettings {
  readonly enabled: boolean;
  readonly radius: number;
  readonly maxColors: number;
  readonly threshold: number;
  readonly minRegion: number;
  readonly replaceMode: DeditherReplaceMode;
}

const DEFAULTS: DeditherSettings = {
  enabled: false,
  radius: 1,
  maxColors: 2,
  threshold: 0.4,
  minRegion: 3,
  replaceMode: 'snap',
};

export interface Dedither {
  readonly settings: DeditherSettings;
  /** Output positions ("x,y") the effect is limited to; empty = whole image. */
  readonly mask: ReadonlySet<string>;
  readonly setSettings: (patch: Partial<DeditherSettings>) => void;
  /** Brush the mask under (x,y): a (2·brush+1)² block, added or removed. */
  readonly paintMask: (x: number, y: number, brush: number, erase: boolean) => void;
  readonly clearMask: () => void;
}

/**
 * Owns the de-dither feature: detection settings plus the optional apply-mask.
 * Self-contained — the worker reads {@link DeditherSettings} + mask and does the
 * work in `lib/dedither.ts`; this hook only holds state.
 */
export function useDedither(): Dedither {
  const [settings, setSettingsState] = useState<DeditherSettings>(DEFAULTS);
  const [mask, setMask] = useState<ReadonlySet<string>>(new Set());

  const setSettings = useCallback((patch: Partial<DeditherSettings>): void => {
    setSettingsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const paintMask = useCallback((x: number, y: number, brush: number, erase: boolean): void => {
    setMask((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (let dy = -brush; dy <= brush; dy++) {
        for (let dx = -brush; dx <= brush; dx++) {
          const key = pixelKey(x + dx, y + dy);
          if (erase) {
            if (next.delete(key)) changed = true;
          } else if (!next.has(key)) {
            next.add(key);
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const clearMask = useCallback((): void => {
    setMask((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  return { settings, mask, setSettings, paintMask, clearMask };
}
