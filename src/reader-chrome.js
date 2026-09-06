const chromeStyles=document.createElement('link');
chromeStyles.rel='stylesheet';chromeStyles.href='./reader-chrome.css';document.head.appendChild(chromeStyles);

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

const reader=$('#reader');
const backZone=$('#readerBackHotspot');
const moreZone=$('#readerMoreHotspot');
const backButton=$('#readerBackButton');
const moreButton=$('#readerMoreButton');
const menu=$('#readerQuickMenu');
const textSubmenu=$('#readerTextSubmenu');
const backgroundSubmenu=$('#readerBackgroundSubmenu');
const textValue=$('#quickTextValue');
const scroller=$('#storyScroller');
const SCALES=[.88,1,1.14,1.28];
let hideTimer=null;

function api(){return window.__SIPSIK_TEST__||null}
function state(){return api()?.getState?.()||{fontScale:1,theme:'ivory'}}
function clearHide(){if(hideTimer){clearTimeout(hideTimer);hideTimer=null}}
function visibleMenu(){return !menu.hidden||!textSubmenu.hidden||!backgroundSubmenu.hidden}
function reveal(zone,duration=2400){
  clearHide(); zone.classList.add('is-visible');
  if(!visibleMenu()) hideTimer=setTimeout(()=>zone.classList.remove('is-visible'),duration);
}
function revealBoth(duration=1800){
  clearHide(); backZone.classList.add('is-visible'); moreZone.classList.add('is-visible');
  hideTimer=setTimeout(()=>{if(!visibleMenu()){backZone.classList.remove('is-visible');moreZone.classList.remove('is-visible')}},duration);
}
function conceal(){
  clearHide();
  if(visibleMenu())return;
  backZone.classList.remove('is-visible'); moreZone.classList.remove('is-visible');
}
function closeSubmenus(){textSubmenu.hidden=true;backgroundSubmenu.hidden=true;$('#quickTextButton').setAttribute('aria-pressed','false');$('#quickBackgroundButton').setAttribute('aria-pressed','false')}
function closeMenu(){menu.hidden=true;closeSubmenus();moreButton.setAttribute('aria-expanded','false');conceal()}
function openMenu(){clearHide();backZone.classList.add('is-visible');moreZone.classList.add('is-visible');menu.hidden=false;moreButton.setAttribute('aria-expanded','true')}
function updateTextValue(){const s=state().fontScale||1;textValue.textContent=`${Math.round(s*100)}%`}
function updateThemeDots(){const current=state().theme||'ivory';$$('[data-quick-theme]').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.quickTheme===current)))}

for(const zone of [backZone,moreZone]){
  zone.addEventListener('pointerenter',()=>reveal(zone),{passive:true});
  zone.addEventListener('focusin',()=>reveal(zone));
  zone.addEventListener('pointerdown',e=>{
    if(!zone.classList.contains('is-visible')){
      reveal(zone,3200);
      if(e.target===zone)e.preventDefault();
    }
  });
}

backButton.addEventListener('click',()=>{
  closeMenu();
  const a=api();
  if(a?.showOpening)a.showOpening();
  else $('#readerHome')?.click();
});

moreButton.addEventListener('click',()=>{
  if(menu.hidden)openMenu();else closeMenu();
});

$('#quickTextButton').addEventListener('click',()=>{
  const open=textSubmenu.hidden;
  closeSubmenus();
  textSubmenu.hidden=!open;
  $('#quickTextButton').setAttribute('aria-pressed',String(open));
  if(open){updateTextValue();openMenu()}
});

$('#quickBackgroundButton').addEventListener('click',()=>{
  const open=backgroundSubmenu.hidden;
  closeSubmenus();
  backgroundSubmenu.hidden=!open;
  $('#quickBackgroundButton').setAttribute('aria-pressed',String(open));
  if(open){updateThemeDots();openMenu()}
});

$('#quickVoiceButton').addEventListener('click',()=>{
  closeMenu();
  api()?.openListen?.();
});

$('#quickTextSmaller').addEventListener('click',()=>{
  const current=state().fontScale||1;const i=Math.max(0,SCALES.indexOf(current));
  api()?.font?.(SCALES[Math.max(0,i-1)]);updateTextValue();
});
$('#quickTextLarger').addEventListener('click',()=>{
  const current=state().fontScale||1;const i=Math.max(0,SCALES.indexOf(current));
  api()?.font?.(SCALES[Math.min(SCALES.length-1,i+1)]);updateTextValue();
});
$$('[data-quick-theme]').forEach(b=>b.addEventListener('click',()=>{api()?.theme?.(b.dataset.quickTheme);updateThemeDots()}));

scroller?.addEventListener('scroll',()=>{if(!visibleMenu())conceal()},{passive:true});
document.addEventListener('pointerdown',e=>{
  if(!reader||reader.hidden)return;
  if(menu.contains(e.target)||textSubmenu.contains(e.target)||backgroundSubmenu.contains(e.target)||moreZone.contains(e.target)||backZone.contains(e.target))return;
  closeMenu();
},{capture:true});

document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){closeMenu();moreButton.focus({preventScroll:true})}});

new MutationObserver(()=>{
  if(!reader.hidden){closeMenu();requestAnimationFrame(()=>revealBoth(1900))}
}).observe(reader,{attributes:true,attributeFilter:['hidden']});

/* Keep the locked front-page wording exact even while the legacy localisation layer is being consolidated. */
function lockHomeCopy(){
  const et=document.documentElement.lang==='et';
  $('#digitalDoorCopy').textContent=et?'Algupärased lood':'The original stories';
  $('#originalDoorCopy').textContent=et?'Algupärane füüsiline raamat':'The original physical book';
}
lockHomeCopy();
