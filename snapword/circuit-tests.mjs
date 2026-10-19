import test from 'node:test';
import assert from 'node:assert/strict';
import {variants,makeCircuit,dailyCircuit,flow,solved,hint,applyTurn,undo,reset,validBoard,neighbours,rotate} from './dist/circuit-engine.js';
import {dailyCircuit as legacyDaily} from './dist/signal-engine.js';
test('all four circuit variants are deterministic with independent dailies',()=>{
 for(const v of variants){assert.deepEqual(dailyCircuit('2026-10-15',v.id),dailyCircuit('2026-10-15',v.id));assert.notDeepEqual(dailyCircuit('2026-10-15',v.id).base,dailyCircuit('2026-10-16',v.id).base);}
 assert.equal(new Set(variants.map(v=>dailyCircuit('2026-10-15',v.id).seed)).size,4);
});
test('classic puzzles and legacy saves keep their exact puzzle and progress',()=>{
 const old=legacyDaily('2026-10-15'),next=dailyCircuit('2026-10-15');assert.deepEqual(next.base,old.base);assert.deepEqual(next.turns,old.turns);assert.ok(validBoard(old,'daily','2026-10-15','classic'));assert.equal(validBoard(old,'daily','2026-10-15','wrap'),false);
});
test('2,400 circuits across all modes and sizes start unsolved and complete through hints',()=>{
 for(const v of variants)for(const size of [3,4,5])for(let seed=0;seed<200;seed++){
  const b=makeCircuit(size,seed,'free','',v.id);assert.equal(solved(b),false);assert.ok(validBoard(b,'free','',v.id));
  for(let n=0;n<size*size&&!b.won;n++)assert.ok(hint(b)>=0,`${v.id} size ${size} seed ${seed}`);
  assert.ok(b.won);assert.equal(flow(b).lit.size,size*size);assert.equal(flow(b).shorts.size,0);
 }
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
