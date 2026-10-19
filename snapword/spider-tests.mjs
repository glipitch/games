import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,movable,canMove,move,deal,canDeal,hint,snapshot,validState} from './dist/spider-engine.js';
const card=(rank,suit='S',up=true,id=rank)=>({rank,suit,up,id});
const fixture=cols=>({version:1,columns:[...cols,...Array.from({length:10-cols.length},()=>[])],stock:[],completed:[],moves:0,score:500,won:false});
test('104-card two-suit deals have the standard layout, four copies and stable seeded shuffles',()=>{
 for(let seed=0;seed<300;seed++){const s=newGame(seed);assert.equal(validState(s),true);assert.deepEqual(s.columns.map(c=>c.length),[6,6,6,6,5,5,5,5,5,5]);assert.equal(s.stock.length,50);assert.equal(s.columns.flat().filter(c=>c.up).length,10);}
 assert.deepEqual(newGame(19),newGame(19));assert.notDeepEqual(newGame(19),newGame(20));
});
test('move mixed-suit singles onto the next rank, but move groups only in descending matching suits',()=>{
 const s=fixture([[card(9),card(8),card(7)],[card(10,'H')],[card(8,'H')]]);
 assert.equal(movable(s,0,0),true);assert.equal(canMove(s,0,0,1),true);assert.equal(canMove(s,0,2,2),true);assert.equal(canMove(s,0,0,0),false);assert.equal(canMove(s,0,0,2),false);
 s.columns[0][1].suit='H';assert.equal(movable(s,0,0),false);assert.equal(movable(s,0,1),false);assert.equal(movable(s,0,2),true);
 const before=snapshot(s);assert.equal(move(s,0,0,1),false);assert.deepEqual(s,before);
 s.columns[0][2].up=false;assert.equal(movable(s,0,2),false);assert.equal(movable(s,0,-1),false);
});
test('moving to an empty column reveals the card below and costs one point',()=>{
 const s=fixture([[card(3,'H',false),card(9),card(8)]]);assert.equal(move(s,0,1,4),true);assert.equal(s.columns[0][0].up,true);assert.deepEqual(s.columns[4].map(c=>c.rank),[9,8]);assert.equal(s.moves,1);assert.equal(s.score,499);
});
test('stock deals ten face-up cards and refuses to deal into any empty column',()=>{
 const s=newGame(20),before=snapshot(s);assert.equal(canDeal(s),true);assert.equal(deal(s),true);assert.equal(s.stock.length,40);assert.equal(s.columns.flat().length,64);assert.equal(validState(s),true);assert.equal(s.moves,1);
 s.columns[5]=[];const empty=snapshot(s);assert.equal(deal(s),false);assert.deepEqual(s,empty);assert.equal(before.stock.length,50);
});
test('suited K-to-A sequences clear, reveal hidden cards and can be undone from snapshots',()=>{
 const s=fixture([[card(4,'H',false),...Array.from({length:12},(_,i)=>card(13-i))],[card(1)]]),before=snapshot(s);
 assert.equal(move(s,1,0,0),true);assert.equal(s.completed.length,1);assert.deepEqual(s.columns[0],[card(4,'H')]);assert.equal(s.score,599);assert.equal(s.won,false);assert.equal(before.completed.length,0);assert.equal(before.columns[0][0].up,false);
 const mixed=fixture([[...Array.from({length:12},(_,i)=>card(13-i))],[card(1,'H')]]);move(mixed,1,0,0);assert.equal(mixed.completed.length,0);
});
test('eighth sequence wins with all 104 cards conserved; persisted saves reject corruption',()=>{
 const initial=newGame(12),pool=[...initial.columns.flat(),...initial.stock],runs=[];
 for(const suit of ['S','H'])for(let copy=0;copy<4;copy++){const run=[];for(let rank=13;rank>0;rank--){const i=pool.findIndex(c=>c.suit===suit&&c.rank===rank);run.push({...pool.splice(i,1)[0],up:true});}runs.push(run);}
 const last=runs.pop(),s=fixture([last.slice(0,12),last.slice(12)]);s.completed=runs;assert.equal(validState(s),true);const before=snapshot(s);move(s,1,0,0);assert.equal(s.won,true);assert.equal(s.completed.length,8);assert.equal(validState(s),true);assert.equal(canDeal(s),false);assert.equal(canMove(s,0,0,1),false);assert.equal(validState(JSON.parse(JSON.stringify(before))),true);
 const broken=snapshot(before);broken.columns[1][0].id=broken.columns[0][0].id;assert.equal(validState(broken),false);const wrong=snapshot(before);wrong.completed[0][0].rank=1;assert.equal(validState(wrong),false);
});
test('hints always name legal moves; repeated move/deal/undo preserves a valid deck',()=>{
 for(let seed=0;seed<30;seed++){let s=newGame(seed);for(let i=0;i<30;i++){const old=snapshot(s),h=hint(s);if(h){assert.equal(canMove(s,h.from,h.index,h.to),true);move(s,h.from,h.index,h.to);}else if(canDeal(s))deal(s);else break;assert.equal(validState(s),true);if(i%7===0){s=old;assert.equal(validState(s),true);}}}
});
