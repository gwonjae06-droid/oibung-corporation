/*
 * OIBUNG GALLERY — exactly two user-selected appearance modes.
 * Default: the existing light stone museum. No random or timed switching.
 * Applying the stored preference in <head> avoids a visible first-frame flash.
 */
(() => {
  'use strict';
  const key = 'oibung-gallery:display-mode';
  const modes = new Set(['light','dark']);
  const root = document.documentElement;

  function storedMode() {
    try {
      const value = window.localStorage.getItem(key);
      return modes.has(value) ? value : 'light';
    } catch {
      return 'light';
    }
  }

  function apply(mode, persist = false) {
    if (!modes.has(mode)) return;
    root.dataset.galleryMode = mode;
    for (const button of document.querySelectorAll('[data-gallery-mode-choice]')) {
      const chosen = button.dataset.galleryModeChoice === mode;
      button.setAttribute('aria-pressed', String(chosen));
    }
    const color = document.querySelector('meta[name="theme-color"]');
    if (color) color.setAttribute('content', mode === 'dark' ? '#050607' : '#c6c0b8');
    if (persist) {
      try { window.localStorage.setItem(key, mode); }
      catch { /* Mode remains usable in private browsing. */ }
    }
  }

  apply(storedMode());
  function setup() {
    apply(root.dataset.galleryMode || 'light');
    document.querySelectorAll('[data-gallery-mode-choice]').forEach(button => {
      button.addEventListener('click', () => apply(button.dataset.galleryModeChoice, true));
    });
  }
  window.addEventListener('storage', event => {
    if (event.key === key) apply(modes.has(event.newValue) ? event.newValue : 'light');
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else setup();
})();
