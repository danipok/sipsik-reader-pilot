import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PARAGRAPHS,CHAPTERS,IMAGE_META,HANDOFFS} from './src/data.js';
const fail=m=>{throw new Error(m)};
const expectedCounts={c01:27,c02:6,c03:32};
if(PARAGRAPHS.length!==65)fail(`Expected 65 paragraphs, got ${PARAGRAPHS.length}`);
for(const [c,n] of Object.entries(expectedCounts)){const got=PARAGRAPHS.filter(p=>p.id.startsWith(c+'-')).length;if(got!==n)fail(`${c}: ${got}`)}
const ids=new Set(PARAGRAPHS.map(p=>p.id)); if(ids.size!==65)fail('Duplicate paragraph IDs');
if((PARAGRAPHS.find(p=>p.id==='c03-p031')?.text||'').split('\n').length!==8)fail('c03-p031 must preserve 8 lines');
const expected=[['chapter-c01','c01-a','c01-p001'],['c01-p015','c01-b','c01-p015'],['chapter-c02','c02-a','c02-p001'],['c02-p003','c02-b','c02-p003'],['chapter-c03','c03-a','c03-p001'],['c03-p012','c03-b','c03-p012'],['c03-p023','c03-c','c03-p023']];
if(JSON.stringify(HANDOFFS.map(h=>[h.marker,h.image,h.canonical]))!==JSON.stringify(expected))fail('Handoffs differ from locked mapping');
for(const [id,m] of Object.entries(IMAGE_META)){const p=new URL('./src/'+m.src.replace(/^\.\//,''),import.meta.url);await access(p);const buf=await readFile(p);const hash=createHash('sha256').update(buf).digest('hex');if(hash!==m.sha256)fail(`${id} asset hash mismatch`)}
if(CHAPTERS.length!==3)fail('Pilot must contain exactly 3 chapters');
const index=await readFile(new URL('./src/index.html',import.meta.url),'utf8');
const app=await readFile(new URL('./src/app.js',import.meta.url),'utf8');
if(!index.includes('Sipsik’s New Adventures'))fail('Middle door must be Sipsik’s New Adventures');
if(!index.includes('Read new stories. Create the next one.'))fail('New Adventures subtitle missing');
if(!app.includes("adventuresPosition:'sipsik.reader.position.adventures'"))fail('Adventures must have independent reading-position persistence');
for(const name of ['cover.jpg','original-05.jpg','original-06.jpg','original-07.jpg','original-08.jpg','original-09.jpg','original-10.jpg']){
  await access(new URL('./src/assets/'+name,import.meta.url)).catch(()=>fail(`Required source-faithful pilot asset missing: ${name}`));
}
console.log(JSON.stringify({paragraphs:65,chapterCounts:expectedCounts,handoffs:HANDOFFS.length,verseLines:8,digitalAssets:Object.keys(IMAGE_META).length,homeAndOriginalAssets:7,status:'PASS'},null,2));
