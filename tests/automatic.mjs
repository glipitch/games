import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { solve } from '../solver.js';

const clues = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const expected = solve([...clues].map(Number)).solution.join('');
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const context = await browser.newContext({ permissions: ['camera'], viewport: { width: 390, height: 844 } });
const page = await context.newPage(), errors = [], rows = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173/');
try {
  await page.evaluate(async clues => {
    const { SnapshotQueue } = await import('./automatic.js'), push = SnapshotQueue.prototype.push, take = SnapshotQueue.prototype.take;
    window.snapshotEvents = [];
    SnapshotQueue.prototype.push = function(snapshot) {
      const admitted = push.call(this, snapshot);
      if (admitted) window.snapshotEvents.push({ type: 'captured', id: snapshot.id, mode: window.autoFeed.mode, pending: this.length });
      return admitted;
    };
    SnapshotQueue.prototype.take = function() {
      const snapshot = take.call(this);
      if (snapshot) window.snapshotEvents.push({ type: 'processing', id: snapshot.id, pending: this.length });
      return snapshot;
    };
    const frame = Object.assign(document.createElement('canvas'), { width: 960, height: 960 }), ctx = frame.getContext('2d');
    window.autoFeed = { mode: 'blank', frame, frames: 0 };
    function draw() {
      const { mode } = window.autoFeed; ctx.save(); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 960, 960);
      if (mode === 'photograph') ctx.drawImage(window.autoFeed.photograph, 0, 0, 960, 960);
      else if (mode !== 'blank') {
        if (mode === 'valid') ctx.translate(window.autoFeed.frames % 2 ? 1 : -1, window.autoFeed.frames % 3 - 1);
        if (mode === 'blurred') ctx.filter = 'blur(12px)';
        if (mode === 'cropped') { ctx.translate(-200, -200); ctx.scale(1.5, 1.5); }
        if (mode === 'turned') { ctx.translate(960, 0); ctx.rotate(Math.PI / 2); }
        ctx.strokeStyle = '#222';
        for (let i = 0; i <= 9; i++) {
          const p = 48 + i * 96; ctx.lineWidth = i % 3 ? 2 : 5; ctx.beginPath(); ctx.moveTo(p, 48); ctx.lineTo(p, 912); ctx.moveTo(48, p); ctx.lineTo(912, p); ctx.stroke();
        }
        ctx.font = '54px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#222';
        [...clues].forEach((n, i) => {
          if (n === '0') return;
          ctx.fillText(mode === 'conflict' && i === 1 ? 5 : n, 96 + i % 9 * 96, 96 + Math.floor(i / 9) * 96);
        });
      }
      ctx.restore(); window.autoFeed.frames++;
    }
    draw(); window.autoFeed.draw = draw;
    window.autoFeed.photograph = new Image(); window.autoFeed.photograph.src = './tests/fixtures/sudoku.png'; await window.autoFeed.photograph.decode();
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
      const stream = frame.captureStream(15), track = stream.getVideoTracks()[0]; window.autoFeed.track = track;
      const timer = setInterval(() => { if (track.readyState === 'ended') clearInterval(timer); else { draw(); track.requestFrame(); } }, 65);
      return stream;
    } });
  }, clues);
  const feed = mode => page.evaluate(mode => { window.autoFeed.mode = mode; window.autoFeed.draw(); }, mode);
  const unchanged = async () => { assert.equal(await page.locator('#scan-dialog').evaluate(el => el.open), true); assert.equal(await page.locator('.cell').evaluateAll(cells => cells.some(c => c.value)), false); };
  await page.locator('#camera').click();
  for (const mode of ['blank', 'blurred', 'cropped', 'conflict']) {
    await feed(mode);
    if (mode === 'conflict') await page.waitForFunction(() => window.snapshotEvents.filter(row => row.type === 'processing').length >= 4, null, { timeout: 15000 });
    else await page.waitForTimeout(1200);
    await unchanged(); rows.push({ mode, rejected: true });
  }
  const events = await page.evaluate(() => window.snapshotEvents);
  assert.ok(events.every(event => event.pending <= 2));
  const captured = events.filter(e => e.type === 'captured').map(e => e.id), processed = events.filter(e => e.type === 'processing').map(e => e.id);
  assert.deepEqual(processed, captured.slice(0, processed.length), 'all admitted photos are processed in capture order');
  console.log('Background capture continues; photos are processed in order, with at most two waiting.');
  // Explicit closure cancels work and permits immediate camera reopening.
  await page.locator('#close-scan').click(); await feed('blank'); await page.locator('#camera').click(); await page.waitForTimeout(700); await unchanged();
  // A photo already taken remains valid even when the live camera becomes blank.
  const start = Date.now(); await feed('valid');
  await page.waitForFunction(() => window.snapshotEvents.some(row => row.type === 'captured' && row.mode === 'valid'));
  await feed('blank'); await page.locator('#video').evaluate(video => video.pause());
  await page.waitForFunction(() => !document.getElementById('scan-dialog').open, null, { timeout: 20000 });
  assert.equal(await page.locator('#status').textContent(), 'Solved.');
  assert.equal(await page.locator('#result').isVisible(), true);
  assert.equal(await page.locator('#solve').isVisible(), false);
  assert.equal(await page.locator('.cell').evaluateAll(cells => cells.map(c => c.value || '0').join('')), expected);
  assert.equal(await page.evaluate(() => window.autoFeed.track.readyState), 'ended');
  rows.push({ mode: 'captured puzzle, then blank paused live view', solved: true, elapsedMs: Date.now() - start });
  await page.locator('#undo').click(); assert.equal(await page.locator('.cell').evaluateAll(cells => cells.map(c => c.value || '0').join('')), clues);
  for (const mode of ['turned', 'photograph']) {
    await page.locator('#clear').click(); await feed(mode); const start = Date.now(); await page.locator('#camera').click();
    await page.waitForFunction(() => !document.getElementById('scan-dialog').open, null, { timeout: 20000 });
    const original = mode === 'turned' ? clues : '000604700706000009000005080070020093800000005430010070050200000300000208002301000';
    assert.equal(await page.locator('.cell').evaluateAll(cells => cells.map(c => c.value || '0').join('')), solve([...original].map(Number)).solution.join(''));
    await page.locator('#undo').click(); assert.equal(await page.locator('.cell').evaluateAll(cells => cells.map(c => c.value || '0').join('')), original);
    rows.push({ mode, solved: true, elapsedMs: Date.now() - start });
  }
  await mkdir('test-results', { recursive: true }); await page.screenshot({ path: 'test-results/automatic-solved.png', fullPage: true });
  await writeFile('test-results/automatic.json', JSON.stringify(rows, null, 2) + '\n');
  assert.deepEqual(errors, []); console.log('Automatic camera tests passed:', JSON.stringify(rows));
} catch (error) { console.error(await page.evaluate(() => ({ status: document.getElementById('scan-status').textContent, events: window.snapshotEvents }))); throw error; }
finally { await browser.close(); }
