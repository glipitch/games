import {random,shuffle,dayNumber} from './puzzles.js';
import {games,ladderWords,categories,hiddenWords} from './arcade-data.js?v=6';

const clone=v=>JSON.parse(JSON.stringify(v));
export const neighbours=new Map(ladderWords.map(w=>[w,ladderWords.filter(v=>v!==w&&[...w].filter((c,i)=>c!==v[i]).length===1)]));
export function wordRoute(start,goal){
 const queue=[start],prev=new Map([[start,null]]);
 for(let n=0;n<queue.length;n++){
  const w=queue[n];if(w===goal){const path=[];for(let x=w;x;x=prev.get(x))path.unshift(x);return path;}
  for(const next of neighbours.get(w)||[])if(!prev.has(next)){prev.set(next,w);queue.push(next);}
 }return null;
}
export function flipAt(lights,i,size=4){
 const next=[...lights],r=Math.floor(i/size),c=i%size;
 for(const [dr,dc] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]]){const nr=r+dr,nc=c+dc;if(nr>=0&&nr<size&&nc>=0&&nc<size)next[nr*size+nc]^=1;}
 return next;
}
export function flipSolution(lights,size=4){
 const n=size*size,a=lights.map((b,r)=>{const column=flipAt(Array(n).fill(0),r,size);return [...column,b];}),pivots=[];
 let row=0;
 for(let col=0;col<n&&row<n;col++){
  let pivot=row;while(pivot<n&&!a[pivot][col])pivot++;if(pivot===n)continue;
  [a[row],a[pivot]]=[a[pivot],a[row]];
  for(let r=0;r<n;r++)if(r!==row&&a[r][col])for(let c=col;c<=n;c++)a[r][c]^=a[row][c];
  pivots.push(col);row++;
 }
 for(let r=row;r<n;r++)if(a[r][n])return null;
 const free=Array.from({length:n},(_,i)=>i).filter(i=>!pivots.includes(i));let best=null;
 for(let bits=0;bits<(1<<free.length);bits++){
  const x=Array(n).fill(0);free.forEach((c,j)=>x[c]=(bits>>j)&1);
  for(let r=pivots.length-1;r>=0;r--){let v=a[r][n];for(let c=pivots[r]+1;c<n;c++)v^=a[r][c]&x[c];x[pivots[r]]=v;}
  const moves=x.flatMap((v,i)=>v?[i]:[]);if(!best||moves.length<best.length)best=moves;
 }return best;
}
export const slideGoal=[1,2,3,4,5,6,7,8,0];
export function slideNeighbours(gap){const r=Math.floor(gap/3),c=gap%3;return [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].filter(([r,c])=>r>=0&&r<3&&c>=0&&c<3).map(([r,c])=>r*3+c);}
const slideDistance=tiles=>tiles.reduce((sum,n,i)=>n?sum+Math.abs(Math.floor(i/3)-Math.floor((n-1)/3))+Math.abs(i%3-(n-1)%3):sum,0);
export function slideSolution(tiles){
 // A* with Manhattan distance. The heap avoids a full sort on every step.
 const heap=[],seen=new Map(),parent=new Map(),goal=slideGoal.join(''),start=tiles.join('');
 const push=node=>{heap.push(node);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].f<=node.f)break;heap[i]=heap[p];i=p;}heap[i]=node;};
 const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(2*i+1<heap.length){let c=2*i+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};
 seen.set(start,0);push({key:start,tiles:[...tiles],g:0,f:slideDistance(tiles)});
 while(heap.length){
  const node=pop();if(node.g!==seen.get(node.key))continue;
  if(node.key===goal){const path=[];for(let k=goal;k!==start;){const p=parent.get(k);path.unshift(p.index);k=p.from;}return path;}
  const gap=node.tiles.indexOf(0);
  for(const index of slideNeighbours(gap)){
   const next=[...node.tiles];[next[gap],next[index]]=[next[index],next[gap]];const key=next.join(''),g=node.g+1;
   if(g<(seen.get(key)??Infinity)){seen.set(key,g);parent.set(key,{from:node.key,index});push({key,tiles:next,g,f:g+slideDistance(next)});}
  }
 }return null;
}
const gcd=(a,b)=>b?gcd(b,a%b):Math.abs(a);
export function fraction(n,d=1){if(!d)return null;if(d<0){n=-n;d=-d;}const g=gcd(n,d);return {n:n/g,d:d/g};}
export function fractionText(v){return v.d===1?String(v.n):v.n+'/'+v.d;}
export function calculate(a,b,op){
 if(op==='+')return fraction(a.n*b.d+b.n*a.d,a.d*b.d);
 if(op==='−')return fraction(a.n*b.d-b.n*a.d,a.d*b.d);
 if(op==='×')return fraction(a.n*b.n,a.d*b.d);
 if(op==='÷')return b.n?fraction(a.n*b.d,a.d*b.n):null;
 return null;
}
export function twentySolution(values){
 const failed=new Set();
 function visit(v){
  if(v.length===1)return v[0].n===24*v[0].d?[]:null;
  const key=v.map(fractionText).sort().join(',');if(failed.has(key))return null;
  for(let i=0;i<v.length;i++)for(let j=0;j<v.length;j++)if(i!==j)for(const op of ['+','−','×','÷']){
   if(i>j&&(op==='+'||op==='×'))continue;
   const result=calculate(v[i],v[j],op);if(!result)continue;
   const rest=v.filter((_,n)=>n!==i&&n!==j);rest.push(result);const route=visit(rest);
   if(route)return [{i,j,op},...route];
  }
  failed.add(key);return null;
 }return visit(values);
}

