import {makeCircuit as classicBoard,rotate,directions} from './signal-engine.js';
import {random,shuffle,dayNumber} from './puzzles.js';
export {rotate,directions};
export const sizes=[3,4,5,6,7,8,9,10];
export const variants=[
 {id:'classic',name:'Classic',icon:'ϟ',goal:'Power every tile.',offset:0},
 {id:'wrap',name:'Wrap',icon:'↔',goal:'Opposite edges connect.',offset:102731},
 {id:'locked',name:'Locked',icon:'▣',goal:'Work around the fixed tiles.',offset:207463},
 {id:'split',name:'Split',icon:'A/B',goal:'Power A and B separately.',offset:351791},
 {id:'mesh',name:'Mesh',icon:'⊞',goal:'Power every tile. Connect every wire end.',offset:461923},
 {id:'barriers',name:'Barriers',icon:'▥',goal:'Route the power around the walls.',offset:572117},
];
export function neighbours(board,i){
 const {size}=board,r=Math.floor(i/size),c=i%size,wrap=board.variant==='wrap',out=[];
 for(const [dr,dc,bit,opposite]of directions){let nr=r+dr,nc=c+dc;if(wrap){nr=(nr+size)%size;nc=(nc+size)%size;}if(nr>=0&&nr<size&&nc>=0&&nc<size&&!(board.walls?.[i]&bit))out.push({index:nr*size+nc,bit,opposite});}
 return out;
}
export function flow(board){
 const masks=board.base.map((m,i)=>rotate(m,board.turns[i])),groups=board.groups||board.base.map(()=>0),sources=board.sources||[0],lit=new Set(),shorts=new Set();
 for(const source of sources){const seen=new Set([source]),queue=[source];lit.add(source);
  for(let q=0;q<queue.length;q++){const i=queue[q];for(const n of neighbours(board,i))if((masks[i]&n.bit)&&(masks[n.index]&n.opposite)&&groups[i]===groups[n.index]&&!seen.has(n.index)){seen.add(n.index);lit.add(n.index);queue.push(n.index);}}
 }
 if(board.variant==='split')for(let i=0;i<masks.length;i++)for(const n of neighbours(board,i))if(groups[i]!==groups[n.index]&&(masks[i]&n.bit)&&(masks[n.index]&n.opposite)){shorts.add(i);shorts.add(n.index);}
 const loose=new Set();
 for(let i=0;i<masks.length;i++)for(const [, ,bit] of directions)if(masks[i]&bit){const n=neighbours(board,i).find(n=>n.bit===bit);if(!n||!(masks[n.index]&n.opposite)||groups[i]!==groups[n.index])loose.add(i);}
 return {lit,shorts,loose};
}
export const powered=board=>flow(board).lit;
export function solved(board){const f=flow(board);return f.lit.size===board.base.length&&f.shorts.size===0&&(board.variant!=='mesh'||f.loose.size===0);}
function wrapTree(board,seed){
 const rng=random(seed),n=board.base.length,base=Array(n).fill(0),parents=base.map((_,i)=>i),edges=[];
 const root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
 for(let i=0;i<n;i++)for(const edge of neighbours(board,i))if(edge.bit===2||edge.bit===4)edges.push([i,edge.index,edge.bit,edge.opposite]);
 for(const [a,b,x,y]of shuffle(edges,rng)){const ra=root(a),rb=root(b);if(ra!==rb){parents[ra]=rb;base[a]|=x;base[b]|=y;}}
 board.base=base;board.turns=base.map(()=>Math.floor(rng()*4));
}
function splitTree(board,rng){
 const candidates=[];
 for(let i=0;i<board.base.length;i++)for(const edge of neighbours(board,i))if(i<edge.index&&(board.base[i]&edge.bit)){
  const seen=new Set([i]),queue=[i];
  for(let q=0;q<queue.length;q++)for(const n of neighbours(board,queue[q]))if((board.base[queue[q]]&n.bit)&&!((queue[q]===i&&n.index===edge.index)||(queue[q]===edge.index&&n.index===i))&&!seen.has(n.index)){seen.add(n.index);queue.push(n.index);}
  if(seen.size>=2&&seen.size<=board.base.length-2)candidates.push({i,edge,seen,balance:Math.abs(board.base.length/2-seen.size)});
 }
 const choices=shuffle(candidates,rng).sort((a,b)=>a.balance-b.balance);const cut=choices[Math.floor(rng()*Math.min(3,choices.length))];
 board.base[cut.i]&=~cut.edge.bit;board.base[cut.edge.index]&=~cut.edge.opposite;
 board.groups=board.base.map((_,i)=>cut.seen.has(i)?0:1);board.sources=[board.groups.indexOf(0),board.groups.indexOf(1)];
}
export function makeCircuit(size,seed,mode='free',key='',variant='classic'){
 if(!sizes.includes(size)||!Number.isInteger(seed))throw new Error('Invalid circuit size or seed');
 if(!variants.some(v=>v.id===variant))throw new Error('Unknown circuit variant');
 const board=classicBoard(size,seed,mode,key),rng=random(seed^0x5f3759df);
 board.variant=variant;board.groups=board.base.map(()=>0);board.sources=[0];board.locked=board.base.map(()=>false);
 if(variant==='wrap')wrapTree(board,seed);
 if(variant==='split')splitTree(board,rng);
 if(variant==='locked')for(const i of shuffle(board.base.map((_,i)=>i).filter(i=>board.base[i]!==15),rng).slice(0,Math.max(2,Math.floor(size*size*.2)))){board.locked[i]=true;board.turns[i]=0;}
 if(variant==='mesh'||variant==='barriers'){
  const unused=[];
  for(let i=0;i<board.base.length;i++)for(const n of neighbours(board,i))if(i<n.index&&!(board.base[i]&n.bit))unused.push({i,...n});
  const chosen=shuffle(unused,rng).slice(0,Math.max(1,Math.floor(size*size*(variant==='mesh'?.22:.3))));
  if(variant==='barriers')board.walls=board.base.map(()=>0);
  for(const n of chosen){const masks=variant==='mesh'?board.base:board.walls;masks[n.i]|=n.bit;masks[n.index]|=n.opposite;}
 }
 if(solved(board)){const i=board.base.findIndex((m,i)=>m!==15&&!board.locked[i]);board.turns[i]++;}
 board.initial=[...board.turns];return board;
}
export function dailyCircuit(key,variant='classic'){
 const v=variants.find(v=>v.id===variant);if(!v)throw new Error('Unknown circuit variant');
 return makeCircuit(4,92653+dayNumber(key)*7919+v.offset,'daily',key,variant);
}
export function applyTurn(board,index,delta=1){
 if(board.won||!Number.isInteger(index)||index<0||index>=board.base.length||board.locked?.[index]||rotate(board.base[index])===board.base[index])return false;
 remember(board);board.turns[index]+=delta;board.moves++;board.started=true;board.won=solved(board);return true;
}
function remember(board){board.history.push({turns:[...board.turns],moves:board.moves});}
export function undo(board){if(board.won||!board.history.length)return false;const h=board.history.pop();board.turns=h.turns;board.moves=h.moves;return true;}
export function reset(board){if(board.won)return false;board.turns=[...board.initial];board.moves=0;board.hints=0;board.history=[];board.elapsed=0;board.started=false;return true;}
// Arc consistency over orientation domains gives deductions without consulting
// the generated answer.
export function deductions(board){
 const links=board.base.map((_,i)=>neighbours(board,i)),groups=board.groups||board.base.map(()=>0);
 const domains=board.base.map((mask,i)=>{
  const choices=board.locked?.[i]?[mask]:[...new Set([0,1,2,3].map(t=>rotate(mask,t)))];
  return choices.filter(m=>directions.every(([, ,bit])=>!(m&bit)||links[i].some(n=>n.bit===bit&&groups[i]===groups[n.index])));
 });
 let changed=true;
 while(changed){changed=false;for(let i=0;i<domains.length;i++){
  const next=domains[i].filter(m=>links[i].every(n=>groups[i]!==groups[n.index]||domains[n.index].some(other=>Boolean(m&n.bit)===Boolean(other&n.opposite))));
  if(next.length!==domains[i].length){domains[i]=next;changed=true;}
 }}
 return domains;
}
export function nextHint(board){
 if(board.won)return null;
 const domains=deductions(board),lit=powered(board),wrong=board.base.map((_,i)=>i).filter(i=>!board.locked?.[i]&&rotate(board.base[i],board.turns[i])!==board.base[i]);
 const forced=board.base.findIndex((m,i)=>!board.locked?.[i]&&domains[i].length===1&&rotate(m,board.turns[i])!==domains[i][0]);
 const index=forced>=0?forced:(wrong.find(i=>lit.has(i))??wrong[0]);if(index===undefined)return null;
 const mask=forced>=0?domains[index][0]:board.base[index],ports=['north','east','south','west'].filter((_,j)=>mask&(1<<j)).join(', ');
 return {index,mask,kind:forced>=0?'deduction':'reveal',text:`Row ${Math.floor(index/board.size)+1}, column ${index%board.size+1}: ${forced>=0?'the edges and neighbouring wire shapes force':'one valid solution uses'} wires ${ports}.`};
}
export function hint(board){
 const h=nextHint(board);if(!h)return -1;
 remember(board);const i=h.index;
 while(rotate(board.base[i],board.turns[i])!==h.mask)board.turns[i]++;
 board.moves++;board.hints++;board.started=true;board.won=solved(board);return i;
}
export function validBoard(board,mode,key,variant='classic'){
 if(!board||board.version!==1||board.mode!==mode||board.key!==key||!Number.isInteger(board.seed)||!variants.some(v=>v.id===variant)||(board.variant||'classic')!==variant||!sizes.includes(board.size))return false;
 const count=board.size*board.size,ints=(a,min,max)=>Array.isArray(a)&&a.length===count&&a.every(v=>Number.isSafeInteger(v)&&v>=min&&v<=max),bools=a=>Array.isArray(a)&&a.length===count&&a.every(v=>typeof v==='boolean');
 if(!ints(board.base,1,15)||!ints(board.turns,-1e7,1e7)||!ints(board.initial,-1e7,1e7)||!Number.isFinite(board.elapsed)||board.elapsed<0||!Number.isSafeInteger(board.moves)||board.moves<0||!Number.isSafeInteger(board.hints)||board.hints<0||typeof board.won!=='boolean'||typeof board.started!=='boolean'||!Array.isArray(board.history)||!board.history.every(h=>h&&ints(h.turns,-1e7,1e7)&&Number.isSafeInteger(h.moves)&&h.moves>=0))return false;
 const n=board.base.length;
 if(board.groups&&(!Array.isArray(board.groups)||board.groups.length!==n||!board.groups.every(g=>g===0||g===1)))return false;
 if(board.sources&&(!Array.isArray(board.sources)||!board.sources.length||!board.sources.every(i=>Number.isInteger(i)&&i>=0&&i<n)))return false;
 if(board.locked&&!bools(board.locked))return false;
 if(variant==='split'&&(!board.groups?.includes(1)||board.sources?.length!==2))return false;
 if(variant==='locked'&&(!board.locked?.some(Boolean)||board.locked.some((v,i)=>v&&rotate(board.base[i],board.turns[i])!==board.base[i])))return false;
 if(variant==='barriers'){
  if(!ints(board.walls,0,15))return false;
  for(let i=0;i<n;i++)for(const [dr,dc,bit,opposite] of directions)if(board.walls[i]&bit){const r=Math.floor(i/board.size)+dr,c=i%board.size+dc;if(r<0||c<0||r>=board.size||c>=board.size||!(board.walls[r*board.size+c]&opposite)||(board.base[i]&bit))return false;}
 }
 if(board.won!==solved(board))return false;
 return true;
}
