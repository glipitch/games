(() => {
  const query = matchMedia('(prefers-color-scheme: dark)');
  const stored = () => { try { return localStorage.getItem('games:theme'); } catch { return null; } };
  function apply(theme) {
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101820' : '#edf1f4');
    window.dispatchEvent(new Event('games:theme'));
  }
  window.gamesTheme = {
    set(theme) { try { localStorage.setItem('games:theme', theme); } catch {} apply(theme); },
    get() { return document.documentElement.dataset.theme; }
  };
  apply(stored() || (query.matches ? 'dark' : 'light'));
  window.addEventListener('storage', e => { if (e.key === 'games:theme') apply(e.newValue || (query.matches ? 'dark' : 'light')); });
  query.addEventListener('change', () => { if (!stored()) apply(query.matches ? 'dark' : 'light'); });
  window.addEventListener('message', e => {
    if (e.origin === location.origin && e.source === parent && e.data?.type === 'games:theme') apply(e.data.theme);
  });
})();
