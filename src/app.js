import {PARAGRAPHS,CHAPTERS,IMAGE_META,HANDOFFS,VERIFIED_BOOK_LANGUAGES} from './data.js';

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const KEYS={theme:'sipsik.reader.theme',font:'sipsik.reader.fontScale',position:'sipsik.reader.position',globalLanguage:'sipsik.globalLanguage',bookLanguage:'sipsik.reader.bookLanguage',seenOpening:'sipsik.reader.seenOpening'};
const THEMES=['white','ivory','paper','gray'];
const SCALES=[.88,1,1.14,1.28];
const UI={
  en:{digitalReader:'Digital reader',storyNarration:'Story & narration',readingSurface:'Reading surface',pilotNote:'Only the verified Estonian story and narration text is populated in this pilot.',openBook:'Open book',settings:'Reading settings',textSize:'Text size',bookBeginning:'Book beginning / language',listen:'Listen',listening:'Listening',showText:'Show text',play:'Play',pause:'Pause',resume:'Resume',stop:'Stop',chapter:'Chapter',speechUnavailable:'Speech synthesis is not available in this browser.'},
  et:{digitalReader:'Digitaalne lugeja',storyNarration:'Lugu ja kuulamine',readingSurface:'Lugemistaust',pilotNote:'Selles piloodis on kinnitatud ainult eestikeelne lugu ja jutustus.',openBook:'Ava raamat',settings:'Lugemise seaded',textSize:'Teksti suurus',bookBeginning:'Raamatu algus / keel',listen:'Kuula',listening:'Kuulamine',showText:'Näita teksti',play:'Esita',pause:'Paus',resume:'Jätka',stop:'Peata',chapter:'Peatükk',speechUnavailable:'Selles brauseris ei ole kõnesüntees saadaval.'}
};

let storageOK=true; const memory=new Map();
function getStore(k,f=null){try{const v=localStorage.getItem(k);return v===null?(memory.has(k)?memory.get(k):f):v}catch{storageOK=false;return memory.has(k)?memory.get(k):f}}
function setStore(k,v){memory.set(k,String(v));try{localStorage.setItem(k,String(v))}catch{storageOK=false}}
function delStore(k){memory.delete(k);try{localStorage.removeItem(k)}catch{storageOK=false}}

function syncGlobalLanguage(){
  const q=new URLSearchParams(location.search).get('globalLanguage');
  const requested=(q==='et'||q==='en')?q:null;
  const old=getStore(KEYS.globalLanguage,null);
  if(requested && requested!==old){setStore(KEYS.globalLanguage,requested);delStore(KEYS.bookLanguage)}
  return requested||getStore(KEYS.globalLanguage,'en');
}
const globalLanguage=syncGlobalLanguage();
const ui=UI[globalLanguage]||UI.en;
document.documentElement.lang=globalLanguage;

function verifiedBookLanguage(code){return VERIFIED_BOOK_LANGUAGES.some(l=>l.code===code)}
let bookLanguage=getStore(KEYS.bookLanguage,null);
if(!verifiedBookLanguage(bookLanguage)) bookLanguage=verifiedBookLanguage(globalLanguage)?globalLanguage:'et';
setStore(KEYS.bookLanguage,bookLanguage);

const opening=$('#opening'),reader=$('#reader'),story=$('#story'),scroller=$('#storyScroller'),currentArt=$('#currentArt'),artStage=$('#artStage'),positionLabel=$('#positionLabel'),settingsDialog=$('#settingsDialog'),sizeValue=$('#sizeValue'),listenStage=$('#listenStage'),listenArt=$('#listenArt'),listenChapter=$('#listenChapter'),listenId=$('#listenId'),listenCount=$('#listenCount'),audioToggle=$('#audioToggle'),toast=$('#toast'),bookLanguageSelect=$('#bookLanguage');

let theme=THEMES.includes(getStore(KEYS.theme,'ivory'))?getStore(KEYS.theme,'ivory'):'ivory';
let fontScale=Number(getStore(KEYS.font,'1')); if(!SCALES.includes(fontScale))fontScale=1;
let currentCanonical=getStore(KEYS.position,'c01-p001'); if(!PARAGRAPHS.some(p=>p.id===currentCanonical))currentCanonical='c01-p001';
let currentImage=null,artRequest=0,narrationIndex=Math.max(0,PARAGRAPHS.findIndex(p=>p.id===currentCanonical)),speaking=false,paused=false,utterance=null,lastScrollSave=0,userHasScrolled=false;

