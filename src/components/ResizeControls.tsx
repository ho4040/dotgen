import { SAMPLING_MODES, type SamplingMode } from '../lib/types';
import type { ResampleSettings } from '../hooks/useResample';

interface ResizeControlsProps {
  readonly resample: ResampleSettings;
  readonly widthOptions: readonly number[];
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly onResample: (patch: Partial<ResampleSettings>) => void;
  readonly onTargetWidth: (width: number) => void;
}

const MODE_LABELS: Record<SamplingMode, string> = {
  point: 'Point (단일 픽셀)',
  dominant: 'Dominant (최빈색)',
};

/** Block size along an axis (how many source pixels collapse into one output). */
function blockSize(sourceLen: number, targetLen: number): number {
  return targetLen > 0 ? Math.max(1, Math.round(sourceLen / targetLen)) : 1;
}

interface BlockPositionProps {
  readonly axis: string;
  readonly blocks: number;
  readonly offset: number;
  readonly onChange: (offset: number) => void;
}

/** Integer selector for which pixel inside each N-block is sampled (0…N-1).
 * Maps to the fractional offset via `offset = k - floor(N/2)`. */
function BlockPosition({ axis, blocks, offset, onChange }: BlockPositionProps) {
  const center = Math.floor(blocks / 2);
  const index = Math.min(blocks - 1, Math.max(0, center + Math.round(offset)));
  return (
    <label className="field">
      <span className="field__label">
        {axis} 블록 내 위치<strong>{index} / {blocks - 1}</strong>
      </span>
      <input
        type="range"
        min={0}
        max={blocks - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(e.target.valueAsNumber - center)}
      />
    </label>
  );
}

export function ResizeControls(props: ResizeControlsProps) {
  const { resample, widthOptions, sourceWidth, sourceHeight } = props;
  const blocksX = blockSize(sourceWidth, resample.targetWidth);
  const blocksY = blockSize(sourceHeight, resample.targetHeight);

  return (
    <div className="controls">
      <div className="field">
        <span className="field__label">
          가로 크기 (원본의 약수)<strong>÷{blocksX}</strong>
        </span>
        {widthOptions.length === 0 ? (
          <p className="muted">이미지를 업로드하면 선택지가 표시됩니다.</p>
        ) : (
          <div className="size-options" role="group" aria-label="가로 크기 선택">
            {widthOptions.map((width) => {
              const selected = width === resample.targetWidth;
              const height = sourceWidth > 0 ? Math.max(1, Math.round((sourceHeight * width) / sourceWidth)) : width;
              return (
                <button
                  key={width}
                  type="button"
                  className={`size-option${selected ? ' size-option--on' : ''}`}
                  aria-pressed={selected}
                  onClick={() => props.onTargetWidth(width)}
                  title={`${width}×${height}px (÷${sourceWidth > 0 ? Math.round(sourceWidth / width) : 1})`}
                >
                  {width}
                </button>
              );
            })}
          </div>
        )}
        <p className="muted">
          최종 크기 <strong>{resample.targetWidth}×{resample.targetHeight}px</strong>
          {'  '}(기준 {sourceWidth}×{sourceHeight}px)
        </p>
      </div>

      <label className="field">
        <span className="field__label">샘플링 모드</span>
        <select
          value={resample.mode}
          onChange={(e) => props.onResample({ mode: e.target.value as SamplingMode })}
        >
          {SAMPLING_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>

      {resample.mode === 'point' ? (
        blocksX <= 1 && blocksY <= 1 ? (
          <p className="muted">배율이 1배라 블록 내 위치 선택이 없습니다.</p>
        ) : (
          <>
            {blocksX > 1 && (
              <BlockPosition
                axis="X"
                blocks={blocksX}
                offset={resample.offsetX}
                onChange={(offsetX) => props.onResample({ offsetX })}
              />
            )}
            {blocksY > 1 && (
              <BlockPosition
                axis="Y"
                blocks={blocksY}
                offset={resample.offsetY}
                onChange={(offsetY) => props.onResample({ offsetY })}
              />
            )}
          </>
        )
      ) : (
        <>
          <label className="field">
            <span className="field__label">
              X 오프셋 (원본 픽셀 단위)<strong>{resample.offsetX.toFixed(2)}</strong>
            </span>
            <input
              type="range"
              min={-2}
              max={2}
              step={0.01}
              value={resample.offsetX}
              onChange={(e) => props.onResample({ offsetX: e.target.valueAsNumber })}
            />
          </label>
          <label className="field">
            <span className="field__label">
              Y 오프셋 (원본 픽셀 단위)<strong>{resample.offsetY.toFixed(2)}</strong>
            </span>
            <input
              type="range"
              min={-2}
              max={2}
              step={0.01}
              value={resample.offsetY}
              onChange={(e) => props.onResample({ offsetY: e.target.valueAsNumber })}
            />
          </label>
          <label className="field">
            <span className="field__label">
              슈퍼샘플 격자<strong>{resample.supersample}×{resample.supersample}</strong>
            </span>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={resample.supersample}
              onChange={(e) => props.onResample({ supersample: e.target.valueAsNumber })}
            />
          </label>
        </>
      )}
    </div>
  );
}
