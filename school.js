/* 나이스 공공 API를 브라우저 fetch로 직접 호출합니다. 인증키는 저장하지 않습니다. */
'use strict';
let apiKey = '';
let schools = [];
let selectedSchool = null;
let schoolEvents = [];
let searchVersion = 0;
let scheduleVersion = 0;
$('#school-month').value = localDate().slice(0,7);
// 마지막으로 선택한 학교만 기억합니다. 인증키는 저장하지 않습니다.
try {
  const saved=JSON.parse(localStorage.getItem('chagok.school.v1')||'null');
  if(saved&&typeof saved.name==='string'&&Array.from($('#region').options).some(o=>o.value===saved.region)){
    $('#school-query').value=saved.name.slice(0,100);$('#region').value=saved.region;
  }
}catch{}
async function neis(service, params, page = 1, requestKey = apiKey) {
  const query = new URLSearchParams({Type:'json',pIndex:String(page),pSize:requestKey?'1000':'5',...params});
  if(requestKey)query.set('KEY',requestKey);
  let response;
  try { response=await fetch(`https://open.neis.go.kr/hub/${service}?${query}`,{signal:AbortSignal.timeout(15000),credentials:'omit'}); }
  catch { $('#neis-status').textContent='나이스 연결 실패'; throw new Error('API에 연결하지 못했어요. 인터넷 연결 또는 나이스 서비스 상태를 확인한 뒤 다시 시도해주세요. 브라우저에서 요청이 차단되었을 수도 있어요.'); }
  if(!response.ok)throw new Error(`나이스 서버 응답 오류 (${response.status}). 잠시 후 다시 시도해주세요.`);
  const json=await response.json();
  const result=json.RESULT || json[service]?.[0]?.head?.find(x=>x.RESULT)?.RESULT;
  if(result?.CODE==='INFO-200'){ $('#neis-status').textContent='나이스 연결됨'; if(requestKey)$('#key-status').textContent='인증키 연결됨'; return {rows:[],total:0}; }
  if(result?.CODE && result.CODE!=='INFO-000'){ $('#neis-status').textContent='나이스 응답 오류'; if(requestKey)$('#key-status').textContent='인증키 확인 필요'; throw new Error(result.CODE==='ERROR-290'?'인증키가 유효하지 않아요. 발급 내역의 키를 확인해주세요.':`나이스 응답: ${result.MESSAGE || result.CODE}`); }
  const block=json[service];
  if(!block)throw new Error('API 응답 형식이 예상과 달라요. 잠시 후 다시 시도해주세요.');
  $('#neis-status').textContent='나이스 연결됨';
  if(requestKey)$('#key-status').textContent='인증키 연결됨';
  return {rows:block.find(x=>x.row)?.row || [],total:block[0]?.head?.find(x=>x.list_total_count!==undefined)?.list_total_count || 0};
}
$('#school-search-form').onsubmit=async e=>{
  e.preventDefault();const name=$('#school-query').value.trim();if(!name)return;
  const version=++searchVersion; const button=$('#school-search-button');
  button.disabled=true;button.textContent='검색 중…';$('#school-results').innerHTML='';$('#search-status').textContent='검색 중…';
  try {
    const params={SCHUL_NM:name};if($('#region').value)params.ATPT_OFCDC_SC_CODE=$('#region').value;
    const data=await neis('schoolInfo',params);if(version!==searchVersion)return;
    schools=data.rows;
    $('#search-status').textContent=schools.length?`${schools.length}개 학교를 찾았어요.${apiKey&&data.total>schools.length?' 검색 결과가 많아요. 지역 또는 학교 이름을 구체적으로 입력해주세요.':''}`:'검색 결과가 없어요. 학교 이름과 지역을 확인해주세요.';
    $('#school-results').innerHTML=schools.map((s,i)=>`<button class="school-card ${selectedSchool?.SD_SCHUL_CODE===s.SD_SCHUL_CODE?'selected':''}" aria-pressed="${selectedSchool?.SD_SCHUL_CODE===s.SD_SCHUL_CODE}" data-index="${i}"><span class="school-card-icon">▥</span><span><b>${esc(s.SCHUL_NM)}</b><span>${esc(s.LCTN_SC_NM)} · ${esc(s.SCHUL_KND_SC_NM)}</span><small>${esc(s.ORG_RDNMA || '등록된 주소 없음')}</small></span><span class="school-select">${selectedSchool?.SD_SCHUL_CODE===s.SD_SCHUL_CODE?'선택됨':'선택 →'}</span></button>`).join('');
    if(version===1 && schools.length===1 && schools[0].SCHUL_NM===name)$('#school-results .school-card').click();
  } catch(error){if(version===searchVersion)$('#search-status').textContent=error.message;}
  finally{if(version===searchVersion){button.disabled=false;button.textContent='학교 검색';}}
};
$('#school-results').onclick=e=>{const card=e.target.closest('[data-index]');if(!card)return;selectedSchool=schools[Number(card.dataset.index)];document.querySelectorAll('.school-card').forEach(c=>{const active=c===card;c.classList.toggle('selected',active);c.setAttribute('aria-pressed',String(active));c.querySelector('.school-select').textContent=active?'선택됨':'선택 →';});try{localStorage.setItem('chagok.school.v1',JSON.stringify({name:selectedSchool.SCHUL_NM,region:selectedSchool.ATPT_OFCDC_SC_CODE}));}catch{}$('#add-school-schedule').disabled=false;$('#selected-school').textContent=selectedSchool.SCHUL_NM;updateSchoolHomepage(selectedSchool);$('#school-address').textContent=`${selectedSchool.LCTN_SC_NM} · ${selectedSchool.ORG_RDNMA || ''}`;$('#load-schedule').disabled=false;loadSchedule();};
$('#schedule-form').onsubmit=e=>{e.preventDefault();loadSchedule();};
const schoolMonthColors=['#eee3ed','#e4e8f2','#e4eddc','#f2e9cf','#e0ece5','#e0ebef','#e6e5f0','#f0e5db','#eee8d5','#eadfce','#e8dfec','#dfe8ed'];
function updateSchoolMonthColor(){
  const value=$('#school-month').value;
  if(!validDate(value+'-01'))return;
  const month=Number(value.slice(5,7));
  const panel=$('.school-calendar-panel');
  panel.style.setProperty('--school-month-color',schoolMonthColors[month-1]);
  panel.dataset.month=String(month);
}
$('#school-month').addEventListener('change',()=>{updateSchoolMonthColor();loadSchedule();});
updateSchoolMonthColor();
function shiftSchoolMonth(step){
  const value=$('#school-month').value;
  if(!validDate(value+'-01'))return;
  const [year,month]=value.split('-').map(Number);
  const date=new Date(year,month-1+step,1);
  if(date.getFullYear()<1900||date.getFullYear()>2100)return;
  $('#school-month').value=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  loadSchedule();
}
$('#school-prev').onclick=()=>shiftSchoolMonth(-1);
$('#school-next').onclick=()=>shiftSchoolMonth(1);
$('#school-this-month').onclick=()=>{$('#school-month').value=localDate().slice(0,7);loadSchedule();};
async function loadSchedule(){
  updateSchoolMonthColor();
  if(!selectedSchool)return;
  const month=$('#school-month').value;if(!/^\d{4}-\d{2}$/.test(month)||!validDate(month+'-01'))return toast('조회할 월을 선택해주세요.');
  const version=++scheduleVersion;const school={...selectedSchool};const requestKey=apiKey;
  schoolEvents=[];
  $('#load-schedule').disabled=true;$('#load-schedule').textContent='조회 중…';$('#schedule-status').textContent='조회 중…';$('#school-event-list').innerHTML='';$('#school-calendar').hidden=true;
  try{
    const params={ATPT_OFCDC_SC_CODE:school.ATPT_OFCDC_SC_CODE,SD_SCHUL_CODE:school.SD_SCHUL_CODE,AA_YMD:month.replace('-','')};
    const first=await neis('SchoolSchedule',params,1,requestKey);let rows=first.rows;
    if(requestKey){for(let p=2;p<=Math.ceil(first.total/1000);p++){if(p>20)throw new Error('조회 결과가 너무 많아요. 다른 월을 선택해주세요.');rows.push(...(await neis('SchoolSchedule',params,p,requestKey)).rows);}}
    if(version!==scheduleVersion)return;
    // 샘플 모드에서도 API가 돌려준 날짜와 학교를 검증합니다.
    rows=rows.filter(r=>r.SD_SCHUL_CODE===school.SD_SCHUL_CODE&&String(r.AA_YMD).startsWith(month.replace('-','')));
    schoolEvents=rows.map((r,i)=>({id:`neis-${school.SD_SCHUL_CODE}-${r.AA_YMD}-${i}`,title:String(r.EVENT_NM||'학교 행사').slice(0,100),date:`${r.AA_YMD.slice(0,4)}-${r.AA_YMD.slice(4,6)}-${r.AA_YMD.slice(6,8)}`,category:'personal',note:`${school.SCHUL_NM} · ${r.EVENT_CNTNT&&r.EVENT_CNTNT!=='없음'?r.EVENT_CNTNT:'학교 학사일정'} (출처: 나이스)`.slice(0,500)})).filter(e=>validDate(e.date)).sort((a,b)=>a.date.localeCompare(b.date));
    // 동일 날짜·제목으로 중복 제공되는 행은 하나로 표시합니다.
    schoolEvents=schoolEvents.filter((e,i,all)=>all.findIndex(x=>x.date===e.date&&x.title===e.title)===i);
    renderSchoolSchedules();
  }catch(error){if(version===scheduleVersion){schoolEvents=[];renderSchoolSchedules();$('#schedule-status').textContent=error.message+' · 직접 추가한 일정은 아래에서 확인하세요.';}}
  finally{if(version===scheduleVersion){$('#load-schedule').disabled=false;$('#load-schedule').textContent='일정 조회';}}
}
$('#school-event-list').onclick=e=>{const button=e.target.closest('.add-school-event');if(!button||button.disabled)return;const event=schoolEvents[Number(button.dataset.index)];if(!event)return;let duplicate=false;if(Store.change(data=>{duplicate=data.events.some(x=>x.date===event.date&&x.title===event.title&&x.note===event.note);if(!duplicate)data.events.push({...event,id:crypto.randomUUID()});})){toast(duplicate?'이미 내 일정에 담았어요.':'내 일정에 저장했어요. 첫 번째 페이지에서 확인하세요.');renderSchoolSchedules();}};
$('#key-form').onsubmit=e=>{e.preventDefault();apiKey=$('#api-key').value.trim();$('#api-key').value='';++searchVersion;++scheduleVersion;$('#school-search-button').disabled=false;$('#school-search-button').textContent='학교 검색';$('#load-schedule').disabled=!selectedSchool;$('#load-schedule').textContent='일정 조회';$('#key-status').textContent=apiKey?'인증키 확인 중':'인증키 없음 · 최대 5건';if(selectedSchool)loadSchedule();else $('#school-search-form').requestSubmit();};
$('#clear-key').onclick=()=>{$('#api-key').value='';$('#key-form').requestSubmit();toast('인증키를 지웠어요.');};

