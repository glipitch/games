import assert from 'node:assert/strict';
import {newGame,validState} from '../snapword/dist/spider-engine.js';

export async function checkSpiderCompletion(browser,base){
 for(const width of [390,1440])for(const reduced of [false,true])for(const trigger of width===390&&!reduced?['move','deal']:['move'])for(const zoomed of reduced?[false]:[false,true]){
  const height=zoomed?600:1000,context=await browser.newContext({viewport:{width,height},reducedMotion:reduced?'reduce':'no-preference'});
  try{
   const state=newGame(42),cards=[...state.columns.flat(),...state.stock];cards.forEach(card=>card.up=true);
   const take=rank=>cards.splice(cards.findIndex(card=>card.rank===rank&&card.suit==='S'),1)[0];
   const ace=take(1),run=Array.from({length:12},(_,i)=>take(13-i)),target=run.at(-1);
   if(trigger==='deal'){
    state.columns=[run,...Array.from({length:9},(_,i)=>cards.splice(0,i<6?5:4))];
    state.stock=[...cards.splice(0),ace];state.stock.forEach(card=>card.up=false);
   }else{
    state.stock=[];state.columns=[run,[...cards.splice(0,10),ace],...Array.from({length:8},(_,i)=>cards.splice(0,i?10:11))];
   }
   assert.ok(validState(state));
   await context.addInitScript(state=>{if(!localStorage.getItem('clicks:spider:v1'))localStorage.setItem('clicks:spider:v1',JSON.stringify({state,history:[]}));},state);
   const page=await context.newPage();await page.goto(base+'#spider');const frame=page.frameLocator('#game-frame');
   await frame.locator('.card').first().waitFor();
   await frame.locator('body').evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.getClientRects().length).map(i=>i.decode()));});
   if(zoomed){if(width===390)await frame.locator('#compact').click();await frame.locator('#fit').click();assert.ok(await frame.locator('#board').evaluate(board=>Number(board.dataset.zoom)<1));}
   const complete=async()=>{
    if(trigger==='deal'){await frame.locator('#deal').click();return;}
    for(const card of [ace,target]){
     const box=await frame.locator(`#board .card[data-card-id="${card.id}"]`).boundingBox();
     assert.ok(box&&box.y>=0&&box.y+10<height);await page.mouse.click(box.x+box.width/2,box.y+10);
    }
   };
   await complete();
   assert.match(await frame.locator('#completion-notice').innerText(),/Spades run complete.*moved to the upper tray/);
   assert.ok(await frame.locator('#completion-notice').isVisible());
   assert.equal(await frame.locator('body').evaluate(()=>scrollY),0,'Completion never scrolls the page to the tray');
   if(reduced){
    assert.equal(await frame.locator('.run-clearance').count(),0,'Reduced motion uses a static confirmation');
   }else{
    assert.equal(await frame.locator('.run-clearance .card').count(),13,'All thirteen cleared cards take part');
    assert.equal(await frame.locator('#completed .receiving').count(),1);
    await frame.locator('body').evaluate(()=>document.querySelectorAll('.run-clearance .card').forEach(card=>card.getAnimations().forEach(animation=>{animation.pause();animation.currentTime=490;})));
    await page.screenshot({path:new URL(`../test-results/spider-completion-${width}-${trigger}-${zoomed?'fit':'actual'}-gather.png`,import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
    await frame.locator('body').evaluate(()=>document.querySelectorAll('.run-clearance .card').forEach(card=>card.getAnimations().forEach(animation=>animation.currentTime=720)));
    await page.screenshot({path:new URL(`../test-results/spider-completion-${width}-${trigger}-${zoomed?'fit':'actual'}-flight.png`,import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
   }
   // Undo is available immediately and removes any obsolete flight and notice.
   await frame.locator('#undo').click();
   assert.equal(await frame.locator('.run-clearance,#completed .receiving').count(),0);
   assert.equal(await frame.locator('#completion-notice').isVisible(),false);
   if(!reduced){
    await complete();
    await frame.locator('body').evaluate(async()=>{
     document.querySelectorAll('.run-clearance .card').forEach(card=>card.getAnimations().forEach(animation=>animation.finish()));
     await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    });
    assert.equal(await frame.locator('.run-clearance,#completed .receiving').count(),0,'Arrival removes the flying cards and highlights the filled slot');
    assert.equal(await frame.locator('#completed .filled').count(),1);
   }
  }finally{await context.close();}
 }
}
