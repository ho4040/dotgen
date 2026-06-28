import type { Palette, RGB } from '../lib/types';

interface PixelEditorProps {
  /** Whether a result exists to paint on (controls are disabled otherwise). */
  readonly hasResult: boolean;
  /** Palette colors offered as quick swatches. */
  readonly palette: Palette;
  /** Currently selected paint color. */
  readonly color: RGB;
  readonly onColorChange: (rgb: RGB) => void;
  readonly erasing: boolean;
  readonly onErasingChange: (erasing: boolean) => void;
  /** Eyedropper mode: clicking the preview samples a color instead of painting. */
  readonly eyedropping: boolean;
  readonly onEyedropChange: (eyedropping: boolean) => void;
  /** How many pixels currently carry a manual edit (for the counter). */
  readonly editCount: number;
  readonly onClear: () => void;
}

const hex2 = (n: number): string => n.toString(16).padStart(2, '0');
const toHex = (rgb: RGB): string => `#${hex2(rgb.r)}${hex2(rgb.g)}${hex2(rgb.b)}`;
const fromHex = (hex: string): RGB => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});
const sameColor = (a: RGB, b: RGB): boolean => a.r === b.r && a.g === b.g && a.b === b.b;

/**
 * Controls for direct pixel painting. The actual drawing happens on the shared
 * preview (paint mode); this panel only chooses the color, erase mode, and
 * offers a clear-all. State is owned by the caller so the preview can read it.
 */
export function PixelEditor({
  hasResult,
  palette,
  color,
  onColorChange,
  erasing,
  onErasingChange,
  eyedropping,
  onEyedropChange,
  editCount,
  onClear,
}: PixelEditorProps) {
  if (!hasResult) {
    return <p className="muted">결과가 준비되면 미리보기에서 픽셀을 직접 칠할 수 있습니다.</p>;
  }

  return (
    <div className="pixel-editor">
      <h3>색 선택</h3>
      {palette.length > 0 && (
        <div className="palette palette--mini">
          {palette.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`swatch swatch--static${sameColor(c.rgb, color) ? ' swatch--selected' : ''}`}
              style={{ background: toHex(c.rgb) }}
              onClick={() => onColorChange(c.rgb)}
              aria-label={`팔레트 색 ${c.id}`}
              title={toHex(c.rgb)}
            />
          ))}
        </div>
      )}
      <label className="field--check">
        <input type="color" value={toHex(color)} onChange={(e) => onColorChange(fromHex(e.target.value))} />
        <span>사용자 색 · {toHex(color)}</span>
      </label>
      <label className="field--check">
        <input type="checkbox" checked={erasing} onChange={(e) => onErasingChange(e.target.checked)} />
        <span>지우개 (픽셀 되돌리기)</span>
      </label>
      <label className="field--check">
        <input type="checkbox" checked={eyedropping} onChange={(e) => onEyedropChange(e.target.checked)} />
        <span>스포이드 (미리보기에서 색 추출)</span>
      </label>

      <div className="palette-editor__actions">
        <span className="muted">수정한 픽셀 {editCount}개</span>
        <button type="button" className="link-btn" onClick={onClear} disabled={editCount === 0}>
          모두 되돌리기
        </button>
      </div>
      <p className="muted">
        오른쪽 미리보기에서 클릭·드래그로 칠합니다. <strong>Alt+클릭</strong> 또는 스포이드 모드로
        색을 추출할 수 있습니다.
      </p>
    </div>
  );
}
