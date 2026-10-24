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
 const rankSize=Math.max(18,Math.min(cardWidth*.54,26)),suitSize=Math.max(22,Math.min(cardWidth*.66,30));
 return {boardWidth,gap:safeGap,cardWidth,compact,cardHeight:compact?Math.max(60,Math.min(80,cardWidth*1.15)):cardWidth/CARD_RATIO,up:compact?Math.ceil(rankSize+suitSize+9):Math.max(32,cardWidth*.40),down:Math.max(9,cardWidth*.12)};
}
