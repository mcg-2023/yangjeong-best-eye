import {imageData} from './image-data.js';
import {articleHtml} from './html-content.js';
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeLink(value) {
  try { const u=new URL(value); return ['https:','http:'].includes(u.protocol)?u.href:''; } catch {return '';}
}
export function inline(text) {
  return esc(text).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
}
export function markdown(text) {
  const lines=String(text??'').split('\n'); let out='',list=false,index=0;
  for(const line of lines) {
    const item=line.match(/^[-*] (.+)$/);
    if(item){ if(!list){out+='<ul>';list=true;} out+=`<li>${inline(item[1])}</li>`;continue; }
    if(list){out+='</ul>';list=false;}
    const heading=line.match(/^(#{2,3}) (.+)$/);
    if(heading){const n=heading[1].length;out+=`<h${n} id="section-${++index}">${inline(heading[2])}</h${n}>`;}
    else if(line.trim()) out+=`<p>${inline(line)}</p>`;
  }
  return out+(list?'</ul>':'');
}
export const headings = body => Array.from(String(body??'').matchAll(/^#{2,3} (.+)$/gm),(m,i)=>({id:`section-${i+1}`,text:m[1]}));
export const isTestPost = post => post.id?.startsWith('test-journal-') === true;
export const coverUrl = post => post.coverRef || (post.cover ? `/media/${encodeURIComponent(post.id)}/cover?v=${encodeURIComponent(post.updatedAt??post.publishedAt??'1')}` : '');
export const latestPosts = posts => posts.filter(p=>p.status==='published').sort((a,b)=>(b.publishedAt??b.createdAt??'').localeCompare(a.publishedAt??a.createdAt??'')||a.id.localeCompare(b.id));
export const validCover=value=>Boolean(imageData(value));
export const postText=post=>post.bodyFormat==='html'?articleHtml(post.body).text:String(post.body??'');
export const postHeadings=post=>post.bodyFormat==='html'?articleHtml(post.body).headings:headings(post.body);
export const postBody=post=>post.bodyFormat==='html'?articleHtml(post.body).html:markdown(post.body);
export function validatePost(post, publishing=false,options={}) {
  const errors=[];
  if(!post.title?.trim())errors.push('제목을 입력해주세요.');
  if((post.title??'').length>150)errors.push('제목은 150자 이하로 입력해주세요.');
  if(!(options.categories??['notice']).includes(post.category))errors.push('주제를 선택해주세요.');
  if(!post.body?.trim()||(post.bodyFormat==='html'&&!postText(post).trim()&&!/<(?:img|video|iframe)\b/.test(post.body)))errors.push('본문을 입력해주세요.');
  if(postText(post).length>80000||(post.body??'').length>(post.bodyFormat==='html'?200000:80000))errors.push('본문은 80,000자 이하로 입력해주세요.');
  if(post.cover&&!validCover(post.cover))errors.push('실제 이미지 파일인 PNG, JPG, WebP를 사용해주세요.');
  if((post.cover||post.coverRef)&&!post.imageAlt?.trim())errors.push('대표이미지 설명을 입력해주세요.');
  if(publishing){
    if(!post.author?.trim())errors.push('작성자를 입력해주세요.');
    if(!post.excerpt?.trim())errors.push('글 요약을 입력해주세요.');
    if(!post.seoTitle?.trim()||!post.description?.trim())errors.push('검색 제목과 설명을 입력해주세요.');
    if(/SOURCE_EXTRACT|<placeholder>|미분류/.test([post.title,post.body,post.answer].join(' ')))errors.push('미확인 정보나 임시 문구는 발행할 수 없습니다.');
    if((options.reviewCategories??[]).includes(post.category)){
      if(!post.answer?.trim())errors.push('핵심 답변을 입력해주세요.');
      if(!post.reviewer?.trim()||!post.reviewedAt||!post.reviewApproved)errors.push(`${options.reviewLabel??'콘텐츠 검수'}자·검수일과 검수 완료 확인이 필요합니다.`);
      const reviewDate=new Date(post.reviewedAt+'T00:00:00Z');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(post.reviewedAt??'')||Number.isNaN(reviewDate.getTime())||reviewDate.toISOString().slice(0,10)!==post.reviewedAt||post.reviewedAt>new Date().toISOString().slice(0,10))errors.push('유효한 검수일을 입력해주세요.');
    }
  }
  return errors;
}
export function relatedPosts(post, posts) {
  return posts.filter(p=>p.id!==post.id&&p.status==='published'&&(isTestPost(post)||!isTestPost(p))).map(p=>({p,score:(p.category===post.category?10:0)+(p.tags??[]).filter(t=>(post.tags??[]).includes(t)).length*3})).filter(v=>v.score>0).sort((a,b)=>b.score-a.score||b.p.updatedAt.localeCompare(a.p.updatedAt)).slice(0,3).map(v=>v.p);
}
export function publicationData(input, existing, now=new Date().toISOString()) {
  const status=['published','medical_review','draft','archived'].includes(input.status)?input.status:'draft';
  const p={...input,id:existing?.id??crypto.randomUUID(),status,createdAt:existing?.createdAt??now,updatedAt:now,publishedAt:status==='published'?(existing?.publishedAt??now):existing?.publishedAt??null};
  // Any changed medical content invalidates a previous approval. The editor must explicitly reconfirm it.
  p.reviewApproved=input.reviewApproved===true;
  return p;
}
