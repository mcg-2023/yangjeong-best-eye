const sidebar=document.querySelector('#desk-sidebar'),menu=document.querySelector('#desk-menu-toggle');
const compact=window.matchMedia('(max-width: 760px)');
const setMenu=open=>{sidebar?.classList.toggle('is-open',open);if(sidebar)sidebar.inert=compact.matches&&!open;menu?.setAttribute('aria-expanded',String(open));menu?.setAttribute('aria-label',open?'관리자 메뉴 닫기':'관리자 메뉴 열기');};
setMenu(false);compact.addEventListener('change',()=>setMenu(false));
menu?.addEventListener('click',()=>setMenu(menu.getAttribute('aria-expanded')!=='true'));
document.addEventListener('click',event=>{if(sidebar&&!sidebar.contains(event.target)&&!menu?.contains(event.target))setMenu(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&sidebar?.classList.contains('is-open')){setMenu(false);menu.focus();}});
document.querySelector('[data-password-toggle]')?.addEventListener('click',event=>{const button=event.currentTarget,input=document.querySelector('#admin-password'),show=input.type==='password';input.type=show?'text':'password';button.setAttribute('aria-label',show?'비밀번호 숨기기':'비밀번호 표시');button.setAttribute('aria-pressed',String(show));});
document.querySelectorAll('[data-status-form]').forEach(form=>form.addEventListener('submit',async event=>{
  event.preventDefault();const archived=form.elements.status.value==='archived';
  if(!window.confirm(archived?'이 글을 보관할까요? 홈페이지에서 숨겨지며 나중에 초안으로 복원할 수 있습니다.':'이 글을 임시저장 상태로 복원할까요? 발행 전 검수를 다시 확인해주세요.'))return;
  const button=form.querySelector('button');button.disabled=true;
  try{
    const response=await fetch(form.action,{method:'POST',body:new URLSearchParams(new FormData(form)),headers:{Accept:'application/json'}});
    if(response.status===401){location.href='/admin/login/?next='+encodeURIComponent(location.pathname+location.search);return;}
    const result=await response.json();
    if(!response.ok)throw new Error(result.errors?.join(' ')||'처리하지 못했습니다. 다시 시도해주세요.');
    location.reload();
  }catch(error){const feedback=document.querySelector('.desk-action-feedback');feedback.textContent=error.message||'연결 상태를 확인하고 다시 시도해주세요.';feedback.hidden=false;feedback.scrollIntoView({block:'center'});button.disabled=false;}
}));
