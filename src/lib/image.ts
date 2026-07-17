/**
 * Shrinks food photos in the browser BEFORE they're uploaded.
 *
 * Why this matters more than it sounds: a 4 MB phone photo served to 30,000
 * menu views is ~120 GB of bandwidth — many times over the free plan. Shrunk to
 * ~150 KB it's ~4 GB. Same picture on screen, ~25x less bandwidth and storage.
 *
 * Uses the browser's own canvas — no library, nothing to install.
 */
export type CompressResult = {
  blob: Blob;
  type: string;
  ext: string;
  width: number;
  height: number;
  beforeBytes: number;
  afterBytes: number;
};

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** WebP is ~30% smaller than JPEG at the same quality. Fall back if unsupported. */
function bestType(canvas: HTMLCanvasElement): { type: string; ext: string } {
  const webp = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  return webp ? { type: "image/webp", ext: "webp" } : { type: "image/jpeg", ext: "jpg" };
}

export async function compressImage(
  file: File,
  opts: { maxWidth?: number; maxBytes?: number } = {}
): Promise<CompressResult> {
  const maxWidth = opts.maxWidth ?? 1200; // plenty for a menu card, even on a retina phone
  const maxBytes = opts.maxBytes ?? 200 * 1024; // 200 KB target

  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;

  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't process images.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const { type, ext } = bestType(canvas);

  // Step the quality down until it fits, rather than guessing once.
  let quality = 0.82;
  let blob = await toBlob(canvas, type, quality);
  while (blob && blob.size > maxBytes && quality > 0.4) {
    quality -= 0.12;
    blob = await toBlob(canvas, type, quality);
  }
  if (!blob) throw new Error("Couldn't process that image.");

  return {
    blob,
    type,
    ext,
    width,
    height,
    beforeBytes: file.size,
    afterBytes: blob.size,
  };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
