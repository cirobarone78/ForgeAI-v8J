// ══════════════════════════════════
// JOB PIPELINE (Feature A)
// ══════════════════════════════════

function createJob(userGoal) {
  const job = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    title: userGoal.slice(0, 80),
    userGoal,
    plan: [],
    attempt: 0,
    status: 'PLAN',
    changedFiles: [],
    diffSummary: '',
    runCommandUsed: '',
    runLogs: '',
    errorsDetected: []
  };
  if (!S.cur.jobs) S.cur.jobs = [];
  S.cur.jobs.unshift(job);
  if (S.cur.jobs.length > 30) S.cur.jobs.pop();
  S.currentJob = job;
  save();
  renderJobs();
  return job;
}

function updateJob(job, updates) {
  Object.assign(job, updates);
  save();
  renderJobs();
}

function renderJobs() {
  const list = document.getElementById('job-list');
  const cnt = document.getElementById('job-count');
  if (!list || !cnt) return;
  if (!S.cur || !S.cur.jobs || !S.cur.jobs.length) {
    list.innerHTML = '<div style="padding:32px 16px;text-align:center;color:rgba(255,255,255,0.2);font-size:13px;">Nessun job eseguito.<br>I job tracciano ogni generazione.</div>';
    cnt.textContent = '0 jobs';
    return;
  }
  cnt.textContent = S.cur.jobs.length + ' jobs';
  list.innerHTML = S.cur.jobs.map(j => {
    const isRunning = ['PLAN','APPLY','RUN','VERIFY','FIX','QUALITY_REVIEW','QUALITY_FIX'].includes(j.status);
    const cls = isRunning ? 'running' : j.status.toLowerCase();
    return `<div class="job-item ${cls}">
      <span class="job-status ${j.status.toLowerCase()}">${j.status}</span>
      <span class="job-title" title="${j.title}">${j.title}</span>
      <span class="job-attempt">#${j.attempt}</span>
      ${isRunning && S.currentJob?.id===j.id ? '<button class="job-stop-btn" onclick="stopCurrentJob()">⏹ Stop</button>' : ''}
    </div>`;
  }).join('');
}

function stopCurrentJob() {
  if (S.currentJob) {
    updateJob(S.currentJob, { status: 'CANCELLED' });
    S.currentJob = null;
    S.busy = false;
    document.getElementById('send-btn').disabled = false;
    stopProg();
    ['plan','ui','logic','test'].forEach(deactivateChip);
    // D3: Also stop sandbox if it was running for this job
    if (wcBooting || S.wcServerProcess) {
      stopSandbox().catch(() => {});
    }
    toast('⏹ Job fermato', 'ok');
  }
}

// Parse errors from logs
function parseErrors(logs) {
  const errors = [];
  const keywords = ['ERR!','Error:','TypeError:','ReferenceError:','SyntaxError:','Module not found','Cannot find module','Failed to compile','Build failed','EADDRINUSE'];
  const lines = logs.split('\n');
  for (const line of lines) {
    for (const kw of keywords) {
      if (line.includes(kw)) {
        errors.push({ type: kw.replace(':',''), message: line.trim().slice(0, 200) });
        break;
      }
    }
  }
  return errors;
}

// Build fix prompt for auto-repair
function buildFixPrompt(job) {
  const errText = job.errorsDetected.slice(0, 10).map(e => `- [${e.type}] ${e.message}`).join('\n');
  const pkgJson = S.cur?.files?.['package.json'] || '';
  const mainFile = job.changedFiles[0] || Object.keys(S.cur?.files || {})[0] || '';
  const mainCode = mainFile ? (S.cur?.files?.[mainFile] || '').slice(0, 5000) : '';
  const allFiles = Object.keys(S.cur?.files || {}).join(', ');

  return `ERRORI DA CORREGGERE. Applica una PATCH MINIMA — correggi SOLO gli errori.

OBIETTIVO ORIGINALE: ${job.userGoal}
FILE NEL PROGETTO: ${allFiles}
FILE CON ERRORI: ${job.changedFiles.join(', ')}
TENTATIVO: #${job.attempt} di ${JOB_MAX_FIX}

ERRORI RILEVATI (${job.errorsDetected.length}):
${errText}

${pkgJson ? 'PACKAGE.JSON:\n' + pkgJson.slice(0, 1200) + '\n' : ''}
CODICE ATTUALE (${mainFile}):
\`\`\`
${mainCode}
\`\`\`

LOG (ultime righe):
${job.runLogs.slice(-2000)}

ISTRUZIONI:
1. Analizza gli errori. Identifica la CAUSA ESATTA.
2. Correggi SOLO i file che hanno errori.
3. Se manca un modulo/import, aggiungilo.
4. Basati sui LOG REALI — non inventare soluzioni.

FORMATO OUTPUT — rispondi SOLO con JSON valido:
{"summary":"cosa hai corretto","filesChanged":[{"path":"file.ext","action":"update","content":"contenuto completo file corretto"}],"nextBatch":{"needed":false}}`;
}

