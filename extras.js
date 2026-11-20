/* Plantonices — ferramentas complementares. Sem dependências externas. */
(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const money = n => Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const safeName = s => String(s||'arquivo').replace(/[\\/:*?"<>|]+/g,'_').slice(0,100);
  const download = (name, blob) => {
    const url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download=safeName(name); a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const toolsNav = document.querySelector('nav');
  const toolsButton = document.createElement('button');
  toolsButton.type='button'; toolsButton.dataset.tab='ferramentas'; toolsButton.textContent='Ferramentas';
  toolsNav.append(toolsButton);
  const section=document.createElement('section');
  section.id='ferramentas'; section.className='section';
  section.innerHTML=`
    <div class="card">
      <div class="toolbar"><h2>Ferramentas do Plantonices</h2><span class="tag">Recursos adicionais</span></div>
      <div class="actions" id="toolTabs">
        <button class="btn small primary" data-tool="calc">Calculadoras</button>
        <button class="btn small" data-tool="notes">Lousa e notas</button>
        <button class="btn small" data-tool="files">Fotos, vídeos e documentos</button>
        <button class="btn small" data-tool="web">Web e YouTube</button>
        <button class="btn small" data-tool="export">Exportar</button>
      </div>
    </div>
    <div class="card tool-panel" id="tool-calc">
      <h2>Calculadora de plantão</h2>
      <div class="row">
        <label>Início<input id="toolStart" type="time" value="07:00"></label>
        <label>Término<input id="toolEnd" type="time" value="19:00"></label>
      </div>
      <div class="row">
        <label>Valor por hora (R$)<input id="toolRate" type="number" min="0" step=".01" value="31"></label>
        <label>Quantidade de plantões<input id="toolCount" type="number" min="1" step="1" value="1"></label>
      </div>
      <div class="row">
        <label>Valor fixo por plantão (opcional)<input id="toolFixed" type="number" min="0" step=".01"></label>
        <label>Deduções (%)<input id="toolDeduct" type="number" min="0" max="100" step=".01" value="0"></label>
      </div>
      <button class="btn primary" id="toolShiftCalc">Calcular</button>
      <p id="toolCalcResult" class="note" aria-live="polite">Informe os dados e toque em Calcular.</p>
      <hr>
      <h2>Calculadora comum</h2>
      <label>Expressão<input id="basicExpression" inputmode="decimal" placeholder="Ex.: (120 + 80) / 2"></label>
      <button class="btn primary" id="basicCalculate">Calcular expressão</button>
      <p id="basicResult" class="note" aria-live="polite"></p>
    </div>
    <div class="card tool-panel" id="tool-notes" hidden>
      <h2>Bloco de notas</h2>
      <textarea id="plantonicesNotes" rows="8" placeholder="Anotações pessoais sobre seus plantões (não inclua dados de pacientes)." style="width:100%;padding:12px;border:1px solid #ccd6e1;border-radius:9px;font:inherit"></textarea>
      <div class="actions"><button class="btn primary" id="saveNotes">Salvar notas</button><button class="btn" id="downloadNotes">Baixar TXT</button></div>
      <p class="note" id="notesStatus" aria-live="polite">As notas são armazenadas neste navegador.</p>
      <h2 style="margin-top:20px">Desenho / rascunho</h2>
      <canvas id="notesCanvas" width="900" height="420" style="width:100%;height:210px;background:#111;border-radius:10px;touch-action:none"></canvas>
      <div class="actions"><button class="btn" id="clearCanvas">Limpar desenho</button><button class="btn" id="downloadCanvas">Baixar PNG</button></div>
    </div>
    <div class="card tool-panel" id="tool-files" hidden>
      <h2>Arquivos e mídias</h2>
      <p class="note">Fotos, vídeos, áudios e documentos são guardados no armazenamento deste dispositivo (IndexedDB), fora do limite pequeno do localStorage. Faça backup dos arquivos importantes separadamente. Não armazene imagens ou informações de pacientes.</p>
      <label>Adicionar arquivos<input id="assetInput" type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" /></label>
      <div id="assetList" aria-live="polite"><p class="empty">Nenhum arquivo adicionado.</p></div>
      <div class="actions"><button class="btn" id="recordAudio">Gravar áudio</button><span class="note" id="recordStatus" aria-live="polite">A gravação depende da permissão do microfone e de HTTPS.</span></div>
    </div>
    <div class="card tool-panel" id="tool-web" hidden>
      <h2>Internet e pesquisa</h2>
      <div class="row"><label>Pesquisar ou abrir endereço<input id="webQuery" placeholder="Digite uma pesquisa ou endereço"></label><button class="btn primary" id="webOpen" type="button">Abrir</button></div>
      <div class="actions" id="webShortcuts"></div>
      <h2 style="margin-top:18px">YouTube</h2>
      <div class="row"><label>Buscar vídeos e aulas<input id="youtubeQuery" placeholder="Ex.: tomografia computadorizada"></label><button class="btn primary" id="youtubeSearch" type="button">Buscar</button></div>
      <p class="note">Os sites são abertos em nova aba. Alguns serviços exigem login próprio.</p>
    </div>
    <div class="card tool-panel" id="tool-export" hidden>
      <h2>Exportação e compartilhamento</h2>
      <p class="note">Exporte os plantões em CSV para planilhas ou em ICS para importar eventos e lembretes no Google Agenda, Apple Calendar ou aplicativos compatíveis.</p>
      <div class="actions"><button class="btn primary" id="exportCsv">Exportar CSV</button><button class="btn" id="exportIcs">Exportar calendário (.ics)</button><button class="btn" id="shareSummary">Compartilhar resumo</button></div>
      <p class="note" id="exportStatus" aria-live="polite"></p>
    </div>`;
  document.querySelector('main').insertBefore(section,document.querySelector('footer'));

  function showMainTab(id){
    document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
    document.querySelectorAll('.section').forEach(s=>s.classList.toggle('active',s.id===id));
  }
  toolsButton.addEventListener('click',()=>showMainTab('ferramentas'));
  document.querySelectorAll('nav button[data-tab]').forEach(b=>{
    if(b===toolsButton)return;
    b.addEventListener('click',()=>showMainTab(b.dataset.tab));
  });
  $('#toolTabs').addEventListener('click',e=>{
    const b=e.target.closest('[data-tool]'); if(!b)return;
    $('#toolTabs').querySelectorAll('button').forEach(x=>x.classList.toggle('primary',x===b));
    document.querySelectorAll('.tool-panel').forEach(p=>p.hidden=p.id!=='tool-'+b.dataset.tool);
  });

  const duration=(a,b)=>{if(!a||!b)return 0;let [ah,am]=a.split(':').map(Number),[bh,bm]=b.split(':').map(Number);let n=bh*60+bm-ah*60-am;if(n<=0)n+=1440;return n/60};
  $('#toolShiftCalc').addEventListener('click',()=>{
    const hours=duration($('#toolStart').value,$('#toolEnd').value),rate=Number($('#toolRate').value),count=Number($('#toolCount').value),fixed=Number($('#toolFixed').value),deduct=Number($('#toolDeduct').value);
    if(!Number.isFinite(rate)||rate<0||!Number.isInteger(count)||count<1||count>1000||!Number.isFinite(deduct)||deduct<0||deduct>100){$('#toolCalcResult').textContent='Confira os valores informados.';return}
    const gross=(fixed>0?fixed:hours*rate)*count,net=gross*(1-deduct/100);
    $('#toolCalcResult').innerHTML='Horas por plantão: <b>'+hours.toFixed(2)+' h</b><br>Horas totais: <b>'+(hours*count).toFixed(2)+' h</b><br>Bruto: <b>'+money(gross)+'</b><br>Deduções: <b>'+money(gross-net)+'</b><br>Líquido estimado: <b class="total">'+money(net)+'</b>';
  });

  // Parser aritmético sem eval/Function: somente números, parênteses e operadores básicos.
  function evaluateExpression(input){
    const tokens=input.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/%]/g)||[];
    if(tokens.join('')!==input.replace(/\s+/g,''))throw Error('Use apenas números e operações básicas.');
    let i=0;
    const primary=()=>{const t=tokens[i++];if(t==='('){const v=expr();if(tokens[i++]!==')')throw Error('Parênteses incompletos.');return v}if(t==='+'||t==='-'){const v=primary();return t==='-'?-v:v}const n=Number(t);if(!Number.isFinite(n))throw Error('Expressão inválida.');return n};
    const term=()=>{let v=primary();while(['*','/','%'].includes(tokens[i])){const op=tokens[i++],n=primary();if((op==='/'||op==='%')&&n===0)throw Error('Não é possível dividir por zero.');v=op==='*'?v*n:op==='/'?v/n:v%n}return v};
    const expr=()=>{let v=term();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++],n=term();v=op==='+'?v+n:v-n}return v};
    if(!tokens.length)throw Error('Digite uma expressão.');const result=expr();if(i!==tokens.length||!Number.isFinite(result))throw Error('Expressão inválida.');return result;
  }
  $('#basicCalculate').addEventListener('click',()=>{try{$('#basicResult').textContent='Resultado: '+evaluateExpression($('#basicExpression').value).toLocaleString('pt-BR')}catch(e){$('#basicResult').textContent=e.message}});

  const NOTES_KEY='plantonices-notes-v1';
  $('#plantonicesNotes').value=localStorage.getItem(NOTES_KEY)||'';
  $('#saveNotes').onclick=()=>{try{localStorage.setItem(NOTES_KEY,$('#plantonicesNotes').value);$('#notesStatus').textContent='Notas salvas neste dispositivo.'}catch{$('#notesStatus').textContent='Armazenamento cheio; copie suas notas para outro local.'}};
  $('#downloadNotes').onclick=()=>download('notas-plantonices.txt',new Blob([$('#plantonicesNotes').value],{type:'text/plain;charset=utf-8'}));
  const canvas=$('#notesCanvas'),ctx=canvas.getContext('2d');ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.lineCap='round';let drawing=false;
  const point=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height]};
  canvas.addEventListener('pointerdown',e=>{drawing=true;canvas.setPointerCapture(e.pointerId);const p=point(e);ctx.beginPath();ctx.moveTo(...p)});
  canvas.addEventListener('pointermove',e=>{if(!drawing)return;const p=point(e);ctx.lineTo(...p);ctx.stroke()});
  const stop=()=>drawing=false;canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);
  $('#clearCanvas').onclick=()=>ctx.clearRect(0,0,canvas.width,canvas.height);
  $('#downloadCanvas').onclick=()=>canvas.toBlob(b=>b&&download('rascunho-plantonices.png',b),'image/png');

  const DB_NAME='plantonices-assets',STORE='assets';let assetDb;
  const openDb=()=>new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>req.result.createObjectStore(STORE,{keyPath:'id',autoIncrement:true});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  const dbReady=openDb().then(db=>{assetDb=db;return refreshAssets()}).catch(()=>{$('#assetList').textContent='O armazenamento de arquivos não está disponível neste navegador.'});
  const txStore=(mode,fn)=>new Promise((resolve,reject)=>{const tx=assetDb.transaction(STORE,mode),store=tx.objectStore(STORE);let req;try{req=fn(store)}catch(e){reject(e);return}tx.oncomplete=()=>resolve(req?.result);tx.onerror=()=>reject(tx.error)});
  async function refreshAssets(){
    if(!assetDb)return;const list=await txStore('readonly',s=>s.getAll());
    $('#assetList').innerHTML=list.length?list.map(a=>'<div class="row" data-asset="'+a.id+'"><div style="min-width:0;flex:1"><b>'+escapeHtml(a.name)+'</b><div class="note">'+escapeHtml(a.type||'arquivo')+' · '+(a.size/1024/1024).toFixed(2)+' MB</div><div class="asset-preview"></div></div><button class="btn small" data-download="'+a.id+'">Baixar</button><button class="btn small danger" data-delete="'+a.id+'">Excluir</button></div>').join(''):'<p class="empty">Nenhum arquivo adicionado.</p>';
    for(const a of list){if(a.type?.startsWith('image/')){const img=document.createElement('img');img.alt=a.name;img.style.maxWidth='100px';img.style.maxHeight='80px';img.src=URL.createObjectURL(a.blob);$('[data-asset="'+a.id+'"] .asset-preview').append(img)}}
  }
  const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  $('#assetInput').addEventListener('change',async e=>{
    await dbReady;const files=[...e.target.files];e.target.value='';
    for(const f of files){if(f.size>50*1024*1024){alert(f.name+' excede o limite de 50 MB.');continue}try{await txStore('readwrite',s=>s.add({name:f.name,type:f.type,size:f.size,blob:f,createdAt:Date.now()}))}catch{alert('Não foi possível guardar '+f.name+'. Verifique o espaço disponível.')}}
    await refreshAssets();
  });
  $('#assetList').addEventListener('click',async e=>{
    const del=e.target.closest('[data-delete]'),get=e.target.closest('[data-download]');
    if(del){await txStore('readwrite',s=>s.delete(Number(del.dataset.delete)));await refreshAssets()}
    if(get){const item=await txStore('readonly',s=>s.get(Number(get.dataset.download)));if(item)download(item.name,item.blob)}
  });
  let recorder=null,recordStream=null,chunks=[];
  $('#recordAudio').onclick=async()=>{
    if(recorder?.state==='recording'){recorder.stop();$('#recordStatus').textContent='Finalizando gravação…';return}
    try{
      if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Gravação não suportada. Use o seletor de arquivos para anexar um áudio.');
      recordStream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];
      recorder=new MediaRecorder(recordStream);recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
      recorder.onstop=async()=>{recordStream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});await txStore('readwrite',s=>s.add({name:'gravacao-'+Date.now()+'.webm',type:blob.type,size:blob.size,blob,createdAt:Date.now()}));await refreshAssets();$('#recordStatus').textContent='Gravação salva.'};
      recorder.start();$('#recordStatus').textContent='Gravando… toque novamente para parar.';
    }catch(e){$('#recordStatus').textContent=e.message||'Não foi possível acessar o microfone.'}
  };

  const shortcuts=[['Google','https://www.google.com'],['Gmail','https://mail.google.com'],['Google Agenda','https://calendar.google.com'],['Drive','https://drive.google.com'],['Maps','https://maps.google.com'],['PubMed','https://pubmed.ncbi.nlm.nih.gov'],['UpToDate','https://www.uptodate.com']];
  $('#webShortcuts').innerHTML=shortcuts.map(([n,u])=>'<a class="btn small" target="_blank" rel="noopener noreferrer" href="'+u+'">'+n+'</a>').join('');
  $('#webOpen').onclick=()=>{const q=$('#webQuery').value.trim();if(!q)return;const url=/^https?:\/\//i.test(q)?q:/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(q)?'https://'+q:'https://www.google.com/search?q='+encodeURIComponent(q);window.open(url,'_blank','noopener,noreferrer')};
  $('#youtubeSearch').onclick=()=>{const q=$('#youtubeQuery').value.trim();if(q)window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(q),'_blank','noopener,noreferrer')};

  const getShifts=()=>{try{return JSON.parse(localStorage.getItem('plantao-control-v1')||'{}').shifts||[]}catch{return []}};
  const getHospitals=()=>{try{return JSON.parse(localStorage.getItem('plantao-control-v1')||'{}').hospitals||[]}catch{return []}};
  $('#exportCsv').onclick=()=>{
    const shifts=getShifts(),hospitals=getHospitals(),rows=[['Data','Início','Término','Horas','Hospital','Status','Observações']];
    for(const s of shifts){const h=hospitals.find(x=>x.id===s.hospitalId);const hours=(new Date(s.end)-new Date(s.start))/3600000;rows.push([new Date(s.start).toLocaleString('pt-BR'),s.start,s.end,hours.toFixed(2).replace('.',','),h?.name||'Hospital removido',s.status,s.notes||''])}
    const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
    download('plantoes-plantonices.csv',new Blob([csv],{type:'text/csv;charset=utf-8'}));
  };
  $('#exportIcs').onclick=()=>{
    const shifts=getShifts(),hospitals=getHospitals();let out=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Plantonices//PT-BR'];
    const fmt=d=>new Date(d).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
    for(const s of shifts){const h=hospitals.find(x=>x.id===s.hospitalId);out.push('BEGIN:VEVENT','UID:'+s.id+'@plantonices','DTSTAMP:'+fmt(new Date()),'DTSTART:'+fmt(s.start),'DTEND:'+fmt(s.end),'SUMMARY:'+('Plantão - '+(h?.name||'Hospital')).replace(/[\\,;]/g,'\\$&'),'DESCRIPTION:Plantão registrado no Plantonices','BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY','DESCRIPTION:Plantão amanhã','END:VALARM','END:VEVENT')}
    out.push('END:VCALENDAR');download('plantoes-plantonices.ics',new Blob([out.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}));
  };
  $('#shareSummary').onclick=async()=>{
    const shifts=getShifts(),hospitals=getHospitals(),hours=shifts.reduce((a,s)=>a+(new Date(s.end)-new Date(s.start))/3600000,0);
    const text='Resumo Plantonices: '+shifts.length+' plantão(ões), '+hours.toLocaleString('pt-BR',{maximumFractionDigits:1})+' horas registradas.';
    try{if(navigator.share)await navigator.share({title:'Resumo Plantonices',text});else if(navigator.clipboard){await navigator.clipboard.writeText(text);$('#exportStatus').textContent='Resumo copiado para a área de transferência.'}else $('#exportStatus').textContent=text}catch(e){if(e.name!=='AbortError')$('#exportStatus').textContent=text}
  };
})();