function makeLadder(rng){
 const pool=shuffle(ladderWords,rng);
 for(const from of pool){for(const to of shuffle(pool.slice(0,60),rng)){const route=wordRoute(from,to);if(route&&route.length>=5&&route.length<=8)return {from,target:to,current:from,trail:[from],par:route.length-1};}}
 throw new Error('Word graph has no suitable ladder');
}
function makeQuartet(rng){
 const groups=[],used=new Set(),families=new Set();
 for(const [label,family,words]of shuffle(categories,rng))if(!families.has(family)&&words.every(w=>!used.has(w))){groups.push({label,words});words.forEach(w=>used.add(w));families.add(family);if(groups.length===4)break;}
 return {groups,order:shuffle(groups.flatMap(g=>g.words),rng),found:[],selected:[],strikes:0};
}
function makeWeave(rng){
 const words=shuffle(hiddenWords,rng).slice(0,4),size=4,path=[],used=new Set();
 function search(i){
  path.push(i);used.add(i);if(path.length===16)return true;
  const r=Math.floor(i/size),c=i%size,candidates=[];
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if(dr||dc){const nr=r+dr,nc=c+dc,j=nr*4+nc;if(nr>=0&&nr<4&&nc>=0&&nc<4&&!used.has(j))candidates.push(j);}
  for(const j of shuffle(candidates,rng))if(search(j))return true;
  path.pop();used.delete(i);return false;
 }
 search(Math.floor(rng()*16));
 const letters=Array(16),targets=words.map(([word,clue],n)=>{const cells=path.slice(n*4,n*4+4);cells.forEach((i,j)=>letters[i]=word[j]);return {word,clue,cells};});
 return {letters,targets,found:[],foundPaths:[],selected:[]};
}
export function makePuzzle(id,mode,key,seed=Date.now()>>>0){
 if(!games.some(g=>g.id===id))throw new Error('Unknown game');
 const nameSeed=[...id].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0)|0,7);
 const actual=mode==='daily'?(nameSeed+dayNumber(key)*8729)>>>0:seed>>>0,rng=random(actual);
 const state={version:1,id,mode,key,seed:actual,moves:0,hints:0,elapsed:0,started:false,won:false,done:false,history:[],message:''};
 if(id==='shift')Object.assign(state,makeLadder(rng));
 if(id==='quartet')Object.assign(state,makeQuartet(rng));
 if(id==='weave')Object.assign(state,makeWeave(rng));
 if(id==='flip'){
  let lights=Array(16).fill(0);for(let i=0;i<16;i++)if(rng()<.5)lights=flipAt(lights,i);
  if(!lights.some(Boolean))lights=flipAt(lights,0);Object.assign(state,{lights});
 }
 if(id==='slide'){
  const tiles=[...slideGoal];let previous=-1;
  for(let n=0;n<34;n++){const gap=tiles.indexOf(0),i=shuffle(slideNeighbours(gap).filter(i=>i!==previous),rng)[0];[tiles[gap],tiles[i]]=[tiles[i],tiles[gap]];previous=gap;}
  if(!slideDistance(tiles)){const gap=tiles.indexOf(0),i=slideNeighbours(gap)[0];[tiles[gap],tiles[i]]=[tiles[i],tiles[gap]];}
  Object.assign(state,{tiles});
 }
 if(id==='twentyfour'){
  let values;do{values=Array.from({length:4},()=>fraction(1+Math.floor(rng()*9)));}while(!twentySolution(values));
  Object.assign(state,{values,original:clone(values),selected:[],calculations:[]});
 }
 return state;
}
const mutable={shift:['current','trail'],quartet:['found','selected','strikes','order'],weave:['found','foundPaths','selected'],flip:['lights'],slide:['tiles'],twentyfour:['values','selected','calculations']};
function snapshot(s){const v={moves:s.moves};for(const k of mutable[s.id])v[k]=clone(s[k]);s.history.push(v);if(s.history.length>100)s.history.shift();}
export function undoMove(s){
 if(s.done||!s.history.length)return false;Object.assign(s,s.history.pop());s.message='Move undone.';return true;
}
function finish(s,won){s.won=won;s.done=true;s.message=won?'Solved.':'Here are the connections.';}
export function choose(s,value){
 if(s.done)return false;s.message='';
 if(s.id==='shift'){
  if(!neighbours.get(s.current)?.includes(value))return false;snapshot(s);s.current=value;s.trail.push(value);s.moves++;s.started=true;if(value===s.target)finish(s,true);return true;
 }
 if(s.id==='quartet'){
  if(!s.order.includes(value)||s.found.some(i=>s.groups[i].words.includes(value)))return false;
  const index=s.selected.indexOf(value);if(index>=0)s.selected.splice(index,1);else if(s.selected.length<4)s.selected.push(value);else{s.message='Four words selected. Check them, or deselect one.';return false;}return true;
 }
 if(s.id==='weave'){
  if(!Number.isInteger(value)||value<0||value>=16)return false;
  const pos=s.selected.indexOf(value);if(pos>=0){s.selected=s.selected.slice(0,pos);return true;}
  if(s.selected.length){const last=s.selected.at(-1);if(Math.abs(Math.floor(last/4)-Math.floor(value/4))>1||Math.abs(last%4-value%4)>1){s.message='Choose a neighbouring letter. Diagonals count.';return false;}}
  if(s.selected.length>=4){s.message='Four letters ready. Check your word.';return false;}s.selected.push(value);return true;
 }
 if(s.id==='flip'){
  if(!Number.isInteger(value)||value<0||value>=16)return false;snapshot(s);s.lights=flipAt(s.lights,value);s.moves++;s.started=true;if(!s.lights.some(Boolean))finish(s,true);return true;
 }
 if(s.id==='slide'){
  if(!slideNeighbours(s.tiles.indexOf(0)).includes(value)){s.message='Only a tile beside the gap can slide.';return false;}snapshot(s);const gap=s.tiles.indexOf(0);[s.tiles[gap],s.tiles[value]]=[s.tiles[value],s.tiles[gap]];s.moves++;s.started=true;if(s.tiles.every((n,i)=>n===slideGoal[i]))finish(s,true);return true;
 }
 if(s.id==='twentyfour'){
  if(!Number.isInteger(value)||value<0||value>=s.values.length)return false;const pos=s.selected.indexOf(value);if(pos>=0)s.selected.splice(pos,1);else if(s.selected.length<2)s.selected.push(value);else s.selected=[s.selected[1],value];return true;
 }return false;
}
export function checkSelection(s){
 if(s.done)return false;
 if(s.id==='quartet'){
  if(s.selected.length!==4){s.message='Pick four words first.';return false;}
  const index=s.groups.findIndex((g,i)=>!s.found.includes(i)&&s.selected.every(w=>g.words.includes(w)));s.moves++;s.started=true;
  if(index>=0){s.found.push(index);s.selected=[];s.message='Group found.';if(s.found.length===4)finish(s,true);}
  else{const near=s.groups.some((g,i)=>!s.found.includes(i)&&s.selected.filter(w=>g.words.includes(w)).length===3);s.strikes++;s.message=near?'One away. Three of those words belong together.':'A different connection. Try another four.';if(s.strikes===4)finish(s,false);}
  return true;
 }
 if(s.id==='weave'){
  if(s.selected.length!==4){s.message='Each answer has four letters. Trace all four.';return false;}
  const word=s.selected.map(i=>s.letters[i]).join(''),reverse=[...word].reverse().join('');const index=s.targets.findIndex(t=>t.word===word||t.word===reverse);
  s.moves++;s.started=true;
  if(index<0)s.message='That isn’t one of these four words. Follow a clue.';
  else if(s.found.includes(index))s.message='You’ve already found that one. Three other trails await.';
  else{s.found.push(index);s.foundPaths.push([...s.selected]);s.selected=[];s.message='Word found.';if(s.found.length===4)finish(s,true);}return true;
 }return false;
}
export function combine(s,op){
 if(s.done||s.id!=='twentyfour'||s.selected.length!==2)return false;
 const [i,j]=s.selected,a=s.values[i],b=s.values[j],v=calculate(a,b,op);if(!v){s.message='Division by zero won’t work. Try another operation.';return false;}
 snapshot(s);s.values=s.values.filter((_,n)=>n!==i&&n!==j);s.values.push(v);s.calculations.push(`${fractionText(a)} ${op} ${fractionText(b)} = ${fractionText(v)}`);s.selected=[];s.moves++;s.started=true;
 if(s.values.length===1){if(v.n===24*v.d)finish(s,true);else s.message='Not 24. Undo to try another route.';}else s.message='';return true;
}
export function nudge(s){
 if(s.done)return false;let changed=false;
 if(s.id==='shift'){const route=wordRoute(s.current,s.target);if(route?.length>1)changed=choose(s,route[1]);}
 if(s.id==='quartet'){const i=s.groups.findIndex((_,i)=>!s.found.includes(i));s.selected=[...s.groups[i].words];s.message='These four share a connection. Check your group.';changed=true;}
 if(s.id==='weave'){const i=s.targets.findIndex((_,i)=>!s.found.includes(i));s.selected=[...s.targets[i].cells];s.message='A little trail is ready. Check your word.';changed=true;}
 if(s.id==='flip'){const route=flipSolution(s.lights);if(route?.length)changed=choose(s,route[0]);}
 if(s.id==='slide'){const route=slideSolution(s.tiles);if(route?.length)changed=choose(s,route[0]);}
 if(s.id==='twentyfour'){const route=twentySolution(s.values);if(route?.length){s.selected=[route[0].i,route[0].j];changed=combine(s,route[0].op);}else s.message='This route can’t reach 24. Undo a step and try again.';}
 if(changed)s.hints++;return changed;
}
export function validState(s,id,mode,key){
 if(!s||s.version!==1||s.id!==id||s.mode!==mode||s.key!==key||!Array.isArray(s.history)||!Number.isFinite(s.moves)||!Number.isFinite(s.elapsed)||!Number.isFinite(s.hints))return false;
 if(id==='shift')return neighbours.has(s.current)&&neighbours.has(s.target)&&Array.isArray(s.trail);
 if(id==='quartet')return s.groups?.length===4&&s.order?.length===16&&Array.isArray(s.found)&&Array.isArray(s.selected);
 if(id==='weave')return s.letters?.length===16&&s.targets?.length===4&&Array.isArray(s.found)&&Array.isArray(s.selected);
 if(id==='flip')return s.lights?.length===16&&s.lights.every(n=>n===0||n===1);
 if(id==='slide')return s.tiles?.length===9&&new Set(s.tiles).size===9&&s.tiles.every(n=>Number.isInteger(n)&&n>=0&&n<=8);
 if(id==='twentyfour')return s.values?.length>=1&&s.values.length<=4&&s.values.every(v=>Number.isFinite(v.n)&&Number.isFinite(v.d)&&v.d>0)&&Array.isArray(s.selected)&&Array.isArray(s.calculations);
 return false;
}
