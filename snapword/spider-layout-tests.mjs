import test from 'node:test';
import assert from 'node:assert/strict';
import {CARD_RATIO,fitGeometry,fitDesktopGeometry,columnGeometry} from './dist/spider-layout.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);

test('all ten columns fit narrow portrait, landscape and desktop tables',()=>{
 for(const available of [276,304,350,680,728,1024,1400,1920])for(const gap of [2,3,5,8]){
  const geometry=fitGeometry(available,gap);
  assert.ok(geometry.cardWidth>=24,'Narrow cards retain a usable touch width');
  close(geometry.cardWidth*10+geometry.gap*9,available);
  assert.ok(geometry.up>=24,'Exposed ranks retain a usable touch height');
  assert.ok(geometry.cardHeight>=60,'Compact cards leave room for rank and suit');
  if(geometry.compact){
   const rank=Math.max(24,Math.min(geometry.cardWidth*.70,32)),suit=Math.max(22,Math.min(geometry.cardWidth*.66,30));
   assert.ok(geometry.up>=rank+suit+9,'Both rank and suit remain exposed in a stack');
   assert.ok(geometry.cardHeight>=geometry.up,'The compact index fits inside its card');
  }else assert.ok(geometry.up>=geometry.cardWidth*62/146,'The enlarged illustrated corner suit stays exposed');
  if(!geometry.compact)close(geometry.cardWidth/geometry.cardHeight,CARD_RATIO);
 }
});

const stacks=(up,down=0)=>[Array.from({length:up+down},(_,i)=>({up:i>=down})),...Array.from({length:9},()=>[{up:true}])];
test('desktop fitting leaves already fitting cards at their original size',()=>{
 const columns=stacks(6,5),base=fitGeometry(1366,8),fitted=fitDesktopGeometry(1366,8,columns,900);
 for(const key of ['cardWidth','cardHeight','up','down','boardWidth'])close(fitted[key],base[key]);
 assert.equal(fitted.dense,false);assert.equal(fitted.fitsHeight,true);
});
test('desktop fitting first tightens hidden cards, then scales only as much as needed',()=>{
 const base=fitGeometry(1366,8),hidden=fitDesktopGeometry(1366,8,stacks(2,20),400);
 close(hidden.cardWidth,base.cardWidth);assert.ok(hidden.down>=4&&hidden.down<base.down);
 close(columnGeometry(stacks(2,20)[0],hidden).height,400);
 const columns=stacks(12),scaled=fitDesktopGeometry(1366,8,columns,600);
 assert.equal(scaled.dense,false);assert.ok(scaled.cardWidth>=90&&scaled.cardWidth<base.cardWidth);
 close(scaled.cardWidth/scaled.cardHeight,CARD_RATIO);close(columnGeometry(columns[0],scaled).height,600);
});
test('long desktop stacks keep readable horizontal indices and a scrollable minimum',()=>{
 const columns=stacks(15),dense=fitDesktopGeometry(1366,8,columns,500);
 assert.equal(dense.dense,true);assert.equal(dense.fitsHeight,true);assert.ok(dense.up>=23);
 close(columnGeometry(columns[0],dense).height,500);
 const extreme=fitDesktopGeometry(1366,8,stacks(32),500);
 assert.equal(extreme.fitsHeight,false);assert.ok(extreme.cardWidth>=90&&extreme.up>=23);
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
