import assert from 'node:assert/strict';
import {newGame,validState} from '../snapword/dist/spider-engine.js';

export async function checkSpiderView(browser,base){
 for(const viewport of [{width:320,height:740},{width:390,height:844},{width:768,height:1024},{width:844,height:390},{width:1280,height:720},{width:1440,height:1000}]){
  const touch=viewport.width<500,context=await browser.newContext({viewport,isMobile:touch,hasTouch:touch});
  try{
   const state=newGame(42),cards=[...state.columns.flat(),...state.stock];cards.forEach(card=>card.up=true);
   const take=(rank,suit)=>cards.splice(cards.findIndex(card=>card.rank===rank&&card.suit===suit),1)[0];
   const source=take(6,'H'),target=take(7,'S');
   state.stock=[];state.columns=[[...cards.splice(0,59),target],[...cards.splice(0,4),source],...Array.from({length:8},(_,i)=>cards.splice(0,Math.ceil(cards.length/(8-i))))];
   assert.ok(validState(state));
   await context.addInitScript(state=>{if(!localStorage.getItem('clicks:spider:v1'))localStorage.setItem('clicks:spider:v1',JSON.stringify({state,history:[]}));},state);
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base+'#spider');const frame=page.frameLocator('#game-frame');await frame.locator('.card').first().waitFor();
   const settle=()=>frame.locator('body').evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
   await settle();
   const zoom=()=>frame.locator('#board').evaluate(board=>Number(board.dataset.zoom));
   const controls=async()=>{
    const report=await frame.locator('body').evaluate(()=>['undo','hint','new','fit','tight','actual','compact','help','deal'].map(id=>{
     const button=document.getElementById(id),r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
     return {id,left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,visible:!!hit&&(hit===button||button.contains(hit)),viewport:{width:innerWidth,height:innerHeight}};
    }));
    for(const item of report)assert.ok(item.left>=0&&item.right<=item.viewport.width+.5&&item.top>=0&&item.bottom<=item.viewport.height&&item.visible,'Controls remain on-screen and unobscured: '+JSON.stringify(item));
    return report;
   };
   assert.equal(await frame.locator('#board').evaluate(board=>board.classList.contains('compact')),false,'Illustrated cards are the default even on phones');
   assert.equal(await zoom(),1);await controls();
   const initial=await frame.locator(`#board .card[data-card-id="${source.id}"]`).boundingBox();
   const naturalStep=await frame.locator('.column[data-column="1"] .card').evaluateAll(cards=>cards[1].getBoundingClientRect().top-cards[0].getBoundingClientRect().top);
   await frame.locator('body').evaluate(()=>scrollTo(0,400));await settle();await controls();
   const buttonHeight=(await frame.locator('#fit').boundingBox()).height;
   await frame.locator('#fit').click();await settle();
   const scale=await zoom();assert.ok(scale>0&&scale<1,'Fit is an explicit zoom');await controls();
   assert.equal((await frame.locator('#fit').boundingBox()).height,buttonHeight,'View buttons are never scaled');
   const fitted=await frame.locator(`#board .card[data-card-id="${source.id}"]`).boundingBox();
   assert.ok(Math.abs(fitted.width/initial.width-scale)<.002&&Math.abs(fitted.height/initial.height-scale)<.002,'Both axes scale equally');
   const bounds=await frame.locator('#board .card').evaluateAll(cards=>({bottom:Math.max(...cards.map(card=>card.getBoundingClientRect().bottom)),height:innerHeight}));
   assert.ok(bounds.bottom<=bounds.height-10,'All card ends fit in the viewport');
   const from=await frame.locator(`#board .card[data-card-id="${source.id}"]`).boundingBox(),to=await frame.locator(`#board .card[data-card-id="${target.id}"]`).boundingBox();
   if(touch){
    await page.touchscreen.tap(from.x+from.width/2,from.y+Math.min(8,from.height/3));
    await page.touchscreen.tap(to.x+to.width/2,to.y+Math.min(8,to.height/3));
   }else{
    await page.mouse.move(from.x+from.width/2,from.y+Math.min(8,from.height/3));await page.mouse.down();
    await page.mouse.move(to.x+to.width/2,to.y+Math.min(8,to.height/3),{steps:10});
    const ghost=await frame.locator('.drag-ghost:not(.run-clearance) .card').first().boundingBox();
    assert.ok(ghost&&Math.abs(ghost.width-from.width)<1&&Math.abs(ghost.height-from.height)<1,'Dragged cards retain the visible zoom');
    await page.mouse.up();
   }
   const saved=await frame.locator('body').evaluate(()=>JSON.parse(localStorage.getItem('clicks:spider:v1')).state);
   assert.equal(saved.moves,1);assert.equal(saved.columns[0].at(-1).id,source.id);
   assert.ok(await zoom()<scale,'Fit stays on and automatically adjusts when a column grows');
   assert.equal(await frame.locator('body').evaluate(()=>scrollY),0,'A zoomed move never auto-scrolls');
   await frame.locator('body').evaluate(async()=>{await Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{})));});
   const afterMove=await frame.locator('#board .card').evaluateAll(cards=>Math.max(...cards.map(card=>card.getBoundingClientRect().bottom)));
   assert.ok(afterMove<=viewport.height-10,'All card ends remain visible after moving');
   const autoScale=await zoom();await frame.locator('#fit').click();assert.ok(Math.abs(await zoom()-autoScale)<.001,'Pressing Fit again does not change an already fitting view');
   if([390,1440].includes(viewport.width)){
    const beforeResize=await zoom();await page.setViewportSize({width:viewport.width,height:viewport.height-100});await settle();
    assert.ok(await zoom()<beforeResize,'A window-height change re-fits the view on touch and desktop');await controls();
   }
   await frame.locator('#tight').click();assert.equal(await frame.locator('#tight').getAttribute('aria-pressed'),'true');
   assert.equal(await frame.locator('#fit').getAttribute('aria-pressed'),'false');assert.equal(await zoom(),1,'Tight stacks retain full-size cards where there is room');
   const tight=await frame.locator(`#board .card[data-card-id="${source.id}"]`).boundingBox();
   assert.ok(Math.abs(tight.width-initial.width)<2&&Math.abs(tight.height-initial.height)<2,'Bottom cards keep their normal dimensions');
   const steps=await frame.locator('#board').evaluate(board=>[0,1].map(column=>{const cards=board.querySelectorAll(`.column[data-column="${column}"] .card`);return cards[1].getBoundingClientRect().top-cards[0].getBoundingClientRect().top;}));
   assert.ok(steps[0]<naturalStep&&Math.abs(steps[1]-naturalStep)<.1,'Only the long column compresses');await controls();
   await frame.locator('#undo').click();
   await frame.locator('body').evaluate(async()=>{await Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{})));});
   for(const card of [source,target]){
    const box=await frame.locator(`#board .card[data-card-id="${card.id}"]`).boundingBox();
    if(touch)await page.touchscreen.tap(box.x+box.width/2,box.y+Math.min(8,box.height/3));
    else await page.mouse.click(box.x+box.width/2,box.y+Math.min(8,box.height/3));
   }
   await frame.locator('body').evaluate(async()=>{await Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{})));});
   assert.equal(await frame.locator('#tight').getAttribute('aria-pressed'),'true');
   assert.ok(await frame.locator('#board .card').evaluateAll(cards=>Math.max(...cards.map(card=>card.getBoundingClientRect().bottom))<=innerHeight-10),'Tight stacks also keep fitting after a move grows the column');
   await frame.locator('#compact').click();assert.equal(await frame.locator('#compact').getAttribute('aria-pressed'),'true');
   await frame.locator('#actual').click();assert.equal(await zoom(),1);await controls();
   await frame.locator('body').evaluate(()=>scrollTo(0,500));await settle();await controls();
   await page.setViewportSize(viewport.width<500?{width:1280,height:720}:{width:390,height:844});await settle();
   assert.equal(await frame.locator('#board').evaluate(board=>board.classList.contains('compact')),true,'Resizing never changes the chosen appearance');
   await page.reload();await frame.locator('.card').first().waitFor();await settle();
   assert.equal(await frame.locator('#board').evaluate(board=>board.classList.contains('compact')),true,'Compact choice persists across refresh');
   assert.equal(await zoom(),1,'A fresh page starts at actual size');
   await frame.locator('#compact').click();await page.reload();await frame.locator('.card').first().waitFor();
   assert.equal(await frame.locator('#board').evaluate(board=>board.classList.contains('compact')),false,'The illustrated choice is also saved');
   assert.equal(await frame.locator('body').evaluate(()=>JSON.parse(localStorage.getItem('clicks:spider:v1')).state.moves),1,'View changes preserve the deal');
   await frame.locator('#fit').click();await page.reload();await frame.locator('.card').first().waitFor();await settle();
   assert.equal(await frame.locator('#fit').getAttribute('aria-pressed'),'true','Fit remains on across refresh');
   await frame.locator('#new').click();await frame.locator('#confirm-new').click();await settle();
   assert.equal(await frame.locator('#fit').getAttribute('aria-pressed'),'true','A new deal retains Fit zoom');
   await frame.locator('#deal').click();assert.equal(await frame.locator('#fit').getAttribute('aria-pressed'),'true','Dealing retains Fit zoom');
   await frame.locator('#tight').click();await page.reload();await frame.locator('.card').first().waitFor();await settle();
   assert.equal(await frame.locator('#tight').getAttribute('aria-pressed'),'true','Tight stacks is also remembered');await controls();
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 }
 await checkSpiderWinnerControls(browser,base);
}

