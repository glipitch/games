import assert from 'node:assert/strict';
import {newGame,validState} from '../snapword/dist/spider-engine.js';

export async function checkSpiderBacks(browser,base){
 for(const {width,height,compact} of [
  {width:1440,height:600,compact:false},
  {width:1440,height:320,compact:false},
  {width:390,height:600,compact:true},
  {width:320,height:740,compact:false}
 ]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',isMobile:width<500,hasTouch:width<500});
  try{
   const state=newGame(42),cards=[...state.columns.flat(),...state.stock];cards.forEach(card=>card.up=true);
   state.stock=[];state.columns=[cards.splice(0,40),...Array.from({length:9},(_,i)=>cards.splice(0,Math.ceil(cards.length/(9-i))))];
   state.columns[0].slice(0,5).forEach(card=>card.up=false);
   state.columns[1][0].up=false;assert.ok(validState(state));
   await context.addInitScript(({state,compact})=>{
    localStorage.setItem('clicks:spider:v1',JSON.stringify({state,history:[]}));
    localStorage.setItem('clicks:spider:appearance:v1',JSON.stringify({compact,mode:'tight'}));
   },{state,compact});
   const page=await context.newPage();await page.goto(base+'#spider');const frame=page.frameLocator('#game-frame');
   await frame.locator('.card').first().waitFor();
   await frame.locator('body').evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
   const report=await frame.locator('#board').evaluate(board=>({
    zoom:Number(board.dataset.zoom),height:innerHeight,
    bottom:Math.max(...[...board.querySelectorAll('.card')].map(card=>card.getBoundingClientRect().bottom)),
    backs:[...board.querySelectorAll('.card.down')].map(card=>card.nextElementSibling.getBoundingClientRect().top-card.getBoundingClientRect().top)
   }));
   assert.equal(report.backs.length,6);
   assert.ok(report.backs.every(strip=>strip>=7.95),'Every back stays visibly exposed: '+JSON.stringify(report));
   assert.ok(report.bottom<=report.height-10,'All card ends still fit: '+JSON.stringify(report));
   if(width===1440&&height===320)assert.ok(report.zoom<1,'The minimum back strip also holds during fallback zoom');
   await page.screenshot({path:`test-results/spider-backs-${width}-${height}.png`});
  }finally{await context.close();}
 }
}
