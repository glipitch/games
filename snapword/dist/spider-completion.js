import {cardArt} from './spider-cards.js?v=14';
import {rankArt} from './spider-ranks.js?v=14';
import {suitSymbol} from './spider-engine.js?v=7';

const flights=new Set();let noticeTimer;
export function captureCompletedRuns(runs,board,positions){
 return runs.map(run=>{
  const king=board.querySelector(`[data-card-id="${run[0].id}"]`),origin=king?.getBoundingClientRect();
  if(!origin)return null;
  return {suit:run[0].suit,compact:board.classList.contains('compact'),cards:run.map(card=>{
   const source=board.querySelector(`[data-card-id="${card.id}"]`),rect=source?.getBoundingClientRect()||origin,p=positions.get(String(card.id))||rect;
   const clone=source?.cloneNode(true)||document.createElement('span');
   clone.className='card'+(card.suit==='H'?' red':'');clone.tabIndex=-1;clone.setAttribute('aria-hidden','true');
   if(!source)clone.innerHTML=`<span class="card-corner"><span>${rankArt(card.rank)}</span><span>${suitSymbol(card.suit)}</span></span>${cardArt(card.rank,card.suit)}`;
   return {clone,left:p.left,top:p.top,width:rect.width,height:rect.height};
  })};
 }).filter(Boolean);
}
export function cancelCompletedRuns(){
 clearTimeout(noticeTimer);document.querySelector('#completion-notice').hidden=true;
 for(const flight of flights){flight.animations.forEach(animation=>animation.cancel());flight.element.remove();}
 flights.clear();document.querySelectorAll('#completed .receiving').forEach(slot=>slot.classList.remove('receiving'));
}
export function showCompletedRuns(runs,first){
 if(!runs.length)return;
 const notice=document.querySelector('#completion-notice'),suits=runs.map(run=>run.suit==='H'?'Hearts':'Spades');
 notice.textContent=`${runs.length===1?suits[0]+' run complete':runs.length+' runs complete'} · moved to the upper tray.`;
 notice.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.hidden=true,3200);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(reduced)return;
 runs.forEach((run,index)=>{
  const slotIndex=first+index,slot=document.querySelector('#completed').children[slotIndex];if(!slot)return;
  const target=slot.getBoundingClientRect(),king=run.cards[0];
  const visible=run.cards.filter(card=>card.top+card.height>0&&card.top<innerHeight);
  const start=visible.at(-1)||king,gatherX=Math.max(8,Math.min(king.left,innerWidth-king.width-8)),gatherY=Math.max(12,Math.min(start.top,innerHeight-king.height-24));
  const group=document.createElement('div');group.className='drag-ghost run-clearance'+(run.compact?' compact':'');group.setAttribute('aria-hidden','true');
  group.style.setProperty('--card-width',king.width+'px');group.style.setProperty('--card-height',king.height+'px');
  const flight={element:group,animations:[]};flights.add(flight);slot.classList.add('receiving');
  for(const [i,card] of run.cards.entries()){
   const clone=card.clone;clone.style.cssText=`left:${card.left}px;top:${card.top}px;width:${card.width}px;height:${card.height}px;z-index:${i+1};transform-origin:0 0`;
   group.append(clone);
   const gather=`translate(${gatherX-card.left}px,${gatherY+Math.min(i,3)*2-card.top}px) scale(1)`,land=`translate(${target.left-card.left}px,${target.top-card.top}px) scale(${target.width/card.width},${target.height/card.height})`;
   flight.animations.push(clone.animate([{transform:'translate(0,0) scale(1)',opacity:1,offset:0,easing:'cubic-bezier(.25,.65,.3,1)'},{transform:gather,opacity:1,offset:.42},{transform:gather,opacity:1,offset:.58,easing:'cubic-bezier(.25,.65,.3,1)'},{transform:land,opacity:.15,offset:1}],{duration:900,delay:i*7,easing:'linear',fill:'both'}));
  }
  document.body.append(group);
  Promise.all(flight.animations.map(animation=>animation.finished.catch(()=>{}))).then(()=>{
   if(!flights.delete(flight))return;
   group.remove();const current=document.querySelector('#completed').children[slotIndex];current?.classList.remove('receiving');
   current?.animate([{boxShadow:'0 0 0 4px #f1d98899',transform:'scale(1.18)'},{boxShadow:'0 0 0 0 transparent',transform:'scale(1)'}],{duration:400});
  });
 });
}
