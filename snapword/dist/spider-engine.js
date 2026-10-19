// Two-suit Spider. Rules are independent of the view and storage.
export const rankLabel=r=>['','A','2','3','4','5','6','7','8','9','10','J','Q','K'][r];
export const suitSymbol=s=>s==='S'?'♠':'♥';
export function newGame(seed=Date.now()){
 let n=Number(seed)>>>0;const random=()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
 const deck=[];for(let copy=0;copy<4;copy++)for(const suit of ['S','H'])for(let rank=1;rank<=13;rank++)deck.push({id:deck.length,rank,suit,up:false});
 for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
 const columns=Array.from({length:10},()=>[]);for(let i=0;i<54;i++)columns[i%10].push(deck.pop());columns.forEach(c=>c.at(-1).up=true);
 return {version:1,seed:Number(seed),columns,stock:deck,completed:[],moves:0,score:500,won:false};
}
export function movable(state,column,index){
 const cards=state.columns[column];if(!cards||!Number.isInteger(index)||index<0||index>=cards.length||!cards[index].up)return false;
 for(let i=index+1;i<cards.length;i++)if(!cards[i].up||cards[i].suit!==cards[i-1].suit||cards[i].rank!==cards[i-1].rank-1)return false;return true;
}
export function canMove(state,from,index,to){
 if(state.won||from===to||!state.columns[to]||!movable(state,from,index))return false;
 const target=state.columns[to].at(-1);return !target||(target.up&&target.rank===state.columns[from][index].rank+1);
}
function settle(state){
 let again=true;while(again){again=false;for(const col of state.columns){if(col.length)col.at(-1).up=true;if(col.length<13)continue;const start=col.length-13;
 if(col[start].rank===13&&col.at(-1).rank===1&&movable({columns:[col]},0,start)){state.completed.push(col.splice(start,13));state.score+=100;again=true;}
 }}state.won=state.completed.length===8;
}
export function move(state,from,index,to){if(!canMove(state,from,index,to))return false;state.columns[to].push(...state.columns[from].splice(index));state.moves++;state.score--;settle(state);return true;}
export function canDeal(state){return !state.won&&state.stock.length>=10&&state.columns.every(c=>c.length);}
export function deal(state){if(!canDeal(state))return false;for(const col of state.columns){const card=state.stock.pop();card.up=true;col.push(card);}state.moves++;state.score--;settle(state);return true;}
export function hint(state){
 let best=null,bestScore=-Infinity;for(let from=0;from<10;from++)for(let index=0;index<state.columns[from].length;index++)for(let to=0;to<10;to++){
 if(!canMove(state,from,index,to))continue;const source=state.columns[from],target=state.columns[to],top=target.at(-1);
 if(!top&&index===0)continue; // Moving a whole column to another empty slot changes nothing.
 const exposes=index>0&&!source[index-1].up,suited=top?.suit===source[index].suit;
 const score=(exposes?100:0)+(suited?40:0)+(index===0?15:0)+(top?10:0)+(source.length-index);
 if(score>bestScore){bestScore=score;best={from,index,to};}
 }return best;
}
export const snapshot=state=>structuredClone(state);
export function validState(s){
 if(s?.version!==1||!Array.isArray(s.columns)||s.columns.length!==10||!Array.isArray(s.stock)||s.stock.length>50||s.stock.length%10||!Array.isArray(s.completed)||s.completed.length>8||!Number.isInteger(s.moves)||s.moves<0||!Number.isFinite(s.score)||typeof s.won!=='boolean')return false;
 if(!s.columns.every(c=>Array.isArray(c)&&c.every((v,i)=>v&&typeof v.up==='boolean'&&(!i||!c[i-1].up||v.up))&&(!c.length||c.at(-1).up)))return false;
 if(!s.completed.every(c=>Array.isArray(c)&&c.length===13&&c.every((v,i)=>v.up&&v.rank===13-i&&v.suit===c[0].suit)))return false;
 const all=[...s.columns.flat(),...s.stock,...s.completed.flat()];if(all.length!==104||new Set(all.map(c=>c?.id)).size!==104)return false;
 if(!all.every(c=>Number.isInteger(c.id)&&c.id>=0&&c.id<104&&Number.isInteger(c.rank)&&c.rank>=1&&c.rank<=13&&['S','H'].includes(c.suit)&&typeof c.up==='boolean'))return false;
 if(s.stock.some(c=>c.up))return false;
 for(const suit of ['S','H'])for(let rank=1;rank<=13;rank++)if(all.filter(c=>c.rank===rank&&c.suit===suit).length!==4)return false;
 return s.won===(s.completed.length===8);
}
