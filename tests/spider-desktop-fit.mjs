import assert from 'node:assert/strict';
import {newGame,validState} from '../snapword/dist/spider-engine.js';

export async function checkSpiderDesktopFit(browser,base){
 for(const {width,height,count} of [{width:1440,height:900,count:0},{width:1440,height:900,count:12},{width:1440,height:900,count:18},{width:1280,height:720,count:15},{width:900,height:720,count:15},{width:1440,height:900,count:32}]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  try{
   const state=newGame(42);
   if(count){
    const cards=[...state.columns.flat(),...state.stock];cards.forEach(card=>card.up=true);state.stock=[];
    state.columns=[cards.splice(0,count),...Array.from({length:9},(_,i)=>cards.splice(0,Math.ceil(cards.length/(9-i))))];
   }
   assert.ok(validState(state));
   await context.addInitScript(state=>{if(!localStorage.getItem('clicks:spider:v1'))localStorage.setItem('clicks:spider:v1',JSON.stringify({state,history:[]}));},state);
   const page=await context.newPage();await page.goto(base+'#spider');const frame=page.frameLocator('#game-frame');await frame.locator('.card').first().waitFor();
   await frame.locator('body').evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.getClientRects().length).map(i=>i.decode()));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
   const measure=()=>frame.locator('body').evaluate(()=>{
    const board=document.querySelector('#board'),rect=board.getBoundingClientRect();
    return {dense:board.classList.contains('dense'),width:parseFloat(board.style.getPropertyValue('--card-width')),bottom:rect.bottom,left:rect.left,right:rect.right,scroll:scrollY,
     labels:document.querySelector('.column-labels').getBoundingClientRect().toJSON(),
     indices:[...board.querySelectorAll('.card:not(.down):not(:last-child)')].map(card=>({rank:card.querySelector('.card-rank path').getBoundingClientRect().toJSON(),suit:card.querySelector('.card-corner>span+span').getBoundingClientRect().toJSON(),next:card.nextElementSibling.getBoundingClientRect().top,card:card.getBoundingClientRect().toJSON()}))};
   });
   const fitted=await measure();assert.equal(fitted.scroll,0);assert.ok(fitted.left>=0&&fitted.right<=width);
   assert.ok(Math.abs(fitted.labels.left-fitted.left)<1&&Math.abs(fitted.labels.right-fitted.right)<1,'Column labels stay aligned after shrinking');
   if(count!==32)assert.ok(fitted.bottom<=height-30,`The full stack fits ${width}×${height}: ${JSON.stringify(fitted)}`);
   if(count===0){assert.equal(fitted.dense,false);assert.ok(fitted.width>120,'Short deals retain their full-size cards');}
   if(count===32){assert.ok(fitted.width>=90&&fitted.bottom>height,'Extreme stacks keep readable cards and remain scrollable');}
   if(fitted.dense)for(const {rank,suit,next,card} of fitted.indices){
    assert.ok(rank.height>=16&&rank.bottom<=next+.1,'Covered ranks stay readable and visible: '+JSON.stringify({rank,next,card,width,height,count}));
    assert.ok(suit.bottom<=next+.1&&suit.right<=card.right,'Covered suits fit the exposed strip');
   }
   if(count===18){
    await page.screenshot({path:new URL('../test-results/spider-desktop-height-fit.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
    const before=(await measure()).width;
    await page.setViewportSize({width,height:760});
    await frame.locator('body').evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const smaller=await measure();assert.ok(smaller.width<=before&&smaller.bottom<=730,'Desktop height changes re-fit the table');
    assert.deepEqual(await frame.locator('body').evaluate(()=>JSON.parse(localStorage.getItem('clicks:spider:v1')).state),state,'Fitting never changes the deal');
   }
  }finally{await context.close();}
 }
}
