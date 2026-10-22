export function repository(db) {
  if(db.posts)return db.posts;
  return {
    async list() {const r=await db.prepare('SELECT data FROM posts ORDER BY updated_at DESC').all();return r.results.map(r=>JSON.parse(r.data));},
    async get(id) {const r=await db.prepare('SELECT data FROM posts WHERE id = ?').bind(id).first();return r?JSON.parse(r.data):null;},
    async save(p) {await db.prepare('INSERT INTO posts (id, data, status, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, status=excluded.status, updated_at=excluded.updated_at').bind(p.id,JSON.stringify(p),p.status,p.updatedAt).run();return p;},
  };
}
