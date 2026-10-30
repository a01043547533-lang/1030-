/* 두 페이지가 공유하는 저장, 날짜, 달력, API 도우미입니다. */
'use strict';
const Store = {
  key: 'chagok.planner.v1',
  read() {
    const raw = localStorage.getItem(this.key);
    if (!raw) return { events: [], tasks: [], initialized: false };
    const data = JSON.parse(raw);
    if (!this.valid(data)) throw new Error('저장 데이터 형식이 올바르지 않습니다.');
    return data;
  },
  valid(data) {
    const str = (v, n) => typeof v === 'string' && v.length <= n;
    const unique = items => new Set(items.map(x => x.id)).size === items.length;
    return data && Array.isArray(data.events) && Array.isArray(data.tasks) &&
      data.events.length <= 5000 && data.tasks.length <= 5000 && unique(data.events) && unique(data.tasks) &&
      data.events.every(e => e && str(e.id, 200) && e.id && str(e.title, 100) && e.title.trim() && validDate(e.date) && ['admission', 'personal'].includes(e.category) && str(e.note, 500)) &&
      data.tasks.every(t => t && str(t.id, 200) && t.id && str(t.title, 100) && t.title.trim() && typeof t.done === 'boolean');
  },
  write(data) {
    if (!this.valid(data)) throw new Error('저장할 데이터 형식을 확인해주세요.');
    localStorage.setItem(this.key, JSON.stringify({ ...data, initialized: true }));
  },
  change(fn) {
    try { const data = this.read(); fn(data); this.write(data); return true; }
    catch { toast('저장하지 못했어요. 저장 공간·브라우저 설정 또는 백업 파일을 확인해주세요.'); return false; }
  }
};
const $ = s => document.querySelector(s);
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= '2100-12-31' && localDate(new Date(value+'T12:00:00')) === value; }
function dateLabel(value) { return new Date(value+'T12:00:00').toLocaleDateString('ko-KR', {month:'long',day:'numeric',weekday:'short'}); }
function daysLeft(value) { return Math.round((Date.parse(value+'T00:00:00Z') - Date.parse(localDate()+'T00:00:00Z'))/86400000); }
function dday(value) { const n = daysLeft(value); return n === 0 ? 'D-DAY' : n > 0 ? `D−${n}` : `D+${-n}`; }
let toastTimer;
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(()=>el.classList.remove('visible'), 3600); }

// 저장된 일정과 새 일정 모두 제목을 기준으로 같은 색상을 사용합니다.
function eventStyle(event) {
  const title = event.title || '';
  let tone='personal', label='나의 일정';
  if (event.id==='admission-2027-csat' || /^(?:\d{4}학년도\s*)?(?:수능|대학수학능력시험)(?:\s*시험)?$/.test(title)) {tone='csat';label='수능';}
  else if (/지스트|GIST/i.test(title)) {tone='gist';label='GIST';}
  else if (/경북/.test(title)) {tone='knu';label='경북대';}
  else if (/포스텍|POSTECH/i.test(title)) {tone='postech';label='POSTECH';}
  else if (/대성|더프/.test(title)) {tone='daesung';label='대성';}
  else if (event.category==='admission') {tone='admission';label='입시';}
  else if (/출처: 나이스/.test(event.note || '')) {tone='school';label='학교';}
  const kind = tone==='csat' ? '수능' : /발표/.test(title) ? '발표' : /면접/.test(title) ? '면접' : /모고|모의고사|더프/.test(title) ? '모고' : '';
  return {tone,label,kind,className:'tone-'+tone};
}

function admissionUrl(event) {
  return {gist:'https://www.gist.ac.kr/uadm/',knu:'https://ipsi1.knu.ac.kr/',postech:'https://adm-u.postech.ac.kr/'}[eventStyle(event).tone] || '';
}
function eventTitleMarkup(event) {
  const url=admissionUrl(event);
  return url ? `<a class="admission-link" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${esc(event.title)} · ${esc(eventStyle(event).label)} 입학처 새 탭">${esc(event.title)} <span class="outbound-icon" aria-hidden="true">↗</span></a>` : esc(event.title);
}
function renderCalendar(el, month, events, selected = '', clickable = true) {
  const [year,m]=month.split('-').map(Number);
  const start=new Date(year,m-1,1).getDay();
  const count=new Date(year,m,0).getDate();
  const cells=Math.ceil((start+count)/7)*7;
  const today=localDate();
  el.dataset.weeks=String(cells/7);
  let html=['일','월','화','수','목','금','토'].map((d,i)=>`<div class="weekday ${i===0?'sun':i===6?'sat':''}">${d}</div>`).join('');
  for(let i=0;i<cells;i++){
    const date=localDate(new Date(year,m-1,i-start+1));
    const list=events.filter(e=>e.date===date);
    html+=`<div class="day ${date.slice(0,7)!==month?'other':''} ${date===today?'is-today':''} ${date===selected?'is-selected':''} ${list.some(e=>eventStyle(e).tone==='csat')?'has-csat':''}" ${clickable?`data-date="${date}"`:''}>${clickable?`<button type="button" class="day-selector" aria-label="${date}, 일정 ${list.length}개" aria-pressed="${date===selected}"></button>`:''}<span class="day-number">${Number(date.slice(-2))}</span>${list.some(e=>eventStyle(e).tone==='csat') ? '<svg class="csat-hand-star" viewBox="0 0 64 64" aria-hidden="true"><path d="M31 5 24 25 4 26 21 38 16 59 33 45 52 57 45 36 60 22 39 24 31 5Z"/><path class="star-retrace" d="M30 7 23 26 6 27 22 39 18 56 33 43 50 55 43 35 57 24 38 26 30 7"/><path class="star-spark" d="m52 5-4 8M62 11l-7 6M7 9l7 6"/></svg>' : ''}${list.slice(0,2).map(event=>{
      const style=eventStyle(event);
      const url=admissionUrl(event);
      const tag=url?'a':'span';
      return `<${tag} class="calendar-event ${event.category} ${style.className}" title="${esc(event.title)}${url?' · 입학처 새 탭':''}" ${url?`href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${esc(event.title)} · ${esc(style.label)} 입학처 새 탭"`:''}>${style.kind?`<span class="event-kind">${esc(style.kind)}</span>`:''}${esc(style.tone==='csat'?'수능':event.title)}${url?' <span class="outbound-icon" aria-hidden="true">↗</span>':''}</${tag}>`;
    }).join('')}${list.length>2?`<span class="more-events">+${list.length-2}개</span>`:''}</div>`;
  }
  el.innerHTML=html;
}
function emptyState(title, description) { return `<div class="empty-state"><span aria-hidden="true">▦</span><h3>${esc(title)}</h3>${description ? `<p>${esc(description)}</p>` : ''}</div>`; }
document.addEventListener('click', e=> { if(e.target.closest('[data-close]')) e.target.closest('dialog').close(); });

for (const el of document.querySelectorAll("[data-today]")) { el.dateTime = localDate(); el.textContent = new Date().toLocaleDateString("ko-KR", { year:"numeric", month:"long", day:"numeric", weekday:"short" }); }
