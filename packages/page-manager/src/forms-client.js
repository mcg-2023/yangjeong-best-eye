const $=s=>document.querySelector(s);
const toast=message=>{const e=$('.toast');e.textContent=message;e.hidden=false;setTimeout(()=>e.hidden=true,3000);};
const editor=$('#post-editor');
if(editor){
  const body=$('#field-body'),feedback=$('#editor-feedback');
  const showErrors=errors=>{feedback.replaceChildren(...errors.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));feedback.hidden=false;feedback.focus();};
  const count=()=>{if($('#body-format')?.value!=='html')$('#body-count').textContent=body.value.length.toLocaleString()+'자';};body.addEventListener('input',count);count();
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
