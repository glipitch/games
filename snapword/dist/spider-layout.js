// Illustrated faces retain their aspect ratio; compact faces prioritise readable ranks.
export const CARD_RATIO=146/198;
export function columnGeometry(cards,geometry){
 let top=0;const tops=cards.map((card,i)=>{const value=top;if(i<cards.length-1)top+=card.up?geometry.up:geometry.down;return value;});
 return {tops,height:top+geometry.cardHeight};
}

// Narrow screens use readable rank strips, with every column kept in view.
export function fitGeometry(available,gap=4){
 const boardWidth=Math.max(1,available),safeGap=Math.min(gap,boardWidth/100);
 const cardWidth=(boardWidth-safeGap*9)/10,compact=cardWidth<100;
 // Keep both rank and suit visible above the next card, including a two-digit 10.
 const rankSize=Math.max(24,Math.min(cardWidth*.70,32)),suitSize=Math.max(22,Math.min(cardWidth*.66,30));
 const up=compact?Math.ceil(rankSize+suitSize+9):Math.max(32,cardWidth*.44);
 return {boardWidth,gap:safeGap,cardWidth,compact,cardHeight:compact?up+8:cardWidth/CARD_RATIO,up,down:Math.max(9,cardWidth*.12)};
}

// Desktop height fitting preserves normal cards whenever they already fit.
// Covered cards can use a horizontal index to keep long stacks understandable.
export function fitDesktopGeometry(available,gap,columns,availableHeight){
 const base=fitGeometry(available,gap),limit=Math.max(1,availableHeight);
 const height=geometry=>Math.max(...columns.map(cards=>columnGeometry(cards,geometry).height));
 const finish=geometry=>({...geometry,dense:!!geometry.dense,fitsHeight:height(geometry)<=limit+.01});
 if(height(base)<=limit)return finish(base);
 const largest=(low,high,make)=>{for(let i=0;i<40;i++){const mid=(low+high)/2;if(height(make(mid))<=limit)low=mid;else high=mid;}return make(low);};
 const down=Math.min(base.down,4),tighter={...base,down};
 if(height(tighter)<=limit)return finish(largest(down,base.down,value=>({...base,down:value})));
 const minimumScale=base.compact?1:Math.min(1,90/base.cardWidth);
 const scaled=scale=>({...base,down,cardWidth:base.cardWidth*scale,cardHeight:base.cardHeight*scale,up:base.up*scale,boardWidth:base.cardWidth*scale*10+base.gap*9});
 const smallest=scaled(minimumScale);
 if(height(smallest)<=limit)return finish(largest(minimumScale,1,scaled));
 const dense={...smallest,dense:true,up:23};
 if(height(dense)>limit)return finish(dense);
 return finish(largest(23,smallest.up,up=>({...dense,up})));
}
