/* Oibung Gallery: restrained enhancements that do not replace core catalog behavior. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const viewer = $('media-lightbox');
  const media = $('media-image');
  const caption = $('media-caption');
  const prev = $('media-prev');
  const next = $('media-next');
  let images = [];
  let activeIndex = 0;

  function displayMedia(index) {
    if (!images.length) return;
    activeIndex = (index + images.length) % images.length;
    const item = images[activeIndex];
    media.src = item.url;
    media.alt = item.alt || '갤러리 사진';
    caption.textContent = (activeIndex + 1) + ' / ' + images.length;
    prev.hidden = next.hidden = images.length < 2;
  }
  function closeViewer() { if (viewer.open) viewer.close(); }
  document.addEventListener('click', event => {
    const imageLink = event.target.closest('.community-gallery a, .review-post-photos a');
    if (!imageLink || !imageLink.querySelector('img')) return;
    event.preventDefault();
    const gallery = imageLink.closest('.community-gallery, .review-post-photos');
    const links = [...gallery.querySelectorAll('a')].filter(link => link.querySelector('img'));
    images = links.map(link => ({ url: link.href, alt: link.querySelector('img').alt }));
    displayMedia(Math.max(0, links.indexOf(imageLink)));
    if (!viewer.open) viewer.showModal();
    document.body.classList.add('no-scroll');
  });
  prev.addEventListener('click', () => displayMedia(activeIndex - 1));
  next.addEventListener('click', () => displayMedia(activeIndex + 1));
  $('media-close').addEventListener('click', closeViewer);
  viewer.addEventListener('click', event => { if (event.target === viewer) closeViewer(); });
  viewer.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); displayMedia(activeIndex - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); displayMedia(activeIndex + 1); }
  });
  viewer.addEventListener('close', () => {
    media.removeAttribute('src');
    images = [];
    const openDialogs = [...document.querySelectorAll('dialog')].some(dialog => dialog.open);
    document.body.classList.toggle('no-scroll', openDialogs);
  });

  const form = $('review-form');
  const photos = form.elements.namedItem('photos');
  const previews = $('review-photo-preview');
  const counter = $('review-character-count');
  const body = form.elements.namedItem('body');
  const reviewDialog = $('review-dialog');
  let previewUrls = [];
  function revokeUrls() {
    for (const url of previewUrls) URL.revokeObjectURL(url);
    previewUrls = [];
  }
  function renderPhotoPreviews() {
    revokeUrls();
    previews.replaceChildren();
    const selected = [...photos.files];
    for (const [index, file] of selected.entries()) {
      const item = document.createElement('div');
      item.className = 'review-preview-item';
      const image = document.createElement('img');
      const url = URL.createObjectURL(file);
      previewUrls.push(url);
      image.src = url;
      image.alt = file.name;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'review-preview-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', file.name + ' 첨부 취소');
      remove.addEventListener('click', () => {
        const transfer = new DataTransfer();
        selected.forEach((candidate, i) => { if (i !== index) transfer.items.add(candidate); });
        photos.files = transfer.files;
        form.dataset.dirty = 'true';
        renderPhotoPreviews();
      });
      item.append(image, remove);
      previews.append(item);
    }
  }
  function updateCounter() {
    counter.textContent = body.value.length.toLocaleString('ko-KR') + ' / 2,000';
  }
  body.addEventListener('input', updateCounter);
  form.addEventListener('oibung-review-photo-reset', () => {
    revokeUrls();
    previews.replaceChildren();
  });
  form.addEventListener('oibung-review-loaded', updateCounter);
  photos.addEventListener('change', () => {
    const selection = [...photos.files];
    if (selection.length > 3) {
      const transfer = new DataTransfer();
      selection.slice(0, 3).forEach(file => transfer.items.add(file));
      photos.files = transfer.files;
      $('review-status').textContent = '한 번에 최대 3장까지 선택할 수 있습니다.';
    }
    renderPhotoPreviews();
  });
  form.addEventListener('input', () => { form.dataset.dirty = 'true'; });
  form.addEventListener('change', () => { form.dataset.dirty = 'true'; });
  function confirmClose() {
    return form.dataset.dirty !== 'true' || window.confirm('작성 중인 후기가 있습니다. 저장하지 않고 닫을까요?');
  }
  $('close-review').addEventListener('click', event => {
    if (!confirmClose()) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  reviewDialog.addEventListener('click', event => {
    if (event.target === reviewDialog && !confirmClose()) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  reviewDialog.addEventListener('cancel', event => {
    if (!confirmClose()) event.preventDefault();
  });
  reviewDialog.addEventListener('close', () => {
    form.dataset.dirty = 'false';
    revokeUrls();
    previews.replaceChildren();
    updateCounter();
  });
  // A programmatic reset does not emit an input event.
  form.addEventListener('reset', () => {
    form.dataset.dirty = 'false';
    revokeUrls();
    previews.replaceChildren();
    queueMicrotask(updateCounter);
  });
  updateCounter();
})();
