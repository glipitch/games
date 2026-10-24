import {fitGeometry,fitZoom,columnGeometry} from './spider-layout.js?v=20';
import {cardArt} from './spider-cards.js?v=14';
import {rankArt} from './spider-ranks.js?v=14';
import {captureCompletedRuns,showCompletedRuns,cancelCompletedRuns} from './spider-completion.js?v=20';
import {newGame,rankLabel,suitSymbol,movable,canMove,canDeal,move,deal,hint,snapshot,validState} from './spider-engine.js?v=7';
const $=s=>document.querySelector(s),SAVE='clicks:spider:v1';let state,history=[],selected=null,suggested=null,message='',storageOK=true,motionOrigins=null;
const VIEW='clicks:spider:appearance:v1';let compact=false,zoom=1,fitted=false;
try{compact=JSON.parse(localStorage.getItem(VIEW))?.compact===true;}catch{}
try{const saved=JSON.parse(localStorage.getItem(SAVE));if(validState(saved?.state)){state=saved.state;history=Array.isArray(saved.history)?saved.history.slice(-120).filter(validState):[];}}catch{}
state??=newGame(Math.floor(Math.random()*4294967296));
function save(){try{localStorage.setItem(SAVE,JSON.stringify({state,history}));}catch{storageOK=false;}}
function checkpoint(){history.push(snapshot(state));if(history.length>120)history.shift();}
function commit(options){selected=null;suggested=null;message='';save();render(options);}
function cardName(c){return `${rankLabel(c.rank)} of ${c.suit==='S'?'spades':'hearts'}`;}
function layout({refit=false}={}){
 const board=$('#board');board.style.removeProperty('column-gap');const scroll=$('.table-scroll'),style=getComputedStyle(scroll),available=scroll.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),gap=parseFloat(getComputedStyle(board).columnGap)||0;
 const controls=$('.game-controls').getBoundingClientRect().height;document.documentElement.style.setProperty('--controls-height',controls+'px');
 const geometry=fitGeometry(available,gap,compact),tableStyle=getComputedStyle($('.table')),shellStyle=getComputedStyle($('.shell'));
 const bottom=parseFloat(tableStyle.paddingBottom)+parseFloat(tableStyle.borderBottomWidth)+parseFloat(shellStyle.paddingBottom)+$('.table-foot').getBoundingClientRect().height+$('#message').getBoundingClientRect().height+6+(state.won?$('#win').getBoundingClientRect().height:0)+2;
 const room=Math.max(1,document.documentElement.clientHeight-(scroll.getBoundingClientRect().top+scrollY)-bottom);
 if(!fitted)zoom=1;else if(refit)zoom=fitZoom(geometry,state.columns,room);
 board.classList.toggle('compact',compact);board.style.width=geometry.boardWidth+'px';board.style.columnGap=geometry.gap+'px';board.style.setProperty('--card-width',geometry.cardWidth+'px');board.style.setProperty('--card-height',geometry.cardHeight+'px');board.style.setProperty('--table-zoom',zoom);board.dataset.zoom=String(zoom);
 let naturalHeight=0;
 board.querySelectorAll('.column').forEach((col,i)=>{const positions=columnGeometry(state.columns[i],geometry);naturalHeight=Math.max(naturalHeight,positions.height);col.querySelectorAll('.card').forEach((card,j)=>card.style.setProperty('--top',positions.tops[j]+'px'));col.style.minHeight=positions.height+'px';});
 const playHeight=state.won?naturalHeight*zoom:Math.max(room,naturalHeight*zoom);scroll.style.height=playHeight+'px';board.style.height=playHeight/zoom+'px';
 const labels=$('.column-labels');labels.style.width=geometry.boardWidth*zoom+'px';labels.style.columnGap=geometry.gap*zoom+'px';
 $('#compact').setAttribute('aria-pressed',String(compact));$('#fit').setAttribute('aria-pressed',String(fitted));$('#actual').setAttribute('aria-pressed',String(!fitted));$('#fit').title=fitted?`Refit the whole table (currently ${Math.round(zoom*100)}%)`:'Fit the whole table in the available height';
 $('#view-note').textContent='Tap a card, then its destination.';
 observedWidth=scroll.getBoundingClientRect().width;observedControls=controls;observedHeight=resizeHeight();
}
const resizeHeight=()=>fitted&&matchMedia('(hover:hover) and (pointer:fine)').matches?document.documentElement.clientHeight:0;
let layoutFrame=0,observedWidth=0,observedControls=0,observedHeight=0;
function scheduleLayout(){cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(()=>{
 // Mobile browser controls must not change zoom during a pan.
 const width=$('.table-scroll').getBoundingClientRect().width,controls=$('.game-controls').getBoundingClientRect().height,height=resizeHeight();
 if(Math.abs(width-observedWidth)<.1&&Math.abs(controls-observedControls)<.1&&height===observedHeight)return;
 if(dragging){dragging=null;clearDrag();}$('#board').querySelectorAll('.card').forEach(c=>c.getAnimations().forEach(a=>a.cancel()));layout({refit:fitted});
});}
function cardPositions(){return new Map([...$('#board').querySelectorAll('.card')].map(c=>[c.dataset.cardId,{left:c.getBoundingClientRect().left,top:c.getBoundingClientRect().top,down:c.classList.contains('down')}]));}
function animateCards(old){
 if(!old.size||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 $('#board').querySelectorAll('.card').forEach(c=>{const p=old.get(c.dataset.cardId),r=c.getBoundingClientRect();if(p){const dx=(p.left-r.left)/zoom,dy=(p.top-r.top)/zoom;if(Math.abs(dx)+Math.abs(dy)>2)c.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'translate(0,0)'}],{duration:210,easing:'cubic-bezier(.2,.7,.25,1)'});else if(p.down&&!c.classList.contains('down'))c.animate([{opacity:.3,transform:'rotateY(75deg)'},{opacity:1,transform:'rotateY(0)'}],{duration:240});}else c.animate([{opacity:.2,transform:'translateY(-15px)'},{opacity:1,transform:'translateY(0)'}],{duration:180});});
}
function render({resetScrollRange=false}={}){
 const board=$('#board'),active=document.activeElement,focusId=active?.dataset.cardId,focusTarget=active?.dataset.target;
 const old=motionOrigins||cardPositions(),cleared=document.querySelectorAll("#completed .filled").length;motionOrigins=null;
 const completed=old.size?captureCompletedRuns(state.completed.slice(cleared),board,old,zoom):[];
 if(resetScrollRange||state.completed.length<cleared)cancelCompletedRuns();
 // Replacing absolute-positioned cards briefly collapses the grid. Keep its
 // current height until the new stacks have geometry, so layout reads cannot
 // clamp the document's scroll position during that intermediate state.
 board.style.minHeight=board.offsetHeight+'px';
 if(resetScrollRange)document.body.style.removeProperty('--scroll-floor');
 else document.body.style.setProperty('--scroll-floor',(scrollY+document.documentElement.clientHeight)+'px');
 $('#undo').disabled=!history.length;$('#hint').disabled=state.won;
 $('#deal').disabled=!state.stock.length||state.won;$('#deal-label').textContent=state.stock.length?`Deal · ${state.stock.length/10} left`:'Stock empty';$('.stock-packs').innerHTML=Array.from({length:state.stock.length/10},()=>'<i></i>').join('');
 $('#progress').textContent=`${state.completed.length} / 8`;$('#progress').setAttribute('aria-label',`${state.completed.length} of 8 runs cleared`);$('#completed').innerHTML=Array.from({length:8},(_,i)=>{const c=state.completed[i]?.[0];return `<span class="${c?'filled '+(c.suit==='H'?'red':''):''}" aria-label="${c?'Completed '+(c.suit==='H'?'hearts':'spades'):'Empty sequence slot'}">${c?suitSymbol(c.suit):'·'}</span>`;}).join('');
 $('#board').innerHTML=state.columns.map((col,ci)=>`<div class="column ${suggested?.to===ci?'hint-target':''} ${selected&&canMove(state,selected.column,selected.index,ci)?'can-drop':''}" data-column="${ci}" role="group" aria-label="Column ${ci+1}, ${col.length} cards"><button class="empty-column" data-target="${ci}" aria-label="${col.length?'Move selected run to':'Empty column'} ${ci+1}" ${state.won?'disabled':''}>${col.length?'':'+'}</button>${col.map((c,i)=>`<button class="card ${!c.up?'down':c.suit==='H'?'red':''} ${selected?.column===ci&&selected.index===i?'selected':''} ${suggested?.from===ci&&suggested.index===i?'hint-source':''}" style="z-index:${i+1}" data-column="${ci}" data-index="${i}" data-card-id="${c.id}" aria-label="${c.up?cardName(c):'Face-down card'}, column ${ci+1}${c.up?(movable(state,ci,i)?', movable run':', blocked by cards below'):''}" ${c.up?`aria-pressed="${selected?.column===ci&&selected.index===i}"`:''} ${!c.up||state.won?'disabled':''} draggable="false" data-movable="${!state.won&&movable(state,ci,i)}">${c.up?`<span class="card-corner" aria-hidden="true"><span>${rankArt(c.rank)}</span><span>${suitSymbol(c.suit)}</span></span>${cardArt(c.rank,c.suit)}`:''}</button>`).join('')}</div>`).join('');
 $('#message').textContent=!storageOK?'Browser storage is full. Progress cannot be saved.':message||(selected?`Selected ${rankLabel(state.columns[selected.column][selected.index].rank)}${suitSymbol(state.columns[selected.column][selected.index].suit)} run · choose a column.`:'');
 $('#win').hidden=!state.won;$('.table').classList.toggle('won',state.won);layout();board.style.removeProperty('min-height');
 if(!resetScrollRange){
  const focus=focusId!==undefined?board.querySelector(`[data-card-id="${focusId}"]`):focusTarget!==undefined?board.querySelector(`[data-target="${focusTarget}"]`):null;
  if(focus&&!focus.disabled)focus.focus({preventScroll:true});
 }
 animateCards(old);
 showCompletedRuns(completed,cleared);
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
function clearDrag(){document.querySelectorAll('.drop-target,.drag-hidden').forEach(c=>c.classList.remove('drop-target','drag-hidden'));document.querySelector('.drag-ghost:not(.run-clearance)')?.remove();}
function dragGhost(run){
 const source=$('#board').querySelector('.card[data-column="'+run.column+'"][data-index="'+run.index+'"]'),r=source.getBoundingClientRect(),ghost=document.createElement('div');ghost.className='drag-ghost'+(compact?' compact':'');ghost.setAttribute('aria-hidden','true');ghost.style.width=r.width/zoom+'px';ghost.style.transformOrigin='0 0';ghost.style.setProperty('--card-width',r.width/zoom+'px');ghost.style.setProperty('--card-height',r.height/zoom+'px');
 source.parentElement.querySelectorAll('.card').forEach(c=>{if(+c.dataset.index<run.index)return;const clone=c.cloneNode(true),rect=c.getBoundingClientRect();clone.classList.remove('selected','hint-source');clone.tabIndex=-1;clone.style.top=(rect.top-r.top)/zoom+'px';clone.style.width=r.width/zoom+'px';ghost.append(clone);c.classList.add('drag-hidden');});document.body.append(ghost);run.ghost=ghost;run.left=r.left;run.top=r.top;run.width=r.width;run.height=r.height;run.zoom=zoom;
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
$('#board').addEventListener('pointermove',e=>{if(!dragging)return;if(!dragging.moved&&Math.hypot(e.clientX-dragging.x,e.clientY-dragging.y)>6){dragging.moved=true;dragGhost(dragging);}if(!dragging.moved)return;dragging.ghost.style.transform='translate('+(dragging.left+e.clientX-dragging.x)+'px,'+(dragging.top+e.clientY-dragging.y)+'px) scale('+dragging.zoom+')';document.querySelectorAll('.drop-target').forEach(c=>c.classList.remove('drop-target'));dragDestination(dragging,e.clientX,e.clientY)?.classList.add('drop-target');});
$('#board').addEventListener('pointerup',e=>{if(!dragging)return;const run=dragging;dragging=null;if(!run.moved)return;suppressClickUntil=performance.now()+350;const col=dragDestination(run,e.clientX,e.clientY);motionOrigins=cardPositions();run.ghost.querySelectorAll('.card').forEach(c=>{const r=c.getBoundingClientRect();motionOrigins.set(c.dataset.cardId,{left:r.left,top:r.top,down:false});});clearDrag();if(col){checkpoint();move(state,run.column,run.index,+col.dataset.column);commit();}else{selected={column:run.column,index:run.index};message='Place this run on the next higher rank, or an empty column.';render();}});
$('#board').addEventListener('pointercancel',()=>{dragging=null;clearDrag();});
$('#board').addEventListener('lostpointercapture',()=>{dragging=null;clearDrag();});
$('#deal').addEventListener('click',()=>{if(!canDeal(state)){message='Fill every empty column before dealing.';render();return;}checkpoint();deal(state);commit();});
$('#undo').addEventListener('click',()=>{if(!history.length)return;state=history.pop();commit();});
$('#hint').addEventListener('click',()=>{selected=null;suggested=hint(state);if(suggested){const c=state.columns[suggested.from][suggested.index];message=`Move ${rankLabel(c.rank)}${suitSymbol(c.suit)} from column ${suggested.from+1} to ${suggested.to+1}.`;}else message=canDeal(state)?'No useful move. Deal the next row.':state.stock.length?'Fill the empty columns before dealing. Undo may help.':'No useful move found. Try undo or a new game.';render();});
window.addEventListener('resize',scheduleLayout);window.visualViewport?.addEventListener('resize',scheduleLayout);
new ResizeObserver(scheduleLayout).observe($('.table-scroll'));
new ResizeObserver(scheduleLayout).observe($('.game-controls'));
function changeView(action){
 dragging=null;clearDrag();cancelCompletedRuns();$('#board').querySelectorAll('.card').forEach(card=>card.getAnimations().forEach(animation=>animation.cancel()));
 action();document.body.style.removeProperty('--scroll-floor');window.scrollTo({top:0,left:0,behavior:'instant'});layout({refit:fitted});
}
$('#fit').onclick=()=>changeView(()=>{fitted=true;});
$('#actual').onclick=()=>changeView(()=>{fitted=false;});
$('#compact').onclick=()=>changeView(()=>{compact=!compact;try{localStorage.setItem(VIEW,JSON.stringify({compact}));}catch{}});
function start(){state=newGame(Math.floor(Math.random()*4294967296));history=[];fitted=false;zoom=1;commit({resetScrollRange:true});$('#modal').close();}
function requestNew(){if(state.moves&&!state.won){$('#dialog-title').textContent='Start a new game?';$('#dialog-body').innerHTML='<p>Your current game will be replaced.</p><div class="dialog-actions"><button id="cancel-new">Keep playing</button><button id="confirm-new">New game</button></div>';$('#cancel-new').onclick=()=>$('#modal').close();$('#confirm-new').onclick=start;$('#modal').showModal();}else start();}
$('#new').onclick=requestNew;$('#play-again').onclick=start;$('#close').onclick=()=>$('#modal').close();
$('#help').onclick=()=>{$('#dialog-title').textContent='Two-suit Spider';$('#dialog-body').innerHTML='<ul><li>Build down: put a 7 on any 8.</li><li>Move several cards together only when they descend in the same suit.</li><li>Any card or matching run can fill an empty column.</li><li>A King-to-Ace run in one suit moves to the upper tray. Clear all eight to win.</li><li>Deal adds one card to every column. Fill empty columns first.</li></ul><p>Tap a card or run, then its destination. You can also drag on a computer. Undo reverses moves and deals. Progress saves in this browser.</p><p>Fit zoom shows the whole table at one uniform scale. 100% restores normal size. Compact switches the card style; your choice is remembered. Zoom stays steady during moves. Press Fit zoom again to refit.</p><p class="credits">Original card artwork · <a href="./cards/ABOUT.txt" target="_blank">About the deck</a>.</p>';$('#modal').showModal();};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){selected=null;suggested=null;message='';render();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});window.addEventListener('pagehide',save);save();render();
