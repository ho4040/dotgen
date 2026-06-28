import { useState } from 'react';
import { downloadBlob, imageDataToPngBlob } from '../lib/imageIO';

interface DownloadBarProps {
  readonly result: ImageData;
  readonly baseName: string;
}

const SCALES = [1, 2, 4, 8, 16] as const;

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

export function DownloadBar({ result, baseName }: DownloadBarProps) {
  const [scale, setScale] = useState<number>(1);
  const [busy, setBusy] = useState(false);

  const download = async (): Promise<void> => {
    setBusy(true);
    try {
      const blob = await imageDataToPngBlob(result, scale);
      const stem = stripExtension(baseName) || 'pixelart';
      downloadBlob(blob, `${stem}_${result.width}x${result.height}@${scale}x.png`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="download">
      <label className="field">
        <span className="field__label">내보내기 배율</span>
        <select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
          {SCALES.map((s) => (
            <option key={s} value={s}>
              {s}×  ({result.width * s}×{result.height * s})
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="primary" disabled={busy} onClick={() => void download()}>
        {busy ? '내보내는 중…' : 'PNG 다운로드'}
      </button>
    </div>
  );
}
