import { useCallback, useEffect, useMemo, useState } from 'react';
import { nearestPaletteId } from './lib/paletteMatch';
import { overlayMask } from './lib/imageIO';
import { CanvasView } from './components/CanvasView';
import { ColorSliders } from './components/ColorSliders';
import { DeditherControls } from './components/DeditherControls';
import { DownloadBar } from './components/DownloadBar';
import { ImageUploader } from './components/ImageUploader';
import { PaletteEditor } from './components/PaletteEditor';
import { PaletteIO } from './components/PaletteIO';
import { PixelEditor } from './components/PixelEditor';
import { ResizeControls } from './components/ResizeControls';
import { SourceAdjustControls } from './components/SourceAdjustControls';
import { Tabs, type TabDef } from './components/Tabs';
import { ZoomablePreview } from './components/ZoomablePreview';
import { usePixelArt } from './hooks/usePixelArt';
import type { RGB } from './lib/types';
import './App.css';

export default function App() {
  const pa = usePixelArt();
  const { actions } = pa;
  const { loadFile, paintPixel, erasePixel } = actions;
  const [showOriginal, setShowOriginal] = useState(false);
  // Palette selection is shared between the editor swatches and the preview's
  // click-to-pick, so it lives here rather than inside PaletteEditor.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set());
  // The active tab drives the preview's mode: on '픽셀 수정' the preview paints
  // instead of picking colors, so the chosen color + erase flag live here.
  const [activeTab, setActiveTab] = useState<string>('image');
  const [paintColor, setPaintColor] = useState<RGB>({ r: 0, g: 0, b: 0 });
  const [erasing, setErasing] = useState(false);
  // De-dither mask brush state lives here so the shared preview can paint with it.
  const [maskBrush, setMaskBrush] = useState(1);
  const [maskErasing, setMaskErasing] = useState(false);

  // A new image or a different color count rebuilds the palette, so previously
  // selected ids no longer refer to the same colors — drop them.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [pa.source, pa.colorCount]);

  // Clicking a result pixel toggles its nearest palette color in the selection.
  const handlePickColor = useCallback(
    (color: { r: number; g: number; b: number; a: number }): void => {
      if (color.a < 128) return; // transparent area — no color to pick
      const id = nearestPaletteId(pa.palette, color);
      if (id === null) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [pa.palette],
  );

  // Painting on the preview (paint mode) sets or reverts the pixel under the
  // pointer, using the color/erase state chosen in the 픽셀 수정 tab.
  const handlePaintPixel = useCallback(
    (x: number, y: number): void => {
      if (erasing) erasePixel(x, y);
      else paintPixel(x, y, paintColor);
    },
    [erasing, paintColor, paintPixel, erasePixel],
  );

  // Painting in the 디더 정리 tab brushes the apply-mask instead of pixels.
  const handlePaintMask = useCallback(
    (x: number, y: number): void => {
      actions.paintDeditherMask(x, y, maskBrush, maskErasing);
    },
    [actions, maskBrush, maskErasing],
  );

  // While the 디더 정리 tab is active, show the mask as a tint over the result.
  const previewImage = useMemo<ImageData | null>(() => {
    if (pa.result === null) return null;
    if (activeTab !== 'dedither' || pa.deditherMask.size === 0) return pa.result;
    return overlayMask(pa.result, pa.deditherMask, { r: 80, g: 160, b: 255 });
  }, [pa.result, pa.deditherMask, activeTab]);

  // Paste an image from the clipboard (Ctrl/Cmd+V) anywhere on the page.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent): void => {
      const items = event.clipboardData?.items;
      if (items === undefined) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file !== null) {
            event.preventDefault();
            void loadFile(file);
            return;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [loadFile]);

  // RGB sliders edit a single color, so they show only when exactly one is
  // selected. The displayed value is the edit (if any) first so the slider
  // tracks the user's drag without waiting on the worker round-trip.
  const editId = selectedIds.size === 1 ? [...selectedIds][0] : null;
  const editColor = editId === null ? undefined : pa.palette.find((c) => c.id === editId);
  const editRgb = editId === null ? null : (pa.paletteEdits.get(editId) ?? editColor?.rgb ?? null);

  const tabs: readonly TabDef[] = [
    {
      id: 'image',
      label: '이미지 · 크기',
      content: (
        <>
          <ImageUploader
            onFile={(file) => void actions.loadFile(file)}
            onUrl={(url) => void actions.loadUrl(url)}
            disabled={pa.status === 'loading'}
          />
          {pa.source && (
            <p className="muted">
              {pa.sourceName} — {pa.source.width}×{pa.source.height}px
            </p>
          )}
          {pa.error && <p className="error">{pa.error}</p>}
          {pa.source && (
            <SourceAdjustControls
              edges={pa.edges}
              sourceWidth={pa.source.width}
              sourceHeight={pa.source.height}
              onChange={actions.setEdges}
            />
          )}
          <ResizeControls
            resample={pa.resample}
            widthOptions={pa.widthOptions}
            sourceWidth={pa.adjustedWidth}
            sourceHeight={pa.adjustedHeight}
            onResample={actions.setResample}
            onTargetWidth={actions.setTargetWidth}
          />
        </>
      ),
    },
    {
      id: 'palette',
      label: '팔레트',
      content: (
        <>
          <label className="field">
            <span className="field__label">
              팔레트 색상 수<strong>{pa.colorCount}</strong>
            </span>
            <input
              type="range"
              min={2}
              max={256}
              step={1}
              value={pa.colorCount}
              onChange={(e) => actions.setColorCount(e.target.valueAsNumber)}
            />
          </label>
          <h3>색상 선택 · 투명 · 합치기</h3>
          <PaletteEditor
            palette={pa.palette}
            transparentIds={pa.transparentIds}
            mergeGroups={pa.mergeGroups}
            selected={selectedIds}
            onSelectedChange={setSelectedIds}
            onToggleTransparent={actions.toggleTransparentMany}
            onClearTransparent={actions.clearTransparent}
            onMerge={actions.mergeColors}
            onUnmerge={actions.unmergeColors}
            onClearMerges={actions.clearMerges}
          />
          <label className="field--check">
            <input
              type="checkbox"
              checked={pa.outline}
              onChange={(e) => actions.setOutline(e.target.checked)}
            />
            <span>투명 경계에 1px 외곽선 (가장 어두운 색)</span>
          </label>
          {editId !== null && editColor !== undefined && editRgb !== null && (
            <ColorSliders
              id={editId}
              rgb={editRgb}
              edited={pa.paletteEdits.has(editId)}
              onChange={(rgb) => actions.setColorRgb(editId, rgb)}
              onReset={() => actions.resetColorEdit(editId)}
            />
          )}
          <h3>저장 / 오버라이드</h3>
          <PaletteIO
            palette={pa.palette}
            override={pa.paletteOverride}
            baseName={pa.sourceName}
            source={pa.source}
            onImportFile={(file) => void actions.importPaletteFile(file)}
            onApplyOverride={actions.applyOverridePalette}
            onClearOverride={actions.clearPaletteOverride}
          />
        </>
      ),
    },
    {
      id: 'pixel',
      label: '픽셀 수정',
      content: (
        <PixelEditor
          hasResult={pa.result !== null}
          palette={pa.palette}
          color={paintColor}
          onColorChange={setPaintColor}
          erasing={erasing}
          onErasingChange={setErasing}
          editCount={pa.pixelEdits.size}
          onClear={actions.clearPixelEdits}
        />
      ),
    },
    {
      id: 'dedither',
      label: '디더 정리',
      content: (
        <DeditherControls
          hasResult={pa.result !== null}
          settings={pa.dedither}
          onSettings={actions.setDedither}
          brush={maskBrush}
          onBrush={setMaskBrush}
          erasing={maskErasing}
          onErasing={setMaskErasing}
          maskCount={pa.deditherMask.size}
          onClearMask={actions.clearDeditherMask}
        />
      ),
    },
    {
      id: 'export',
      label: '내보내기',
      content: pa.result ? (
        <DownloadBar result={pa.result} baseName={pa.sourceName} />
      ) : (
        <p className="muted">결과가 준비되면 PNG로 내보낼 수 있습니다.</p>
      ),
    },
  ];

  return (
    <div className="app">
      <main className="layout">
        <section className="panel">
          <Tabs tabs={tabs} onActiveChange={setActiveTab} />
        </section>

        <section className="panel panel--preview">
          <div className="preview-head">
            <h2>미리보기</h2>
            {pa.result && (
              <span className="muted">
                결과 {pa.result.width}×{pa.result.height}px
              </span>
            )}
            {pa.processing && <span className="badge">처리 중…</span>}
            <span className="preview-head__spacer" />
            {pa.source && (
              <label className="field--check">
                <input
                  type="checkbox"
                  checked={showOriginal}
                  onChange={(e) => setShowOriginal(e.target.checked)}
                />
                <span>원본 보기</span>
              </label>
            )}
          </div>

          {pa.source === null ? (
            <p className="muted">업로드된 이미지가 여기에 표시됩니다.</p>
          ) : (
            <div className="previews">
              {showOriginal && (
                <figure className="preview">
                  <CanvasView image={pa.source} displayWidth={320} className="checker" />
                </figure>
              )}
              {previewImage && (
                <figure className="preview preview--result">
                  <ZoomablePreview
                    image={previewImage}
                    {...(activeTab === 'pixel'
                      ? { onPaintPixel: handlePaintPixel }
                      : activeTab === 'dedither'
                        ? { onPaintPixel: handlePaintMask }
                        : { onPickColor: handlePickColor })}
                  />
                </figure>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
