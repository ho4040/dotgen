import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadBlob, imageDataToPngBlob, imageDataToThumbnailBlob } from '../lib/imageIO';
import { paletteToJson, rgbToHex } from '../lib/paletteIO';
import {
  deleteSavedPalette,
  listSavedPalettes,
  savePalette,
  savedPaletteToPalette,
  type SavedPalette,
} from '../lib/storageApi';
import type { Palette } from '../lib/types';

interface PaletteIOProps {
  /** The analyzed palette, exported on save. */
  readonly palette: Palette;
  /** The currently loaded override palette, if any. */
  readonly override: Palette | null;
  readonly baseName: string;
  /** The loaded source image, stored alongside saved palettes. */
  readonly source: ImageData | null;
  readonly onImportFile: (file: File) => void;
  readonly onApplyOverride: (palette: Palette) => void;
  readonly onClearOverride: () => void;
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

export function PaletteIO({
  palette,
  override,
  baseName,
  source,
  onImportFile,
  onApplyOverride,
  onClearOverride,
}: PaletteIOProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState<SavedPalette[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const list = await listSavedPalettes();
      setSaved(list);
      setStorageError(null);
    } catch (cause) {
      setStorageError(cause instanceof Error ? cause.message : '목록을 불러오지 못했습니다');
    }
  }, []);

  // Load the saved-palette list once on mount. State updates happen only after
  // the fetch resolves, and are ignored if the component unmounts first.
  useEffect(() => {
    let active = true;
    listSavedPalettes().then(
      (list) => {
        if (active) setSaved(list);
      },
      (cause: unknown) => {
        if (active) setStorageError(cause instanceof Error ? cause.message : '목록을 불러오지 못했습니다');
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const saveJson = (): void => {
    if (palette.length === 0) return;
    const blob = new Blob([paletteToJson(palette)], { type: 'application/json' });
    downloadBlob(blob, `${stripExtension(baseName) || 'palette'}.palette.json`);
  };

  const saveToStorage = async (): Promise<void> => {
    if (palette.length === 0 || busy) return;
    setBusy(true);
    setStorageError(null);
    try {
      const [original, thumbnail] = source
        ? await Promise.all([imageDataToPngBlob(source), imageDataToThumbnailBlob(source)])
        : [null, null];
      await savePalette({
        name: name.trim() || stripExtension(baseName) || 'untitled',
        sourceName: baseName,
        palette,
        width: source?.width ?? 0,
        height: source?.height ?? 0,
        original,
        thumbnail,
      });
      setName('');
      await refresh();
    } catch (cause) {
      setStorageError(cause instanceof Error ? cause.message : '저장에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string): Promise<void> => {
    try {
      await deleteSavedPalette(id);
      await refresh();
    } catch (cause) {
      setStorageError(cause instanceof Error ? cause.message : '삭제에 실패했습니다');
    }
  };

  return (
    <div className="palette-io">
      <div className="palette-io__actions">
        <button type="button" className="link-btn" onClick={saveJson} disabled={palette.length === 0}>
          분석 팔레트 저장(JSON)
        </button>
        <button type="button" className="link-btn" onClick={() => inputRef.current?.click()}>
          팔레트 불러오기(오버라이드)
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.item(0);
            if (file) onImportFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {override !== null && (
        <div className="palette-io__override">
          <span className="muted">
            <strong className="palette-io__count">오버라이드 {override.length}색</strong> 적용 중 (리사이즈·투명 처리 후 리컬러)
          </span>
          <div className="palette palette--mini" aria-label="오버라이드 팔레트">
            {override.map((c) => (
              <span
                key={c.id}
                className="swatch swatch--static"
                style={{ backgroundColor: rgbToHex(c.rgb) }}
                title={rgbToHex(c.rgb)}
              />
            ))}
          </div>
          <button type="button" className="link-btn" onClick={onClearOverride}>
            오버라이드 해제 (분석 팔레트로 되돌리기)
          </button>
        </div>
      )}

      <div className="palette-store">
        <h4 className="palette-store__title">내부 저장소 (브라우저 로컬)</h4>
        <div className="palette-store__save">
          <input
            type="text"
            className="palette-store__name"
            placeholder={stripExtension(baseName) || '팔레트 이름'}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            className="link-btn"
            onClick={() => void saveToStorage()}
            disabled={palette.length === 0 || busy}
          >
            {busy ? '저장 중…' : '저장소에 저장'}
          </button>
        </div>

        {storageError && <p className="error">{storageError}</p>}

        {saved.length === 0 ? (
          <p className="muted">저장된 팔레트가 없습니다.</p>
        ) : (
          <ul className="palette-store__list">
            {saved.map((item) => (
              <li key={item.id} className="palette-store__item">
                {item.thumbDataUrl !== null ? (
                  <img className="palette-store__thumb" src={item.thumbDataUrl} alt={item.name} loading="lazy" />
                ) : (
                  <span className="palette-store__thumb palette-store__thumb--empty" aria-hidden />
                )}
                <div className="palette-store__meta">
                  <strong className="palette-store__name-label">{item.name}</strong>
                  <span className="muted">{item.colorCount}색</span>
                  <div className="palette palette--mini" aria-hidden>
                    {item.colors.slice(0, 12).map((c, i) => (
                      <span
                        key={i}
                        className="swatch swatch--static"
                        style={{ backgroundColor: rgbToHex(c) }}
                      />
                    ))}
                  </div>
                </div>
                <div className="palette-store__item-actions">
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => onApplyOverride(savedPaletteToPalette(item))}
                  >
                    불러오기
                  </button>
                  <button type="button" className="link-btn link-btn--danger" onClick={() => void remove(item.id)}>
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
