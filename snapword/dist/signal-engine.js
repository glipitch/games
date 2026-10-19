import {random,shuffle,dayNumber} from './puzzles.js';
export const directions=[[-1,0,1,4],[0,1,2,8],[1,0,4,1],[0,-1,8,2]];
export function rotate(mask,turns=1){turns=((turns%4)+4)%4;return ((mask<<turns)|(mask>>(4-turns)))&15;}
export function powered(board){
 const {size,base,turns}=board,masks=base.map((m,i)=>rotate(m,turns[i])),seen=new Set([0]),queue=[0];
 for(let q=0;q<queue.length;q++){const i=queue[q],r=Math.floor(i/size),c=i%size;
  for(const [dr,dc,bit,opposite] of directions){const nr=r+dr,nc=c+dc,j=nr*size+nc;if(nr>=0&&nr<size&&nc>=0&&nc<size&&(masks[i]&bit)&&(masks[j]&opposite)&&!seen.has(j)){seen.add(j);queue.push(j);}}
 }
 return seen;
}
export function solved(board){return powered(board).size===board.size*board.size;}
export function makeCircuit(size,seed,mode='free',key=''){
 const rng=random(seed),base=Array(size*size).fill(0),parents=base.map((_,i)=>i),edges=[];
 function root(i){while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;}
 for(let r=0;r<size;r++)for(let c=0;c<size;c++){const i=r*size+c;if(c<size-1)edges.push([i,i+1,2,8]);if(r<size-1)edges.push([i,i+size,4,1]);}
 for(const [a,b,x,y] of shuffle(edges,rng)){const ra=root(a),rb=root(b);if(ra!==rb){parents[ra]=rb;base[a]|=x;base[b]|=y;}}
 const turns=base.map(()=>Math.floor(rng()*4));
 const board={version:1,size,seed,mode,key,base,turns,initial:[...turns],moves:0,hints:0,history:[],won:false,elapsed:0,started:false};
 if(solved(board)){const i=base.findIndex(m=>m!==15);turns[i]++;board.initial=[...turns];}
 return board;
}
export function dailyCircuit(key){return makeCircuit(4,92653+dayNumber(key)*7919,'daily',key);}
export function applyTurn(board,index,delta=1){
 if(board.won||!Number.isInteger(index)||index<0||index>=board.base.length||rotate(board.base[index])===board.base[index])return false;
 board.history.push({turns:[...board.turns],moves:board.moves});board.turns[index]+=delta;board.moves++;board.started=true;board.won=solved(board);return true;
}
export function undo(board){if(board.won||!board.history.length)return false;const last=board.history.pop();board.turns=last.turns;board.moves=last.moves;return true;}
export function reset(board){if(board.won)return false;board.turns=[...board.initial];board.moves=0;board.hints=0;board.history=[];board.elapsed=0;board.started=false;return true;}
export function hint(board){
 if(board.won)return -1;
 const lit=powered(board);
 const wrong=board.base.map((m,i)=>i).filter(i=>rotate(board.base[i],board.turns[i])!==board.base[i]);
 // Prefer a wrong tile near the existing signal, then work outward.
 const i=wrong.find(i=>lit.has(i))??wrong[0];if(i===undefined)return -1;
 board.history.push({turns:[...board.turns],moves:board.moves});
 board.turns[i]+=((4-board.turns[i]%4)%4+4)%4;board.moves++;board.hints++;board.started=true;board.won=solved(board);return i;
}
export function validBoard(b,mode,key){
 if(!b||b.version!==1||b.mode!==mode||b.key!==key||![3,4,5].includes(b.size)||!Array.isArray(b.base)||b.base.length!==b.size*b.size||!Array.isArray(b.turns)||b.turns.length!==b.base.length||!Array.isArray(b.initial)||b.initial.length!==b.base.length||!Array.isArray(b.history))return false;
 return b.base.every(m=>Number.isInteger(m)&&m>0&&m<=15)&&b.turns.every(Number.isInteger)&&Number.isFinite(b.moves)&&Number.isFinite(b.elapsed);
}
