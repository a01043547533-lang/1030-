/* Create / Read / Update / Delete → localStorage에 JSON으로 영구 저장 */
'use strict';
const DEFAULT_MONTH = '2026-10';
let viewDate = new Date(DEFAULT_MONTH+'-01T12:00:00');
let selectedDate = '';
let eventScope = 'all';
let taskFilter = 'all';
const monthValue = () => localDate(viewDate).slice(0,7);
// 새 일정과 플래너 세팅을 각각 한 번만 반영합니다. 기존 항목을 지워도 재생성하지 않습니다.
const ADMISSIONS_VERSION = '2027-requested-v1';
const MOCK_VERSION = '2027-daesung-final-v1';
const GIST_FIRST_VERSION = '2027-gist-first-v1';
const KNU_INTERVIEW_VERSION = '2027-knu-interview-v1';
const SETUP_VERSION = '2027-planner-setup-v1';
const CSAT_DATE = '2026-11-19';
const LEGACY_EXAMPLES = [
  { id:'example-1', title:'[예시] 수능 준비물 점검', date:'2026-11-10', category:'admission', note:'기능 시연용으로 직접 입력한 예시 일정입니다. 실제 시험일이 아닙니다. 공식 공지를 확인한 뒤 수정해주세요.' },
  { id:'example-2', title:'[예시] 면접 답변 연습', date:'2026-11-14', category:'personal', note:'지원 동기와 학교생활 경험을 1분 안에 정리해보기. 자유롭게 수정하거나 삭제할 수 있어요.' },
  { id:'example-3', title:'[예시] 대학별 모집요강 확인', date:'2026-10-30', category:'admission', note:'실제 접수 일정이 아닌 플래너 사용 예시입니다. 대학 입학처에서 전형 일정과 제출 서류를 확인하세요.' }
];
async function initialize() {
  try {
    const current = Store.read();
    const versions = Array.isArray(current.appliedScheduleVersions) ? current.appliedScheduleVersions : [];
    const required = [ADMISSIONS_VERSION, MOCK_VERSION, GIST_FIRST_VERSION, KNU_INTERVIEW_VERSION, SETUP_VERSION];
    if (required.some(version => !versions.includes(version))) {
      const responses = await Promise.all([fetch('data/admissions.json', {cache:'no-cache'}), fetch('data/checklist.json', {cache:'no-cache'})]);
      if (responses.some(response => !response.ok)) throw new Error('기본 데이터 로딩 실패');
      const [defaults, tasks] = await Promise.all(responses.map(response => response.json()));
      if (!Store.valid({events:defaults,tasks})) throw new Error('기본 데이터 형식 오류');
      Store.change(data => {
        const applied = new Set(Array.isArray(data.appliedScheduleVersions) ? data.appliedScheduleVersions : []);
        const packs = [
          {version:ADMISSIONS_VERSION, events:defaults.filter(event => !['admission-2027-daesung-final', 'admission-2027-gist-first', 'admission-2027-knu-interview'].includes(event.id))},
          {version:MOCK_VERSION, events:defaults.filter(event => event.id === 'admission-2027-daesung-final')},
          {version:GIST_FIRST_VERSION, events:defaults.filter(event => event.id === 'admission-2027-gist-first')},
          {version:KNU_INTERVIEW_VERSION, events:defaults.filter(event => event.id === 'admission-2027-knu-interview')}
        ];
        for (const pack of packs) {
          if (applied.has(pack.version)) continue;
          for (const event of pack.events) {
            if (!data.events.some(saved => saved.id === event.id || (saved.title === event.title && saved.date === event.date))) data.events.push(event);
          }
          applied.add(pack.version);
        }
        if (!applied.has(SETUP_VERSION)) {
          // 사용자가 수정한 예시는 유지하고, 최초 제공 내용 그대로인 예시만 정리합니다.
          data.events = data.events.filter(event => !LEGACY_EXAMPLES.some(example => Object.keys(example).every(key => example[key] === event[key])));
          for (const task of tasks) {
            if (!data.tasks.some(saved => saved.id === task.id || saved.title === task.title)) data.tasks.push(task);
          }
          applied.add(SETUP_VERSION);
        }
        data.appliedScheduleVersions = [...applied];
      });
    }
  } catch { toast('기본 데이터를 불러오지 못했어요. 인터넷 연결을 확인한 후 새로고침해주세요.'); }
  // 처음 열거나 새로고침하면 사용자가 지정한 2026년 10월을 표시합니다.
  viewDate = new Date(DEFAULT_MONTH+'-01T12:00:00');
  render();
}

