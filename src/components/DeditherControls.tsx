import type { DeditherSettings } from '../hooks/useDedither';
import type { DeditherReplaceMode } from '../lib/types';

interface DeditherControlsProps {
  readonly hasResult: boolean;
  readonly settings: DeditherSettings;
  readonly onSettings: (patch: Partial<DeditherSettings>) => void;
  /** Mask brush state (owned by App so the preview can paint with it). */
  readonly brush: number;
  readonly onBrush: (brush: number) => void;
  readonly erasing: boolean;
  readonly onErasing: (erasing: boolean) => void;
  readonly maskCount: number;
  readonly onClearMask: () => void;
}

/**
 * Controls for the de-dither pass: detection sliders, replacement mode, and the
 * apply-mask brush. The mask is actually drawn on the shared preview (paint
 * mode); this panel only owns the parameters and brush settings.
 */
export function DeditherControls({
  hasResult,
  settings,
  onSettings,
  brush,
  onBrush,
  erasing,
  onErasing,
  maskCount,
  onClearMask,
}: DeditherControlsProps) {
  if (!hasResult) {
    return <p className="muted">결과가 준비되면 디더 영역을 정리할 수 있습니다.</p>;
  }

  const disabled = !settings.enabled;

  return (
    <div className="dedither">
      <label className="field--check">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => onSettings({ enabled: e.target.checked })}
        />
        <span>디더 정리 켜기</span>
      </label>

      <fieldset className="dedither__group" disabled={disabled}>
        <label className="field">
          <span className="field__label">
            감지 반경<strong>{settings.radius}px</strong>
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={1}
            value={settings.radius}
            onChange={(e) => onSettings({ radius: e.target.valueAsNumber })}
          />
        </label>

        <label className="field">
          <span className="field__label">
            최대 색 종류<strong>{settings.maxColors}</strong>
          </span>
          <input
            type="range"
            min={2}
            max={4}
            step={1}
            value={settings.maxColors}
            onChange={(e) => onSettings({ maxColors: e.target.valueAsNumber })}
          />
        </label>

        <label className="field">
          <span className="field__label">
            교번 민감도<strong>{settings.threshold.toFixed(2)}</strong>
          </span>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={settings.threshold}
            onChange={(e) => onSettings({ threshold: e.target.valueAsNumber })}
          />
        </label>

        <label className="field">
          <span className="field__label">
            최소 영역 크기<strong>{settings.minRegion}px</strong>
          </span>
          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={settings.minRegion}
            onChange={(e) => onSettings({ minRegion: e.target.valueAsNumber })}
          />
        </label>

        <div className="field">
          <span className="field__label">치환 색</span>
          <div className="seg">
            {(['snap', 'new'] as const).map((mode: DeditherReplaceMode) => (
              <button
                key={mode}
                type="button"
                className={`seg__btn${settings.replaceMode === mode ? ' seg__btn--on' : ''}`}
                onClick={() => onSettings({ replaceMode: mode })}
              >
                {mode === 'snap' ? '팔레트 스냅' : '새 중간색'}
              </button>
            ))}
          </div>
        </div>

        <hr className="dedither__rule" />

        <h4 className="dedither__subhead">적용 영역 마스크</h4>
        <p className="muted">
          미리보기에서 칠한 영역에만 적용됩니다. <strong>비워 두면 전체 적용.</strong>
        </p>
        <label className="field">
          <span className="field__label">
            브러시 크기<strong>{brush * 2 + 1}px</strong>
          </span>
          <input
            type="range"
            min={0}
            max={8}
            step={1}
            value={brush}
            onChange={(e) => onBrush(e.target.valueAsNumber)}
          />
        </label>
        <label className="field--check">
          <input type="checkbox" checked={erasing} onChange={(e) => onErasing(e.target.checked)} />
          <span>지우개 (마스크 빼기)</span>
        </label>
        <div className="palette-editor__actions">
          <span className="muted">마스크 {maskCount}px</span>
          <button type="button" className="link-btn" onClick={onClearMask} disabled={maskCount === 0}>
            마스크 비우기
          </button>
        </div>
      </fieldset>
    </div>
  );
}
