import test from 'node:test';
import assert from 'node:assert/strict';
import {games} from './dist/arcade-data.js';
import {makePuzzle,choose,checkSelection,nudge,undoMove,wordRoute,flipSolution,flipAt,slideSolution,slideNeighbours,slideGoal,twentySolution,calculate,fraction,combine,validState} from './dist/arcade-engine.js';

test('all six daily puzzles are deterministic and free-play seeds vary',()=>{
 assert.equal(games.length,6);
 for(const {id}of games){
  assert.deepEqual(makePuzzle(id,'daily','2026-10-15',1),makePuzzle(id,'daily','2026-10-15',999));
  assert.notDeepEqual(makePuzzle(id,'daily','2026-10-15'),makePuzzle(id,'daily','2026-10-16'));
  assert.notDeepEqual(makePuzzle(id,'free','2026-10-15',1),makePuzzle(id,'free','2026-10-15',2));
 }
});
test('every game completes through its actual move handlers and hints',()=>{
 for(const {id}of games)for(let seed=0;seed<60;seed++){
  const s=makePuzzle(id,'free','2026-10-15',seed);
  for(let step=0;!s.done&&step<100;step++){assert.ok(nudge(s),`${id} hint at seed ${seed}`);if(['quartet','weave'].includes(id))assert.ok(checkSelection(s));}
  assert.ok(s.won,`${id} seed ${seed} must be solvable`);assert.ok(s.done);assert.equal(nudge(s),false);
 }
});
test('word ladders contain only legal one-letter transitions',()=>{
 for(let seed=0;seed<100;seed++){
  const s=makePuzzle('shift','free','2026-10-15',seed),route=wordRoute(s.from,s.target);
  assert.ok(route.length>=5&&route.length<=8);assert.equal(route.length-1,s.par);
  for(const w of route.slice(1)){assert.equal([...w].filter((c,i)=>c!==s.current[i]).length,1);assert.ok(choose(s,w));}
  assert.ok(s.won);
 }
});
test('Quartet has sixteen distinct words and wins only on real groups',()=>{
 for(let seed=0;seed<100;seed++){
  const s=makePuzzle('quartet','free','2026-10-15',seed);assert.equal(new Set(s.order).size,16);
  for(let n=0;n<4;n++){s.selected=[...s.groups[n].words];checkSelection(s);}
  assert.ok(s.won);assert.equal(s.strikes,0);
 }
 const s=makePuzzle('quartet','daily','2026-10-15');
 for(let n=0;n<4;n++){s.selected=[...s.groups[0].words.slice(0,2),...s.groups[1].words.slice(0,2)];checkSelection(s);}
 assert.equal(s.strikes,4);assert.ok(s.done);assert.equal(s.won,false);
});
test('Weave plants every answer on an adjacent path with no reused tile',()=>{
 for(let seed=0;seed<250;seed++){
  const s=makePuzzle('weave','free','2026-10-15',seed);assert.equal(s.letters.length,16);assert.ok(s.letters.every(l=>/^[A-Z]$/.test(l)));
  for(const t of s.targets){
   assert.equal(t.cells.map(i=>s.letters[i]).join(''),t.word);assert.equal(new Set(t.cells).size,4);
   for(let n=1;n<t.cells.length;n++){const a=t.cells[n-1],b=t.cells[n];assert.ok(Math.abs(a%4-b%4)<=1&&Math.abs(Math.floor(a/4)-Math.floor(b/4))<=1);}
  }
 }
 const s=makePuzzle('weave','daily','2026-10-15');for(const i of [...s.targets[0].cells].reverse())choose(s,i);checkSelection(s);assert.deepEqual(s.found,[0]);
});
test('Flip solver clears every generated board, and taps are reversible',()=>{
 for(let seed=0;seed<350;seed++){
  const s=makePuzzle('flip','free','2026-10-15',seed);assert.ok(s.lights.some(Boolean));const moves=flipSolution(s.lights);assert.ok(moves);
  let lights=[...s.lights];for(const i of moves)lights=flipAt(lights,i);assert.ok(lights.every(n=>n===0));
  for(let i=0;i<16;i++)assert.deepEqual(flipAt(flipAt(s.lights,i),i),s.lights);
 }
});
test('Slide scrambles are solvable and the solver emits legal sliding moves',()=>{
 for(let seed=0;seed<70;seed++){
  const s=makePuzzle('slide','free','2026-10-15',seed),route=slideSolution(s.tiles);assert.ok(route?.length);
  for(const i of route){assert.ok(slideNeighbours(s.tiles.indexOf(0)).includes(i));choose(s,i);}
  assert.deepEqual(s.tiles,slideGoal);assert.ok(s.won);
 }
});
test('Twenty Four uses exact fractions, including fraction-only solutions',()=>{
 const s=makePuzzle('twentyfour','free','2026-10-15',109);s.values=[8,8,3,3].map(n=>fraction(n));
 const route=twentySolution(s.values);assert.equal(route.length,3);
 for(const step of route){s.selected=[step.i,step.j];assert.ok(combine(s,step.op));}
 assert.deepEqual(s.values,[fraction(24)]);assert.ok(s.won);
 assert.equal(calculate(fraction(1),fraction(0),'÷'),null);
 assert.deepEqual(calculate(fraction(1,3),fraction(2,3),'+'),fraction(1));
});
test('undo restores prior boards and saved progress round-trips',()=>{
 for(const id of ['shift','flip','slide','twentyfour']){
  const s=makePuzzle(id,'free','2026-10-15',42),before=JSON.parse(JSON.stringify(s));nudge(s);
  if(!s.done){assert.ok(undoMove(s));for(const field of ({shift:['current','trail'],flip:['lights'],slide:['tiles'],twentyfour:['values','calculations']})[id])assert.deepEqual(s[field],before[field]);assert.equal(s.moves,0);}
  assert.ok(validState(JSON.parse(JSON.stringify(s)),id,'free','2026-10-15'));
  assert.equal(validState(s,id,'daily','2026-10-15'),false);
 }
});
