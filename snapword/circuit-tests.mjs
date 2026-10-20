import test from 'node:test';
import assert from 'node:assert/strict';
import {variants,sizes,makeCircuit,dailyCircuit,flow,solved,hint,nextHint,deductions,applyTurn,togglePin,undo,reset,validBoard,neighbours,rotate} from './dist/circuit-engine.js';
import {circuitStorage} from './dist/circuit-storage.js';
import {dailyCircuit as legacyDaily} from './dist/signal-engine.js';
test('legacy daily sequences stay deterministic and independent',()=>{
 for(const v of variants){assert.deepEqual(dailyCircuit('2026-10-15',v.id),dailyCircuit('2026-10-15',v.id));assert.notDeepEqual(dailyCircuit('2026-10-15',v.id).base,dailyCircuit('2026-10-16',v.id).base);}
 assert.equal(new Set(variants.map(v=>dailyCircuit('2026-10-15',v.id).seed)).size,variants.length);
});
test('classic puzzles and legacy saves keep their exact puzzle and progress',()=>{
 const old=legacyDaily('2026-10-15'),next=dailyCircuit('2026-10-15');assert.deepEqual(next.base,old.base);assert.deepEqual(next.turns,old.turns);assert.ok(validBoard(old,'daily','2026-10-15','classic'));assert.equal(validBoard(old,'daily','2026-10-15','wrap'),false);
});
test('2,400 circuits across six modes and eight sizes start unsolved and complete through hints',()=>{
 for(const v of variants)for(const size of sizes)for(let seed=0;seed<50;seed++){
  const b=makeCircuit(size,seed,'free','',v.id);assert.equal(solved(b),false);assert.ok(validBoard(b,'free','',v.id));
  for(let n=0;n<size*size&&!b.won;n++)assert.ok(hint(b)>=0,`${v.id} size ${size} seed ${seed}`);
  assert.ok(b.won);assert.equal(flow(b).lit.size,size*size);assert.equal(flow(b).shorts.size,0);
 }
});

test('Mesh adds cycles and requires every wire end to connect even when all tiles have power',()=>{
 let found=false;
 for(let seed=0;seed<100&&!found;seed++){
  const b=makeCircuit(5,seed,'play','','mesh');b.turns.fill(0);
  assert.ok(solved(b));assert.equal(flow(b).loose.size,0);
  assert.ok(b.base.reduce((sum,m)=>sum+[1,2,4,8].filter(bit=>m&bit).length,0)>2*(25-1));
  for(let i=0;i<25&&!found;i++)for(let t=1;t<4&&!found;t++){
   b.turns.fill(0);b.turns[i]=t;
   if(flow(b).lit.size===25&&flow(b).loose.size){assert.equal(solved(b),false);found=true;}
  }
 }
 assert.ok(found,'There are fully powered networks with dangling wires that must not count as complete');
});

test('Barriers are reciprocal walls that block flow without blocking the generated solution',()=>{
 for(const size of sizes)for(let seed=0;seed<25;seed++){
  const b=makeCircuit(size,seed,'play','','barriers');assert.ok(b.walls.some(Boolean));
  for(let i=0;i<b.base.length;i++)for(const n of neighbours({...b,walls:undefined},i)){
   assert.equal(Boolean(b.walls[i]&n.bit),Boolean(b.walls[n.index]&n.opposite));
   if(b.walls[i]&n.bit){assert.equal(b.base[i]&n.bit,0);assert.ok(!neighbours(b,i).some(edge=>edge.index===n.index));}
  }
  b.turns.fill(0);assert.ok(solved(b));assert.equal(flow(b).loose.size,0);
 }
 const blocked={size:3,base:[2,8,0,0,0,0,0,0,0],turns:Array(9).fill(0),walls:[2,8,0,0,0,0,0,0,0],variant:'barriers'};
 assert.deepEqual([...flow(blocked).lit],[0]);
});

test('pins protect rotations, undo restores notes, and hints unpin the tile they explain',()=>{
 const b=makeCircuit(8,91,'play','','barriers'),h=nextHint(b),i=h.index;
 assert.ok(togglePin(b,i));assert.equal(applyTurn(b,i),false);assert.equal(b.moves,0);
 assert.ok(nextHint(b).text.includes('pin was removed'));assert.equal(hint(b),i);assert.equal(b.pinned[i],false);
 assert.ok(undo(b));assert.equal(b.pinned[i],true);assert.equal(b.moves,0);
 assert.ok(undo(b));assert.equal(b.pinned[i],false);
 togglePin(b,i);reset(b);assert.ok(b.pinned.every(p=>!p));assert.deepEqual(b.turns,b.initial);
});

test('deduction domains retain every valid small-board solution',()=>{
 for(const variant of ['classic','locked','split','mesh','barriers']){
  const b=makeCircuit(3,18,'play','',variant),domains=deductions(b);
  assert.ok(domains.every((choices,i)=>choices.includes(b.base[i])));
  const options=b.base.map((m,i)=>b.locked[i]?[0]:[0,1,2,3].filter((t,_,all)=>all.find(k=>rotate(m,k)===rotate(m,t))===t));
  let solutions=0;
  function visit(i){if(i===9){if(solved(b)){solutions++;b.base.forEach((m,j)=>assert.ok(domains[j].includes(rotate(m,b.turns[j]))));}return;}
   for(const turn of options[i]){b.turns[i]=turn;visit(i+1);}
  }
  visit(0);assert.ok(solutions>0);
 }
 const wrap=makeCircuit(5,42,'play','','wrap');assert.equal(nextHint(wrap).kind,'reveal');
});

