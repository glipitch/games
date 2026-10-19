import assert from 'node:assert/strict';
import { chromium } from '../sudoku/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.TEST_URL || 'http://127.0.0.1:4173/games/';
const output = new URL('../test-results/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
const reports = [];
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [], failed = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failed.push(response.status() + ' ' + response.url()); });
    await page.goto(base);
    assert.equal(await page.title(), 'games');
    assert.equal(await page.locator('nav a').count(), 10);
    const ids = await page.locator('nav a').evaluateAll(links => links.map(link => link.dataset.game));
    for (const id of ids) {
      if (viewport.width > 640) await page.locator(`[data-game="${id}"]`).click();
      else await page.locator('#game-picker').selectOption(id);
      await page.waitForFunction(id => location.hash === '#' + id, id);
      const frame = page.frameLocator('#game-frame');
      await frame.locator('html.embedded').waitFor();
      await frame.locator(id === 'sudoku' ? '#camera' : id === 'snapword' ? '#play-area button' : id === 'spider' ? '.card' : id === 'circuit' ? '.tile' : '#game-content button').first().waitFor();
      assert.equal(await page.locator('nav [aria-current]').getAttribute('data-game'), id);
      const overflow = await frame.locator('body').evaluate(body => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: body.scrollWidth }));
      assert.ok(overflow.document <= overflow.width + 1, `${id} overflows at ${viewport.width}: ${JSON.stringify(overflow)}`);
      await frame.locator('body').evaluate(async () => {
        await Promise.all([...document.images].map(image => image.decode()));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      await page.screenshot({ path: new URL(`${viewport.width}-${id}.png`, output).pathname.replace(/^\/([A-Za-z]:)/, '$1'), fullPage: true });
      if (id === 'circuit') {
        await frame.locator('#variants button').nth(1).click();
        await page.waitForFunction(() => location.hash === '#circuit/wrap');
        assert.equal(await frame.locator('#variant-badge').innerText(), 'Wrap');
        await frame.locator('#board button').first().click();
        assert.equal(await frame.locator('#moves').innerText(), '1');
        await frame.locator('#undo').click();
        assert.equal(await frame.locator('#moves').innerText(), '0');
      }
      if (id === 'flip') {
        await frame.locator('#game-content button').first().click();
        await frame.locator('#undo').click();
      }
      if (id === 'spider') {
        await frame.locator('#deal').click();
        assert.equal(await frame.locator('#deal-label').innerText(), 'Deal · 4 left');
        await frame.locator('#undo').click();
        assert.equal(await frame.locator('#deal-label').innerText(), 'Deal · 5 left');
      }
      if (id === 'sudoku') {
        await frame.locator('#board').evaluate(el => {
          const data = new DataTransfer();
          data.setData('text/plain', '530070000600195000098000060800060003400803001700020006060000280000419005000080079');
          el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
        });
        await frame.locator('#solve').click();
        assert.equal((await frame.locator('.cell').evaluateAll(cells => cells.map(cell => cell.value).join(''))).length, 81);
        assert.ok(await frame.locator('.cell.answer').count() > 0);
        await page.screenshot({ path: new URL(`${viewport.width}-sudoku-solved.png`, output).pathname.replace(/^\/([A-Za-z]:)/, '$1'), fullPage: true });
        if (viewport.width === 390) {
          await frame.locator('#photo').setInputFiles(new URL('../sudoku/tests/fixtures/sudoku.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
          await frame.locator('#read').waitFor({ state: 'visible' });
          await frame.locator('#read').click();
          await frame.locator('#scan-dialog').waitFor({ state: 'hidden', timeout: 90000 });
          assert.equal(await frame.locator('#status').innerText(), 'Solved.', 'Bundled photo scanner works inside the collection');
          await page.screenshot({ path: new URL('390-sudoku-photo.png', output).pathname.replace(/^\/([A-Za-z]:)/, '$1'), fullPage: true });
        }
      }
    }
    assert.deepEqual(errors, [], 'Browser errors');
    assert.deepEqual(failed, [], 'Failed assets');
    reports.push({ viewport, games: ids.length, browserErrors: errors, failedAssets: failed });
    // A refresh and browser history must preserve a direct game link.
    await page.goto(base + '#circuit/split');
    await page.frameLocator('#game-frame').locator('.tile').first().waitFor();
    assert.equal(await page.frameLocator('#game-frame').locator('#variant-badge').innerText(), 'Split');
    await page.reload();
    await page.frameLocator('#game-frame').locator('.tile').first().waitFor();
    assert.equal(await page.frameLocator('#game-frame').locator('#variant-badge').innerText(), 'Split');
    await context.close();
  }
  await writeFile(new URL('site-report.json', output), JSON.stringify({ base, reports }, null, 2));
  console.log('All ten games passed at desktop, phone and narrow phone widths, with working controls and deep links.');
} finally { await browser.close(); }
