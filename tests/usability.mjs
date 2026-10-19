import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
const baseURL = process.env.TEST_URL || 'http://127.0.0.1:4173/';
const expected = '000604700706000009000005080070020093800000005430010070050200000300000208002301000';
try {
  // A failed model download used to throw inside Tesseract without settling its
  // startup promise. Exercise that real failure and retry in the same screen.
  const context = await browser.newContext({ viewport: { width: 390, height: 700 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/vendor/data/**', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto(baseURL);
  await page.locator('#photo').setInputFiles('tests/fixtures/sudoku.png');
  await page.locator('#read').click();
  await page.waitForFunction(() => /Try again/.test(document.getElementById('scan-status').textContent) && !document.getElementById('read').disabled, null, { timeout: 15000 });
  assert.equal(await page.locator('#scan-dialog').evaluate(el => el.open), true);
  assert.equal(await page.locator('#rotate').isEnabled(), true);
  assert.equal(await page.locator('#retake').isEnabled(), true);
  assert.equal(await page.locator('#scan-dialog').getAttribute('aria-busy'), null);
  await page.unroute('**/vendor/data/**');
  await page.locator('#read').click();
  await page.waitForFunction(() => !document.getElementById('scan-dialog').open, null, { timeout: 30000 });
  assert.equal(await page.locator('#status').textContent(), 'Solved.');
  await page.locator('#undo').click();
  assert.equal(await page.locator('.cell').evaluateAll(cells => cells.map(c => c.value || '0').join('')), expected);
  assert.deepEqual(errors, []);
  await context.close();
  console.log('Failed scanner download shows an error and retries successfully without reopening the photo.');

  const stalledContext = await browser.newContext({ viewport: { width: 390, height: 640 } });
  const stalled = await stalledContext.newPage(), held = [], stalledErrors = [];
  stalled.on('pageerror', error => stalledErrors.push(error.message));
  // Hold the library request: the real loading promise never settles until the
  // deadline. Advancing the browser clock keeps this regression check fast.
  await stalled.route('**/vendor/tesseract.min.js', route => { held.push(route); });
  await stalled.clock.install();
  await stalled.goto(baseURL);
  await stalled.locator('#photo').setInputFiles('tests/fixtures/sudoku.png');
  await stalled.locator('#read').click();
  await stalled.waitForFunction(() => document.getElementById('read').textContent === 'Loading scanner…');
  assert.equal(await stalled.locator('#scan-dialog').getAttribute('aria-busy'), 'true');
  assert.equal(await stalled.locator('#read').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight), true);
  await stalled.clock.fastForward(45001);
  await stalled.waitForFunction(() => !document.getElementById('read').disabled);
  assert.match(await stalled.locator('#scan-status').textContent(), /too long.*try again/i);
  assert.equal(await stalled.locator('#scan-dialog').getAttribute('aria-busy'), null);
  assert.equal(await stalled.locator('#close-scan').isEnabled(), true);
  await Promise.all(held.map(route => route.continue()));
  await stalled.unroute('**/vendor/tesseract.min.js');
  await stalled.locator('#read').click();
  await stalled.waitForFunction(() => !document.getElementById('scan-dialog').open, null, { timeout: 30000 });
  assert.equal(await stalled.locator('#status').textContent(), 'Solved.');

  // A portrait photo must keep the action and its progress on a phone screen.
  const portrait = await stalled.evaluate(() => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 500, height: 1600 });
    canvas.getContext('2d').fillRect(0, 0, 500, 1600);
    return canvas.toDataURL().split(',')[1];
  });
  await stalled.locator('#photo').setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: Buffer.from(portrait, 'base64') });
  assert.equal(await stalled.locator('#read').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight), true);
  await stalled.locator('#read').click();
  await stalled.waitForFunction(() => !document.getElementById('read').disabled);
  assert.match(await stalled.locator('#scan-status').textContent(), /No digits|Could not read/);
  await stalled.locator('#close-scan').click();
  await stalled.locator('#clear').click();
  await stalled.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
      const canvas = Object.assign(document.createElement('canvas'), { width: 640, height: 640 });
      canvas.getContext('2d').fillRect(0, 0, 640, 640);
      return canvas.captureStream(12);
    } });
  });
  await stalled.locator('#camera').click();
  await stalled.waitForFunction(() => !document.getElementById('capture').disabled, null, { timeout: 2000 });
  await stalled.locator('#capture').click();
  assert.equal(await stalled.locator('#crop').isVisible(), true, 'an undetected grid cannot lock out manual capture');
  await stalled.locator('#read').click();
  await stalled.waitForFunction(() => !document.getElementById('read').disabled);
  assert.match(await stalled.locator('#scan-status').textContent(), /No digits|Could not read/);
  assert.deepEqual(stalledErrors, []);
  await stalledContext.close();
  console.log('Stalled startup times out, exposes retry, and recovers; phone photo controls stay visible.');

  const readingContext = await browser.newContext();
  const reading = await readingContext.newPage(), readingErrors = [];
  reading.on('pageerror', error => readingErrors.push(error.message));
  await reading.addInitScript(() => {
    let engine;
    Object.defineProperty(window, 'Tesseract', { configurable: true, get: () => engine, set: value => {
      engine = value;
      const create = value.createWorker;
      value.createWorker = async (...args) => {
        const worker = await create(...args);
        if (!window.stalledReadOnce) {
          window.stalledReadOnce = true;
          worker.recognize = () => new Promise(() => {});
          const terminate = worker.terminate;
          worker.terminate = () => { window.stalledReadTerminated = true; return terminate(); };
        }
        return worker;
      };
    } });
  });
  await reading.clock.install(); await reading.goto(baseURL);
  await reading.locator('#photo').setInputFiles('tests/fixtures/sudoku.png');
  await reading.locator('#read').click();
  await reading.waitForFunction(() => document.getElementById('scan-status').textContent === 'Checking orientation…');
  await reading.clock.fastForward(60001);
  await reading.waitForFunction(() => !document.getElementById('read').disabled);
  assert.match(await reading.locator('#scan-status').textContent(), /Reading took too long/);
  await reading.clock.fastForward(501);
  await reading.waitForFunction(() => window.stalledReadTerminated);
  await reading.locator('#read').click();
  await reading.waitForFunction(() => !document.getElementById('scan-dialog').open, null, { timeout: 30000 });
  assert.equal(await reading.locator('#status').textContent(), 'Solved.');
  assert.deepEqual(readingErrors, []);
  await readingContext.close();
  console.log('A stalled OCR job times out, releases its worker, and solves correctly on retry.');
} finally { await browser.close(); }
