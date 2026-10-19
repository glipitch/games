import test from 'node:test';
import assert from 'node:assert/strict';
import {deck,makeGame,dailyKey,dayNumber} from './dist/puzzles.js';
test('daily puzzle is identical for everyone and changes daily',()=>{
 assert.deepEqual(makeGame('daily','2026-10-15',1),makeGame('daily','2026-10-15',999));
 assert.notDeepEqual(makeGame('daily','2026-10-15').rounds,makeGame('daily','2026-10-16').rounds);
});
test('every round can be solved using its letter bank, including duplicate letters',()=>{
 for(let d=0;d<400;d++){
  const date=new Date(Date.UTC(2026,9,15+d)).toISOString().slice(0,10);
  const game=makeGame('daily',date);
  assert.equal(game.rounds.length,5);
  for(const r of game.rounds){const remaining=[...r.letters];for(const letter of r.answer){const i=remaining.indexOf(letter);assert.ok(i>=0,`${r.answer} missing ${letter}`);remaining.splice(i,1);}assert.ok(r.answer.length<=7);}
 }
});
test('London rollover accounts for daylight saving',()=>{
 assert.equal(dailyKey(new Date('2026-10-15T22:59:59Z')),'2026-10-15');
 assert.equal(dailyKey(new Date('2026-10-15T23:00:00Z')),'2026-10-16');
 assert.equal(dailyKey(new Date('2026-11-15T23:30:00Z')),'2026-11-15');
 assert.equal(dayNumber('2026-10-15'),0);
});
test('free play produces varied valid sets',()=>{
 assert.notDeepEqual(makeGame('practice','2026-10-15',11).rounds,makeGame('practice','2026-10-15',22).rounds);
 assert.ok(deck.length>=90);
 for(const p of deck)assert.ok(p.every(s=>typeof s==='string'&&s.length));
});
