const normalized=Symbol('page-manager-config');
const text=(value,fallback)=>typeof value==='string'&&value.trim()?value.trim():fallback;
function asset(value,fallback){
  const result=text(value,fallback);
  if(/[\\\u0000-\u001f]/.test(result))throw new Error('Invalid page manager URL');
  if(/^\/(?!\/)/.test(result))return result;
  try{const url=new URL(result);if(url.protocol==='https:'&&!url.username&&!url.password)return url.href;}catch{}
  throw new Error('Page manager URLs must be same-site paths or HTTPS URLs');
}
function color(value,fallback){const result=value??fallback;if(!/^#[\da-f]{6}$/i.test(result))throw new Error('Theme colors must be six-digit hex colors');return result;}
export function definePageManager(input={}){
  if(input[normalized])return input;
  const id=text(input.id,'page_manager');if(!/^[a-z][a-z0-9_-]{1,39}$/.test(id))throw new Error('Invalid page manager ID');
  const categories=(input.categories??[{slug:'notice',name:'새 소식'}]).map(c=>{
    if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(c.slug??'')||!c.name?.trim())throw new Error('Each category needs a unique slug and name');
    return Object.freeze({slug:c.slug,name:c.name.trim(),reviewRequired:c.reviewRequired===true});
  });
  if(!categories.length||new Set(categories.map(c=>c.slug)).size!==categories.length)throw new Error('Categories must be nonempty and unique');
  const reviewEnabled=input.review?.enabled??categories.some(c=>c.reviewRequired);
  if(!reviewEnabled&&categories.some(c=>c.reviewRequired))throw new Error('Review fields are required for reviewed categories');
  const publicPostBase=asset(input.publicPostBase,'/articles/');if(!/^\/(?!\/)[\w/-]*\/$/.test(publicPostBase))throw new Error('publicPostBase must be a same-site path ending in /');
  return Object.freeze({[normalized]:true,id,siteName:text(input.siteName,'홈페이지'),storageName:text(input.storageName,'게시글 저장소'),logo:asset(input.logo,'/page-manager/brand.svg'),favicon:asset(input.favicon,'/page-manager/brand.svg'),font:asset(input.font,'/page-manager/PretendardVariable.woff2'),policyUrl:asset(input.policyUrl,'/'),publicPostBase,
    eyebrow:text(input.eyebrow,'WEBSITE · CONTENT DESK'),copyright:text(input.copyright,'WEBSITE MANAGER'),monogram:text(input.monogram,'PM'),welcomeTitle:text(input.welcomeTitle,'홈페이지의 새로운 이야기, 이곳에서 시작합니다.'),categories:Object.freeze(categories),
    review:Object.freeze({enabled:reviewEnabled,label:text(input.review?.label,'콘텐츠 검수'),approvalText:text(input.review?.approvalText,'검수자가 본문의 내용을 실제 확인하고 승인했습니다.'),help:text(input.review?.help,'검수가 필요한 주제는 발행할 때마다 검수자·검수일과 검수 완료를 확인해주세요.')}),
    theme:Object.freeze({primary:color(input.theme?.primary,'#213d78'),dark:color(input.theme?.dark,'#172e5c'),pale:color(input.theme?.pale,'#edf1f8')})});
}
export const validationOptions=config=>({categories:config.categories.map(c=>c.slug),reviewCategories:config.categories.filter(c=>c.reviewRequired).map(c=>c.slug),reviewLabel:config.review.label});
