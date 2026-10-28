import {parseFragment} from 'parse5';
import {imageData} from './image-data.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const allowed=new Set('p div span br strong b em i u s del h2 h3 h4 ul ol li blockquote hr a img figure figcaption pre code table thead tbody tfoot tr th td details summary'.split(' '));
const blocked=new Set('script style template svg math object embed form input button select textarea link meta base noscript'.split(' '));
const blocks=new Set('p div h1 h2 h3 h4 ul ol li blockquote hr figure figcaption pre table tr br'.split(' '));
export function safeArticleUrl(value){
  const raw=String(value??'').trim();if(/[\\\u0000-\u001f\u007f]/.test(raw))return '';
  if(/^\/(?!\/)/.test(raw)||/^#[\w-]+$/.test(raw))return raw;
  if(/^tel:\+?[\d -]{5,25}$/.test(raw))return raw;
  try{const url=new URL(raw);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
export function videoSource(value){
  try{
    const url=new URL(String(value).trim());if(url.protocol!=='https:'||url.username||url.password)return null;
    const host=url.hostname.toLowerCase();let id;
    if(['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com','youtube-nocookie.com'].includes(host))id=url.searchParams.get('v')??url.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1];
    if(host==='youtu.be')id=url.pathname.slice(1);
    if(id&&/^[\w-]{11}$/.test(id))return {kind:'iframe',src:'https://www.youtube-nocookie.com/embed/'+id};
    if(['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(host)){id=url.pathname.match(/(?:\/video)?\/(\d+)\/?$/)?.[1];if(id)return {kind:'iframe',src:'https://player.vimeo.com/video/'+id};}
    if(/\.(?:mp4|webm)$/i.test(url.pathname))return {kind:'video',src:url.href};
  }catch{}
  return null;
}
function imageUrl(src){
  if(src.startsWith('data:'))return imageData(src)?src:'';
  const url=safeArticleUrl(src);
  return url&&(url.startsWith('https://')||/^\/(?:assets\/|media\/[\w-]+\/inline\/)/.test(url))?url:'';
}
// Media widths are deliberately independent of general inline styles.
export function mediaWidth(value){
  const width=String(value??'').trim().toLowerCase();
  if(/^\d{1,3}%$/.test(width)&&parseInt(width)>=10&&parseInt(width)<=100)return parseInt(width)+'%';
  if(/^\d{1,4}(?:px)?$/.test(width)&&parseInt(width)>=1&&parseInt(width)<=4096)return parseInt(width)+'px';
  return '';
}
function mediaStyle(attrs){
  const declaration=String(attrs.style??'').split(';').map(item=>item.trim()).find(item=>/^width\s*:/i.test(item));
  const width=mediaWidth(declaration?.slice(declaration.indexOf(':')+1))||mediaWidth(attrs.width);
  return width?` style="width:${width}"`:'';
}
function safeStyle(value){
  const styles=[];
  for(const item of String(value??'').split(';')){
    const index=item.indexOf(':'),name=item.slice(0,index).trim().toLowerCase(),v=item.slice(index+1).trim().toLowerCase();
    if(name==='text-align'&&['left','center','right','justify'].includes(v))styles.push(name+':'+v);
    if(['color','background-color'].includes(name)&&(/^(?:#[\da-f]{3}|#[\da-f]{6}|black|white|red|blue|green|gray|navy|yellow)$/.test(v)||/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/.test(v)))styles.push(name+':'+v);
    if(name==='font-size'&&/^(?:16|18|20|22|24|28|32|36|40|48)px$/.test(v))styles.push(name+':'+v);
  }
  return styles.join(';');
}
export function articleHtml(value,{image=src=>imageUrl(src)}={}){
  const root=parseFragment(String(value??'')),headings=[];let text='',nodes=0;
  const nodeText=(node,depth=0)=>depth>80?'':node.nodeName==='#text'?node.value:(node.childNodes??[]).map(n=>nodeText(n,depth+1)).join('');
  const render=(node,depth=0)=>{
    if(++nodes>20000||depth>80)throw new Error('HTML 구조가 너무 복잡합니다. 본문을 나누거나 서식을 줄여주세요.');
    if(node.nodeName==='#text'){text+=node.value;return escape(node.value);}
    if(!node.tagName)return node.nodeName==='#comment'?'':(node.childNodes??[]).map(n=>render(n,depth+1)).join('');
    if(node.namespaceURI!=='http://www.w3.org/1999/xhtml'||blocked.has(node.tagName))return '';
    const attrs=Object.fromEntries((node.attrs??[]).map(a=>[a.name,a.value]));let tag=node.tagName==='h1'?'h2':node.tagName;
    if(tag==='iframe'||tag==='video'){
      const source=videoSource(attrs.src||(node.childNodes??[]).find(n=>n.tagName==='source')?.attrs?.find(a=>a.name==='src')?.value);
      if(!source)return '';
      const size=mediaStyle(attrs);
      return source.kind==='iframe'?`<iframe src="${escape(source.src)}"${size} title="${escape(attrs.title||'본문 동영상')}" loading="lazy" allow="fullscreen; picture-in-picture; encrypted-media" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`:`<video src="${escape(source.src)}"${size} controls playsinline preload="metadata"></video>`;
    }
    if(tag==='img'){
      const src=image(String(attrs.src??''),String(attrs.alt??''));
      return src?`<img src="${escape(src)}" alt="${escape(attrs.alt??'')}"${mediaStyle(attrs)} loading="lazy" decoding="async" referrerpolicy="no-referrer">`:'';
    }
    const children=()=> (node.childNodes??[]).map(n=>render(n,depth+1)).join('');
    if(!allowed.has(tag))return children();
    let extra='';
    if(tag==='a'){const href=safeArticleUrl(attrs.href);if(!href)return children();extra+=` href="${escape(href)}"`;if(href.startsWith('http'))extra+=' target="_blank" rel="noopener noreferrer"';}
    const style=safeStyle(attrs.style),classes=String(attrs.class??'').split(/\s+/).filter(c=>/^ql-align-(?:left|center|right|justify)$/.test(c));
    if(style)extra+=` style="${escape(style)}"`;if(classes.length)extra+=` class="${classes.join(' ')}"`;
    if(tag==='h2'||tag==='h3'){const id='section-'+(headings.length+1);headings.push({id,text:nodeText(node)});extra+=` id="${id}"`;}
    if(['th','td'].includes(tag))for(const name of ['colspan','rowspan'])if(/^[1-9]\d?$/.test(attrs[name]??''))extra+=` ${name}="${attrs[name]}"`;
    const result='<'+tag+extra+'>'+(['br','hr'].includes(tag)?'':children()+'</'+tag+'>');if(blocks.has(tag))text+='\n';return result;
  };
  const html=render(root);
  const faq=[];
  const collect=(node,depth=0)=>{
    if(depth>80)return;
    if(node.tagName==='details'){
      const summary=(node.childNodes??[]).find(n=>n.tagName==='summary');
      const question=summary?nodeText(summary).trim():'',answer=(node.childNodes??[]).filter(n=>n!==summary).map(n=>nodeText(n)).join(' ').trim();
      if(question.endsWith('?')&&question.length<=200&&answer&&answer.length<=3000&&faq.length<8)faq.push({question,answer});
    }
    for(const child of node.childNodes??[])collect(child,depth+1);
  };
  collect(parseFragment(html));
  return {html,text:text.replace(/\n{3,}/g,'\n\n').trim(),headings,faq};
}
export function prepareHtmlPost(post,existing){
  const retained=new Map((existing?.inlineImages??[]).map(item=>[item.id,item])),images=[];
  const result=articleHtml(post.body,{image:(src,alt)=>{
    if(!alt.trim())throw new Error('본문 이미지의 설명을 입력해주세요.');
    if(src.startsWith('data:')){
      const data=imageData(src);if(!data)throw new Error('본문 이미지는 실제 JPG, PNG, WebP 파일이어야 합니다.');
      const item={id:crypto.randomUUID(),data:src,alt};images.push(item);
      return '/media/'+post.id+'/inline/'+item.id;
    }
    const match=src.match(new RegExp('^/media/'+post.id+'/inline/([\\w-]+)$'));
    if(match){const item=retained.get(match[1]);if(!item)throw new Error('저장된 본문 이미지를 찾을 수 없습니다.');if(!images.some(i=>i.id===item.id)){images.push(item);}return src;}
    const safe=imageUrl(src);if(!safe)throw new Error('본문 이미지 주소를 확인해주세요.');return safe;
  }});
  if(result.html.length>200000||result.text.length>80000)throw new Error('본문은 80,000자 이하로 입력해주세요.');
  return {...post,body:result.html,bodyText:result.text,inlineImages:images};
}
