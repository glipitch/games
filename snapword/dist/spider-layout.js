// Illustrated faces retain their aspect ratio; compact faces prioritise readable ranks.
export const CARD_RATIO=146/198;
export function columnGeometry(cards,geometry){
 let top=0;const tops=cards.map((card,i)=>{const value=top;if(i<cards.length-1)top+=card.up?geometry.up:geometry.down;return value;});
 return {tops,height:top+geometry.cardHeight};
}

// Narrow screens use readable rank strips, with every column kept in view.
export function fitGeometry(available,gap=4){
 const boardWidth=Math.max(1,available),safeGap=Math.min(gap,boardWidth/100);
 const cardWidth=(boardWidth-safeGap*9)/10,compact=cardWidth<76;
 return {boardWidth,gap:safeGap,cardWidth,compact,cardHeight:Math.max(compact?66:0,cardWidth/CARD_RATIO),up:Math.max(24,cardWidth*.30),down:Math.max(9,cardWidth*.12)};
}
