import assert from 'node:assert/strict';
import {chromium} from '../sudoku/node_modules/playwright/index.mjs';
import {mkdir} from 'node:fs/promises';
import {newGame,move,hint,validState} from '../snapword/dist/spider-engine.js';
import {checkSpiderScroll} from './spider-scroll.mjs';
import {checkSpiderDrops} from './spider-drops.mjs';
import {checkSpiderCompletion} from './spider-completion.mjs';

const base=process.env.TEST_URL||'http://127.0.0.1:4173/games/';
await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
const saveKey='clicks:spider:v1';
const readSave=frame=>frame.locator('body').evaluate((_,key)=>JSON.parse(localStorage.getItem(key)),saveKey);
async function loadState(page,state){
 // Leave Spider first so its pagehide save cannot overwrite the next fixture.
 await page.goto(base+'#circuit');await page.frameLocator('#game-frame').locator('.tile').first().waitFor();
 await page.evaluate(({saveKey,state})=>localStorage.setItem(saveKey,JSON.stringify({state,history:[],elapsed:999})),{saveKey,state});
 await page.goto(base+'#spider');await page.frameLocator('#game-frame').locator('.card,.empty-column').first().waitFor();
}
const settle=frame=>frame.locator('body').evaluate(async()=>{
 await document.fonts.ready;
 await Promise.all([...document.images].filter(i=>i.getClientRects().length).map(i=>i.decode()));
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
});
try{
 for(const theme of ['light','dark'])for(const width of [320,390,768,844,1440]){
  const context=await browser.newContext({viewport:{width,height:width===844?390:844},colorScheme:theme,isMobile:width<500,hasTouch:width<500});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const initial=newGame(42),next=structuredClone(initial),h=hint(next);
  assert.ok(move(next,h.from,h.index,h.to));
  // The previous format included a running timer; preserve the deal and undo.
  await context.addInitScript(({saveKey,initial,next})=>{
   if(!localStorage.getItem(saveKey))localStorage.setItem(saveKey,JSON.stringify({state:next,history:[initial],elapsed:999}));
  },{saveKey,initial,next});
  await page.goto(base+'#spider');
  let frame=page.frameLocator('#game-frame');await frame.locator('.card').first().waitFor();await settle(frame);
  assert.deepEqual((await readSave(frame)).state,next,'Old saves preserve their exact deal');
  assert.equal(await frame.locator('#score,#moves,#time,.stats').count(),0);
  await frame.locator('#undo').click();assert.deepEqual((await readSave(frame)).state,initial);
  await frame.locator('#deal').click();assert.equal((await readSave(frame)).state.stock.length,40);
  await frame.locator('#undo').click();assert.deepEqual((await readSave(frame)).state,initial);
  await frame.locator('#hint').click();
  await frame.locator('.hint-source').click();
  assert.ok(await frame.locator('.can-drop').count()>0,'Selection clearly marks legal destinations');
  await frame.locator(`.column[data-column="${h.to}"] .card`).last().click();
  assert.deepEqual((await readSave(frame)).state,next);
  await page.reload();await frame.locator('.card').first().waitFor();assert.deepEqual((await readSave(frame)).state,next,'Reload preserves progress');
  await frame.locator('#undo').click();
  // Expose mixed ranks, including tens, in long stacks without changing the deck.
  const tall=newGame(42),cards=[...tall.columns.flat(),...tall.stock];
  cards.forEach(c=>c.up=true);tall.stock=[];
  tall.columns=[cards.slice(0,32),...Array.from({length:9},(_,i)=>cards.slice(32+i*8,40+i*8))];
  assert.ok(validState(tall));
  await loadState(page,tall);await settle(frame);
  assert.deepEqual((await readSave(frame)).state,tall);
  const geometry=await frame.locator('body').evaluate(()=>{
   const board=document.querySelector('#board'),compact=board.classList.contains('compact');
   return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,compact,
    columns:[...document.querySelectorAll('.column')].map(c=>c.getBoundingClientRect().toJSON()),
    indices:[...board.querySelectorAll('.card-corner')].map(index=>{
     const card=index.parentElement,next=card.nextElementSibling,rank=index.firstElementChild.getBoundingClientRect(),suit=index.lastElementChild.getBoundingClientRect();
     return {rank:rank.toJSON(),ink:index.querySelector('.card-rank path').getBoundingClientRect().toJSON(),suit:suit.toJSON(),card:card.getBoundingClientRect().toJSON(),nextTop:next?.getBoundingClientRect().top};
    })};
  });
  assert.ok(geometry.scrollWidth<=width,'The table never scrolls horizontally');
  assert.ok(geometry.columns.every(c=>c.left>=0&&c.right<=width&&c.width>=24));
  if(geometry.compact)for(const {rank,ink,suit,card,nextTop} of geometry.indices){
   assert.ok(rank.height>=24&&ink.height>=18&&suit.height>=22,'The actual rank outline and suit remain large enough to read');
   assert.ok(ink.left>=card.left&&ink.right<=card.right&&ink.top>=rank.top&&ink.bottom<=rank.bottom,'Every outline, including 10 and the Q tail, fits its index');
   assert.ok(rank.left>=card.left&&rank.right<=card.right&&suit.left>=card.left&&suit.right<=card.right,'Both parts fit the narrow card');
   assert.ok(suit.bottom<=Math.min(card.bottom,nextTop??Infinity),'The next card never hides the suit');
  }
  await frame.locator('body').evaluate(()=>{
   window.layoutMutations=0;
   new MutationObserver(records=>window.layoutMutations+=records.length).observe(document.querySelector('#board'),{attributes:true,subtree:true,attributeFilter:['style','class']});
   window.dispatchEvent(new Event('resize'));window.visualViewport?.dispatchEvent(new Event('resize'));
  });
  await settle(frame);
  assert.equal(await frame.locator('body').evaluate(()=>window.layoutMutations),0,'Height-only viewport notifications do not move cards');
  if(width<500){
   const session=await context.newCDPSession(page);
   const swipe=async(from,to)=>{
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
    for(let i=1;i<=12;i++){
     await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/12,y:from.y+(to.y-from.y)*i/12}]});
     await new Promise(resolve=>setTimeout(resolve,20));
    }
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   };
   await swipe({x:20,y:600},{x:35,y:260});
   await frame.locator('body').evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const scroll=await frame.locator('body').evaluate(()=>({y:scrollY,height:innerHeight,scrollHeight:document.documentElement.scrollHeight,bodyScroll:document.body.scrollTop,rootOverflow:getComputedStyle(document.documentElement).overflowY,bodyOverflow:getComputedStyle(document.body).overflowY}));
   assert.ok(scroll.y>100,'Swiping a long stack still scrolls vertically: '+JSON.stringify(scroll));
   const left=await frame.locator('.column').first().evaluate(c=>c.getBoundingClientRect().left);
   await swipe({x:50,y:350},{x:250,y:355});
   assert.equal(await frame.locator('body').evaluate(()=>scrollX),0);
   assert.equal(await frame.locator('.column').first().evaluate(c=>c.getBoundingClientRect().left),left,'Horizontal swipes leave the board anchored');
   assert.equal(await frame.locator('.drag-ghost').count(),0,'Touch panning never starts a card drag');
   assert.deepEqual((await readSave(frame)).state,tall,'Panning never plays a card');
   await page.setViewportSize({width:844,height:390});await settle(frame);
   assert.deepEqual((await readSave(frame)).state,tall,'Rotation retains long stacks');
   await page.setViewportSize({width,height:844});await settle(frame);
  }
  await frame.locator('body').evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:new URL(`../test-results/spider-${theme}-${width}-stacks.png`,import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
  assert.deepEqual(errors,[]);
  await context.close();
 }
 // Mouse dragging keeps the same face style as the table and commits the move.
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 await page.goto(base+'#spider');let frame=page.frameLocator('#game-frame');await frame.locator('.card').first().waitFor();
 for(const width of [1440,740]){
  await page.setViewportSize({width,height:1000});
  await loadState(page,newGame(42));await settle(frame);
  const state=(await readSave(frame)).state,h=hint(state),source=await frame.locator(`.card[data-column="${h.from}"][data-index="${h.index}"]`).boundingBox(),target=await frame.locator(`.column[data-column="${h.to}"] .card`).last().boundingBox();
  await page.mouse.move(source.x+source.width/2,source.y+10);await page.mouse.down();
  await page.mouse.move(target.x+target.width/2,target.y+10,{steps:10});
  assert.equal(await frame.locator('.drag-ghost.compact').count(),width===740?1:0);
  await page.mouse.up();assert.equal((await readSave(frame)).state.moves,1);
 }
 // A completed legacy game gets a calm result without metrics.
 const won=newGame(42),all=[...won.columns.flat(),...won.stock];
 won.columns=Array.from({length:10},()=>[]);won.stock=[];won.completed=[];
 for(const suit of ['S','H'])for(let copy=0;copy<4;copy++)won.completed.push(Array.from({length:13},(_,i)=>{
  const card=all.find(c=>c.suit===suit&&c.rank===13-i&&!c.used);card.used=true;card.up=true;return card;
 }));
 all.forEach(c=>delete c.used);won.won=true;assert.ok(validState(won));
 await loadState(page,won);await frame.locator('#win').waitFor();
 assert.doesNotMatch(await frame.locator('#win').innerText(),/score|moves|points|\d+:\d+/i);
 assert.deepEqual(await frame.locator('#win').allTextContents(),['Well done.Play again']);
 assert.equal(await frame.locator('#message').innerText(),'');
 await context.close();
 await checkSpiderScroll(browser,base);
 await checkSpiderDrops(browser,base);
 await checkSpiderCompletion(browser,base);
 console.log('Spider passed saved-game, readability, touch pan, rotation, drag, stable scroll and calm completion checks in both themes.');
}finally{await browser.close();}
