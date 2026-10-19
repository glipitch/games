if (window.parent !== window) {
  document.documentElement.classList.add('embedded');
  const send = data => parent.postMessage(data, location.origin);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin) return;
    const file = url.pathname.split('/').pop();
    const ids = { 'index.html': 'snapword', '': 'snapword', 'spider.html': 'spider', 'circuit.html': 'circuit' };
    if (file === 'games.html') { event.preventDefault(); send({ type: 'games:index' }); }
    else if (ids[file] || file === 'play.html') { event.preventDefault(); send({ type: 'games:navigate', id: file === 'play.html' ? url.searchParams.get('game') : ids[file] }); }
  });
  if (location.pathname.endsWith('/circuit.html')) {
    const replace = history.replaceState.bind(history);
    history.replaceState = (...args) => { replace(...args); send({ type: 'games:variant', variant: new URL(location.href).searchParams.get('variant') || 'classic' }); };
  }
}
