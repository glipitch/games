import {makeCircuit,validBoard,sizes,variants} from './circuit-engine.js?v=9';

const prefix='circuit:v3:';
function restoreBoard(board){
 // Drop retired player pins and their note-only undo entries, keeping moves.
 const {pinned,...rest}=board;
 rest.history=board.history.filter((snapshot,i)=>{
  const next=board.history[i+1]||board;
  return snapshot.moves!==next.moves||snapshot.turns.some((turn,j)=>turn!==next.turns[j]);
 }).map(({pinned,...snapshot})=>snapshot);
 return rest;
}
export function circuitStorage(storage){
 let available=true;
 function get(key,fallback=null){try{return JSON.parse(storage.getItem(key))??fallback;}catch{return fallback;}}
 function set(key,value){try{storage.setItem(key,JSON.stringify(value));available=true;}catch{available=false;}}
 const boardKey=(v,size,seed)=>`${prefix}${v}:${size}${seed===undefined?'':':seed:'+seed}`;
 function legacy(v,size){
  const oldPrefix='signal:v1:'+(v==='classic'?'':v+':');
  const candidates=[get(`circuit:v2:${v}:free`),get(oldPrefix+'free')];
  try{
   const keys=Array.from({length:storage.length},(_,i)=>storage.key(i)).filter(k=>k?.startsWith(`circuit:v2:${v}:daily:`)||k?.startsWith(oldPrefix+'daily:')).sort().reverse();
   candidates.push(...keys.map(k=>get(k)));
  }catch{}
  return candidates.find(b=>b?.size===size&&!b.won&&validBoard(b,b.mode,b.key,v));
 }
 return {
  get available(){return available;},
  settings(){
   const s=get(prefix+'settings',{});
   return {variant:variants.some(v=>v.id===s.variant)?s.variant:'classic',size:sizes.includes(s.size)?s.size:legacy('classic',4)?4:5};
  },
  saveSettings(variant,size){set(prefix+'settings',{variant,size});},
  load(variant,size,seed){
   const saved=get(boardKey(variant,size,seed));
   if(validBoard(saved,'play','',variant)&&saved.size===size&&(seed===undefined||saved.seed===seed))return restoreBoard(saved);
   // Copy old progress; retain the original saves for older open tabs.
   const old=seed===undefined?legacy(variant,size):get(boardKey(variant,size));
   if(old&&old.size===size&&(seed===undefined||old.seed===seed)&&validBoard(old,old.mode,old.key,variant))return {...restoreBoard(old),mode:'play',key:'',variant};
   return makeCircuit(size,seed??crypto.getRandomValues(new Uint32Array(1))[0],'play','',variant);
  },
  save(board,shared=false){set(boardKey(board.variant,board.size,shared?board.seed:undefined),board);},
 };
}
