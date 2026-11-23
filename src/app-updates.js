const AppUpdates = (() => {
  'use strict';

  function start({ canReload = () => true, onWaiting = () => {}, onReload = () => {} } = {}) {
    if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
    let registration;
    let pending = false;
    let reloading = false;
    let preparing = false;
    let controlled = Boolean(navigator.serviceWorker.controller);
    async function apply() {
      if (!pending || reloading || preparing) return;
      if (!canReload()) { onWaiting(); return; }
      preparing = true;
      try {
        if (await onReload() === false || !canReload()) return;
        reloading = true;
        location.reload();
      } catch {}
      finally { preparing = false; }
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // La primera instalación no necesita volver a cargar el mismo código.
      if (!controlled) { controlled = true; return; }
      pending = true;
      apply();
    });
    async function check() {
      if (document.hidden || navigator.onLine === false) return;
      try { await registration?.update(); } catch {}
      apply();
    }
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(value => { registration = value; check(); }).catch(() => {});
    window.addEventListener('online', check);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    const checkTimer = setInterval(check, 60000);
    const applyTimer = setInterval(apply, 1000);
    window.addEventListener('pagehide', () => {
      clearInterval(checkTimer);
      clearInterval(applyTimer);
    }, { once: true });
  }

  return { start };
})();
