// Server only: the secret key must never be included in browser code or HTML.
export function createSupabaseDatabase({url,secretKey,fetchImpl=fetch}={}) {
  if(!url&&!secretKey)return null;
  if(!url||!secretKey)throw new Error('Supabase configuration is incomplete');
  const base=new URL(url);
  if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw new Error('Invalid Supabase project URL');
  if(secretKey.startsWith('sb_publishable_'))throw new Error('A server secret key is required');
  const headers={apikey:secretKey,'Content-Type':'application/json'};
  if(secretKey.startsWith('eyJ'))headers.Authorization='Bearer '+secretKey;
  async function query(parameters,options={}) {
    const endpoint=new URL('/rest/v1/posts',base);
    endpoint.search=new URLSearchParams(parameters).toString();
    const response=await fetchImpl(endpoint,{...options,headers:{...headers,...options.headers},cache:'no-store'});
    if(!response.ok)throw new Error('Supabase posts request failed: '+response.status);
    return response;
  }
  const post=row=>typeof row.data==='string'?JSON.parse(row.data):row.data;
  return {posts:{
    async list(){
      const items=[],limit=100;
      for(let offset=0;;offset+=limit){
        const rows=await (await query({select:'data','data->>recordType':'is.null',order:'updated_at.desc,id.asc',limit,offset})).json();
        items.push(...rows.map(post));
        if(rows.length<limit)return items;
      }
    },
    async get(id){const rows=await (await query({select:'data',id:'eq.'+id,limit:1})).json();return rows.length?post(rows[0]):null;},
    async delete(id){await query({id:'eq.'+id},{method:'DELETE',headers:{Prefer:'return=minimal'}});},
    async save(p){
      await query({on_conflict:'id'},{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:p.id,data:p,status:p.status,updated_at:p.updatedAt})});
      return p;
    },
  }};
}
