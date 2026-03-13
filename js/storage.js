// ══════════════════════════════════
// STORAGE — Salvataggio, versioni, snapshot
// ══════════════════════════════════

function save() {
  try {
    localStorage.setItem('fg3_projs', JSON.stringify(S.projects.map(p => {
      // Deep-copy with truncations to avoid localStorage overflow
      const slim = {...p, conv: (p.conv||[]).slice(-8)};
      // Truncate runLogs in jobs (keep last 2KB per job)
      if (slim.jobs) {
        slim.jobs = slim.jobs.map(j => ({...j, runLogs: (j.runLogs||'').slice(-2000)}));
      }
      // Limit snapshots file content to avoid bloat (keep max 10 snapshots, truncate large files)
      if (slim.snapshots && slim.snapshots.length > 10) {
        slim.snapshots = slim.snapshots.slice(0, 10);
      }
      return slim;
    })));
  } catch(e) {
    // localStorage full — try removing oldest project
    if (S.projects.length > 1) { S.projects.shift(); save(); }
    else console.error('localStorage full:', e);
  }
}

// ══════════════════════════════════
// VERSION HISTORY
// ══════════════════════════════════
function saveVersion(label) {
  if (!S.cur) return;
  if (!S.cur.versions) S.cur.versions = [];
  const snap = {
    id: Date.now(),
    label: label || 'Versione',
    time: new Date().toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'}),
    date: new Date().toLocaleDateString('it-IT'),
    files: JSON.parse(JSON.stringify(S.cur.files || {}))
  };
  S.cur.versions.unshift(snap);
  if (S.cur.versions.length > 20) S.cur.versions.pop();
  save();
  // Update badge on tab
  const btn = document.getElementById('rt-versions');
  if (btn) {
    const count = S.cur.versions.length;
    btn.textContent = `🕐 Versioni${count > 0 ? ' ('+count+')' : ''}`;
  }
}

function renderVersions() {
  const list = document.getElementById('ver-list');
  const cnt = document.getElementById('ver-count');
  if (!S.cur || !S.cur.versions || !S.cur.versions.length) {
    list.innerHTML = '<div style="padding:32px 16px;text-align:center;color:rgba(255,255,255,0.2);font-size:13px;">Nessuna versione salvata.<br>Le versioni si salvano automaticamente ad ogni generazione.</div>';
    cnt.textContent = '0 versioni';
    return;
  }
  cnt.textContent = S.cur.versions.length + ' versioni';
  list.innerHTML = S.cur.versions.map((v, i) => `
    <div class="ver-item ${i===0?'current':''}">
      <div class="ver-dot"></div>
      <div class="ver-meta">
        <div class="ver-label">${v.label}</div>
        <div class="ver-time">${v.date} · ${v.time}</div>
        <div class="ver-files">${Object.keys(v.files).join(', ')}</div>
      </div>
      <button class="ver-restore" onclick="showDiff(${v.id})" style="margin-right:4px;border-color:rgba(58,134,255,0.2);background:rgba(58,134,255,0.08);color:#3A86FF">📋 Diff</button><button class="ver-restore" onclick="restoreVersion(${v.id})">↩ Ripristina</button>
    </div>
    ${i < S.cur.versions.length-1 ? '<div class="ver-connector"></div>' : ''}
  `).join('');
}

function restoreVersion(id) {
  if (!S.cur || !S.cur.versions) return;
  const ver = S.cur.versions.find(v => v.id === id);
  if (!ver) return;
  if (!confirm(`Ripristinare la versione "${ver.label}" del ${ver.date}?`)) return;
  // Save current as new version before restoring
  saveVersion('Backup prima del ripristino');
  S.cur.files = JSON.parse(JSON.stringify(ver.files));
  save();
  updateFileTabs(); updateFilesList(); updateVerTab();
  const ff = Object.keys(S.cur.files);
  if (ff.length) { showFile(ff[0]); const html = S.cur.files['index.html']; if(html) updatePrev(html); }
  renderVersions();
  toast('↩ Versione ripristinata', 'ok');
}

// ══════════════════════════════════
// SNAPSHOTS + DIFF VIEWER (Feature B)
// ══════════════════════════════════
function saveSnapshot(note, jobId) {
  if (!S.cur) return;
  if (!S.cur.snapshots) S.cur.snapshots = [];
  const snap = {
    id: Date.now(),
    jobId: jobId || null,
    note: note || 'Snapshot',
    timestamp: new Date().toISOString(),
    time: new Date().toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'}),
    date: new Date().toLocaleDateString('it-IT'),
    files: JSON.parse(JSON.stringify(S.cur.files || {})),
    selectedFile: S.curFile
  };
  S.cur.snapshots.unshift(snap);
  if (S.cur.snapshots.length > 20) S.cur.snapshots.pop();
  save();
}