function memoryStorage(){const entries=new Map();return {get length(){return entries.size;},key:i=>[...entries.keys()][i],getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value)};}
test('progress persists independently by mode and size, including pins and undo',()=>{
 const storage=memoryStorage(),cache=circuitStorage(storage);
 for(const v of variants)for(const size of sizes){const b=makeCircuit(size,73,'play','',v.id);const i=b.base.findIndex((m,i)=>m!==15&&!b.locked[i]);applyTurn(b,i);togglePin(b,i);cache.save(b);}
 for(const v of variants)for(const size of sizes){const b=cache.load(v.id,size);assert.equal(b.size,size);assert.equal(b.variant,v.id);assert.equal(b.seed,73);assert.equal(b.moves,1);assert.ok(b.pinned.some(Boolean));assert.ok(undo(b));assert.ok(b.pinned.every(p=>!p));assert.ok(undo(b));assert.deepEqual(b.turns,b.initial);}
});
test('old Circuit and Signal progress is copied into play while the originals are retained',()=>{
 for(const prefix of ['circuit:v2:classic:','signal:v1:']){
  const storage=memoryStorage(),cache=circuitStorage(storage),b=dailyCircuit('2026-10-15');applyTurn(b,0);
  const raw=JSON.stringify(b);storage.setItem(prefix+'daily:2026-10-15',raw);
  assert.equal(cache.settings().size,4);
  const migrated=cache.load('classic',4);assert.equal(migrated.mode,'play');assert.equal(migrated.key,'');assert.deepEqual(migrated.turns,b.turns);assert.equal(migrated.moves,b.moves);
  cache.save(migrated);assert.equal(storage.getItem(prefix+'daily:2026-10-15'),raw);assert.deepEqual(cache.load('classic',4),migrated);
 }
});
test('shared puzzles reproduce the seed and keep their progress away from the regular board',()=>{
 const storage=memoryStorage(),cache=circuitStorage(storage),regular=makeCircuit(10,12,'play','','mesh');cache.save(regular);
 const shared=cache.load('mesh',10,99);assert.deepEqual(shared,makeCircuit(10,99,'play','','mesh'));
 hint(shared);cache.save(shared,true);assert.deepEqual(cache.load('mesh',10),regular);assert.deepEqual(cache.load('mesh',10,99),shared);
});
test('corrupt saves are rejected and unavailable storage does not prevent play',()=>{
 const storage=memoryStorage(),cache=circuitStorage(storage),b=makeCircuit(4,5,'play','','locked');
 for(const mutation of [b=>b.turns.pop(),b=>b.history.push({turns:[],moves:0}),b=>b.pinned=['yes'],b=>b.locked=['yes'],b=>b.sources=[999],b=>b.won=true]){
  const bad=structuredClone(b);mutation(bad);assert.equal(validBoard(bad,'play','','locked'),false);
 }
 storage.setItem('circuit:v3:locked:4','{bad json');assert.ok(validBoard(cache.load('locked',4),'play','','locked'));
 storage.setItem('circuit:v3:settings','null');assert.equal(cache.settings().variant,'classic');
 const unavailable=circuitStorage(undefined),fresh=unavailable.load('mesh',10);unavailable.save(fresh);assert.equal(unavailable.available,false);assert.equal(fresh.base.length,100);
});
test('wrap connects opposite edges, while classic does not',()=>{
 const b={size:3,base:[8,0,2,0,0,0,0,0,0],turns:Array(9).fill(0),variant:'wrap',sources:[0],groups:Array(9).fill(0)};
 assert.deepEqual([...flow(b).lit],[0,2]);b.variant='classic';assert.deepEqual([...flow(b).lit],[0]);
});
test('locked tiles cannot rotate and reset keeps the given orientations',()=>{
 const b=makeCircuit(4,43,'free','','locked'),fixed=b.locked.findIndex(Boolean);assert.ok(fixed>=0);assert.equal(applyTurn(b,fixed),false);assert.equal(b.moves,0);
 const free=b.locked.findIndex((v,i)=>!v&&b.base[i]!==15);applyTurn(b,free);assert.ok(undo(b));applyTurn(b,free);reset(b);assert.deepEqual(b.turns,b.initial);
 b.locked.forEach((locked,i)=>{if(locked)assert.equal(rotate(b.base[i],b.turns[i]),b.base[i]);});
});
test('split uses two connected source regions and detects crossed networks',()=>{
 const b=makeCircuit(4,8,'free','','split');assert.equal(b.sources.length,2);b.turns.fill(0);assert.ok(solved(b));
 let edge;
 for(let i=0;i<b.base.length&&!edge;i++)for(const n of neighbours(b,i))if(b.groups[i]!==b.groups[n.index]){edge={i,...n};break;}
 assert.ok(edge);
 b.turns[edge.i]=[0,1,2,3].find(t=>rotate(b.base[edge.i],t)&edge.bit);
 b.turns[edge.index]=[0,1,2,3].find(t=>rotate(b.base[edge.index],t)&edge.opposite);
 assert.ok(flow(b).shorts.has(edge.i));assert.ok(flow(b).shorts.has(edge.index));assert.equal(solved(b),false);
});
test('variant saves round-trip, reject the wrong mode and restore undo',()=>{
 for(const v of variants){const b=makeCircuit(4,92,'free','',v.id);const i=b.base.findIndex((m,i)=>m!==15&&!b.locked[i]);const initial=[...b.turns];applyTurn(b,i);const saved=JSON.parse(JSON.stringify(b));assert.ok(validBoard(saved,'free','',v.id));assert.equal(validBoard(saved,'daily','2026-10-15',v.id),false);if(!saved.won){assert.ok(undo(saved));assert.deepEqual(saved.turns,initial);}}
});
