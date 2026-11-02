const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>Number(value||0).toLocaleString('ko-KR');
const duration=value=>value==null?'—':(value>=60?Math.floor(value/60)+'분 '+value%60+'초':value+'초');
const stamp=value=>new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false});
const link=(url,label)=>{try{const u=new URL(url);if(!['http:','https:'].includes(u.protocol))throw 0;return `<a href="${escape(u.href)}" target="_blank" rel="noopener noreferrer">${escape(label||u.pathname)}</a>`;}catch{return escape(label||url||'—');}};
const empty=message=>`<p class="pm-empty">${escape(message||'선택한 기간에 기록이 없습니다.')}</p>`;
async function get(url,signal){const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal});let result;try{result=await response.json();}catch{throw new Error('통계 응답을 처리하지 못했습니다. 새로고침해주세요.');}if(!response.ok)throw new Error(result.error?.message||result.error||'통계를 불러오지 못했습니다.');return result.data;}
function table(headers,rows){return rows.length?`<div class="pm-table-wrap"><table class="pm-table"><thead><tr>${headers.map((h,i)=>`<th${i?' class="num"':''}>${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((cell,i)=>`<td${i?' class="num"':''}>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:empty();}
function breakdown(items){const total=items.reduce((sum,i)=>sum+i.count,0);return items.length?`<ul class="pm-breakdown">${items.map(i=>`<li><span>${escape(i.name)}</span><span class="num">${number(i.count)} <small>${Math.round(i.count/total*100)}%</small></span><meter min="0" max="${total}" value="${i.count}" aria-label="${escape(i.name)} ${i.count}회"></meter></li>`).join('')}</ul>`:empty();}
function chart(rows){
 const width=Math.max(260,$('#pm-trend').clientWidth),height=160,left=36,right=10,top=12,bottom=28,max=Math.max(1,...rows.map(r=>r.visitors)),ceiling=Math.max(1,Math.ceil((max+1)/4)*4);
 const x=i=>left+i*(width-left-right)/Math.max(1,rows.length-1),y=n=>height-bottom-n/ceiling*(height-top-bottom);
 const ticks=[0,Math.round(ceiling/2),ceiling].filter((v,i,a)=>a.indexOf(v)===i);
 const labels=[0,Math.floor((rows.length-1)/2),rows.length-1].filter((v,i,a)=>a.indexOf(v)===i);
 return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="일별 방문자 ${rows.map(r=>r.date+' '+r.visitors+'명').join(', ')}">${ticks.map(n=>`<line x1="${left}" x2="${width-right}" y1="${y(n)}" y2="${y(n)}" stroke="var(--pm-rule)"/><text x="${left-8}" y="${y(n)+4}" text-anchor="end">${n}</text>`).join('')}<polyline points="${rows.map((r,i)=>x(i)+','+y(r.visitors)).join(' ')}" fill="none" stroke="var(--brand)" stroke-width="2.5"/>${rows.length===1?`<circle cx="${x(0)}" cy="${y(rows[0].visitors)}" r="3" fill="var(--brand)"/>`:''}${labels.map(i=>`<text x="${x(i)}" y="${height-4}" text-anchor="${i===0?'start':i===rows.length-1?'end':'middle'}">${rows[i].date.slice(5)}</text>`).join('')}</svg><details><summary>날짜별 수치 보기</summary>${table(['날짜','방문자','페이지뷰'],rows.map(r=>[escape(r.date),number(r.visitors),number(r.pageViews)]))}</details>`;
}
if($('#pm-statistics')){
 const form=$('#pm-filters'),params=new URLSearchParams(location.search);let data,controller,lastGood='',sessionPage=Number(params.get('session_page'))||1;
 for(const [key,value] of params)if(form.elements[key]&&key!=='site')form.elements[key].value=value;
 function dates(){const custom=form.elements.period.value==='custom';$('#pm-dates').hidden=!custom;for(const key of ['start','end'])form.elements[key].required=custom;}
 dates();$('#pm-period').addEventListener('change',dates);
 function panels(){
  const query=$('#pm-page-filter').value.toLowerCase(),event=$('#pm-event-filter').value.toLowerCase();
  const pages=data.pages.filter(p=>p.name.toLowerCase().includes(query));
  $('#pm-pages').innerHTML=table(['페이지','조회','방문자','평균 체류'],pages.slice(0,10).map(p=>[link(p.name,p.title||new URL(p.name).pathname)+`<small class="pm-sub">${escape(p.name)}</small>`,number(p.count),number(p.visitors),duration(p.avgDurationSeconds)]))+(pages.length>10?`<details><summary>나머지 ${number(pages.length-10)}개 페이지</summary>${table(['페이지','조회'],pages.slice(10).map(p=>[link(p.name),number(p.count)]))}</details>`:'');
  const events=data.events.filter(e=>e.name.toLowerCase().includes(event));
  $('#pm-events').innerHTML=events.length?events.map(e=>`<details class="pm-event"><summary><span>${escape(e.name)}</span><strong class="num">${number(e.count)}회</strong></summary>${table(['발생 페이지','횟수'],e.pages.map(p=>[link(p.name),number(p.count)]))}</details>`).join(''):empty();
 }
 async function load(){
  controller?.abort();controller=new AbortController();$('#pm-statistics').setAttribute('aria-busy','true');$('#pm-error').hidden=true;
  const query=new URLSearchParams(new FormData(form));if(query.get('period')!=='custom'){query.delete('start');query.delete('end');}query.set('session_page',String(sessionPage));history.replaceState(null,'','?'+query);
  try{
   data=await get('/api/statistics/overview?'+query,controller.signal);const o=data.overview;
   document.querySelectorAll('[data-metric]').forEach(el=>{const k=el.dataset.metric;el.textContent=k==='avgDurationSeconds'?duration(o[k]):k==='bounceRate'?o[k]+'%':number(o[k]);});
   $('#pm-finding').textContent=o.visitors?`${data.range.label} · ${number(o.visitors)}명의 방문자가 ${number(o.pageViews)}개 페이지를 조회했습니다.`:'아직 방문 기록이 없습니다. 통계 수집 설정에서 사이트와 설치 코드를 확인해주세요.';
   $('#pm-trend').innerHTML=chart(data.trend);
   for(const key of ['referrers','devices','os','browsers','bots'])$('#pm-'+key).innerHTML=breakdown(data[key]);
   $('#pm-campaigns').innerHTML=table(['소스 / 매체 / 캠페인','세션'],data.campaigns.map(i=>[escape(i.name),number(i.count)]));panels();
   $('#pm-sessions').innerHTML=table(['접속 시각 / IP','유입 / 기기','랜딩 페이지','페이지뷰','체류','상세'],data.sessions.map(s=>[`${escape(stamp(s.createdAt))}<small class="pm-sub">${escape(s.ip||'IP 미수집')}${s.bot?' · '+escape(s.bot):''}</small>`,`${escape(s.source)}<small class="pm-sub">${escape(s.device+' · '+s.os+' · '+s.browser)}</small>`,link(s.landingPage),number(s.pageViews),duration(s.durationSeconds),`<a href="/admin/statistics/session/?site=${encodeURIComponent(s.siteId)}&session=${encodeURIComponent(s.sessionId)}&back=${encodeURIComponent(location.search)}">상세 보기</a>`]));
   const p=data.pagination;sessionPage=p.page;$('#pm-session-pages').innerHTML=`<span>총 ${number(p.total)}세션 · ${p.page} / ${p.pages}페이지</span><button type="button" class="btn" data-page="${p.page-1}" ${p.page<=1?'disabled':''}>이전</button><button type="button" class="btn" data-page="${p.page+1}" ${p.page>=p.pages?'disabled':''}>다음</button>`;
   lastGood=new Date().toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour12:false});$('#pm-freshness').textContent='마지막 갱신 '+lastGood+' (한국시간)';
  }catch(error){if(error.name==='AbortError')return;$('#pm-error').textContent=error.message+(lastGood?' 마지막 정상 갱신 '+lastGood+'.':'');$('#pm-error').hidden=false;$('#pm-finding').textContent=lastGood?'이전 조회 결과를 표시하고 있습니다.':'통계 조회에 실패했습니다. 새로고침을 눌러 다시 시도해주세요.';}
  finally{if(!controller.signal.aborted)$('#pm-statistics').setAttribute('aria-busy','false');}
 }
 form.addEventListener('submit',e=>{e.preventDefault();sessionPage=1;load();});$('#pm-refresh').addEventListener('click',load);
 $('#pm-page-filter').addEventListener('input',()=>data&&panels());$('#pm-event-filter').addEventListener('input',()=>data&&panels());
 window.addEventListener('resize',()=>{if(data)$('#pm-trend').innerHTML=chart(data.trend);});
 $('#pm-session-pages').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b&&!b.disabled){sessionPage=Number(b.dataset.page);load();}});
 try{const sites=await get('/api/statistics/sites');$('#pm-site').innerHTML='<option value="all">전체 사이트</option>'+sites.map(s=>`<option value="${escape(s.id)}">${escape(s.name)}${s.active?'':' (수집 중지)'}</option>`).join('');if(sites.some(s=>s.id===params.get('site')))$('#pm-site').value=params.get('site');}catch(error){$('#pm-error').textContent=error.message;$('#pm-error').hidden=false;}
 await load();
}
if($('#pm-session')){
 const params=new URLSearchParams(location.search);const back=params.get('back');if(back?.startsWith('?'))$('#pm-back').href='/admin/statistics/'+back;
 try{
  const hits=await get('/api/statistics/session?'+new URLSearchParams({site:params.get('site')||'',session:params.get('session')||''}));
  const pages=hits.filter(h=>h.kind==='pageview').sort((a,b)=>a.createdAt.localeCompare(b.createdAt)),s=pages[0];if(!s)throw new Error('페이지 이동 기록이 아직 도착하지 않았습니다. 잠시 후 새로고침해주세요.');
  const fields=[['접속 시각',escape(stamp(s.createdAt))],['사이트',escape(s.siteId)],['방문자 ID',escape(s.visitorId)],['IP',escape(s.ip||'미수집')],['유입경로',escape(s.source)],['유입 URL',s.referrer?link(s.referrer,s.referrer):'직접접속'],['기기',escape(s.device+' · '+s.os+' · '+s.browser)],['봇',escape(s.bot||'사람으로 추정')],['UTM',escape(Object.entries(s.utm||{}).filter(([,v])=>v).map(([k,v])=>k+': '+v).join(' / ')||'없음')]];
  $('#pm-session-info').innerHTML=fields.map(([name,value])=>`<dt>${name}</dt><dd>${value}</dd>`).join('');
  $('#pm-timeline').innerHTML=`<ol class="pm-timeline">${pages.map(p=>{const ends=hits.filter(h=>h.kind==='end'&&h.pageViewId===p.pageViewId),seconds=ends.length?Math.max(...ends.map(e=>e.duration)):null,events=hits.filter(h=>h.kind==='event'&&h.pageViewId===p.pageViewId);return `<li><div><strong>${link(p.pageUrl,p.title||p.pageUrl)}</strong><span class="num">${duration(seconds)}</span></div><small>${escape(stamp(p.createdAt))} · ${link(p.pageUrl,p.pageUrl)}</small>${events.length?`<ul>${events.map(e=>`<li>${escape(stamp(e.createdAt))} · ${escape(e.eventName)}${e.eventValue?' · '+escape(e.eventValue):''}</li>`).join('')}</ul>`:''}</li>`;}).join('')}</ol>`;
 }catch(error){$('#pm-error').textContent=error.message;$('#pm-error').hidden=false;$('#pm-session-info').innerHTML='<dt>조회 상태</dt><dd>기록을 불러오지 못했습니다.</dd>';}
}