// 첫 접속 시 대구 계성고등학교를 실제 API에서 검색하고 학사일정을 조회합니다.
$('#school-search-form').requestSubmit();

function schoolHomepageUrl(value){
  const raw=String(value||'').trim();
  if(!raw)return null;
  try{
    const url=new URL(/^[a-z][a-z\d+.-]*:/i.test(raw)?raw:`https://${raw}`);
    return ['http:','https:'].includes(url.protocol)&&url.hostname&&!url.username&&!url.password?url.href:null;
  }catch{return null;}
}
function updateSchoolHomepage(school){
  const link=$('#school-homepage');
  const url=schoolHomepageUrl(school.HMPG_ADRES);
  link.hidden=!url;
  if(url){link.href=url;link.setAttribute('aria-label',`${school.SCHUL_NM} 홈페이지 새 탭에서 열기`);}
  else{link.removeAttribute('href');link.removeAttribute('aria-label');}
}


function renderSchoolSchedules(){
  if(!selectedSchool)return;
  const month=$('#school-month').value;
  let saved=[];
  try{saved=Store.read().events;}catch{}
  const isSaved=event=>saved.some(e=>e.date===event.date&&e.title===event.title&&e.note===event.note);
  let own=[];
  try{own=saved.filter(e=>e.id.startsWith('manual-school-'+selectedSchool.SD_SCHUL_CODE+'-')&&e.date.startsWith(month));}catch{}
  const visible=[...schoolEvents,...own].sort((a,b)=>a.date.localeCompare(b.date));
    $('#schedule-status').textContent=`${month.replace('-','년 ')}월 · ${visible.length}개 일정`;
    $('#school-calendar').hidden=false;renderCalendar($('#school-calendar'),month,visible,'',true);
    $('#school-calendar').style.setProperty('--school-weeks',$('#school-calendar').dataset.weeks);
    $('#school-calendar').querySelectorAll('.day-selector').forEach(button=>{
      button.setAttribute('aria-label',button.closest('[data-date]').dataset.date+' 일정 추가');
    });
    $('#school-event-list').innerHTML=visible.length?visible.map((ev,i)=>`<article class="event-row"><div class="event-date"><b>${Number(ev.date.slice(-2))}</b><span>${Number(ev.date.slice(5,7))}월</span></div><div class="event-detail"><span class="category-tag personal">학교 일정</span><h3>${esc(ev.title)}</h3><p>${esc(ev.note)}</p></div>${ev.id.startsWith('manual-school-')?'<span class="saved-school-event">내 일정에 저장됨</span>':`<button class="secondary add-school-event" data-index="${schoolEvents.indexOf(ev)}" ${isSaved(ev)?'disabled':''}>${isSaved(ev)?'저장됨 ✓':'내 일정에 담기 ＋'}</button>`}</article>`).join(''):emptyState('학사일정 없음','');
}
function openSchoolEvent(date){
  if(!selectedSchool){toast('학교를 먼저 검색하고 선택해주세요.');$('#school-query').focus();return;}
  $('#school-event-form').reset();
  $('#school-event-for').textContent=selectedSchool.SCHUL_NM;
  const month=$('#school-month').value;
  $('#school-event-date').value=date||(localDate().startsWith(month)?localDate():month+'-01');
  $('#school-event-dialog').showModal();$('#school-event-title').focus();
}
$('#add-school-schedule').onclick=()=>openSchoolEvent();
$('#school-calendar').onclick=e=>{
  if(e.target.closest('a'))return;
  const day=e.target.closest('[data-date]');
  if(day)openSchoolEvent(day.dataset.date);
};
$('#school-event-form').onsubmit=e=>{
  e.preventDefault();if(!selectedSchool)return;
  const title=$('#school-event-title').value.trim();const date=$('#school-event-date').value;
  if(!title||!validDate(date))return toast('일정 이름과 날짜를 확인해주세요.');
  const event={id:'manual-school-'+selectedSchool.SD_SCHUL_CODE+'-'+crypto.randomUUID(),title,date,category:'personal',note:(selectedSchool.SCHUL_NM+' · 직접 추가'+($('#school-event-note').value.trim()?' · '+$('#school-event-note').value.trim():'')).slice(0,500)};
  if(!Store.change(data=>data.events.push(event)))return;
  $('#school-event-dialog').close();toast('학교 달력과 내 일정에 저장했어요.');
  if($('#school-month').value!==date.slice(0,7)){$('#school-month').value=date.slice(0,7);loadSchedule();}else renderSchoolSchedules();
};

window.addEventListener('storage',e=>{if(e.key===Store.key||e.key===null)renderSchoolSchedules();});
