/*
 * Oibung Gallery — five persistable exhibition rooms.
 * Apply the saved theme in the document head to prevent a flash of the default.
 * Keeps the original storage key so existing stone/wood preferences survive.
 */
(() => {
  'use strict';
  const key = 'oibung-gallery:room-theme';
  const root = document.documentElement;
  const colors = Object.freeze({
    stone: '#c6c0b8',
    wood: '#4a3527',
    space: '#090f23',
    temple: '#bca982',
    deepsea: '#041c28'
  });
  const validTheme = value => Object.hasOwn(colors, value);
  let theme = 'stone';
  try {
    const stored = window.localStorage.getItem(key);
    if (validTheme(stored)) theme = stored;
  } catch { /* Browsers can deny storage; selection still works in this page. */ }

  function apply() {
    root.dataset.galleryTheme = theme;
    const picker = document.getElementById('gallery-theme-select');
    if (picker) picker.value = theme;
    const browserColor = document.querySelector('meta[name="theme-color"]');
    if (browserColor) browserColor.setAttribute('content', colors[theme]);
  }

  // This script runs before body markup; establish palette without flickering.
  apply();

  function setup() {
    const picker = document.getElementById('gallery-theme-select');
    if (!picker) return;
    apply();
    picker.addEventListener('change', () => {
      if (!validTheme(picker.value)) return;
      theme = picker.value;
      apply();
      try { window.localStorage.setItem(key, theme); }
      catch { /* Ephemeral theme change if storage is disabled. */ }
    });
  }

  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    theme = validTheme(event.newValue) ? event.newValue : 'stone';
    apply();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})();