function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function localizeUI(){
  $('#openingTitle').textContent=ui.digitalReader; $('#storyLabel').textContent=ui.storyNarration; $('#surfaceLabel').textContent=ui.readingSurface; $('#pilotNote').textContent=ui.pilotNote; $('#openBook').textContent=ui.openBook;
  $('#settingsTitle').textContent=ui.settings; $('#textSizeTitle').textContent=ui.textSize; $('#settingsSurfaceTitle').textContent=ui.readingSurface; $('#bookBeginning').textContent=ui.bookBeginning;
  $('#listenButton').textContent=ui.listen; $('#listenKicker').textContent=ui.listening; $('#showText').textContent=ui.showText; $('#audioStop').textContent=ui.stop;
}
localizeUI();

function applyTheme(n){
  theme=THEMES.includes(n)?n:'ivory'; document.body.classList.remove(...THEMES.map(t=>`theme-${t}`)); document.body.classList.add(`theme-${theme}`); setStore(KEYS.theme,theme);
  $$('[data-theme]').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.theme===theme)));
  const surface=getComputedStyle(document.body).getPropertyValue('--surface').trim()||'#fbfaf5'; $('meta[name="theme-color"]').setAttribute('content',surface);
}
function applyFontScale(n){
  fontScale=SCALES.includes(n)?n:1; document.documentElement.style.setProperty('--font-scale',String(fontScale)); setStore(KEYS.font,String(fontScale)); sizeValue.textContent=`${Math.round(fontScale*100)}%`;
  if(!reader.hidden) requestAnimationFrame(()=>restoreCanonical(currentCanonical,{smooth:false,save:false}));
}
applyTheme(theme); applyFontScale(fontScale);

function renderLanguageChoice(){
  bookLanguageSelect.innerHTML=VERIFIED_BOOK_LANGUAGES.map(l=>`<option value="${escapeHtml(l.code)}">${escapeHtml(l.label)}</option>`).join('');
  bookLanguageSelect.value=bookLanguage;
}
renderLanguageChoice();

function renderStory(){
  story.innerHTML='';
  for(const c of CHAPTERS){
    const h=document.createElement('section'); h.className='chapter-heading'; h.id=`chapter-${c.id}`; h.dataset.image=c.image; h.dataset.canonical=c.first;
    h.innerHTML=`<p class="chapter-number">${escapeHtml(ui.chapter)} ${Number(c.id.slice(1))}</p><h2>${escapeHtml(c.title)}</h2>`; story.appendChild(h);
    for(const p of PARAGRAPHS.filter(p=>p.id.startsWith(c.id+'-'))){
      const e=document.createElement('p'); e.id=p.id; e.lang='et'; e.className='story-paragraph'+(p.id==='c03-p031'?' verse':''); e.dataset.canonical=p.id; e.textContent=p.text; story.appendChild(e);
    }
  }
}
renderStory();

const IMAGE_BY_PARAGRAPH=new Map(PARAGRAPHS.map(p=>[p.id,
  p.id.startsWith('c01-')?(Number(p.id.slice(-3))<15?'c01-a':'c01-b'):
  p.id.startsWith('c02-')?(Number(p.id.slice(-3))<3?'c02-a':'c02-b'):
  p.id.startsWith('c03-')?(Number(p.id.slice(-3))<12?'c03-a':Number(p.id.slice(-3))<23?'c03-b':'c03-c'):'c01-a'
]));
function imageForCanonical(id){return IMAGE_BY_PARAGRAPH.get(id)||'c01-a'}
function chapterNumberForCanonical(id){return Number(id.slice(1,3))||1}

for(const m of Object.values(IMAGE_META)){const img=new Image();img.decoding='async';img.src=m.src}

