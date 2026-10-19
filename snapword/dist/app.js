import { dailyKey, dayNumber, makeGame } from './puzzles.js';

const $ = s => document.querySelector(s);
const storage = {
 get(key, fallback) { try { return JSON.parse(localStorage.getItem('snapword:v1:'+key)) ?? fallback; } catch { return fallback; } },
 set(key,value) { try { localStorage.setItem('snapword:v1:'+key,JSON.stringify(value)); } catch {} }
};
let key = dailyKey();
let stats = storage.get('stats',{days:{},sound:false});
if (!stats || typeof stats.days !== 'object' || stats.days === null) stats = {days:{},sound:false};
function loadDaily() {
 const saved = storage.get('daily:'+key,null);
 if (saved?.key === key && saved.mode === 'daily' && saved.rounds?.length === 5 && saved.rounds.every(r=>Array.isArray(r.letters)&&Array.isArray(r.picked)&&typeof r.answer==='string') && Number.isInteger(saved.index) && saved.index >= 0 && saved.index < 5) return saved;
 return makeGame('daily',key);
}
let daily = loadDaily();
let practice = null;
let game = daily;
let message = '';
let audio;
let toastTimer;
let clock = performance.now();
const playArea = $('#play-area');
const modal = $('#modal');
const round = () => game.rounds[game.index];
const formatTime = ms => { const s = Math.floor(ms/1000); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
function save() { if (game.mode === 'daily') storage.set('daily:'+game.key,game); }
function saveStats() { storage.set('stats',stats); }
function startClock() { if (!game.started) { game.started = Date.now(); clock=performance.now(); save(); } }
function streak() {
 let count = 0;
 let d = Date.parse(key+'T12:00:00Z');
 if (!stats.days[key]) d -= 86400000;
 while (stats.days[new Date(d).toISOString().slice(0,10)]) { count++; d-=86400000; }
 return count;
}
function decorate() {
 $('#issue').textContent='№ '+String(Math.max(1,dayNumber(key)+1)).padStart(3,'0');
 $('#today-date').textContent=new Date(key+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/London'});
 $('#streak-value').textContent=streak();
 for (const mode of ['daily','practice']) { const b = $('#'+mode+'-mode'); b.classList.toggle('active',game.mode===mode); b.setAttribute('aria-pressed',game.mode===mode); }
 $('#sound-button').setAttribute('aria-label',stats.sound?'Turn sound off':'Turn sound on');
 $('#sound-button').setAttribute('aria-pressed',Boolean(stats.sound));
 $('#sound-button').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 5-5 4H2v6h3l5 4V5Z'+(stats.sound?'m5 3q6 4 0 8m3-11q10 7 0 14':'m5 4 6 6m0-6-6 6')+'"/></svg>';
}
function tone(success) {
 if(!stats.sound) return;
 try {
  audio ??= new (window.AudioContext || window.webkitAudioContext)();
  audio.resume();
  (success?[523,659,784]:[196]).forEach((frequency,i)=>{ const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.type='sine';o.frequency.value=frequency; const t=audio.currentTime+i*.075;g.gain.setValueAtTime(.045,t);g.gain.exponentialRampToValueAtTime(.001,t+.22);o.start(t);o.stop(t+.23); });
 } catch {}
}
function announce(text) { const node=$('#game-announcement'); if(node) node.textContent=text; }
function render() {
 decorate();
 if(game.finished) return renderResults();
 const r=round(), done=r.status!=='playing';
 playArea.className = done ? 'round-success' : '';
 const guessed=r.picked.map(i=>r.letters[i]).join('');
 playArea.innerHTML=`
  <div class="round-header"><span class="round-count">${game.mode==='daily'?'TODAY’S FIVE':'FREE PLAY'} <span style="margin:0 5px;color:#c2c7b5">/</span> ${game.index+1} OF 5</span><div class="round-dots" aria-label="Round ${game.index+1} of 5">${game.rounds.map((x,i)=>`<span class="round-dot ${x.status==='solved'?(x.hinted||x.tries?'hinted':'solved'):x.status==='failed'?'failed':i===game.index?'current':''}"></span>`).join('')}</div></div>
  <p class="instruction">${done?(r.status==='solved'?'There’s the click. Nicely done.':'A tricky one. Here’s the connection.'):'One word fits both clues.'}</p>
  <div class="bridge"><div class="clue-card"><span class="clue-caption">FINISH THIS</span><span class="clue-text">${r.left} <span class="blank">___</span></span></div><span class="bridge-icon" aria-hidden="true">↔</span><div class="clue-card right"><span class="clue-caption">START THIS</span><span class="clue-text"><span class="blank">___</span> ${r.right}</span></div></div>
  <div class="answer-tiles" aria-label="Your answer: ${done?r.answer:guessed||'empty'}">${r.answer.split('').map((l,i)=>`<button class="answer-tile ${done?(r.status==='solved'?'correct':'revealed'):guessed[i]?'filled':''} ${r.hinted&&i===0?'fixed':''}" data-slot="${i}" ${done||!guessed[i]||r.hinted&&i===0?'disabled':''} aria-label="${done?l:guessed[i]?'Remove '+guessed[i]:'Empty letter '+(i+1)}">${done?l:guessed[i]||''}</button>`).join('')}</div>
  ${done?`<div class="solved-phrases">${r.left.toLowerCase()} <b>${r.answer.toLowerCase()}</b> &nbsp;·&nbsp; <b>${r.answer.toLowerCase()}</b> ${r.right.toLowerCase()}<br><span style="font-size:10px">${r.status==='solved'?(r.hinted?'A little nudge. Still a lovely click.':r.tries===0?'First try. That’s a clean click.':'You found the connection.'): 'Another little aha for your collection.'}</span></div><div class="actions"><button class="check-button" id="next-button">${game.index===4?'See my results':'Next link'} <span>→</span></button></div><div class="card-bottom"><span>${game.index===4?'Your five little clicks, all together.':`${4-game.index} more little ${game.index===3?'click':'clicks'} to go.`}</span><span>↵ to continue</span></div>`:
  `<div class="letter-count">${r.answer.length} letters</div>
  <div class="feedback" role="status" aria-live="polite">${message||(r.hinted?r.hint+'.':'')}</div>
  <div class="letter-bank" aria-label="Available letters">${r.letters.map((l,i)=>`<button class="letter-key" data-letter="${i}" ${r.picked.includes(i)?'disabled':''} aria-label="Add ${l}">${l}</button>`).join('')}</div>
  <div class="actions"><button class="erase-button" id="erase-button" aria-label="Delete last letter" ${r.picked.length<=(r.hinted?1:0)?'disabled':''}>⌫</button><button class="check-button" id="check-button" ${r.picked.length!==r.answer.length?'disabled':''}>Make it click <span>↵</span></button></div>
  <button class="hint-button" id="hint-button" ${r.hinted?'disabled':''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6m-6 3h6M8 14a7 7 0 1 1 8 0l-1 2H9Z"/></svg>${r.hinted?'Hint used · first letter revealed':'Hint'}</button>
  <div class="card-bottom"><span class="keyboard-tip"><kbd>⌫</kbd> delete &nbsp; <kbd>enter</kbd> check</span><span class="attempts"><span>${3-r.tries} ${3-r.tries===1?'try':'tries'} left</span>${[0,1,2].map(i=>`<i class="${i<r.tries?'used':''}"></i>`).join('')}</span></div>`}
  <span id="game-announcement" class="sr-only" role="status" aria-live="polite"></span>`;
 $('#check-button')?.addEventListener('click',check);
 $('#erase-button')?.addEventListener('click',erase);
 $('#hint-button')?.addEventListener('click',hint);
 $('#next-button')?.addEventListener('click',next);
 playArea.querySelectorAll('[data-letter]').forEach(b=>b.addEventListener('click',()=>pick(Number(b.dataset.letter))));
 playArea.querySelectorAll('[data-slot]').forEach(b=>b.addEventListener('click',()=>{if(done)return; const i=Number(b.dataset.slot); if(i<r.picked.length && !(r.hinted&&i===0)){r.picked.splice(i,1);message='';save();render();}}));
}
function pick(i) {
 const r=round();if(game.finished||r.status!=='playing'||r.picked.includes(i)||r.picked.length>=r.answer.length) return;
 startClock();r.picked.push(i);message='';save();render();
}
function erase() {
 const r=round();if(game.finished||r.status!=='playing'||r.picked.length<=(r.hinted?1:0))return;
 r.picked.pop();message='';save();render();
}
function hint() {
 const r=round();if(r.hinted||r.status!=='playing')return;
 startClock();r.hinted=true;r.picked=[r.letters.indexOf(r.answer[0])];message=r.hint+'.';save();render();
}
function check() {
 const r=round();if(game.finished||r.status!=='playing'||r.picked.length!==r.answer.length)return;
 startClock();
 if(r.picked.map(i=>r.letters[i]).join('')===r.answer){r.status='solved';message='';tone(true);save();render();celebrate(12);$('#next-button')?.focus({preventScroll:true});}
 else{r.tries++;tone(false);if(r.tries>=3){r.status='failed';message='';}else{r.picked=r.hinted?[r.letters.indexOf(r.answer[0])]:[];message=r.tries===1?'Almost? Try a word that fits both sides.':'One more try. Read each phrase out loud.';}save();render();playArea.querySelector('.answer-tiles')?.classList.add('shake');}
}
function next() {
 if(game.finished||round().status==='playing')return;
 if(game.index<4){game.index++;message='';save();render();announce('Link '+(game.index+1)+'. '+round().left+' blank. Blank '+round().right+'.');}
 else {game.finished=true;recordResult();save();render();celebrate(30);}
}
function recordResult() {
 if(game.mode!=='daily'||game.recorded)return;
 const solved=game.rounds.filter(r=>r.status==='solved').length;
 stats.days[game.key]={solved,clean:game.rounds.filter(r=>r.status==='solved'&&!r.hinted&&r.tries===0).length,time:game.elapsed};
 game.recorded=true;saveStats();
}
function renderResults() {
 const solved=game.rounds.filter(r=>r.status==='solved').length;
 const clean=game.rounds.filter(r=>r.status==='solved'&&!r.hinted&&r.tries===0).length;
 const title=clean===5?'Oh, that clicked.':solved===5?'Five little ahas.':solved>=3?'A good brain day.':'Every click counts.';
 playArea.className='';
 playArea.innerHTML=`<div class="result"><div class="result-spark" aria-hidden="true">✳</div><h2>${title}</h2><p class="result-subtitle">${clean===5?'Five links. Five first tries. That’s a lovely little flex.':solved===5?'You found every connection. Clever looks good on you.':'A few new connections for your collection. Come back for your next little spark.'}</p><div class="result-blocks" aria-label="${solved} of 5 links solved">${game.rounds.map(r=>`<span class="result-block ${r.status==='failed'?'missed':r.hinted||r.tries?'assisted':''}">${r.status==='failed'?'–':'✓'}</span>`).join('')}</div><div class="result-stats"><div class="result-stat"><strong>${solved}<span style="display:inline;font-size:15px">/5</span></strong><span>links found</span></div><div class="result-stat"><strong>${formatTime(game.elapsed)}</strong><span>time well spent</span></div><div class="result-stat"><strong>${clean}</strong><span>clean clicks</span></div></div><button class="primary-button" id="share-button">Share my little flex &nbsp; ↗</button><button class="secondary-button" id="again-button">${game.mode==='daily'?'Can’t wait? Try free play':'Another five? Let’s go'} &nbsp; →</button><div class="result-footnote">${game.mode==='daily'?'A fresh daily five arrives at midnight, London time.':'Just for the joy of it. Your daily result is saved.'}</div><details class="result-review"><summary>See the connections</summary>${game.rounds.map(r=>`<p>${r.left.toLowerCase()} <b>${r.answer.toLowerCase()}</b> · <b>${r.answer.toLowerCase()}</b> ${r.right.toLowerCase()}</p>`).join('')}</details></div>`;
 $('#share-button').addEventListener('click',share);
 $('#again-button').addEventListener('click',()=>switchMode('practice',true));
 decorate();
}
function switchMode(mode,newGame=false) {
 tick();
 if(mode==='daily'){game=daily;}
 else {if(!practice||newGame)practice=makeGame('practice',key);game=practice;}
 message='';clock=performance.now();render();
}
function shareText() {
 const clean=game.rounds.filter(r=>r.status==='solved'&&!r.hinted&&r.tries===0).length;
 const marks=game.rounds.map(r=>r.status==='failed'?'⬜':r.hinted||r.tries?'🟨':'🟩').join('');
 return `Snapword ${game.mode==='daily'?'#'+Math.max(1,dayNumber(game.key)+1):'Free play'}\n${marks}\n${clean}/5 clean clicks · ${formatTime(game.elapsed)}\nTwo clues. One little click.\n${location.origin}${location.pathname}`;
}
async function share() {
 const text=shareText();
 try { await navigator.clipboard.writeText(text);toast('Result copied. Go share your little flex.'); }
 catch {openModal('<h2>Your little flex.</h2><p>Copy your spoiler-free result and share it with a friend.</p><textarea class="share-text" readonly aria-label="Result to copy"></textarea>');$('.share-text').value=text;$('.share-text').select();}
}
function toast(text) {$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
function openModal(html) {$('#modal-content').innerHTML=html;if(!modal.open)modal.showModal();}
function help() {
 openModal(`<h2>One word. Two little ahas.</h2><p>Find the missing word that finishes the left phrase <em>and</em> starts the right one. Words can join together or stay separate.</p><div class="modal-example">BIRTHDAY <b>CAKE</b> WALK</div><p style="text-align:center;font-size:11px">Birthday cake. Cakewalk. Click.</p><ol><li>Tap the letters or use your keyboard to build the word.</li><li>Hit <b>Make it click</b>. You have three tries for each link. Tap a filled tile or press backspace to edit.</li><li>Stuck? A hint reveals the first letter. Green means first try, yellow means a little help or another try, white means revealed.</li></ol><p class="help-note">Five links each day. Everyone gets the same set. Free play is always here if you fancy another go.</p><button class="primary-button" id="lets-play">Let’s make it click →</button>`);
 $('#lets-play').addEventListener('click',()=>modal.close());
}
function showStats() {
 const records=Object.values(stats.days),counts=Array.from({length:6},(_,i)=>records.filter(r=>r.solved===i).length),max=Math.max(1,...counts);
 openModal(`<h2>Your little ritual.</h2><div class="stats-grid"><div><strong>${records.length}</strong><span>days played</span></div><div><strong>${streak()}</strong><span>current streak</span></div><div><strong>${records.length?Math.round(records.reduce((s,r)=>s+r.solved,0)/(records.length*5)*100):0}%</strong><span>links found</span></div></div><p style="margin-top:26px;font-size:10px;letter-spacing:1.3px">DAILY LINKS FOUND</p><div class="distribution">${counts.map((n,i)=>`<div class="distribution-row"><span>${i}/5</span><div class="distribution-track"><div class="distribution-bar" style="width:${Math.max(8,n/max*100)}%">${n}</div></div></div>`).join('')}</div><p class="help-note">Your progress is saved in this browser. Complete a daily five to keep your streak going, whatever your score.</p>`);
}
function celebrate(count) {
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const rect=$('.game-card').getBoundingClientRect();
 for(let i=0;i<count;i++){const p=document.createElement('span');p.className='confetti';p.style.cssText=`left:${rect.left+rect.width/2+(Math.random()-.5)*150}px;top:${rect.top+rect.height*.45}px;background:${['#d5ef55','#ef744e','#8296db','#a7bb7a'][i%4]};--drift:${(Math.random()-.5)*280}px;animation-delay:${Math.random()*.15}s`;document.body.append(p);setTimeout(()=>p.remove(),1600);}
}
function tick() {
 const now=performance.now();
 if(game.started&&!game.finished&&!document.hidden&&!modal.open) game.elapsed+=Math.min(now-clock,2000);
 clock=now;
}
setInterval(()=>{tick();save();const current=dailyKey();if(current!==key){key=current;daily=loadDaily();if(game.mode==='daily'){game=daily;message='';render();toast('A new day. Five fresh connections.');}else decorate();}},1000);
document.addEventListener('visibilitychange',()=>{clock=performance.now();save();});
window.addEventListener('pagehide',()=>{tick();save();});
document.addEventListener('keydown',e=>{
 if(modal.open||e.ctrlKey||e.metaKey||e.altKey||['INPUT','TEXTAREA'].includes(e.target.tagName))return;
 if(e.target.tagName==='BUTTON'&&(e.key==='Enter'||e.key===' '))return;
 if(game.finished)return;
 if(e.key==='Enter'){e.preventDefault();round().status==='playing'?check():next();return;}
 if(round().status!=='playing')return;
 if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();erase();return;}
 if(/^[a-z]$/i.test(e.key)){e.preventDefault();const r=round(),i=r.letters.findIndex((l,i)=>l===e.key.toUpperCase()&&!r.picked.includes(i));if(i>=0)pick(i);else toast('That letter isn’t available.');}
});
$('#daily-mode').addEventListener('click',()=>switchMode('daily'));
$('#practice-mode').addEventListener('click',()=>switchMode('practice'));
$('#help-button').addEventListener('click',help);
$('#footer-help').addEventListener('click',help);
$('#stats-button').addEventListener('click',showStats);
$('#example-button').addEventListener('click',()=>{toast('One word. Both sides. You’ve got this.');$('.letter-key:not(:disabled)')?.focus({preventScroll:true});});
$('#close-modal').addEventListener('click',()=>modal.close());
modal.addEventListener('click',e=>{if(e.target===modal){const rect=modal.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)modal.close();}});
$('#sound-button').addEventListener('click',()=>{stats.sound=!stats.sound;saveStats();decorate();if(stats.sound)tone(true);toast(stats.sound?'Sound on. A little extra satisfaction.':'Sound off. Enjoy the quiet.');});
$('#feedback-button').addEventListener('click',()=>openModal('<h2>A small game. A big click.</h2><p>Snapword is a daily word-link puzzle built around the pleasure of spotting a connection. Five quick links, a little moment for yourself.</p><p>Green is a first-try solve. Yellow is a solve with a hint or an extra try. Every connection is worth finding.</p><p class="help-note">No account needed. Scores and streaks stay in this browser. Clearing browser data clears your history. Daily puzzles reset at midnight in London.</p>'));
if(game.finished&&!game.recorded){recordResult();save();}
render();
