import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCircuit,dailyCircuit,powered,solved,rotate,applyTurn,undo,reset,hint,validBoard,directions} from './dist/signal-engine.js';
test('daily circuits are stable and change at the next date',()=>{
 assert.deepEqual(dailyCircuit('2026-10-15'),dailyCircuit('2026-10-15'));
 assert.notDeepEqual(dailyCircuit('2026-10-15').base,dailyCircuit('2026-10-16').base);
});
test('generated circuits are connected trees with no dangling or off-board wires',()=>{
 for(const size of [3,4,5])for(let seed=0;seed<400;seed++){
  const b=makeCircuit(size,seed);assert.equal(solved(b),false,'Scramble must need solving');
  b.turns.fill(0);assert.equal(powered(b).size,size*size);
  let ports=0;
  b.base.forEach((m,i)=>{const r=Math.floor(i/size),c=i%size;for(const [dr,dc,bit,opposite]of directions)if(m&bit){ports++;const nr=r+dr,nc=c+dc;assert.ok(nr>=0&&nr<size&&nc>=0&&nc<size);assert.ok(b.base[nr*size+nc]&opposite);}});
  assert.equal(ports,2*(size*size-1));
 }
});
test('hints always lead to a complete solution within one fix per tile',()=>{
 for(const size of [3,4,5])for(let seed=0;seed<200;seed++){
  const b=makeCircuit(size,seed);for(let n=0;n<size*size&&!b.won;n++)assert.ok(hint(b)>=0);
  assert.ok(b.won);assert.ok(solved(b));assert.equal(applyTurn(b,0),false);
 }
});
test('undo restores the exact previous state and reset restores the original scramble',()=>{
 const b=makeCircuit(4,718);const original=[...b.turns];const i=b.base.findIndex(x=>x!==15);
 assert.ok(applyTurn(b,i));assert.equal(b.moves,1);assert.notDeepEqual(b.turns,original);
 assert.ok(undo(b));assert.equal(b.moves,0);assert.deepEqual(b.turns,original);
 applyTurn(b,i,-1);hint(b);reset(b);assert.deepEqual(b.turns,original);assert.equal(b.moves,0);assert.equal(b.history.length,0);assert.equal(b.hints,0);
});
test('rotation preserves ports and supports reverse turns',()=>{
 for(let m=1;m<16;m++){assert.equal(rotate(m,4),m);assert.equal(rotate(rotate(m),-1),m);}
 assert.equal(rotate(1),2);assert.equal(rotate(8),1);
});
test('saved games round-trip and malformed records are rejected',()=>{
 const b=dailyCircuit('2026-10-15');applyTurn(b,0);
 const saved=JSON.parse(JSON.stringify(b));assert.ok(validBoard(saved,'daily','2026-10-15'));assert.deepEqual(powered(saved),powered(b));
 assert.equal(validBoard(saved,'daily','2026-10-16'),false);assert.equal(validBoard({},'daily','2026-10-15'),false);
});
