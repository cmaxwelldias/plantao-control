
const KEY='plantao-control-v1';
const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dateFmt=s=>new Date(s).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
function defaultDB(){return {schemaVersion:2,hospitals:[
{id:'hsl',name:'HSL',dayRate:31,nightMode:'none',nightValue:0},
{id:'dor',name:"D'or",dayRate:26.66,nightMode:'none',nightValue:0}
],shifts:[],nightStart:'22:00',nightEnd:'05:00'}}
function validId(v){return typeof v==='string' && /^[a-zA-Z0-9_-]{1,80}$/.test(v)}
function normalizeDB(raw){
 if(!raw || typeof raw!=='object' || !Array.isArray(raw.hospitals) || !Array.isArray(raw.shifts)) throw Error('Estrutura de backup inválida.');
 const ids=new Set(), hospitals=raw.hospitals.map(h=>{
  if(!h || !validId(h.id) || ids.has(h.id) || typeof h.name!=='string' || !h.name.trim() || h.name.length>100) throw Error('Hospital inválido ou duplicado no backup.');
  ids.add(h.id);const dayRate=Number(h.dayRate),nightValue=Number(h.nightValue||0);
  if(!Number.isFinite(dayRate)||dayRate<0||!Number.isFinite(nightValue)||nightValue<0||!['none','percent','fixed','total'].includes(h.nightMode)) throw Error('Valores ou regra noturna inválidos no backup.');
  return {id:h.id,name:h.name.trim(),dayRate,nightMode:h.nightMode,nightValue,address:String(h.address||'').slice(0,250),modalities:Array.isArray(h.modalities)?h.modalities.filter(x=>typeof x==='string').map(x=>x.trim()).filter(Boolean).slice(0,20):[]};
 });
 const shiftIds=new Set(),shifts=raw.shifts.map(s=>{
  if(!s||!validId(s.id)||shiftIds.has(s.id)||!ids.has(s.hospitalId)) throw Error('Plantão inválido, duplicado ou associado a hospital inexistente.');
  shiftIds.add(s.id);const start=String(s.start||''),end=String(s.end||''),breakMins=Number(s.breakMins||0);
  if(!Number.isFinite(new Date(start).getTime())||!Number.isFinite(new Date(end).getTime())||new Date(end)<=new Date(start)||!Number.isFinite(breakMins)||breakMins<0||breakMins>1440) throw Error('Datas ou intervalo inválidos em um plantão.');
  if(!['Pendente','Realizado','Recebido'].includes(s.status)) throw Error('Status de plantão inválido no backup.');
  return {id:s.id,hospitalId:s.hospitalId,start,end,breakMins,status:s.status,notes:String(s.notes||'').slice(0,1000),...(typeof s.googleEventId==='string'?{googleEventId:s.googleEventId.slice(0,256)}:{})};
 });
 const timeOK=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
 if(!timeOK(raw.nightStart||'22:00')||!timeOK(raw.nightEnd||'05:00')) throw Error('Horário noturno inválido no backup.');
 return {schemaVersion:2,hospitals,shifts,nightStart:raw.nightStart||'22:00',nightEnd:raw.nightEnd||'05:00'};
}
let db,corruptLocalData=null;
try{corruptLocalData=localStorage.getItem(KEY);db=corruptLocalData?normalizeDB(JSON.parse(corruptLocalData)):defaultDB();}
catch(e){
 if(corruptLocalData){try{localStorage.setItem('plantao-control-recovery-backup',corruptLocalData)}catch(storageError){console.error('Não foi possível preservar a cópia de recuperação:',storageError)}}
 db=defaultDB();console.error('Não foi possível validar os dados locais:',e);
 setTimeout(()=>alert('Os dados locais parecem inválidos. Para evitar travamento, o app abriu com uma base vazia. Uma cópia de recuperação foi preservada no navegador, quando possível. Não faça novas alterações antes de recuperar os dados.'),300);
}
function save(){try{db.schemaVersion=2;localStorage.setItem(KEY,JSON.stringify(db));render()}catch(e){alert('Não foi possível salvar os dados neste navegador. Exporte um backup e libere espaço no armazenamento.');console.error(e)}}
function id(){return crypto.randomUUID?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2))}
function mins(t){let [h,m]=t.split(':').map(Number);return h*60+m}
function nightOverlap(a,b){
 const ns=mins(db.nightStart),ne=mins(db.nightEnd),duration=Math.max(0,(b-a)/60000);
 if(ns===ne)return duration;
 let total=0,day=new Date(a);day.setHours(0,0,0,0);day.setDate(day.getDate()-1);
 const last=new Date(b);last.setHours(0,0,0,0);
 while(day<=last){
  const segmentStart=new Date(day),segmentEnd=new Date(day);
  segmentStart.setMinutes(ns);
  if(ns<ne){segmentEnd.setMinutes(ne);}
  else{segmentEnd.setDate(segmentEnd.getDate()+1);segmentEnd.setMinutes(ne);}
  const overlap=Math.max(0,Math.min(b,segmentEnd)-Math.max(a,segmentStart));
  total+=overlap/60000;day.setDate(day.getDate()+1);
 }
 return Math.min(duration,total);
}
function calc(s){
 let a=new Date(s.start),b=new Date(s.end);if(!(b>a))return {hours:0,night:0,day:0,total:0};
 let totalMin=Math.round((b-a)/60000), night=nightOverlap(a,b), day=totalMin-night;
 let h=db.hospitals.find(x=>x.id===s.hospitalId);if(!h)return {hours:totalMin/60,night:night/60,day:day/60,total:0};
 let normal=day/60*Number(h.dayRate), nh=night/60*Number(h.dayRate);
 if(h.nightMode==='percent')nh*=1+Number(h.nightValue)/100;
 if(h.nightMode==='fixed')nh+=night/60*Number(h.nightValue);
 if(h.nightMode==='total')nh=night/60*Number(h.nightValue);
 return {hours:totalMin/60,night:night/60,day:day/60,total:normal+nh};
}
let calendarCursor=new Date();calendarCursor.setDate(1);
let selectedCalendarDay='';
function localDayKey(d){const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())}
function renderCalendar(){
 const view=document.getElementById('calendarView')?.value||'month';
 const year=calendarCursor.getFullYear(),month=calendarCursor.getMonth();
 const monthLabel=document.getElementById('calendarMonth');
 const grid=document.getElementById('calendarGrid');
 const today=localDayKey(new Date());\n document.querySelector('.calendar-weekdays').hidden=view==='year';
 const dayButton=date=>{
  const key=localDayKey(date),shifts=db.shifts.filter(s=>s.start.slice(0,10)===key);
  const hours=shifts.reduce((sum,s)=>sum+calc(s).hours,0);
  const classes=['cal-day',shifts.length?'has-shifts':'',key===today?'today':'',key===selectedCalendarDay?'selected':''].filter(Boolean).join(' ');
  return '<button type="button" class="'+classes+'" data-calendar-day="'+key+'" aria-label="'+date.getDate()+' de '+date.toLocaleDateString('pt-BR',{month:'long'})+', '+shifts.length+' plantões"><strong>'+date.getDate()+'</strong><span class="cal-count">'+(shifts.length?shifts.length+' plantão(s) · '+hours.toLocaleString('pt-BR',{maximumFractionDigits:1})+' h':'')+'</span></button>';
 };
 if(view==='year'){
  monthLabel.textContent=String(year);
  const months=Array.from({length:12},(_,i)=>{
   const key=year+'-'+String(i+1).padStart(2,'0'),items=db.shifts.filter(s=>s.start.slice(0,7)===key);
   const hours=items.reduce((sum,s)=>sum+calc(s).hours,0),amount=items.reduce((sum,s)=>sum+calc(s).total,0);
   return '<button type="button" class="year-month" data-calendar-month="'+i+'"><strong>'+new Date(year,i,1).toLocaleDateString('pt-BR',{month:'long'})+'</strong><span>'+items.length+' plantão(ões) · '+hours.toLocaleString('pt-BR',{maximumFractionDigits:1})+' h</span><span>'+money(amount)+'</span></button>';
  });
  grid.className='year-grid';grid.innerHTML=months.join('');
 }else{
  grid.className='calendar-grid';
  if(view==='week'){
   const base=selectedCalendarDay?new Date(selectedCalendarDay+'T12:00:00'):new Date(calendarCursor);
   const first=new Date(base);first.setDate(base.getDate()-base.getDay());
   const last=new Date(first);last.setDate(first.getDate()+6);
   monthLabel.textContent=first.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})+' – '+last.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
   grid.innerHTML=Array.from({length:7},(_,i)=>{const d=new Date(first);d.setDate(first.getDate()+i);return dayButton(d)}).join('');
  }else{
   monthLabel.textContent=calendarCursor.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
   const first=new Date(year,month,1),count=new Date(year,month+1,0).getDate();
   const cells=Array(first.getDay()).fill('<div class="cal-blank" aria-hidden="true"></div>');
   for(let day=1;day<=count;day++)cells.push(dayButton(new Date(year,month,day)));
   grid.innerHTML=cells.join('');
  }
 }
 const details=document.getElementById('calendarDayDetails');
 if(!selectedCalendarDay){details.textContent='Selecione um dia para ver os plantões.';return}
 const shifts=db.shifts.filter(s=>s.start.slice(0,10)===selectedCalendarDay);
 if(!shifts.length){details.textContent='Nenhum plantão em '+new Date(selectedCalendarDay+'T12:00:00').toLocaleDateString('pt-BR')+'.';return}
 details.innerHTML='<b>'+new Date(selectedCalendarDay+'T12:00:00').toLocaleDateString('pt-BR',{dateStyle:'full'})+'</b><br>'+shifts.map(s=>{const h=db.hospitals.find(x=>x.id===s.hospitalId);return esc(h?.name||'Hospital removido')+' · '+dateFmt(s.start)+' · '+money(calc(s).total)}).join('<br>');
}
function render(){
 document.getElementById('nightStart').value=db.nightStart;document.getElementById('nightEnd').value=db.nightEnd;
 let opts=db.hospitals.map(h=>`<option value="${h.id}">${esc(h.name)} — ${money(h.dayRate)}/h</option>`).join('');
 document.getElementById('shiftHospital').innerHTML=opts||'<option value="">Cadastre um hospital</option>';
 document.getElementById('hospitalTable').innerHTML=db.hospitals.length?`<table><thead><tr><th>Instituição</th><th>Hora diurna</th><th>Regra noturna</th><th></th></tr></thead><tbody>${db.hospitals.map(h=>`<tr><td><b>${esc(h.name)}</b><br><span class="note">${esc(h.address||'')}</span>${h.modalities?.length?'<br><span class="note">'+h.modalities.map(esc).join(' · ')+'</span>':''}</td><td>${money(h.dayRate)}</td><td>${nightLabel(h)}</td><td><div class="actions"><button class="btn small" data-action="edit-hospital" data-id="${esc(h.id)}">Editar</button><button class="btn small danger" data-action="delete-hospital" data-id="${esc(h.id)}">Excluir</button></div></td></tr>`).join('')}</tbody></table>`:'<p class="empty">Nenhum hospital cadastrado.</p>';
 let totalH=0,total=0,paid=0;db.shifts.forEach(s=>{let c=calc(s);totalH+=c.hours;total+=c.total;if(s.status==='Recebido')paid+=c.total});
 document.getElementById('mHoras').textContent=(totalH).toLocaleString('pt-BR',{maximumFractionDigits:1})+' h';
 document.getElementById('mQtd').textContent=db.shifts.length;
 document.getElementById('mPrev').textContent=money(total);
 document.getElementById('mPago').textContent=money(paid);
 document.getElementById('resumoHosp').innerHTML=db.hospitals.map(h=>{let ss=db.shifts.filter(s=>s.hospitalId===h.id),v=ss.reduce((a,s)=>a+calc(s).total,0),hrs=ss.reduce((a,s)=>a+calc(s).hours,0);return `<p><b>${esc(h.name)}</b> — ${hrs.toLocaleString('pt-BR',{maximumFractionDigits:1})} h <span class="total">${money(v)}</span></p>`}).join('')||'<p class="empty">Cadastre um hospital para começar.</p>';
 let recent=[...db.shifts].sort((a,b)=>b.start.localeCompare(a.start)).slice(0,5);
 document.getElementById('ultimos').innerHTML=recent.length?`<table><tbody>${recent.map(s=>{let h=db.hospitals.find(x=>x.id===s.hospitalId);return `<tr><td>${dateFmt(s.start)}</td><td>${esc(h?.name||'Hospital removido')}</td><td>${money(calc(s).total)}</td></tr>`}).join('')}</tbody></table>`:'<p class="empty">Nenhum plantão registrado.</p>';
 let months=[...new Set(db.shifts.map(s=>s.start.slice(0,7)))].sort().reverse(),filter=document.getElementById('filterMonth'),old=filter.value;
 filter.innerHTML='<option value="all">Todos os meses</option>'+months.map(m=>`<option value="${m}">${m.split('-').reverse().join('/')}</option>`).join('');if(months.includes(old))filter.value=old;
 let shown=db.shifts.filter(s=>filter.value==='all'||s.start.slice(0,7)===filter.value).sort((a,b)=>b.start.localeCompare(a.start));
 document.getElementById('shiftTable').innerHTML=shown.length?`<table><thead><tr><th>Início</th><th>Hospital</th><th>Horas</th><th>Noturnas</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody>${shown.map(s=>{let h=db.hospitals.find(x=>x.id===s.hospitalId),c=calc(s);return `<tr><td>${dateFmt(s.start)}<br><span class="note">${dateFmt(s.end)}</span></td><td>${esc(h?.name||'—')}</td><td>${c.hours.toFixed(1)}</td><td>${c.night.toFixed(1)}</td><td><b>${money(c.total)}</b></td><td>${esc(s.status)}</td><td><div class="actions"><button class="btn small" data-action="edit-shift" data-id="${esc(s.id)}">Editar</button><button class="btn small danger" data-action="delete-shift" data-id="${esc(s.id)}">Excluir</button></div></td></tr>`}).join('')}</tbody></table>`:'<p class="empty">Nenhum plantão neste filtro.</p>';
 renderCalendar();
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function nightLabel(h){return h.nightMode==='none'?'Sem adicional':h.nightMode==='percent'?`+${h.nightValue}%`:h.nightMode==='fixed'?`+${money(h.nightValue)}/h`:`${money(h.nightValue)}/h total`}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.section').forEach(x=>x.classList.toggle('active',x.id===b.dataset.tab))});
document.getElementById('hospitalForm').onsubmit=e=>{e.preventDefault();let hid=document.getElementById('hospitalId').value,obj={id:hid||id(),name:document.getElementById('hospitalName').value.trim(),dayRate:Number(document.getElementById('dayRate').value),nightMode:document.getElementById('nightMode').value,nightValue:Number(document.getElementById('nightValue').value||0),address:document.getElementById('hospitalAddress').value.trim(),modalities:document.getElementById('hospitalModalities').value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,20)};if(hid)db.hospitals=db.hospitals.map(x=>x.id===hid?obj:x);else db.hospitals.push(obj);e.target.reset();document.getElementById('hospitalId').value='';document.getElementById('hospitalTitle').textContent='Cadastrar hospital';save()};
window.editHospital=hid=>{let h=db.hospitals.find(x=>x.id===hid);document.getElementById('hospitalId').value=h.id;document.getElementById('hospitalName').value=h.name;document.getElementById('hospitalAddress').value=h.address||'';document.getElementById('hospitalModalities').value=(h.modalities||[]).join(', ');document.getElementById('dayRate').value=h.dayRate;document.getElementById('nightMode').value=h.nightMode;document.getElementById('nightValue').value=h.nightValue;document.getElementById('hospitalTitle').textContent='Editar hospital';document.querySelector('[data-tab="hospitais"]').click()};
window.deleteHospital=hid=>{if(db.shifts.some(s=>s.hospitalId===hid)){alert('Este hospital possui plantões. Edite ou exclua os plantões antes de remover.');return}if(confirm('Excluir este hospital?')){db.hospitals=db.hospitals.filter(h=>h.id!==hid);save()}};
document.getElementById('cancelHospital').onclick=()=>{document.getElementById('hospitalForm').reset();document.getElementById('hospitalId').value='';document.getElementById('hospitalTitle').textContent='Cadastrar hospital'};
document.getElementById('saveGeneral').onclick=()=>{db.nightStart=document.getElementById('nightStart').value;db.nightEnd=document.getElementById('nightEnd').value;save();alert('Horário noturno salvo.')};
document.getElementById('shiftForm').onsubmit=e=>{e.preventDefault();let sid=document.getElementById('shiftId').value,s={id:sid||id(),hospitalId:document.getElementById('shiftHospital').value,start:document.getElementById('start').value,end:document.getElementById('end').value,breakMins:Number(document.getElementById('breakMins').value||0),status:document.getElementById('status').value,notes:document.getElementById('notes').value};if(new Date(s.end)<=new Date(s.start)){alert('O término deve ser posterior ao início.');return}if(sid)db.shifts=db.shifts.map(x=>x.id===sid?s:x);else db.shifts.push(s);clearShift();save()};
function clearShift(){document.getElementById('shiftForm').reset();document.getElementById('shiftId').value='';document.getElementById('breakMins').value=0;document.getElementById('formTitle').textContent='Adicionar plantão'}
document.getElementById('cancelEdit').onclick=clearShift;
window.editShift=sid=>{let s=db.shifts.find(x=>x.id===sid);document.getElementById('shiftId').value=s.id;document.getElementById('shiftHospital').value=s.hospitalId;document.getElementById('start').value=s.start;document.getElementById('end').value=s.end;document.getElementById('breakMins').value=s.breakMins;document.getElementById('status').value=s.status;document.getElementById('notes').value=s.notes||'';document.getElementById('formTitle').textContent='Editar plantão';document.querySelector('[data-tab="plantoes"]').click()};
window.deleteShift=sid=>{if(confirm('Excluir este plantão?')){db.shifts=db.shifts.filter(s=>s.id!==sid);save()}};
document.getElementById('filterMonth').onchange=render;
document.getElementById('exportBtn').onclick=()=>{let blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='backup-plantao-control.json';a.click();URL.revokeObjectURL(a.href)};
document.getElementById('importFile').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{if(f.size>5*1024*1024)throw Error('O backup excede o limite de 5 MB.');const x=normalizeDB(JSON.parse(await f.text()));if(!confirm('Substituir os dados atuais por '+x.hospitals.length+' hospital(is) e '+x.shifts.length+' plantão(ões) deste backup?'))return;db=x;save();alert('Backup validado e importado com sucesso.')}catch(err){alert(err.message==='Unexpected end of JSON input'?'Arquivo JSON incompleto.':err.message||'Arquivo de backup inválido.')}finally{e.target.value=''}};

