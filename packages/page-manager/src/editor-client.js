import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import './editor.css';
import {articleHtml,videoSource} from './html-content.js';
import {markdown,esc} from './content.js';

const form=document.querySelector('#post-editor');
if(form)setup();
function setup(){
  const $=selector=>document.querySelector(selector),body=$('#field-body'),format=$('#body-format');
  const visualPanel=$('#rich-visual-panel'),tabs=$('#rich-view-tabs'),note=$('#rich-code-note'),markdownTools=$('[data-markdown-tools]');
  const BaseImage=Quill.import('formats/image'),BlockEmbed=Quill.import('blots/block/embed');
  class DescribedImage extends BaseImage{
    static create(value){const node=super.create(typeof value==='string'?value:value.src);if(typeof value==='object')node.setAttribute('alt',value.alt??'');return node;}
    static value(node){return {src:node.getAttribute('src'),alt:node.getAttribute('alt')??''};}
  }
  class FileVideo extends BlockEmbed{
    static blotName='fileVideo';static tagName='video';
    static create(value){const node=super.create();node.setAttribute('src',videoSource(value)?.src??'');node.setAttribute('controls','');node.setAttribute('playsinline','');node.setAttribute('preload','metadata');return node;}
    static value(node){return node.getAttribute('src');}
  }
  Quill.register(DescribedImage,true);Quill.register(FileVideo,true);
  let view='visual',visualDirty=false,mediaKind='image',bookmark=null,uploadData='',uploadVersion=0;
  const feedback=message=>{const node=$('#editor-feedback');node.textContent=message;node.hidden=false;node.focus();};
  const changed=()=>form.dispatchEvent(new Event('input',{bubbles:true}));
  const quill=new Quill('#rich-visual',{theme:'snow',placeholder:'본문을 작성하고 이미지나 동영상을 넣어보세요.',formats:['header','bold','italic','underline','strike','list','blockquote','link','image','video','fileVideo','align','color','code'],modules:{toolbar:{container:'#rich-toolbar',handlers:{image:()=>openMedia('image'),video:()=>openMedia('video')}}}});
  quill.root.setAttribute('aria-label','본문 화면 편집');quill.root.setAttribute('role','textbox');quill.root.setAttribute('aria-multiline','true');
  const sync=()=>{
    if(format.value==='html'&&view==='visual'&&visualDirty){body.value=articleHtml(quill.getSemanticHTML()).html;visualDirty=false;}
  };
  const count=()=>{$('#body-count').textContent=(format.value==='html'?articleHtml(body.value).text.length:body.value.length).toLocaleString()+'자';};
  const loadVisual=()=>{const clean=articleHtml(body.value).html;quill.setContents(quill.clipboard.convert({html:clean}),'silent');visualDirty=false;};
  const showView=next=>{
    sync();view=next;
    if(format.value==='html'){
      tabs.hidden=false;markdownTools.hidden=true;visualPanel.hidden=next!=='visual';body.hidden=next==='visual';note.hidden=next!=='code';
      if(next==='visual')loadVisual();
      tabs.querySelectorAll('[data-rich-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.richView===next)));
    }else{tabs.hidden=true;visualPanel.hidden=true;body.hidden=false;note.hidden=true;markdownTools.hidden=false;}
    $('#body-format-help').textContent=format.value==='html'?'이미지·동영상 삽입과 HTML 코드 편집을 지원합니다.':'## 제목 · **굵게** · - 목록';count();
  };
  quill.on('text-change',(_delta,_old,source)=>{if(source==='silent')return;visualDirty=true;sync();count();changed();});
  body.addEventListener('input',()=>{if(format.value==='html')count();});
  tabs.querySelectorAll('[data-rich-view]').forEach(button=>button.addEventListener('click',()=>{try{showView(button.dataset.richView);}catch(error){feedback(error.message);}}));
  format.addEventListener('change',()=>{
    try{
      if(format.value==='html'){body.value=markdown(body.value);showView('visual');}
      else{
        if(!confirm('Markdown으로 전환하면 HTML 서식과 이미지·동영상은 일반 텍스트로 바뀝니다. 전환할까요?')){format.value='html';return;}
        body.value=articleHtml(body.value).text;showView('code');
      }
      changed();
    }catch(error){feedback(error.message);}
  });
  function openMedia(kind){
    mediaKind=kind;bookmark=view==='visual'?quill.getSelection(true):{index:body.selectionStart,end:body.selectionEnd};uploadData='';uploadVersion++;
    $('#rich-media-title').textContent=kind==='image'?'이미지 삽입':'동영상 삽입';$('#rich-media-url-label').textContent=kind==='image'?'이미지 주소':'동영상 주소';
    $('#rich-image-file-field').hidden=kind!=='image';$('#rich-image-alt-field').hidden=kind!=='image';$('#rich-video-help').hidden=kind!=='video';
    $('#rich-media-url').value='';$('#rich-image-alt').value='';$('#rich-image-file').value='';$('#rich-image-preview').hidden=true;$('#rich-media-error').hidden=true;$('#rich-media-insert').disabled=false;
    $('#rich-media-dialog').showModal();$('#rich-media-url').focus();
  }
  $('#rich-media-close').addEventListener('click',()=>{$('#rich-media-dialog').close();uploadVersion++;delete form.dataset.bodyUploading;});
  for(const [id,kind] of [['rich-add-image','image'],['rich-add-video','video']])$( '#'+id)?.addEventListener('click',()=>openMedia(kind));
  $('#rich-image-file').addEventListener('change',async event=>{
    const file=event.target.files[0],version=++uploadVersion;if(!file)return;
    const errorNode=$('#rich-media-error');errorNode.hidden=true;$('#rich-media-insert').disabled=true;form.dataset.bodyUploading='true';
    let url;
    try{
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('8MB 이하의 JPG, PNG, WebP 이미지를 선택해주세요.');
      url=URL.createObjectURL(file);const image=new Image();image.src=url;await image.decode();
      if(image.naturalWidth*image.naturalHeight>40000000)throw new Error('이미지를 4,000만 화소 이하로 줄여주세요.');
      const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      let data;for(const quality of [.86,.72,.56,.4]){data=canvas.toDataURL('image/webp',quality);if(data.length<=380000)break;}
      if(data.length>380000)throw new Error('이미지 용량을 더 줄여서 선택해주세요.');
      if(version!==uploadVersion)return;
      uploadData=data;$('#rich-image-preview').src=data;$('#rich-image-preview').hidden=false;$('#rich-media-url').value='';
    }catch(error){if(version===uploadVersion){errorNode.textContent=error.message||'이미지를 읽을 수 없습니다.';errorNode.hidden=false;uploadData='';}}
    finally{if(url)URL.revokeObjectURL(url);if(version===uploadVersion){$('#rich-media-insert').disabled=false;delete form.dataset.bodyUploading;}}
  });
  $('#rich-media-insert').addEventListener('click',()=>{
    const source=uploadData||$('#rich-media-url').value.trim(),alt=$('#rich-image-alt').value.trim(),errorNode=$('#rich-media-error');
    try{
      let html,value,kind;
      if(mediaKind==='image'){
        if(!source||!alt)throw new Error('이미지 파일 또는 주소와 이미지 설명을 입력해주세요.');
        html=articleHtml(`<img src="${esc(source)}" alt="${esc(alt)}">`).html;if(!html)throw new Error('HTTPS 이미지 주소 또는 정상적인 이미지 파일을 선택해주세요.');
        kind='image';value={src:source,alt};
      }else{
        const video=videoSource(source);if(!video)throw new Error('YouTube·Vimeo 또는 HTTPS MP4·WebM 주소를 확인해주세요.');
        kind=video.kind==='iframe'?'video':'fileVideo';value=video.src;html=articleHtml(`<${video.kind} src="${esc(video.src)}"></${video.kind}>`).html;
      }
      if(view==='code'){const start=bookmark?.index??body.value.length,end=bookmark?.end??start;body.setRangeText('\n'+html+'\n',start,end,'end');body.dispatchEvent(new Event('input',{bubbles:true}));}
      else{const index=bookmark?.index??quill.getLength()-1;quill.insertEmbed(index,kind,value,'user');quill.insertText(index+1,'\n','user');quill.setSelection(index+2,0,'silent');}
      $('#rich-media-dialog').close();changed();count();
    }catch(error){errorNode.textContent=error.message;errorNode.hidden=false;}
  });
  window.journalComposer={sync,preview:()=>{sync();return articleHtml(body.value).html;}};
  form.dataset.composerReady='true';showView(format.value==='html'?'visual':'code');
}
