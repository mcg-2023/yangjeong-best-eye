const $=s=>document.querySelector(s);
const toast=message=>{const e=$('.toast');e.textContent=message;e.hidden=false;setTimeout(()=>e.hidden=true,3000);};
$('.menu-toggle')?.addEventListener('click',e=>{const b=e.currentTarget;const open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-label',open?'메뉴 닫기':'메뉴 열기');$('#main-nav').classList.toggle('open',open);});
$('[data-copy-link]')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);toast('글 주소를 복사했습니다.');}catch{toast('브라우저 주소창에서 글 주소를 복사해주세요.');}});
const editor=$('#post-editor');
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
if(editor){
  const body=$('#field-body'),feedback=$('#editor-feedback');
  const showErrors=errors=>{feedback.replaceChildren(...errors.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));feedback.hidden=false;feedback.focus();};
  const count=()=>$('#body-count').textContent=body.value.length.toLocaleString()+'자';body.addEventListener('input',count);count();
  document.querySelectorAll('[data-insert]').forEach(button=>button.addEventListener('click',()=>{const start=body.selectionStart,end=body.selectionEnd;const mark=button.dataset.insert,selected=body.value.slice(start,end);body.setRangeText(mark+selected+(button.dataset.wrap?mark:''),start,end,'end');body.focus();body.dispatchEvent(new Event('input'));}));
  let dirty=false;editor.addEventListener('input',()=>{dirty=true;});window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  let uploading=false,coverGeneration=0;
  let busy=false;editor.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;if(uploading||editor.dataset.bodyUploading){showErrors(['이미지 처리가 끝난 뒤 저장해주세요.']);return;}if($('#body-format')?.value==='html'&&!window.journalComposer){showErrors(['편집기를 준비하고 있습니다. 잠시 후 다시 시도해주세요.']);return;}window.journalComposer?.sync();if(!editor.reportValidity())return;busy=true;const button=e.submitter;const original=button?.innerHTML;const buttons=editor.querySelectorAll('button[type="submit"]');buttons.forEach(b=>b.disabled=true);if(button)button.textContent='저장 중…';feedback.hidden=true;
    try{const data=new FormData(editor);data.set('status',button?.value??'draft');const response=await fetch('/api/posts',{method:'POST',body:new URLSearchParams([...data.entries()].map(([k,v])=>[k,String(v)])),headers:{Accept:'application/json'}});const result=await response.json();if(!response.ok){showErrors(result.errors??['저장하지 못했습니다. 다시 시도해주세요.']);return;}dirty=false;location.href=result.url+'?saved='+encodeURIComponent(result.status);}catch{showErrors(['네트워크 연결을 확인한 뒤 다시 저장해주세요. 입력한 내용은 이 화면에 남아 있습니다.']);}finally{busy=false;buttons.forEach(b=>b.disabled=false);if(button)button.innerHTML=original;}
  });
  $('#cover-file').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;const generation=++coverGeneration;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){uploading=false;document.querySelector('.upload-area small').textContent='JPG · PNG · WebP / 최대 8MB · 자동 크기 조절';showErrors(['8MB 이하의 JPG, PNG, WebP 이미지를 선택해주세요.']);e.target.value='';return;}
    uploading=true;const hint=document.querySelector('.upload-area small');hint.textContent='이미지를 확인하고 크기를 조절하고 있습니다…';
    const url=URL.createObjectURL(file);
    try{
      const image=new Image();image.src=url;await image.decode();
      if(image.naturalWidth*image.naturalHeight>40000000)throw new Error('이미지 해상도가 너무 큽니다. 4,000만 화소 이하로 줄여주세요.');
      const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      let data;for(const quality of [.86,.72,.58,.4]){data=canvas.toDataURL('image/webp',quality);if(data.length<=680000)break;}
      if(data.length>680000)throw new Error('이미지 용량을 더 줄여서 다시 선택해주세요.');
      if(generation!==coverGeneration)return;
      $('#cover-data').value=data;$('#cover-preview').src=data;$('#cover-preview').hidden=false;dirty=true;
    }catch(error){if(generation===coverGeneration){showErrors([error.message.includes('이미지')?error.message:'이미지를 읽을 수 없습니다. 정상적인 이미지 파일을 선택해주세요.']);e.target.value='';}}
    finally{URL.revokeObjectURL(url);if(generation===coverGeneration){uploading=false;hint.textContent='JPG · PNG · WebP / 최대 8MB · 자동 크기 조절';}}
  });
  $('.remove-cover').addEventListener('click',()=>{coverGeneration++;uploading=false;document.querySelector('.upload-area small').textContent='JPG · PNG · WebP / 최대 8MB · 자동 크기 조절';$('#cover-data').value='';$('#cover-preview').removeAttribute('src');$('#cover-preview').hidden=true;$('#cover-file').value='';dirty=true;});
  $('#preview-post').addEventListener('click',()=>{const content=$('#preview-content');content.replaceChildren();const append=(tag,text,cls='')=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;content.append(el);};append('p',$('#field-category').selectedOptions[0].textContent,'badge');append('h1',$('#field-title').value||'제목');append('p',$('#field-excerpt').value,'article-dek');if($('#field-answer').value)append('p',$('#field-answer').value,'quick-answer');if($('#body-format')?.value==='html'&&window.journalComposer){const wrapper=document.createElement('div');wrapper.innerHTML=window.journalComposer.preview();content.append(wrapper);}else{let list;for(const line of body.value.split('\n')){const heading=line.match(/^(#{2,3}) (.+)$/);if(heading){list=null;append('h'+heading[1].length,heading[2]);}else if(/^[-*] /.test(line)){if(!list){list=document.createElement('ul');content.append(list);}const li=document.createElement('li');li.textContent=line.slice(2);list.append(li);}else if(line.trim()){list=null;const p=document.createElement('p');const parts=line.split(/(\*\*[^*]+\*\*)/g);for(const part of parts){if(part.startsWith('**')&&part.endsWith('**')){const strong=document.createElement('strong');strong.textContent=part.slice(2,-2);p.append(strong);}else p.append(document.createTextNode(part));}content.append(p);}}}$('#post-preview').showModal();});
  $('#close-preview').addEventListener('click',()=>$('#post-preview').close());
  const saved=new URLSearchParams(location.search).get('saved');if(saved){toast(saved==='published'?'글을 발행했습니다.':saved==='archived'?'글을 보관했습니다.':'글을 저장했습니다.');history.replaceState(null,'',location.pathname);}
}

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
