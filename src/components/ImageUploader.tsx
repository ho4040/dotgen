import { useCallback, useRef, useState } from 'react';

interface ImageUploaderProps {
  readonly onFile: (file: File) => void;
  /** Load an image from a remote URL (CORS-permitting hosts only). */
  readonly onUrl: (url: string) => void;
  readonly disabled?: boolean;
}

export function ImageUploader({ onFile, onUrl, disabled = false }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState('');

  const pick = useCallback((files: FileList | null): void => {
    const file = files?.item(0);
    if (file && file.type.startsWith('image/')) onFile(file);
  }, [onFile]);

  const submitUrl = useCallback((): void => {
    const trimmed = url.trim();
    if (trimmed) onUrl(trimmed);
  }, [url, onUrl]);

  return (
    <div className="uploader-group">
      <div
        className={`uploader${dragging ? ' uploader--drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          disabled={disabled}
          onChange={(e) => pick(e.target.files)}
        />
        <span className="uploader__label">이미지를 드래그·클릭·붙여넣기(⌘/Ctrl+V)</span>
        <span className="uploader__hint">PNG · JPG · WebP …</span>
      </div>

      <div className="uploader__url">
        <input
          type="url"
          className="uploader__url-input"
          placeholder="또는 이미지 URL 붙여넣기"
          value={url}
          disabled={disabled}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submitUrl();
            }
          }}
        />
        <button type="button" className="link-btn" disabled={disabled || url.trim() === ''} onClick={submitUrl}>
          불러오기
        </button>
      </div>
    </div>
  );
}
