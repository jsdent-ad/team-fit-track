export async function convertToWebP(file: File, quality = 0.8): Promise<string> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('파일 크기는 10MB 이하여야 합니다');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드할 수 있습니다');
  }

  const bitmap = await createImageBitmap(file);

  // Cap largest side to keep dataURL manageable in localStorage.
  const MAX_SIDE = 1280;
  let { width, height } = bitmap;
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
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise<string>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('WebP 변환 실패'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error ?? new Error('파일 읽기 실패'));
        reader.readAsDataURL(blob);
      },
      'image/webp',
      quality
    );
  });
}
