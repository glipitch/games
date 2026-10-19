// All card dimensions and stack offsets share the source artwork's aspect ratio.
export const CARD_RATIO=146/198;
export const zoomSteps=[.75,1,1.25,1.5,1.75,2,2.5];
export function tableGeometry(available,gap,wide=false,scale=1){
 const boardWidth=(wide?Math.max(available,1200):available)*scale;
 const scaledGap=gap*scale,cardWidth=(boardWidth-scaledGap*9)/10;
 return {boardWidth,gap:scaledGap,cardWidth,cardHeight:cardWidth/CARD_RATIO,up:cardWidth*.34,down:cardWidth*.17};
}
export function columnGeometry(cards,geometry){
 let top=0;const tops=cards.map((card,i)=>{const value=top;if(i<cards.length-1)top+=card.up?geometry.up:geometry.down;return value;});
 return {tops,height:top+geometry.cardHeight};
}
