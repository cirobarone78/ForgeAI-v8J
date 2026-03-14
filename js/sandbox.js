// ══════════════════════════════════
// SANDBOX (WebContainers - Node.js)
// ══════════════════════════════════
let wcInstance = null;
let wcBooting = false;

function setWcStatus(state, label, url) {
  const dot = document.getElementById('wc-dot');
  const lbl = document.getElementById('wc-status-label');
  const urlBar = document.getElementById('wc-url');
  if (dot) { dot.className = 'wc-status-dot' + (state ? ' '+state : ''); }
  if (lbl) lbl.textContent = label;
  if (urlBar && url !== undefined) urlBar.textContent = url;
}

function wcLog(text, type='') {
  const term = document.getElementById('wc-terminal');
  if (!term) return;
  // D2: Limit log to 5000 lines to prevent UI crash
  while (term.children.length > 5000) term.removeChild(term.firstChild);
  const line = document.createElement('div');
  line.className = 'wc-line' + (type ? ' '+type : '');
  line.textContent = text;
  term.appendChild(line);
  term.scrollTop = term.scrollHeight;
  // Also capture to current job runLogs (capped at 50KB)
  if (S.currentJob && S.currentJob.runLogs.length < 50000) {
    S.currentJob.runLogs += text + '\n';
  }
}

