// ══════════════════════════════════
// ENGINE BRIDGE (v9 — Strada A)
// Collega la UI esistente al backend con motore ad agente (Claude Agent SDK).
// Se il backend non è raggiungibile, la vecchia pipeline browser resta attiva.
// ══════════════════════════════════

(function () {
  const CANDIDATES = (() => {
    const list = [];
    if (location.protocol.startsWith('http')) list.push(location.origin);
    list.push('http://localhost:8787', 'http://127.0.0.1:8787');
    return [...new Set(list)];
  })();

  let engineBase = null;
  let currentWs = null;

  async function probe(base) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    try {
      const r = await fetch(base + '/api/health', { signal: ctrl.signal });
      const j = await r.json();
      return j && j.ok && j.engine === 'agent' ? j : null;
    } catch { return null; }
    finally { clearTimeout(t); }
  }

  async function detectEngine() {
    for (const base of CANDIDATES) {
      const h = await probe(base);
      if (h) { engineBase = base; return h; }
    }
    return null;
  }

  function addEngineBadge() {
    const label = document.getElementById('slabel');
    if (!label || document.getElementById('engine-badge')) return;
    const pill = document.createElement('span');
    pill.id = 'engine-badge';
    pill.textContent = '⚡ Agent Engine';
    pill.title = 'Backend agente connesso: ' + engineBase;
    pill.style.cssText = 'margin-left:8px;padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:600;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);color:#10B981;white-space:nowrap;';
    label.parentElement?.appendChild(pill);
  }

  // ── Preview: punta l'iframe alla preview servita dal backend ──
  function updatePrevUrl(relUrl) {
    document.getElementById('prev-empty').style.display = 'none';
    document.getElementById('prev-framework')?.remove();
    const f = document.getElementById('prev-frame');
    f.style.display = 'block';
    f.removeAttribute('srcdoc');
    f.src = engineBase + relUrl + '?t=' + Date.now();
    document.getElementById('curl').textContent = (S.cur?.name || 'app') + ' · agent preview';
  }

  // ── Log eventi agente → chips + log UI esistenti ──
  const TOOL_UI = {
    Bash:   { chip: 'logic', icon: '⌨️', name: 'Shell' },
    Read:   { chip: 'plan',  icon: '📖', name: 'Lettura' },
    Glob:   { chip: 'plan',  icon: '🔎', name: 'Ricerca' },
    Grep:   { chip: 'plan',  icon: '🔎', name: 'Ricerca' },
    Write:  { chip: 'ui',    icon: '📝', name: 'Scrittura' },
    Edit:   { chip: 'ui',    icon: '✏️', name: 'Modifica' },
    MultiEdit: { chip: 'ui', icon: '✏️', name: 'Modifica' },
    TodoWrite: { chip: 'plan', icon: '📋', name: 'Piano' },
    WebFetch:  { chip: 'plan', icon: '🌐', name: 'Web' },
    'mcp__forge__screenshot': { chip: 'test', icon: '📸', name: 'Visual check' },
  };

  function logToolEvent(evt) {
    const ui = TOOL_UI[evt.name] || { chip: 'logic', icon: '🔧', name: evt.name };
    activateChip(ui.chip);
    addLog(ui.chip, ui.icon, ui.name, evt.detail || '');
  }

  // ── Progetto backend: crea il workspace (importando eventuali file esistenti) ──
  async function ensureEngineProject() {
    if (S.cur.engineId) {
      const r = await fetch(engineBase + '/api/projects/' + S.cur.engineId + '/files');
      if (r.ok) return S.cur.engineId;
      S.cur.engineId = null; // workspace sparito (es. server ripulito)
    }
    const r = await fetch(engineBase + '/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: S.cur.name || 'app', files: S.cur.files || {} }),
    });
    if (!r.ok) throw new Error('Impossibile creare il progetto sul backend');
    const j = await r.json();
    S.cur.engineId = j.id;
    save();
    return j.id;
  }

  function wsUrl() {
    return engineBase.replace(/^http/, 'ws') + '/ws';
  }

  // ── Run principale: sostituisce runAgents/runDirect quando il backend c'è ──
  async function engineRun(prompt) {
    const job = createJob(prompt);
    updateJob(job, { status: 'RUN' });
    activateChip('plan');
    addLog('plan', '⚡', 'Agent Engine', 'Invio richiesta al motore ad agente…');

    let projectId;
    try {
      projectId = await ensureEngineProject();
    } catch (e) {
      updateJob(job, { status: 'FAILED' });
      renderBbl('ai', '❌ Backend non raggiungibile: ' + e.message);
      return;
    }

    const model = S.model === 'auto' ? undefined : MODELS[S.model];
    const apiKey = S.key === 'server' ? undefined : S.key;

    await new Promise((resolve) => {
      const sock = new WebSocket(wsUrl());
      currentWs = sock;
      let finished = false;

      const finish = () => { if (!finished) { finished = true; currentWs = null; resolve(); } };

      sock.onopen = () => {
        sock.send(JSON.stringify({ type: 'run', projectId, prompt, apiKey, model }));
      };

      sock.onmessage = (e) => {
        let evt;
        try { evt = JSON.parse(e.data); } catch { return; }

        if (evt.type === 'status') {
          addLog('plan', 'ℹ️', 'Engine', evt.text);
        } else if (evt.type === 'tool') {
          logToolEvent(evt);
        } else if (evt.type === 'agent_text') {
          renderBbl('ai', evt.text);
          saveMsg('ai', evt.text);
        } else if (evt.type === 'files') {
          if (evt.files && Object.keys(evt.files).length) {
            saveSnapshot?.('Pre-agent: ' + prompt.slice(0, 40), job.id);
            S.cur.files = evt.files;
            S.cur.conv = S.history;
            if (!S.cur.name || S.cur.name === 'App') {
              S.cur.name = prompt.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').split(' ').filter(w => w.length > 3).slice(0, 4).join(' ') || 'App';
              document.getElementById('pj-name').textContent = S.cur.name;
            }
            save();
            updateFileTabs(); updateFilesList();
            const first = S.cur.files['index.html'] ? 'index.html' : Object.keys(S.cur.files)[0];
            if (first) showFile(first);
            job.changedFiles = Object.keys(evt.files);
          }
        } else if (evt.type === 'result') {
          const nFiles = Object.keys(S.cur?.files || {}).length;
          if (evt.aborted) {
            updateJob(job, { status: 'CANCELLED' });
            renderBbl('ai', '⏹ Run interrotto.');
          } else if (evt.ok) {
            updateJob(job, { status: 'DONE' });
            if (evt.hasIndexHtml) { updatePrevUrl(evt.previewUrl); switchTab('preview'); }
            const cost = evt.costUsd ? ' · costo $' + evt.costUsd.toFixed(3) : '';
            renderBbl('ai', '✅ **Completato** — ' + nFiles + ' file nel progetto · ' + (evt.turns || 0) + ' turni' + cost);
            saveMsg('ai', '✅ Agente completato (' + nFiles + ' file).');
            toast('✅ Progetto pronto', 'ok');
            window.addPublishBtn?.();
          } else {
            updateJob(job, { status: 'FAILED' });
            renderBbl('ai', '⚠️ L\'agente si è fermato senza completare. Riprova o riformula la richiesta.');
            toast('⚠️ Run incompleto', 'err');
          }
          sock.close();
          finish();
        } else if (evt.type === 'error') {
          updateJob(job, { status: 'FAILED' });
          renderBbl('ai', '❌ ' + evt.message);
          if (String(evt.message).includes('API key')) { setDot('err'); openApi(); }
          toast('❌ Errore engine', 'err');
          sock.close();
          finish();
        }
      };

      sock.onerror = () => {
        if (!finished) {
          updateJob(job, { status: 'FAILED' });
          renderBbl('ai', '❌ Connessione al backend persa. Il server è ancora attivo?');
        }
        finish();
      };
      sock.onclose = () => finish();
    });
  }

  // ── Aggancio alla UI esistente (dopo che lo script inline ha definito tutto) ──
  window.addEventListener('DOMContentLoaded', async () => {
    const health = await detectEngine();
    if (!health) {
      console.log('[ForgeAI] Backend agente non trovato — modalità legacy (browser).');
      return;
    }
    console.log('[ForgeAI] Agent Engine attivo su ' + engineBase);
    addEngineBadge();

    if (health.hasServerKey && !S.key) {
      S.key = 'server'; // il server ha già ANTHROPIC_API_KEY: la UI non deve chiederla
      setDot('on');
    }

    // Sostituisce la vecchia pipeline: entrambe le modalità passano dall'agente.
    window.runAgents = (p) => engineRun(p);
    window.runDirect = (p) => engineRun(p);

    // Messaggi durante la generazione → iniettati nel run in corso.
    const legacyRedirect = window.sendDuringGeneration;
    window.sendDuringGeneration = function () {
      if (!currentWs || currentWs.readyState !== WebSocket.OPEN) return legacyRedirect();
      const ta = document.getElementById('chat-ta');
      const text = ta.value.trim();
      if (!text) return;
      ta.value = ''; resizeTA(ta);
      currentWs.send(JSON.stringify({ type: 'user_message', text }));
      renderBbl('user', '💬 ' + text);
      saveMsg('user', '[redirect] ' + text);
      addLog('plan', '💬', 'Utente', 'Messaggio inviato all\'agente in corsa');
      toast('💬 Inviato all\'agente', 'ok');
    };

    // Stop job → interrompe anche il run agente.
    const legacyStop = window.stopCurrentJob;
    window.stopCurrentJob = function () {
      if (currentWs && currentWs.readyState === WebSocket.OPEN) {
        try { currentWs.send(JSON.stringify({ type: 'stop' })); } catch { /* ignore */ }
      }
      legacyStop();
    };
  });
})();
