import {fitGeometry,columnGeometry} from './spider-layout.js?v=14';
import {cardArt} from './spider-cards.js?v=14';
import {rankArt} from './spider-ranks.js?v=14';
import {newGame,rankLabel,suitSymbol,movable,canMove,canDeal,move,deal,hint,snapshot,validState} from './spider-engine.js?v=7';
const $=s=>document.querySelector(s),SAVE='clicks:spider:v1';let state,history=[],selected=null,suggested=null,message='',storageOK=true,motionOrigins=null;
try{const saved=JSON.parse(localStorage.getItem(SAVE));if(validState(saved?.state)){state=saved.state;history=Array.isArray(saved.history)?saved.history.slice(-120).filter(validState):[];}}catch{}
state??=newGame(Math.floor(Math.random()*4294967296));
function save(){try{localStorage.setItem(SAVE,JSON.stringify({state,history}));}catch{storageOK=false;}}
function checkpoint(){history.push(snapshot(state));if(history.length>120)history.shift();}
function commit(options){selected=null;suggested=null;message='';save();render(options);}
function cardName(c){return `${rankLabel(c.rank)} of ${c.suit==='S'?'spades':'hearts'}`;}
function layout(){
 const board=$('#board');board.style.removeProperty('column-gap');const scroll=$('.table-scroll'),style=getComputedStyle(scroll),available=scroll.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),gap=parseFloat(getComputedStyle(board).columnGap)||0;
 const geometry=fitGeometry(available,gap);board.classList.toggle('compact',geometry.compact);board.style.width=geometry.boardWidth+'px';board.style.columnGap=geometry.gap+'px';board.style.setProperty('--card-width',geometry.cardWidth+'px');board.style.setProperty('--card-height',geometry.cardHeight+'px');
 board.querySelectorAll('.column').forEach((col,i)=>{const positions=columnGeometry(state.columns[i],geometry);col.querySelectorAll('.card').forEach((card,j)=>card.style.setProperty('--top',positions.tops[j]+'px'));col.style.minHeight=positions.height+'px';});$('#view-note').textContent=geometry.compact?'Tap a card, then its destination. All 10 columns fit.':'Drag or tap a card, then its destination.';
}
let layoutFrame=0,observedWidth=0;
function scheduleLayout(){cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(()=>{
 // Mobile browser chrome and pinch zoom resize the visual viewport during a pan.
 // Card geometry depends only on table width; leave a settled table alone.
 const width=$('.table-scroll').getBoundingClientRect().width;
 if(Math.abs(width-observedWidth)<.1)return;
 observedWidth=width;if(dragging){dragging=null;clearDrag();}$('#board').querySelectorAll('.card').forEach(c=>c.getAnimations().forEach(a=>a.cancel()));layout();
});}
function cardPositions(){return new Map([...$('#board').querySelectorAll('.card')].map(c=>[c.dataset.cardId,{left:c.getBoundingClientRect().left,top:c.getBoundingClientRect().top,down:c.classList.contains('down')}]));}
function animateCards(old,cleared){
 if(!old.size||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 $('#board').querySelectorAll('.card').forEach(c=>{const p=old.get(c.dataset.cardId),r=c.getBoundingClientRect();if(p){const dx=p.left-r.left,dy=p.top-r.top;if(Math.abs(dx)+Math.abs(dy)>2)c.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'translate(0,0)'}],{duration:210,easing:'cubic-bezier(.2,.7,.25,1)'});else if(p.down&&!c.classList.contains('down'))c.animate([{opacity:.3,transform:'rotateY(75deg)'},{opacity:1,transform:'rotateY(0)'}],{duration:240});}else c.animate([{opacity:.2,transform:'translateY(-15px)'},{opacity:1,transform:'translateY(0)'}],{duration:180});});
 if(state.completed.length>cleared)$('#completed .filled:last-child')?.animate([{transform:'scale(.8)',boxShadow:'0 0 24px #ffe182'},{transform:'scale(1)',boxShadow:'0 0 0 transparent'}],{duration:500});
}
function render({resetScrollRange=false}={}){
 const board=$('#board'),active=document.activeElement,focusId=active?.dataset.cardId,focusTarget=active?.dataset.target;
 const old=motionOrigins||cardPositions(),cleared=document.querySelectorAll("#completed .filled").length;motionOrigins=null;
 // Replacing absolute-positioned cards briefly collapses the grid. Keep its
 // current height until the new stacks have geometry, so layout reads cannot
 // clamp the document's scroll position during that intermediate state.
 board.style.minHeight=board.getBoundingClientRect().height+'px';
 if(resetScrollRange)document.body.style.removeProperty('--scroll-floor');
 else document.body.style.setProperty('--scroll-floor',(scrollY+document.documentElement.clientHeight)+'px');
 $('#undo').disabled=!history.length;$('#hint').disabled=state.won;
 $('#deal').disabled=!state.stock.length||state.won;$('#deal-label').textContent=state.stock.length?`Deal · ${state.stock.length/10} left`:'Stock empty';$('.stock-packs').innerHTML=Array.from({length:state.stock.length/10},()=>'<i></i>').join('');
 $('#progress').textContent=`${state.completed.length} / 8`;$('#progress').setAttribute('aria-label',`${state.completed.length} of 8 runs cleared`);$('#completed').innerHTML=Array.from({length:8},(_,i)=>{const c=state.completed[i]?.[0];return `<span class="${c?'filled '+(c.suit==='H'?'red':''):''}" aria-label="${c?'Completed '+(c.suit==='H'?'hearts':'spades'):'Empty sequence slot'}">${c?suitSymbol(c.suit):'·'}</span>`;}).join('');
 $('#board').innerHTML=state.columns.map((col,ci)=>`<div class="column ${suggested?.to===ci?'hint-target':''} ${selected&&canMove(state,selected.column,selected.index,ci)?'can-drop':''}" data-column="${ci}" role="group" aria-label="Column ${ci+1}, ${col.length} cards"><button class="empty-column" data-target="${ci}" aria-label="${col.length?'Move selected run to':'Empty column'} ${ci+1}" ${state.won?'disabled':''}>${col.length?'':'+'}</button>${col.map((c,i)=>`<button class="card ${!c.up?'down':c.suit==='H'?'red':''} ${selected?.column===ci&&selected.index===i?'selected':''} ${suggested?.from===ci&&suggested.index===i?'hint-source':''}" style="z-index:${i+1}" data-column="${ci}" data-index="${i}" data-card-id="${c.id}" aria-label="${c.up?cardName(c):'Face-down card'}, column ${ci+1}${c.up?(movable(state,ci,i)?', movable run':', blocked by cards below'):''}" ${c.up?`aria-pressed="${selected?.column===ci&&selected.index===i}"`:''} ${!c.up||state.won?'disabled':''} draggable="false" data-movable="${!state.won&&movable(state,ci,i)}">${c.up?`<span class="card-corner" aria-hidden="true"><span>${rankArt(c.rank)}</span><span>${suitSymbol(c.suit)}</span></span>${cardArt(c.rank,c.suit)}`:''}</button>`).join('')}</div>`).join('');
 $('#message').textContent=!storageOK?'Browser storage is full. Progress cannot be saved.':message||(state.won?'Eight runs. Table cleared.':selected?`Selected ${rankLabel(state.columns[selected.column][selected.index].rank)}${suitSymbol(state.columns[selected.column][selected.index].suit)} run · choose a column.`:'');
 $('#win').hidden=!state.won;$('.table').classList.toggle('won',state.won);layout();board.style.removeProperty('min-height');
 if(!resetScrollRange){
  const focus=focusId!==undefined?board.querySelector(`[data-card-id="${focusId}"]`):focusTarget!==undefined?board.querySelector(`[data-target="${focusTarget}"]`):null;
  if(focus&&!focus.disabled)focus.focus({preventScroll:true});
 }
 animateCards(old,cleared);
}
// When a run clears near the bottom, retain just enough room for this viewport.
// Release that extra room as the player scrolls up, without locking normal pans.
window.addEventListener('scroll',()=>{
 const floor=scrollY+document.documentElement.clientHeight;
 if(floor<parseFloat(document.body.style.getPropertyValue('--scroll-floor')))document.body.style.setProperty('--scroll-floor',floor+'px');
},{passive:true});
function choose(column,index){
 suggested=null;if(state.won)return;if(selected){if(column===selected.column&&index===selected.index){selected=null;message='';render();return;}if(canMove(state,selected.column,selected.index,column)){checkpoint();move(state,selected.column,selected.index,column);commit();return;}}
 if(movable(state,column,index)){selected={column,index};message='';}else message='Only a descending run in one suit can move together.';render();
}
$('#board').addEventListener('click',e=>{if(performance.now()<suppressClickUntil)return;const card=e.target.closest('[data-index]');if(card){choose(Number(card.dataset.column),Number(card.dataset.index));return;}const empty=e.target.closest('[data-target]');if(!empty)return;const to=Number(empty.dataset.target);if(selected&&canMove(state,selected.column,selected.index,to)){checkpoint();move(state,selected.column,selected.index,to);commit();}else{message=selected?'Place this run on the next higher rank, or an empty column.':'Select a card or matching-suit run first.';render();}});
let dragging=null,suppressClickUntil=0;
function clearDrag(){document.querySelectorAll('.drop-target,.drag-hidden').forEach(c=>c.classList.remove('drop-target','drag-hidden'));document.querySelector('.drag-ghost')?.remove();}
function dragGhost(run){
 const source=$('#board').querySelector('.card[data-column="'+run.column+'"][data-index="'+run.index+'"]'),r=source.getBoundingClientRect(),ghost=document.createElement('div');ghost.className='drag-ghost'+($('#board').classList.contains('compact')?' compact':'');ghost.setAttribute('aria-hidden','true');ghost.style.width=r.width+'px';ghost.style.setProperty('--card-width',r.width+'px');ghost.style.setProperty('--card-height',r.height+'px');
 source.parentElement.querySelectorAll('.card').forEach(c=>{if(+c.dataset.index<run.index)return;const clone=c.cloneNode(true),rect=c.getBoundingClientRect();clone.classList.remove('selected','hint-source');clone.tabIndex=-1;clone.style.top=(rect.top-r.top)+'px';clone.style.width=r.width+'px';ghost.append(clone);c.classList.add('drag-hidden');});document.body.append(ghost);run.ghost=ghost;run.left=r.left;run.top=r.top;run.width=r.width;run.height=r.height;
}
function dragDestination(run,x,y){
 const board=$('#board'),bounds=board.getBoundingClientRect(),centre=run.left+x-run.x+run.width/2,top=run.top+y-run.y;
 // Aim with the card's centre, including the gaps and the space below a short
 // stack. A little room below the table accepts an imprecise final release.
 if(centre<bounds.left||centre>bounds.right||top+run.height<bounds.top||top>bounds.bottom+Math.min(40,run.height/2))return null;
 const columns=[...board.querySelectorAll('.column')];
 const col=columns.reduce((best,column)=>{
  const r=column.getBoundingClientRect(),distance=Math.abs(centre-(r.left+r.right)/2);
  return !best||distance<best.distance?{column,distance}:best;
 },null)?.column;
 return col&&canMove(state,run.column,run.index,+col.dataset.column)?col:null;
}
$('#board').addEventListener('dragstart',e=>e.preventDefault());
$('#board').addEventListener('pointerdown',e=>{const c=e.target.closest('[data-index]');if(e.pointerType!=='mouse'||e.button!==0||!c||!movable(state,+c.dataset.column,+c.dataset.index)||state.won)return;dragging={column:+c.dataset.column,index:+c.dataset.index,x:e.clientX,y:e.clientY,moved:false};c.setPointerCapture(e.pointerId);});
$('#board').addEventListener('pointermove',e=>{if(!dragging)return;if(!dragging.moved&&Math.hypot(e.clientX-dragging.x,e.clientY-dragging.y)>6){dragging.moved=true;dragGhost(dragging);}if(!dragging.moved)return;dragging.ghost.style.transform='translate('+(dragging.left+e.clientX-dragging.x)+'px,'+(dragging.top+e.clientY-dragging.y)+'px)';document.querySelectorAll('.drop-target').forEach(c=>c.classList.remove('drop-target'));dragDestination(dragging,e.clientX,e.clientY)?.classList.add('drop-target');});
$('#board').addEventListener('pointerup',e=>{if(!dragging)return;const run=dragging;dragging=null;if(!run.moved)return;suppressClickUntil=performance.now()+350;const col=dragDestination(run,e.clientX,e.clientY);motionOrigins=cardPositions();run.ghost.querySelectorAll('.card').forEach(c=>{const r=c.getBoundingClientRect();motionOrigins.set(c.dataset.cardId,{left:r.left,top:r.top,down:false});});clearDrag();if(col){checkpoint();move(state,run.column,run.index,+col.dataset.column);commit();}else{selected={column:run.column,index:run.index};message='Place this run on the next higher rank, or an empty column.';render();}});
$('#board').addEventListener('pointercancel',()=>{dragging=null;clearDrag();});
$('#board').addEventListener('lostpointercapture',()=>{dragging=null;clearDrag();});
$('#deal').addEventListener('click',()=>{if(!canDeal(state)){message='Fill every empty column before dealing.';render();return;}checkpoint();deal(state);commit();});
$('#undo').addEventListener('click',()=>{if(!history.length)return;state=history.pop();commit();});
$('#hint').addEventListener('click',()=>{selected=null;suggested=hint(state);if(suggested){const c=state.columns[suggested.from][suggested.index];message=`Move ${rankLabel(c.rank)}${suitSymbol(c.suit)} from column ${suggested.from+1} to ${suggested.to+1}.`;}else message=canDeal(state)?'No useful move. Deal the next row.':state.stock.length?'Fill the empty columns before dealing. Undo may help.':'No useful move found. Try undo or a new game.';render();});
window.addEventListener('resize',scheduleLayout);window.visualViewport?.addEventListener('resize',scheduleLayout);
new ResizeObserver(scheduleLayout).observe($('.table-scroll'));
function start(){state=newGame(Math.floor(Math.random()*4294967296));history=[];commit({resetScrollRange:true});$('#modal').close();}
function requestNew(){if(state.moves&&!state.won){$('#dialog-title').textContent='Start a new game?';$('#dialog-body').innerHTML='<p>Your current game will be replaced.</p><div class="dialog-actions"><button id="cancel-new">Keep playing</button><button id="confirm-new">New game</button></div>';$('#cancel-new').onclick=()=>$('#modal').close();$('#confirm-new').onclick=start;$('#modal').showModal();}else start();}
$('#new').onclick=requestNew;$('#play-again').onclick=start;$('#close').onclick=()=>$('#modal').close();
$('#help').onclick=()=>{$('#dialog-title').textContent='Two-suit Spider';$('#dialog-body').innerHTML='<ul><li>Build down: put a 7 on any 8.</li><li>Move several cards together only when they descend in the same suit.</li><li>Any card or matching run can fill an empty column.</li><li>A King-to-Ace run in one suit clears automatically. Clear all eight to win.</li><li>Deal adds one card to every column. Fill empty columns first.</li></ul><p>Tap a card or run, then its destination. You can also drag on a computer. Undo reverses moves and deals. Progress saves in this browser.</p><p class="credits">Original card artwork · <a href="./cards/ABOUT.txt" target="_blank">About the deck</a>.</p>';$('#modal').showModal();};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){selected=null;suggested=null;message='';render();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});window.addEventListener('pagehide',save);save();render();
