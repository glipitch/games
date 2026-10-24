import test from 'node:test';
import assert from 'node:assert/strict';
import {CARD_RATIO,fitGeometry,fitZoom,tightZoom,columnGeometry,tightColumnGeometry} from './dist/spider-layout.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);

test('all ten columns fit narrow portrait, landscape and desktop tables',()=>{
 for(const available of [276,304,350,680,728,1024,1400,1920])for(const gap of [2,3,5,8])for(const compact of [false,true]){
  const geometry=fitGeometry(available,gap,compact);
  assert.ok(geometry.cardWidth>=24,'Narrow cards retain a usable touch width');
  close(geometry.cardWidth*10+geometry.gap*9,available);
  assert.equal(geometry.compact,compact,'Screen width never selects a card style');
  assert.ok(geometry.up>=12,'Regular faces retain their proportions');
  if(geometry.compact){
   assert.ok(geometry.cardHeight>=60,'Compact cards leave room for rank and suit');
   const rank=Math.max(24,Math.min(geometry.cardWidth*.70,32)),suit=Math.max(22,Math.min(geometry.cardWidth*.66,30));
   assert.ok(geometry.up>=rank+suit+9,'Both rank and suit remain exposed in a stack');
   assert.ok(geometry.cardHeight>=geometry.up,'The compact index fits inside its card');
  }else assert.ok(geometry.up>=geometry.cardWidth*62/146,'The enlarged illustrated corner suit stays exposed');
  if(!geometry.compact)close(geometry.cardWidth/geometry.cardHeight,CARD_RATIO);
 }
});

test('tight stacks compress only covered spacing and leave short columns alone',()=>{
 const geometry=fitGeometry(1400,8),short=Array.from({length:3},()=>({up:true})),long=Array.from({length:30},(_,i)=>({up:i>=5}));
 assert.deepEqual(tightColumnGeometry(short,geometry,600),columnGeometry(short,geometry));
 const positions=tightColumnGeometry(long,geometry,600);
 close(positions.height,600);close(positions.height-positions.tops.at(-1),geometry.cardHeight);
 assert.ok(positions.tops.every((top,i)=>!i||top>positions.tops[i-1]));
 assert.ok(positions.tops[6]-positions.tops[5]<geometry.up);
 close(positions.tops[1]-positions.tops[0],8);
});

test('tight stacks retain eight visible pixels of every back even when the table is zoomed',()=>{
 for(const compact of [false,true])for(const width of [304,1400])for(const room of [150,300,600]){
  const geometry=fitGeometry(width,3,compact),columns=[Array.from({length:40},(_,i)=>({up:i>=5})),[{up:false},{up:true}]];
  const zoom=tightZoom(geometry,columns,room);
  for(const cards of columns){
   const positions=tightColumnGeometry(cards,geometry,room/zoom,zoom);
   assert.ok(positions.height*zoom<=room+.001,'The cards still fit');
   cards.slice(0,-1).forEach((card,i)=>{if(!card.up)assert.ok((positions.tops[i+1]-positions.tops[i])*zoom>=8-.001,'The back remains visibly exposed in screen pixels');});
  }
 }
});

test('tight stacks fit very short windows while retaining a visible strip for every card',()=>{
 const geometry=fitGeometry(1400,8),columns=[Array.from({length:80},()=>({up:true}))],room=150;
 const zoom=tightZoom(geometry,columns,room),positions=tightColumnGeometry(columns[0],geometry,room/zoom);
 assert.ok(zoom<1);close(positions.height*zoom,room);
 assert.ok(positions.tops.every((top,i)=>!i||top>positions.tops[i-1]));
});

test('fit zoom scales the original geometry uniformly without enlarging it',()=>{
 for(const compact of [false,true]){
  const geometry=fitGeometry(1300,8,compact),columns=[Array.from({length:30},()=>({up:true}))];
  const natural=columnGeometry(columns[0],geometry).height,scale=fitZoom(geometry,columns,500);
  close(natural*scale,500);assert.ok(scale>0&&scale<1);
  close((geometry.cardWidth*scale)/(geometry.cardHeight*scale),geometry.cardWidth/geometry.cardHeight);
  assert.equal(fitZoom(geometry,columns,natural+100),1);
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
