import {createPageManager,postBody} from '@mcg/page-manager';
import {esc} from '@mcg/page-manager/content';
import config from './page-manager.config.js';

export function createWebsite(options={}){
  const manager=createPageManager(config,options);
  return async request=>{
    const managed=await manager.fetch(request);if(managed)return managed;
    if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
    const url=new URL(request.url),posts=await manager.publishedPosts();
    const env=options.environment?.()??process.env;
    let origin;try{const candidate=new URL(env.SITE_URL||url.origin);if(!['https:','http:'].includes(candidate.protocol)||candidate.username||candidate.password||candidate.pathname!=='/')throw new Error('Invalid SITE_URL');origin=candidate.origin;}catch{return new Response('SITE_URL 설정을 확인해주세요.',{status:503});}
    const indexing=env.SITE_INDEXING==='on'&&origin===url.origin;
    const document=(title,body,status=200,description='',schema=[])=>new Response(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | ${esc(config.siteName)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="${indexing&&status===200?'index,follow':'noindex,follow'}"><link rel="canonical" href="${esc(origin+url.pathname)}"><link rel="icon" href="${esc(config.favicon)}"><link rel="stylesheet" href="/page-manager/base.css"><link rel="stylesheet" href="/page-manager/article-images.css"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script></head><body style="--brand:${config.theme.primary};--brand-dark:${config.theme.dark};--pale:${config.theme.pale}"><header class="wrap" style="padding-block:30px;border-bottom:1px solid var(--line)"><a href="/">${esc(config.siteName)}</a></header><main class="wrap prose" style="max-width:900px;padding-block:40px">${body}</main></body></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(!indexing||status!==200?{'X-Robots-Tag':'noindex, follow'}:{})}});
    if(url.pathname==='/')return document('소식',`<h1>${esc(config.siteName)}</h1>${posts.length?posts.map(p=>`<article><h2><a href="${config.publicPostBase+encodeURIComponent(p.id)}/">${esc(p.title)}</a></h2><p>${esc(p.excerpt)}</p></article>`).join(''):'<p>아직 발행된 글이 없습니다.</p>'}`);
    if(url.pathname==='/robots.txt')return new Response(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`,{headers:{'Content-Type':'text/plain; charset=utf-8'}});
    if(url.pathname==='/sitemap.xml')return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(origin)}/</loc></url>${posts.map(p=>`<url><loc>${esc(origin+config.publicPostBase+p.id+'/')}</loc><lastmod>${esc(p.updatedAt)}</lastmod></url>`).join('')}</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8'}});
    const post=posts.find(p=>url.pathname===config.publicPostBase+p.id+'/');
    if(!post)return document('페이지를 찾을 수 없습니다','<h1>페이지를 찾을 수 없습니다.</h1><a href="/">홈으로 돌아가기</a>',404);
    return document(post.seoTitle||post.title,`<article><h1>${esc(post.title)}</h1><p>${esc(post.excerpt)}</p><p>${esc(post.author)} · ${esc(post.publishedAt?.slice(0,10))}</p>${post.coverUrl?`<img src="${esc(post.coverUrl)}" alt="${esc(post.imageAlt)}">`:''}${post.answer?`<div class="quick-answer">${esc(post.answer)}</div>`:''}${postBody(post)}</article>`,200,post.description||post.excerpt,[{'@context':'https://schema.org','@type':'BlogPosting',headline:post.title,description:post.description||post.excerpt,datePublished:post.publishedAt,dateModified:post.updatedAt,mainEntityOfPage:origin+url.pathname}]);
  };
}
