import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = await readFile(option('vision') || 'vision.js', 'utf8');
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
const page = await browser.newPage();
await page.route('**/vision.js', route => route.fulfill({ contentType: 'text/javascript', body: source }));
const ocrLibrary = await readFile('vendor/tesseract.min.js', 'utf8');
await page.route('**/vendor/tesseract.min.js', route => route.fulfill({ contentType: 'text/javascript', body: ocrLibrary + `
  const create = Tesseract.createWorker;
  Tesseract.createWorker = async (...args) => {
    const start = performance.now(), worker = await create(...args);
    window.ocrMetrics.setupMs += performance.now() - start;
    const recognize = worker.recognize;
    worker.recognize = (...args) => { window.ocrMetrics.calls++; return recognize(...args); };
    return worker;
  };` }));
await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173/');
await page.evaluate(() => { window.ocrMetrics = { calls: 0, setupMs: 0 }; });
const throttle = Number(option('cpu') || 1);
if (throttle > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: throttle });
const fixtures = ['tests/fixtures/sudoku.png', 'test-results/datasets/wicht/v2_test/image18.jpg', 'test-results/datasets/wicht/v2_test/image1041.jpg'];
const rows = [];
try {
  for (const file of fixtures) {
    const data = (await readFile(file)).toString('base64');
    for (let repeat = 0; repeat < 2; repeat++) {
      const row = await page.evaluate(async ({ data, repeat }) => {
        const vision = await import('./vision.js'), { solve } = await import('./solver.js');
        const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode();
        const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
        const c = Object.assign(document.createElement('canvas'), { width: Math.round(image.width * scale), height: Math.round(image.height * scale) }); c.getContext('2d').drawImage(image, 0, 0, c.width, c.height);
        const start = performance.now(), corners = vision.detectCorners(c), grid = vision.rectify(c, corners), detectionMs = performance.now() - start;
        const before = { ...window.ocrMetrics }, readStart = performance.now();
        const result = await vision.recognize(grid, () => {}, new AbortController().signal), readMs = performance.now() - readStart;
        const solveStart = performance.now(); let solved; for (let i = 0; i < 100; i++) solved = solve(result.board);
        return { repeat, detectionMs, readMs, solveMs: (performance.now() - solveStart) / 100, kind: solved.kind, calls: window.ocrMetrics.calls - before.calls, setupMs: window.ocrMetrics.setupMs - before.setupMs, board: result.board, orientation: result.orientation, uncertain: [...result.uncertain] };
      }, { data, repeat });
      rows.push({ file, ...row }); console.log(file, repeat, JSON.stringify({ readMs: Math.round(row.readMs), solveMs: row.solveMs, calls: row.calls, setupMs: Math.round(row.setupMs) }));
    }
  }
} finally { await browser.close(); }
await mkdir('test-results', { recursive: true });
const report = resolve(option('report') || 'test-results/performance.json');
await writeFile(report, JSON.stringify({ cpuThrottle: throttle, visionSha256: createHash('sha256').update(source).digest('hex'), rows }, null, 2) + '\n');
console.log('Report:', report);
