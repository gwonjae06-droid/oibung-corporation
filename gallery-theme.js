/*
 * Oibung Gallery — optional room palette.
 * Applies the saved choice before the page renders, then wires one header toggle.
 */
(() => {
  'use strict';
  const key = 'oibung-gallery:room-theme';
  const root = document.documentElement;
  let theme = 'stone';
  try {
    if (window.localStorage.getItem(key) === 'wood') theme = 'wood';
  } catch { /* Private browsing may disable storage; the toggle still works. */ }

  function apply() {
    const wood = theme === 'wood';
    root.dataset.galleryTheme = theme;
    const button = document.getElementById('gallery-theme-toggle');
    if (button) {
      button.setAttribute('aria-pressed', String(wood));
      button.setAttribute('title', wood ? '나무 테마 사용 중 · 누르면 회색 전시관으로 변경' : '누르면 나무 전시관으로 변경');
    }
    const color = document.querySelector('meta[name="theme-color"]');
    if (color) color.setAttribute('content', wood ? '#4a3527' : '#c6c0b8');
  }

  apply();

  function setup() {
    const button = document.getElementById('gallery-theme-toggle');
    if (!button) return;
    apply();
    button.addEventListener('click', () => {
      theme = theme === 'wood' ? 'stone' : 'wood';
      apply();
      try { window.localStorage.setItem(key, theme); }
      catch { /* Nonpersistent preference for the current page. */ }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})();
