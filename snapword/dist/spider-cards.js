// Original card faces: outlined ranks, vector pips and high-resolution court art.
const rankNames=['','A','2','3','4','5','6','7','8','9','10','J','Q','K'];
export const cardPath=(rank,suit)=>'./cards/'+rankNames[rank]+suit+'.svg?v=11';
export function cardArt(rank,suit){return '<img class="card-art" src="'+cardPath(rank,suit)+'" alt="" draggable="false" decoding="async" loading="lazy">';}
