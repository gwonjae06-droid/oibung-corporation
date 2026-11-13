/*
 * Oibung Gallery — five randomly selected exhibition rooms.
 * A fresh visit gets a different room from the previous visit where possible.
 * The room rotates once per hour while the page is open and visible.
 * User selection restarts the hour. Avoid changing rooms mid-edit.
 */
(() => {
  'use strict';
  const storageKey = 'oibung-gallery:room-theme';
  const rotationMs = 60 * 60 * 1000;
  const colors = Object.freeze({
    stone: '#c6c0b8',
    wood: '#4a3527',
    space: '#090f23',
    temple: '#bca982',
    deepsea: '#041c28'
  });
  const names = Object.keys(colors);
  const hasTheme = value => Object.prototype.hasOwnProperty.call(colors, value);
  const root = document.documentElement;

  function readPrevious() {
    try {
      const previous = window.localStorage.getItem(storageKey);
      return hasTheme(previous) ? previous : null;
    } catch {
      return null;
    }
  }

  function remember(value) {
    try { window.localStorage.setItem(storageKey, value); }
    catch { /* The room still changes if storage is unavailable. */ }
  }

  function randomExcept(previous) {
    const choices = names.filter(name => name !== previous);
    return choices[Math.floor(Math.random() * choices.length)];
  }

  let theme = randomExcept(readPrevious());
  let nextRotationAt = Date.now() + rotationMs;

  function renderTheme() {
    root.dataset.galleryTheme = theme;
    const picker = document.getElementById('gallery-theme-select');
    if (picker) picker.value = theme;
    const browserColor = document.querySelector('meta[name="theme-color"]');
    if (browserColor) browserColor.setAttribute('content', colors[theme]);
  }

  function changeTheme(next) {
    if (!hasTheme(next) || next === theme) return;
    theme = next;
    remember(theme);
    // Native view transitions provide a restrained crossfade where supported.
    // On older browsers or with reduced motion, switch without effects.
    const reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof document.startViewTransition === 'function' && !reduceMotion) {
      try { document.startViewTransition(() => renderTheme()); }
      catch { renderTheme(); }
    } else {
      renderTheme();
    }
  }

  function busyViewingOrEditing() {
    if (document.visibilityState === 'hidden') return true;
    if (document.querySelector('dialog[open]')) return true;
    const focused = document.activeElement;
    return !!(focused && focused.id !== 'gallery-theme-select' &&
      focused.matches('input, textarea, select, [contenteditable="true"]'));
  }

  function rotateIfDue() {
    if (Date.now() < nextRotationAt || busyViewingOrEditing()) return;
    nextRotationAt = Date.now() + rotationMs;
    changeTheme(randomExcept(theme));
  }

  // In-head script sets the initial room before body and styles are painted.
  renderTheme();
  remember(theme);

  function setup() {
    const picker = document.getElementById('gallery-theme-select');
    if (picker) {
      renderTheme();
      picker.addEventListener('change', () => {
        if (!hasTheme(picker.value)) return;
        nextRotationAt = Date.now() + rotationMs;
        changeTheme(picker.value);
      });
    }

    // Compare wall-clock deadlines: throttled tabs won't accumulate rotations.
    window.setInterval(rotateIfDue, 15000);
    document.addEventListener('visibilitychange', rotateIfDue);
    window.addEventListener('focus', rotateIfDue);
    document.addEventListener('close', rotateIfDue, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})();
