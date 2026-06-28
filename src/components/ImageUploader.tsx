import { useCallback, useRef, useState } from 'react';

interface ImageUploaderProps {
  readonly onFile: (file: File) => void;
  readonly disabled?: boolean;
}

export function ImageUploader({ onFile, disabled = false }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = useCallback((files: FileList | null): void => {
    const file = files?.item(0);
    if (file && file.type.startsWith('image/')) onFile(file);
  }, [onFile]);

  return (
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
  );
}