function setArt(imageId,{listen=false}={}){
  const m=IMAGE_META[imageId]||IMAGE_META['c01-a']; const t=listen?listenArt:currentArt;
  if(t.dataset.image===imageId)return;
  const request=++artRequest; if(!listen)t.classList.add('is-changing');
  const p=new Image(); p.decoding='async'; p.onload=()=>{if(request!==artRequest&&!listen)return;t.src=m.src;t.alt=m.alt;t.dataset.image=imageId;if(!listen){currentImage=imageId;artStage.dataset.image=imageId;requestAnimationFrame(()=>t.classList.remove('is-changing'))}}; p.src=m.src;
}
function markerOffsets(){return HANDOFFS.map(h=>({...h,el:document.getElementById(h.marker)})).filter(x=>x.el).map(x=>({...x,top:x.el.offsetTop}))}
function activeHandoff(){const y=scroller.scrollTop+3,ms=markerOffsets();let a=ms[0];for(const m of ms){if(m.top<=y+1)a=m;else break}return a}
function firstVisibleParagraph(){const y=scroller.scrollTop+8,els=$$('.story-paragraph');let c=els[0];for(const e of els){if(e.offsetTop<=y)c=e;else break}return c?.id||'c01-p001'}
function canonicalIndex(id){return PARAGRAPHS.findIndex(p=>p.id===id)}
function syncFromScroll(){
  const h=activeHandoff(); if(h)setArt(h.image);
  let id=firstVisibleParagraph();
  if(h && h.marker.startsWith('chapter-') && canonicalIndex(h.canonical)>canonicalIndex(id)) id=h.canonical;
  currentCanonical=id; positionLabel.textContent=`${ui.chapter} ${chapterNumberForCanonical(id)} · ${id}`;
  const n=performance.now(); if(userHasScrolled&&n-lastScrollSave>120){setStore(KEYS.position,id);lastScrollSave=n}
}
scroller.addEventListener('scroll',()=>{userHasScrolled=true;syncFromScroll()},{passive:true});

function restoreCanonical(id,{smooth=false,save=true}={}){
  const e=document.getElementById(id); if(!e)return;
  setArt(imageForCanonical(id)); scroller.scrollTo({top:Math.max(0,e.offsetTop-2),behavior:smooth?'smooth':'auto'}); currentCanonical=id; narrationIndex=Math.max(0,canonicalIndex(id)); positionLabel.textContent=`${ui.chapter} ${chapterNumberForCanonical(id)} · ${id}`; if(save)setStore(KEYS.position,id);
}
function showReader({restore=true}={}){
  opening.hidden=true; listenStage.hidden=true; reader.hidden=false; setStore(KEYS.seenOpening,'1');
  requestAnimationFrame(()=>{
    if(restore){restoreCanonical(currentCanonical,{smooth:false,save:true})}
    else{setArt('c01-a');scroller.scrollTo({top:0,behavior:'auto'});currentCanonical='c01-p001';narrationIndex=0;positionLabel.textContent=`${ui.chapter} 1 · c01-p001`;setStore(KEYS.position,currentCanonical)}
  });
}
function showOpening(){cancelNarration(); listenStage.hidden=true; reader.hidden=true; opening.hidden=false; opening.scrollTop=0; requestAnimationFrame(()=>bookLanguageSelect.focus({preventScroll:true}))}

$('#openBook').addEventListener('click',()=>{const seen=getStore(KEYS.seenOpening,'0')==='1';showReader({restore:seen})});
bookLanguageSelect.addEventListener('change',()=>{if(verifiedBookLanguage(bookLanguageSelect.value)){bookLanguage=bookLanguageSelect.value;setStore(KEYS.bookLanguage,bookLanguage)}});
$('#bookBeginning').addEventListener('click',()=>{settingsDialog.close();showOpening()});
$$('[data-theme]').forEach(b=>b.addEventListener('click',()=>applyTheme(b.dataset.theme)));
$('#settingsButton').addEventListener('click',()=>settingsDialog.showModal());
$('#smallerText').addEventListener('click',()=>{const i=SCALES.indexOf(fontScale);applyFontScale(SCALES[Math.max(0,i-1)])});
$('#largerText').addEventListener('click',()=>{const i=SCALES.indexOf(fontScale);applyFontScale(SCALES[Math.min(SCALES.length-1,i+1)])});

