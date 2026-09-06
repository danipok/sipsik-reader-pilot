import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PARAGRAPHS,CHAPTERS,IMAGE_META,HANDOFFS} from './src/data.js';
const fail=m=>{throw new Error(m)};
const sha256=b=>createHash('sha256').update(b).digest('hex');
const expectedCounts={c01:27,c02:6,c03:32};
if(PARAGRAPHS.length!==65)fail(`Expected 65 paragraphs, got ${PARAGRAPHS.length}`);
for(const [c,n] of Object.entries(expectedCounts)){const got=PARAGRAPHS.filter(p=>p.id.startsWith(c+'-')).length;if(got!==n)fail(`${c}: ${got}`)}
const ids=new Set(PARAGRAPHS.map(p=>p.id)); if(ids.size!==65)fail('Duplicate paragraph IDs');
if((PARAGRAPHS.find(p=>p.id==='c03-p031')?.text||'').split('\n').length!==8)fail('c03-p031 must preserve 8 lines');
const expected=[['chapter-c01','c01-a','c01-p001'],['c01-p015','c01-b','c01-p015'],['chapter-c02','c02-a','c02-p001'],['c02-p003','c02-b','c02-p003'],['chapter-c03','c03-a','c03-p001'],['c03-p012','c03-b','c03-p012'],['c03-p023','c03-c','c03-p023']];
if(JSON.stringify(HANDOFFS.map(h=>[h.marker,h.image,h.canonical]))!==JSON.stringify(expected))fail('Handoffs differ from locked mapping');
for(const [id,m] of Object.entries(IMAGE_META)){const p=new URL('./src/'+m.src.replace(/^\.\//,''),import.meta.url);await access(p);const buf=await readFile(p);const hash=sha256(buf);if(hash!==m.sha256)fail(`${id} asset hash mismatch`)}
if(CHAPTERS.length!==3)fail('Pilot must contain exactly 3 chapters');
const index=await readFile(new URL('./src/index.html',import.meta.url),'utf8');
const app=await readFile(new URL('./src/app.js',import.meta.url),'utf8');
const chrome=await readFile(new URL('./src/reader-chrome.js',import.meta.url),'utf8');
if(!index.includes('Sipsik’s New Adventures'))fail('Middle door must be Sipsik’s New Adventures');
if(!index.includes('Read new stories. Create the next one.'))fail('New Adventures subtitle missing');
if(!index.includes('id="digitalDoorCopy">The original stories<'))fail('Front-page Sipsik subtitle differs from locked copy');
if(!index.includes('id="originalDoorCopy">The original physical book<'))fail('Front-page Original subtitle differs from locked copy');
if(/originalCopy:'[^']*(?:Chapters|peatükid) 1[–-]3'/.test(app))fail('Localized front-page Original box must not show chapter count');
if(!app.includes("adventuresPosition:'sipsik.reader.position.adventures'"))fail('Adventures must have independent reading-position persistence');
if(!index.includes('id="readerQuickMenu"'))fail('Reader quick menu missing');
if(!index.includes('id="quickTextButton"')||!index.includes('id="quickVoiceButton"')||!index.includes('id="quickBackgroundButton"'))fail('Aa / Voice / Background quick controls missing');
if(!chrome.includes('sipsik.reader.chromeIntroduced'))fail('First-time-only reader chrome discovery persistence missing');

const sourceAssets={
  'cover.png':'00be6356858b0568892d046e3d50baef87e4498548eedbedf512e426d53eaf57',
  'original-05.jpg':'13fb9a50809b5810dcc10e248d155f5a1496c1a88df4bce194940ced5cb2afc9',
  'original-06.jpg':'8d5410b9ec7f574b7e2e4643c72ae7f62ea7c22f1c2dca2ef3d51047b995ff2c',
  'original-07.jpg':'45884196609f7747d436bdafd804a88f24b4eb481d0dac453d350d87bae1dfa9',
  'original-08.jpg':'6a2e577dec4729c666fbebefd723fec70027a8a63a523ea84acfe269350a1575',
  'original-09.jpg':'3cf42b15e617e77258f46d8b15561f2eca1604efd789ad64767625f4d815658d',
  'original-10.jpg':'cd2bf940a9f4a0dc9a922cc279ab73aa562aec7d4ef5e5c3610e087bc316c992'
};
for(const [name,expectedHash] of Object.entries(sourceAssets)){
  const p=new URL('./src/assets/'+name,import.meta.url);
  await access(p).catch(()=>fail(`Required source-faithful pilot asset missing: ${name}`));
  const got=sha256(await readFile(p));
  if(got!==expectedHash)fail(`Source-integrity hash mismatch: ${name}`);
}
console.log(JSON.stringify({paragraphs:65,chapterCounts:expectedCounts,handoffs:HANDOFFS.length,verseLines:8,digitalAssets:Object.keys(IMAGE_META).length,homeAndOriginalAssets:Object.keys(sourceAssets).length,status:'PASS'},null,2));
