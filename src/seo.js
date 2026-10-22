import {hospital as h,categoryName,homeMetadata} from './hospital.js';
import {esc,safeLink,coverUrl} from './content.js';

// Set SITE_URL to the final public origin. Never derive production canonicals from a preview host.
export function siteOrigin(value,fallback) {
  if(!value)return fallback;
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('SITE_URL must be an http(s) origin');
  return url.origin;
}
export function breadcrumbSchema(items,origin) {
  return {'@type':'BreadcrumbList',itemListElement:items.map((item,index)=>({'@type':'ListItem',position:index+1,name:item.name,item:origin+item.url}))};
}
export function articleSchema(post,origin,path) {
  return {'@type':'BlogPosting','@id':origin+path+'#article',url:origin+path,headline:post.title,description:post.excerpt,
    inLanguage:'ko-KR',image:[origin+coverUrl(post)],datePublished:post.publishedAt,dateModified:post.updatedAt,
    author:[h.name,h.shortName].includes(post.author)?{'@id':origin+'/#clinic'}:{'@type':'Person',name:post.author},publisher:{'@id':origin+'/#clinic'},mainEntityOfPage:{'@id':origin+path+'#page'},
    articleSection:categoryName(post.category),keywords:(post.tags??[]).join(', '),
    citation:(post.sources??[]).filter(s=>s.title&&safeLink(s.url)).map(s=>({'@type':'CreativeWork',name:s.title,url:safeLink(s.url)}))};
}
export function metadataHead({title,description,path,origin,noindex=false,schema=[],pageType='WebPage',breadcrumbs=[],post,verification={}}) {
  const canonical=origin+path,fullTitle=path==='/'?homeMetadata.title:title+' | '+h.shortName;
  const image=origin+(post?coverUrl(post):'/assets/main_sd1.webp');
  const page={'@type':pageType,'@id':canonical+'#page',url:canonical,name:title,description,inLanguage:'ko-KR',isPartOf:{'@id':origin+'/#website'},publisher:{'@id':origin+'/#clinic'}};
  if(post){page.mainEntity={'@id':canonical+'#article'};if(post.reviewApproved&&post.reviewer&&post.reviewedAt){page.reviewedBy={'@type':'Person',name:post.reviewer};page.lastReviewed=post.reviewedAt;}}
  const graph=[{'@type':'MedicalClinic','@id':origin+'/#clinic',name:h.name,telephone:h.phone,
    address:{'@type':'PostalAddress',streetAddress:'중앙대로 915, 호원메디컬타워 4·5층',addressLocality:'부산진구',addressRegion:'부산광역시',addressCountry:'KR'},
    medicalSpecialty:'https://schema.org/Ophthalmology',url:h.source,logo:origin+'/assets/logo.svg',
    openingHoursSpecification:[
      {'@type':'OpeningHoursSpecification',dayOfWeek:['Monday','Tuesday','Wednesday','Thursday','Friday'],opens:'09:00',closes:'13:00'},
      {'@type':'OpeningHoursSpecification',dayOfWeek:['Monday','Tuesday','Wednesday','Thursday','Friday'],opens:'14:00',closes:'18:00'},
      {'@type':'OpeningHoursSpecification',dayOfWeek:'Saturday',opens:'09:00',closes:'13:00'}]},
    {'@type':'WebSite','@id':origin+'/#website',name:h.shortName+' 건강정보',url:origin+'/',inLanguage:'ko-KR',publisher:{'@id':origin+'/#clinic'}},page,
    ...(breadcrumbs.length?[breadcrumbSchema(breadcrumbs,origin)]:[]),...schema];
  const json=JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c');
  const meta=(name,content,attribute='name')=>`<meta ${attribute}="${name}" content="${esc(content)}">`;
  return `<title>${esc(fullTitle)}</title>${meta('description',description)}${meta('robots',noindex?'noindex,follow':'index,follow,max-image-preview:large')}
    <link rel="canonical" href="${esc(canonical)}">${meta('og:type',post?'article':'website','property')}${meta('og:locale','ko_KR','property')}${meta('og:site_name',h.shortName+' 건강정보','property')}${meta('og:title',fullTitle,'property')}${meta('og:description',description,'property')}${meta('og:url',canonical,'property')}${meta('og:image',image,'property')}${meta('og:image:alt',post?.imageAlt||h.name+' 내부 공간','property')}
    ${meta('twitter:card','summary_large_image')}${meta('twitter:title',fullTitle)}${meta('twitter:description',description)}${meta('twitter:image',image)}${meta('twitter:image:alt',post?.imageAlt||h.name+' 내부 공간')}
    ${post?meta('article:published_time',post.publishedAt,'property')+meta('article:modified_time',post.updatedAt,'property')+meta('article:section',categoryName(post.category),'property'):''}
    ${Object.entries(verification).filter(([,value])=>value).map(([name,value])=>meta(name,value)).join('')}
    <script type="application/ld+json">${json}</script>`;
}
