import {storeImageData} from './image-transfer.js';
// Keep original image bytes; validate the file type and browser decoding only.
export async function readImageFile(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('JPG, PNG, WebP 이미지를 선택해주세요.');
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('이미지 파일을 읽을 수 없습니다.'));
      reader.onabort = () => reject(new Error('이미지 읽기가 취소되었습니다.'));
      reader.readAsDataURL(file);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function storeImageFile(file, options) {
  return storeImageData(await readImageFile(file), options);
}
