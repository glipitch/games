import {makeCircuit as classicBoard,rotate,directions,validBoard as validClassic} from './signal-engine.js';
import {random,shuffle,dayNumber} from './puzzles.js';
export {rotate,directions};
export const variants=[
 {id:'classic',name:'Classic',icon:'ϟ',goal:'Power every tile.',offset:0},
 {id:'wrap',name:'Wrap',icon:'↔',goal:'Opposite edges connect.',offset:102731},
 {id:'locked',name:'Locked',icon:'▣',goal:'Work around the fixed tiles.',offset:207463},
 {id:'split',name:'Split',icon:'A/B',goal:'Power A and B separately.',offset:351791},
];
export function neighbours(board,i){
 const {size}=board,r=Math.floor(i/size),c=i%size,wrap=board.variant==='wrap',out=[];
 for(const [dr,dc,bit,opposite]of directions){let nr=r+dr,nc=c+dc;if(wrap){nr=(nr+size)%size;nc=(nc+size)%size;}if(nr>=0&&nr<size&&nc>=0&&nc<size)out.push({index:nr*size+nc,bit,opposite});}
 return out;
}
export function flow(board){
 const masks=board.base.map((m,i)=>rotate(m,board.turns[i])),groups=board.groups||board.base.map(()=>0),sources=board.sources||[0],lit=new Set(),shorts=new Set();
 for(const source of sources){const seen=new Set([source]),queue=[source];lit.add(source);
  for(let q=0;q<queue.length;q++){const i=queue[q];for(const n of neighbours(board,i))if((masks[i]&n.bit)&&(masks[n.index]&n.opposite)&&groups[i]===groups[n.index]&&!seen.has(n.index)){seen.add(n.index);lit.add(n.index);queue.push(n.index);}}
 }
 if(board.variant==='split')for(let i=0;i<masks.length;i++)for(const n of neighbours(board,i))if(groups[i]!==groups[n.index]&&(masks[i]&n.bit)&&(masks[n.index]&n.opposite)){shorts.add(i);shorts.add(n.index);}
 return {lit,shorts};
}
export const powered=board=>flow(board).lit;
export function solved(board){const f=flow(board);return f.lit.size===board.base.length&&f.shorts.size===0;}
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
 if(!variants.some(v=>v.id===variant))throw new Error('Unknown circuit variant');
 const board=classicBoard(size,seed,mode,key),rng=random(seed^0x5f3759df);
 board.variant=variant;board.groups=board.base.map(()=>0);board.sources=[0];board.locked=board.base.map(()=>false);
 if(variant==='wrap')wrapTree(board,seed);
 if(variant==='split')splitTree(board,rng);
 if(variant==='locked')for(const i of shuffle(board.base.map((_,i)=>i).filter(i=>board.base[i]!==15),rng).slice(0,Math.max(2,Math.floor(size*size*.2)))){board.locked[i]=true;board.turns[i]=0;}
 if(solved(board)){const i=board.base.findIndex((m,i)=>m!==15&&!board.locked[i]);board.turns[i]++;}
 board.initial=[...board.turns];return board;
}
export function dailyCircuit(key,variant='classic'){
 const v=variants.find(v=>v.id===variant);if(!v)throw new Error('Unknown circuit variant');
 return makeCircuit(4,92653+dayNumber(key)*7919+v.offset,'daily',key,variant);
}
export function applyTurn(board,index,delta=1){
 if(board.won||!Number.isInteger(index)||index<0||index>=board.base.length||board.locked?.[index]||rotate(board.base[index])===board.base[index])return false;
 board.history.push({turns:[...board.turns],moves:board.moves});board.turns[index]+=delta;board.moves++;board.started=true;board.won=solved(board);return true;
}
export function undo(board){if(board.won||!board.history.length)return false;const h=board.history.pop();board.turns=h.turns;board.moves=h.moves;return true;}
export function reset(board){if(board.won)return false;board.turns=[...board.initial];board.moves=0;board.hints=0;board.history=[];board.elapsed=0;board.started=false;return true;}
export function hint(board){
 if(board.won)return -1;const lit=powered(board),wrong=board.base.map((_,i)=>i).filter(i=>!board.locked?.[i]&&rotate(board.base[i],board.turns[i])!==board.base[i]);
 const i=wrong.find(i=>lit.has(i))??wrong[0];if(i===undefined)return -1;
 board.history.push({turns:[...board.turns],moves:board.moves});board.turns[i]+=((4-board.turns[i]%4)%4+4)%4;board.moves++;board.hints++;board.started=true;board.won=solved(board);return i;
}
export function validBoard(board,mode,key,variant='classic'){
 if(!validClassic(board,mode,key)||(board.variant||'classic')!==variant)return false;
 const n=board.base.length;
 if(board.groups&&(!Array.isArray(board.groups)||board.groups.length!==n||!board.groups.every(g=>g===0||g===1)))return false;
 if(board.sources&&(!Array.isArray(board.sources)||!board.sources.length||!board.sources.every(i=>Number.isInteger(i)&&i>=0&&i<n)))return false;
 if(board.locked&&(!Array.isArray(board.locked)||board.locked.length!==n))return false;
 if(variant==='split'&&(!board.groups?.includes(1)||board.sources?.length!==2))return false;
 if(variant==='locked'&&(!board.locked?.some(Boolean)||board.locked.some((v,i)=>v&&rotate(board.base[i],board.turns[i])!==board.base[i])))return false;
 return true;
}
