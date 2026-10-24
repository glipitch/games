// Illustrated faces retain their aspect ratio; compact faces prioritise readable ranks.
export const CARD_RATIO=146/198;
export function columnGeometry(cards,geometry){
 let top=0;const tops=cards.map((card,i)=>{const value=top;if(i<cards.length-1)top+=card.up?geometry.up:geometry.down;return value;});
 return {tops,height:top+geometry.cardHeight};
}

// Appearance is explicitly selected; resizing never changes the card style.
export function fitGeometry(available,gap=4,compact=false){
 const boardWidth=Math.max(1,available),safeGap=Math.min(gap,boardWidth/100);
 const cardWidth=(boardWidth-safeGap*9)/10;
 // Keep both rank and suit visible above the next card, including a two-digit 10.
 const rankSize=Math.max(24,Math.min(cardWidth*.70,32)),suitSize=Math.max(22,Math.min(cardWidth*.66,30));
 const up=compact?Math.ceil(rankSize+suitSize+9):Math.max(12,cardWidth*.44);
 return {boardWidth,gap:safeGap,cardWidth,compact,cardHeight:compact?up+8:cardWidth/CARD_RATIO,up,down:Math.max(9,cardWidth*.12)};
}

export function fitZoom(geometry,columns,availableHeight){
 const height=Math.max(...columns.map(cards=>columnGeometry(cards,geometry).height));
 return Math.min(1,Math.max(1,availableHeight)/height);
}

// Only the exposed height of covered cards changes; card faces keep their size.
export function tightZoom(geometry,columns,availableHeight){
 const covered=Math.max(...columns.map(cards=>Math.max(0,cards.length-1)));
 return Math.min(1,Math.max(1,availableHeight)/(geometry.cardHeight+covered));
}

export function tightColumnGeometry(cards,geometry,availableHeight){
 const natural=columnGeometry(cards,geometry);
 if(natural.height<=availableHeight)return natural;
 const covered=cards.slice(0,-1),upCount=covered.filter(card=>card.up).length,downCount=covered.length-upCount;
 const space=Math.max(covered.length,availableHeight-geometry.cardHeight);
 let {up,down}=geometry;
 if(downCount)down=Math.max(1,Math.min(down,(space-upCount*up)/downCount));
 if(upCount)up=Math.max(1,Math.min(up,(space-downCount*down)/upCount));
 return columnGeometry(cards,{...geometry,up,down});
}