// Auto-review pass (second API call to catch bugs)
async function reviewAndFix(code, mode, originalPrompt) {
  const reviewSys = `Sei un senior code reviewer con 20 anni di esperienza. Il tuo compito è trovare e correggere BUG nel codice.

CHECKLIST DI VERIFICA (controlla OGNI punto):
1. VARIABILI: nessun nome duplicato per scopi diversi? Tutte dichiarate prima dell'uso?
2. FUNZIONI: ogni funzione chiamata esiste? Parametri corretti? Return values gestiti?
3. DOM: ogni getElementById/querySelector ha un elemento corrispondente nell'HTML?
4. LOGICA: il flusso init→render→interazione→update funziona senza errori?
5. CLASSI: ogni metodo e proprietà referenziata esiste nella classe?
6. CANVAS: se presente, è ridimensionato? Oggetti esistono prima del draw?
7. GAME LOOP: se è un gioco, il loop parte? Controlli funzionano? Collisioni corrette?
8. EDGE CASES: array vuoti, null/undefined, divisione per zero, fetch falliti?
9. COMPLETEZZA: l'app fa TUTTO quello che la richiesta chiede?

SE TROVI BUG: restituisci il codice COMPLETO CORRETTO (tutto il file, non solo le patch).
SE IL CODICE È OK: restituiscilo IDENTICO senza cambiamenti.
SE IL CODICE È TROPPO CORTO O INCOMPLETO: aggiungi le features mancanti.

REGOLA ASSOLUTA: SOLO codice puro. Zero spiegazioni, zero markdown, zero backtick.`;

  const reviewMsg = 'Richiesta utente: "' + originalPrompt + '"\n\nCodice da verificare:\n```\n' + code.slice(0, 14000) + '\n```\n\nEsegui la checklist, correggi bug, restituisci codice COMPLETO.';

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {'Content-Type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body: JSON.stringify({
      model: MODELS.sonnet, max_tokens: 32000, temperature: 0.3, system: reviewSys,
      messages: [{ role: 'user', content: reviewMsg }]
    })
  });
  if (!r.ok) throw new Error('Review failed');
  const data = await r.json();
  const reviewed = data.content.map(b => b.text || '').join('').trim().replace(/^```[\w]*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
  return (reviewed.length > code.length * 0.5 && (reviewed.includes('<') || reviewed.includes('def ') || reviewed.includes('function '))) ? reviewed : code;
}

// ══════════════════════════════════
// PROJECT QUALITY GATE (v8j-qg-v2)
// ══════════════════════════════════

// Determine if the user request is "complex" (deserves strict quality gate)
function isComplexRequest(prompt) {
  const markers = [
    'dashboard', 'sidebar', 'login', 'auth', 'register', 'signup',
    'crud', 'database', 'storage', 'persist', 'localstorage', 'indexeddb',
    'react', 'vite', 'next', 'vue', 'angular', 'svelte',
    'responsive', 'modern', 'professional', 'production', 'polished', 'clean',
    'multi-file', 'multi file', 'component', 'routing', 'router',
    'card', 'cards', 'modal', 'tab', 'tabs', 'form', 'table',
    'chart', 'graph', 'api', 'fetch', 'drag', 'drop',
    'animation', 'transition', 'theme', 'dark mode',
    'e-commerce', 'ecommerce', 'shop', 'cart', 'checkout',
    'kanban', 'calendar', 'editor', 'cms', 'blog',
    'notification', 'real-time', 'socket', 'chat',
    'notes app', 'todo app', 'task', 'project manager', 'tracker'
  ];
  const low = (prompt || '').toLowerCase();
  return markers.filter(m => low.includes(m)).length >= 2;
}

// Determine if the user wants a visually polished / modern UI
function needsModernUI(prompt) {
  const uiMarkers = [
    'modern', 'polished', 'clean ui', 'beautiful', 'professional',
    'dashboard', 'notes app', 'responsive', 'cards', 'sidebar',
    'dark mode', 'elegant', 'sleek', 'premium', 'styled',
    'tailwind', 'material', 'glassmorphism', 'gradient',
    'kanban', 'calendar', 'editor', 'portfolio', 'landing'
  ];
  const low = (prompt || '').toLowerCase();
  return uiMarkers.some(m => low.includes(m)) || isComplexRequest(prompt);
}

// ── FUNCTIONAL CHECKS (deep static analysis) ──
function runFunctionalChecks(files, fileKeys, allContent) {
  const issues = [];

  // 1. onclick/handler references → verify function exists
  for (const [path, content] of Object.entries(files)) {
    if (!/\.(html|jsx|tsx|vue)$/.test(path)) continue;
    // onclick="fn()"
    const onclickRefs = [...(content.matchAll(/onclick\s*=\s*"(\w+)\s*\(/g) || [])].map(m => m[1]);
    // addEventListener('click', fn)
    const addEvtRefs = [...(content.matchAll(/addEventListener\s*\(\s*['"][^'"]+['"]\s*,\s*(\w+)/g) || [])].map(m => m[1]);
    // onchange, onsubmit, oninput etc
    const otherHandlers = [...(content.matchAll(/on(?:change|submit|input|keydown|keyup|keypress|focus|blur|mouseover|mouseout)\s*=\s*"(\w+)\s*\(/g) || [])].map(m => m[1]);
    const allRefs = [...new Set([...onclickRefs, ...addEvtRefs, ...otherHandlers])];
    for (const fn of allRefs) {
      if (['alert', 'confirm', 'prompt', 'console', 'event', 'e', 'this', 'window', 'document', 'history', 'location', 'navigator', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'fetch', 'JSON', 'Math', 'Date', 'Array', 'Object', 'String', 'Number', 'Boolean', 'parseInt', 'parseFloat'].includes(fn)) continue;
      const fnDef = new RegExp('function\\s+' + fn + '\\b|(?:const|let|var)\\s+' + fn + '\\s*=|' + fn + '\\s*\\(.*\\)\\s*\\{', 'm');
      if (!fnDef.test(allContent)) {
        issues.push({ severity: 'high', type: 'MISSING_HANDLER', message: 'Handler "' + fn + '()" referenziato in ' + path + ' ma mai definito.', files: [path] });
      }
    }
  }

  // 2. getElementById / querySelector → verify target exists in HTML
  for (const [path, content] of Object.entries(files)) {
    if (!/\.(html|js|jsx|tsx)$/.test(path)) continue;
    const getByIdRefs = [...(content.matchAll(/getElementById\s*\(\s*['"]([^'"]+)['"]\s*\)/g) || [])].map(m => m[1]);
    for (const id of getByIdRefs) {
      const idInMarkup = new RegExp('id\\s*=\\s*["\']' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\']');
      if (!idInMarkup.test(allContent)) {
        issues.push({ severity: 'high', type: 'MISSING_DOM_ELEMENT', message: 'getElementById("' + id + '") in ' + path + ' ma nessun elemento con id="' + id + '" nel markup.', files: [path] });
      }
    }
  }

  // 3. Import/export coherence (enhanced)
  if (fileKeys.length > 2) {
    for (const [path, content] of Object.entries(files)) {
      // ES imports: import X from './Y'
      const esImports = [...(content.matchAll(/(?:import\s+.+?\s+from\s+['"])\.\/([^'"]+)['"]/g) || [])].map(m => m[1]);
      // require('./Y')
      const cjsImports = [...(content.matchAll(/require\s*\(\s*['"]\.\/([^'"]+)['"]\s*\)/g) || [])].map(m => m[1]);
      for (const imp of [...esImports, ...cjsImports]) {
        const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/') + 1) : '';
        const candidates = [imp, imp + '.js', imp + '.jsx', imp + '.tsx', imp + '.ts', imp + '.mjs', imp + '.css',
          imp + '/index.js', imp + '/index.jsx', imp + '/index.tsx', imp + '/index.ts'];
        const found = candidates.some(c => files[dir + c]);
        if (!found) {
          issues.push({ severity: 'high', type: 'BROKEN_IMPORT', message: 'Import "./' + imp + '" in ' + path + ' punta a un file inesistente.', files: [path] });
        }
      }
    }
  }

  // 4. HTML referencing CSS/JS files that don't exist
  for (const [path, content] of Object.entries(files)) {
    if (!path.endsWith('.html')) continue;
    const cssRefs = [...(content.matchAll(/<link[^>]+href\s*=\s*["'](?!https?:\/\/)([^"']+\.css)["']/g) || [])].map(m => m[1]);
    const jsRefs = [...(content.matchAll(/<script[^>]+src\s*=\s*["'](?!https?:\/\/)([^"']+\.js)["']/g) || [])].map(m => m[1]);
    const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/') + 1) : '';
    for (const ref of [...cssRefs, ...jsRefs]) {
      const resolved = ref.startsWith('/') ? ref.slice(1) : dir + ref;
      if (!files[resolved] && !files[ref]) {
        issues.push({ severity: 'high', type: 'MISSING_ASSET', message: path + ' referenzia "' + ref + '" ma il file non esiste nel progetto.', files: [path, ref] });
      }
    }
  }

  // 5. Script load order — defer/module detection (basic)
  for (const [path, content] of Object.entries(files)) {
    if (!path.endsWith('.html')) continue;
    // Check if scripts in <head> without defer/async reference DOM
    const headMatch = content.match(/<head[\s\S]*?<\/head>/i);
    if (headMatch) {
      const headScripts = [...(headMatch[0].matchAll(/<script(?![^>]*(?:defer|async|type\s*=\s*["']module["']))[^>]*>([\s\S]*?)<\/script>/gi) || [])];
      for (const s of headScripts) {
        if (s[1] && /(?:getElementById|querySelector|document\.body|\.addEventListener)/.test(s[1])) {
          issues.push({ severity: 'medium', type: 'SCRIPT_LOAD_ORDER', message: 'Script in <head> di ' + path + ' accede al DOM senza defer/async — potrebbe fallire.' });
          break;
        }
      }
    }
  }

  // 6. Empty/stub function bodies
  for (const [path, content] of Object.entries(files)) {
    if (!/\.(js|jsx|tsx|ts|html)$/.test(path)) continue;
    // function foo() {} or const foo = () => {}
    const emptyFns = content.match(/function\s+\w+\s*\([^)]*\)\s*\{\s*\}/g) || [];
    const emptyArrows = content.match(/(?:const|let)\s+\w+\s*=\s*(?:\([^)]*\)|[^=]+)\s*=>\s*\{\s*\}/g) || [];
    const total = emptyFns.length + emptyArrows.length;
    if (total >= 3) {
      issues.push({ severity: 'high', type: 'EMPTY_FUNCTIONS', message: path + ' ha ' + total + ' funzioni con corpo vuoto — logica non implementata.', files: [path] });
    }
  }

  return issues;
}

// ── UI BASELINE CHECK (modern visual quality) ──
function runUIBaselineCheck(files, fileKeys, allContent, prompt) {
  const issues = [];
  const wantsModern = needsModernUI(prompt);
  if (!wantsModern) return issues; // Skip for simple requests

  // Gather all CSS (inline <style> + .css files)
  const cssBlocks = (allContent.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []).map(m => m.replace(/<\/?style[^>]*>/gi, ''));
  const cssFileContents = fileKeys.filter(f => f.endsWith('.css')).map(f => files[f] || '');
  const allCss = [...cssBlocks, ...cssFileContents].join('\n');
  const cssLines = allCss.split('\n').filter(l => l.trim()).length;

  // 1. CSS quantity baseline
  const markupLines = fileKeys.filter(f => /\.(html|jsx|tsx|vue)$/.test(f))
    .reduce((sum, f) => sum + (files[f] || '').split('\n').length, 0);
  if (cssLines < 25 && markupLines > 40) {
    issues.push({ severity: 'high', type: 'UI_TOO_BASIC',
      message: 'Solo ' + cssLines + ' righe CSS per ' + markupLines + ' righe di markup. UI troppo basilare per una richiesta moderna.' });
  }

  // 2. Background check — no raw white default
  const hasBgColor = /background(?:-color)?\s*:\s*(?!(?:#fff(?:fff)?|white|rgba?\(255))/i.test(allCss);
  const hasBgGradient = /background.*gradient/i.test(allCss);
  const hasBodyBg = /body\s*\{[^}]*background/i.test(allCss);
  const hasCSSVarBg = /--.*(?:bg|background)/i.test(allCss);
  if (!hasBgColor && !hasBgGradient && !hasBodyBg && !hasCSSVarBg && cssLines > 0) {
    issues.push({ severity: 'high', type: 'STYLING_INSUFFICIENT',
      message: 'Nessun background definito — sfondo bianco grezzo di default. Serve una palette colori.' });
  }

  // 3. Typography — font-family beyond defaults
  const hasCustomFont = /font-family\s*:\s*(?!.*(?:serif|sans-serif|monospace|inherit|initial|unset)\s*[;}])/i.test(allCss);
  const hasGoogleFont = /@import.*fonts\.googleapis|link.*fonts\.googleapis/i.test(allContent);
  const hasFontVar = /--.*font/i.test(allCss);
  if (!hasCustomFont && !hasGoogleFont && !hasFontVar) {
    issues.push({ severity: 'medium', type: 'STYLING_INSUFFICIENT',
      message: 'Nessun font custom caricato. Serve Google Fonts o font-family curata per UI moderna.' });
  }

  // 4. Visual hierarchy — must have some shadows, border-radius, or visual depth
  const hasShadow = /box-shadow/i.test(allCss);
  const hasBorderRadius = /border-radius\s*:\s*(?!0)/i.test(allCss);
  const hasTransition = /transition/i.test(allCss);
  const visualDepthCount = [hasShadow, hasBorderRadius, hasTransition].filter(Boolean).length;
  if (visualDepthCount === 0) {
    issues.push({ severity: 'high', type: 'MODERN_UI_REQUIREMENTS_NOT_MET',
      message: 'Nessun box-shadow, border-radius o transition. UI piatta/prototipale.' });
  } else if (visualDepthCount === 1 && cssLines < 60) {
    issues.push({ severity: 'medium', type: 'MODERN_UI_REQUIREMENTS_NOT_MET',
      message: 'Profondità visiva minima (solo ' + visualDepthCount + '/3 tra shadow, radius, transition). UI probabilmente poco curata.' });
  }

  // 5. Interactive states — hover/focus/active
  const hasHover = /:hover/i.test(allCss);
  const hasFocus = /:focus/i.test(allCss);
  if (!hasHover && !hasFocus) {
    issues.push({ severity: 'medium', type: 'STYLING_INSUFFICIENT',
      message: 'Nessuno stato :hover o :focus definito. Interazioni piatte.' });
  }

  // 6. Responsive — media queries or flex/grid layout
  const hasMediaQuery = /@media/i.test(allCss);
  const hasFlex = /display\s*:\s*flex/i.test(allCss);
  const hasGrid = /display\s*:\s*grid/i.test(allCss);
  if (!hasMediaQuery && !hasFlex && !hasGrid) {
    issues.push({ severity: 'high', type: 'UI_TOO_BASIC',
      message: 'Nessun layout flex/grid né media query. UI non responsive.' });
  }

  // 7. CSS custom properties / design tokens (for complex projects)
  if (isComplexRequest(prompt)) {
    const hasCssVars = /--[\w-]+\s*:/i.test(allCss);
    if (!hasCssVars && cssLines > 30) {
      issues.push({ severity: 'medium', type: 'STYLING_INSUFFICIENT',
        message: 'Nessuna CSS custom property (design tokens). Palette non sistematica.' });
    }
  }

  // 8. Buttons/inputs styling
  const hasButtonStyle = /button|\.btn|input\[type/i.test(allCss);
  if (!hasButtonStyle && /(<button|<input)/i.test(allContent)) {
    issues.push({ severity: 'medium', type: 'STYLING_INSUFFICIENT',
      message: 'Bottoni/input presenti nel markup ma non stilizzati nel CSS.' });
  }

  return issues;
}

// ── MAIN REVIEW: combines all checks ──
function reviewProjectQuality(job, plan, prompt) {
  const files = S.cur?.files || {};
  const fileKeys = Object.keys(files);
  const issues = [];
  const isComplex = isComplexRequest(prompt);
  const allContent = Object.values(files).join('\n');

  // ═══ STRUCTURAL CHECKS ═══
  addLog('test', '🔎', 'Functional Check', 'Analisi strutturale progetto…');

  // 1. Planned files vs actually created
  if (plan && plan.fileTree && plan.fileTree.length > 0) {
    const missing = plan.fileTree.filter(f => !files[f] || files[f].trim().length < 30);
    if (missing.length > 0) {
      issues.push({ severity: 'high', type: 'MISSING_FILES', message: 'File dal piano non generati o vuoti: ' + missing.join(', '), files: missing });
    }
  }

  // 2. Placeholder / stub / TODO detection
  const stubPatterns = [/TODO[:\s]/gi, /FIXME/gi, /placeholder/gi, /lorem ipsum/gi, /\bstub\b/gi, /not implemented/gi, /coming soon/gi];
  const stubFiles = [];
  for (const [path, content] of Object.entries(files)) {
    let stubCount = 0;
    for (const pat of stubPatterns) {
      pat.lastIndex = 0;
      const matches = content.match(pat);
      if (matches) stubCount += matches.length;
    }
    if (stubCount >= 3) stubFiles.push({ path, count: stubCount });
  }
  if (stubFiles.length > 0) {
    issues.push({ severity: 'high', type: 'PLACEHOLDERS', message: 'File con troppi placeholder/TODO/stub: ' + stubFiles.map(f => f.path + '(' + f.count + ')').join(', '), files: stubFiles.map(f => f.path) });
  }

  // 3. Feature keywords check
  if (isComplex) {
    const featureChecks = [
      { keywords: ['sidebar', 'side-bar'], patterns: [/sidebar/i, /side-bar/i, /aside/i, /nav.*vertical/i, /drawer/i] },
      { keywords: ['login', 'signin', 'sign-in'], patterns: [/login/i, /sign.?in/i, /password/i, /authenticate/i] },
      { keywords: ['dashboard'], patterns: [/dashboard/i, /widget/i, /stat.*card/i, /overview/i, /\.card/i] },
      { keywords: ['card', 'cards'], patterns: [/\.card/i, /card-/i, /card_/i, /Card/] },
      { keywords: ['modal', 'dialog', 'popup'], patterns: [/modal/i, /dialog/i, /overlay/i, /popup/i] },
      { keywords: ['chart', 'graph', 'grafico'], patterns: [/chart/i, /graph/i, /canvas/i, /svg.*path/i, /recharts/i, /chart\.js/i] },
      { keywords: ['localstorage', 'storage', 'persist', 'salva'], patterns: [/localStorage/i, /sessionStorage/i, /indexedDB/i, /\.setItem/i, /persist/i] },
      { keywords: ['responsive'], patterns: [/@media/i, /display\s*:\s*flex/i, /display\s*:\s*grid/i] },
      { keywords: ['router', 'routing', 'pagine', 'navigazione'], patterns: [/react-router/i, /createBrowserRouter/i, /Route/i, /useNavigate/i, /router/i, /hashchange/i] },
      { keywords: ['form', 'modulo', 'input'], patterns: [/<form/i, /<input/i, /onSubmit/i, /handleSubmit/i, /onChange/i] },
      { keywords: ['table', 'tabella'], patterns: [/<table/i, /<th/i, /\.table/i, /grid.*row/i] },
      { keywords: ['drag', 'drop', 'trascinamento'], patterns: [/drag/i, /drop/i, /onDrag/i, /draggable/i, /sortable/i] },
      { keywords: ['dark mode', 'tema scuro', 'theme'], patterns: [/dark/i, /theme/i, /color-scheme/i, /prefers-color-scheme/i] }
    ];
    const promptLow = (prompt || '').toLowerCase();
    const missingFeatures = [];
    for (const fc of featureChecks) {
      if (fc.keywords.some(kw => promptLow.includes(kw))) {
        if (!fc.patterns.some(pat => pat.test(allContent))) missingFeatures.push(fc.keywords[0]);
      }
    }
    if (missingFeatures.length > 0) {
      issues.push({ severity: 'high', type: 'MISSING_FEATURES', message: 'Feature richieste ma non trovate nel codice: ' + missingFeatures.join(', '), features: missingFeatures });
    }
  }

  // 4. UI skeleton check (very short main files)
  if (isComplex) {
    const mainFiles = fileKeys.filter(f => f === 'index.html' || f.includes('App.jsx') || f.includes('App.tsx') || f.includes('page.jsx'));
    for (const mf of mainFiles) {
      const lines = (files[mf] || '').split('\n').length;
      if (lines < 25) {
        issues.push({ severity: 'high', type: 'SKELETON_UI', message: 'File principale "' + mf + '" ha solo ' + lines + ' righe — scheletro non funzionale.', files: [mf] });
      }
    }
  }

  // ═══ FUNCTIONAL CHECKS (deep) ═══
  const funcIssues = runFunctionalChecks(files, fileKeys, allContent);
  issues.push(...funcIssues);
  if (funcIssues.length > 0) {
    addLog('test', '⚠️', 'Functional Check', funcIssues.length + ' problemi funzionali trovati.');
  } else {
    addLog('test', '✅', 'Functional Check', 'Nessun problema funzionale rilevato.');
  }

  // ═══ UI BASELINE CHECK ═══
  addLog('test', '🎨', 'UI Baseline', 'Verifica qualità visiva…');
  const uiIssues = runUIBaselineCheck(files, fileKeys, allContent, prompt);
  issues.push(...uiIssues);
  if (uiIssues.length > 0) {
    addLog('test', '⚠️', 'UI Baseline', uiIssues.length + ' problemi di qualità visiva trovati.');
  } else {
    addLog('test', '✅', 'UI Baseline', 'Qualità visiva OK.');
  }

  // Deduplicate
  const seen = new Set();
  const unique = issues.filter(i => {
    const key = i.type + ':' + i.message;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const highCount = unique.filter(i => i.severity === 'high').length;
  const mediumCount = unique.filter(i => i.severity === 'medium').length;
  return {
    isComplex,
    issues: unique,
    highCount,
    mediumCount,
    passed: highCount === 0
  };
}

// ── AI-POWERED QUALITY FIX PASS (v2: stronger, focused) ──
async function runQualityFixPass(job, plan, prompt, mode, qual, qReport) {
  if (!S.currentJob || S.currentJob.id !== job.id) return false;

  addLog('logic', '🔧', 'Quality Fix', 'Avvio fix pass per ' + qReport.issues.length + ' problemi…');
  updateJob(job, { status: 'QUALITY_FIX' });

  const files = S.cur?.files || {};
  const fileKeys = Object.keys(files);

  // Identify which files need fixing (mentioned in issues + CSS/UI files for visual issues)
  const issueFiles = new Set();
  const hasUIIssues = qReport.issues.some(i => ['UI_TOO_BASIC','STYLING_INSUFFICIENT','MODERN_UI_REQUIREMENTS_NOT_MET'].includes(i.type));
  const hasFuncIssues = qReport.issues.some(i => ['MISSING_HANDLER','MISSING_DOM_ELEMENT','BROKEN_IMPORT','MISSING_ASSET','SCRIPT_LOAD_ORDER','EMPTY_FUNCTIONS'].includes(i.type));

  for (const iss of qReport.issues) {
    if (iss.files) iss.files.forEach(f => issueFiles.add(f));
  }
  // Always include main UI files if visual issues exist
  if (hasUIIssues) {
    ['index.html', 'style.css', 'styles.css', 'src/index.css', 'src/App.css', 'src/App.jsx', 'src/App.tsx', 'app/page.jsx', 'app/page.tsx', 'app/globals.css']
      .filter(f => files[f]).forEach(f => issueFiles.add(f));
  }

  // Gather targeted file contents (budget ~24k chars — increased for quality fixes)
  let fileContext = '';
  const BUDGET = 24000;
  const priorityOrder = [...issueFiles, ...fileKeys.filter(f => !issueFiles.has(f))];
  for (const f of priorityOrder) {
    if (!files[f]) continue;
    const content = files[f];
    const maxSlice = issueFiles.has(f) ? 6000 : 2000; // More context for problematic files
    const add = '── ' + f + (issueFiles.has(f) ? ' [NEEDS FIX]' : '') + ' ──\n' + content.slice(0, maxSlice) + (content.length > maxSlice ? '\n/* … troncato … */' : '') + '\n\n';
    if (fileContext.length + add.length > BUDGET) break;
    fileContext += add;
  }

  // Categorize issues for the prompt
  const highIssues = qReport.issues.filter(i => i.severity === 'high');
  const medIssues = qReport.issues.filter(i => i.severity === 'medium');
  const issueList = [
    ...highIssues.map((iss, i) => (i + 1) + '. [CRITICO] ' + iss.type + ': ' + iss.message),
    ...medIssues.map((iss, i) => (highIssues.length + i + 1) + '. [MEDIO] ' + iss.type + ': ' + iss.message)
  ].join('\n');

  // Build a specialized system prompt based on issue types
  const uiFixBlock = hasUIIssues ? `
CORREZIONE UI OBBLIGATORIA — il progetto ha styling insufficiente. Devi:
- Aggiungere CSS custom properties (--primary, --bg, --surface, --text, --radius, --shadow)
- Background NON bianco: usa colore scuro o gradiente o pattern sottile
- Font Google (Inter, Poppins, o simile) con gerarchia: h1 > h2 > h3 > p
- Card/container con background surface, border-radius 12-16px, box-shadow
- Bottoni con padding, border-radius, colore primario, hover/active states
- Input con bordo, padding, focus ring
- Layout con flex/grid, gap consistente
- Transizioni smooth (0.2-0.3s ease)
- Media query per mobile (max-width: 768px)
- Se è dashboard/app: sidebar con bg scuro, main con bg leggermente diverso, stat cards visive` : '';

  const funcFixBlock = hasFuncIssues ? `
CORREZIONE FUNZIONALE OBBLIGATORIA — ci sono bug strutturali. Devi:
- Implementare OGNI funzione referenziata che manca (non lasciare corpi vuoti)
- Assicurati che ogni getElementById() abbia il suo elemento HTML
- Correggi import che puntano a file inesistenti
- Se un <link> o <script src> referenzia un file, crea quel file
- Controlla ordine script: defer o DOMContentLoaded se accedono al DOM
- Ogni handler deve avere logica reale, non un alert() o console.log()` : '';

  const fixSys = `Sei un SENIOR FULL-STACK DEVELOPER e UI DESIGNER con 15 anni di esperienza.
Il progetto generato ha problemi critici che devi correggere ORA.

MISSIONE: rendere il progetto REALMENTE FUNZIONANTE e VISIVAMENTE PROFESSIONALE.
${uiFixBlock}${funcFixBlock}

REGOLE:
- Restituisci SOLO i file che modifichi/crei — non tutti
- Ogni file restituito deve essere il file COMPLETO, non una patch
- Concentrati sui problemi CRITICI prima
- NON usare placeholder, TODO, o alert() come implementazione
- Se un file CSS esiste ma è troppo corto, restituiscilo COMPLETO e potenziato
- Se un file JS ha funzioni vuote, implementale con logica REALE

FORMATO OUTPUT — rispondi SOLO con JSON valido:
{"summary":"elenco concreto di cosa hai corretto","filesChanged":[{"path":"file.ext","action":"update","content":"CONTENUTO COMPLETO del file corretto"}]}`;

  const fixMsg = `RICHIESTA UTENTE ORIGINALE: "${prompt}"

PROBLEMI DA CORREGGERE (${qReport.issues.length}):
${issueList}

FILE DEL PROGETTO (quelli marcati [NEEDS FIX] hanno priorità):
${fileContext}

ISTRUZIONI: Correggi TUTTI i problemi CRITICI. Per i problemi UI, aggiungi styling completo e moderno. Per i problemi funzionali, implementa logica reale. Restituisci SOLO file modificati.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': S.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: MODELS.sonnet, max_tokens: 32000, temperature: 0.3, system: fixSys,
        messages: [{ role: 'user', content: fixMsg }]
      })
    });
    if (!r.ok) throw new Error('Quality fix API error: ' + r.status);
    const data = await r.json();
    const raw = data.content.map(b => b.text || '').join('').trim();

    const parsed = parseAIResponse(raw, mode);
    if (parsed.type === 'json' && parsed.data.filesChanged && parsed.data.filesChanged.length > 0) {
      saveSnapshot('Pre-quality-fix', job.id);
      const result = applyJsonPatch(parsed, prompt);
      saveSnapshot('Post-quality-fix', job.id);
      addLog('test', '✅', 'Quality Fix', result.changedFiles.length + ' file corretti (' + result.totalLines + ' righe): ' + result.changedFiles.join(', '));
      return true;
    } else {
      addLog('test', '⚠️', 'Quality Fix', 'Fix pass non ha prodotto modifiche valide — risposta AI non parsabile.');
      return false;
    }
  } catch (e) {
    addLog('test', '❌', 'Quality Fix', 'Errore durante fix pass: ' + e.message);
    return false;
  }
}

