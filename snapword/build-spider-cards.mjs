// Build original scalable card faces. Portraits are high resolution generated art;
// card geometry, indices, pips and exact 180-degree symmetry are deterministic.
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require(process.env.SHARP_PATH || 'sharp');
const glyphs=JSON.parse(await fs.readFile(new URL('./asset-sources/ranks.json',import.meta.url)));
const ranks=['','A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const ns='xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"';
const spade='M0-15C-3-10-12-5-12 2C-12 10-5 11-2 6C-2 10-4 13-6 15H6C4 13 2 10 2 6C5 11 12 10 12 2C12-5 3-10 0-15Z';
const heart='M0 14C-3 10-12 4-12-4C-12-12-4-15 0-7C4-15 12-12 12-4C12 4 3 10 0 14Z';
const pip=(x,y,size=24,invert=false)=>`<use xlink:href="#pip" transform="translate(${x} ${y}) rotate(${invert?180:0}) scale(${size/24})"/>`;
function index(rank){
 let advance=0,parts='';const scale=37/2048;
 for(const char of ranks[rank]){const g=glyphs[char];parts+=`<path d="${g.path}" transform="translate(${advance} 0)"/>`;advance+=g.width;}
 // '10' has the same margin as every other rank, with a slightly condensed index.
 const sx=rank===10?.75:1;
 return `<g id="index"><g fill="currentColor" transform="translate(3.5 27) scale(${scale*sx} ${-scale})">${parts}</g>${pip(rank===10?14:13,40,21)}</g>`;
}
function numbered(rank){
 if(rank===1)return pip(73,99,43);
 const p=[];const pair=(y)=>{p.push([43,y],[103,y]);};
 if(rank===2)p.push([73,37],[73,161]);
 if(rank===3)p.push([73,37],[73,99],[73,161]);
 if(rank>=4){pair(37);pair(161);}
 if(rank===5)p.push([73,99]);
 if(rank===6||rank===7||rank===8)pair(99);
 if(rank===7||rank===8)p.push([73,68]);
 if(rank===8)p.push([73,130]);
 if(rank===9||rank===10){pair(78.33);pair(119.67);}
 if(rank===9)p.push([73,99]);
 if(rank===10)p.push([73,57.67],[73,140.33]);
 return p.map(([x,y])=>pip(x,y,24,y>99)).join('');
}
for(const suit of ['S','H'])for(let rank=1;rank<=13;rank++){
 const red=suit==='H',color=red?'#ce102f':'#060b0e';
 let art='',portraitDef='';
 if(rank<=10)art=numbered(rank);
 else{
  const bytes=await sharp(await fs.readFile(new URL(`./asset-sources/courts/${ranks[rank]}${suit}.png`,import.meta.url))).webp({quality:94,effort:6}).toBuffer();
  portraitDef=`<image id="portrait" width="112" height="112" x="17" y="3" xlink:href="data:image/webp;base64,${bytes.toString('base64')}"/><clipPath id="half"><path d="M17 3H129V111L17 87Z"/></clipPath>`;
  art='<rect x="22" y="22" width="102" height="154" rx="7" fill="#fff" stroke="#b7b7b7" stroke-width=".7"/><g clip-path="url(#half)"><use xlink:href="#portrait"/></g><g transform="rotate(180 73 99)"><g clip-path="url(#half)"><use xlink:href="#portrait"/></g></g>';
 }
 const svg=`<svg ${ns} viewBox="0 0 146 198" color="${color}"><defs><linearGradient id="ink" x1="0" y1="0" x2="1" y2=".8" gradientUnits="objectBoundingBox"><stop stop-color="${red?'#ff6379':'#4a626c'}"/><stop offset=".43" stop-color="${red?'#e51b3e':'#0b1c24'}"/><stop offset="1" stop-color="${red?'#bc0026':'#03090d'}"/></linearGradient><path id="pip" d="${red?heart:spade}" fill="url(#ink)"/><clipPath id="card"><rect x=".65" y=".65" width="144.7" height="196.7" rx="7"/></clipPath>${portraitDef}${index(rank)}</defs><rect x=".65" y=".65" width="144.7" height="196.7" rx="7" fill="#fff" stroke="#b8b8b8" stroke-width="1.3"/><g clip-path="url(#card)">${art}${rank<=10?'<path d="M0 160Q55 103 146 94V198H0Z" fill="#dce2e6" opacity=".18"/>':''}<use xlink:href="#index"/><use xlink:href="#index" transform="rotate(180 73 99)"/></g></svg>`;
 await fs.writeFile(new URL(`./dist/cards/${ranks[rank]}${suit}.svg`,import.meta.url),svg);
}
// The back shares the exact same outer frame and proportions as every face.
await fs.writeFile(new URL('./dist/cards/back.svg',import.meta.url),`<svg ${ns} viewBox="0 0 146 198"><defs><clipPath id="back"><rect x="4.5" y="4.5" width="137" height="189" rx="4"/></clipPath><linearGradient id="red" x2=".9" y2="1"><stop stop-color="#ff3030"/><stop offset="1" stop-color="#d91120"/></linearGradient></defs><rect x=".65" y=".65" width="144.7" height="196.7" rx="7" fill="#fff" stroke="#b8b8b8" stroke-width="1.3"/><g clip-path="url(#back)"><path fill="url(#red)" d="M0 0h146v198H0z"/><g fill="none" stroke="#ffe4e4" stroke-width="1.35" opacity=".85"><path d="M-80-70L200 245M-80-70L48 250M-80-70L210 60M-80-70L200 137M-80-70L-15 260M-80-70L210-5"/><path d="M-12 0Q38 18 84-11M-8 42Q52 67 137 12M-10 95Q70 110 168 51M-7 155Q93 167 171 99M25 208Q99 200 172 154M28-10Q12 58-18 70M78-10Q54 71 26 135M135-10Q104 90 86 207M171 35Q132 119 139 210"/></g></g></svg>`);
console.log('Built 26 original card faces and matching back.');