// PWA: cache local para abrir o aplicativo mesmo sem internet depois da primeira visita.
if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

// Google Calendar OAuth (somente leitura). Configure o Client ID no Google Cloud Console.
const savedClientId=localStorage.getItem('plantao-google-client-id')||'';
document.getElementById('googleClientId').value=savedClientId;
document.getElementById('googleClientId').addEventListener('change',e=>localStorage.setItem('plantao-google-client-id',e.target.value.trim()));
let googleAccessToken = null;
let googleTokenClient = null;
const calStatus = msg => { const el=document.getElementById('calendarStatus'); if(el) el.textContent=msg; };
function loadGoogleIdentity(){
 return new Promise((resolve,reject)=>{
  if(window.google?.accounts?.oauth2){resolve();return}
  const existing=document.querySelector('script[data-google-identity]');
  if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(Error('Não foi possível carregar a autenticação Google.')),{once:true});return}
  const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.defer=true;s.dataset.googleIdentity='true';
  s.onload=resolve;s.onerror=()=>reject(Error('Não foi possível carregar a autenticação Google.'));document.head.appendChild(s);
 });
}
document.getElementById('connectGoogle').onclick=async()=>{
 const clientId=document.getElementById('googleClientId').value.trim();
 if(!clientId.endsWith('.apps.googleusercontent.com')){calStatus('Informe um OAuth Client ID válido, criado no Google Cloud.');return}
 try{
  calStatus('Abrindo autorização do Google…');await loadGoogleIdentity();
  googleTokenClient=google.accounts.oauth2.initTokenClient({
   client_id:clientId,scope:'https://www.googleapis.com/auth/calendar.events.readonly',
   callback: tokenResponse=>{
    if(tokenResponse.error){calStatus('Autorização não concluída: '+tokenResponse.error);return}
    googleAccessToken=tokenResponse.access_token;
    document.getElementById('importCalendar').disabled=false;
    calStatus('Google Agenda conectado nesta sessão. Agora escolha o período e importe os eventos.');
   }
  });
  googleTokenClient.requestAccessToken({prompt:'consent'});
 }catch(e){calStatus(e.message)}
};
document.getElementById('disconnectGoogle').onclick=async()=>{
 const token=googleAccessToken;
 googleAccessToken=null;googleTokenClient=null;document.getElementById('importCalendar').disabled=true;
 if(token && window.google?.accounts?.oauth2){
  try{await new Promise(resolve=>google.accounts.oauth2.revoke(token,resolve));calStatus('Acesso Google revogado e removido desta sessão.');}
  catch{calStatus('Token removido desta sessão. Não foi possível confirmar a revogação no Google; remova o acesso também na sua Conta Google.');}
 }else calStatus('Token removido desta sessão. Se quiser revogar a autorização concedida, remova Plantão Control nas permissões da sua Conta Google.');
};
document.getElementById('importCalendar').onclick=async()=>{
 if(!googleAccessToken){calStatus('Conecte sua conta Google primeiro.');return}
 const from=document.getElementById('calFrom').value,to=document.getElementById('calTo').value;
 if(!from||!to||to<from){calStatus('Escolha um período válido.');return}
 try{
  calStatus('Buscando eventos…');
  const baseParams={timeMin:new Date(from+'T00:00:00').toISOString(),timeMax:new Date(to+'T23:59:59').toISOString(),singleEvents:'true',orderBy:'startTime',maxResults:'2500'};
  let pageToken='',added=0,skipped=0,pages=0;const pending=[];
  do{
   const params=new URLSearchParams(baseParams);if(pageToken)params.set('pageToken',pageToken);
   const response=await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?'+params,{headers:{Authorization:'Bearer '+googleAccessToken}});
   if(!response.ok){if(response.status===401){googleAccessToken=null;googleTokenClient=null;document.getElementById('importCalendar').disabled=true;}throw Error(response.status===401?'A autorização expirou. Conecte novamente sua conta Google.':'Google Calendar respondeu '+response.status+'. Tente novamente.')}
   const data=await response.json();pages++;
   for(const ev of (data.items||[])){
    if(!ev.id||!ev.start?.dateTime||!ev.end?.dateTime){skipped++;continue}
    if(db.shifts.some(s=>s.googleEventId===ev.id)||pending.some(s=>s.googleEventId===ev.id)){skipped++;continue}
    const title=(ev.summary||'').trim().toLocaleLowerCase('pt-BR');
    if(!title){skipped++;continue}
    const hospital=db.hospitals.find(h=>{
     const name=String(h.name||'').trim().toLocaleLowerCase('pt-BR');
     return name && title.includes(name);
    });
    if(!hospital){skipped++;continue}
    const start=new Date(ev.start.dateTime),end=new Date(ev.end.dateTime);
    if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start){skipped++;continue}
    const localValue=d=>{const pad=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes())};
    pending.push({id:id(),hospitalId:hospital.id,start:localValue(start),end:localValue(end),breakMins:0,status:'Pendente',notes:'Importado do Google Agenda: '+String(ev.summary||'').slice(0,900),googleEventId:ev.id});
    added++;
   }
   pageToken=data.nextPageToken||'';
  }while(pageToken && pages<100);
  db.shifts.push(...pending);save();calStatus(`${added} evento(s) importado(s); ${skipped} ignorado(s). ${pages} página(s) consultada(s). ${pageToken?'Limite de 100 páginas atingido; repita a importação para continuar. ':''}Eventos sem horário ou sem nome de hospital correspondente não foram importados.`);
 }catch(e){calStatus(e.message)}
};
document.getElementById('calendarView').onchange=()=>renderCalendar();\ndocument.getElementById('calendarPrev').onclick=()=>{const v=document.getElementById('calendarView').value;if(v==='week')calendarCursor.setDate(calendarCursor.getDate()-7);else if(v==='year')calendarCursor.setFullYear(calendarCursor.getFullYear()-1);else calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);selectedCalendarDay='';renderCalendar()};
document.getElementById('calendarNext').onclick=()=>{const v=document.getElementById('calendarView').value;if(v==='week')calendarCursor.setDate(calendarCursor.getDate()+7);else if(v==='year')calendarCursor.setFullYear(calendarCursor.getFullYear()+1);else calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);selectedCalendarDay='';renderCalendar()};
document.addEventListener('click',event=>{
 const dayButton=event.target.closest('[data-calendar-day]');
 if(dayButton){selectedCalendarDay=dayButton.dataset.calendarDay;calendarCursor=new Date(selectedCalendarDay+'T12:00:00');renderCalendar();return}\n const monthButton=event.target.closest('[data-calendar-month]');if(monthButton){calendarCursor=new Date(calendarCursor.getFullYear(),Number(monthButton.dataset.calendarMonth),1);document.getElementById('calendarView').value='month';selectedCalendarDay='';renderCalendar();return}
 const button=event.target.closest('[data-action]');if(!button)return;
 const targetId=button.dataset.id;
 switch(button.dataset.action){
  case 'edit-hospital':editHospital(targetId);break;
  case 'delete-hospital':deleteHospital(targetId);break;
  case 'edit-shift':editShift(targetId);break;
  case 'delete-shift':deleteShift(targetId);break;
 }
});
function checkUpcomingShiftAlerts(){
 const status=document.getElementById('shiftAlertStatus');if(!status)return;
 if(!('Notification' in window)){status.textContent='Este navegador não oferece notificações. Consulte o calendário para acompanhar os próximos plantões.';return}
 if(Notification.permission!=='granted'){status.textContent='Ative as notificações para receber avisos neste dispositivo enquanto o aplicativo estiver aberto.';return}
 const now=new Date(),limit=new Date(now.getTime()+24*60*60*1000);
 const upcoming=db.shifts.filter(s=>s.status==='Pendente'&&new Date(s.start)>now&&new Date(s.start)<=limit);
 let sent=0;
 for(const shift of upcoming){
  const key='plantao-alerted:'+shift.id+':'+localDayKey(new Date());
  if(localStorage.getItem(key))continue;
  const hospital=db.hospitals.find(h=>h.id===shift.hospitalId);
  try{
   new Notification('Plantão nas próximas 24 horas',{body:(hospital?.name||'Plantão')+' começa em '+dateFmt(shift.start),icon:'./icon-192.png',tag:'plantao-'+shift.id});
   localStorage.setItem(key,'1');sent++;
  }catch(error){console.warn('Não foi possível exibir o lembrete:',error)}
 }
 status.textContent=upcoming.length?upcoming.length+' plantão(ões) próximo(s). '+(sent?sent+' aviso(s) enviado(s).':'Os avisos já foram exibidos neste período.'):'Nenhum plantão pendente nas próximas 24 horas.';
}
document.getElementById('enableShiftAlerts').onclick=async()=>{
 const status=document.getElementById('shiftAlertStatus');
 if(!('Notification' in window)){status.textContent='Notificações não são compatíveis com este navegador.';return}
 try{
  const permission=await Notification.requestPermission();
  status.textContent=permission==='granted'?'Notificações ativadas neste dispositivo.':'Permissão de notificação não concedida.';
  if(permission==='granted')checkUpcomingShiftAlerts();
 }catch(error){status.textContent='O navegador não permitiu ativar notificações neste momento.';console.warn(error)}
};
render();
checkUpcomingShiftAlerts();
setInterval(checkUpcomingShiftAlerts,10*60*1000);