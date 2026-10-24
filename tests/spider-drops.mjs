import assert from 'node:assert/strict';
import {newGame,hint,canMove,validState} from '../snapword/dist/spider-engine.js';

export async function checkSpiderDrops(browser,base){
 for(const width of [1440,740])for(const landing of ['below-stack','gap','off-centre','run','empty-column','invalid','outside']){
  const context=await browser.newContext({viewport:{width,height:1000}});
  try{
   const state=newGame(42);let suggestion=hint(state);
   if(landing==='run'){
    const place=(column,index,rank,suit)=>{
     const pile=state.columns[column],previous=pile[index],piles=[...state.columns,state.stock];
     const origin=piles.find(pile=>pile.some(card=>card.rank===rank&&card.suit===suit)),at=origin.findIndex(card=>card.rank===rank&&card.suit===suit),wanted=origin[at];
     previous.up=wanted.up;origin[at]=previous;pile[index]=wanted;wanted.up=true;
    };
    place(4,2,7,'S');place(4,3,6,'S');place(4,4,5,'S');place(7,4,8,'H');
    suggestion={from:4,index:2,to:7};
   }
   if(landing==='empty-column'){
    state.columns[8].forEach(card=>card.up=true);state.columns[0].push(...state.columns[8].splice(0));suggestion.to=8;
   }
   assert.ok(validState(state));assert.ok(canMove(state,suggestion.from,suggestion.index,suggestion.to));
   await context.addInitScript(state=>localStorage.setItem('clicks:spider:v1',JSON.stringify({state,history:[]})),state);
   const page=await context.newPage();await page.goto(base+'#spider');
   const frame=page.frameLocator('#game-frame');await frame.locator('.card').first().waitFor();
   await frame.locator('body').evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.getClientRects().length).map(i=>i.decode()));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
   const source=await frame.locator(`.card[data-column="${suggestion.from}"][data-index="${suggestion.index}"]`).boundingBox();
   let to=suggestion.to;
   if(landing==='invalid')to=state.columns.findIndex((_,i)=>i!==suggestion.from&&!canMove(state,suggestion.from,suggestion.index,i));
   const target=await frame.locator(`.column[data-column="${to}"] ${landing==='empty-column'?'.empty-column':'.card'}`).last().boundingBox();
   const board=await frame.locator('#board').boundingBox();
   const gap=await frame.locator('#board').evaluate(board=>parseFloat(getComputedStyle(board).columnGap));
   const grab=landing==='off-centre'?source.width-3:source.width/2;
   let x=target.x+target.width/2,y=target.y+10;
   if(['below-stack','run','empty-column'].includes(landing))y=target.y+target.height+8;
   if(landing==='gap')x=target.x+target.width+gap/3;
   if(landing==='off-centre')x=target.x+target.width+gap+2;
   if(landing==='outside')y=board.y+board.height+150;
   await page.mouse.move(source.x+grab,source.y+10);await page.mouse.down();
   await page.mouse.move(x,y,{steps:10});
   const valid=!['invalid','outside'].includes(landing);
   if(valid){
    assert.equal(await frame.locator('.drop-target').count(),1,`${landing}: show a valid landing preview`);
    assert.equal(await frame.locator('.drop-target').getAttribute('data-column'),String(to),`${landing}: preview the column that will receive the cards`);
   }
   else assert.equal(await frame.locator('.drop-target').count(),0,'Reject invalid or distant destinations');
   await page.mouse.up();
   const saved=await frame.locator('body').evaluate(()=>JSON.parse(localStorage.getItem('clicks:spider:v1')).state);
   assert.equal(saved.moves,valid?1:0,`${width}px ${landing}: legal drops should stay in their destination`);
   if(valid)assert.equal(saved.columns[to].at(-1).id,state.columns[suggestion.from].at(-1).id);
   assert.equal(await frame.locator('.drag-ghost,.drag-hidden,.drop-target').count(),0,'A finished drag leaves no stale preview');
  }finally{await context.close();}
 }
}