export async function checkSpiderWinnerControls(browser,base){
 for(const width of [390,1280])for(const mode of ['actual','fit','tight']){
  const context=await browser.newContext({viewport:{width,height:600},reducedMotion:'reduce'});
  try{
   const state=newGame(42),cards=[...state.columns.flat(),...state.stock];cards.forEach(card=>card.up=true);
   const take=(rank,suit)=>cards.splice(cards.findIndex(card=>card.rank===rank&&card.suit===suit),1)[0];
   state.completed=[];for(const suit of ['H','S'])for(let copy=0;copy<(suit==='H'?4:3);copy++)state.completed.push(Array.from({length:13},(_,i)=>take(13-i,suit)));
   const run=Array.from({length:12},(_,i)=>take(13-i,'S')),ace=take(1,'S');state.stock=[];state.columns=[run,[ace],...Array.from({length:8},()=>[])];assert.ok(validState(state));
   await context.addInitScript(state=>localStorage.setItem('clicks:spider:v1',JSON.stringify({state,history:[]})),state);
   const page=await context.newPage();await page.goto(base+'#spider');const frame=page.frameLocator('#game-frame');await frame.locator('.card').first().waitFor();
   if(width===390)await frame.locator('#compact').click();
   if(mode!=='actual')await frame.locator('#'+mode).click();
   const source=await frame.locator(`#board .card[data-card-id="${ace.id}"]`).boundingBox();await page.mouse.click(source.x+source.width/2,source.y+10);
   await frame.locator('body').evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
   const before=await frame.locator('body').evaluate(()=>scrollY);assert.ok(mode!=='actual'||before>0);
   const target=await frame.locator(`#board .card[data-card-id="${run.at(-1).id}"]`).boundingBox();await page.mouse.click(target.x+target.width/2,target.y+10);
   assert.equal(await frame.locator('body').evaluate(()=>JSON.parse(localStorage.getItem('clicks:spider:v1')).state.won),true);
   assert.equal(await frame.locator('body').evaluate(()=>scrollY),before,'Winning does not auto-scroll');
   const positions=await frame.locator('body').evaluate(()=>['fit','tight','actual','compact','deal','play-again'].map(id=>({id,...document.getElementById(id).getBoundingClientRect().toJSON()})));
   assert.ok(positions.every(item=>item.top>=0&&item.bottom<=600),'Controls and Play again stay visible after the table clears: '+JSON.stringify(positions));
   await frame.locator('#play-again').click();assert.equal(await frame.locator('#'+(mode==='actual'?'actual':mode)).getAttribute('aria-pressed'),'true','Play again retains the chosen fit mode');
  }finally{await context.close();}
 }
}
