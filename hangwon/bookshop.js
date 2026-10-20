'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const books = window.HANGWON_BOOKS || [];
const validCover = s => typeof s === 'string' && /^assets\/[a-z0-9-]+\.(png|webp|jpg)$/.test(s);
let filter = '전체', current = null, position = 0, content = [], busy = false, timer = null, returnFocus = null;
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
function route() {
  if ($('#reader').open) $('#reader').close();
  let id = '';
  try { id = location.hash.startsWith('#book/') ? decodeURIComponent(location.hash.slice(6)) : ''; } catch { /* Invalid links fall back to the shelf. */ }
  current = books.find(b => b.id === id) || null;
  $('#home').hidden = !!current;
  $('#detail').hidden = !current;
  if (current) {
    const b = current;
    document.title = `${b.title} | 한권클럽 서점`;
    $('#detail').innerHTML = `<a href="#shelf" class="detail-back">← 서점으로 돌아가기</a><div class="detail-layout"><div class="detail-cover">${cover(b)}</div><div class="detail-copy"><span class="category">${esc(b.category)} · 에세이</span><h1>${esc(b.title)}</h1><p class="author">${esc(b.author)}</p><p class="description">${esc(b.description)}</p><div class="actions"><button class="primary" id="preview">책을 펼쳐 읽기 ↗</button><button class="outline" id="share">책 링크 공유하기</button></div><p class="detail-note">표지부터 마지막 문장까지, 책장을 넘기며 에세이 전문을 읽어보세요.</p></div></div><section class="detail-more"><p class="eyebrow">ABOUT THIS ESSAY</p><h2>함께하는 일상을 돌아보는 이야기</h2><p>${esc(b.summary)}</p><a class="outline" href="#shelf">서점으로 돌아가기 ↗</a></section>`;
    $('#preview').onclick = openReader;
    $('#share').onclick = share;
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
function paint() {
  const n = step(), closed = position === 0;
  $('#spread').classList.toggle('closed', closed);
  $('#spread').innerHTML = content.slice(position, position + n).join('');
  if (!closed && n === 2 && position + 1 >= content.length) $('#spread').insertAdjacentHTML('beforeend', '<div class="page blank-page" aria-hidden="true"></div>');
  $('#prev').disabled = position === 0;
  $('#next').disabled = position + n >= content.length;
  $('#page-status').textContent = closed ? `표지 · 본문 ${content.length - 1}쪽` : `${position}${n === 2 && position + 1 < content.length ? '–' + (position + 1) : ''} / ${content.length - 1}쪽`;
  $('.reading-area').scrollTop = 0;
}
function openReader() {
  returnFocus = document.activeElement;
  content = pages(current); position = 0; busy = false;
  $('#reader').classList.remove('zoomed'); $('#zoom').textContent = '확대';
  $('#reader-title').textContent = current.title;
  paint(); $('#reader').showModal(); $('#close-reader').focus();
}
function turn(direction) {
  if (busy || !$('#reader').open) return;
  const target = direction > 0 ? position + step() : position <= (mobile() ? 1 : 2) ? 0 : position - (mobile() ? 1 : 2);
  if (target < 0 || target >= content.length) return;
  busy = true;
  const leaves = $('#spread').children;
  const leaf = leaves[direction > 0 ? Math.min(step() - 1, leaves.length - 1) : 0].cloneNode(true);
  leaf.classList.add('turn-leaf'); leaf.setAttribute('aria-hidden', 'true');
  if (direction < 0) leaf.classList.add('reverse');
  $('#spread').append(leaf);
  timer = setTimeout(() => { position = target; paint(); busy = false; }, matchMedia('(prefers-reduced-motion:reduce)').matches ? 5 : 580);
}
$('#prev').onclick = () => turn(-1); $('#next').onclick = () => turn(1);
$('#close-reader').onclick = () => $('#reader').close();
$('#reader').addEventListener('close', () => { clearTimeout(timer); busy = false; returnFocus?.isConnected && returnFocus.focus(); });
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
