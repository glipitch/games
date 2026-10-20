import {variants,sizes,makeCircuit,flow,applyTurn,undo,reset,hint,nextHint,rotate} from './circuit-engine.js?v=9';
import {circuitStorage} from './circuit-storage.js?v=9';

const $=s=>document.querySelector(s),params=new URLSearchParams(location.search);
let browserStorage;try{browserStorage=localStorage;}catch{}
const cache=circuitStorage(browserStorage),settings=cache.settings();
let variant=variants.some(v=>v.id===params.get('variant'))?params.get('variant'):settings.variant;
let size=sizes.includes(Number(params.get('size')))?Number(params.get('size')):settings.size;
const requestedSeed=params.get('seed');
let shared=requestedSeed!==null&&/^\d{1,10}$/.test(requestedSeed)&&Number(requestedSeed)<=0xffffffff;
let board=cache.load(variant,size,shared?Number(requestedSeed):undefined),last=performance.now(),toastTimer,zoom=1;
const current=()=>variants.find(v=>v.id===variant);
const time=ms=>{const s=Math.floor(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const lockSvg='<svg class="lock-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z"/></svg>';

function save(){
 cache.save(board,shared);
 $('#save-status').textContent=cache.available?'Progress saved on this device · Every mode and size keeps its own board':'Saving is unavailable in this browser. Keep this tab open to retain your progress.';
 $('#save-status').hidden=cache.available;
}
function tick(){const now=performance.now();if(board.started&&!board.won&&!document.hidden&&!$('#modal').open&&!$('#puzzle-settings').open)board.elapsed+=Math.min(now-last,2000);last=now;}
function route(){
 const url=new URL(location.href);url.searchParams.set('variant',variant);url.searchParams.set('size',size);
 for(const k of ['mode','v'])url.searchParams.delete(k);
 if(shared)url.searchParams.set('seed',board.seed);else url.searchParams.delete('seed');
 history.replaceState(null,'',url);
}
function legend(){
 let html='<span class="key-chip"><i class="sample off"></i>Disconnected</span><span class="key-chip"><i class="sample on"></i>Powered</span>';
 if(variant==='locked')html+='<span class="key-chip">'+lockSvg+'Fixed</span>';
 if(variant==='wrap')html+='<span class="key-chip wrap-key">↔ Opposite edges join</span>';
 if(variant==='split')html='<span class="key-chip"><i class="sample on"></i>A</span><span class="key-chip"><i class="sample blue"></i>B</span><span class="key-chip"><b class="short-key">×</b>Crossed networks</span>';
 if(variant==='mesh')html+='<span class="key-chip"><b class="short-key">○</b>Loose wire ends</span>';
 if(variant==='barriers')html+='<span class="key-chip"><i class="wall-sample"></i>Wall</span>';
 $('#legend').innerHTML=html;
}
function top(){
 document.querySelectorAll('[data-variant]').forEach(b=>{b.classList.toggle('active',b.dataset.variant===variant);b.setAttribute('aria-pressed',b.dataset.variant===variant);});
 $('#goal').textContent=current().goal;$('#variant-badge').textContent=current().name;$('#size').value=size;
 $('#settings-summary').textContent=current().name+' · '+size+'×'+size;
 $('#puzzle-label').textContent=shared?'Shared puzzle':'Unlimited puzzles';
 $('#hint-message').hidden=true;legend();route();
}
function draw(){
 top();const grid=$('#board'),sources=board.sources||[0];grid.style.setProperty('--size',size);grid.className='board variant-'+variant;
 grid.innerHTML=board.base.map((mask,i)=>{
  const source=sources.includes(i),group=board.groups?.[i]||0,locked=Boolean(board.locked?.[i]),r=Math.floor(i/size),c=i%size;
  const edgeMarks=variant==='wrap'?[[r===0,'top','↑'],[r===size-1,'bottom','↓'],[c===0,'left','←'],[c===size-1,'right','→']].filter(([yes])=>yes).map(([,edge,arrow])=>`<span class="edge-mark edge-${edge}" aria-hidden="true">${arrow}</span>`).join(''):'';
  const walls=board.walls?.[i]||0,wallMarks=[[1,'top'],[2,'right'],[4,'bottom'],[8,'left']].filter(([bit])=>walls&bit).map(([,edge])=>`<span class="wall wall-${edge}" aria-hidden="true"></span>`).join('');
  return `<button class="tile ${source?'source':''} ${locked?'fixed':''} network-${group}" data-tile="${i}"><svg class="wires" viewBox="0 0 80 80" aria-hidden="true"><path class="wire" d="${[[1,'M40 40V0'],[2,'M40 40H80'],[4,'M40 40V80'],[8,'M40 40H0']].filter(([bit])=>mask&bit).map(([,p])=>p).join(' ')}"/><circle class="junction" cx="40" cy="40" r="6"/></svg>${source?'<span class="bolt" aria-hidden="true">ϟ</span>':''}${variant==='split'?'<span class="network-tag" aria-hidden="true">'+(group?'B':'A')+'</span>':''}${locked?'<span class="fixed-mark" aria-hidden="true">'+lockSvg+'</span>':''}${edgeMarks}${wallMarks}<span class="short-mark" aria-hidden="true">×</span><span class="loose-mark" aria-hidden="true">○</span></button>`;
 }).join('');
 document.querySelectorAll('[data-tile]').forEach((b,i)=>{
  b.addEventListener('click',e=>{tick();if(board.locked?.[i])return toast('This tile is fixed');if(applyTurn(board,i,e.shiftKey?-1:1)){save();update();}});
  b.addEventListener('keydown',e=>{let j=i;
   if(e.key==='ArrowUp')j=Math.max(0,i-size);else if(e.key==='ArrowDown')j=Math.min(board.base.length-1,i+size);else if(e.key==='ArrowLeft')j=i%size?i-1:i;else if(e.key==='ArrowRight')j=i%size<size-1?i+1:i;
   else if(e.key.toLowerCase()==='r'){e.preventDefault();tick();if(applyTurn(board,i,-1)){save();update();}return;}else return;
   e.preventDefault();document.querySelector(`[data-tile="${j}"]`).focus();
  });
 });
 update();setZoom(1);$('#board-viewport').scrollTo(0,0);
}
function update(){
 const {lit,shorts,loose}=flow(board),n=board.base.length;
 $('#powered').innerHTML=lit.size+'<small>/'+n+'</small>';$('#moves').textContent=board.moves;
 $('#status').textContent=board.won?'✓ Complete':shorts.size?'× Networks crossed':variant==='mesh'&&loose.size?loose.size+' loose tiles':'● Live';
 $('#status').classList.toggle('warning',shorts.size>0);$('#board').classList.toggle('won',board.won);
 $('#status').hidden=!board.won&&!shorts.size&&!(variant==='mesh'&&loose.size);
 document.querySelectorAll('[data-tile]').forEach((el,i)=>{
  el.classList.toggle('powered',lit.has(i));el.classList.toggle('short-circuit',shorts.has(i));el.classList.toggle('loose',variant==='mesh'&&loose.has(i));el.querySelector('.wires').style.transform=`rotate(${board.turns[i]*90}deg)`;
  el.setAttribute('aria-disabled',board.won||Boolean(board.locked?.[i])||board.base[i]===15);
  const mask=rotate(board.base[i],board.turns[i]),ports=['north','east','south','west'].filter((_,j)=>mask&(1<<j)).join(', '),walls=['north','east','south','west'].filter((_,j)=>board.walls?.[i]&(1<<j));
  el.setAttribute('aria-label',`Row ${Math.floor(i/size)+1}, column ${i%size+1}. ${variant==='split'?'Network '+(board.groups[i]?'B':'A')+'. ':''}${(board.sources||[0]).includes(i)?'Power source. ':''}${lit.has(i)?'Powered':'Disconnected'}. ${shorts.has(i)?'Crossed networks. ':''}${variant==='mesh'&&loose.has(i)?'Loose wire end. ':''}${board.locked?.[i]?'Fixed tile. ':''}Wires ${ports}.${walls.length?' Walls '+walls.join(', ')+'.':''}`);
 });
 $('#undo').disabled=board.won||!board.history.length;$('#tools').hidden=board.won;$('#result').hidden=!board.won;
 if(board.won){
  $('#result').innerHTML=`<h2>Circuit complete ✓</h2><p>${current().name} · ${size}×${size}<br>${board.moves} moves · ${time(board.elapsed)} · ${board.hints?board.hints+' hints':'No hints'}</p><div class="result-actions"><button id="share" class="secondary">Share puzzle & result</button><button id="next" class="primary">Next puzzle →</button></div>`;
  $('#share').addEventListener('click',share);$('#next').addEventListener('click',newBoard);
 }
 $('#announcement').textContent=board.won?'Circuit complete.':lit.size+' of '+n+' tiles powered.'+(shorts.size?' Networks crossed.':'');
}
function switchBoard(v,s){
 if(v===variant&&s===size)return;
 tick();save();variant=v;size=s;shared=false;board=cache.load(variant,size);cache.saveSettings(variant,size);last=performance.now();draw();save();
}
function newBoard(){
 $('#puzzle-settings').close();
 const create=()=>{tick();save();board=makeCircuit(size,crypto.getRandomValues(new Uint32Array(1))[0],'play','',variant);last=performance.now();draw();save();};
 if(!board.won&&(board.started||board.history.length))confirm('Start a new puzzle?','This replaces your current '+current().name+' '+size+'×'+size+' puzzle.','New puzzle',create);else create();
}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2400);}
function open(html){$('#modal-content').innerHTML=html;if(!$('#modal').open)$('#modal').showModal();}
function confirm(title,description,label,action){
 open(`<h2>${title}</h2><p>${description}</p><div class="result-actions"><button class="primary" id="confirm-action">${label}</button><button class="secondary" id="cancel-action">Keep playing</button></div>`);
 $('#confirm-action').addEventListener('click',()=>{$('#modal').close();action();});$('#cancel-action').addEventListener('click',()=>$('#modal').close());
}
function puzzleLink(){
 const url=new URL('./circuit.html',location.href);url.search=new URLSearchParams({variant,size,seed:board.seed});return url.href;
}
async function share(){
 const text=`Circuit · ${current().name} · ${size}×${size}\n${board.moves} moves · ${time(board.elapsed)} · ${board.hints?board.hints+' hints':'No hints'}\nPlay the same puzzle: ${puzzleLink()}`;
 try{await navigator.clipboard.writeText(text);toast('Puzzle and result copied');}catch{open('<h2>Share your result</h2><textarea class="share-text" readonly aria-label="Result to copy"></textarea>');$('.share-text').value=text;$('.share-text').select();}
}
function setZoom(value){
 const viewportWidth=$('#board-viewport').clientWidth,gap=parseFloat(getComputedStyle($('#board')).gap)||2;
 const maximum=Math.max(2.5,Math.ceil(((44+gap)*size+12)/viewportWidth*2)/2);
 zoom=Math.max(1,Math.min(maximum,value));$('#board').style.width=(zoom*100)+'%';$('#zoom-out').disabled=zoom===1;$('#zoom-in').disabled=zoom>=maximum;$('#fit').textContent=zoom===1?'Fit':Math.round(zoom*100)+'%';
 $('#board-tip').textContent='Scroll to explore · Fit is in puzzle settings';
 $('#board-tip').hidden=zoom===1;
}
$('#variants').innerHTML=variants.map(v=>`<button data-variant="${v.id}"><span aria-hidden="true">${v.icon}</span>${v.name}</button>`).join('');
document.querySelectorAll('[data-variant]').forEach(b=>b.addEventListener('click',()=>switchBoard(b.dataset.variant,size)));
$('#settings-toggle').addEventListener('click',()=>{$('#puzzle-settings').showModal();setZoom(zoom);});
for(const id of ['close-settings','continue'])$('#'+id).addEventListener('click',()=>$('#puzzle-settings').close());
$('#puzzle-settings').addEventListener('click',e=>{if(e.target!==$('#puzzle-settings'))return;const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();});
$('#size').innerHTML=sizes.map(s=>`<option value="${s}">${s} × ${s}</option>`).join('');
$('#size').addEventListener('change',e=>switchBoard(variant,Number(e.target.value)));
$('#new').addEventListener('click',newBoard);
$('#undo').addEventListener('click',()=>{tick();if(undo(board)){$('#hint-message').hidden=true;save();update();}});
$('#hint').addEventListener('click',()=>{tick();const explanation=nextHint(board),i=hint(board);if(i>=0){save();update();$('#hint-message').textContent=explanation.text;$('#hint-message').hidden=false;const tile=$(`[data-tile="${i}"]`);tile.classList.remove('hint-flash');tile.scrollIntoView({block:'nearest',inline:'nearest'});requestAnimationFrame(()=>tile.classList.add('hint-flash'));}});
$('#reset').addEventListener('click',()=>{if(!board.moves&&!board.history.length)return;$('#puzzle-settings').close();confirm('Restart this puzzle?','Restore the starting positions and clear your moves and hints.','Restart',()=>{reset(board);save();draw();});});
$('#zoom-out').addEventListener('click',()=>setZoom(zoom-.5));$('#zoom-in').addEventListener('click',()=>setZoom(zoom+.5));$('#fit').addEventListener('click',()=>{setZoom(1);$('#board-viewport').scrollTo(0,0);});
$('#help').addEventListener('click',()=>{$('#puzzle-settings').close();open('<h2>Turn the tiles. Connect the power.</h2><p>Tap to rotate clockwise. Shift-click or press R on a focused tile to turn backwards. Use arrow keys to move between tiles.</p><ul><li><b>Classic:</b> connect every tile to the power source.</li><li><b>Wrap:</b> opposite edges of the board connect.</li><li><b>Locked:</b> fixed tiles give you starting clues.</li><li><b>Split:</b> power networks A and B separately. A red × marks a forbidden connection.</li><li><b>Mesh:</b> the network contains loops. Power every tile and connect every wire end. A small circle marks a tile with a loose end.</li><li><b>Barriers:</b> striped walls block connections between adjacent tiles.</li></ul><p>Choose any size from 3×3 to 10×10. Each mode and size keeps its own puzzle. New puzzle replaces only the current board; switching modes or sizes keeps your work.</p><p>Use + to enlarge the tiles and scroll around the board; Fit shows the whole board. Hints explain a forced orientation where possible, otherwise reveal a move from one valid solution. Some puzzles can have more than one solution; every valid completion counts.</p><p>Progress stays in this browser. Share a completed puzzle to let someone play the same board.</p>');});
$('#close').addEventListener('click',()=>$('#modal').close());$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
document.addEventListener('visibilitychange',()=>{last=performance.now();save();});window.addEventListener('pagehide',()=>{tick();save();});
setInterval(()=>{tick();if(board.started&&!board.won)save();},1000);
cache.saveSettings(variant,size);draw();save();
