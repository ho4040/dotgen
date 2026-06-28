import { useEffect, useRef } from 'react';

interface CanvasViewProps {
  readonly image: ImageData;
  /** CSS width in px; height follows the image aspect ratio. */
  readonly displayWidth?: number;
  readonly className?: string;
}

/** Renders ImageData at its native resolution; CSS scales it up crisply. */
export function CanvasView({ image, displayWidth, className }: CanvasViewProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (canvas === null) return;
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    ctx.putImageData(image, 0, 0);
  }, [image]);

  const style =
    displayWidth === undefined
      ? undefined
      : { width: `${displayWidth}px`, height: `${displayWidth / (image.width / image.height)}px` };

  return <canvas ref={ref} className={className} style={style} />;
}
