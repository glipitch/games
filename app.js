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
const picker = document.querySelector('#game-picker');
const frame = document.querySelector('#game-frame');
nav.innerHTML = games.map(g => `<a href="#${g.id}" data-game="${g.id}"><span class="symbol" aria-hidden="true">${g.symbol}</span>${g.name}</a>`).join('');
picker.innerHTML = games.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
let current = '';
function show() {
  const [id, variant] = location.hash.slice(1).split('/');
  const game = games.find(g => g.id === id) || games[0];
  const selectedVariant = game.id === 'circuit' && ['classic', 'wrap', 'locked', 'split'].includes(variant) ? variant : '';
  const route = game.id + (selectedVariant ? '/' + selectedVariant : '');
  for (const link of nav.children) {
    if (link.dataset.game === game.id) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  picker.value = game.id;
  frame.title = game.name;
  document.title = 'games';
  if (route !== current) {
    current = route;
    frame.src = './' + game.path + (selectedVariant ? '?variant=' + selectedVariant : '');
  }
}
picker.addEventListener('change', () => { location.hash = picker.value; });
document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  document.querySelector('#game').focus();
});
window.addEventListener('hashchange', show);
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
  if (event.data?.type === 'games:navigate' && games.some(g => g.id === event.data.id)) location.hash = event.data.id;
  if (event.data?.type === 'games:index') {
    (matchMedia('(max-width:640px)').matches ? picker : nav.querySelector('[aria-current]')).focus();
  }
  if (event.data?.type === 'games:variant' && current.startsWith('circuit') && ['classic', 'wrap', 'locked', 'split'].includes(event.data.variant)) {
    current = 'circuit/' + event.data.variant;
    history.replaceState(null, '', '#' + current);
  }
});
show();
