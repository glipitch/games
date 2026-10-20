import assert from 'node:assert/strict';
import { chromium } from '../sudoku/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { newGame } from '../snapword/dist/spider-engine.js';
const base = process.env.TEST_URL || 'http://127.0.0.1:4173/games/';
const output = new URL('../test-results/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
const reports = [];
try {
  for (const theme of ['light', 'dark']) for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }, { width: 844, height: 390 }, { width: 740, height: 320 }, { width: 768, height: 1024 }]) {
    const context = await browser.newContext({ viewport, colorScheme: theme });
    const page = await context.newPage();
    const errors = [], failed = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failed.push(response.status() + ' ' + response.url()); });
    page.on('request', request => { const url = request.url(); if (!url.startsWith(new URL(base).origin) && !url.startsWith('blob:') && !url.startsWith('data:')) external.push(url); });
    await page.goto(base);
    assert.equal(await page.title(), 'games');
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
    await page.evaluate(async () => { await document.fonts.load('500 16px "DM Sans"'); await document.fonts.load('750 16px Manrope'); });
    assert.ok(await page.evaluate(() => document.fonts.check('500 16px "DM Sans"') && document.fonts.check('750 16px Manrope')), 'Local fonts are loaded');
    if (viewport.width > 900) {
      const original = (await page.locator('#game-frame').boundingBox()).width;
      await page.locator('#sidebar-toggle').click();
      assert.ok((await page.locator('#game-frame').boundingBox()).width > original + 100, 'Collapsing makes more room for games');
      await page.reload();
      assert.equal(await page.locator('#sidebar-toggle').getAttribute('aria-expanded'), 'false');
      await page.locator('#sidebar-toggle').click();
      await page.locator('#modes-help').click();
      assert.ok((await page.locator('#modes-dialog').innerText()).includes('midnight in London'));
      await page.locator('#close-modes').click();
      await page.locator('#theme-toggle').click();
      await page.reload();
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme === 'dark' ? 'light' : 'dark');
      await page.locator('#theme-toggle').click();
    }
    assert.equal(await page.locator('nav a').count(), 10);
    const ids = await page.locator('nav a').evaluateAll(links => links.map(link => link.dataset.game));
    for (const id of ids) {
      if (id === 'spider') await page.evaluate(state => {
        localStorage.setItem('clicks:spider:v1', JSON.stringify({state,history:[],elapsed:0}));
        localStorage.setItem('clicks:spider:view', JSON.stringify({wide:true,scale:2.5}));
      }, newGame(42));
      if (viewport.width > 900) await page.locator(`[data-game="${id}"]`).click();
      else await page.locator('#game-picker').selectOption(id);
      await page.waitForFunction(id => location.hash.slice(1).split('/')[0] === id, id);
      await page.waitForFunction(id => document.querySelector('nav [aria-current]')?.dataset.game === id, id);
      await page.waitForFunction(() => {
        const iframe = document.querySelector('#game-frame');
        const expected = new URL(iframe.src), actual = new URL(iframe.contentWindow.location.href);
        return actual.pathname === expected.pathname && actual.searchParams.get('game') === expected.searchParams.get('game')
          && (!expected.searchParams.has('variant') || actual.searchParams.get('variant') === expected.searchParams.get('variant'))
          && iframe.contentDocument.readyState === 'complete';
      });
      const frame = page.frameLocator('#game-frame');
      await frame.locator('html.embedded').waitFor().catch(error=>{throw new Error(`${id} failed to embed in ${theme} ${viewport.width}×${viewport.height}: ${errors.join('; ')} ${failed.join('; ')}`,{cause:error});});
      assert.equal(await frame.locator('html').getAttribute('data-theme'), theme);
      await frame.locator(id === 'sudoku' ? '#camera' : id === 'snapword' ? '#play-area button' : id === 'spider' ? '.card' : id === 'circuit' ? '.tile' : '#game-content button').first().waitFor();
      assert.equal(await page.locator('nav [aria-current]').getAttribute('data-game'), id);
      const overflow = await frame.locator('body').evaluate(body => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: body.scrollWidth }));
      assert.ok(overflow.document <= overflow.width + 1, `${id} overflows at ${viewport.width}: ${JSON.stringify(overflow)}`);
      await frame.locator('body').evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].filter(image => image.getClientRects().length).map(image => image.decode()));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      await page.screenshot({ path: new URL(`${theme}-${viewport.width}x${viewport.height}-${id}.png`, output).pathname.replace(/^\/([A-Za-z]:)/, '$1'), fullPage: true });
      if (id === 'circuit') {
        await frame.locator('#variants button').nth(1).click();
        await page.waitForFunction(() => location.hash.startsWith('#circuit/wrap/'));
        assert.equal(await frame.locator('#variant-badge').innerText(), 'Wrap');
        await frame.locator('#board button[aria-disabled="false"]').first().click();
        assert.equal(await frame.locator('#moves').innerText(), '1');
        await frame.locator('#undo').click();
        assert.equal(await frame.locator('#moves').innerText(), '0');
      }
      if (id === 'flip') {
        await frame.locator('#game-content button').first().click();
        await frame.locator('#undo').click();
      }
      if (id === 'spider') {
        const columns = await frame.locator('.column').evaluateAll(columns => columns.map(c => ({left:c.getBoundingClientRect().left,right:c.getBoundingClientRect().right,width:c.getBoundingClientRect().width})));
        const width = (await page.locator('#game-frame').boundingBox()).width;
        assert.equal(columns.length, 10);
        assert.ok(columns.every(c => c.left >= 0 && c.right <= width + 1 && c.width >= 24), 'All ten usable columns fit without horizontal scrolling');
        await frame.locator('#deal').click();
        assert.equal(await frame.locator('#deal-label').innerText(), 'Deal · 4 left');
        await frame.locator('#undo').click();
        assert.equal(await frame.locator('#deal-label').innerText(), 'Deal · 5 left');
        await frame.locator('#hint').click();
        const target = await frame.locator('.hint-target').getAttribute('data-column');
        await frame.locator('.hint-source').click();
        await frame.locator(`.column[data-column="${target}"] .card`).last().click();
        assert.equal(await frame.locator('#moves').innerText(), '1', 'Tap selection moves the hinted run');
        await frame.locator('#undo').click();
        assert.equal(await frame.locator('#moves').innerText(), '0');
        if (viewport.width === 390) {
          const before = await frame.locator('.card').evaluateAll(cards => cards.map(card => card.dataset.cardId));
          await page.setViewportSize({width:844,height:390});
          await page.waitForFunction(() => {
            const body = document.querySelector('#game-frame').contentDocument;
            const board = body.querySelector('#board'), scroll = body.querySelector('.table-scroll');
            return Math.abs(board.getBoundingClientRect().width - scroll.clientWidth) < 2;
          });
          assert.deepEqual(await frame.locator('.card').evaluateAll(cards => cards.map(card => card.dataset.cardId)),before,'Rotation preserves the deal');
          await page.setViewportSize(viewport);
        }
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
        if (viewport.width === 390 && theme === 'light') {
          await frame.locator('#photo').setInputFiles(new URL('../sudoku/tests/fixtures/sudoku.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
          await frame.locator('#read').waitFor({ state: 'visible' });
          await frame.locator('#read').click();
          await frame.locator('#scan-dialog').waitFor({ state: 'hidden', timeout: 90000 });
          assert.equal(await frame.locator('#status').innerText(), 'Solved.', 'Bundled photo scanner works inside the collection');
          await page.screenshot({ path: new URL('390-sudoku-photo.png', output).pathname.replace(/^\/([A-Za-z]:)/, '$1'), fullPage: true });
        }
      }
      if (!['spider', 'sudoku', 'circuit'].includes(id)) {
        assert.ok((await frame.locator('#mode-explanation').innerText()).includes('midnight'));
        await frame.locator(id === 'snapword' ? '#practice-mode' : '#free').click();
        await frame.locator('#mode-explanation').filter({hasText:'Your daily progress stays saved'}).waitFor();
        await frame.locator(id === 'snapword' ? '#daily-mode' : '#daily').click();
      }
    }
    assert.deepEqual(errors, [], 'Browser errors');
    assert.deepEqual(failed, [], 'Failed assets');
    assert.deepEqual(external, [], 'Fonts and game assets stay on the same origin');
    await page.locator('.skip').focus();
    await page.locator('.skip').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'game');
    assert.ok(page.url().endsWith('#weave'), 'Skipping navigation keeps the selected game');
    reports.push({ theme, viewport, games: ids.length, browserErrors: errors, failedAssets: failed });
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
  console.log('All ten games passed in light and dark themes across desktop, tablet, portrait and landscape, including fitted Spider columns, fonts and controls.');
} finally { await browser.close(); }