// ── QUALITY GATE ORCHESTRATOR (v2: retry + incomplete status) ──
const QG_MAX_RETRIES = 2;

async function runProjectQualityGate(job, plan, prompt, mode, qual) {
  if (!S.currentJob || S.currentJob.id !== job.id) return;

  addLog('test', '🔍', 'Quality Gate', 'Avvio revisione qualità progetto…');
  updateJob(job, { status: 'QUALITY_REVIEW' });

  let qReport = reviewProjectQuality(job, plan, prompt);

  if (qReport.issues.length === 0) {
    addLog('test', '✅', 'Quality Gate', 'FINAL_QUALITY passed — nessun problema rilevato!');
    return;
  }

  // Log all issues
  for (const iss of qReport.issues) {
    const icon = iss.severity === 'high' ? '🔴' : '🟡';
    addLog('test', icon, 'Quality Gate', '[' + iss.severity.toUpperCase() + '] ' + iss.type + ': ' + iss.message);
  }

  if (qReport.passed) {
    addLog('test', '🟡', 'Quality Gate', 'FINAL_QUALITY passed con ' + qReport.mediumCount + ' avvertimenti.');
    return;
  }

  // ── FIX LOOP (up to QG_MAX_RETRIES) ──
  for (let attempt = 1; attempt <= QG_MAX_RETRIES; attempt++) {
    if (!S.currentJob || S.currentJob.id !== job.id) return;

    addLog('test', '🔴', 'Quality Gate', 'QUALITY_FIX retry ' + attempt + '/' + QG_MAX_RETRIES + ' — ' + qReport.highCount + ' problemi critici…');
    renderBbl('ai', '🔍 **Quality Gate**: ' + qReport.highCount + ' problemi critici. Correzione automatica (' + attempt + '/' + QG_MAX_RETRIES + ')…');

    const fixed = await runQualityFixPass(job, plan, prompt, mode, qual, qReport);

    if (!fixed) {
      addLog('test', '⚠️', 'Quality Gate', 'Fix pass ' + attempt + ' non ha prodotto risultati.');
      if (attempt === QG_MAX_RETRIES) break;
      continue;
    }

    // Re-check
    updateJob(job, { status: 'QUALITY_REVIEW' });
    qReport = reviewProjectQuality(job, plan, prompt);

    if (qReport.passed) {
      addLog('test', '✅', 'Quality Gate', 'FINAL_QUALITY passed dopo fix pass ' + attempt + '!');
      renderBbl('ai', '✅ **Quality Gate superato** dopo correzione automatica.');
      return;
    }

    // Log remaining issues
    for (const iss of qReport.issues.filter(i => i.severity === 'high')) {
      addLog('test', '🔴', 'Quality Gate', '[RESIDUO] ' + iss.type + ': ' + iss.message);
    }
  }

  // ── FAILED: mark as incomplete ──
  const remaining = qReport.issues.filter(i => i.severity === 'high');
  addLog('test', '❌', 'Quality Gate', 'FINAL_QUALITY failed — ' + remaining.length + ' problemi critici dopo ' + QG_MAX_RETRIES + ' tentativi.');
  renderBbl('ai', '⚠️ **Quality Gate non superato**: ' + remaining.length + ' problemi residui. Il progetto potrebbe richiedere miglioramenti manuali.');
  updateJob(job, {
    qualityIssues: remaining.map(i => i.type + ': ' + i.message),
    qualityPassed: false
  });
}