async function runSandbox() {
  if (wcBooting) return;
  if (!S.cur || !Object.keys(S.cur.files||{}).length) {
    toast('⚠️ Genera prima un progetto', 'err'); return;
  }
  switchTab('sandbox');
  wcBooting = true;
  document.getElementById('wc-run-btn').disabled = true;
  document.getElementById('wc-run-btn').textContent = '⏳ Avvio…';

  const term = document.getElementById('wc-terminal');
  term.innerHTML = '';
  setWcStatus('booting', 'Avvio sandbox…', 'caricamento…');

  // Check if we have a server file
  const hasServer = S.cur.files['server.js'] || S.cur.files['index.js'];
  const hasHTML = S.cur.files['index.html'];

  if (!hasServer && hasHTML) {
    // Pure frontend - just show in iframe
    wcLog('> Progetto frontend rilevato', 'cmd');
    wcLog('> Avvio preview diretta…', 'info');
    await sleep(400);
    setWcStatus('ready', 'Preview attiva', 'frontend · localhost');
    const frame = document.getElementById('wc-frame');
    frame.style.display = 'block';
    frame.srcdoc = S.cur.files['index.html'];
    term.style.display = 'none';
    wcLog('✓ Frontend in esecuzione', 'ok');
    document.getElementById('wc-run-btn').disabled = false;
    document.getElementById('wc-run-btn').textContent = '▶ Riavvia';
    wcBooting = false;
    return;
  }

  if (!hasServer) {
    // Generate a Node.js server from existing code
    wcLog('> Nessun server.js trovato', 'err');
    wcLog('> Per la Sandbox usa modalità Fullstack con Node.js', 'info');
    wcLog('> Per Python usa il deploy su Railway (gratuito)', 'info');
    setWcStatus('error', 'Nessun server Node.js', '—');
    document.getElementById('wc-run-btn').disabled = false;
    document.getElementById('wc-run-btn').textContent = '▶ Avvia';
    wcBooting = false;
    return;
  }

  // Load WebContainers API
  wcLog('> Caricamento WebContainers…', 'cmd');
  try {
    if (!window.WebContainer) {
      // Dynamically load the WebContainers SDK
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.type = 'module';
        s.textContent = `
          import { WebContainer } from 'https://unpkg.com/@webcontainer/api@1/dist/index.js';
          window.WebContainer = WebContainer;
          window.dispatchEvent(new Event('wc-loaded'));
        `;
        document.head.appendChild(s);
        window.addEventListener('wc-loaded', resolve, {once:true});
        setTimeout(reject, 10000);
      });
    }

    wcLog('✓ WebContainers caricato', 'ok');

    // Teardown old instance if any (prevents "Unable to create more instances")
    if (S.wcServerProcess) { try { S.wcServerProcess.kill(); } catch(e){} S.wcServerProcess = null; }
    if (wcInstance) { try { await wcInstance.teardown(); } catch(e){} wcInstance = null; S.lastDepsHash = null; }

    wcLog('> Avvio container…', 'cmd');
    wcInstance = await window.WebContainer.boot();
    wcLog('✓ Container avviato', 'ok');

    // Write files
    wcLog('> Scrittura file…', 'cmd');
    const files = {};
    for (const [name, content] of Object.entries(S.cur.files)) {
      files[name] = { file: { contents: content } };
    }
    // Add package.json if missing
    if (!S.cur.files['package.json']) {
      files['package.json'] = { file: { contents: JSON.stringify({
        name: 'forge-app', version: '1.0.0', main: 'server.js',
        scripts: { start: 'node server.js' },
        dependencies: { express: '^4.18.0', cors: '^2.8.5' }
      }, null, 2)}};
    }
    await wcInstance.mount(files);
    wcLog('✓ File montati', 'ok');

    // D1: Install deps (skip if package.json unchanged)
    const pkgContent = S.cur.files['package.json'] || '';
    const currentHash = simpleHash(pkgContent);
    if (S.lastDepsHash === currentHash && S.lastDepsHash !== null) {
      wcLog('> npm install — skipped (deps invariate)', 'info');
    } else {
      wcLog('> npm install…', 'cmd');
      const install = await wcInstance.spawn('npm', ['install']);
      install.output.pipeTo(new WritableStream({ write(data) { wcLog(data.trim(), ''); }}));
      const installCode = await install.exit;
      if (installCode !== 0) throw new Error('npm install fallito');
      S.lastDepsHash = currentHash;
      wcLog('✓ Dipendenze installate', 'ok');
    }

    // D1: Smart run command selection
    let runCmd = 'start';
    try {
      const pkg = JSON.parse(pkgContent);
      const scripts = pkg.scripts || {};
      if (scripts.dev) runCmd = 'dev';
      else if (scripts.start) runCmd = 'start';
      else if (scripts.serve) runCmd = 'serve';
      else if (scripts.build) { runCmd = 'build'; wcLog('⚠ Nessun server script — uso npm run build', 'info'); }
    } catch(e) {}

    // Start server
    wcLog('> npm run ' + runCmd + '…', 'cmd');
    if (S.currentJob) S.currentJob.runCommandUsed = 'npm run ' + runCmd;
    S.wcServerProcess = await wcInstance.spawn('npm', ['run', runCmd]);
    S.wcServerProcess.output.pipeTo(new WritableStream({ write(data) { wcLog(data.trim(), 'info'); }}));

    // Listen for server ready
    wcInstance.on('server-ready', (port, url) => {
      wcLog(`✓ Server live su porta ${port}`, 'ok');
      setWcStatus('ready', `Server attivo — porta ${port}`, url);
      const frame = document.getElementById('wc-frame');
      frame.src = url;
      frame.style.display = 'block';
      document.getElementById('wc-url').textContent = url;
    });

    document.getElementById('wc-run-btn').disabled = false;
    document.getElementById('wc-run-btn').textContent = '■ Stop';
    document.getElementById('wc-run-btn').onclick = stopSandbox;

  } catch(err) {
    wcLog('✗ Errore: ' + err.message, 'err');
    setWcStatus('error', 'Errore sandbox', '—');
    document.getElementById('wc-run-btn').disabled = false;
    document.getElementById('wc-run-btn').textContent = '▶ Riprova';
  }
  wcBooting = false;
}

async function stopSandbox() {
  // D3: Kill server process first
  if (S.wcServerProcess) { try { S.wcServerProcess.kill(); } catch(e){} S.wcServerProcess = null; }
  if (wcInstance) { try { await wcInstance.teardown(); } catch(e){} wcInstance = null; }
  // D1: Reset deps hash since node_modules are destroyed on teardown
  S.lastDepsHash = null;
  setWcStatus('', 'Sandbox fermata', '—');
  document.getElementById('wc-frame').style.display = 'none';
  document.getElementById('wc-frame').src = '';
  document.getElementById('wc-terminal').innerHTML = '<div class="wc-line info">Sandbox fermata.</div>';
  document.getElementById('wc-run-btn').disabled = false;
  document.getElementById('wc-run-btn').textContent = '▶ Avvia';
  document.getElementById('wc-run-btn').onclick = runSandbox;
  wcBooting = false;
}

function clearSandbox() {
  stopSandbox();
  const term = document.getElementById('wc-terminal');
  term.style.display = 'block';
  term.innerHTML = '<div class="wc-line info">Sandbox resettata.</div>';
}

