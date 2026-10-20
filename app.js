const games = [
  { id: 'circuit', name: 'Circuit', symbol: '⌁', path: 'library/circuit.html' },
  { id: 'flip', name: 'Flip', symbol: '☼', path: 'library/play.html?game=flip' },
  { id: 'quartet', name: 'Quartet', symbol: '▦', path: 'library/play.html?game=quartet' },
  { id: 'shift', name: 'Shift', symbol: '⇢', path: 'library/play.html?game=shift' },
  { id: 'slide', name: 'Slide', symbol: '▧', path: 'library/play.html?game=slide' },
  { id: 'snapword', name: 'Snapword', symbol: '↔', path: 'library/index.html' },
  { id: 'spider', name: 'Spider', symbol: '♠', path: 'library/spider.html' },
  { id: 'sudoku', name: 'sudoku', symbol: '▤', path: 'sudoku/' },
  { id: 'twentyfour', name: 'Twenty Four', symbol: '24', path: 'library/play.html?game=twentyfour' },
  { id: 'weave', name: 'Weave', symbol: '⋈', path: 'library/play.html?game=weave' }
];
const nav = document.querySelector('#game-index');
const frame = document.querySelector('#game-frame');
const gameMenu = document.querySelector('#game-menu');
const gamesToggle = document.querySelector('#games-toggle');
nav.innerHTML = games.map(g => `<a href="#${g.id}" data-game="${g.id}" title="${g.name}" aria-label="${g.name}"><span class="symbol" aria-hidden="true">${g.symbol}</span><span class="nav-label">${g.name}</span></a>`).join('');
let current = '';
function show() {
  const [id, variant, size, seed] = location.hash.slice(1).split('/');
  const game = games.find(g => g.id === id) || games[0];
  const selectedVariant = game.id === 'circuit' && ['classic', 'wrap', 'locked', 'split', 'mesh', 'barriers'].includes(variant) ? variant : '';
  const selectedSize = selectedVariant && /^(?:[3-9]|10)$/.test(size) ? size : '';
  const selectedSeed = selectedSize && /^\d{1,10}$/.test(seed) && Number(seed) <= 0xffffffff ? seed : '';
  const route = game.id + (selectedVariant ? '/' + selectedVariant : '') + (selectedSize ? '/' + selectedSize : '') + (selectedSeed ? '/' + selectedSeed : '');
  for (const link of nav.children) {
    if (link.dataset.game === game.id) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  frame.title = game.name;
  document.title = 'games';
  if (route !== current) {
    current = route;
    const query = new URLSearchParams();
    if (selectedVariant) query.set('variant', selectedVariant);
    if (selectedSize) query.set('size', selectedSize);
    if (selectedSeed) query.set('seed', selectedSeed);
    frame.src = './' + game.path + (selectedVariant ? '?' + query : '');
  }
}
gamesToggle.addEventListener('click', () => gameMenu.showModal());
document.querySelector('#close-games').addEventListener('click', () => gameMenu.close());
nav.addEventListener('click', event => { if (event.target.closest('a')) gameMenu.close(); });
gameMenu.addEventListener('click', event => {
  if (event.target !== gameMenu) return;
  const bounds = gameMenu.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) gameMenu.close();
});
const themeToggle = document.querySelector('#theme-toggle');
function themeLabel() {
  const dark = window.gamesTheme.get() === 'dark';
  themeToggle.setAttribute('aria-pressed', String(dark));
  themeToggle.setAttribute('aria-label', dark ? 'Use light mode' : 'Use dark mode');
  themeToggle.title = dark ? 'Use light mode' : 'Use dark mode';
  themeToggle.querySelector('.nav-label').textContent = dark ? 'Light mode' : 'Dark mode';
  frame.contentWindow?.postMessage({ type: 'games:theme', theme: window.gamesTheme.get() }, location.origin);
}
themeToggle.addEventListener('click', () => window.gamesTheme.set(window.gamesTheme.get() === 'dark' ? 'light' : 'dark'));
window.addEventListener('games:theme', themeLabel);
frame.addEventListener('load', themeLabel);
themeLabel();
const modesDialog = document.querySelector('#modes-dialog');
document.querySelector('#modes-help').addEventListener('click', () => { gameMenu.close(); modesDialog.showModal(); });
document.querySelector('#close-modes').addEventListener('click', () => modesDialog.close());
document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  document.querySelector('#game').focus();
});
window.addEventListener('hashchange', show);
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
  if (event.data?.type === 'games:navigate' && games.some(g => g.id === event.data.id)) location.hash = event.data.id;
  if (event.data?.type === 'games:index') {
    gameMenu.showModal();
    nav.querySelector('[aria-current]')?.focus();
  }
  if (event.data?.type === 'games:variant' && current.startsWith('circuit') && (!location.hash || location.hash.slice(1).split('/')[0] === 'circuit') && ['classic', 'wrap', 'locked', 'split', 'mesh', 'barriers'].includes(event.data.variant)) {
    const size = Number(event.data.size), seed = event.data.seed;
    current = 'circuit/' + event.data.variant + (Number.isInteger(size) && size >= 3 && size <= 10 ? '/' + size : '');
    if (seed !== null && /^\d{1,10}$/.test(seed) && Number(seed) <= 0xffffffff) current += '/' + seed;
    history.replaceState(null, '', '#' + current);
  }
});
show();
