import { chromium } from 'playwright';
import { mkdir, readFile, writeFile, readdir, access } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = resolve('test-results/datasets');
const sources = {
  wicht: { repository: 'wichtounet/sudoku_dataset', revision: '0db6de036b80b4e8e4574abe6e15026331bd5c2c', license: 'CC-BY-4.0', split: 'v2_test (all 40 photos)' },
  armand: { repository: 'ArmandNM/sudoku-vision', revision: '9dbb391cf54784a3a76d43a237c6a2d3a3f5007d', split: 'all five classic photos; three have occupancy labels' },
  holdout: { repository: 'wichtounet/sudoku_dataset', revision: '0db6de036b80b4e8e4574abe6e15026331bd5c2c', license: 'CC-BY-4.0', split: '20 additional annotated photos, evenly selected by filename before evaluating automatic recognition; tests/fixtures/holdout.json' },
};
const exists = async path => { try { await access(path); return true; } catch { return false; } };
async function download(source, path, destination) {
  if (await exists(destination)) return;
  const response = await fetch(`https://raw.githubusercontent.com/${source.repository}/${source.revision}/${path}`);
  if (!response.ok) throw new Error(`Dataset download failed: ${response.status} ${path}`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}
await mkdir(resolve(root, 'wicht'), { recursive: true }); await mkdir(resolve(root, 'armand'), { recursive: true });
await mkdir(resolve(root, 'holdout'), { recursive: true });
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
for (const file of JSON.parse(await readFile('tests/fixtures/holdout.json', 'utf8'))) {
  for (const suffix of ['jpg', 'dat']) await download(sources.holdout, 'images/' + file.replace('.jpg', '.' + suffix), resolve(root, 'holdout', file.replace('.jpg', '.' + suffix)));
  const label = await readFile(resolve(root, 'holdout', file.replace('.jpg', '.dat')), 'utf8');
  const board = label.split(/\r?\n/).filter(line => /^\s*\d(?:\s+\d){8}\s*$/.test(line)).flatMap(line => line.trim().split(/\s+/).map(Number));
  assert.equal(board.length, 81, 'Invalid holdout label: ' + file);
  cases.push({ id: 'holdout/' + file, file: resolve(root, 'holdout', file), board, corners: outlines.get(file) });
}
const detectionOnly = process.argv.includes('--detect-only'), reportPath = resolve(process.argv.find(arg => arg.startsWith('--report='))?.slice(9) || resolve(root, 'report.json'));
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7).split(',');
const selectedCases = only ? cases.filter(item => only.some(id => basename(item.file) === id + '.jpg')) : cases;
assert.ok(selectedCases.length, 'No matching dataset cases');
const referenceMode = process.argv.includes('--reference');
const manifest = JSON.parse(await readFile('tests/baselines/recognition.json', 'utf8'));
const frozenVision = await readFile('tests/baselines/vision-12da1d4.js');
assert.equal(createHash('sha256').update(frozenVision).digest('hex'), manifest.referenceVisionSha256, 'Frozen reference implementation changed');
if (!only) assert.deepEqual(cases.map(item => item.id).sort(), manifest.cases.map(item => item.id).sort(), 'Dataset membership changed');
const referencePath = resolve(root, 'reference-report.json');
let reference;
if (!referenceMode) {
  console.log('Running frozen scanner 12da1d4 in the same browser before comparing accuracy.');
  execFileSync(process.execPath, ['tests/datasets.mjs', '--reference', '--report=' + referencePath, ...(only ? ['--only=' + only.join(',')] : []), ...(detectionOnly ? ['--detect-only'] : [])], { stdio: 'inherit' });
  reference = JSON.parse(await readFile(referencePath, 'utf8'));
}
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
const environment = { platform: process.platform, browser: browser.version() };
if (reference) assert.deepEqual(environment, reference.environment, 'Reference and candidate browsers differ');
const visionPath = referenceMode ? 'tests/baselines/vision-12da1d4.js' : process.argv.find(arg => arg.startsWith('--vision='))?.slice(9) || 'vision.js';
const visionSource = await readFile(visionPath, 'utf8');
const automaticSource = await readFile('automatic.js'), solverSource = await readFile('solver.js');
const page = await browser.newPage();
if (visionPath !== 'vision.js') await page.route('**/vision.js', route => route.fulfill({ contentType: 'text/javascript', body: visionSource }));
// The application imports vision.js during navigation, so overrides must precede it.
await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173/');
const rows = [];
try {
  for (const item of selectedCases) {
    const data = (await readFile(item.file)).toString('base64');
    const row = await page.evaluate(async ({ data, truth, corners, occupancy, detectionOnly, referenceMode }) => {
      const { assessFrame, detectCorners, rectify, recognize } = await import('./vision.js');
      const { automaticCandidate } = await import('./automatic.js');
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
        const grid = rectify(c, selected), ocr = await recognize(grid, () => {}, new AbortController().signal, { verify: true });
        row.readMs = Math.round(performance.now() - readStart);
        const { solve } = await import('./solver.js'), solveStart = performance.now(); solve(ocr.board); row.solveMs = performance.now() - solveStart;
        row.board = ocr.board; row.uncertain = [...ocr.uncertain];
        row.orientation = ocr.orientation;
        row.confidence = ocr.confidence; row.verified = ocr.verified;
        const automatic = result.valid && automaticCandidate(ocr);
        row.automaticEligible = !!automatic;
        if (truth && automatic) { const expected = solve(truth); row.automaticCorrect = expected.kind === 'unique' && automatic.solution.every((n, i) => n === expected.solution[i]); }
        if (truth) {
          row.exact = ocr.board.every((n, i) => n === truth[i]); row.correctClues = truth.filter((n, i) => n && ocr.board[i] === n).length; row.clues = truth.filter(Boolean).length;
          row.falseClues = truth.filter((n, i) => !n && ocr.board[i]).length;
        }
        if (occupancy) { row.occupancyCorrect = occupancy.filter((n, i) => n === Boolean(ocr.board[i])).length; row.occupancyExact = row.occupancyCorrect === 81; }
        if (result.valid && !referenceMode) {
          const sequenceStart = performance.now();
          row.automaticSequenceAccepted = !!automatic;
          if (truth && automatic) row.automaticSequenceCorrect = row.automaticCorrect;
          for (let frame = 2; frame <= 3; frame++) {
            const shifted = Object.assign(document.createElement('canvas'), { width: 900, height: 900 }), ctx = shifted.getContext('2d');
            ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 900, 900);
            ctx.drawImage(grid, frame === 2 ? .65 : -.65, frame === 2 ? -.45 : .45);
            const next = await recognize(shifted, () => {}, new AbortController().signal, { verify: true });
            const accepted = automaticCandidate(next);
            if (accepted) {
              row.automaticSequenceAccepted = true;
              if (truth) { const expected = solve(truth); row.automaticSequenceCorrect = (row.automaticSequenceCorrect ?? true) && expected.kind === 'unique' && accepted.solution.every((n, i) => n === expected.solution[i]); }
            }
          }
          row.sequenceMs = Math.round(performance.now() - sequenceStart);
        }
      } catch (error) { row.error = error.message; if (truth) { row.exact = false; row.correctClues = 0; row.clues = truth.filter(Boolean).length; } }
      return row;
    }, { data, truth: item.board, corners: item.corners, occupancy: item.occupancy, detectionOnly, referenceMode });
    rows.push({ id: item.id, ...row });
    console.log(`${rows.length}/${selectedCases.length} ${item.id}: grid=${row.gridMatched ?? row.ready} ready=${row.ready}${detectionOnly ? '' : ` exact=${row.exact ?? row.occupancyExact ?? 'unlabelled'}`}`);
  }
} finally { await browser.close(); }
const labelled = rows.filter(row => /^(wicht|holdout)\//.test(row.id)), occupancy = rows.filter(row => row.occupancyCorrect !== undefined);
const summary = {
  photos: rows.length, annotatedCorners: labelled.filter(row => row.cornerError !== null).length,
  matchedGrids: labelled.filter(row => row.gridMatched).length, readyFrames: rows.filter(row => row.ready).length,
  ...(detectionOnly ? {} : { exactBoards: labelled.filter(row => row.exact).length, correctClues: labelled.reduce((sum, row) => sum + row.correctClues, 0), totalClues: labelled.reduce((sum, row) => sum + row.clues, 0), falseClues: labelled.reduce((sum, row) => sum + (row.falseClues || 0), 0), occupancyExact: occupancy.filter(row => row.occupancyExact).length, occupancyLabelled: occupancy.length }),
  ...(detectionOnly ? {} : { automaticEligible: labelled.filter(row => row.automaticEligible).length, wrongAutomaticSolutions: labelled.filter(row => row.automaticEligible && !row.automaticCorrect).length }),
  ...(detectionOnly ? {} : { automaticSequencesAccepted: labelled.filter(row => row.automaticSequenceAccepted).length, wrongAutomaticSequenceSolutions: labelled.filter(row => row.automaticSequenceAccepted && !row.automaticSequenceCorrect).length }),
};
const sourceHash = source => createHash('sha256').update(source.toString().replace(/\r\n/g, '\n')).digest('hex');
await writeFile(reportPath, JSON.stringify({ baseRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), environment, referenceSummary: reference?.summary, referenceVisionSha256: manifest.referenceVisionSha256, sourceHashLineEndings: 'LF', visionSha256: sourceHash(visionSource), automaticSha256: sourceHash(automaticSource), solverSha256: sourceHash(solverSource), sources, summary, rows }, null, 2) + '\n');
console.log(JSON.stringify(summary)); console.log('Report: ' + reportPath);
if (referenceMode) process.exit(0);
const baseline = { cases: reference.rows }, regressions = [];
for (const row of rows) {
  const previous = baseline.cases.find(item => item.id === row.id), truth = cases.find(item => item.id === row.id)?.board;
  assert.ok(previous, 'Missing regression baseline for ' + row.id);
  if (previous.gridMatched && !row.gridMatched) regressions.push(row.id + ': lost grid detection');
  if (previous.ready && !row.ready) regressions.push(row.id + ': lost camera readiness');
  if (detectionOnly) continue;
  if (truth) truth.forEach((n, i) => {
    if (Number(previous.board[i]) === n && row.board?.[i] !== n) regressions.push(`${row.id}: previously correct cell ${i + 1} changed`);
  });
  if (previous.occupancyExact && !row.occupancyExact) regressions.push(row.id + ': lost correct occupancy map');
  if (row.automaticEligible && truth && !row.automaticCorrect) regressions.push(row.id + ': WRONG automatic solution');
  if (row.automaticSequenceAccepted && truth && !row.automaticSequenceCorrect) regressions.push(row.id + ': WRONG automatic sequence solution');
}
assert.deepEqual(regressions, [], 'Dataset accuracy regression:\n' + regressions.join('\n'));
console.log(`Dataset accuracy gate passed (${rows.length} photos; zero wrong automatic solutions on labelled photos).`);