function init() {
  // E: Restore key from localStorage if sessionStorage is empty (returning user with "Remember" enabled)
  if (!S.key) {
    const saved = localStorage.getItem('fg3_key');
    if (saved) { S.key = saved; sessionStorage.setItem('fg_key', saved); }
  }
  if (S.key) setDot('on');
  if (S.projects.length) loadProj(S.projects[S.projects.length-1]);
  setupInput(); setupResize(); setupDragDrop(); setupInteractiveChat();
  // Close model dropdown on outside click
  document.addEventListener('click', e => {
    const wrap = document.querySelector('.model-wrap');
    if (wrap && !wrap.contains(e.target)) document.getElementById('model-dropdown').classList.remove('open');
  });
}


// ══════════════════════════════════
// SANDBOX-VERIFIED JOB RUN (v8g)
// ══════════════════════════════════
async function runSandboxForJob(job, mode, qual) {
  if (!S.currentJob || S.currentJob.id !== job.id) return;
  if (!S.cur || !S.cur.files) return;
  if (wcBooting) return; // prevent double-run

  wcBooting = true;
  updateJob(job, { status: 'RUN' });
  addLog('test', '▶', 'Sandbox', 'Avvio sandbox per verifica…');

  // Teardown old instance if any
  if (S.wcServerProcess) { try { S.wcServerProcess.kill(); } catch(e){} S.wcServerProcess = null; }
  if (wcInstance) { try { await wcInstance.teardown(); } catch(e){} wcInstance = null; S.lastDepsHash = null; }

  try {
    // Load WebContainers if needed
    if (!window.WebContainer) {
      wcLog('> Caricamento WebContainers…', 'cmd');
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.type = 'module';
        s.textContent = `import { WebContainer } from 'https://unpkg.com/@webcontainer/api@1/dist/index.js'; window.WebContainer = WebContainer; window.dispatchEvent(new Event('wc-loaded'));`;
        document.head.appendChild(s);
        window.addEventListener('wc-loaded', resolve, {once:true});
        setTimeout(() => reject(new Error('WebContainer load timeout')), 15000);
      });
    }

    // Boot (with retry if instance limit reached)
    wcLog('> Avvio container…', 'cmd');
    try {
      wcInstance = await window.WebContainer.boot();
    } catch(bootErr) {
      // If "Unable to create more instances", force teardown and retry once
      wcLog('⚠ Boot fallito: ' + bootErr.message + ' — riprovo…', 'info');
      if (wcInstance) { try { await wcInstance.teardown(); } catch(e){} wcInstance = null; }
      S.lastDepsHash = null;
      wcInstance = await window.WebContainer.boot();
    }

    // Mount files
    const files = {};
    for (const [name, content] of Object.entries(S.cur.files)) {
      // Support nested paths like src/App.jsx
      const parts = name.split('/');
      if (parts.length === 1) {
        files[name] = { file: { contents: content } };
      } else {
        let cur = files;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!cur[parts[i]]) cur[parts[i]] = { directory: {} };
          cur = cur[parts[i]].directory;
        }
        cur[parts[parts.length - 1]] = { file: { contents: content } };
      }
    }
    // Add package.json if missing
    if (!S.cur.files['package.json']) {
      files['package.json'] = { file: { contents: JSON.stringify({
        name: 'forge-app', version: '1.0.0', main: 'server.js',
        scripts: { start: 'node server.js' },
        dependencies: { express: '^4.18.0', cors: '^2.8.5' }
      }, null, 2)}};
    }
    await wcInstance.mount(files);
    wcLog('✓ File montati (' + Object.keys(S.cur.files).length + ' file)', 'ok');

    // Install deps (skip if unchanged)
    const pkgContent = S.cur.files['package.json'] || '';
    const currentHash = simpleHash(pkgContent);
    if (S.lastDepsHash === currentHash && S.lastDepsHash !== null) {
      wcLog('> npm install — skipped (deps invariate)', 'info');
    } else {
      wcLog('> npm install…', 'cmd');
      const install = await wcInstance.spawn('npm', ['install']);
      install.output.pipeTo(new WritableStream({ write(data) { wcLog(data.trim(), ''); }}));
      const installCode = await install.exit;
      if (installCode !== 0) throw new Error('npm install fallito (exit ' + installCode + ')');
      S.lastDepsHash = currentHash;
      wcLog('✓ Dipendenze installate', 'ok');
    }

    // Determine run command
    let runCmd = 'start';
    try {
      const pkg = JSON.parse(pkgContent);
      const scripts = pkg.scripts || {};
      if (scripts.dev) runCmd = 'dev';
      else if (scripts.start) runCmd = 'start';
      else if (scripts.serve) runCmd = 'serve';
      else if (scripts.build) { runCmd = 'build'; }
    } catch(e) {}

    updateJob(job, { runCommandUsed: 'npm run ' + runCmd });
    wcLog('> npm run ' + runCmd + '…', 'cmd');

    // Start process
    job.runLogs = '';
    S.wcServerProcess = await wcInstance.spawn('npm', ['run', runCmd]);
    S.wcServerProcess.output.pipeTo(new WritableStream({
      write(data) {
        wcLog(data.trim(), 'info');
        // Capture to job runLogs (capped)
        if (job.runLogs.length < 60000) job.runLogs += data + '\n';
      }
    }));

    // Wait for server-ready OR process exit OR timeout
    const result = await new Promise((resolve) => {
      let resolved = false;
      const cancelCheck = setInterval(() => {
        if (!S.currentJob || S.currentJob.id !== job.id) {
          if (!resolved) { resolved = true; clearTimeout(timeout); clearInterval(cancelCheck); resolve('cancelled'); }
        }
      }, 500);

      const settle = (val) => {
        if (!resolved) { resolved = true; clearTimeout(timeout); clearInterval(cancelCheck); resolve(val); }
      };

      const timeout = setTimeout(() => settle('timeout'), 30000);

      wcInstance.on('server-ready', (port, url) => {
        wcLog('✓ Server live su porta ' + port, 'ok');
        settle('ready');
        // Show in sandbox panel
        const frame = document.getElementById('wc-frame');
        if (frame) { frame.src = url; frame.style.display = 'block'; }
        setWcStatus('ready', 'Server attivo — porta ' + port, url);
      });

      S.wcServerProcess.exit.then(code => {
        settle(code === 0 ? 'exit-ok' : 'exit-error');
      });
    });

    // VERIFY
    updateJob(job, { status: 'VERIFY' });

    if (result === 'cancelled') {
      updateJob(job, { status: 'CANCELLED' });
      wcBooting = false;
      return;
    }

    if (result === 'ready' || result === 'exit-ok') {
      // SUCCESS
      const errors = parseErrors(job.runLogs);
      if (errors.length === 0) {
        updateJob(job, { status: 'DONE' });
        addLog('test', '✅', 'Verify', 'Sandbox: tutto OK!');
        renderBbl('ai', '✅ **Sandbox verification passed!** Server avviato correttamente.');
        toast('✅ Sandbox OK', 'ok');
        wcBooting = false;
        return;
      }
      // Has warnings but server started — still DONE
      updateJob(job, { status: 'DONE', errorsDetected: errors });
      addLog('test', '⚠️', 'Verify', errors.length + ' warning rilevati, ma server attivo.');
      wcBooting = false;
      return;
    }

    // FAILURE: exit-error or timeout
    wcBooting = false;
    const errors = parseErrors(job.runLogs);
    updateJob(job, { status: 'FIX', errorsDetected: errors.length ? errors : [{ type: 'Runtime', message: result === 'timeout' ? 'Server non avviato entro 30s' : 'Processo terminato con errore' }] });
    addLog('test', '❌', 'Verify', 'Errori rilevati (' + (errors.length || 1) + '). Avvio auto-fix…');
    renderBbl('ai', '⚠️ **Build/run fallito** — tentativo auto-fix #' + (job.attempt + 1) + '/' + JOB_MAX_FIX);

    // Auto-fix loop
    await autoFixLoop(job, mode, qual);

  } catch(err) {
    wcBooting = false;
    wcLog('✗ Errore sandbox: ' + err.message, 'err');
    const errors = parseErrors(job.runLogs || err.message);
    updateJob(job, { status: 'FIX', errorsDetected: errors.length ? errors : [{ type: 'Sandbox', message: err.message }] });
    addLog('test', '❌', 'Sandbox', 'Errore: ' + err.message);
    // Try auto-fix
    await autoFixLoop(job, mode, qual);
  }
}
