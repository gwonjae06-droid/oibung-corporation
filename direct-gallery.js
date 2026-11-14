/* Small, explicit shortcuts for the direct game collection. No new catalog source. */
(() => {
  'use strict';
  const onReady = () => {
    document.getElementById('direct-review-shortcut')?.addEventListener('click', () => {
      document.getElementById('tab-reviews')?.click();
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady, {once:true});
  else onReady();
})();
