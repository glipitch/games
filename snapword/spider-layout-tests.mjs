import test from 'node:test';
import assert from 'node:assert/strict';
import {CARD_RATIO,fitGeometry,columnGeometry} from './dist/spider-layout.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);

test('all ten columns fit narrow portrait, landscape and desktop tables',()=>{
 for(const available of [276,304,350,680,728,1024,1400,1920])for(const gap of [2,3,5,8]){
  const geometry=fitGeometry(available,gap);
  assert.ok(geometry.cardWidth>=24,'Narrow cards retain a usable touch width');
  close(geometry.cardWidth*10+geometry.gap*9,available);
  assert.ok(geometry.up>=24,'Exposed ranks retain a usable touch height');
  assert.ok(geometry.cardHeight>=66,'Compact cards leave room for rank and suit');
  if(!geometry.compact)close(geometry.cardWidth/geometry.cardHeight,CARD_RATIO);
 }
});
test('long stacks stay ordered through resize without overlapping rank strips',()=>{
 const cards=Array.from({length:35},(_,i)=>({up:i>=5}));
 for(const width of [276,350,728,1400]){
  const geometry=fitGeometry(width,3),positions=columnGeometry(cards,geometry);
  assert.ok(positions.tops.every((top,i)=>!i||top>positions.tops[i-1]));
  close(positions.tops[6]-positions.tops[5],geometry.up);
  close(positions.height,positions.tops.at(-1)+geometry.cardHeight);
  assert.equal(columnGeometry([],geometry).height,geometry.cardHeight);
  assert.deepEqual(columnGeometry([{up:true}],geometry),{tops:[0],height:geometry.cardHeight});
 }
});
