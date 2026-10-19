import {games} from './arcade-data.js?v=6';
import {dailyKey} from './puzzles.js';
const key=dailyKey();
const all=[
 {id:'snapword',name:'Snapword',kind:'Words',icon:'s.',colour:'#d5ef55',description:'One word completes two phrases.',time:'1–3 min',url:'./?v=6',preview:'snap'},
 {id:'signal',name:'Circuit',kind:'Logic',icon:'⌁',colour:'#d5ef55',description:'Connect the network. Four variants.',time:'2–5 min',url:'./circuit.html?v=6',preview:'signal'},
 ...games.map(g=>({...g,url:'./play.html?game='+g.id+'&v=6',preview:g.id})),
 {id:'spider',name:'Spider',kind:'Cards',icon:'♠',colour:'#94d7b2',description:'Two suits. Clear eight King-to-Ace runs.',time:'10–30 min',url:'./spider.html?v=11',preview:'spider'}
];
function completed(id){try{if(id==='snapword')return JSON.parse(localStorage.getItem('snapword:v1:daily:'+key))?.finished;if(id==='signal'){for(const variant of ['classic','wrap','locked','split'])if(JSON.parse(localStorage.getItem('circuit:v2:'+variant+':daily:'+key))?.won)return true;return JSON.parse(localStorage.getItem('signal:v1:daily:'+key))?.won;}return JSON.parse(localStorage.getItem('clicks:v1:'+id+':daily:'+key))?.done;}catch{return false;}}
function preview(id){
 if(id==='spider')return '<div class="mini-spider"><span>K♠</span><span class="red">Q♥</span><span>J♠</span><span class="red">10♥</span></div>';
 if(id==='snap')return '<div class="mini-bridge"><span>RAIN</span><b>B O W</b><span>TIE</span></div>';
 if(id==='signal')return '<div class="mini-circuit"><span>┌</span><span>─</span><span>┐</span><span>│</span><span>┌</span><span>┘</span></div>';
 if(id==='shift')return '<div class="mini-ladder"><span>COLD</span><i>↓</i><span>CORD</span><i>↓</i><span>WARM</span></div>';
 if(id==='quartet')return '<div class="mini-quartet">'+['MINT','GOLD','JADE','SAGE','RUBY','DILL','OPAL','THYME'].map((s,i)=>'<span class="t'+i+'">'+s+'</span>').join('')+'</div>';
 if(id==='weave')return '<div class="mini-weave">'+[...'MOONARTISEALWAVE'].map((s,i)=>'<span class="'+(i<4?'traced':'')+'">'+s+'</span>').join('')+'</div>';
 if(id==='flip')return '<div class="mini-flip">'+Array.from({length:16},(_,i)=>'<span class="'+([1,4,5,6,9,12,14].includes(i)?'on':'')+'"></span>').join('')+'</div>';
 if(id==='slide')return '<div class="mini-slide">'+[1,2,3,4,0,5,7,8,6].map(n=>'<span class="'+(!n?'gap':'')+'">'+(n||'')+'</span>').join('')+'</div>';
 return '<div class="mini-numbers"><span>3</span><i>×</i><span>8</span><b>= 24</b></div>';
}
function draw(filter='all'){
 document.querySelector('#gallery').innerHTML=all.filter(g=>filter==='all'||g.kind===filter).map(g=>`<a class="gallery-card" href="${g.url}" style="--accent:${g.colour}" aria-label="Play ${g.name}"><div class="gallery-card-head"><span class="category">${g.kind}</span><span class="card-availability ${completed(g.id)?'done':''}">${completed(g.id)?'✓ TODAY PLAYED':g.id==='snapword'||g.id==='signal'?'DAILY + FREE PLAY':'NEW'}</span></div><div class="game-preview preview-${g.preview}" aria-hidden="true">${preview(g.preview)}</div><div class="gallery-title"><h2>${g.name}<span>.</span></h2><span class="play-arrow">↗</span></div><p>${g.description}</p><div class="gallery-card-foot"><span>${g.time}</span><span>${g.id==='spider'?'Unlimited deals':'Daily + free play'}</span></div></a>`).join('');
 document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',b.dataset.filter===filter);});
}
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>draw(b.dataset.filter)));
draw();
