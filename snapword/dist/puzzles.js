// Each answer completes the left phrase and starts the right phrase.
export const deck = [
 ['BIRTHDAY','WALK','CAKE','A sweet celebration'],
 ['RAIN','TIE','BOW','A colourful curve'],
 ['SUN','HOUSE','LIGHT','A little illumination'],
 ['SNOW','ROOM','BALL','Something you can throw'],
 ['FOOT','GAME','BALL','A round plaything'],
 ['TOOTH','FIRE','BRUSH','Mind the bristles'],
 ['BLACK','HOUSE','BIRD','A feathered friend'],
 ['MOON','HOUSE','LIGHT','The opposite of darkness'],
 ['STAR','BOWL','FISH','A swimmer with fins'],
 ['LIP','FIGURE','STICK','A small piece of wood'],
 ['LAP','HAT','TOP','The highest part'],
 ['PAN','WALK','CAKE','A breakfast favourite'],
 ['TEA','CAKE','CUP','Something to drink from'],
 ['FIRE','MELON','WATER','Go with the flow'],
 ['BACK','DRY','BONE','Part of a skeleton'],
 ['HONEY','HIVE','BEE','A busy pollinator'],
 ['BRAIN','CLOUD','STORM','Wild weather'],
 ['DAY','LAND','DREAM','Let your mind wander'],
 ['HAND','DOWN','SHAKE','A way to say hello'],
 ['KEY','WALK','BOARD','A flat piece of wood'],
 ['JELLY','BOWL','FISH','At home in the water'],
 ['SAUCE','CAKE','PAN','A kitchen essential'],
 ['BUTTER','PAPER','FLY','Take to the air'],
 ['DRAGON','PAPER','FLY','An airborne insect'],
 ['NEWS','BACK','PAPER','A blank page'],
 ['DOOR','LADDER','STEP','One foot forward'],
 ['SAND','WALL','CASTLE','A home fit for a king'],
 ['POP','FIELD','CORN','A golden crop'],
 ['ICE','CHEESE','CREAM','Rich and dairy delicious'],
 ['TOUCH','TOWN','DOWN','The opposite of up'],
 ['OVER','BAND','HEAD','Use your noggin'],
 ['UNDER','FALL','WATER','Something to drink'],
 ['CROSS','TIE','BOW','An archer needs one'],
 ['HAIR','BALL','PIN','A tiny metal fastener'],
 ['ROSE','VASE','BUD','A flower in waiting'],
 ['SPACE','WRECK','SHIP','All aboard'],
 ['LIFE','HOUSE','BOAT','A floating vessel'],
 ['COW','FRIEND','BOY','A young lad'],
 ['GIRL','SHIP','FRIEND','Someone in your corner'],
 ['BREAD','BALL','BASKET','A woven container'],
 ['FINGER','POLISH','NAIL','A tiny pointed fastener'],
 ['BED','TABLE','TIME','It keeps on ticking'],
 ['WEEK','GAME','END','The finishing point'],
 ['SCHOOL','SALE','YARD','An outdoor space'],
 ['HEART','FAST','BREAK','Take a little pause'],
 ['DUST','HANDLE','PAN','A shallow container'],
 ['FIRE','SHOP','WORK','Something to get done'],
 ['SWEET','PASTE','TOOTH','A reason to smile'],
 ['PINE','SAUCE','APPLE','A fruit a day'],
 ['SUN','POT','FLOWER','A beautiful bloom'],
 ['WALL','BED','FLOWER','Petals and a stem'],
 ['CHOP','FIGURE','STICK','A small twig'],
 ['IN','KICK','SIDE','An edge or surface'],
 ['WIND','STONE','MILL','It grinds grain'],
 ['SUIT','STUDY','CASE','A container for things'],
 ['PILLOW','STUDY','CASE','A protective covering'],
 ['NOTE','SHELF','BOOK','Pages of possibilities'],
 ['SCORE','WALK','BOARD','A flat surface'],
 ['SKATE','WALK','BOARD','Try to stay on it'],
 ['LIFE','DOG','GUARD','Someone keeping watch'],
 ['SAFE','RAIL','GUARD','A protective presence'],
 ['HIGH','SIDE','WAY','A route to somewhere'],
 ['RAIL','SIDE','WAY','A path or route'],
 ['FREE','SIDE','WAY','A direction to go'],
 ['HOME','SHOP','WORK','Time to get busy'],
 ['FRAME','SHOP','WORK','Effort in action'],
 ['TEAM','SHOP','WORK','Effort toward a goal'],
 ['RAIN','OUT','DROP','Just a little splash'],
 ['GUM','KICK','DROP','A tiny amount'],
 ['DEW','OUT','DROP','A little bead of water'],
 ['CANDY','SUGAR','CANE','A walking aid'],
 ['SUGAR','SUGAR','CANE','A tall, sweet plant'],
 ['HOT','HOUSE','DOG','A four-legged friend'],
 ['WATCH','HOUSE','DOG','A furry lookout'],
 ['BULL','HOUSE','DOG','A faithful pet'],
 ['CAMP','FLY','FIRE','Keep the flames going'],
 ['WILD','FLY','FIRE','A flickering flame'],
 ['BUSH','FLY','FIRE','A source of heat'],
 ['BLUE','BUSH','BERRY','A little fruit'],
 ['DEEP','SIDE','SEA','A salty expanse'],
 ['HEART','BOX','BEAT','Feel the rhythm'],
 ['TOOTH','BOARD','PASTE','A sticky mixture'],
 ['HEAD','STAND','BAND','A group of musicians'],
 ['UP','OFF','LIFT','A little elevation'],
 ['DOWN','HALL','TOWN','A place on the map'],
 ['DAY','BULB','LIGHT','Brighten things up'],
 ['MID','FALL','NIGHT','After the sun goes down'],
 ['SUN','BACK','SET','Ready, steady...'],
 ['POST','BOARD','CARD','Send one in the mail'],
 ['DOOR','TIME','BELL','It rings out'],
 ['BUTTER','TAPE','SCOTCH','A spirit from Scotland'],
 ['EAR','TONE','RING','A little circle'],
 ['FIRE','OUT','BREAK','A short pause'],
 ['HAND','CHAIR','WHEEL','It goes round'],
 ['ABOUT','LIFT','FACE','Look in the mirror'],
 ['SOME','LINE','TIME','Watch the clock'],
 ['EVERY','DREAM','DAY','From dawn to dusk'],
 ['PAINT','STROKE','BRUSH','An artist uses one'],
 ['HOUR','HOUSE','GLASS','See right through it'],
 ['GREEN','BOAT','HOUSE','A place to call home'],
];
export function random(seed) {
 let a = seed >>> 0;
 return () => { a += 0x6D2B79F5; let t = Math.imul(a ^ a >>> 15, 1 | a); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function shuffle(items, rng) {
 const copy = [...items];
 for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
 return copy;
}
export function dailyKey(date = new Date()) {
 return new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function dayNumber(key) { return Math.floor((Date.parse(key+'T12:00:00Z') - Date.parse('2026-10-15T12:00:00Z')) / 86400000); }
export function makeRound(puzzle, rng) {
 const [left,right,answer,hint] = puzzle;
 let letters = answer.split('');
 const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
 while (letters.length < Math.max(9,answer.length+3)) letters.push(alphabet[Math.floor(rng()*26)]);
 return {left,right,answer,hint,letters:shuffle(letters,rng),picked:[],tries:0,hinted:false,status:'playing'};
}
export function makeGame(mode, key, seed = Date.now()) {
 const n = dayNumber(key);
 const rng = random(mode === 'daily' ? 65471 + n : seed);
 const ordered = shuffle(deck,random(3719));
 const selected = mode === 'daily' ? Array.from({length:5},(_,i)=>ordered[((n*5+i)%deck.length+deck.length)%deck.length]) : shuffle(deck,rng).slice(0,5);
 return {mode,key,index:0,rounds:selected.map(p=>makeRound(p,rng)),started:null,elapsed:0,finished:false,recorded:false};
}
