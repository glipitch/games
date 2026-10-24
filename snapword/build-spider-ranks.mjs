import {readFile,writeFile} from 'node:fs/promises';
const outlines=JSON.parse(await readFile(new URL('./asset-sources/rank-outlines.json',import.meta.url)));
const source=`// Generated from the bundled OFL DM Sans, weight 800. See build-spider-ranks.py.
const paths=${JSON.stringify(['',...['A','2','3','4','5','6','7','8','9','10','J','Q','K'].map(rank=>outlines[rank])])};
export function rankArt(rank){return '<svg class="card-rank" viewBox="0 0 32 36" aria-hidden="true" focusable="false"><path fill="currentColor" d="'+paths[rank]+'"/></svg>';}
`;
await writeFile(new URL('./dist/spider-ranks.js',import.meta.url),source);
console.log('Built shared vector card ranks.');
