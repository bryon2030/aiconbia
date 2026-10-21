'use strict';
import {published,mapBook,publicBook,pdfFromPath} from './backend.js';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let books = [...(window.HANGWON_BOOKS || [])];
const validCover = s => typeof s === 'string' && (/^assets\/[a-z0-9-]+\.(png|webp|jpg)$/.test(s) || /^https:\/\/sheuekronotkiedufacd\.supabase\.co\/storage\/v1\/object\/sign\/hangwon-books\//.test(s));
let filter = '전체', current = null, position = 0, content = [], busy = false, timer = null, returnFocus = null;
let pdfDoc=null,readerEpoch=0;
const mobile = () => matchMedia('(max-width:600px)').matches;
const step = () => position === 0 ? 1 : mobile() ? 1 : 2;
function cover(b) {
  return `<div class="cover has-image"><img src="${validCover(b.cover) ? b.cover : ''}" alt="${esc(b.title)} 표지"></div>`;
}
function render() {
  const q = $('#search').value.trim().toLowerCase();
  const list = books.filter(b => (filter === '전체' || b.category === filter) && `${b.title} ${b.author}`.toLowerCase().includes(q));
  $('#count').textContent = `${list.length}권의 이야기`;
  $('#empty').hidden = !!list.length;
  $('#empty').textContent = '찾으시는 책이 없습니다. 검색어나 분야를 바꿔보세요.';
  $('#books').innerHTML = list.map(b => `<a class="card" href="#book/${encodeURIComponent(b.id)}"><div class="cover-stage">${cover(b)}<span class="cover-label">에세이 전문 읽기 ↗</span></div><span class="category">${esc(b.category)}</span><h3>${esc(b.title)}</h3><span class="author">${esc(b.author)}</span><p class="summary">${esc(b.summary)}</p><div class="card-bottom"><strong>에세이</strong><span>책 펼쳐보기 ↗</span></div></a>`).join('');
}
async function route() {
  if ($('#reader').open) $('#reader').close();
  let id = '';
  try { id = location.hash.startsWith('#book/') ? decodeURIComponent(location.hash.slice(6)) : ''; } catch { /* Invalid links fall back to the shelf. */ }
  current = books.find(b => b.id === id) || null;
  if(!current && /^[0-9a-f-]{36}$/.test(id)){
    try{const row=await publicBook(id);if(location.hash!==`#book/${id}`)return;if(row){current=await mapBook(row);books.push(current);}}
    catch{notify('책을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');}
  }
  $('#home').hidden = !!current;
  $('#detail').hidden = !current;
  if (current) {
    const b = current;
    document.title = `${b.title} | 한권클럽 서점`;
    $('#detail').innerHTML = `<a href="#shelf" class="detail-back">← 서점으로 돌아가기</a><div class="detail-layout"><div class="detail-cover">${cover(b)}</div><div class="detail-copy"><span class="category">${esc(b.category)} · 에세이</span><h1>${esc(b.title)}</h1><p class="author">${esc(b.author)}</p><p class="description">${esc(b.description)}</p><div class="actions"><button class="primary" id="preview">책을 펼쳐 읽기 ↗</button><button class="outline" id="share">책 링크 공유하기</button></div><p class="detail-note">표지부터 마지막 문장까지, 책장을 넘기며 에세이 전문을 읽어보세요.</p></div></div><section class="detail-more"><p class="eyebrow">ABOUT THIS ESSAY</p><h2>함께하는 일상을 돌아보는 이야기</h2><p>${esc(b.summary)}</p><a class="outline" href="#shelf">서점으로 돌아가기 ↗</a></section>`;
    $('#preview').onclick = openReader;
    $('#share').onclick = share;
    if(b.pdfPath){$('#detail .category').textContent=`${b.category} · 전자책`;$('#detail .detail-note').textContent='표지부터 마지막 페이지까지, 책장을 넘기며 책 전문을 읽어보세요.';$('#detail .detail-more h2').textContent='이 책의 이야기';}
    scrollTo(0, 0);
  } else document.title = '한권클럽 서점 — 한 사람의 인생, 한 권의 발견';
  render();
}
function notify(s) {
  $('#toast').textContent = s; $('#toast').classList.add('show');
  clearTimeout(notify.timer); notify.timer = setTimeout(() => $('#toast').classList.remove('show'), 3500);
}
async function share() {
  try { await navigator.clipboard.writeText(location.href); notify('책 링크를 복사했습니다.'); }
  catch { notify('주소창의 책 링크를 복사해 주세요.'); }
}
function pages(b) {
  return [`<div class="page image-page"><img src="${b.cover}" alt="${esc(b.title)} 표지"></div>`, ...b.textPages.map((text, i) => `<article class="page essay-page" aria-label="본문 ${i + 1}페이지">${i === 0 ? `<h3>${esc(b.title)}</h3><div class="essay-author">${esc(b.author)}</div>` : `<div class="running-title">${esc(b.title)}</div>`}<p>${esc(text)}</p><span class="folio">${i + 1}</span></article>`)];
}
function paint(prepared=null) {
  const n = step(), closed = position === 0;
  $('#spread').classList.toggle('closed', closed);
  if(prepared)$('#spread').replaceChildren(...prepared.childNodes);
  else $('#spread').innerHTML = content.slice(position, position + n).join('');
  if(pdfDoc&&!prepared)renderPdfPages(readerEpoch);
  if (!closed && n === 2 && position + 1 >= content.length) $('#spread').insertAdjacentHTML('beforeend', '<div class="page blank-page" aria-hidden="true"></div>');
  $('#prev').disabled = position === 0;
  $('#next').disabled = position + n >= content.length;
  $('#page-status').textContent = closed ? `표지 · 본문 ${content.length - 1}쪽` : `${position}${n === 2 && position + 1 < content.length ? '–' + (position + 1) : ''} / ${content.length - 1}쪽`;
  $('.reading-area').scrollTop = 0;
}
async function openReader() {
  returnFocus = document.activeElement;
  const book=current,epoch=++readerEpoch;
  content = book.pdfPath ? [`<div class="page image-page"><img src="${esc(book.cover)}" alt="${esc(book.title)} 표지"></div>`] : pages(book); position = 0; busy = false;
  $('#reader').classList.remove('zoomed'); $('#zoom').textContent = '확대';
  $('#reader-title').textContent = current.title;
  $('.reader-hint').textContent='좌우로 밀거나 방향키로 넘겨보세요 · 책 전문을 읽을 수 있습니다';
  paint(); $('#reader').showModal(); $('#close-reader').focus();
  if(book.pdfPath){
    $('#next').disabled=true;$('#page-status').textContent='PDF를 불러오는 중…';
    try{const doc=await pdfFromPath(book.pdfPath);if(epoch!==readerEpoch){await doc.loadingTask.destroy();return;}pdfDoc=doc;content.push(...Array.from({length:doc.numPages},(_,i)=>`<div class="page pdf-page" data-pdf="${i+1}"><canvas aria-label="PDF ${i+1}페이지"></canvas><span class="pdf-folio">${i+1}</span></div>`));paint();}
    catch{if(epoch===readerEpoch)$('#page-status').textContent='PDF를 불러오지 못했습니다. 닫고 다시 열어주세요.';}
  }
}
async function renderPdfPages(epoch,root=$('#spread')){
 const doc=pdfDoc;
 for(const el of root.querySelectorAll('[data-pdf]')){
  const canvas=el.querySelector('canvas');
  try{const page=await doc.getPage(Number(el.dataset.pdf));if(epoch!==readerEpoch||!root.contains(canvas))return;const viewport=page.getViewport({scale:1.5});canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;if(root.contains(canvas))canvas.dataset.ready='true';}
  catch{if(canvas.isConnected){const note=document.createElement('p');note.textContent='이 페이지를 표시하지 못했습니다. 다시 열어주세요.';el.append(note);}}
 }
}
async function turn(direction) {
  if (busy || !$('#reader').open) return;
  const target = direction > 0 ? position + step() : position <= (mobile() ? 1 : 2) ? 0 : position - (mobile() ? 1 : 2);
  if (target < 0 || target >= content.length) return;
  busy = true;
  const epoch=readerEpoch,prepared=document.createElement('div');
  const count=target===0?1:mobile()?1:2;
  prepared.innerHTML=content.slice(target,target+count).join('');
  if(pdfDoc)await renderPdfPages(epoch,prepared);
  await Promise.all([...prepared.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));
  if(epoch!==readerEpoch||!$('#reader').open)return;
  const leaves = $('#spread').children;
  const leaf = leaves[direction > 0 ? Math.min(step() - 1, leaves.length - 1) : 0].cloneNode(true);
  const original=leaves[direction > 0 ? Math.min(step() - 1, leaves.length - 1) : 0].querySelector('canvas');if(original){const c=leaf.querySelector('canvas');c.width=original.width;c.height=original.height;c.getContext('2d').drawImage(original,0,0);}
  leaf.classList.add('turn-leaf'); leaf.setAttribute('aria-hidden', 'true');
  if (direction < 0) leaf.classList.add('reverse');
  position=target;paint(prepared);
  $('#spread').append(leaf);
  const finish=()=>{if(epoch!==readerEpoch)return;clearTimeout(timer);leaf.remove();busy=false;};
  leaf.addEventListener('animationend',finish,{once:true});
  timer = setTimeout(finish, matchMedia('(prefers-reduced-motion:reduce)').matches ? 5 : 700);
}
$('#prev').onclick = () => turn(-1); $('#next').onclick = () => turn(1);
$('#close-reader').onclick = () => $('#reader').close();
$('#reader').addEventListener('close', () => { clearTimeout(timer); busy = false;readerEpoch++;pdfDoc?.loadingTask.destroy();pdfDoc=null; returnFocus?.isConnected && returnFocus.focus(); });
$('#zoom').onclick = () => { const z = $('#reader').classList.toggle('zoomed'); $('#zoom').textContent = z ? '축소' : '확대'; };
$('#reader').addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); turn(e.key === 'ArrowRight' ? 1 : -1); }
});
let start = null;
$('.reading-area').addEventListener('pointerdown', e => { if (!$('#reader').classList.contains('zoomed')) start = {x:e.clientX, y:e.clientY}; });
$('.reading-area').addEventListener('pointerup', e => { if (start && Math.abs(e.clientX-start.x) > 45 && Math.abs(e.clientX-start.x) > Math.abs(e.clientY-start.y)) turn(e.clientX < start.x ? 1 : -1); start = null; });
$('.reading-area').addEventListener('pointercancel', () => start = null);
window.addEventListener('resize', () => { if ($('#reader').open && !busy) { if (!mobile() && position > 0 && position % 2 === 0) position--; paint(); } });
$('#search').oninput = render;
document.querySelectorAll('[data-filter]').forEach(btn => {
  btn.setAttribute('aria-pressed', String(btn.classList.contains('active')));
  btn.onclick = () => { filter = btn.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('active', b === btn); b.setAttribute('aria-pressed', String(b === btn)); }); render(); };
});
window.addEventListener('hashchange', route); route();
try{const remote=await published();const mapped=await Promise.all(remote.map(mapBook));books=[...(window.HANGWON_BOOKS||[]),...mapped];if(!$('#reader').open)await route();else render();}
catch{if($('#catalog-status'))$('#catalog-status').textContent='작가의 새 책을 불러오지 못했습니다. 잠시 후 다시 방문해 주세요.';}
