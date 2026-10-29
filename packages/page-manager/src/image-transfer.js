const chunkSize = 512 * 1024;
const transfers = new Map();
const queues = new WeakMap();

export function storeImageData(data, options) {
  const previous = queues.get(options.form) || Promise.resolve();
  const next = previous.catch(() => {}).then(() => transferImageData(data, options));
  queues.set(options.form, next);
  return next;
}

async function transferImageData(data, {form, kind = 'inline'}) {
  const idField = form.querySelector('input[name="id"]');
  const key = kind + ':' + (idField.value || 'new') + ':' + data;
  if (transfers.has(key)) return transfers.get(key);
  const uploadId = crypto.randomUUID(), parts = Math.ceil(data.length / chunkSize);
  let src;
  for (let part = 0; part < parts; part++) {
    const body = new URLSearchParams({postId: idField.value, uploadId, kind, part: String(part), parts: String(parts), data: data.slice(part * chunkSize, (part + 1) * chunkSize), csrf: form.querySelector('[name="csrf"]')?.value || ''});
    const response = await fetch('/api/posts/images', {method: 'POST', body, headers: {Accept: 'application/json'}});
    let result;
    try { result = await response.json(); } catch { throw new Error(response.status === 413 ? '이미지 전송이 중단되었습니다. 다시 선택해주세요.' : '이미지 저장 서버의 응답을 확인할 수 없습니다. 잠시 후 다시 시도해주세요.'); }
    if (!response.ok) throw new Error(result.errors?.join(' / ') || '이미지를 저장하지 못했습니다. 다시 시도해주세요.');
    idField.value = result.postId;
    if (result.complete) src = result.src;
  }
  if (!src) throw new Error('이미지 전송이 완료되지 않았습니다. 다시 선택해주세요.');
  transfers.set(key, src);
  transfers.set(kind + ':' + idField.value + ':' + data, src);
  return src;
}

export async function preparePostImages(form) {
  const body = form.querySelector('[name="body"]'), cover = form.querySelector('[name="cover"]');
  if (cover.value.startsWith('data:image/')) cover.value = await storeImageData(cover.value, {form, kind: 'cover'});
  if (form.querySelector('[name="bodyFormat"]')?.value !== 'html') return;
  const parsed = new DOMParser().parseFromString(body.value, 'text/html');
  for (const image of parsed.querySelectorAll('img')) {
    const src = image.getAttribute('src') || '';
    if (src.startsWith('data:image/')) image.setAttribute('src', await storeImageData(src, {form}));
  }
  body.value = parsed.body.innerHTML;
}

export async function postResult(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch {
    return {errors: [response.status === 413 ? '저장 요청이 서버 용량을 넘었습니다. 이미지를 다시 선택한 뒤 저장해주세요.' : '저장 서버의 응답을 확인하지 못했습니다. 잠시 후 다시 저장해주세요.']};
  }
}