function restoreSnapshot(snapId) {
  if (!S.cur || !S.cur.snapshots) return;
  const snap = S.cur.snapshots.find(s => s.id === snapId);
  if (!snap) return;
  if (!confirm('Ripristinare snapshot "' + snap.note + '"?')) return;
  // Save current state as snapshot before restoring
  saveSnapshot('Backup prima del ripristino');
  S.cur.files = JSON.parse(JSON.stringify(snap.files));
  save();
  updateFileTabs(); updateFilesList(); updateVerTab();
  const ff = Object.keys(S.cur.files);
  if (ff.length) {
    showFile(ff[0]);
    const html = S.cur.files['index.html'];
    if (html) updatePrev(html);
  } else {
    clearEd(); clearPrev();
  }
  toast('↩ Snapshot ripristinato', 'ok');
}

function showDiff(versionId) {
  if (!S.cur || !S.cur.versions) return;
  const ver = S.cur.versions.find(v => v.id === versionId);
  if (!ver) return;

  const body = document.getElementById('diff-body');
  const currentFiles = S.cur.files || {};
  const oldFiles = ver.files || {};
  const allKeys = [...new Set([...Object.keys(currentFiles), ...Object.keys(oldFiles)])];

  let html = '';
  let changedCount = 0;

  for (const key of allKeys) {
    const oldContent = oldFiles[key];
    const newContent = currentFiles[key];

    // Skip unchanged files
    if (oldContent === newContent) continue;
    changedCount++;

    const oldLabel = oldContent ? (oldContent.split('\n').length + ' righe') : 'non esistente';
    const newLabel = newContent ? (newContent.split('\n').length + ' righe') : 'eliminato';

    html += '<div class="diff-file-header">' + escHtml(key) + ' — ' + oldLabel + ' → ' + newLabel + '</div>';
    html += '<div class="diff-wrap">';
    html += '<div class="diff-col"><div class="diff-side-label">Prima (' + escHtml(ver.label) + ')</div>';
    html += '<div class="diff-side old">' + escHtml((oldContent || '(file non esistente)').slice(0, 10000)) + '</div></div>';
    html += '<div class="diff-col"><div class="diff-side-label">Dopo (attuale)</div>';
    html += '<div class="diff-side">' + escHtml((newContent || '(file eliminato)').slice(0, 10000)) + '</div></div>';
    html += '</div>';
  }

  if (!changedCount) {
    html = '<div style="padding:32px;text-align:center;color:rgba(255,255,255,0.25)">Nessuna differenza trovata tra questa versione e lo stato attuale.</div>';
  } else {
    html = '<div style="padding:10px 14px;font-size:12px;color:rgba(255,255,255,0.35);border-bottom:1px solid rgba(255,255,255,0.06)">' + changedCount + ' file modificati</div>' + html;
  }

  body.innerHTML = html;
  openModal('diff-ov');
}

// ══════════════════════════════════
// PROJECTS
// ══════════════════════════════════
function newProj(name) {
  const ems = ['🚀','🎯','⚡','🛠','🎨','📊','🎮','🌐','💡','🔮','🛒','📱','🧬','🌊','🔥','🎸','🏆','🌈'];
  const tplFiles = TEMPLATES[selectedTpl] || {};
  const tplMode = selectedTpl === 'vite-react' ? 'react' : selectedTpl === 'express' ? 'fullstack' : 'html';
  const p = { id:Date.now(), name:name||'Progetto', emoji:ems[Math.floor(Math.random()*ems.length)], date:new Date().toLocaleDateString('it-IT'), mode:tplMode, files:JSON.parse(JSON.stringify(tplFiles)), msgs:[], conv:[], jobs:[], snapshots:[] };
  S.projects.push(p); save(); loadProj(p); closeModal('proj-ov');
  // Reset template selection for next time
  selectedTpl = 'blank';
  document.querySelectorAll('.tpl-card').forEach(c => c.classList.remove('selected'));
  document.querySelector('.tpl-card[data-tpl="blank"]')?.classList.add('selected');
  // Notify if template applied
  const fileCount = Object.keys(tplFiles).length;
  if (fileCount) {
    toast('📦 Template: ' + fileCount + ' file creati', 'ok');
    if (tplFiles['index.html']) { updatePrev(tplFiles['index.html']); switchTab('preview'); }
  }
}

function loadProj(p) {
  S.cur=p; S.history=p.conv||[]; S.curFile=null;
  document.getElementById('pj-emoji').textContent = p.emoji||'✦';
  document.getElementById('pj-name').textContent = p.name;
  document.getElementById('sel-type').value = p.mode||'html';
  const mc=document.getElementById('msgs'), es=document.getElementById('empty-st');
  mc.innerHTML='';
  if (p.msgs&&p.msgs.length) { es.style.display='none'; mc.style.display='flex'; p.msgs.forEach(m=>renderBbl(m.role,m.text,false)); }
  else { es.style.display='flex'; mc.style.display='none'; }
  updateFileTabs(); updateFilesList();
  const ff=Object.keys(p.files||{});
  if (ff.length) showFile(ff[0]); else { clearEd(); clearPrev(); }
  document.getElementById('deploy-btn').style.display = ff.length?'flex':'none';
}
