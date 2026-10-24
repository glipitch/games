import assert from 'node:assert/strict';
import {newGame,validState} from '../snapword/dist/spider-engine.js';

export async function checkSpiderScroll(browser,base){
 for(const touch of [true,false])for(const clearRun of [false,true]){
  const context=await browser.newContext({viewport:{width:touch?390:1280,height:600},isMobile:touch,hasTouch:touch});
  try{
   const state=newGame(42),cards=[...state.columns.flat(),...state.stock];
   cards.forEach(card=>card.up=true);
   const take=(rank,suit)=>cards.splice(cards.findIndex(card=>card.rank===rank&&card.suit===suit),1)[0];
   let source,target;
   if(clearRun){
    source=take(1,'S');const run=Array.from({length:12},(_,i)=>take(13-i,'S'));target=run.at(-1);
    state.columns=[[...cards.splice(0,20),...run],[...cards.splice(0,30),source],...Array.from({length:8},(_,i)=>cards.splice(0,i?5:6))];
   }else{
    source=take(6,'H');target=take(7,'S');
    state.columns=[cards.splice(0,32),[...cards.splice(0,7),source],[...cards.splice(0,7),target],...Array.from({length:7},()=>cards.splice(0,8))];
   }
   state.stock=[];
   assert.ok(validState(state));
   await context.addInitScript(state=>{if(!localStorage.getItem('clicks:spider:v1'))localStorage.setItem('clicks:spider:v1',JSON.stringify({state,history:[]}));},state);
   const page=await context.newPage();await page.goto(base+'#spider');
   const frame=page.frameLocator('#game-frame');await frame.locator('.card').first().waitFor();
   await frame.locator('body').evaluate(async(_,clearRun)=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));scrollTo(0,clearRun?document.documentElement.scrollHeight:300);},clearRun);
   const scroll=()=>frame.locator('body').evaluate(()=>scrollY);
   const before=await scroll();assert.ok(before>=300);
   const activate=async selector=>{
    const box=await frame.locator(selector).boundingBox();assert.ok(box&&box.y>=0&&box.y+10<600,'Use an on-screen card without test-tool scrolling');
    if(touch)await page.touchscreen.tap(box.x+box.width/2,box.y+10);
    else await page.mouse.click(box.x+box.width/2,box.y+10);
   };
   await frame.locator('body').evaluate(()=>{
    window.scrollSamples=[];
    window.addEventListener('scroll',()=>window.scrollSamples.push(scrollY));
   });
   await activate(`.card[data-card-id="${source.id}"]`);
   assert.equal(await scroll(),before,'Selecting a card preserves the page position');
   await activate(`.card[data-card-id="${target.id}"]`);
   assert.equal(await scroll(),before,'Moving a card preserves the page position');
   await frame.locator('body').evaluate(async()=>{await Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{})));});
   assert.equal(await scroll(),before,'Finishing the move animation preserves the page position');
   assert.ok((await frame.locator('body').evaluate(()=>window.scrollSamples)).every(y=>y===before),'There is no temporary scroll jump during rendering');
   assert.equal(await frame.locator('body').evaluate(()=>JSON.parse(localStorage.getItem('clicks:spider:v1')).state.moves),1);
   assert.equal(await frame.locator('body').evaluate(()=>JSON.parse(localStorage.getItem('clicks:spider:v1')).state.completed.length),clearRun?1:0);
   // Exercise controls without asking Playwright to scroll off-screen buttons into view.
   await frame.locator('#undo').evaluate(button=>button.click());
   assert.equal(await scroll(),before,'Undo keeps the same viewport');
   await frame.locator('#hint').evaluate(button=>button.click());
   assert.equal(await scroll(),before,'Hints keep the same viewport');
   if(!touch){
    const from=await frame.locator(`.card[data-card-id="${source.id}"]`).boundingBox(),to=await frame.locator(`.card[data-card-id="${target.id}"]`).boundingBox();
    await page.mouse.move(from.x+from.width/2,from.y+10);await page.mouse.down();
    await page.mouse.move(to.x+to.width/2,to.y+10,{steps:8});await page.mouse.up();
    await frame.locator('body').evaluate(async()=>{await Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{})));});
    assert.equal(await scroll(),before,'Dragging a card also preserves the page position');
   }
   await frame.locator('body').evaluate(()=>scrollTo(0,0));
   await frame.locator('body').evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.ok(await frame.locator('body').evaluate(()=>parseFloat(document.body.style.getPropertyValue('--scroll-floor'))<=innerHeight+1),'Extra scroll room is released when the player scrolls back up');
  }finally{await context.close();}
 }
}