function render() {
  let data;
  try { data=Store.read(); } catch { toast('저장 데이터를 읽지 못했어요. 유효한 백업을 불러와주세요.'); return; }
  $('#csat-dday').textContent = dday(CSAT_DATE);
  const month = monthValue();
  document.querySelectorAll('[data-month]').forEach(button => { const active = Number(button.dataset.month) === viewDate.getMonth(); button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  $('#month-label').textContent = `${viewDate.getFullYear()}년 ${viewDate.getMonth()+1}월`;
  renderCalendar($('#calendar'),month,data.events,selectedDate);
  $('#month-count').innerHTML = `${data.events.filter(e=>e.date.startsWith(month)).length}<span>개</span>`;
  const next = [...data.events].filter(e=>e.date>=localDate() && !e.title.startsWith('[예시]')).sort((a,b)=>a.date.localeCompare(b.date))[0];
  $('#next-title').textContent = next?.title || '예정된 일정 없음';
  $('#next-date').textContent = next ? dateLabel(next.date) : '';
  $('#next-dday').textContent = next ? dday(next.date) : 'D−?';
  const done = data.tasks.filter(t=>t.done).length;
  const percent = data.tasks.length ? Math.round(done/data.tasks.length*100):0;
  $('#progress-count').innerHTML = `${percent}<span>%</span>`;
  $('#progress-bar').style.width = `${percent}%`;
  $('#progress-caption').textContent = data.tasks.length ? `${data.tasks.length}개 중 ${done}개 완료` : '할 일 없음';
  $('#task-badge').textContent = `${done} / ${data.tasks.length}`;
  const tasks = data.tasks.filter(t=>taskFilter==='all'||(taskFilter==='done'?t.done:!t.done));
  $('#task-list').innerHTML = tasks.length ? tasks.map(t=>`<li class="task ${t.done?'done':''}" data-id="${esc(t.id)}"><label class="task-check"><input type="checkbox" ${t.done?'checked':''} aria-label="${esc(t.title)} 완료"><span>${esc(t.title)}</span></label><div class="task-tools"><button data-action="edit-task" aria-label="${esc(t.title)} 수정">수정</button><button data-action="delete-task" aria-label="${esc(t.title)} 삭제">×</button></div></li>`).join('') : '<li class="task-empty">'+(taskFilter==='done'?'완료한 할 일 없음':'할 일 없음')+'</li>';
  const query = $('#event-search').value.trim().toLowerCase();
  const category = $('#event-filter').value;
  const events = data.events.filter(e=>(selectedDate?e.date===selectedDate:eventScope==='all'||e.date.startsWith(month))&&(category==='all'||e.category===category)&&(e.title+' '+e.note).toLowerCase().includes(query)).sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title));
  $('#list-title').textContent = (selectedDate ? `${dateLabel(selectedDate)} 일정` : eventScope==='all' ? '전체 일정' : `${viewDate.getMonth()+1}월 일정`) + ` · ${events.length}건`;
  document.querySelectorAll('[data-event-scope]').forEach(button => button.setAttribute('aria-pressed',String(!selectedDate && button.dataset.eventScope===eventScope)));
  $('#show-month').hidden = !selectedDate;
  $('#event-list').innerHTML = events.length ? events.map(e=>`<article class="event-row ${eventStyle(e).className}" data-id="${esc(e.id)}"><div class="event-date"><b>${Number(e.date.slice(-2))}</b><span>${Number(e.date.slice(5,7))}월</span></div><div class="event-detail"><span class="category-tag ${eventStyle(e).className}">${esc(eventStyle(e).label)}</span>${eventStyle(e).kind && eventStyle(e).kind!==eventStyle(e).label ? `<span class="type-tag">${esc(eventStyle(e).kind)}</span>` : ''}<h3>${eventTitleMarkup(e)}</h3>${e.note ? `<details class="event-note"><summary>메모</summary><p>${esc(e.note)}</p></details>` : ''}</div><span class="dday">${dday(e.date)}</span><div class="event-tools"><button class="text-button" data-action="edit-event">수정</button><button class="text-button delete" data-action="delete-event">삭제</button></div></article>`).join('') : emptyState(query?'검색 결과 없음':'일정 없음','');
}
function openEvent(event, date) {
  $('#event-form').reset();
  $('#event-id').value = event?.id || '';
  $('#dialog-title').textContent = event ? '일정 수정' : '새 일정 추가';
  $('#event-title').value = event?.title || '';
  $('#event-date').value = event?.date || date || selectedDate || (localDate().startsWith(monthValue())?localDate():monthValue()+'-01');
  $('#event-category').value = event?.category || 'admission';
  $('#event-note').value = event?.note || '';
  $('#event-dialog').showModal();
  $('#event-title').focus();
}
let pendingDelete;
function confirmDelete(message, action) { $('#confirm-message').textContent=message; pendingDelete=action; $('#confirm-dialog').showModal(); }
$('#confirm-cancel').onclick=()=>$('#confirm-dialog').close();
$('#confirm-ok').onclick=()=>{ pendingDelete?.(); $('#confirm-dialog').close(); pendingDelete=null; };
$('#add-event').onclick=()=>openEvent();
$('#event-form').onsubmit=e=>{
  e.preventDefault();
  const id=$('#event-id').value;
  const event={id:id||crypto.randomUUID(),title:$('#event-title').value.trim(),date:$('#event-date').value,category:$('#event-category').value,note:$('#event-note').value.trim()};
  if(!event.title||!validDate(event.date)) return toast('일정 이름과 올바른 날짜를 입력해주세요.');
  if(Store.change(data=>{if(id){const index=data.events.findIndex(x=>x.id===id);if(index<0)throw new Error('삭제된 일정');data.events[index]=event;}else data.events.push(event);})){viewDate=new Date(event.date+'T12:00:00');selectedDate='';eventScope='all';$('#event-search').value='';$('#event-filter').value='all';$('#event-dialog').close();render();toast(id?'일정을 수정했어요.':'새 일정을 저장했어요.');}
};
$('#event-list').onclick=e=>{
  const button=e.target.closest('button[data-action]'); if(!button)return;
  const id=button.closest('[data-id]').dataset.id;
  const event=Store.read().events.find(x=>x.id===id); if(!event)return;
  if(button.dataset.action==='edit-event')openEvent(event);
  else confirmDelete(`‘${event.title}’ 일정을 삭제합니다.`,()=>{if(Store.change(data=>{data.events=data.events.filter(x=>x.id!==id);})){render();toast('일정을 삭제했어요.');}});
};
$('#task-form').onsubmit=e=>{e.preventDefault();const title=$('#task-input').value.trim();if(!title)return; if(Store.change(data=>data.tasks.push({id:crypto.randomUUID(),title,done:false}))){$('#task-form').reset();render();toast('할 일을 추가했어요.');}};
$('#task-list').onchange=e=>{const id=e.target.closest('[data-id]')?.dataset.id;if(id&&Store.change(data=>{const task=data.tasks.find(x=>x.id===id);if(task)task.done=e.target.checked;}))render();};
$('#task-list').onclick=e=>{
  const button=e.target.closest('button');if(!button)return;
  const id=button.closest('[data-id]').dataset.id;
  const task=Store.read().tasks.find(x=>x.id===id);if(!task)return;
  if(button.dataset.action==='edit-task'){$('#task-id').value=id;$('#task-edit-title').value=task.title;$('#task-dialog').showModal();}
  else confirmDelete(`‘${task.title}’ 할 일을 삭제합니다.`,()=>{if(Store.change(data=>{data.tasks=data.tasks.filter(x=>x.id!==id);})){render();toast('할 일을 삭제했어요.');}});
};
$('#task-edit-form').onsubmit=e=>{e.preventDefault();const title=$('#task-edit-title').value.trim();if(!title)return;if(Store.change(data=>{const task=data.tasks.find(x=>x.id===$('#task-id').value);if(task)task.title=title;})){$('#task-dialog').close();render();toast('할 일을 수정했어요.');}};
document.querySelectorAll('[data-task-filter]').forEach(button=>button.onclick=()=>{taskFilter=button.dataset.taskFilter;document.querySelectorAll('[data-task-filter]').forEach(b=>b.classList.toggle('selected',b===button));render();});
$('#calendar').onclick=e=>{if(e.target.closest('a'))return;const day=e.target.closest('[data-date]');if(!day)return;openEvent(undefined,day.dataset.date);};
function moveMonth(offset){viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()+offset,1);selectedDate='';render();}
document.querySelectorAll('[data-month]').forEach(button => button.onclick=()=>{ viewDate=new Date(viewDate.getFullYear(),Number(button.dataset.month),1);selectedDate='';render(); });
$('#go-reminders').onclick=()=>{ $('#reminders').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});$('#task-input').focus({preventScroll:true}); };
$('#prev-month').onclick=()=>moveMonth(-1);$('#next-month').onclick=()=>moveMonth(1);
$('#today').onclick=()=>{viewDate=new Date();selectedDate=localDate();render();};
$('#show-month').onclick=()=>{selectedDate='';eventScope='all';render();};
document.querySelectorAll('[data-event-scope]').forEach(button=>button.onclick=()=>{selectedDate='';eventScope=button.dataset.eventScope;render();});
$('#restore-admissions').onclick=async()=>{const button=$('#restore-admissions');button.disabled=true;let added=0;try{const response=await fetch('data/admissions.json',{cache:'no-cache'});if(!response.ok)throw Error();const defaults=await response.json();if(!Store.valid({events:defaults,tasks:[]}))throw Error();if(Store.change(data=>{for(const event of defaults){if(!data.events.some(saved=>saved.id===event.id||(saved.title===event.title&&saved.date===event.date))){data.events.push(event);added++;}}})){selectedDate='';eventScope='all';$('#event-search').value='';$('#event-filter').value='all';render();toast(added?`기본 일정 ${added}건을 다시 담았어요.`:'기본 일정이 모두 저장되어 있어요.');}}catch{toast('기본 일정을 불러오지 못했어요. 다시 시도해주세요.');}finally{button.disabled=false;}};
$('#event-search').oninput=render;$('#event-filter').onchange=render;
$('#export-data').onclick=()=>{try{const blob=new Blob([JSON.stringify(Store.read(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`chagok-backup-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{toast('백업을 만들지 못했어요.');}};
$('#import-data').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>3_000_000)throw new Error();const data=JSON.parse(await file.text());if(!Store.valid(data))throw new Error();$('#confirm-message').textContent='현재 일정과 할 일을 이 백업으로 교체할까요?';$('#confirm-ok').textContent='불러오기';pendingDelete=()=>{try{Store.write(data);render();toast('백업을 불러왔어요.');}catch{toast('백업 저장에 실패했어요.');}};$('#confirm-dialog').showModal();}catch{toast('올바른 차곡 백업 JSON 파일을 선택해주세요.');}finally{e.target.value='';}};
$('#confirm-dialog').addEventListener('close',()=>{$('#confirm-ok').textContent='삭제';});
window.addEventListener('storage',e=>{if(e.key===Store.key)render();});
$('#go-csat').onclick = () => { viewDate = new Date(CSAT_DATE+'T12:00:00'); selectedDate = CSAT_DATE; $('#event-search').value = ''; $('#event-filter').value = 'all'; render(); $('#calendar').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); };
// 탭을 열어둔 채 자정이 지나도 남은 날짜를 갱신합니다.
let renderedDay = localDate();
setInterval(() => { const today = localDate(); if (today !== renderedDay) { renderedDay = today; render(); } }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
initialize();
