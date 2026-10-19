import {games} from './arcade-data.js?v=6';
import {dailyKey,dayNumber,random,shuffle} from './puzzles.js';
import {makePuzzle,validState,choose,checkSelection,combine,undoMove,nudge,neighbours,slideNeighbours,fractionText,calculate} from './arcade-engine.js?v=6';
const $=s=>document.querySelector(s);
const id=new URLSearchParams(location.search).get('game')||'shift';
const game=games.find(g=>g.id===id)||games[0];
const cache={get(k,f){try{return JSON.parse(localStorage.getItem('clicks:v1:'+game.id+':'+k))??f;}catch{return f;}},set(k,v){try{localStorage.setItem('clicks:v1:'+game.id+':'+k,JSON.stringify(v));}catch{}}};
let key=dailyKey(),stats=cache.get('stats',{days:{}});if(!stats?.days||typeof stats.days!=='object')stats={days:{}};
function dailyLoad(){const old=cache.get('daily:'+key,null);return validState(old,game.id,'daily',key)?old:makePuzzle(game.id,'daily',key);}
let daily=dailyLoad(),free=null,state=daily,last=performance.now(),toastTimer;
const time=ms=>{const s=Math.floor(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const ordinal=()=>Math.max(1,dayNumber(key)+1);
const colours=['#eddaa8','#cde0b7','#c8d8e9','#dcc9e8'];
document.documentElement.style.setProperty('--accent',game.colour);
document.title=game.name+' — Little Clicks';
$('#game-kind').textContent=game.kind==='Words'?'A LITTLE WORD PLAY':'A LITTLE LOGIC. A LOT OF AHA.';
$('#game-title').innerHTML=game.name+'<span>.</span>';
const headerLogo=$('.collection-logo');
headerLogo.replaceChildren(headerLogo.querySelector('.collection-mark'),$('#game-title'));
$('#game-description').textContent=game.description;
$('#puzzle-instruction').textContent=game.instruction;
$('#aside-title').textContent=game.tag+'.';
$('#aside-help').textContent={shift:'One letter changes everything. Take a direct route, or find your way back from a detour.',quartet:'A few familiar words. A few unexpected connections. Look twice.',weave:'The words are already here. Follow the clues, then follow the letters.',flip:'A tap helps one light and changes its neighbours. Think in little crosses.',slide:'The gap is part of the puzzle. Sometimes you need to move a tile away to bring it home.',twentyfour:'A familiar handful of numbers. A surprisingly satisfying little calculation.'}[game.id];
const nav=[{id:'snapword',name:'Snapword',colour:'#d5ef55',url:'./?v=6'},{id:'signal',name:'Circuit',colour:'#bcd57d',url:'./circuit.html?v=6'},...games.map(g=>({...g,url:'./play.html?game='+g.id+'&v=6'})),{id:'spider',name:'Spider',colour:'#94d7b2',url:'./spider.html?v=7'}];
$('#game-list').innerHTML=nav.map(g=>`<a href="${g.url}" class="${g.id===game.id?'active':''}" ${g.id===game.id?'aria-current="page"':''}><i class="nav-dot" style="--dot:${g.colour}"></i>${g.name}<span>↗</span></a>`).join('');
function save(){cache.set(state.mode==='daily'?'daily:'+state.key:'free',state);}
function tick(){const now=performance.now();if(state.started&&!state.done&&!document.hidden&&!$('#modal').open)state.elapsed+=Math.min(now-last,2000);last=now;}
function streak(){let d=Date.parse(key+'T12:00:00Z'),n=0;if(!stats.days[key]?.won)d-=86400000;while(stats.days[new Date(d).toISOString().slice(0,10)]?.won){n++;d-=86400000;}return n;}
function record(){if(state.done&&state.mode==='daily'&&!stats.days[state.key]){stats.days[state.key]={won:state.won,moves:state.moves,hints:state.hints,time:state.elapsed};cache.set('stats',stats);}}
function metric(value,label,right=false){return `<div class="${right?'metric-right':''}"><div class="metric-value">${value}</div><span class="metric-label">${label}</span></div>`;}
function renderMetrics(){
 let a,b,centre='';
 if(game.id==='shift'){a=metric(state.moves,'MOVES');b=metric(state.par,'SHORTEST ROUTE',true);centre='One letter at a time.<br>Every step is a real word.';}
 if(game.id==='quartet'){a=metric(state.found.length+'<span>/4</span>','GROUPS FOUND');b=metric(4-state.strikes,'MISTAKES LEFT',true);centre='Four words.<br>One shared connection.';}
 if(game.id==='weave'){a=metric(state.found.length+'<span>/4</span>','WORDS FOUND');b=metric(state.moves,'CHECKS',true);centre='Four clues.<br>Four little trails.';}
 if(game.id==='flip'){a=metric(state.lights.filter(n=>!n).length+'<span>/16</span>','LIGHTS OFF');b=metric(state.moves,'TAPS',true);centre='A tap flips a cross.<br>Make it all go quiet.';}
 if(game.id==='slide'){a=metric(state.tiles.filter((n,i)=>n&&n===i+1).length+'<span>/8</span>','IN PLACE');b=metric(state.moves,'MOVES',true);centre='A little order.<br>One gap to work with.';}
 if(game.id==='twentyfour'){a=metric('24','YOUR TARGET');b=metric(state.values.length,'NUMBERS LEFT',true);centre='Use every number.<br>Fractions are welcome.';}
 $('#metrics').innerHTML=a+`<div class="metric-centre">${centre}</div>`+b;
}
function renderShift(){
 const s=state,options=neighbours.get(s.current)||[];
 return `<div class="word-goal"><div><span class="tiny-label">YOU ARE HERE</span><span class="big-word">${s.current}</span></div><span class="goal-arrow">→</span><div><span class="tiny-label">REACH THIS</span><span class="target-word">${s.target}</span></div></div><div class="word-trail" aria-label="Your word path">${s.trail.length>7?'<i>…</i>':''}${s.trail.slice(-7).map((w,i)=>`${i?'<i>→</i>':''}<span>${w}</span>`).join('')}</div>${s.done?'':`<p class="option-label">CHOOSE YOUR NEXT WORD</p><div class="word-options">${options.map(w=>`<button class="word-option" data-pick="${w}" aria-label="Change to ${w}">${[...w].map((c,i)=>s.current[i]!==c?'<b>'+c+'</b>':c).join('')}</button>`).join('')}</div>`}`;
}
function renderQuartet(){
 const s=state,shown=s.done?[...s.found,...s.groups.map((_,i)=>i).filter(i=>!s.found.includes(i))]:s.found;
 return shown.map(i=>`<div class="quartet-found ${s.found.includes(i)?'':'revealed'}" style="--group-colour:${colours[i]}"><strong>${s.groups[i].label}</strong><span>${s.groups[i].words.join(' · ')}</span></div>`).join('')+(s.done?'':`<div class="quartet-grid">${s.order.filter(w=>!s.found.some(i=>s.groups[i].words.includes(w))).map(w=>`<button class="quartet-word ${s.selected.includes(w)?'selected':''}" data-pick="${w}" aria-pressed="${s.selected.includes(w)}">${w}</button>`).join('')}</div><div class="selection-actions"><button id="shuffle" class="shuffle-button" aria-label="Shuffle words">⇄</button><button id="check" class="primary-button" ${s.selected.length!==4?'disabled':''}>Check group ↵</button></div><div class="mistakes">Mistakes remaining ${[0,1,2,3].map(i=>`<i class="${i>=4-s.strikes?'used':''}"></i>`).join('')}</div>`);
}
function renderWeave(){
 const s=state,old=new Set(s.foundPaths.flat());
 const points=path=>path.map(i=>`${(i%4+.5)*100},${(Math.floor(i/4)+.5)*100}`).join(' ');
 return `<div class="weave-grid" aria-label="Letter grid">${s.letters.map((l,i)=>`<button class="weave-cell ${s.selected.includes(i)?'selected':''} ${old.has(i)?'found':''}" data-pick="${i}" aria-label="Row ${Math.floor(i/4)+1}, column ${i%4+1}: ${l}" aria-pressed="${s.selected.includes(i)}" ${s.done?'disabled':''}><span>${l}</span></button>`).join('')}<svg class="weave-lines" viewBox="0 0 400 400" aria-hidden="true">${s.foundPaths.map(p=>`<polyline class="old-line" points="${points(p)}"/>`).join('')}<polyline points="${points(s.selected)}"/></svg></div>${s.done?'':`<div class="traced-word" aria-label="Selected word">${s.selected.length?s.selected.map(i=>s.letters[i]).join(''):'· · · ·'}</div><div class="selection-actions"><button class="primary-button" id="check" ${s.selected.length!==4?'disabled':''}>Check word ↵</button></div>`}<div class="weave-clues">${s.targets.map((t,i)=>`<div class="weave-clue ${s.found.includes(i)?'done':''}"><span>${s.found.includes(i)?'✓':i+1}</span><div>${s.found.includes(i)?'<b>'+t.word+'</b><br>':''}${t.clue}</div></div>`).join('')}</div>`;
}
function renderFlip(){return `<div class="flip-grid" aria-label="Lightbulb grid">${state.lights.map((on,i)=>`<button class="flip-cell ${on?'on':'off'}" data-pick="${i}" aria-label="Row ${Math.floor(i/4)+1}, column ${i%4+1}, bulb ${on?'ON':'OFF'}. Toggle this bulb and its neighbours" aria-pressed="${Boolean(on)}" ${state.done?'disabled':''}><svg class="bulb-icon" viewBox="0 0 48 48" aria-hidden="true"><path class="bulb-glass" d="M17 29c0-4-5-6-5-13a12 12 0 0 1 24 0c0 7-5 9-5 13l-2 4H19Z"/><path class="bulb-filament" d="m20 21 4 5 4-5M24 26v7M19 36h10M20 40h8"/>${on?'<g class="bulb-rays"><path d="M24 0v3M6 5l3 3M0 17h5M43 17h5M39 8l3-3M5 30l4-3M39 27l4 3"/></g>':'<path class="bulb-strike" d="M7 5 41 39"/>'}</svg><span class="bulb-state"><i aria-hidden="true"></i>${on?'ON':'OFF'}</span></button>`).join('')}</div>`;}
function renderSlide(){return `<div class="slide-grid" aria-label="Sliding puzzle">${state.tiles.map((n,i)=>`<button class="slide-tile ${!n?'gap':n===i+1?'correct':''}" style="--tone:${91-n*1.65}%" data-pick="${i}" aria-label="${n?'Slide tile '+n:'Empty space'}" ${!n||state.done?'disabled':''}>${n||'<span></span>'}</button>`).join('')}</div><div class="grid-note"><span>Target: 1 2 3 / 4 5 6 / 7 8 gap</span><div class="slide-reference" aria-hidden="true">${Array.from({length:9},()=>'<i></i>').join('')}</div></div>`;}
function renderTwentyFour(){
 const s=state,[i,j]=s.selected;
 return `<div class="number-bank ${s.values.length===1?'one-number':s.values.length===2?'two-numbers':s.values.length===3?'three-numbers':''}" aria-label="Available numbers">${s.values.map((v,n)=>`<button class="number-tile ${s.selected.includes(n)?'selected':''}" data-pick="${n}" aria-label="Number ${fractionText(v)}${s.selected.includes(n)?', selected '+(s.selected.indexOf(n)+1):''}" aria-pressed="${s.selected.includes(n)}" ${s.done?'disabled':''}>${s.selected.includes(n)?'<span class="selection-order">'+(s.selected.indexOf(n)+1)+'</span>':''}${fractionText(v)}</button>`).join('')}</div>${s.done?'':`<div class="operator-preview">${s.selected.length===2?`<b>${fractionText(s.values[i])}</b> then <b>${fractionText(s.values[j])}</b>`:'Select two numbers, then an operation.'}</div><div class="operator-buttons" aria-label="Operations">${['+','−','×','÷'].map(op=>`<button data-op="${op}" aria-label="${{'+':'Add','−':'Subtract','×':'Multiply','÷':'Divide'}[op]} selected numbers" ${s.selected.length!==2||!calculate(s.values[i],s.values[j],op)?'disabled':''}>${op}</button>`).join('')}</div>`}<div class="calculation-list" aria-label="Your calculations">${s.calculations.length?s.calculations.map(c=>'<p>'+c+'</p>').join(''):'<p class="empty-calculation">Your little chain of calculations appears here.</p>'}</div>`;
}
function render(){
 record();const active=document.activeElement?.getAttribute('data-pick');
 document.body.classList.toggle('won',state.won);
 $('#daily').classList.toggle('active',state.mode==='daily');$('#free').classList.toggle('active',state.mode==='free');
 $('#daily').setAttribute('aria-pressed',state.mode==='daily');$('#free').setAttribute('aria-pressed',state.mode==='free');
 $('#issue').textContent=state.mode==='daily'?'DAILY № '+String(ordinal()).padStart(3,'0'):'JUST FOR THE JOY OF IT';
 $('#streak').textContent=streak();renderMetrics();
 $('#game-content').innerHTML=({shift:renderShift,quartet:renderQuartet,weave:renderWeave,flip:renderFlip,slide:renderSlide,twentyfour:renderTwentyFour})[game.id]();
 $('#message').textContent=state.message||'';
 $('#message').classList.toggle('success',state.won);$('#tools').hidden=state.done;$('#result').hidden=!state.done;
 const selectionGame=['quartet','weave'].includes(game.id);$('#undo').hidden=selectionGame;$('#clear').hidden=!selectionGame;$('#undo').disabled=!state.history.length;$('#clear').disabled=!state.selected?.length;
 $('#footnote').textContent=state.done?(state.mode==='daily'?'Daily result saved. A fresh puzzle at midnight, London time.':'Just for the joy of it. Fancy another?'):'No timer pressure. Just a little headspace.';
 document.querySelectorAll('[data-pick]').forEach(b=>b.addEventListener('click',()=>run(()=>choose(state,game.id==='shift'||game.id==='quartet'?b.dataset.pick:Number(b.dataset.pick)))));
 document.querySelectorAll('[data-op]').forEach(b=>b.addEventListener('click',()=>run(()=>combine(state,b.dataset.op))));
 $('#check')?.addEventListener('click',()=>run(()=>checkSelection(state)));
 $('#shuffle')?.addEventListener('click',()=>{state.order=shuffle(state.order,random(Date.now()>>>0));save();render();});
 if(game.id==='flip')document.querySelectorAll('.flip-cell').forEach((b,i)=>{
  b.addEventListener('pointerenter',()=>{const r=Math.floor(i/4),c=i%4;document.querySelectorAll('.flip-cell').forEach((el,j)=>el.classList.toggle('affected',Math.abs(Math.floor(j/4)-r)+Math.abs(j%4-c)<=1));});
  b.addEventListener('pointerleave',()=>document.querySelectorAll('.flip-cell').forEach(el=>el.classList.remove('affected')));
 });
 if(state.done)renderResult();
 else if(active!==null)document.querySelector(`[data-pick="${active}"]`)?.focus({preventScroll:true});
}
function run(action){tick();const before=state.done,changed=action();if(changed)state.started=true;save();render();if(!before&&state.done){$('#game-content').classList.add('win-board');$('#share')?.focus({preventScroll:false});}}
function renderResult(){
 const title=state.won?({shift:'A lovely change of word.',quartet:'Four kinds of clever.',weave:'All the little threads, found.',flip:'Lights out. Brain on.',slide:'Everything in its place.',twentyfour:'A perfect little 24.'})[game.id]:'A few new connections.';
 const detail=state.won?`${state.moves} ${game.id==='weave'||game.id==='quartet'?'checks':'moves'} · ${time(state.elapsed)} · ${state.hints?state.hints+' '+(state.hints===1?'nudge':'nudges'):'All you. No hints.'}`:`${state.found.length}/4 groups found. The next set is a fresh start.`;
 $('#result').innerHTML=`<div class="result-symbol" aria-hidden="true">✳</div><h2>${title}</h2><p>${detail}</p><button class="primary-button" id="share">Share result</button><button class="secondary-button" id="next">${state.mode==='daily'?'Free play':'Next puzzle'} →</button>`;
 $('#share').addEventListener('click',share);$('#next').addEventListener('click',()=>switchMode('free',true));
}
function seed(){return crypto.getRandomValues(new Uint32Array(1))[0];}
function switchMode(mode,fresh=false){
 tick();save();
 if(mode==='daily')state=daily;else{
  if(!free&&!fresh){const old=cache.get('free',null);if(old&&validState(old,game.id,'free',old.key))free=old;}
  if(!free||fresh)free=makePuzzle(game.id,'free',key,seed());state=free;
 }
 last=performance.now();save();render();$('.play-card').scrollIntoView({block:'start',behavior:'instant'});
}
function open(html){$('#modal-content').innerHTML=html;$('#modal-name').textContent=game.name.toLowerCase()+'.';if(!$('#modal').open)$('#modal').showModal();}
function help(){open(`<h2>${game.name}. A little how-to.</h2><p>${game.help}</p><p class="modal-kicker">DAILY OR FREE PLAY</p><p>Everyone gets the same daily puzzle. A fresh one arrives at midnight in London. Free play offers another puzzle whenever you’re ready. Progress and results stay in this browser.</p><button class="primary-button" id="lets-play">Play →</button>`);$('#lets-play').addEventListener('click',()=>$('#modal').close());}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3100);}
async function share(){
 const marks=state.won?'🟩🟩🟩🟩':'🟩'.repeat(state.found?.length||0)+'⬜'.repeat(4-(state.found?.length||0));
 const text=`${game.name} ${state.mode==='daily'?'#'+Math.max(1,dayNumber(state.key)+1):'Free play'}\n${marks}\n${state.moves} ${['weave','quartet'].includes(game.id)?'checks':'moves'} · ${state.hints?state.hints+' nudges':'No hints'} · ${time(state.elapsed)}\nA little play. A lot of aha.\n${location.origin}/play.html?game=${game.id}&v=6`;
 try{await navigator.clipboard.writeText(text);toast('Copied. Pass on your little aha.');}catch{open('<h2>Share result</h2><p>Copy this spoiler-free result to share it.</p><textarea class="share-text" readonly aria-label="Result to copy"></textarea>');$('.share-text').value=text;$('.share-text').select();}
}
$('#daily').addEventListener('click',()=>switchMode('daily'));$('#free').addEventListener('click',()=>switchMode('free'));
$('#undo').addEventListener('click',()=>run(()=>undoMove(state)));
$('#clear').addEventListener('click',()=>{state.selected=[];state.message='';save();render();});
$('#hint').addEventListener('click',()=>run(()=>nudge(state)));
$('#reset').addEventListener('click',()=>{
 if(!state.moves&&!state.hints){if(state.selected)state.selected=[];save();render();toast('You’re at the start. Make your first move.');return;}
 open('<h2>Reset this puzzle?</h2><p>Reset moves and hints on this puzzle.</p><button class="primary-button" id="confirm-reset">Reset this puzzle</button><button class="secondary-button" id="keep-going">Keep going</button>');
 $('#confirm-reset').addEventListener('click',()=>{const next=makePuzzle(game.id,state.mode,state.key,state.seed);if(state.mode==='daily')daily=next;else free=next;state=next;last=performance.now();save();$('#modal').close();render();});$('#keep-going').addEventListener('click',()=>$('#modal').close());
});
$('#help').addEventListener('click',help);$('#help-inline').addEventListener('click',help);$('#close').addEventListener('click',()=>$('#modal').close());
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
document.addEventListener('keydown',e=>{
 if($('#modal').open||e.ctrlKey||e.altKey||e.metaKey||state.done||['INPUT','TEXTAREA'].includes(e.target.tagName))return;
 if(game.id==='slide'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
  const gap=state.tiles.indexOf(0),delta={ArrowUp:-3,ArrowDown:3,ArrowLeft:-1,ArrowRight:1}[e.key],i=gap+delta;
  e.preventDefault();if(slideNeighbours(gap).includes(i))run(()=>choose(state,i));return;
 }
 if(e.key==='Enter'&&['quartet','weave'].includes(game.id)&&!e.target.closest('button,a')){e.preventDefault();run(()=>checkSelection(state));}
});
document.addEventListener('visibilitychange',()=>{last=performance.now();save();});window.addEventListener('pagehide',()=>{tick();save();});
setInterval(()=>{tick();save();const today=dailyKey();if(today!==key){key=today;daily=dailyLoad();if(state.mode==='daily'){state=daily;render();toast('A fresh daily puzzle is ready.');}else{$('#issue').textContent='JUST FOR THE JOY OF IT';$('#streak').textContent=streak();}}},1000);
render();
