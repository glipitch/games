import {dailyKey,dayNumber} from './puzzles.js';
import {variants,dailyCircuit,makeCircuit,flow,applyTurn,undo,reset,hint,validBoard,rotate} from './circuit-engine.js';
const $=s=>document.querySelector(s),params=new URLSearchParams(location.search);
let variant=variants.some(v=>v.id===params.get('variant'))?params.get('variant'):'classic',key=dailyKey(),last=performance.now(),toastTimer;
const storageKey=(v,k)=>'circuit:v2:'+v+':'+k;
// Read legacy progress once; new saves are isolated from older open game tabs.
const cache={get(v,k,f){try{const raw=localStorage.getItem(storageKey(v,k))??localStorage.getItem('signal:v1:'+(v==='classic'?'':v+':')+k);return raw===null?f:JSON.parse(raw)??f;}catch{return f;}},set(v,k,value){try{localStorage.setItem(storageKey(v,k),JSON.stringify(value));}catch{}}};
const dailies={},frees={},records={};
function stats(v){if(!records[v]){const s=cache.get(v,'stats',{days:{}});records[v]=s?.days&&typeof s.days==='object'?s:{days:{}};}return records[v];}
function loadDaily(v){if(!dailies[v]){const b=cache.get(v,'daily:'+key,null);dailies[v]=validBoard(b,'daily',key,v)?b:dailyCircuit(key,v);}return dailies[v];}
let board=loadDaily(variant);
const current=()=>variants.find(v=>v.id===variant);
const time=ms=>{const s=Math.floor(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
function save(){cache.set(variant,board.mode==='daily'?'daily:'+board.key:'free',board);}
function tick(){const now=performance.now();if(board.started&&!board.won&&!document.hidden&&!$('#modal').open)board.elapsed+=Math.min(now-last,2000);last=now;}
function streak(){const days=stats(variant).days;let d=Date.parse(key+'T12:00:00Z'),n=0;if(!days[key])d-=86400000;while(days[new Date(d).toISOString().slice(0,10)]){n++;d-=86400000;}return n;}
const lockSvg='<svg class="lock-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z"/></svg>';
function legend(){
 let html='<span class="key-chip"><i class="sample off"></i>Disconnected</span><span class="key-chip"><i class="sample on"></i>Powered</span>';
 if(variant==='locked')html+='<span class="key-chip">'+lockSvg+'Fixed</span>';
 if(variant==='wrap')html+='<span class="key-chip wrap-key">↔ Opposite edges join</span>';
 if(variant==='split')html='<span class="key-chip"><i class="sample on"></i>A</span><span class="key-chip"><i class="sample blue"></i>B</span><span class="key-chip"><b class="short-key">×</b>Crossed networks</span>';
 $('#legend').innerHTML=html;
}
function top(){
 $('#variants').innerHTML=variants.map(v=>`<button data-variant="${v.id}" class="${variant===v.id?'active':''}" aria-pressed="${variant===v.id}"><span aria-hidden="true">${v.icon}</span>${v.name}</button>`).join('');
 document.querySelectorAll('[data-variant]').forEach(b=>b.addEventListener('click',()=>switchVariant(b.dataset.variant)));
 $('#goal').textContent=current().goal;$('#variant-badge').textContent=current().name;
 for(const mode of ['daily','free']){$('#'+mode).classList.toggle('active',board.mode===mode);$('#'+mode).setAttribute('aria-pressed',board.mode===mode);}
 $('#sizes').hidden=board.mode==='daily';$('#issue').hidden=board.mode==='free';$('#issue').textContent='№ '+String(Math.max(1,dayNumber(key)+1)).padStart(3,'0');
 document.querySelectorAll('[data-size]').forEach(b=>{b.classList.toggle('active',+b.dataset.size===board.size);b.setAttribute('aria-pressed',+b.dataset.size===board.size);});
 $('#streak').textContent=streak()+' day streak';legend();
 const url=new URL(location.href);url.searchParams.set('variant',variant);url.searchParams.set('v','6');if(board.mode==='free')url.searchParams.set('mode','free');else url.searchParams.delete('mode');history.replaceState(null,'',url);
}
function draw(){
 top();const grid=$('#board'),sources=board.sources||[0];grid.style.setProperty('--size',board.size);grid.className='board variant-'+variant;
 grid.innerHTML=board.base.map((mask,i)=>{
  const source=sources.includes(i),group=board.groups?.[i]||0,locked=Boolean(board.locked?.[i]),r=Math.floor(i/board.size),c=i%board.size;
  const edgeMarks=variant==='wrap'?[[r===0,'top','↑'],[r===board.size-1,'bottom','↓'],[c===0,'left','←'],[c===board.size-1,'right','→']].filter(([yes])=>yes).map(([,edge,arrow])=>`<span class="edge-mark edge-${edge}" aria-hidden="true">${arrow}</span>`).join(''):'';
  return `<button class="tile ${source?'source':''} ${locked?'fixed':''} network-${group}" data-tile="${i}" aria-label=""><svg class="wires" viewBox="0 0 80 80" aria-hidden="true"><path class="wire" d="${[[1,'M40 40V0'],[2,'M40 40H80'],[4,'M40 40V80'],[8,'M40 40H0']].filter(([bit])=>mask&bit).map(([,p])=>p).join(' ')}"/><circle class="junction" cx="40" cy="40" r="6"/></svg>${source?'<span class="bolt" aria-hidden="true">ϟ</span>':''}${variant==='split'?'<span class="network-tag" aria-hidden="true">'+(group?'B':'A')+'</span>':''}${locked?'<span class="fixed-mark" aria-hidden="true">'+lockSvg+'</span>':''}${edgeMarks}<span class="short-mark" aria-hidden="true">×</span></button>`;
 }).join('');
 document.querySelectorAll('[data-tile]').forEach((b,i)=>{
  b.addEventListener('click',e=>{tick();if(board.locked?.[i])return toast('Fixed tile');if(applyTurn(board,i,e.shiftKey?-1:1)){save();update();}});
  b.addEventListener('keydown',e=>{let j=i;
   if(e.key==='ArrowUp')j=Math.max(0,i-board.size);else if(e.key==='ArrowDown')j=Math.min(board.base.length-1,i+board.size);else if(e.key==='ArrowLeft')j=i%board.size?i-1:i;else if(e.key==='ArrowRight')j=i%board.size<board.size-1?i+1:i;
   else if(e.key.toLowerCase()==='r'){e.preventDefault();tick();if(applyTurn(board,i,-1)){save();update();}return;}else return;
   e.preventDefault();document.querySelector(`[data-tile="${j}"]`).focus();
  });
 });
 update();
}
function update(){
 const {lit,shorts}=flow(board),n=board.base.length;
 $('#powered').innerHTML=lit.size+'<small>/'+n+'</small>';$('#moves').textContent=board.moves;
 $('#status').textContent=board.won?'✓ Complete':shorts.size?'× Networks crossed':'● Live';$('#status').classList.toggle('warning',shorts.size>0);
 $('#board').classList.toggle('won',board.won);
 document.querySelectorAll('[data-tile]').forEach((el,i)=>{
  el.classList.toggle('powered',lit.has(i));el.classList.toggle('short-circuit',shorts.has(i));el.querySelector('.wires').style.transform=`rotate(${board.turns[i]*90}deg)`;
  el.setAttribute('aria-disabled',board.won||Boolean(board.locked?.[i])||board.base[i]===15);
  const mask=rotate(board.base[i],board.turns[i]),ports=['north','east','south','west'].filter((_,j)=>mask&(1<<j)).join(', ');
  el.setAttribute('aria-label',`Row ${Math.floor(i/board.size)+1}, column ${i%board.size+1}. ${variant==='split'?'Network '+(board.groups[i]?'B':'A')+'. ':''}${(board.sources||[0]).includes(i)?'Power source. ':''}${lit.has(i)?'Powered':'Disconnected'}. ${shorts.has(i)?'Crossed networks. ':''}${board.locked?.[i]?'Fixed tile. ':''}Wires ${ports}.`);
 });
 $('#undo').disabled=!board.history.length;$('#tools').hidden=board.won;$('#result').hidden=!board.won;$('#new').hidden=board.mode!=='free';
 if(board.won){
  const s=stats(variant);if(board.mode==='daily'&&!s.days[board.key]){s.days[board.key]={moves:board.moves,hints:board.hints,elapsed:board.elapsed};cache.set(variant,'stats',s);}
  $('#streak').textContent=streak()+' day streak';
  $('#result').innerHTML=`<h2>Circuit complete ✓</h2><p>${board.moves} moves · ${time(board.elapsed)} · ${board.hints?board.hints+' hints':'No hints'}</p><div class="result-actions"><button id="share" class="primary">Share</button><button id="next" class="secondary">Next circuit →</button></div>`;
  $('#share').addEventListener('click',share);$('#next').addEventListener('click',()=>switchMode('free',true,board.mode==='daily'?4:board.size));save();
 }
 $('#announcement').textContent=board.won?'Circuit complete.':lit.size+' of '+n+' tiles powered.'+(shorts.size?' Networks crossed.':'');
}
function switchMode(mode,fresh=false,size=4){
 tick();save();
 if(mode==='daily')board=loadDaily(variant);
 else{if(!frees[variant]&&!fresh){const old=cache.get(variant,'free',null);if(validBoard(old,'free','',variant))frees[variant]=old;}
  if(!frees[variant]||fresh)frees[variant]=makeCircuit(size,crypto.getRandomValues(new Uint32Array(1))[0],'free','',variant);board=frees[variant];}
 last=performance.now();draw();save();
}
function switchVariant(v){
 if(v===variant)return;tick();save();const mode=board.mode,size=board.size;variant=v;
 board=loadDaily(variant);if(mode==='free')switchMode('free',false,size);else{last=performance.now();draw();save();}
}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2200);}
function open(html){$('#modal-content').innerHTML=html;if(!$('#modal').open)$('#modal').showModal();}
async function share(){
 const text=`Circuit · ${current().name} ${board.mode==='daily'?'#'+Math.max(1,dayNumber(board.key)+1):'Free play'}\n${'🟩'.repeat(board.size)}\n${board.moves} moves · ${board.hints?board.hints+' hints':'No hints'}\n${location.origin}/circuit.html?variant=${variant}&v=6`;
 try{await navigator.clipboard.writeText(text);toast('Result copied');}catch{open('<h2>Share your result</h2><textarea class="share-text" readonly aria-label="Result to copy"></textarea>');$('.share-text').value=text;$('.share-text').select();}
}
$('#daily').addEventListener('click',()=>switchMode('daily'));$('#free').addEventListener('click',()=>switchMode('free'));
document.querySelectorAll('[data-size]').forEach(b=>b.addEventListener('click',()=>{if(board.size!==+b.dataset.size)switchMode('free',true,+b.dataset.size);}));
$('#undo').addEventListener('click',()=>{tick();if(undo(board)){save();update();}});
$('#hint').addEventListener('click',()=>{tick();const i=hint(board);if(i>=0){save();update();const tile=$(`[data-tile="${i}"]`);tile.classList.remove('hint-flash');requestAnimationFrame(()=>tile.classList.add('hint-flash'));}});
$('#reset').addEventListener('click',()=>{if(!board.moves)return;open('<h2>Reset this board?</h2><div class="result-actions"><button class="primary" id="confirm-reset">Reset</button><button class="secondary" id="cancel-reset">Keep playing</button></div>');$('#confirm-reset').addEventListener('click',()=>{reset(board);save();$('#modal').close();draw();});$('#cancel-reset').addEventListener('click',()=>$('#modal').close());});
const newButton=document.createElement('button');newButton.id='new';newButton.textContent='↻ New';newButton.hidden=true;$('#tools').append(newButton);newButton.addEventListener('click',()=>switchMode('free',true,board.size));
$('#help').addEventListener('click',()=>{open('<h2>Tap to turn. Connect to power.</h2><p>Each tap rotates a tile clockwise. Shift-click or R turns it backwards. Arrow keys move between tiles.</p><ul><li><b>Classic:</b> power every tile from the bolt.</li><li><b>Wrap:</b> wires continue through the opposite edge.</li><li><b>Locked:</b> padlocked tiles cannot turn.</li><li><b>Split:</b> connect A to A and B to B. A red × marks a forbidden join.</li></ul><p>Each mode has its own daily puzzle and saved progress. Free play offers 3×3, 4×4 and 5×5 boards.</p>');});
$('#close').addEventListener('click',()=>$('#modal').close());$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
document.addEventListener('visibilitychange',()=>{last=performance.now();save();});window.addEventListener('pagehide',()=>{tick();save();});
setInterval(()=>{tick();save();const today=dailyKey();if(today!==key){key=today;for(const k of Object.keys(dailies))delete dailies[k];if(board.mode==='daily')board=loadDaily(variant);draw();}},1000);
if(params.get('mode')==='free')switchMode('free');else draw();
