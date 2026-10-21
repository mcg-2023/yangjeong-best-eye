import {hospital,quickLinks} from './hospital.js';
import {esc} from './content.js';

const drawings={
  location:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  toggle:'<path d="M5 8h14M5 16h14"/><circle cx="8" cy="8" r="2" fill="currentColor"/><circle cx="16" cy="16" r="2" fill="currentColor"/>',
};
const images={blog:'quick-blog.png',instagram:'quick-instagram.png',carrot:'quick-carrot.png',booking:'quick-reservation.png'};
const glyph=name=>images[name]
  ?`<img class="quick-menu-icon" src="/assets/${images[name]}" width="32" height="32" alt="" aria-hidden="true" decoding="async">`
  :`<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[name]}</svg>`;

export function quickMenu(){
  const items=[
    {key:'blog',label:'네이버블로그',href:quickLinks.blog},
    {key:'instagram',label:'인스타그램',href:quickLinks.instagram},
    {key:'carrot',label:'당근마켓',href:quickLinks.carrot},
    {key:'location',label:'병원위치',href:hospital.map},
    {key:'booking',label:'진료예약',href:quickLinks.booking},
  ];
  return `<nav class="quick-menu" aria-label="빠른 메뉴" data-quick-menu>
    <div class="quick-menu-panel" id="quick-menu-links"><p class="quick-menu-caption" aria-hidden="true">QUICK LINKS</p>
      ${items.map(item=>{
        const content=`${glyph(item.key)}<span>${item.label}</span>`;
        const className=`quick-menu-item quick-menu-${item.key}`;
        if(!item.href)return `<button type="button" class="${className}" data-quick-pending="${item.label}" title="${item.label} 연결 주소 확인 중">${content}<span class="sr-only">연결 준비 중</span></button>`;
        const external=/^https?:/.test(item.href),phone=item.href.startsWith('tel:');
        return `<a class="${className}" href="${esc(item.href)}" ${external?'target="_blank" rel="noopener noreferrer"':''} ${phone?'title="전화로 진료예약 문의"':''}>${content}${external?'<span class="sr-only">새 창으로 열기</span>':''}</a>`;
      }).join('')}
    </div>
    <button class="quick-menu-toggle" type="button" aria-controls="quick-menu-links" aria-expanded="false" hidden>${glyph('toggle')}<span>바로가기</span></button>
  </nav>`;
}
