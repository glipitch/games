import assert from 'node:assert/strict';
import {chromium} from '../sudoku/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {variants,sizes,makeCircuit,dailyCircuit,applyTurn} from '../snapword/dist/circuit-engine.js';

const base=process.env.TEST_URL||'http://127.0.0.1:4173/games/';
const output=new URL('../test-results/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
const reports=[];
try{
 for(const viewport of [{width:1440,height:1000},{width:1280,height:720},{width:390,height:844},{width:320,height:740},{width:844,height:390},{width:740,height:320}])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport,colorScheme:theme,permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage(),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
  await page.goto(base+'#circuit/classic/5');
  const frame=page.frameLocator('#game-frame');await frame.locator('.tile').first().waitFor();
  const configure=async()=>{if(!await frame.locator('#puzzle-settings').evaluate(el=>el.open))await frame.locator('#settings-toggle').click();};
  assert.equal(await page.locator('#game-menu').evaluate(el=>el.open),false);
  assert.equal(await frame.locator('#puzzle-settings').evaluate(el=>el.open),false);
  assert.equal((await page.locator('#game-frame').boundingBox()).width,viewport.width,'The current game gets the full screen width');
  const initial=await frame.locator('body').evaluate(()=>({board:document.querySelector('#board').getBoundingClientRect().bottom,tools:document.querySelector('#tools').getBoundingClientRect().bottom,height:innerHeight}));
  assert.ok(initial.board<=initial.height&&initial.tools<=initial.height,`Board and playing controls fit without a focus button: ${JSON.stringify({viewport,initial})}`);
  assert.equal(await frame.locator('#daily,#free,.mode-tabs,.daily-foot,#mode-explanation').count(),0);
  assert.equal(await frame.locator('#pin-mode,.pin-mark,.pinned').count(),0);
  assert.deepEqual(await frame.locator('#tools button').allTextContents(),['↶ Undo','✧ Hint']);
  assert.equal(await frame.locator('#variants button').count(),6);
  assert.equal(await frame.locator('#size option').count(),8);
  assert.equal(await frame.locator('html').getAttribute('data-theme'),theme);
  await configure();
  // All 48 combinations on desktop; all six largest boards on small screens.
  for(const v of variants)for(const size of viewport.width===1440?sizes:[10]){
   await frame.locator(`[data-variant="${v.id}"]`).click();await frame.locator('#size').selectOption(String(size));
   assert.equal(await frame.locator('.tile').count(),size*size);
   await page.waitForFunction(({v,size})=>location.hash===`#circuit/${v}/${size}`,{v:v.id,size});
   const bounds=await frame.locator('body').evaluate(body=>({width:innerWidth,document:document.documentElement.scrollWidth,body:body.scrollWidth}));
   assert.ok(bounds.document<=bounds.width+1&&bounds.body<=bounds.width+1,JSON.stringify({viewport,theme,v,size,bounds}));
  }
  while(await frame.locator('#zoom-in').isEnabled())await frame.locator('#zoom-in').click();
  const zoomed=await frame.locator('#board-viewport').evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth,tile:el.querySelector('.tile').getBoundingClientRect().width,body:document.body.scrollWidth,viewport:innerWidth}));
  assert.ok(zoomed.scroll>zoomed.width);assert.ok(zoomed.tile>=44,`Zoom produces usable tiles: ${JSON.stringify({viewport,zoomed})}`);assert.ok(zoomed.body<=zoomed.viewport+1,'Board zoom stays inside its scroll area');
  await frame.locator('#fit').click();
  await frame.locator('#board-viewport').evaluate(el=>{if(el.scrollWidth>el.clientWidth+1)throw Error('Fit should remove horizontal board scrolling');});
  await frame.locator('#continue').click();
  await page.screenshot({path:new URL(`circuit-${theme}-${viewport.width}x${viewport.height}.png`,output).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
  // Turns, reverse turns, size/mode changes and refresh all preserve state.
  await configure();await frame.locator('[data-variant="classic"]').click();await frame.locator('#size').selectOption('5');await frame.locator('#continue').click();
  const index=await frame.locator('.tile[aria-disabled="false"]').first().getAttribute('data-tile');
  const tile=frame.locator(`.tile[data-tile="${index}"]`);await tile.click();assert.equal(await frame.locator('#moves').innerText(),'1');
  await tile.press('r');assert.equal(await frame.locator('#moves').innerText(),'2');
  await frame.locator('#undo').click();assert.equal(await frame.locator('#moves').innerText(),'1');
  await configure();await frame.locator('#size').selectOption('6');await frame.locator('[data-variant="mesh"]').click();
  await frame.locator('[data-variant="classic"]').click();await frame.locator('#size').selectOption('5');
  await frame.locator('#continue').click();await page.waitForFunction(()=>location.hash==='#circuit/classic/5');
  assert.equal(await frame.locator('#moves').innerText(),'1');await page.reload();await frame.locator('.tile').first().waitFor();assert.equal(await frame.locator('#moves').innerText(),'1');
  await configure();await frame.locator('#new').click();await frame.locator('#cancel-action').click();assert.equal(await frame.locator('#moves').innerText(),'1');
  await configure();await frame.locator('#reset').click();await frame.locator('#confirm-action').click();assert.equal(await frame.locator('#moves').innerText(),'0');
  assert.ok(await frame.locator(`.tile[data-tile="${index}"]`).count());
  await frame.locator('#hint').click();assert.ok((await frame.locator('#hint-message').innerText()).includes('Row '));
  await frame.locator('#undo').click();assert.equal(await frame.locator('#moves').innerText(),'0');
  await configure();await frame.locator('#new').click();await frame.locator('#confirm-action').click();assert.equal(await frame.locator('#moves').innerText(),'0');
  await page.locator('#games-toggle').click();await page.keyboard.press('Escape');
  assert.equal(await page.locator('#game-menu').evaluate(el=>el.open),false);assert.equal(await frame.locator('#moves').innerText(),'0');
  await frame.locator('#settings-toggle').click();await frame.locator('#help').click();assert.ok(await frame.locator('#modal').evaluate(el=>el.open));await frame.locator('#close').click();
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);reports.push({viewport,theme,combinations:viewport.width===1440?48:6});
  await context.close();
 }
 // Finish a real puzzle through the visible Hint control and share its seed.
 const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage();await page.goto(base+'#circuit/mesh/3/99');
 const frame=page.frameLocator('#game-frame');await frame.locator('.tile').first().waitFor();
 for(let i=0;i<9&&await frame.locator('#result').isHidden();i++)await frame.locator('#hint').click();
 assert.ok(await frame.locator('#result').isVisible());assert.equal(await frame.locator('#powered').innerText(),'9/9');assert.equal(await frame.locator('.loose').count(),0);
 await frame.locator('#share').click();
 await frame.locator('#toast').filter({hasText:'Puzzle and result copied'}).waitFor();
 const share=await page.evaluate(()=>navigator.clipboard.readText());const link=share.match(/https?:\/\/\S+/)[0];assert.ok(link.endsWith('#circuit/mesh/3/99'));
 const peer=await browser.newContext(),peerPage=await peer.newPage();await peerPage.goto(link);
 const peerFrame=peerPage.frameLocator('#game-frame');await peerFrame.locator('.tile').first().waitFor();assert.equal(await peerFrame.locator('#moves').innerText(),'0');
 assert.ok(await peerFrame.locator('#result').isHidden());assert.equal(await peerFrame.locator('#puzzle-label').textContent(),'Shared puzzle');
 await frame.locator('#next').click();
 await page.waitForFunction(()=>/^#circuit\/mesh\/3\/\d+$/.test(location.hash)&&!location.hash.endsWith('/99'));
 assert.equal(await frame.locator('#moves').innerText(),'0');
 await context.close();await peer.close();
 // A saved old daily becomes an ordinary board without changing its progress.
 const old=dailyCircuit('2026-10-15');applyTurn(old,0);
 const migratedContext=await browser.newContext();await migratedContext.addInitScript(old=>localStorage.setItem('circuit:v2:classic:daily:2026-10-15',JSON.stringify(old)),old);
 const migratedPage=await migratedContext.newPage();await migratedPage.goto(base+'#circuit/classic');
 const migrated=migratedPage.frameLocator('#game-frame');await migrated.locator('.tile').first().waitFor();assert.equal(await migrated.locator('#size').inputValue(),'4');assert.equal(await migrated.locator('#moves').innerText(),String(old.moves));
 await migratedContext.close();
 // Existing user pins must not block rotation or leave note-only undo steps.
 const pinnedSave=makeCircuit(5,91,'play','','classic'),formerlyPinned=pinnedSave.base.findIndex(m=>m!==15);
 applyTurn(pinnedSave,formerlyPinned);pinnedSave.pinned=pinnedSave.base.map(()=>true);
 pinnedSave.history.push({turns:[...pinnedSave.turns],moves:pinnedSave.moves,pinned:pinnedSave.base.map(()=>false)});
 const oldContext=await browser.newContext();await oldContext.addInitScript(board=>{if(!localStorage.getItem('circuit:v3:classic:5'))localStorage.setItem('circuit:v3:classic:5',JSON.stringify(board));},pinnedSave);
 const oldPage=await oldContext.newPage();await oldPage.goto(base+'#circuit/classic/5');
 const oldFrame=oldPage.frameLocator('#game-frame');await oldFrame.locator('.tile').first().waitFor();assert.equal(await oldFrame.locator('#moves').innerText(),'1');
 const oldTile=oldFrame.locator(`[data-tile="${formerlyPinned}"]`);await oldTile.click();assert.equal(await oldFrame.locator('#moves').innerText(),'2');
 await oldFrame.locator('#undo').click();assert.equal(await oldFrame.locator('#moves').innerText(),'1');await oldFrame.locator('#undo').click();assert.equal(await oldFrame.locator('#moves').innerText(),'0');assert.ok(await oldFrame.locator('#undo').isDisabled());
 await oldTile.press('p');await oldTile.dispatchEvent('contextmenu');assert.equal(await oldFrame.locator('#moves').innerText(),'0');assert.equal(await oldFrame.locator('.pinned,.pin-mark').count(),0);
 const stored=await oldPage.evaluate(()=>JSON.parse(localStorage.getItem('circuit:v3:classic:5')));assert.equal('pinned' in stored,false);
 await oldContext.close();
 // The standalone page must also load independently of the collection shell.
 const standalone=await browser.newPage();await standalone.goto(new URL('library/circuit.html?variant=barriers&size=10&seed=17',base).href);await standalone.locator('.tile').first().waitFor();assert.equal(await standalone.locator('.tile').count(),100);await standalone.close();
 await writeFile(new URL('circuit-site-report.json',output),JSON.stringify(reports,null,2));
 console.log('Circuit passed all 48 combinations, light/dark layouts, zoom, persistence, legacy pin removal, migration, hints, completion and reproducible sharing.');
}finally{await browser.close();}
