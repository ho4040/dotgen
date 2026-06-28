import { rgbToHex } from '../lib/paletteIO';
import type { RGB } from '../lib/types';

interface ColorSlidersProps {
  /** Palette id of the color being edited. */
  readonly id: number;
  /** Current RGB (the edited value if one exists, else the analyzed color). */
  readonly rgb: RGB;
  /** Whether this color currently has a user edit (enables "되돌리기"). */
  readonly edited: boolean;
  readonly onChange: (rgb: RGB) => void;
  readonly onReset: () => void;
}

const CHANNELS = [
  { key: 'r', label: 'R', accent: '#ff5b5b' },
  { key: 'g', label: 'G', accent: '#52c462' },
  { key: 'b', label: 'B', accent: '#5b8cff' },
] as const;

function cssRgb({ r, g, b }: RGB): string {
  return `rgb(${r} ${g} ${b})`;
}

/** R/G/B sliders that override one palette color, recoloring the result live. */
export function ColorSliders({ id, rgb, edited, onChange, onReset }: ColorSlidersProps) {
  return (
    <div className="controls color-edit">
      <div className="color-edit__head">
        <span className="swatch swatch--static color-edit__swatch" style={{ backgroundColor: cssRgb(rgb) }} />
        <span className="field__label color-edit__title">
          #{id} 색상 편집<strong>{rgbToHex(rgb)}</strong>
        </span>
        {edited && (
          <button type="button" className="link-btn" onClick={onReset}>
            되돌리기
          </button>
        )}
      </div>
      {CHANNELS.map(({ key, label, accent }) => (
        <label key={key} className="field">
          <span className="field__label">
            {label}
            <strong>{rgb[key]}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={255}
            step={1}
            value={rgb[key]}
            style={{ accentColor: accent }}
            onChange={(e) => onChange({ ...rgb, [key]: e.target.valueAsNumber })}
          />
        </label>
      ))}
    </div>
  );
}
