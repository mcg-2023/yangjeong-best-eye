export function rawRepository(db) {
  if (db.posts) return db.posts;
  return {
    async list() { const result = await db.prepare('SELECT data FROM posts ORDER BY updated_at DESC').all(); return result.results.map(row => JSON.parse(row.data)); },
    async get(id) { const row = await db.prepare('SELECT data FROM posts WHERE id = ?').bind(id).first(); return row ? JSON.parse(row.data) : null; },
    async delete(id) { await db.prepare('DELETE FROM posts WHERE id = ?').bind(id).run(); },
    async save(post) { await db.prepare('INSERT INTO posts (id, data, status, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, status=excluded.status, updated_at=excluded.updated_at').bind(post.id, JSON.stringify(post), post.status, post.updatedAt).run(); return post; },
  };
}

export function repository(db) {
  const raw = rawRepository(db);
  return {
    async list() { return (await raw.list()).filter(post => !post.recordType && !post.pendingMedia); },
    async get(id) { const post = await raw.get(id); return post?.recordType ? null : post; },
    save: post => raw.save(post),
    async delete(id) {
      const post = await raw.get(id);
      for (const imageId of post?.mediaIds || []) {
        const key = 'pm-image-' + imageId, image = await raw.get(key);
        if (image?.recordType === 'page-manager-image-v1' && image.postId === id) await raw.delete(key);
      }
      return raw.delete(id);
    },
  };
}
