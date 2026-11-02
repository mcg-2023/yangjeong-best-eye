// Dedicated tables keep visitor records out of public post and image APIs.
export function analyticsStore(db) {
  if (db.analytics) return db.analytics;
  const rows = async (sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;
  return {
    async sites() { return (await rows('SELECT data FROM pm_analytics_sites ORDER BY id')).map(r => JSON.parse(r.data)); },
    async site(id) { const r = await db.prepare('SELECT data FROM pm_analytics_sites WHERE id = ?').bind(id).first(); return r ? JSON.parse(r.data) : null; },
    async saveSite(site) { await db.prepare('INSERT INTO pm_analytics_sites(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(site.id, JSON.stringify(site)).run(); },
    async addHit(hit) {
      await db.prepare("INSERT INTO pm_analytics_hits(id,site_id,visitor_id,session_id,created_at,data) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=json_set(pm_analytics_hits.data,'$.duration',json_extract(excluded.data,'$.duration')) WHERE json_extract(excluded.data,'$.kind')='end' AND json_extract(excluded.data,'$.duration')>json_extract(pm_analytics_hits.data,'$.duration')").bind(hit.id,hit.siteId,hit.visitorId,hit.sessionId,hit.createdAt,JSON.stringify(hit)).run();
      await db.prepare('INSERT INTO pm_analytics_visitors(site_id,visitor_id,first_seen_at) VALUES(?,?,?) ON CONFLICT(site_id,visitor_id) DO NOTHING').bind(hit.siteId,hit.visitorId,hit.createdAt).run();
    },
    async hits({site,start,end,session}={}) {
      const where=[],args=[];
      for(const [column,value,op] of [['site_id',site,'='],['created_at',start,'>='],['created_at',end,'<'],['session_id',session,'=']])if(value){where.push(column+' '+op+' ?');args.push(value);}
      return (await rows('SELECT data FROM pm_analytics_hits'+(where.length?' WHERE '+where.join(' AND '):'')+' ORDER BY created_at,id',...args)).map(r=>JSON.parse(r.data));
    },
    async firstSeen(pairs) {
      const result={};
      for(let i=0;i<pairs.length;i+=100){const batch=pairs.slice(i,i+100);if(!batch.length)continue;
        for(const r of await rows('SELECT * FROM pm_analytics_visitors WHERE '+batch.map(()=>'(site_id=? AND visitor_id=?)').join(' OR '),...batch.flatMap(p=>[p.siteId,p.visitorId])))result[r.site_id+':'+r.visitor_id]=r.first_seen_at;
      }return result;
    }
  };
}
