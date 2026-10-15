import { chromium } from 'playwright';
import { mkdir, readFile, writeFile, readdir, access } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve('test-results/datasets');
const sources = {
  wicht: { repository: 'wichtounet/sudoku_dataset', revision: '0db6de036b80b4e8e4574abe6e15026331bd5c2c', license: 'CC-BY-4.0', split: 'v2_test (all 40 photos)' },
  armand: { repository: 'ArmandNM/sudoku-vision', revision: '9dbb391cf54784a3a76d43a237c6a2d3a3f5007d', split: 'all five classic photos; three have occupancy labels' },
};
const exists = async path => { try { await access(path); return true; } catch { return false; } };
async function download(source, path, destination) {
  if (await exists(destination)) return;
  const response = await fetch(`https://raw.githubusercontent.com/${source.repository}/${source.revision}/${path}`);
  if (!response.ok) throw new Error(`Dataset download failed: ${response.status} ${path}`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}
await mkdir(resolve(root, 'wicht'), { recursive: true }); await mkdir(resolve(root, 'armand'), { recursive: true });
await download(sources.wicht, 'outlines_sorted.csv', resolve(root, 'wicht-outlines.csv'));
if (!(await exists(resolve(root, 'wicht/v2_test/image1005.jpg')))) {
  const archive = resolve(root, 'v2_test.tar.bz2'); await download(sources.wicht, 'datasets/v2_test.tar.bz2', archive);
  const names = execFileSync('tar', ['-tjf', archive], { encoding: 'utf8' }).trim().split(/\r?\n/);
  if (names.some(name => !/^v2_test\/image\d+\.(jpg|dat)$/.test(name))) throw new Error('Unexpected dataset archive path');
  execFileSync('tar', ['-xjf', archive, '-C', resolve(root, 'wicht')]);
}
const armandPaths = ['train/classic/1.jpg', 'train/classic/1_gt.txt', 'train/classic/4.jpg', 'train/classic/4_gt.txt', 'train/classic/9.jpg', 'train/classic/9_gt.txt', 'test/classic/3.jpg', 'test/classic/25.jpg'];
await Promise.all(armandPaths.map(path => download(sources.armand, 'datasets/' + path, resolve(root, 'armand/datasets_' + path.replaceAll('/', '_')))));
const outlines = new Map((await readFile(resolve(root, 'wicht-outlines.csv'), 'utf8')).trim().split(/\r?\n/).slice(1).map(line => {
  const [path, ...numbers] = line.split(','), values = numbers.map(Number);
  return [basename(path), Array.from({ length: 4 }, (_, i) => ({ x: values[i * 2], y: values[i * 2 + 1] }))];
}));
const cases = [];
for (const file of (await readdir(resolve(root, 'wicht/v2_test'))).filter(file => file.endsWith('.jpg')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
  const label = await readFile(resolve(root, 'wicht/v2_test', file.replace('.jpg', '.dat')), 'utf8');
  const board = label.split(/\r?\n/).filter(line => /^\s*\d(?:\s+\d){8}\s*$/.test(line)).flatMap(line => line.trim().split(/\s+/).map(Number));
  if (board.length !== 81) throw new Error(`Invalid dataset label: ${file}`);
  cases.push({ id: 'wicht/' + file, file: resolve(root, 'wicht/v2_test', file), board, corners: outlines.get(file) });
}
for (const path of armandPaths.filter(path => path.endsWith('.jpg'))) {
  const label = resolve(root, 'armand/datasets_' + path.replaceAll('/', '_').replace('.jpg', '_gt.txt'));
  const occupancy = await exists(label) ? [...(await readFile(label, 'utf8')).replace(/\s/g, '')].map(x => x === 'x') : null;
  cases.push({ id: 'armand/' + path, file: resolve(root, 'armand/datasets_' + path.replaceAll('/', '_')), occupancy });
}
const detectionOnly = process.argv.includes('--detect-only'), reportPath = resolve(process.argv.find(arg => arg.startsWith('--report='))?.slice(9) || resolve(root, 'report.json'));
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7).split(',');
const selectedCases = only ? cases.filter(item => only.some(id => basename(item.file) === id + '.jpg')) : cases;
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
const visionPath = process.argv.find(arg => arg.startsWith('--vision='))?.slice(9) || 'vision.js';
const visionSource = await readFile(visionPath, 'utf8');
const page = await browser.newPage();
if (visionPath !== 'vision.js') await page.route('**/vision.js', route => route.fulfill({ contentType: 'text/javascript', body: visionSource }));
// The application imports vision.js during navigation, so overrides must precede it.
await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173/');
const rows = [];
try {
  for (const item of selectedCases) {
    const data = (await readFile(item.file)).toString('base64');
    const row = await page.evaluate(async ({ data, truth, corners, occupancy, detectionOnly }) => {
      const { assessFrame, detectCorners, rectify, recognize } = await import('./vision.js');
      const image = new Image(); image.src = 'data:image/jpeg;base64,' + data; await image.decode();
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height)), c = Object.assign(document.createElement('canvas'), { width: Math.round(image.width * scale), height: Math.round(image.height * scale) });
      c.getContext('2d').drawImage(image, 0, 0, c.width, c.height);
      const start = performance.now(), result = assessFrame(c), selected = detectCorners(c);
      let cornerError = null;
      if (corners) {
        const gt = corners.map(p => ({ x: p.x * scale, y: p.y * scale }));
        const edge = gt.reduce((sum, p, i) => sum + Math.hypot(p.x - gt[(i + 1) % 4].x, p.y - gt[(i + 1) % 4].y), 0) / 4;
        cornerError = Math.max(...gt.map(p => Math.min(...selected.map(q => Math.hypot(p.x - q.x, p.y - q.y))))) / edge;
      }
      const row = { ready: result.valid, message: result.message, corners: selected, cornerError, gridMatched: cornerError === null ? null : cornerError <= .05, detectionMs: Math.round(performance.now() - start) };
      if (detectionOnly) return row;
      try {
        const readStart = performance.now();
        const ocr = await recognize(rectify(c, selected), () => {}, new AbortController().signal);
        row.readMs = Math.round(performance.now() - readStart);
        const { solve } = await import('./solver.js'), solveStart = performance.now(); solve(ocr.board); row.solveMs = performance.now() - solveStart;
        row.board = ocr.board; row.uncertain = [...ocr.uncertain];
        row.orientation = ocr.orientation;
        if (truth) {
          row.exact = ocr.board.every((n, i) => n === truth[i]); row.correctClues = truth.filter((n, i) => n && ocr.board[i] === n).length; row.clues = truth.filter(Boolean).length;
          row.falseClues = truth.filter((n, i) => !n && ocr.board[i]).length;
        }
        if (occupancy) { row.occupancyCorrect = occupancy.filter((n, i) => n === Boolean(ocr.board[i])).length; row.occupancyExact = row.occupancyCorrect === 81; }
      } catch (error) { row.error = error.message; if (truth) { row.exact = false; row.correctClues = 0; row.clues = truth.filter(Boolean).length; } }
      return row;
    }, { data, truth: item.board, corners: item.corners, occupancy: item.occupancy, detectionOnly });
    rows.push({ id: item.id, ...row });
    console.log(`${rows.length}/${selectedCases.length} ${item.id}: grid=${row.gridMatched ?? row.ready} ready=${row.ready}${detectionOnly ? '' : ` exact=${row.exact ?? row.occupancyExact ?? 'unlabelled'}`}`);
  }
} finally { await browser.close(); }
const labelled = rows.filter(row => row.id.startsWith('wicht/')), occupancy = rows.filter(row => row.occupancyCorrect !== undefined);
const summary = {
  photos: rows.length, annotatedCorners: labelled.filter(row => row.cornerError !== null).length,
  matchedGrids: labelled.filter(row => row.gridMatched).length, readyFrames: rows.filter(row => row.ready).length,
  ...(detectionOnly ? {} : { exactBoards: labelled.filter(row => row.exact).length, correctClues: labelled.reduce((sum, row) => sum + row.correctClues, 0), totalClues: labelled.reduce((sum, row) => sum + row.clues, 0), falseClues: labelled.reduce((sum, row) => sum + (row.falseClues || 0), 0), occupancyExact: occupancy.filter(row => row.occupancyExact).length, occupancyLabelled: occupancy.length }),
};
await writeFile(reportPath, JSON.stringify({ baseRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), visionSha256: createHash('sha256').update(visionSource).digest('hex'), sources, summary, rows }, null, 2) + '\n');
console.log(JSON.stringify(summary)); console.log('Report: ' + reportPath);
