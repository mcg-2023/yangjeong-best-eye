export function registerImageAlignment(Quill) {
  const Align = Quill.import('attributors/class/align');
  Align.whitelist = ['left', 'center', 'right', 'justify'];
  Quill.register(Align, true);
}

export function installImageAlignment({Quill, quill, mediaControls, selected, refresh}) {
  const controls = document.createElement('div');
  controls.className = 'rich-media-align';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', '이미지 정렬');
  controls.innerHTML = '<span>이미지 정렬</span>' + [['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']]
    .map(([value, label]) => `<button type="button" data-media-align="${value}" aria-label="이미지 ${label} 정렬" aria-pressed="false" disabled>${label}</button>`).join('');
  mediaControls.insertBefore(controls, mediaControls.querySelector('p'));
  const buttons = controls.querySelectorAll('[data-media-align]');
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const image = selected();
      if (image?.tagName !== 'IMG' || !image.isConnected) return;
      const blot = Quill.find(image);
      if (!blot) return;
      quill.history.cutoff();
      quill.formatLine(quill.getIndex(blot), 1, 'align', button.dataset.mediaAlign, 'user');
      quill.history.cutoff();
      refresh();
    });
  }
  return {
    refresh() {
      const image = selected();
      const enabled = image?.tagName === 'IMG' && image.isConnected;
      const blot = enabled ? Quill.find(image) : null;
      const alignment = blot ? quill.getFormat(quill.getIndex(blot), 1).align || getComputedStyle(image.parentElement).textAlign : '';
      for (const button of buttons) {
        button.disabled = !enabled;
        button.setAttribute('aria-pressed', String(!!enabled && button.dataset.mediaAlign === alignment));
      }
    },
  };
}
