import {rawRepository, repository} from './repository.js';
import {imageData} from './image-data.js';
import {prepareHtmlPost} from './html-content.js';

const recordType = 'page-manager-image-v1';
const validId = value => /^[\w-]{1,128}$/.test(value);
const imageKey = id => 'pm-image-' + id;
const imagePath = (postId, imageId) => '/media/' + postId + '/inline/' + imageId;

export async function storedImage(db, postId, imageId) {
  const item = await rawRepository(db).get(imageKey(imageId));
  return item?.recordType === recordType && item.postId === postId && item.complete ? item : null;
}

export async function receiveImage(db, form) {
  const repo = repository(db), raw = rawRepository(db);
  let postId = String(form.get('postId') || '');
  const uploadId = String(form.get('uploadId') || ''), kind = String(form.get('kind') || 'inline');
  const part = Number(form.get('part')), parts = Number(form.get('parts')), chunk = String(form.get('data') || '');
  if (!validId(uploadId) || !['inline', 'cover'].includes(kind) || !Number.isSafeInteger(part) || !Number.isSafeInteger(parts) || parts < 1 || part < 0 || part >= parts || !chunk || chunk.length > 768 * 1024) {
    return {status: 400, errors: ['이미지 전송 정보를 확인해주세요.']};
  }
  if (postId && !validId(postId)) return {status: 400, errors: ['글 주소를 확인해주세요.']};
  const stamp = new Date().toISOString();
  if (!postId) {
    if (part !== 0) return {status: 409, errors: ['이미지 전송을 처음부터 다시 시도해주세요.']};
    postId = crypto.randomUUID();
    await repo.save({id: postId, title: '', body: '', bodyFormat: 'html', status: 'draft', pendingMedia: true, inlineImages: [], createdAt: stamp, updatedAt: stamp});
  } else if (!await repo.get(postId)) return {status: 404, errors: ['글을 찾을 수 없습니다.']};
  const id = imageKey(uploadId), previous = await raw.get(id);
  if (previous && (previous.recordType !== recordType || previous.postId !== postId || previous.kind !== kind || previous.parts !== parts)) {
    return {status: 409, errors: ['이미지 전송 정보가 변경되었습니다. 다시 선택해주세요.']};
  }
  const src = imagePath(postId, uploadId);
  const retainUpload = async () => {
    const post = await repo.get(postId);
    if (!post) throw new Error('글을 찾을 수 없습니다.');
    await repo.save({...post, mediaIds: [...new Set([...(post.mediaIds || []), uploadId])]});
  };
  if (previous?.complete) { await retainUpload(); return {status: 200, postId, src, complete: true}; }
  const upload = previous || {id, recordType, postId, kind, parts, next: 0, chunks: [], status: 'archived', createdAt: stamp};
  if (part < upload.next && upload.chunks[part] === chunk) return {status: 200, postId, complete: false};
  if (part !== upload.next) return {status: 409, errors: ['이미지 전송 순서가 맞지 않습니다. 다시 선택해주세요.']};
  upload.chunks.push(chunk);
  upload.next++;
  upload.updatedAt = stamp;
  if (upload.next === parts) {
    const data = upload.chunks.join('');
    if (!imageData(data)) return {status: 422, errors: ['실제 JPG, PNG, WebP 이미지 파일을 선택해주세요.']};
    upload.data = data;
    upload.complete = true;
    delete upload.chunks;
  }
  await raw.save(upload);
  if (upload.complete) await retainUpload();
  return {status: 200, postId, src: upload.complete ? src : undefined, complete: !!upload.complete};
}

export async function prepareStoredPost(db, post, existing) {
  const prefix = '/media/' + post.id + '/inline/';
  const ids = new Set([...post.body.matchAll(/\/media\/[\w-]+\/inline\/([\w-]+)/g)].filter(match => match[0].startsWith(prefix)).map(match => match[1]));
  const retained = new Set((existing?.inlineImages || []).map(item => item.id));
  const stored = new Set();
  const coverMatch = post.cover?.match(new RegExp('^/media/' + post.id + '/inline/([\\w-]+)$'));
  if (coverMatch) ids.add(coverMatch[1]);
  for (const id of ids) if (!retained.has(id) && await storedImage(db, post.id, id)) stored.add(id);
  if (coverMatch) {
    if (!stored.has(coverMatch[1]) && !retained.has(coverMatch[1])) throw new Error('대표 이미지 전송을 완료한 뒤 다시 저장해주세요.');
    post.coverRef = post.cover;
    post.cover = '';
  } else if (post.cover?.startsWith('/media/' + post.id + '/cover')) {
    if (!existing?.cover) throw new Error('저장된 대표 이미지를 찾을 수 없습니다. 다시 선택해주세요.');
    post.cover = existing.cover;
  }
  post.mediaIds = [...new Set([...(existing?.mediaIds || []), ...stored])];
  return post.bodyFormat === 'html' ? prepareHtmlPost(post, existing, {storedImages: stored}) : post;
}

export function imageResponse(image, headers) {
  const bytes = image.bytes;
  let offset = 0;
  return new Response(new ReadableStream({pull(controller) {
    if (offset >= bytes.length) { controller.close(); return; }
    const end = Math.min(offset + 64 * 1024, bytes.length);
    controller.enqueue(Uint8Array.from(bytes.slice(offset, end), c => c.charCodeAt(0)));
    offset = end;
  }}), {headers: {'Content-Type': image.mime, ...headers}});
}
