import Quill from 'quill';
import {storeImageFile} from './image-upload.js';
import 'quill/dist/quill.snow.css';
import './editor.css';
import {articleHtml,videoSource,mediaWidth} from './html-content.js';
import {markdown,esc} from './content.js';
import {registerImageAlignment,installImageAlignment} from './media-alignment.js';

const form=document.querySelector('#post-editor');
if(form)setup();
function setup(){
  const $=selector=>document.querySelector(selector),body=$('#field-body'),format=$('#body-format');
  const visualPanel=$('#rich-visual-panel'),tabs=$('#rich-view-tabs'),note=$('#rich-code-note'),markdownTools=$('[data-markdown-tools]');
  const BaseImage=Quill.import('formats/image'),BaseVideo=Quill.import('formats/video'),BlockEmbed=Quill.import('blots/block/embed');
  const widthOf=node=>mediaWidth(node.style.width)||mediaWidth(node.getAttribute('width'));
  const setWidth=(node,value)=>{node.removeAttribute('width');node.removeAttribute('height');const width=mediaWidth(value);if(width)node.style.width=width;else node.style.removeProperty('width');};
  class DescribedImage extends BaseImage{
    static create(value){const node=super.create(typeof value==='string'?value:value.src);if(typeof value==='object')node.setAttribute('alt',value.alt??'');return node;}
    static value(node){return {src:node.getAttribute('src'),alt:node.getAttribute('alt')??''};}
    static formats(node){return {alt:node.getAttribute('alt')??'',...(widthOf(node)?{width:widthOf(node)}:{})};}
    format(name,value){if(name==='width')setWidth(this.domNode,value);else super.format(name,value);}
  }
  class ResizableVideo extends BaseVideo{
    static create(value){const node=super.create(value);node.setAttribute('title','본문 동영상');node.setAttribute('referrerpolicy','strict-origin-when-cross-origin');node.setAttribute('allow','fullscreen; picture-in-picture; encrypted-media');return node;}
    static formats(node){return widthOf(node)?{width:widthOf(node)}:{};}
    format(name,value){if(name==='width')setWidth(this.domNode,value);else super.format(name,value);}
    html(){return this.domNode.outerHTML;}
  }
  class FileVideo extends BlockEmbed{
    static blotName='fileVideo';static tagName='video';
    static create(value){const node=super.create();node.setAttribute('src',videoSource(value)?.src??'');node.setAttribute('controls','');node.setAttribute('playsinline','');node.setAttribute('preload','metadata');return node;}
    static value(node){return node.getAttribute('src');}
    static formats(node){return widthOf(node)?{width:widthOf(node)}:{};}
    format(name,value){if(name==='width')setWidth(this.domNode,value);else super.format(name,value);}
    html(){return this.domNode.outerHTML;}
  }
  registerImageAlignment(Quill);
  Quill.register(DescribedImage,true);Quill.register(ResizableVideo,true);Quill.register(FileVideo,true);
  let view='visual',visualDirty=false,mediaKind='image',bookmark=null,uploadData='',uploadVersion=0,selectedMedia=null,resizeDrag=null,resizeFrame=0,observedImage=null;
  const feedback=message=>{const node=$('#editor-feedback');node.textContent=message;node.hidden=false;node.focus();};
  const changed=()=>form.dispatchEvent(new Event('input',{bubbles:true}));
  const quill=new Quill('#rich-visual',{theme:'snow',placeholder:'본문을 작성하고 이미지나 동영상을 넣어보세요.',formats:['header','bold','italic','underline','strike','list','blockquote','link','image','video','fileVideo','align','color','code'],modules:{toolbar:{container:'#rich-toolbar',handlers:{image:()=>openMedia('image'),video:()=>openMedia('video'),align:value=>quill.format('align',value||'left','user')}}}});
  const mediaControls=document.createElement('div');mediaControls.className='rich-media-size';
  mediaControls.innerHTML='<div class="rich-media-size-heading"><label for="rich-media-select">이미지·동영상 크기</label><select id="rich-media-select" aria-label="크기를 조절할 이미지 또는 동영상"><option value="">본문에 미디어를 넣어주세요</option></select></div><div class="rich-media-size-options"><label for="rich-media-width">너비</label><input type="range" id="rich-media-width" min="10" max="100" step="1" value="100" disabled><label class="rich-media-percent"><input type="number" id="rich-media-width-value" aria-label="미디어 너비 (%)" inputmode="numeric" min="10" max="100" step="1" value="100" disabled><span>%</span></label><span id="rich-media-width-mode"></span><div class="rich-media-size-presets">'+[25,50,75,100].map(size=>`<button type="button" data-media-width="${size}%" disabled>${size}%</button>`).join('')+'<button type="button" data-media-width="" disabled>자동</button></div></div><p>이미지는 네 모서리를 드래그해 조절할 수 있습니다. 너비는 슬라이더나 % 입력으로 바꾸며 높이는 비율에 맞게 자동 조절됩니다.</p><p id="rich-media-video-note" hidden>동영상 재생은 미리보기에서 확인하세요. 외부 재생이 제한된 영상은 원본에서 볼 수 있습니다. <a id="rich-media-open" target="_blank" rel="noopener">원본 영상 열기</a></p>';
  visualPanel.append(mediaControls);
  const imageAlignment=installImageAlignment({Quill,quill,mediaControls,selected:()=>selectedMedia,refresh:refreshMedia});
  const mediaSelect=$('#rich-media-select'),widthSlider=$('#rich-media-width'),widthValue=$('#rich-media-width-value');
  // Keep resize handles outside the editable document and saved article HTML.
  const imageResizer=document.createElement('div');imageResizer.className='rich-image-resizer';imageResizer.hidden=true;
  const corners=[['nw','왼쪽 위'],['ne','오른쪽 위'],['sw','왼쪽 아래'],['se','오른쪽 아래']];
  imageResizer.innerHTML=corners.map(([corner,label])=>`<button type="button" class="rich-image-handle rich-image-handle-${corner}" data-resize-corner="${corner}" aria-label="이미지 ${label} 모서리 크기 조절" title="드래그하거나 화살표 키로 크기 조절"></button>`).join('');
  visualPanel.append(imageResizer);
  const contentWidth=()=>{const style=getComputedStyle(quill.root);return quill.root.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);};
  const limitPercent=value=>Math.max(10,Math.min(100,Math.round(value)));
  function positionImageResizer(){
    const image=selectedMedia?.tagName==='IMG'&&selectedMedia.isConnected?selectedMedia:null;
    imageResizer.hidden=!image||view!=='visual'||format.value!=='html'||visualPanel.hidden;
    if(imageResizer.hidden)return;
    const rect=image.getBoundingClientRect(),parent=visualPanel.getBoundingClientRect();
    if(!rect.width||!rect.height){imageResizer.hidden=true;return;}
    Object.assign(imageResizer.style,{left:rect.left-parent.left+visualPanel.scrollLeft+'px',top:rect.top-parent.top+visualPanel.scrollTop+'px',width:rect.width+'px',height:rect.height+'px'});
  }
  const resizeObserver=new ResizeObserver(positionImageResizer);resizeObserver.observe(quill.root);
  quill.root.addEventListener('load',positionImageResizer,true);quill.root.addEventListener('scroll',positionImageResizer);window.addEventListener('resize',positionImageResizer);
  const mediaNodes=()=>Array.from(quill.root.querySelectorAll('img,iframe,video'));
  function refreshMedia(){
    const nodes=mediaNodes();if(!nodes.includes(selectedMedia))selectedMedia=null;
    mediaSelect.replaceChildren(new Option(nodes.length?'크기를 조절할 항목 선택':'본문에 미디어를 넣어주세요',''));
    nodes.forEach((node,index)=>mediaSelect.add(new Option(`${index+1}. ${node.tagName==='IMG'?'이미지':'동영상'}${node.alt?' · '+node.alt:''}`,String(index))));
    mediaSelect.disabled=!nodes.length;mediaSelect.value=selectedMedia?String(nodes.indexOf(selectedMedia)):'';
    const width=selectedMedia?widthOf(selectedMedia):'',percent=limitPercent(width.endsWith('%')?parseInt(width):selectedMedia?selectedMedia.getBoundingClientRect().width/contentWidth()*100:100);
    widthSlider.value=String(percent);widthSlider.disabled=!selectedMedia;widthValue.value=String(percent);widthValue.disabled=!selectedMedia;
    $('#rich-media-width-mode').textContent=selectedMedia&&!width?'자동':width.endsWith('px')?width:'';
    mediaControls.querySelectorAll('[data-media-width]').forEach(button=>{button.disabled=!selectedMedia;button.setAttribute('aria-pressed',String(!!selectedMedia&&button.dataset.mediaWidth===width));});
    nodes.forEach(node=>node.classList.toggle('rich-media-selected',node===selectedMedia));
    imageAlignment.refresh();
    if(observedImage!==selectedMedia){if(observedImage)resizeObserver.unobserve(observedImage);observedImage=selectedMedia?.tagName==='IMG'?selectedMedia:null;if(observedImage)resizeObserver.observe(observedImage);}
    positionImageResizer();
    const video=selectedMedia&&selectedMedia.tagName!=='IMG'?videoSource(selectedMedia.getAttribute('src')):null;
    $('#rich-media-video-note').hidden=!video;
    if(video){const url=new URL(video.src);$('#rich-media-open').href=url.hostname==='www.youtube-nocookie.com'?'https://www.youtube.com/watch?v='+url.pathname.split('/').pop():url.hostname==='player.vimeo.com'?'https://vimeo.com/'+url.pathname.split('/').pop():video.src;}
  }
  function resizeMedia(width){
    if(!selectedMedia?.isConnected)return;
    const blot=Quill.find(selectedMedia);if(!blot)return;
    quill.formatText(quill.getIndex(blot),1,'width',width||false,'user');refreshMedia();
  }
  mediaSelect.addEventListener('change',()=>{selectedMedia=mediaSelect.value===''?null:mediaNodes()[Number(mediaSelect.value)];refreshMedia();});
  widthSlider.addEventListener('input',()=>resizeMedia(widthSlider.value+'%'));
  widthValue.addEventListener('input',()=>{if(widthValue.value!==''&&widthValue.validity.valid)resizeMedia(widthValue.value+'%');});
  function commitWidthValue(){const value=widthValue.valueAsNumber;if(Number.isFinite(value))resizeMedia(limitPercent(value)+'%');else refreshMedia();}
  widthValue.addEventListener('change',commitWidthValue);
  widthValue.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commitWidthValue();}if(event.key==='Escape'){event.preventDefault();refreshMedia();}});
  mediaControls.querySelectorAll('[data-media-width]').forEach(button=>button.addEventListener('click',()=>resizeMedia(button.dataset.mediaWidth)));
  function applyImageDrag(){
    resizeFrame=0;if(!resizeDrag)return;
    const drag=resizeDrag,dx=(drag.x-drag.startX)*(drag.corner.endsWith('e')?1:-1),dy=(drag.y-drag.startY)*(drag.corner.startsWith('s')?1:-1)*drag.ratio;
    resizeMedia(limitPercent((drag.width+(Math.abs(dx)>=Math.abs(dy)?dx:dy))/drag.available*100)+'%');
  }
  function finishImageDrag(cancel=false){
    if(!resizeDrag)return;
    if(resizeFrame){cancelAnimationFrame(resizeFrame);resizeFrame=0;}
    if(!cancel)applyImageDrag();
    const drag=resizeDrag;resizeDrag=null;
    if(cancel&&selectedMedia===drag.image)resizeMedia(drag.originalWidth);
    quill.history.options.delay=drag.historyDelay;quill.history.cutoff();
    document.body.classList.remove('rich-media-resizing');
    if(drag.handle.hasPointerCapture(drag.pointerId))drag.handle.releasePointerCapture(drag.pointerId);
    positionImageResizer();
  }
  imageResizer.querySelectorAll('[data-resize-corner]').forEach(handle=>{
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0||resizeDrag||selectedMedia?.tagName!=='IMG')return;
      event.preventDefault();const rect=selectedMedia.getBoundingClientRect(),available=contentWidth();if(!rect.height||!available)return;
      quill.history.cutoff();
      resizeDrag={image:selectedMedia,handle,pointerId:event.pointerId,corner:handle.dataset.resizeCorner,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,width:rect.width,ratio:rect.width/rect.height,available,originalWidth:widthOf(selectedMedia),historyDelay:quill.history.options.delay};
      // Group a complete drag into one undo operation, including long drags.
      quill.history.options.delay=3600000;handle.setPointerCapture(event.pointerId);document.body.classList.add('rich-media-resizing');
    });
    handle.addEventListener('pointermove',event=>{if(resizeDrag?.pointerId!==event.pointerId)return;event.preventDefault();resizeDrag.x=event.clientX;resizeDrag.y=event.clientY;if(!resizeFrame)resizeFrame=requestAnimationFrame(applyImageDrag);});
    handle.addEventListener('pointerup',event=>{if(resizeDrag?.pointerId===event.pointerId){resizeDrag.x=event.clientX;resizeDrag.y=event.clientY;finishImageDrag();}});
    handle.addEventListener('pointercancel',()=>finishImageDrag(true));handle.addEventListener('lostpointercapture',()=>finishImageDrag());
    handle.addEventListener('keydown',event=>{
      const steps={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1};if(!(event.key in steps)&&!['Home','End'].includes(event.key))return;
      event.preventDefault();resizeMedia((event.key==='Home'?10:event.key==='End'?100:limitPercent(Number(widthSlider.value)+steps[event.key]*(event.shiftKey?10:1)))+'%');
    });
  });
  quill.root.addEventListener('dragstart',event=>{if(event.target.tagName==='IMG')event.preventDefault();});
  window.addEventListener('blur',()=>finishImageDrag(true));document.addEventListener('keydown',event=>{if(event.key==='Escape'&&resizeDrag){event.preventDefault();finishImageDrag(true);}});
  quill.root.addEventListener('click',event=>{
    const node=event.target.closest('img,video')||mediaNodes().find(item=>{if(item.tagName!=='IFRAME')return false;const rect=item.getBoundingClientRect();return event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom;});
    selectedMedia=node??null;refreshMedia();
  });
  quill.root.setAttribute('aria-label','본문 화면 편집');quill.root.setAttribute('role','textbox');quill.root.setAttribute('aria-multiline','true');
  const sync=()=>{
    if(format.value==='html'&&view==='visual'&&visualDirty){body.value=articleHtml(quill.getSemanticHTML()).html;visualDirty=false;}
  };
  const count=()=>{$('#body-count').textContent=(format.value==='html'?articleHtml(body.value).text.length:body.value.length).toLocaleString()+'자';};
  const loadVisual=()=>{const clean=articleHtml(body.value).html;quill.setContents(quill.clipboard.convert({html:clean}),'silent');visualDirty=false;refreshMedia();};
  const showView=next=>{
    sync();view=next;
    if(format.value==='html'){
      tabs.hidden=false;markdownTools.hidden=true;visualPanel.hidden=next!=='visual';body.hidden=next==='visual';note.hidden=next!=='code';
      if(next==='visual')loadVisual();
      tabs.querySelectorAll('[data-rich-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.richView===next)));
    }else{tabs.hidden=true;visualPanel.hidden=true;body.hidden=false;note.hidden=true;markdownTools.hidden=false;}
    $('#body-format-help').textContent=format.value==='html'?'이미지·동영상 삽입과 HTML 코드 편집을 지원합니다.':'## 제목 · **굵게** · - 목록';positionImageResizer();count();
  };
  quill.on('text-change',(_delta,_old,source)=>{if(source==='silent')return;visualDirty=true;sync();count();changed();refreshMedia();});
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
    try{
      const data=await storeImageFile(file,{form,kind:'inline'});
      if(version!==uploadVersion)return;
      uploadData=data;$('#rich-image-preview').src=data;$('#rich-image-preview').hidden=false;$('#rich-media-url').value='';
    }catch(error){if(version===uploadVersion){errorNode.textContent=error.message||'이미지를 읽을 수 없습니다.';errorNode.hidden=false;uploadData='';}}
    finally{if(version===uploadVersion){$('#rich-media-insert').disabled=false;delete form.dataset.bodyUploading;}}
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
      else{const index=bookmark?.index??quill.getLength()-1;quill.insertEmbed(index,kind,value,'user');quill.insertText(index+1,'\n','user');quill.setSelection(index+2,0,'silent');selectedMedia=quill.getLeaf(index)[0]?.domNode;refreshMedia();}
      $('#rich-media-dialog').close();changed();count();
    }catch(error){errorNode.textContent=error.message;errorNode.hidden=false;}
  });
  window.journalComposer={sync,preview:()=>{sync();return articleHtml(body.value).html;}};
  form.dataset.composerReady='true';showView(format.value==='html'?'visual':'code');
}
