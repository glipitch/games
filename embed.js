const gameFile = location.pathname.split('/').pop();
document.documentElement.dataset.game = location.pathname.includes('/sudoku/') ? 'sudoku' : gameFile === 'play.html' ? new URLSearchParams(location.search).get('game') : ({ 'circuit.html': 'circuit', 'spider.html': 'spider', 'index.html': 'snapword' }[gameFile] || 'snapword');
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelector('.mode-tabs');
  if (!tabs) return;
  const bar = tabs.closest('.play-card-top,.game-top,.card-top');
  if (!bar) return;
  const note = document.createElement('p');
  note.className = 'mode-explanation';
  note.id = 'mode-explanation';
  bar.after(note);
  tabs.setAttribute('aria-describedby', note.id);
  function describe() {
    const free = tabs.querySelector('#free[aria-pressed="true"],#practice-mode[aria-pressed="true"]');
    note.innerHTML = free ? '<strong>Free play</strong> · Extra puzzles at your pace. Your daily progress stays saved.' : '<strong>Daily</strong> · The same puzzle for everyone. New at midnight, London time.';
  }
  new MutationObserver(describe).observe(tabs, { attributes: true, subtree: true, attributeFilter: ['aria-pressed'] });
  describe();
});
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
    history.replaceState = (...args) => { replace(...args); const params = new URL(location.href).searchParams; send({ type: 'games:variant', variant: params.get('variant') || 'classic', size: params.get('size'), seed: params.get('seed') }); };
  }
}
