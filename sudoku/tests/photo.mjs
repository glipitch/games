import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const file = process.env.TEST_PHOTO, expected = process.env.TEST_EXPECTED;
if (!file || !/^[0-9]{81}$/.test(expected || '')) throw new Error('Set TEST_PHOTO to a local image and TEST_EXPECTED to its 81 digits (0 for blanks).');
const baseURL = process.env.TEST_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
const page = await browser.newPage(), external = [];
page.on('request', request => { if (!request.url().startsWith(baseURL) && !/^(data|blob):/.test(request.url())) external.push(request.url()); });
try {
  await page.goto(baseURL);
  async function readAndCheck() {
    await page.locator('#read').click();
    await page.waitForFunction(() => !document.getElementById('scan-dialog').open || !document.getElementById('read').disabled, null, { timeout: 180000 });
    if (await page.locator('#undo').isVisible()) await page.locator('#undo').click();
    assert.equal(await page.locator('.cell').evaluateAll(cells => cells.map(cell => cell.value || '0').join('')), expected);
    await page.locator('#solve').click(); assert.equal(await page.locator('#status').textContent(), 'Solved.');
  }
  await page.locator('#photo').setInputFiles(file); await readAndCheck();
  console.log('Photo import: all 81 cells correct; puzzle solved.');
  if (process.env.TEST_CAMERA_CROP) {
    await page.locator('#clear').click();
    const crop = process.env.TEST_CAMERA_CROP.split(',').map(Number);
    if (crop.length !== 4 || crop.some(n => !Number.isFinite(n))) throw new Error('TEST_CAMERA_CROP must be x,y,width,height in original pixels.');
    const preview = await page.evaluate(async ({ data, crop }) => {
      const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode();
      const c = Object.assign(document.createElement('canvas'), { width: 960, height: 960 });
      c.getContext('2d').drawImage(image, ...crop, 0, 0, 960, 960);
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
        const stream = c.captureStream(12), track = stream.getVideoTracks()[0];
        const timer = setInterval(() => {
          if (track.readyState === 'ended') clearInterval(timer);
          else { c.getContext('2d').drawImage(image, ...crop, 0, 0, 960, 960); track.requestFrame(); }
        }, 80);
        return stream;
      } });
      const frame = Object.assign(document.createElement('canvas'), { width: 640, height: 640 }); frame.getContext('2d').drawImage(c, 0, 0, 640, 640);
      const { assessFrame } = await import('./vision.js'); return assessFrame(frame);
    }, { data: (await readFile(file)).toString('base64'), crop });
    console.log('Camera precheck:', preview.message, JSON.stringify(preview.corners));
    await page.locator('#camera').click();
    if (process.env.TEST_AUTOMATIC === '1') {
      const start = Date.now();
      try { await page.waitForFunction(() => !document.getElementById('scan-dialog').open, null, { timeout: 20000 }); }
      catch (error) { console.error(await page.locator('#scan-status').textContent()); throw error; }
      assert.equal(await page.locator('#status').textContent(), 'Solved.');
      await page.locator('#undo').click();
      assert.equal(await page.locator('.cell').evaluateAll(cells => cells.map(cell => cell.value || '0').join('')), expected);
      console.log(`Automatic camera solve: all 81 original cells correct (${Date.now() - start} ms).`);
    } else {
      try { await page.waitForFunction(() => !document.getElementById('capture').disabled, null, { timeout: 10000 }); }
      catch {
        const state = await page.locator('#video').evaluate(v => ({ width: v.videoWidth, height: v.videoHeight, ready: v.readyState, paused: v.paused, stream: v.srcObject?.active, tracks: v.srcObject?.getTracks().map(t => t.readyState) }));
        throw new Error('Camera capture blocked: ' + await page.locator('#scan-status').textContent() + ' ' + JSON.stringify(state));
      }
      await page.locator('#capture').click();
      await page.locator('#crop').screenshot({ path: 'test-results/reported-camera-crop.png' });
      await readAndCheck();
      console.log('Camera framing and capture: all 81 cells correct; puzzle solved.');
    }
  }
  assert.deepEqual(external, []);
} finally { await browser.close(); }
