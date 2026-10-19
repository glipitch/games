import test from 'node:test';
import assert from 'node:assert/strict';
import {CARD_RATIO,zoomSteps,tableGeometry,columnGeometry} from './dist/spider-layout.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);
test('zoom preserves card proportions and scales every overlap uniformly',()=>{
 const cards=[{up:false},{up:false},{up:false},{up:true},{up:true},{up:true}];
 for(const width of [280,320,390,768,1147,1440,1920])for(const gap of [4,10,16])for(const wide of [false,true]){
 const base=tableGeometry(width,gap,wide,1);
 for(const scale of zoomSteps){const g=tableGeometry(width,gap,wide,scale),col=columnGeometry(cards,g);assert.ok(g.cardWidth>0);close(g.cardWidth/g.cardHeight,CARD_RATIO);close(g.cardWidth*10+g.gap*9,g.boardWidth);close(g.cardWidth,base.cardWidth*scale);close(g.gap,gap*scale);close(g.up/g.cardWidth,.34);close(g.down/g.cardWidth,.17);close(col.tops[3],3*g.down);close(col.tops[5],3*g.down+2*g.up);close(col.height,col.tops.at(-1)+g.cardHeight);assert.ok(col.tops.every((n,i)=>!i||n>col.tops[i-1]));}
 }
});
test('an empty column and a single card have the same slot size',()=>{
 const g=tableGeometry(1147,16,true,2);assert.equal(columnGeometry([],g).height,g.cardHeight);assert.deepEqual(columnGeometry([{up:true}],g),{tops:[0],height:g.cardHeight});
});