function flash(m){toast.textContent=m;toast.hidden=false;clearTimeout(flash._t);flash._t=setTimeout(()=>toast.hidden=true,2600)}
function speechSupported(){return 'speechSynthesis'in window&&'SpeechSynthesisUtterance'in window}
function voiceFor(lang){const v=speechSynthesis.getVoices();return v.find(x=>x.lang?.toLowerCase()===lang.toLowerCase())||v.find(x=>x.lang?.toLowerCase().startsWith(lang.slice(0,2).toLowerCase()))||null}
function updateListenState(){
  const p=PARAGRAPHS[narrationIndex]||PARAGRAPHS[0]; currentCanonical=p.id; setArt(imageForCanonical(p.id),{listen:true}); listenChapter.textContent=p.chapter; listenId.textContent=p.id; listenCount.textContent=`${narrationIndex+1} / ${PARAGRAPHS.length}`; audioToggle.textContent=speaking?(paused?ui.resume:ui.pause):ui.play; audioToggle.setAttribute('aria-label',audioToggle.textContent); $$('.story-paragraph.audio-current').forEach(e=>e.classList.remove('audio-current')); document.getElementById(p.id)?.classList.add('audio-current'); setStore(KEYS.position,p.id);
}
function openListening(){narrationIndex=Math.max(0,canonicalIndex(currentCanonical));reader.hidden=true;opening.hidden=true;listenStage.hidden=false;updateListenState()}
function speakCurrent(){
  if(!speechSupported()){flash(ui.speechUnavailable);return}
  speechSynthesis.cancel(); const p=PARAGRAPHS[narrationIndex],u=new SpeechSynthesisUtterance(p.text.replace(/\n/g,' ')),lang=VERIFIED_BOOK_LANGUAGES.find(x=>x.code===bookLanguage)?.speech||'et-EE'; u.lang=lang; const v=voiceFor(lang); if(v)u.voice=v; u.rate=.94;
  u.onstart=()=>{speaking=true;paused=false;utterance=u;updateListenState()};
  u.onend=()=>{if(utterance!==u)return;speaking=false;paused=false;if(narrationIndex<PARAGRAPHS.length-1){narrationIndex++;updateListenState();speakCurrent()}else{utterance=null;updateListenState()}};
  u.onerror=e=>{if(e.error==='canceled'||e.error==='interrupted')return;speaking=false;paused=false;utterance=null;updateListenState()}; speechSynthesis.speak(u);
}
function toggleNarration(){if(!speechSupported()){flash(ui.speechUnavailable);return}if(speaking&&!paused){speechSynthesis.pause();paused=true;updateListenState();return}if(speaking&&paused){speechSynthesis.resume();paused=false;updateListenState();return}speakCurrent()}
function cancelNarration(){if(speechSupported())speechSynthesis.cancel();speaking=false;paused=false;utterance=null;if(!listenStage.hidden)updateListenState()}
function jumpNarration(d){cancelNarration();narrationIndex=Math.max(0,Math.min(PARAGRAPHS.length-1,narrationIndex+d));updateListenState()}
$('#listenButton').addEventListener('click',openListening); $('#audioToggle').addEventListener('click',toggleNarration); $('#audioPrev').addEventListener('click',()=>jumpNarration(-1)); $('#audioNext').addEventListener('click',()=>jumpNarration(1)); $('#audioStop').addEventListener('click',cancelNarration); $('#showText').addEventListener('click',()=>{cancelNarration();listenStage.hidden=true;reader.hidden=false;requestAnimationFrame(()=>restoreCanonical(currentCanonical,{smooth:false,save:true}))});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!listenStage.hidden)$('#showText').click()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&speaking&&!paused&&speechSupported()){speechSynthesis.pause();paused=true;updateListenState()}});

setArt('c01-a'); syncFromScroll();
window.__SIPSIK_TEST__={
  paragraphs:PARAGRAPHS.length,
  chapterCounts:Object.fromEntries(CHAPTERS.map(c=>[c.id,PARAGRAPHS.filter(p=>p.id.startsWith(c.id+'-')).length])),
  handoffs:HANDOFFS.map(h=>({...h})), verseLines:PARAGRAPHS.find(p=>p.id==='c03-p031').text.split('\n').length,
  assets:Object.fromEntries(Object.entries(IMAGE_META).map(([k,v])=>[k,{src:v.src,sha256:v.sha256,source:v.source}])),
  getState:()=>({theme,fontScale,currentCanonical,currentImage,bookLanguage,globalLanguage,storageOK,view:!listenStage.hidden?'listen':!reader.hidden?'reader':'opening'}),
  goTo:id=>{showReader({restore:false});requestAnimationFrame(()=>restoreCanonical(id,{smooth:false,save:true}))},
  theme:n=>applyTheme(n),font:s=>applyFontScale(s),openListen:()=>openListening(),showText:()=>$('#showText').click(),showOpening
};
