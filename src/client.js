const $=s=>document.querySelector(s);
const toast=message=>{const e=$('.toast');e.textContent=message;e.hidden=false;setTimeout(()=>e.hidden=true,3000);};
$('.menu-toggle')?.addEventListener('click',e=>{const b=e.currentTarget;const open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-label',open?'메뉴 닫기':'메뉴 열기');$('#main-nav').classList.toggle('open',open);});
$('[data-copy-link]')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);toast('글 주소를 복사했습니다.');}catch{toast('브라우저 주소창에서 글 주소를 복사해주세요.');}});
document.querySelectorAll('[data-carousel]').forEach(carousel=>{
  const slides=[...carousel.querySelectorAll('[data-slide]')];
  if(slides.length<2)return;
  const controls=carousel.querySelector('[data-carousel-controls]');
  const toggle=carousel.querySelector('[data-carousel-toggle]');
  const status=carousel.querySelector('[data-carousel-status]');
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let index=0,playing=!motion.matches,timer,hovered=false,focused=false;
  const schedule=()=>{clearInterval(timer);if(playing&&!hovered&&!focused&&!document.hidden)timer=setInterval(()=>show(index+1,false),6000);};
  const updateToggle=()=>{toggle.querySelector('[data-play-icon]').hidden=playing;toggle.querySelector('[data-pause-icon]').hidden=!playing;toggle.setAttribute('aria-label',playing?'자동 넘김 일시정지':'자동 넘김 시작');toggle.setAttribute('aria-pressed',String(!playing));toggle.title=toggle.getAttribute('aria-label');};
  const show=(next,manual=true)=>{
    index=(next+slides.length)%slides.length;
    slides.forEach((slide,i)=>{slide.classList.toggle('is-active',i===index);slide.inert=i!==index;if(i===index)slide.removeAttribute('aria-hidden');else slide.setAttribute('aria-hidden','true');});
    carousel.querySelector('[data-slide-count]').textContent=String(index+1).padStart(2,'0');
    if(manual){playing=false;updateToggle();status.textContent=`${index+1} / ${slides.length} · ${slides[index].querySelector('h2').textContent}`;}
    schedule();
  };
  slides.forEach((slide,i)=>{
    slide.classList.toggle('is-active',i===index);
    slide.hidden=false;
    // Fetch the other two images before their first fade to avoid an empty image panel.
    const image=slide.querySelector('.latest-image img');if(image)image.loading='eager';
  });
  carousel.classList.add('is-enhanced');
  controls.hidden=false;updateToggle();schedule();
  carousel.querySelector('[data-carousel-prev]').addEventListener('click',()=>show(index-1));
  carousel.querySelector('[data-carousel-next]').addEventListener('click',()=>show(index+1));
  toggle.addEventListener('click',()=>{playing=!playing;updateToggle();schedule();});
  carousel.addEventListener('mouseenter',()=>{hovered=true;schedule();});
  carousel.addEventListener('mouseleave',()=>{hovered=false;schedule();});
  carousel.addEventListener('focusin',()=>{focused=true;schedule();});
  carousel.addEventListener('focusout',event=>{if(!carousel.contains(event.relatedTarget)){focused=false;schedule();}});
  carousel.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();show(index+(event.key==='ArrowRight'?1:-1));}});
  document.addEventListener('visibilitychange',schedule);
  motion.addEventListener('change',()=>{if(motion.matches){playing=false;updateToggle();schedule();}});
});
const quickMenu = $('[data-quick-menu]');
if(quickMenu){
  const toggle=quickMenu.querySelector('.quick-menu-toggle');
  const compact=window.matchMedia('(max-width: 1100px)');
  const setOpen=open=>{
    quickMenu.classList.toggle('is-open',open);
    toggle.setAttribute('aria-expanded',String(open));
    toggle.querySelector('span').textContent=open?'닫기':'바로가기';
  };
  quickMenu.classList.add('is-enhanced');
  toggle.hidden=false;
  toggle.addEventListener('click',()=>setOpen(toggle.getAttribute('aria-expanded')!=='true'));
  quickMenu.querySelectorAll('[data-quick-pending]').forEach(button=>button.addEventListener('click',()=>{
    toast(button.dataset.quickPending+' 연결 주소를 확인하고 있습니다.');
    if(compact.matches)setOpen(false);
  }));
  document.addEventListener('click',event=>{if(compact.matches&&!quickMenu.contains(event.target))setOpen(false);});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&compact.matches&&quickMenu.classList.contains('is-open')){setOpen(false);toggle.focus();}
  });
  compact.addEventListener('change',()=>setOpen(false));
}
