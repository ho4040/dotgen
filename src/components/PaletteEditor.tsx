import type { Palette, RGB } from '../lib/types';

interface PaletteEditorProps {
  readonly palette: Palette;
  readonly transparentIds: ReadonlySet<number>;
  readonly mergeGroups: ReadonlyArray<ReadonlyArray<number>>;
  /** Currently selected palette ids (controlled — shared with the preview). */
  readonly selected: ReadonlySet<number>;
  readonly onSelectedChange: (ids: ReadonlySet<number>) => void;
  readonly onToggleTransparent: (ids: readonly number[]) => void;
  readonly onClearTransparent: () => void;
  readonly onMerge: (ids: readonly number[]) => void;
  readonly onUnmerge: (ids: readonly number[]) => void;
  readonly onClearMerges: () => void;
}

function cssRgb({ r, g, b }: RGB): string {
  return `rgb(${r} ${g} ${b})`;
}

function isLight({ r, g, b }: RGB): boolean {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140;
}

// Distinct ring colors cycled across merge groups.
const GROUP_COLORS = ['#ff6b6b', '#ffd166', '#6bd3ff', '#c084fc', '#7ee0a0', '#ff9f6b'] as const;

export function PaletteEditor(props: PaletteEditorProps) {
  const { palette, transparentIds, mergeGroups, selected, onSelectedChange } = props;

  if (palette.length === 0) {
    return <p className="muted">이미지를 업로드하면 팔레트가 생성됩니다.</p>;
  }

  // id → 1-based group index (for badges / ring color).
  const groupOf = new Map<number, number>();
  mergeGroups.forEach((group, index) => group.forEach((id) => groupOf.set(id, index + 1)));

  const selectedIds = [...selected];
  const anySelectedGrouped = selectedIds.some((id) => groupOf.has(id));

  const toggleSelect = (id: number): void => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  };

  return (
    <div className="palette-editor">
      <div className="palette-editor__bar">
        <span className="muted">
          색 또는 미리보기 픽셀을 클릭해 선택
          {selected.size > 0 && <strong className="palette-editor__count"> · {selected.size}개</strong>}
        </span>
        <div className="palette-editor__actions">
          <button
            type="button"
            className="link-btn"
            disabled={selected.size === 0}
            onClick={() => props.onToggleTransparent(selectedIds)}
          >
            투명 토글
          </button>
          <button
            type="button"
            className="link-btn"
            disabled={selected.size < 2}
            onClick={() => {
              props.onMerge(selectedIds);
              onSelectedChange(new Set());
            }}
          >
            합치기
          </button>
          <button
            type="button"
            className="link-btn"
            disabled={!anySelectedGrouped}
            onClick={() => {
              props.onUnmerge(selectedIds);
              onSelectedChange(new Set());
            }}
          >
            병합 해제
          </button>
          {selected.size > 0 && (
            <button type="button" className="link-btn" onClick={() => onSelectedChange(new Set())}>
              선택 해제
            </button>
          )}
        </div>
      </div>

      <div className="palette" role="group" aria-label="팔레트">
        {palette.map((color) => {
          const transparent = transparentIds.has(color.id);
          const group = groupOf.get(color.id);
          const isSelected = selected.has(color.id);
          const ring = group === undefined ? undefined : GROUP_COLORS[(group - 1) % GROUP_COLORS.length];
          return (
            <button
              key={color.id}
              type="button"
              className={`swatch${transparent ? ' swatch--transparent' : ''}${isSelected ? ' swatch--selected' : ''}`}
              style={{ backgroundColor: cssRgb(color.rgb), ...(ring ? { boxShadow: `inset 0 0 0 2px ${ring}` } : {}) }}
              onClick={() => toggleSelect(color.id)}
              title={`#${color.id} · ${color.population.toLocaleString()}px${group ? ` · 병합그룹 ${group}` : ''}${transparent ? ' · 투명' : ''}`}
              aria-pressed={isSelected}
            >
              <span className="swatch__id" style={{ color: isLight(color.rgb) ? '#000' : '#fff' }}>
                {transparent ? '투명' : color.id}
              </span>
              {group !== undefined && (
                <span className="swatch__group" style={{ background: ring }}>
                  {group}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {(transparentIds.size > 0 || mergeGroups.length > 0) && (
        <div className="palette-editor__globals">
          {transparentIds.size > 0 && (
            <button type="button" className="link-btn" onClick={props.onClearTransparent}>
              투명 전체 해제 ({transparentIds.size})
            </button>
          )}
          {mergeGroups.length > 0 && (
            <button type="button" className="link-btn" onClick={props.onClearMerges}>
              병합 전체 해제 ({mergeGroups.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
