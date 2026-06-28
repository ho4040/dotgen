import { adjustedHeight, adjustedWidth, type EdgeAdjust } from '../lib/adjust';
import { divisors } from '../lib/factor';

interface SourceAdjustControlsProps {
  readonly edges: EdgeAdjust;
  /** Raw (unadjusted) source dimensions. */
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly onChange: (patch: Partial<EdgeAdjust>) => void;
}

const EDGE_LABELS: Record<keyof EdgeAdjust, string> = {
  left: '왼쪽',
  right: '오른쪽',
  top: '위',
  bottom: '아래',
};

interface EdgeInputProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly onChange: (value: number) => void;
}

function EdgeInput({ label, value, min, onChange }: EdgeInputProps) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        type="number"
        step={1}
        min={min}
        value={value}
        onChange={(e) => {
          const next = e.target.valueAsNumber;
          onChange(Number.isNaN(next) ? 0 : Math.round(next));
        }}
      />
    </label>
  );
}

/** Crop or edge-extend the source per side before the divisor-based resize. */
export function SourceAdjustControls(props: SourceAdjustControlsProps) {
  const { edges, sourceWidth, sourceHeight, onChange } = props;
  const aw = adjustedWidth(sourceWidth, edges);
  const ah = adjustedHeight(sourceHeight, edges);
  const divisorCount = divisors(aw).length;
  const changed = aw !== sourceWidth || ah !== sourceHeight;

  return (
    <div className="controls">
      <div className="field">
        <span className="field__label">원본 크기 조정 (crop · 확장)</span>
        <p className="muted">음수는 잘라내고, 양수는 가장자리 픽셀을 복제해 늘립니다.</p>
      </div>

      <div className="field-row">
        <EdgeInput
          label={EDGE_LABELS.left}
          value={edges.left}
          min={-(sourceWidth - 1)}
          onChange={(left) => onChange({ left })}
        />
        <EdgeInput
          label={EDGE_LABELS.right}
          value={edges.right}
          min={-(sourceWidth - 1)}
          onChange={(right) => onChange({ right })}
        />
      </div>
      <div className="field-row">
        <EdgeInput
          label={EDGE_LABELS.top}
          value={edges.top}
          min={-(sourceHeight - 1)}
          onChange={(top) => onChange({ top })}
        />
        <EdgeInput
          label={EDGE_LABELS.bottom}
          value={edges.bottom}
          min={-(sourceHeight - 1)}
          onChange={(bottom) => onChange({ bottom })}
        />
      </div>

      <p className="muted">
        조정 후 <strong>{aw}×{ah}px</strong>
        {changed && ` (원본 ${sourceWidth}×${sourceHeight}px)`}
        {'  '}· 가로 약수 <strong>{divisorCount}</strong>개
      </p>
    </div>
  );
}
