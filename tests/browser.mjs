import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });
import assert from 'node:assert/strict';


const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['camera'] });
const page = await context.newPage(), errors = [], external = [];
const baseURL = process.env.TEST_URL || 'http://127.0.0.1:4173/';
page.on('pageerror', e => errors.push(e.message));
page.on('request', req => { if (!req.url().startsWith(baseURL) && !req.url().startsWith('blob:') && !req.url().startsWith('data:')) external.push(req.url()); });
await page.goto(baseURL); await page.locator('.cell').last().waitFor();
assert.equal(await page.title(), 'sudoku');
await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
await page.locator('#board').evaluate(el => {
  const data = new DataTransfer(); data.setData('text/plain', '530070000600195000098000060800060003400803001700020006060000280000419005000080079');
  el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
});
await page.getByRole('button', { name: 'Solve', exact: true }).click();
assert.equal(await page.locator('#status').innerText(), 'Solved.');
assert.equal(await page.locator('.answer').count(), 51);
await page.getByRole('button', { name: 'Back to puzzle' }).click();
assert.equal(await page.locator('.cell').evaluateAll(cells => cells.filter(c => c.value).length), 30);
await page.locator('.cell').nth(1).fill('5');
assert.equal(await page.locator('.invalid').count(), 2);
await page.getByRole('button', { name: 'Solve', exact: true }).click();
assert.match(await page.locator('#status').innerText(), /repeat/);
await page.getByRole('button', { name: 'Clear', exact: true }).click();
await page.locator('.cell').nth(0).focus(); await page.keyboard.press('ArrowRight');
assert.equal(await page.locator('.cell').nth(1).evaluate(el => el === document.activeElement), true);
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
assert.equal(await page.evaluate(() => document.querySelector('main').getBoundingClientRect().bottom <= innerHeight), true);
await page.setViewportSize({ width: 320, height: 640 });
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
await page.setViewportSize({ width: 1440, height: 1000 });
const fixture = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = c.height = 1000; const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1000, 1000);
  ctx.strokeStyle = '#222';
  for (let i = 0; i <= 9; i++) { ctx.lineWidth = i % 3 === 0 ? 5 : 2; ctx.beginPath(); ctx.moveTo(50 + i * 100, 50); ctx.lineTo(50 + i * 100, 950); ctx.stroke(); ctx.beginPath(); ctx.moveTo(50, 50 + i * 100); ctx.lineTo(950, 50 + i * 100); ctx.stroke(); }
  ctx.font = '56px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#222';
  [...'530070000600195000098000060800060003400803001700020006060000280000419005000080079'].forEach((n, i) => { if (n !== '0') ctx.fillText(n, 100 + (i % 9) * 100, 100 + Math.floor(i / 9) * 100); });
  return c.toDataURL('image/png').split(',')[1];
});
await writeFile('test-results/printed-puzzle.png', Buffer.from(fixture, 'base64'));
// Supply actual changing video frames to the camera pipeline, not just a
// mocked detector: blank -> valid -> cropped -> blurred -> valid -> capture.
await page.evaluate(() => {
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
    window.testCamera = Object.assign(document.createElement('canvas'), { width: 960, height: 960 });
    const ctx = window.testCamera.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 960, 960);
    const stream = window.testCamera.captureStream(12); window.testCameraTrack = stream.getTracks()[0];
    setTimeout(() => window.testCameraTrack.requestFrame(), 0); return stream;
  } });
});
await page.getByRole('button', { name: 'Scan puzzle', exact: true }).click();
await page.waitForFunction(() => document.getElementById('scan-status').textContent.includes('9 × 9'));
assert.equal(await page.locator('#capture').isDisabled(), true);
async function cameraImage(mode = 'valid', data = fixture) {
  await page.evaluate(async ({ data, mode }) => {
    const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode();
    const ctx = window.testCamera.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 960, 960);
    ctx.filter = mode === 'blurred' ? 'blur(12px)' : 'none';
    if (mode === 'cropped') ctx.drawImage(image, -300, -300, 1560, 1560); else ctx.drawImage(image, 0, 0, 960, 960);
    ctx.filter = 'none';
  }, { data, mode });
}
await cameraImage(); await page.waitForFunction(() => !document.getElementById('capture').disabled);
assert.match(await page.locator('#scan-status').innerText(), /Grid ready/);
await page.screenshot({ path: 'test-results/camera-ready.png', fullPage: true });
await cameraImage('cropped'); await page.waitForFunction(() => document.getElementById('capture').disabled);
await cameraImage(); await page.waitForFunction(() => !document.getElementById('capture').disabled);
await cameraImage('blurred'); await page.waitForFunction(() => document.getElementById('capture').disabled);
await cameraImage(); await page.waitForFunction(() => !document.getElementById('capture').disabled);
await page.setViewportSize({ width: 390, height: 700 });
await page.screenshot({ path: 'test-results/camera-mobile.png', fullPage: true });
assert.equal(await page.locator('#capture').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight), true);
await page.getByRole('button', { name: 'Take photo' }).click();
assert.equal(await page.locator('#video').evaluate(el => el.srcObject), null);
assert.equal(await page.evaluate(() => window.testCameraTrack.readyState), 'ended');
await page.getByRole('button', { name: 'Close scanner' }).click();
await page.setViewportSize({ width: 1440, height: 1000 });
const scenes = await page.evaluate(async data => {
  const { makeScenes } = await import('./tests/scenes.js'); return makeScenes(data);
}, fixture);
const angles = await page.evaluate(async scenes => {
  const { assessFrame, detectCorners } = await import('./vision.js'), results = {};
  for (const [name, scene] of Object.entries(scenes)) {
    const image = new Image(); image.src = 'data:image/png;base64,' + scene.data; await image.decode();
    const c = Object.assign(document.createElement('canvas'), { width: 640, height: 640 }); c.getContext('2d').drawImage(image, 0, 0);
    const result = assessFrame(c), selected = detectCorners(c);
    const error = points => Math.max(...scene.corners[0].map(p => Math.min(...(points ?? []).map(q => Math.hypot(p.x - q.x, p.y - q.y)))));
    results[name] = { valid: result.valid, error: error(result.corners), photoError: error(selected) };
    if (name === 'two') {
      const other = assessFrame(c, { target: { x: 500 / 640, y: .5 } });
      results.tapped = { valid: other.valid, error: Math.max(...scene.corners[1].map(p => Math.min(...other.corners.map(q => Math.hypot(p.x - q.x, p.y - q.y))))) };
    }
  }
  return results;
}, scenes);
for (const [name, result] of Object.entries(angles)) {
  assert.equal(result.valid, true, `${name}: complete angled grid should be accepted`);
  assert.ok(result.error < 6, `${name}: selected physical corners, error ${result.error}`);
  if ('photoError' in result) assert.ok(result.photoError < 6, `${name}: photo selection`);
}
await page.getByRole('button', { name: 'Scan puzzle', exact: true }).click();
await page.waitForFunction(() => document.getElementById('scan-status').textContent.includes('9 × 9'));
await cameraImage('valid', scenes.two.captureData); await page.waitForFunction(() => !document.getElementById('capture').disabled);
const outlineCenter = () => page.locator('#camera-guide').evaluate(c => {
  const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height); let sum = 0, count = 0;
  for (let p = 0; p < data.length; p += 4) if (data[p] === 167 && data[p + 1] === 247 && data[p + 2] === 169) { sum += (p / 4) % c.width; count++; }
  return sum / count / c.width;
});
assert.ok(await outlineCenter() < .5, 'tracks the grid at the centre before tapping');
const finder = await page.locator('#viewfinder').boundingBox();
await page.locator('#viewfinder').click({ position: { x: finder.width * 500 / 640, y: finder.height / 2 } });
await page.waitForFunction(() => !document.getElementById('capture').disabled);
assert.ok(await outlineCenter() > .65, 'tap selects the other tilted grid');
await page.screenshot({ path: 'test-results/camera-two-grids.png', fullPage: true });
await page.getByRole('button', { name: 'Take photo' }).click();
for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Rotate', exact: false }).click();
await page.getByRole('button', { name: 'Read grid' }).click();
await page.waitForFunction(() => !document.getElementById('scan-dialog').open || !document.getElementById('read').disabled, null, { timeout: 180000 });
const otherPuzzle = [...'530070000600195000098000060800060003400803001700020006060000280000419005000080079'].map(n => n === '0' ? 0 : Number(n) % 9 + 1).join('');
assert.equal(await page.locator('.cell').evaluateAll(cells => cells.map(c => c.value || '0').join('')), otherPuzzle, 'capture and rotation keep the chosen grid');
const quality = await page.evaluate(async () => {
  const { assessFrame } = await import('./vision.js');
  const c = Object.assign(document.createElement('canvas'), { width: 640, height: 640 }), ctx = c.getContext('2d');
  const results = {};
  for (const divisions of [4, 6, 8, 9]) {
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 640, 640); ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
    for (let i = 0; i <= divisions; i++) { const p = 40 + i * 560 / divisions; ctx.beginPath(); ctx.moveTo(p, 40); ctx.lineTo(p, 600); ctx.moveTo(40, p); ctx.lineTo(600, p); ctx.stroke(); }
    if (divisions === 9) results.emptyGrid = assessFrame(c).valid;
    ctx.fillStyle = '#222'; ctx.font = '30px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let r = 0; r < divisions; r++) for (let col = 0; col < divisions; col++) if ((r + col) % 2 === 0) ctx.fillText('1', 40 + (col + .5) * 560 / divisions, 40 + (r + .5) * 560 / divisions);
    results[divisions] = assessFrame(c).valid;
  }
  const image = new Image(); image.src = './tests/fixtures/sudoku.png'; await image.decode(); ctx.drawImage(image, 0, 0, 640, 640);
  results.photo = assessFrame(c).valid;
  return results;
});
assert.deepEqual(quality, { 4: false, 6: false, 8: false, 9: true, emptyGrid: false, photo: true });
await page.locator('#photo').setInputFiles('test-results/printed-puzzle.png');
await page.locator('#read').waitFor({ state: 'visible' });
await page.screenshot({ path: 'test-results/crop.png', fullPage: true });
await page.getByRole('button', { name: 'Read grid' }).click();
await page.waitForFunction(() => !document.getElementById('scan-dialog').open || !document.getElementById('read').disabled, null, { timeout: 180000 });
console.log('Printed scan status:', await page.locator('#status').innerText(), await page.locator('#scan-status').innerText());
const scanned = await page.locator('.cell').evaluateAll(cells => cells.map(c => c.value || '0').join(''));
console.log('Printed scan:', scanned);
assert.equal(scanned, '530070000600195000098000060800060003400803001700020006060000280000419005000080079');
await page.getByRole('button', { name: 'Solve', exact: true }).click(); assert.equal(await page.locator('#status').innerText(), 'Solved.');
await page.locator('#photo').setInputFiles('tests/fixtures/sudoku.png'); await page.locator('#read').waitFor({ state: 'visible' });
await page.getByRole('button', { name: 'Read grid' }).click();
await page.waitForFunction(() => !document.getElementById('scan-dialog').open || !document.getElementById('read').disabled, null, { timeout: 180000 });
console.log('Photo scan status:', await page.locator('#status').innerText(), await page.locator('#scan-status').innerText());
assert.equal(await page.locator('.cell').evaluateAll(cells => cells.map(c => c.value || '0').join('')), '000604700706000009000005080070020093800000005430010070050200000300000208002301000');
await page.getByRole('button', { name: 'Solve', exact: true }).click(); assert.equal(await page.locator('#status').innerText(), 'Solved.');
await page.screenshot({ path: 'test-results/photo-result.png', fullPage: true });
console.log('Browser errors:', errors, 'External requests:', external);
assert.deepEqual(errors, []); assert.deepEqual(external, []);
await browser.close();
console.log('Browser verification passed.');
