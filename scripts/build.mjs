import { cp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const output = join(root, '_site');
if (output !== join(root, '_site')) throw Error('Unexpected build directory');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const name of ['index.html', 'sitemap.xml', 'style.css', 'app.js', 'icon.svg', 'fonts.css', 'theme.js', 'assets']) await cp(join(root, name), join(output, name), { recursive: true });
await writeFile(join(output, '.nojekyll'), '');
await cp(join(root, 'snapword/dist'), join(output, 'library'), { recursive: true });
await mkdir(join(output, 'sudoku'));
for (const name of ['index.html', 'style.css', 'app.js', 'automatic.js', 'solver.js', 'vision.js', 'icon.svg', 'vendor', 'LICENSE']) {
  await cp(join(root, 'sudoku', name), join(output, 'sudoku', name), { recursive: true });
}
for (const folder of ['library', 'sudoku']) {
  for (const name of ['embed.css', 'embed.js']) await cp(join(root, name), join(output, folder, name));
  for (const name of await readdir(join(output, folder))) {
    const file = join(output, folder, name);
    if (name.endsWith('.html')) {
      let html = await readFile(file, 'utf8');
      html = html.replace('<head>', '<head><script src="../theme.js?v=2"></script><link rel="stylesheet" href="../fonts.css?v=2">');
      const shared = '<link rel="stylesheet" href="./embed.css?v=5"><script src="./embed.js?v=4"></script>';
      html = name === 'circuit.html' ? html.replace('<link rel="icon"', shared + '<link rel="icon"') : html.replace('</head>', shared + '</head>');
      html = html.replaceAll('All 9 games', 'All games').replaceAll('all nine games', 'all games').replaceAll('9 games ↗', 'games ↗');
      await writeFile(file, html);
    }
    if (name.endsWith('.css')) {
      const css = (await readFile(file, 'utf8')).replace(/@import url\('https:\/\/fonts\.googleapis\.com[^']+'\);/g, '');
      await writeFile(file, css);
    }
  }
}
// Share links must include the GitHub Pages project path and the chosen game.
for (const [file, from, to] of [
  ['app.js', '${location.origin}${location.pathname}', '${new URL("../", location.href).href}#snapword'],
  ['arcade.js', '${location.origin}/play.html?game=${game.id}&v=6', '${new URL("../", location.href).href}#${game.id}'],
  ['circuit.js', "const url=new URL('./circuit.html',location.href);url.search=new URLSearchParams({variant,size,seed:board.seed});return url.href;", "const url=new URL('../',location.href);url.hash='circuit/'+variant+'/'+size+'/'+board.seed;return url.href;"]
]) {
  const path = join(output, 'library', file);
  const source = await readFile(path, 'utf8');
  if (!source.includes(from)) throw Error('Share link source changed: ' + file);
  await writeFile(path, source.replace(from, to));
}
await writeFile(join(output, 'library/games.html'), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=../"><title>games</title><a href="../">games</a>');
console.log('Built ten games into _site/.');
