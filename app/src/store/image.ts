// Convert an uploaded image file to a compressed dataURL.
//
// iOS Safari regularly trips on this path two ways:
//   1. iPhone photos default to HEIC, and `createImageBitmap` rejects HEIC
//      on most browsers (even current Safari depending on iOS version).
//   2. Some iOS builds can't encode WebP via `canvas.toBlob`, silently
//      passing `null` to the callback.
// We therefore decode via `<img>` as a fallback and re-encode to JPEG if
// the WebP encoder fails. Galaxy / desktop Chrome keeps the fast path.
export async function convertToWebP(file: File, quality = 0.8): Promise<string> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('파일 크기는 10MB 이하여야 합니다');
  }
  const isImageMime = file.type.startsWith('image/');
  const isHeicByName = /\.(heic|heif)$/i.test(file.name);
  if (!isImageMime && !isHeicByName) {
    throw new Error('이미지 파일만 업로드할 수 있습니다');
  }

  const source = await loadImage(file);

  const MAX_SIDE = 1280;
  let { width, height } = source;
  if (width > MAX_SIDE || height > MAX_SIDE) {
    const ratio = Math.min(MAX_SIDE / width, MAX_SIDE / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D 컨텍스트를 만들 수 없습니다');
  ctx.drawImage(source.image as CanvasImageSource, 0, 0, width, height);
  source.dispose();

  const blob =
    (await canvasToBlob(canvas, 'image/webp', quality)) ??
    (await canvasToBlob(canvas, 'image/jpeg', quality));
  if (!blob) {
    throw new Error(
      '이미지 인코딩에 실패했습니다. HEIC 형식이면 갤러리에서 JPG로 저장 후 다시 시도해주세요.'
    );
  }
  return blobToDataUrl(blob);
}

type LoadedImage = {
  image: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  dispose: () => void;
};

async function loadImage(file: File): Promise<LoadedImage> {
  // Fast path: most modern browsers.
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close?.(),
      };
    } catch {
      // Fall through to <img> fallback (HEIC on most browsers ends up here).
    }
  }

  return new Promise<LoadedImage>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);
    img.onload = () => {
      resolve({
        image: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        dispose: cleanup,
      });
    };
    img.onerror = () => {
      cleanup();
      reject(
        new Error(
          '이미지를 불러올 수 없어요. HEIC 형식이면 갤러리에서 JPG로 저장 후 다시 시도해주세요.'
        )
      );
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), type, quality);
    } catch {
      resolve(null);
    }
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('파일 읽기 실패'));
    reader.readAsDataURL(blob);
  });
}
