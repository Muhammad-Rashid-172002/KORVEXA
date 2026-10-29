'use client';
import { Button } from '@glasswork/ui/components/button';
import { Dialog, DialogContent } from '@glasswork/ui/components/dialog';
import { useEffect, useRef, useState } from 'react';

export const COVER_W = 1280;
export const COVER_H = 720;

/**
 * Crops a picked image to the 16:9 cover ratio before upload. Zoom and move with sliders (works on touch and with
 * a keyboard; no drag handling to get wrong). Output is a JPEG at 1280 x 720.
 */
export function ImageCropper({
  file,
  onCancel,
  onDone,
}: {
  file: File | null;
  onCancel: () => void;
  onDone: (blob: Blob, previewUrl: string) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const img = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSrc(url);
    setZoom(1);
    setX(50);
    setY(50);
    const i = new Image();
    i.onload = () => {
      img.current = i;
      setDims({ w: i.naturalWidth, h: i.naturalHeight });
    };
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // The visible window, as fractions of the source image.
  const view = (() => {
    if (!dims) return null;
    const scale = Math.max(COVER_W / dims.w, COVER_H / dims.h) * zoom;
    const vw = COVER_W / scale;
    const vh = COVER_H / scale;
    return { sx: (dims.w - vw) * (x / 100), sy: (dims.h - vh) * (y / 100), vw, vh, scale };
  })();

  function confirm() {
    if (!img.current || !view) return;
    const c = document.createElement('canvas');
    c.width = COVER_W;
    c.height = COVER_H;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img.current, view.sx, view.sy, view.vw, view.vh, 0, 0, COVER_W, COVER_H);
    c.toBlob(
      (b) => {
        if (b) onDone(b, URL.createObjectURL(b));
      },
      'image/jpeg',
      0.9,
    );
  }

  const tooSmall = dims && (dims.w < 640 || dims.h < 360);
  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent
        className="max-h-[92dvh] overflow-y-auto"
        title="Crop your cover image"
        description="Covers are shown wide (16:9). Zoom and move to choose what shows."
      >
        {src && dims && view && (
          <div className="flex flex-col gap-4">
            <div
              className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-surface-2"
              data-testid="crop-frame"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img
                src={src}
                alt="Crop preview"
                className="absolute max-w-none"
                style={{
                  width: `${(dims.w / view.vw) * 100}%`,
                  left: `${(-view.sx / view.vw) * 100}%`,
                  top: `${(-view.sy / view.vh) * 100}%`,
                }}
              />
            </div>
            {tooSmall && (
              <p className="text-sm text-warning">
                This image is small and may look blurry. Aim for at least 1280 x 720.
              </p>
            )}
            <label className="flex flex-col gap-1 text-sm">
              Zoom
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(+e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Move left / right
              <input type="range" min={0} max={100} value={x} onChange={(e) => setX(+e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Move up / down
              <input type="range" min={0} max={100} value={y} onChange={(e) => setY(+e.target.value)} />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="button" onClick={confirm} data-testid="crop-confirm">
                Use this image
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
