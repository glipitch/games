import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
const page = await browser.newPage(), errors = [];
await page.addInitScript(() => {
  const NativeWorker = window.Worker;
  window.scannerWorkers = 0;
  window.Worker = class extends NativeWorker {
    constructor(...args) { super(...args); window.scannerWorkers++; }
  };
});
page.on('pageerror', error => errors.push(error.message));
await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173/');
try {
  const result = await page.evaluate(async () => {
    const { recognize, rectify, detectCorners, prepareScanner } = await import('./vision.js');
    const image = new Image(); image.src = './tests/fixtures/sudoku.png'; await image.decode();
    const source = Object.assign(document.createElement('canvas'), { width: image.width, height: image.height }); source.getContext('2d').drawImage(image, 0, 0);
    const grid = rectify(source, detectCorners(source));
    const rows = [], cancelled = []; let startupWorkers;
    // Cancelling during engine startup must settle and allow a fresh scan.
    for (const phase of ['Loading scanner…', 'Checking orientation…', 'Reading the numbers…']) {
      const controller = new AbortController();
      try {
        await Promise.race([
          recognize(grid, (_, text) => { if (text === phase) setTimeout(() => controller.abort(), 0); }, controller.signal),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Cancellation did not settle')), 10000)),
        ]);
        cancelled.push('not cancelled');
      } catch (error) { cancelled.push(error.name); }
      await prepareScanner();
      if (phase === 'Loading scanner…') startupWorkers = window.scannerWorkers;
    }
    // Reuse one warm worker across all orientations, including upside down.
    for (let turns = 0; turns < 4; turns++) {
      const c = Object.assign(document.createElement('canvas'), { width: 900, height: 900 }), ctx = c.getContext('2d');
      ctx.translate(450, 450); ctx.rotate(turns * Math.PI / 2); ctx.drawImage(grid, -450, -450);
      const result = await recognize(c, () => {}, new AbortController().signal);
      rows.push({ board: result.board.join(''), orientation: result.orientation });
    }
    return { rows, cancelled, startupWorkers };
  });
  assert.deepEqual(result.cancelled, ['AbortError', 'AbortError', 'AbortError']);
  assert.equal(result.startupWorkers, 1, 'taking a photo while the engine loads must preserve its warmup');
  for (const row of result.rows) assert.equal(row.board, '000604700706000009000005080070020093800000005430010070050200000300000208002301000');
  assert.deepEqual(result.rows.map(row => row.orientation), [0, 3, 2, 1]);
  assert.deepEqual(errors, []);
  console.log('Cancellation during startup/orientation/reading, retry, warm reuse and all four rotations passed.');
} finally { await browser.close(); }
