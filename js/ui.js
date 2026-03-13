// ══════════════════════════════════
// CHAT UI
// ══════════════════════════════════
function addDeployBtn() {
  const mc = document.getElementById('msgs');
  const d = document.createElement('div');
  d.style.cssText = 'display:flex;justify-content:center;padding:4px 0';
  d.innerHTML = `<button onclick="openModal('deploy-ov')" style="display:flex;align-items:center;gap:7px;padding:9px 18px;border-radius:9999px;background:rgba(168,85,247,0.12);border:1px solid rgba(168,85,247,0.3);color:#a855f7;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s" onmouseover="this.style.background='rgba(168,85,247,0.2)'" onmouseout="this.style.background='rgba(168,85,247,0.12)'">🚀 Guida Deploy Fullstack</button>`;
  mc.appendChild(d); d.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function showChat() { document.getElementById('empty-st').style.display='none'; document.getElementById('msgs').style.display='flex'; }

function renderBbl(role,text,scroll=true) {
  const c=document.getElementById('msgs'), d=document.createElement('div');
  d.className=`bbl ${role}`;
  const now=new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  const html=text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
  d.innerHTML=`<div class="bbl-av">${role==='user'?'👤':'⚡'}</div><div class="bbl-body"><div class="bbl-text">${html}</div><div class="bbl-time">${now}</div></div>`;
  c.appendChild(d); if(scroll) d.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function addLog(type,icon,name,desc) {
  const c=document.getElementById('msgs'),d=document.createElement('div');
  d.className=`alog ${type}`;
  d.innerHTML=`<div class="alog-ic">${icon}</div><div class="alog-body"><div class="alog-name">${name}</div><div class="alog-desc">${desc}</div></div>`;
  c.appendChild(d); d.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function saveMsg(role,text){if(!S.cur)return;if(!S.cur.msgs)S.cur.msgs=[];S.cur.msgs.push({role,text});save();}

function activateChip(id){document.getElementById('c-'+id)?.classList.add('on');}
function deactivateChip(id){document.getElementById('c-'+id)?.classList.remove('on');}

function useSug(el){document.getElementById('chat-ta').value=el.querySelector('.sug-text').textContent;document.getElementById('chat-ta').focus();}

// ══════════════════════════════════
// FILES
// ══════════════════════════════════

function showFile(fn) {
  if(!S.cur||!S.cur.files[fn])return;
  S.curFile=fn; const code=S.cur.files[fn];
  const pre=document.getElementById('code-pre'), em=document.getElementById('code-empty');
  pre.textContent=code; pre.style.display='block'; em.style.display='none';
  document.getElementById('lang-badge').textContent=flang(fn);
  document.getElementById('lineinfo').textContent=`${code.split('\n').length} righe · ${(code.length/1024).toFixed(1)}kb`;
  document.querySelectorAll('.ftab').forEach(t=>t.classList.toggle('on',t.dataset.f===fn));
  document.querySelectorAll('.file-row').forEach(r=>r.classList.toggle('on',r.dataset.f===fn));
}

function updateVerTab() {
  const btn = document.getElementById('rt-versions');
  if (!btn) return;
  const count = S.cur?.versions?.length || 0;
  btn.textContent = '🕐 Versioni' + (count > 0 ? ' ('+count+')' : '');
}


function updateFileTabs() {
  const bar=document.getElementById('file-bar');
  if(!S.cur){bar.classList.remove('show');return;}
  const ff=Object.keys(S.cur.files||{});
  if(!ff.length){bar.classList.remove('show');return;}
  bar.classList.add('show');
  bar.innerHTML=ff.map(f=>`<div class="ftab ${S.curFile===f?'on':''}" data-f="${f}" onclick="showFile('${f}');switchTab('code')">${ficon(f)} ${f}</div>`).join('');
}

function updateFilesList() {
  const list=document.getElementById('flist'), cnt=document.getElementById('fcount');
  if(!S.cur){list.innerHTML='<div style="padding:24px;text-align:center;color:rgba(255,255,255,0.2);font-size:13px;">Nessun file</div>';return;}
  const ff=Object.keys(S.cur.files||{});
  cnt.textContent=`${ff.length} file`;
  if(!ff.length){list.innerHTML='<div style="padding:24px;text-align:center;color:rgba(255,255,255,0.2);font-size:13px;">Nessun file generato</div>';return;}
  list.innerHTML=ff.map(f=>`<div class="file-row ${S.curFile===f?'on':''}" data-f="${f}" onclick="showFile('${f}');switchTab('code')"><div class="file-ico">${ficon(f)}</div><span class="file-nm">${f}</span><span class="file-sz">${(S.cur.files[f].length/1024).toFixed(1)}kb</span></div>`).join('');
}

// ══════════════════════════════════
// PREVIEW
// ══════════════════════════════════
function updatePrev(html){
  document.getElementById('prev-empty').style.display='none';
  document.getElementById('prev-framework')?.remove();
  const f=document.getElementById('prev-frame'); f.style.display='block'; f.srcdoc=html;
  document.getElementById('curl').textContent=(S.cur?.name||'app')+' · localhost';
}

function showFrameworkPreview() {
  document.getElementById('prev-empty').style.display='none';
  document.getElementById('prev-frame').style.display='none';
  // Remove old banner if present
  document.getElementById('prev-framework')?.remove();
  const kind = getProjectKind();
  const labels = {
    'vite-react': { icon:'⚛️', name:'Vite + React', cmd:'npm run dev', build:'npm run build', deploy:'Vercel, Netlify o GitHub Pages (con build)' },
    'nextjs':     { icon:'▲',  name:'Next.js',      cmd:'npm run dev', build:'npm run build && npm run export', deploy:'Vercel (consigliato) o Netlify' },
    'node-express':{ icon:'🟢', name:'Node + Express', cmd:'npm start',  build:'(nessuno)', deploy:'Railway, Render, Fly.io, Heroku' },
    'node':       { icon:'📦', name:'Node.js',       cmd:'npm start',  build:'npm run build', deploy:'Railway, Render, Fly.io' }
  };
  const info = labels[kind] || labels['node'];
  const fileCount = Object.keys(S.cur?.files || {}).length;
  const panel = document.getElementById('p-preview');
  const div = document.createElement('div');
  div.id = 'prev-framework';
  div.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px;text-align:center;gap:14px;';
  div.innerHTML = `
    <div style="width:64px;height:64px;border-radius:18px;background:rgba(58,134,255,0.1);border:1px solid rgba(58,134,255,0.2);display:flex;align-items:center;justify-content:center;font-size:28px;">${info.icon}</div>
    <div style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;color:#fff;">Progetto ${info.name}</div>
    <div style="font-size:13px;color:#A1A1AA;max-width:360px;line-height:1.6;">
      Questo progetto ha <strong style="color:#fff">${fileCount} file</strong> sorgente e richiede un <strong style="color:#3A86FF">build step</strong> per funzionare.<br>
      Non puo' essere visualizzato in preview diretta.
    </div>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px 18px;text-align:left;width:100%;max-width:360px;font-size:12px;line-height:1.8;color:#A1A1AA;">
      <div style="font-family:'Outfit',sans-serif;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:6px;">Come eseguire</div>
      <div><span style="color:#FF9F1C">1.</span> Scarica i file → <strong style="color:#fff;cursor:pointer" onclick="dlProject()">↓ Scarica tutto</strong></div>
      <div><span style="color:#FF9F1C">2.</span> <code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:11px;">npm install</code></div>
      <div><span style="color:#FF9F1C">3.</span> <code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:11px;">${info.cmd}</code></div>
      ${info.build !== '(nessuno)' ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.06);"><span style="color:#3A86FF">Build:</span> <code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:11px;">${info.build}</code></div>` : ''}
      <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.06);"><span style="color:#10B981">Deploy:</span> ${info.deploy}</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:4px;">
      <button onclick="dlProject()" style="padding:8px 16px;border-radius:9999px;border:1px solid rgba(255,159,28,0.25);background:rgba(255,159,28,0.1);color:#FF9F1C;font-family:'Outfit',sans-serif;font-size:12px;font-weight:600;cursor:pointer;">↓ Scarica progetto</button>
      <button onclick="switchTab('code')" style="padding:8px 16px;border-radius:9999px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#A1A1AA;font-family:'Outfit',sans-serif;font-size:12px;font-weight:500;cursor:pointer;">Vedi codice</button>
    </div>`;
  panel.appendChild(div);
  document.getElementById('curl').textContent = (S.cur?.name||'app') + ' · ' + info.name + ' (sorgente)';
}
function clearPrev(){document.getElementById('prev-empty').style.display='flex';const f=document.getElementById('prev-frame');f.style.display='none';document.getElementById('curl').textContent='nessuna app generata';}
function clearEd(){document.getElementById('code-pre').style.display='none';document.getElementById('code-empty').style.display='flex';}
function refreshPrev(){if(needsBuild()){showFrameworkPreview();return;}if(S.curFile&&S.cur?.files[S.curFile])updatePrev(S.cur.files[S.curFile]);}

// ══════════════════════════════════
// TABS
// ══════════════════════════════════
function switchTab(id) {
  ['preview','code','files','versions','jobs','sandbox'].forEach(t=>{
    const rt=document.getElementById('rt-'+t), p=document.getElementById('p-'+t);
    if(rt) rt.classList.remove('on');
    if(p) p.classList.remove('on');
  });
  document.getElementById('rt-'+id)?.classList.add('on');
  document.getElementById('p-'+id)?.classList.add('on');
  const fb=document.getElementById('file-bar');
  if(id==='code'&&S.cur&&Object.keys(S.cur.files||{}).length) fb.classList.add('show'); else fb.classList.remove('show');
  if(id==='versions') renderVersions();
  if(id==='jobs') renderJobs();
}

// ══════════════════════════════════
// DOWNLOAD
// ══════════════════════════════════
function cpCode(){navigator.clipboard.writeText(document.getElementById('code-pre').textContent).then(()=>toast('⎘ Copiato','ok'));}
function dlFile(){if(!S.curFile||!S.cur)return;dl(S.cur.files[S.curFile],S.curFile);}
function dlProject(){
  if(!S.cur){toast('⚠️ Nessun progetto','err');return;}
  const ff=Object.keys(S.cur.files||{});
  if(!ff.length){toast('⚠️ Nessun file','err');return;}
  ff.forEach(f=>dl(S.cur.files[f],f));
  toast(`↓ ${ff.length} file scaricati`,'ok');
}
function dl(content,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));a.download=name;a.click();URL.revokeObjectURL(a.href);}
function onDeploy(){
  if (needsBuild()) {
    const kind = getProjectKind();
    const tips = { 'vite-react':'Vercel o Netlify', 'nextjs':'Vercel', 'node-express':'Railway o Render', 'node':'Railway o Render' };
    toast('↑ Progetto ' + kind + ' — usa ' + (tips[kind]||'un hosting Node') + ' per il deploy', 'ok');
  } else {
    toast('↑ Usa Netlify, Vercel o GitHub Pages per il deploy','ok');
  }
}

// ══════════════════════════════════
// API KEY
// ══════════════════════════════════
function openApi(){
  document.getElementById('api-inp').value=S.key;
  // E: Show current storage state
  const hasSaved = !!localStorage.getItem('fg3_key');
  document.getElementById('key-remember').checked = hasSaved;
  document.getElementById('key-clear-btn').style.display = hasSaved ? 'inline-block' : 'none';
  document.getElementById('key-info').textContent = hasSaved ? '🔓 Chiave salvata in localStorage' : '🔒 Chiave solo in questa sessione';
  openModal('api-ov');
}
function saveKey(){
  const k=document.getElementById('api-inp').value.trim();
  if(!k.startsWith('sk-')){toast('❌ Chiave non valida','err');return;}
  S.key=k;
  // E: Always save to sessionStorage (current session)
  sessionStorage.setItem('fg_key',k);
  // E: Only persist to localStorage if "Remember" is checked
  if(document.getElementById('key-remember').checked){
    localStorage.setItem('fg3_key',k);
    toast('✅ Key salvata (persistente)','ok');
  } else {
    localStorage.removeItem('fg3_key');
    toast('✅ Key salvata (solo sessione)','ok');
  }
  setDot('on'); closeModal('api-ov');
}
function clearSavedKey(){
  localStorage.removeItem('fg3_key');
  sessionStorage.removeItem('fg_key');
  S.key='';
  setDot('');
  document.getElementById('api-inp').value='';
  document.getElementById('key-remember').checked=false;
  document.getElementById('key-clear-btn').style.display='none';
  document.getElementById('key-info').textContent='🔒 Chiave eliminata';
  toast('🗑 Chiave eliminata','ok');
}
function setDot(s){const d=document.getElementById('sdot'),l=document.getElementById('slabel');d.className='status-dot'+(s==='on'?' on':s==='err'?' err':'');l.textContent=s==='on'?'Connesso':s==='err'?'Errore':'API Key';}

// ══════════════════════════════════
// PROJECTS MODAL
// ══════════════════════════════════
function openProjs(){renderProjList();openModal('proj-ov');}
function renderProjList(){
  const l=document.getElementById('proj-list');
  if(!S.projects.length){l.innerHTML='<div style="text-align:center;color:rgba(255,255,255,0.2);font-size:13px;padding:16px;">Nessun progetto</div>';return;}
  l.innerHTML=S.projects.slice().reverse().map(p=>`<div class="pcard ${S.cur?.id===p.id?'on':''}" onclick="selectProj(${p.id})"><div class="pcard-icon">${p.emoji||'⚡'}</div><div class="pcard-info"><div class="pcard-name">${p.name}</div><div class="pcard-meta">${p.date} · ${Object.keys(p.files||{}).length} file</div></div><button class="pdel" onclick="delProj(event,${p.id})">🗑</button></div>`).join('');
}
function selectProj(id){const p=S.projects.find(x=>x.id===id);if(p){loadProj(p);closeModal('proj-ov');}}
function delProj(e,id){e.stopPropagation();if(!confirm('Eliminare?'))return;S.projects=S.projects.filter(p=>p.id!==id);save();if(S.cur?.id===id){S.cur=null;clearEd();clearPrev();document.getElementById('msgs').style.display='none';document.getElementById('empty-st').style.display='flex';}renderProjList();toast('🗑 Eliminato','ok');}



// ══════════════════════════════════
// AGENTS TOGGLE
// ══════════════════════════════════
function togAgents(btn){S.agents=!S.agents;btn.classList.toggle('on',S.agents);toast(S.agents?'🤖 Agenti attivi':'⚡ Modalità diretta','ok');}

// ══════════════════════════════════
// INPUT / RESIZE
// ══════════════════════════════════
function setupInput(){
  const ta=document.getElementById('chat-ta');
  ta.addEventListener('input',()=>resizeTA(ta));
  ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
  // iOS/iPad keyboard handling: detect virtual keyboard via visualViewport
  if(window.visualViewport){
    const THRESHOLD=150;
    let initialH=window.visualViewport.height;
    window.visualViewport.addEventListener('resize',()=>{
      const diff=initialH-window.visualViewport.height;
      if(diff>THRESHOLD){
        document.body.classList.add('kb-open');
        // Scroll msgs to bottom so input stays visible
        const msgs=document.querySelector('.msgs');
        if(msgs) requestAnimationFrame(()=>msgs.scrollTop=msgs.scrollHeight);
      } else {
        document.body.classList.remove('kb-open');
        initialH=window.visualViewport.height;
      }
    });
  }
  // Fallback: scroll input into view on focus for older iOS
  ta.addEventListener('focus',()=>{
    if(isMobile) setTimeout(()=>{
      ta.scrollIntoView({block:'nearest',behavior:'smooth'});
    },300);
  });
}
function resizeTA(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,110)+'px';}

function setupResize(){
  const r=document.getElementById('resizer'),sb=document.getElementById('sidebar');
  let drag=false,sx,sw;
  r.addEventListener('mousedown',e=>{drag=true;sx=e.clientX;sw=sb.offsetWidth;document.body.style.userSelect='none';document.body.style.cursor='col-resize';});
  document.addEventListener('mousemove',e=>{if(!drag)return;sb.style.width=Math.max(280,Math.min(560,sw+e.clientX-sx))+'px';});
  document.addEventListener('mouseup',()=>{if(drag){drag=false;document.body.style.userSelect='';document.body.style.cursor='';}});
}




// ══════════════════════════════════
// MOBILE NAVIGATION
// ══════════════════════════════════
let isMobile = window.matchMedia('(max-width:768px)').matches;
window.matchMedia('(max-width:768px)').addEventListener('change', e => {
  isMobile = e.matches;
  if (!isMobile) { document.getElementById('sidebar')?.classList.remove('mobile-hide'); document.querySelector('.right')?.classList.remove('mobile-show'); }
});
function mobileSwitch(view) {
  if (!isMobile) return;
  const sidebar = document.getElementById('sidebar'), right = document.querySelector('.right');
  document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('mnav-' + view)?.classList.add('active');
  if (view === 'chat') { sidebar.classList.remove('mobile-hide'); right.classList.remove('mobile-show'); }
  else { sidebar.classList.add('mobile-hide'); right.classList.add('mobile-show'); switchTab(view); }
}

// ══════════════════════════════════
// TEMPLATES (Feature C)
// ══════════════════════════════════
let selectedTpl = 'blank';

function selectTpl(el, id) {
  document.querySelectorAll('.tpl-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedTpl = id;
}

