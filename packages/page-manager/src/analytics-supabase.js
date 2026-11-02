// Server-side PostgREST adapter; never expose the service key in the tracker.
export function supabaseAnalytics(base, headers, fetchImpl) {
  async function query(table,params={},options={}) {
    const url=new URL('/rest/v1/'+table,base);url.search=new URLSearchParams(params);
    const response=await fetchImpl(url,{...options,headers:{...headers,...options.headers},cache:'no-store'});
    if(!response.ok)throw new Error('Analytics storage request failed: '+response.status);
    return response;
  }
  async function list(table,params={}) {
    const result=[],limit=500;
    for(let offset=0;;){const rows=await(await query(table,{...params,limit,offset})).json();if(!rows.length)return result;result.push(...rows);offset+=rows.length;}
  }
  const put=(table,data,conflict,ignore=false)=>query(table,{on_conflict:conflict},{method:'POST',headers:{Prefer:'resolution='+(ignore?'ignore':'merge')+'-duplicates,return=minimal'},body:JSON.stringify(data)});
  return {
    async sites(){return (await list('pm_analytics_sites',{select:'data',order:'id.asc'})).map(r=>r.data);},
    async site(id){return (await(await query('pm_analytics_sites',{select:'data',id:'eq.'+id,limit:1})).json())[0]?.data??null;},
    async saveSite(site){await put('pm_analytics_sites',{id:site.id,data:site},'id');},
    async addHit(hit){await query('rpc/pm_analytics_ingest',{}, {method:'POST',body:JSON.stringify({hit})});},
    async hits({site,start,end,session}={}){const params={select:'data',order:'created_at.asc,id.asc'};if(site)params.site_id='eq.'+site;if(session)params.session_id='eq.'+session;if(start&&end)params.and=`(created_at.gte.${start},created_at.lt.${end})`;else if(start)params.created_at='gte.'+start;else if(end)params.created_at='lt.'+end;return(await list('pm_analytics_hits',params)).map(r=>r.data);},
    async firstSeen(pairs){const result={};for(let i=0;i<pairs.length;i+=75){const batch=pairs.slice(i,i+75);if(!batch.length)continue;const or='('+batch.map(p=>`and(site_id.eq.${p.siteId},visitor_id.eq.${p.visitorId})`).join(',')+')';for(const r of await list('pm_analytics_visitors',{select:'site_id,visitor_id,first_seen_at',or,order:'site_id.asc,visitor_id.asc'}))result[r.site_id+':'+r.visitor_id]=r.first_seen_at;}return result;}
  };
}