// Auto-fix loop: try to fix code that errored
async function autoFixLoop(job, mode, qual) {
  if (!S.currentJob || S.currentJob.id !== job.id) return; // cancelled
  if (job.attempt >= JOB_MAX_FIX) {
    updateJob(job, { status: 'FAILED' });
    renderBbl('ai', '❌ **Max tentativi raggiunti** (' + JOB_MAX_FIX + '). Serve intervento umano.');
    saveMsg('ai', '❌ Fix fallito dopo ' + JOB_MAX_FIX + ' tentativi.');
    toast('❌ Job fallito', 'err');
    return;
  }

  updateJob(job, { status: 'FIX', attempt: job.attempt + 1 });
  saveSnapshot('Before Fix #' + job.attempt, job.id);
  addLog('logic', '🔧', 'Fix Agent', 'Tentativo #' + job.attempt + ' — correggo errori…');

  try {
    const fixPrompt = buildFixPrompt(job);
    const raw = await callAPIMultiFile(fixPrompt, mode, qual, true, 'logic', null, buildContextPack(job, null));
    const parsed = parseAIResponse(raw, mode);

    // Apply fix
    const result = applyJsonPatch(parsed, job.userGoal);
    job.changedFiles = result.changedFiles;
    saveSnapshot('After Fix #' + job.attempt, job.id);

    // Re-verify: static → DONE, Node → sandbox
    if (isNodeProject()) {
      updateJob(job, { status: 'RUN', runLogs: '' });
      addLog('test', '🚀', 'Runner', 'Ri-esecuzione sandbox dopo fix #' + job.attempt + '…');
      await runSandboxForJob(job, mode, qual);
    } else {
      updateJob(job, { status: 'DONE' });
      const ln = result.totalLines;
      renderBbl('ai', '✅ **Fix applicato** — ' + result.changedFiles.length + ' file, ' + ln + ' righe. Tentativo #' + job.attempt);
      saveMsg('ai', '✅ Fix #' + job.attempt + ': ' + ln + ' righe.');
      toast('✅ Fix completato', 'ok');
    }
  } catch(e) {
    updateJob(job, { status: 'FAILED', errorsDetected: [...job.errorsDetected, { type: 'API', message: e.message }] });
    renderBbl('ai', '❌ Errore fix: ' + e.message);
    toast('❌ Fix fallito', 'err');
  }
}


