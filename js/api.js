// ══════════════════════════════════
// AUTO-RETRY ON ERROR
// ══════════════════════════════════
const MAX_RETRIES = 2;

async function callAPIWithRetry(prompt, mode, qual, isEdit, agent, retryCount=0) {
  try {
    return await callAPI(prompt, mode, qual, isEdit, agent);
  } catch(err) {
    // Don't retry auth errors or if max retries reached
    if (err.message.includes('401') || err.message.includes('403') || retryCount >= MAX_RETRIES) throw err;

    // Show retry bar in chat
    showRetryBar(retryCount + 1, MAX_RETRIES, err.message);
    await sleep(1500 * (retryCount + 1)); // exponential backoff

    // On retry, add error context to prompt
    const retryPrompt = prompt + `

[RETRY #${retryCount+1}/${MAX_RETRIES}]
Il tentativo precedente è FALLITO con errore: "${err.message}"
ISTRUZIONI DI RETRY:
- Genera codice più semplice e robusto.
- Se l'errore era un timeout o rate limit, riduci la complessità.
- Se l'errore era nel codice, evita il pattern che ha causato il problema.
- Mantieni TUTTE le funzionalità richieste ma con implementazione più sicura.`;
    return callAPIWithRetry(retryPrompt, mode, qual, isEdit, agent, retryCount + 1);
  }
}

function showRetryBar(attempt, max, errMsg) {
  const msgs = document.getElementById('msgs');
  const bar = document.createElement('div');
  bar.className = 'retry-bar show';
  bar.id = 'retry-bar-' + attempt;
  bar.innerHTML = `<div class="retry-spinner"></div><span>Tentativo ${attempt}/${max} — Errore: ${errMsg.slice(0,60)}… Riprovo automaticamente</span>`;
  msgs.appendChild(bar);
  bar.scrollIntoView({behavior:'smooth', block:'nearest'});
}

// ══════════════════════════════════
// MULTI-FILE OUTPUT (v8g)
// ══════════════════════════════════

// Detect if project is Node-based (needs sandbox)
function isNodeProject() {
  if (!S.cur || !S.cur.files) return false;
  return !!S.cur.files['package.json'];
}

// Detect if project is static frontend only
function isStaticFrontend() {
  if (!S.cur || !S.cur.files) return true;
  const files = Object.keys(S.cur.files);
  return !files.includes('package.json') && files.some(f => f.endsWith('.html'));
}

// Detect if project needs a build step (Vite/React, Next, Node Express)
// These can't be previewed via srcdoc or deployed raw to GitHub Pages.
function needsBuild() {
  if (!S.cur || !S.cur.files) return false;
  const pkg = S.cur.files['package.json'];
  if (!pkg) return false;
  // Check for framework markers
  const hasViteConfig = !!S.cur.files['vite.config.js'] || !!S.cur.files['vite.config.ts'];
  const hasJSX = Object.keys(S.cur.files).some(f => /\.jsx$|\.tsx$/.test(f));
  const hasNextConfig = !!S.cur.files['next.config.js'] || !!S.cur.files['next.config.mjs'];
  const hasServerEntry = !!S.cur.files['server.js'] || !!S.cur.files['server.ts'];
  // Also sniff package.json for "vite", "react", "next", "express"
  const pkgLower = pkg.toLowerCase();
  const isFramework = hasViteConfig || hasJSX || hasNextConfig ||
    /\"(vite|react|next|express)\"/.test(pkgLower);
  return isFramework || hasServerEntry;
}

// Returns a label for the project type (for UI messages)
function getProjectKind() {
  if (!needsBuild()) return 'static';
  const pkg = (S.cur?.files?.['package.json'] || '').toLowerCase();
  if (/\"next\"/.test(pkg)) return 'nextjs';
  if (/\"express\"/.test(pkg) || S.cur?.files?.['server.js']) return 'node-express';
  if (/\"vite\"/.test(pkg) || S.cur?.files?.['vite.config.js']) return 'vite-react';
  return 'node';
}

// ══════════════════════════════════
// CLARIFY — Domande chiarificatrici (v8k)
// ══════════════════════════════════

// Detect if a prompt mentions UI/style/design preferences
const STYLE_KEYWORDS = /stile|design|grafica|layout|colori?|tema|font|aspetto|interfaccia|ui|ux|moderno|minimal|dark|light|material|glass|neon|retro|vintage|corporate|elegante|professionale|colorato|giocoso/i;

async function callAPIClarify(prompt, mode) {
  const hasStyleHints = STYLE_KEYWORDS.test(prompt);

  const clarifySys = `Sei un assistente esperto di sviluppo software. Il tuo compito è analizzare la richiesta dell'utente e generare domande chiarificatrici SOLO se servono.

Rispondi SOLO con questo JSON valido (nessun testo prima o dopo):
{
  "needsClarification": true|false,
  "questions": [
    {"id": "q1", "text": "Testo della domanda", "options": ["Opzione A", "Opzione B", "Opzione C"], "category": "functionality|style|data|ux"},
    ...
  ]
}

REGOLE:
- Se la richiesta è chiara e completa, rispondi con {"needsClarification": false, "questions": []}.
- Genera MASSIMO 4 domande, MINIMO 1 se needsClarification è true.
- Ogni domanda DEVE avere 2-4 opzioni predefinite tra cui scegliere (l'utente può anche rispondere a testo libero).
- Le domande devono essere UTILI e CONCRETE, non generiche.
- NON chiedere cose ovvie o che si possono dedurre dal contesto.

QUANDO CHIEDERE (needsClarification: true):
1. **Stile/Design**: Se il prompt NON specifica preferenze di stile visivo (colori, tema, layout), chiedi SEMPRE almeno una domanda sullo stile. Esempi:
   - "Che stile visivo preferisci?" con opzioni tipo ["Dark mode minimalista", "Chiaro e professionale", "Colorato e moderno", "Altro"]
   - "Che palette colori preferisci?" con opzioni concrete
   - "Che tipo di layout?" con opzioni specifiche al tipo di app
${hasStyleHints ? '   NOTA: L\'utente ha già indicato preferenze di stile — NON chiedere di stile a meno che manchino dettagli importanti.' : '   NOTA: L\'utente NON ha specificato lo stile — CHIEDI SEMPRE almeno una domanda su design/colori/layout.'}
2. **Funzionalità ambigue**: Se ci sono requisiti che possono essere interpretati in modi diversi.
3. **Dati/Contenuti**: Se servono dati specifici che l'utente non ha fornito (es. categorie, ruoli utente, campi specifici).
4. **UX**: Se il flusso utente non è chiaro (es. serve login? come si naviga?).

QUANDO NON CHIEDERE (needsClarification: false):
- Richieste semplici e dirette (es. "crea un timer", "fai un calcolatore").
- Quando il prompt è già molto dettagliato con specifiche tecniche.
- Per modifiche a codice esistente (es. "cambia il colore del bottone").
- Se l'utente ha esplicitamente descritto stile, funzionalità e struttura.`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {'Content-Type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body: JSON.stringify({
      model: getModelForAgent('plan'), max_tokens: 1200, temperature: 0.4, system: clarifySys,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!r.ok) throw new Error('Clarify API error');
  const data = await r.json();
  const raw = data.content.map(b => b.text || '').join('').trim();

  let cleaned = raw.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch(e) {
    const m = cleaned.match(/\{[\s\S]*"questions"[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]); } catch(e2) {}
  }
  return { needsClarification: false, questions: [] };
}

// Show clarification questions as a centered modal overlay
function showClarifyUI(clarifyData) {
  if (!clarifyData || !clarifyData.needsClarification || !clarifyData.questions?.length) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const modal = document.getElementById('clarify-modal');
    const ov = document.getElementById('clarify-ov');

    const questionsHTML = clarifyData.questions.map((q, i) => {
      const optionsHTML = (q.options || []).map(opt =>
        '<button class="clarify-opt" data-qid="' + q.id + '" data-val="' + escHtml(opt) + '">' + escHtml(opt) + '</button>'
      ).join('');

      return '<div class="clarify-q" data-qid="' + q.id + '">' +
        '<div class="clarify-q-text"><span class="clarify-q-num">' + (i+1) + '</span>' + escHtml(q.text) + '</div>' +
        '<div class="clarify-opts">' + optionsHTML + '</div>' +
        '<input type="text" class="clarify-custom" data-qid="' + q.id + '" placeholder="O scrivi una risposta personalizzata…">' +
        '</div>';
    }).join('');

    modal.innerHTML =
      '<div class="modal-spin-header">' +
        '<div class="modal-spin-icon">💬</div>' +
        '<div class="clarify-title-wrap">' +
          '<div class="clarify-title">Prima di iniziare…</div>' +
          '<div class="clarify-subtitle">Rispondi per personalizzare il risultato</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-scroll-body">' + questionsHTML + '</div>' +
      '<div class="clarify-actions">' +
        '<button class="clarify-btn confirm" id="clarify-confirm-btn">✓ Conferma e genera</button>' +
        '<button class="clarify-btn skip" id="clarify-skip-btn">⏭ Salta — genera subito</button>' +
      '</div>';

    ov.classList.add('open');

    // Handle option clicks — toggle selected
    modal.querySelectorAll('.clarify-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const qid = btn.dataset.qid;
        modal.querySelectorAll('.clarify-opt[data-qid="' + qid + '"]').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const customInp = modal.querySelector('.clarify-custom[data-qid="' + qid + '"]');
        if (customInp) customInp.value = '';
      });
    });

    // Custom input clears option selection
    modal.querySelectorAll('.clarify-custom').forEach(inp => {
      inp.addEventListener('input', () => {
        if (inp.value.trim()) {
          const qid = inp.dataset.qid;
          modal.querySelectorAll('.clarify-opt[data-qid="' + qid + '"]').forEach(b => b.classList.remove('selected'));
        }
      });
    });

    const collectAnswers = () => {
      const answers = {};
      clarifyData.questions.forEach(q => {
        const selected = modal.querySelector('.clarify-opt[data-qid="' + q.id + '"].selected');
        const custom = modal.querySelector('.clarify-custom[data-qid="' + q.id + '"]');
        if (custom && custom.value.trim()) {
          answers[q.id] = { question: q.text, answer: custom.value.trim() };
        } else if (selected) {
          answers[q.id] = { question: q.text, answer: selected.dataset.val };
        }
      });
      return answers;
    };

    document.getElementById('clarify-confirm-btn').onclick = () => {
      const answers = collectAnswers();
      ov.classList.remove('open');
      let context = '';
      const answered = Object.values(answers);
      if (answered.length > 0) {
        context = '\n\n[PREFERENZE UTENTE]\n' + answered.map(a => '- ' + a.question + ' → ' + a.answer).join('\n');
        const summaryParts = answered.map(a => a.answer);
        addLog('plan', '💬', 'Chiarimenti', summaryParts.join(' · '));
        saveMsg('ai', '💬 Risposte: ' + summaryParts.join(', '));
        renderBbl('ai', '💬 **Preferenze salvate:** ' + summaryParts.join(', '));
      }
      resolve(context);
    };

    document.getElementById('clarify-skip-btn').onclick = () => {
      ov.classList.remove('open');
      addLog('plan', '⏭', 'Chiarimenti saltati', 'Generazione con parametri default');
      resolve('');
    };

    saveMsg('ai', '💬 ' + clarifyData.questions.length + ' domande chiarificatrici');
  });
}

// ══════════════════════════════════
// PLAN PROJECT (v8h)
// ══════════════════════════════════
async function callAPIPlan(prompt, mode, hasCode) {
  const existingFiles = S.cur && Object.keys(S.cur.files).length
    ? 'File esistenti: ' + Object.keys(S.cur.files).join(', ')
    : 'Progetto vuoto.';

  const planSys = `Sei un architetto software senior. Analizza la richiesta e produci un piano di progetto JSON.

Rispondi SOLO con questo JSON valido (nessun testo prima o dopo):
{
  "projectType": "static-html|vite-react|nextjs|node-express|html-game",
  "stack": {"frontend":"descrizione breve", "backend":"descrizione breve o none", "db":"descrizione breve o none"},
  "fileTree": ["path/file1.ext", "path/file2.ext"],
  "milestones": [
    {"name":"Setup base", "files":["package.json","index.html"]},
    {"name":"Componenti UI", "files":["src/App.jsx","src/components/X.jsx"]}
  ],
  "notes": ["nota1", "nota2"]
}

REGOLE projectType — scegli UNO di questi tipi:
1. html-game → gioco HTML semplice (snake, tetris, pong). fileTree=["index.html"] (tutto in uno va bene).
2. static-html → app HTML classica senza framework. MINIMO OBBLIGATORIO: index.html, style.css, app.js (3 file separati, MAI un monolite).
3. vite-react → app React con Vite. MINIMO OBBLIGATORIO: package.json, vite.config.js, index.html, src/main.jsx, src/App.jsx.
4. nextjs → app Next.js. MINIMO OBBLIGATORIO: package.json, app/layout.jsx, app/page.jsx, app/globals.css.
5. node-express → server Node + Express. MINIMO OBBLIGATORIO: package.json, server.js, public/index.html.

REGOLE fileTree:
- fileTree DEVE contenere ALMENO i file minimi obbligatori per il tipo scelto.
- Se la richiesta menziona dashboard, sidebar, login, auth, crud, admin, moduli, componenti, storage, database, API, router, chart, tabs, modal, calendario, profilo, ricerca, filtri, notifiche: ESPANDI il fileTree con file aggiuntivi coerenti (componenti, route, servizi, pagine).
- Per React con UI complessa: aggiungi src/components/NomeComponente.jsx per ogni componente logico.
- Per Express con API: aggiungi routes/nomeRoute.js per ogni gruppo di endpoint.
- Per static-html con sezioni multiple: aggiungi file JS separati per logica complessa (es. storage.js, api.js, ui.js).
- Ogni file nel fileTree DEVE essere coperto da almeno un milestone.

REGOLE milestones:
- Dividi in 1-5 step logici. Ogni step elenca i suoi file.
- Step 1 è SEMPRE il setup base (package.json, config, entrypoints).
- Step successivi aggiungono componenti, pagine, servizi.

REGOLE generali:
- NON generare codice — solo il piano strutturale.
- NON usare projectType="other" — scegli il tipo più vicino tra i 5 disponibili.
- Se l'utente chiede esplicitamente "un singolo file HTML" o "tutto in un file", usa html-game.
- Altrimenti preferisci SEMPRE la struttura multi-file.
- notes: suggerimenti tecnici, librerie consigliate, edge cases.

${existingFiles}`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {'Content-Type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body: JSON.stringify({
      model: getModelForAgent('plan'), max_tokens: 2000, temperature: 0.3, system: planSys,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!r.ok) throw new Error('Plan API error');
  const data = await r.json();
  const raw = data.content.map(b => b.text || '').join('').trim();

  // Parse plan JSON
  let cleaned = raw.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
  let plan = null;
  try {
    plan = JSON.parse(cleaned);
  } catch(e) {
    const m = cleaned.match(/\{[\s\S]*"fileTree"[\s\S]*\}/);
    if (m) try { plan = JSON.parse(m[0]); } catch(e2) {}
  }
  // Enforce minimum fileTree and fix milestones
  if (plan) plan = enforcePlanMinimum(plan, prompt);
  return plan;
}

function showPlanInUI(plan) {
  if (!plan) return Promise.resolve(plan);

  return new Promise((resolve) => {
    const fileCount = plan.fileTree ? plan.fileTree.length : 0;
    const modal = document.getElementById('plan-modal');
    const ov = document.getElementById('plan-ov');

    // Stack info
    const stackParts = [];
    if (plan.stack) {
      if (plan.stack.frontend && plan.stack.frontend !== 'none') stackParts.push('<span class="plan-stack-tag fe">FE: ' + plan.stack.frontend + '</span>');
      if (plan.stack.backend && plan.stack.backend !== 'none') stackParts.push('<span class="plan-stack-tag be">BE: ' + plan.stack.backend + '</span>');
      if (plan.stack.db && plan.stack.db !== 'none') stackParts.push('<span class="plan-stack-tag db">DB: ' + plan.stack.db + '</span>');
    }

    // Milestones
    const milestoneHTML = (plan.milestones || []).map((m, i) =>
      '<div class="plan-milestone"><span class="plan-ms-num">' + (i+1) + '</span><span class="plan-ms-name">' + m.name + '</span><span class="plan-ms-files">' + (m.files||[]).join(', ') + '</span></div>'
    ).join('');

    // File tree with editable chips
    const fileChipsHTML = (plan.fileTree || []).map(f =>
      '<span class="plan-file-chip" data-file="' + f + '">' + ficon(f) + ' ' + f + '<button class="plan-file-rm" title="Rimuovi file" onclick="this.parentElement.remove()">×</button></span>'
    ).join('');

    // Notes
    const notesHTML = (plan.notes || []).map(n => '<div class="plan-note">• ' + n + '</div>').join('');

    // Model routing preview
    const isComplex = fileCount > 5 || COMPLEX_KEYWORDS.test(S.currentJob?.userGoal || '');
    const routeInfo = S.model === 'auto'
      ? '<div class="plan-route"><span class="plan-route-label">Auto-Route:</span>' +
        '<span class="plan-route-chip plan">Plan → Sonnet</span>' +
        '<span class="plan-route-chip ui">UI → ' + (isComplex ? 'Sonnet' : 'Haiku') + '</span>' +
        '<span class="plan-route-chip logic">Logic → ' + (isComplex ? 'Opus' : 'Sonnet') + '</span>' +
        '<span class="plan-route-chip test">Test → Sonnet</span>' +
        '</div>'
      : '';

    modal.innerHTML =
      '<div class="modal-spin-header plan-header-modal">' +
        '<div class="modal-spin-icon">📋</div>' +
        '<div class="plan-title-wrap">' +
          '<div class="plan-title">Piano progetto</div>' +
          '<div class="plan-type">' + (plan.projectType || '') + ' · ' + fileCount + ' file</div>' +
        '</div>' +
      '</div>' +
      (stackParts.length ? '<div class="plan-stack">' + stackParts.join('') + '</div>' : '') +
      routeInfo +
      '<div class="modal-scroll-body">' +
        '<div class="plan-section">' +
          '<div class="plan-section-title">File da generare</div>' +
          '<div class="plan-files" id="plan-files-list">' + fileChipsHTML + '</div>' +
          '<div class="plan-add-file"><input type="text" class="plan-add-input" id="plan-add-input" placeholder="Aggiungi file… (es. src/utils.js)" onkeydown="if(event.key===\'Enter\')addPlanFile()"><button class="plan-add-btn" onclick="addPlanFile()">+</button></div>' +
        '</div>' +
        (milestoneHTML ? '<div class="plan-section"><div class="plan-section-title">Milestones</div>' + milestoneHTML + '</div>' : '') +
        (notesHTML ? '<div class="plan-section"><div class="plan-section-title">Note</div>' + notesHTML + '</div>' : '') +
      '</div>' +
      '<div class="plan-actions">' +
        '<button class="plan-btn confirm" id="plan-confirm-btn">▶ Genera progetto</button>' +
        '<button class="plan-btn skip" id="plan-skip-btn">⏭ Salta piano</button>' +
      '</div>';

    ov.classList.add('open');

    saveMsg('ai', '📋 Piano: ' + fileCount + ' file, ' + (plan.milestones||[]).length + ' step');

    // ── Confirm: read back edited file list and resolve ──
    document.getElementById('plan-confirm-btn').onclick = () => {
      const chips = modal.querySelectorAll('.plan-file-chip');
      const editedFiles = [...chips].map(c => c.dataset.file).filter(Boolean);
      if (editedFiles.length > 0) {
        plan.fileTree = editedFiles;
        plan = enforcePlanMinimum(plan, S.currentJob?.userGoal || '');
      }
      ov.classList.remove('open');
      addLog('plan', '✅', 'Piano confermato', editedFiles.length + ' file — avvio generazione');
      renderBbl('ai', '📋 **Piano confermato** — ' + editedFiles.length + ' file, avvio generazione…');
      resolve(plan);
    };

    // ── Skip: resolve with null to trigger fallback single-shot ──
    document.getElementById('plan-skip-btn').onclick = () => {
      ov.classList.remove('open');
      addLog('plan', '⏭', 'Piano saltato', 'Generazione diretta senza piano');
      resolve(null);
    };
  });
}

// Helper: add a file chip to the plan editor
function addPlanFile() {
  const inp = document.getElementById('plan-add-input');
  const val = (inp?.value || '').trim();
  if (!val) return;
  const list = document.getElementById('plan-files-list');
  if (!list) return;
  // Avoid duplicates
  if (list.querySelector('[data-file="' + val + '"]')) { inp.value = ''; return; }
  const chip = document.createElement('span');
  chip.className = 'plan-file-chip';
  chip.dataset.file = val;
  chip.innerHTML = ficon(val) + ' ' + val + '<button class="plan-file-rm" title="Rimuovi file" onclick="this.parentElement.remove()">×</button>';
  list.appendChild(chip);
  inp.value = '';
}

// ══════════════════════════════════
// PLAN ENFORCEMENT (v8j-p3)
// ══════════════════════════════════

// Minimum required files per project type
// Enforce minimum fileTree on a parsed plan. Mutates plan in place.
function enforcePlanMinimum(plan, userPrompt) {
  if (!plan || !plan.projectType) return plan;
  const type = plan.projectType;

  // Get the minimum for this type
  const minimum = PLAN_MINIMUMS[type];
  if (!minimum) return plan; // unknown type, trust LLM

  // Ensure fileTree exists
  if (!plan.fileTree) plan.fileTree = [];

  // Add any missing minimum files
  for (const f of minimum) {
    if (!plan.fileTree.includes(f)) {
      plan.fileTree.push(f);
    }
  }

  // If prompt signals complexity, ensure planner expanded beyond minimum
  if (COMPLEX_KEYWORDS.test(userPrompt) && type !== 'html-game') {
    // For React: ensure at least one component beyond App
    if (type === 'vite-react' && !plan.fileTree.some(f => /^src\/components\//.test(f))) {
      // Don't invent names — just add a placeholder path the LLM already might have
      // This is a soft hint; the real expansion comes from the stronger prompt
    }
    // For static: ensure separate CSS
    if ((type === 'static' || type === 'static-html') && plan.fileTree.length <= 3) {
      // Prompt already asks for expansion — we just ensure minimum is there
    }
  }

  // Rebuild milestones if they don't cover all fileTree files
  if (plan.milestones && plan.milestones.length) {
    const coveredFiles = new Set(plan.milestones.flatMap(m => m.files || []));
    const uncovered = plan.fileTree.filter(f => !coveredFiles.has(f));
    if (uncovered.length > 0) {
      // Add uncovered files to the first milestone (setup)
      if (plan.milestones[0]) {
        plan.milestones[0].files = [...new Set([...(plan.milestones[0].files || []), ...uncovered])];
      }
    }
  } else {
    // No milestones — create one covering all files
    plan.milestones = [{ name: 'Setup completo', files: [...plan.fileTree] }];
  }

  return plan;
}

// Validate that generation output respects the plan (not monofile when plan is multi-file)
function validateGenerationVsPlan(parsed, plan) {
  if (!plan || !plan.fileTree || plan.fileTree.length <= 1) return { valid: true };
  if (plan.projectType === 'html-game') return { valid: true };

  // If plan expects multiple files but output is raw (single file) → invalid
  if (parsed.type === 'raw') {
    return {
      valid: false,
      reason: `Piano prevede ${plan.fileTree.length} file ma la generazione ha prodotto un singolo file. Output incompleto.`
    };
  }

  // If plan expects multiple files but output has only 1 → invalid
  if (parsed.type === 'json' && parsed.data.filesChanged && parsed.data.filesChanged.length === 1) {
    const singleFile = parsed.data.filesChanged[0]?.path || '';
    // Allow if it's a targeted edit (user editing specific file)
    if (plan.fileTree.length > 3 && singleFile === 'index.html') {
      return {
        valid: false,
        reason: `Piano prevede ${plan.fileTree.length} file ma generato solo ${singleFile}. Fallback monofile bloccato.`
      };
    }
  }

  return { valid: true };
}

// ══════════════════════════════════
// SCAFFOLD PHASE (v8i)
// ══════════════════════════════════

// Get scaffold files for a given project type
function getScaffoldFiles(projectType) {
  // ═══════════════════════════════════════════════════════════════
  // RICH SCAFFOLDS — real app foundations the AI will EXTEND
  // Each scaffold provides a functional starting point with:
  // - Complete design system (CSS vars, dark theme, components)
  // - Real layout structure (sidebar, toolbar, content grid)
  // - JS app skeleton (state, init, render, utilities)
  // ═══════════════════════════════════════════════════════════════

  const DESIGN_SYSTEM_CSS = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{
  --primary:#6366f1;--primary-hover:#4f46e5;
  --bg:#0f172a;--bg-alt:#0b1120;
  --surface:#1e293b;--surface-hover:#334155;
  --border:#334155;--border-light:rgba(255,255,255,0.06);
  --text:#f1f5f9;--text-muted:#94a3b8;--text-dim:#64748b;
  --success:#10b981;--warning:#f59e0b;--danger:#ef4444;
  --radius:12px;--radius-sm:8px;--radius-lg:16px;
  --shadow:0 4px 24px rgba(0,0,0,0.3);--shadow-sm:0 2px 8px rgba(0,0,0,0.2);
  --transition:0.2s ease;
}
body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;line-height:1.6}
#app{display:flex;min-height:100vh}
.sidebar{width:260px;background:var(--bg-alt);border-right:1px solid var(--border);padding:1.5rem;display:flex;flex-direction:column;gap:0.5rem;position:fixed;top:0;left:0;bottom:0;overflow-y:auto}
.sidebar .logo{font-size:1.25rem;font-weight:700;padding:0.5rem;margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem}
.sidebar .nav-item{padding:0.6rem 0.8rem;border-radius:var(--radius-sm);color:var(--text-muted);cursor:pointer;transition:all var(--transition);display:flex;align-items:center;gap:0.6rem;font-size:0.9rem;font-weight:500}
.sidebar .nav-item:hover,.sidebar .nav-item.active{background:var(--surface);color:var(--text)}
.main-content{margin-left:260px;flex:1;padding:2rem;display:flex;flex-direction:column;gap:1.5rem}
.toolbar{display:flex;align-items:center;justify-content:space-between;gap:1rem}
.toolbar h1{font-size:1.5rem;font-weight:700}
.toolbar .actions{display:flex;gap:0.5rem}
.content-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem}
.card{background:var(--surface);border:1px solid var(--border-light);border-radius:var(--radius);padding:1.25rem;transition:all var(--transition);cursor:pointer}
.card:hover{transform:translateY(-2px);box-shadow:var(--shadow);border-color:var(--border)}
.card .card-title{font-weight:600;margin-bottom:0.5rem}
.card .card-desc{color:var(--text-muted);font-size:0.875rem;line-height:1.5}
.card .card-meta{display:flex;align-items:center;gap:0.5rem;margin-top:0.75rem;font-size:0.8rem;color:var(--text-dim)}
.btn{padding:0.55rem 1.1rem;border:none;border-radius:var(--radius-sm);font-weight:600;font-size:0.875rem;cursor:pointer;transition:all var(--transition);display:inline-flex;align-items:center;gap:0.4rem}
.btn-primary{background:var(--primary);color:#fff}.btn-primary:hover{background:var(--primary-hover);transform:translateY(-1px)}
.btn-secondary{background:var(--surface);color:var(--text);border:1px solid var(--border)}.btn-secondary:hover{background:var(--surface-hover)}
.btn-danger{background:rgba(239,68,68,0.15);color:var(--danger)}.btn-danger:hover{background:rgba(239,68,68,0.25)}
.input,.search-input{padding:0.55rem 0.9rem;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);color:var(--text);font-size:0.875rem;outline:none;transition:border var(--transition);width:100%}
.input:focus,.search-input:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(99,102,241,0.15)}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;opacity:0;pointer-events:none;transition:opacity 0.2s}
.modal-overlay.active{opacity:1;pointer-events:all}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.5rem;width:90%;max-width:480px;box-shadow:0 25px 60px rgba(0,0,0,0.4)}
.modal h2{font-size:1.2rem;margin-bottom:1rem}
.modal .modal-actions{display:flex;gap:0.5rem;justify-content:flex-end;margin-top:1.25rem}
.toast{position:fixed;bottom:1.5rem;right:1.5rem;padding:0.75rem 1.25rem;border-radius:var(--radius-sm);color:#fff;font-weight:500;font-size:0.875rem;z-index:2000;transform:translateY(20px);opacity:0;transition:all 0.3s ease;pointer-events:none}
.toast.show{transform:translateY(0);opacity:1}
.toast.success{background:var(--success)}.toast.error{background:var(--danger)}.toast.warning{background:var(--warning)}
.empty-state{text-align:center;padding:3rem 1rem;color:var(--text-dim)}
.empty-state .empty-icon{font-size:3rem;margin-bottom:1rem;opacity:0.5}
.badge{display:inline-flex;align-items:center;padding:0.2rem 0.6rem;border-radius:99px;font-size:0.75rem;font-weight:600}
.badge-primary{background:rgba(99,102,241,0.15);color:var(--primary)}
.badge-success{background:rgba(16,185,129,0.15);color:var(--success)}
@media(max-width:768px){
  .sidebar{display:none}
  .main-content{margin-left:0;padding:1rem}
  .content-grid{grid-template-columns:1fr}
  .toolbar{flex-direction:column;align-items:stretch}
}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.card{animation:fadeIn 0.3s ease both}
.card:nth-child(2){animation-delay:0.05s}.card:nth-child(3){animation-delay:0.1s}.card:nth-child(4){animation-delay:0.15s}`;

  const SCAFFOLD_HTML_STATIC = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>App</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div id="app">
  <aside class="sidebar">
    <div class="logo"><!-- APP LOGO --></div>
    <nav id="nav-list">
      <div class="nav-item active">Home</div>
    </nav>
  </aside>
  <main class="main-content">
    <header class="toolbar">
      <h1>Dashboard</h1>
      <div class="actions">
        <input class="search-input" placeholder="Search..." id="searchInput" style="width:220px">
        <button class="btn btn-primary" id="addBtn">+ New</button>
      </div>
    </header>
    <section class="content-grid" id="contentGrid">
      <!-- Cards rendered by JS -->
    </section>
  </main>
</div>
<div class="modal-overlay" id="modalOverlay">
  <div class="modal">
    <h2 id="modalTitle">New Item</h2>
    <div id="modalBody"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="modalConfirm">Save</button>
    </div>
  </div>
</div>
<script src="app.js"><\/script>
</body>
</html>`;

  const SCAFFOLD_JS = `document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

// ── State ──
let state = { items: [], filter: 'all' };

function initApp() {
  bindEvents();
  render();
}

function bindEvents() {
  document.getElementById('addBtn')?.addEventListener('click', () => openModal());
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    state.filter = e.target.value.trim().toLowerCase();
    render();
  });
}

function render() {
  const grid = document.getElementById('contentGrid');
  if (!grid) return;
  const filtered = state.items.filter(item =>
    state.filter === 'all' || !state.filter || (item.title || '').toLowerCase().includes(state.filter)
  );
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No items yet. Click "+ New" to add one.</p></div>';
    return;
  }
  grid.innerHTML = filtered.map((item, i) =>
    '<div class="card" data-id="' + i + '">' +
      '<div class="card-title">' + (item.title || 'Untitled') + '</div>' +
      '<div class="card-desc">' + (item.description || '') + '</div>' +
      '<div class="card-meta"><span class="badge badge-primary">' + (item.category || 'General') + '</span></div>' +
    '</div>'
  ).join('');
}

// ── Modal ──
function openModal() {
  document.getElementById('modalOverlay')?.classList.add('active');
}
function closeModal() {
  document.getElementById('modalOverlay')?.classList.remove('active');
}

// ── Toast ──
function showToast(message, type) {
  type = type || 'success';
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 2500);
}

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }`;

  const scaffolds = {
    'vite-react': {
      'package.json': '{\n  "name": "forge-app",\n  "version": "1.0.0",\n  "private": true,\n  "type": "module",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build",\n    "preview": "vite preview"\n  },\n  "dependencies": {\n    "react": "^18.2.0",\n    "react-dom": "^18.2.0"\n  },\n  "devDependencies": {\n    "@vitejs/plugin-react": "^4.0.0",\n    "vite": "^5.0.0"\n  }\n}',
      'vite.config.js': 'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nexport default defineConfig({ plugins: [react()] });\n',
      'index.html': '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n<title>App</title>\n</head>\n<body>\n<div id="root"></div>\n<script type="module" src="/src/main.jsx"><\/script>\n</body>\n</html>',
      'src/main.jsx': 'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App.jsx";\nimport "./App.css";\nReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);\n',
      'src/App.jsx': `import { useState } from "react";

export default function App() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");

  const filtered = items.filter(item =>
    !search || item.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="logo">App</div>
        <nav>
          <div className="nav-item active">Home</div>
        </nav>
      </aside>
      <main className="main-content">
        <header className="toolbar">
          <h1>Dashboard</h1>
          <div className="actions">
            <input
              className="search-input"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{width: 220}}
            />
            <button className="btn btn-primary">+ New</button>
          </div>
        </header>
        <section className="content-grid">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <p>No items yet. Click "+ New" to add one.</p>
            </div>
          ) : filtered.map((item, i) => (
            <div className="card" key={i}>
              <div className="card-title">{item.title}</div>
              <div className="card-desc">{item.description}</div>
              <div className="card-meta">
                <span className="badge badge-primary">{item.category || "General"}</span>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
`,
      'src/App.css': DESIGN_SYSTEM_CSS.replace('#app{', '.app-layout{')
    },
    'node-express': {
      'package.json': '{\n  "name": "forge-app",\n  "version": "1.0.0",\n  "main": "server.js",\n  "scripts": {\n    "start": "node server.js",\n    "dev": "node server.js"\n  },\n  "dependencies": {\n    "express": "^4.18.0",\n    "cors": "^2.8.5"\n  }\n}',
      'server.js': 'const express = require("express");\nconst cors = require("cors");\nconst app = express();\napp.use(cors());\napp.use(express.json());\napp.use(express.static("public"));\napp.get("/api/health", (req,res) => res.json({status:"ok"}));\nconst PORT = process.env.PORT || 5000;\napp.listen(PORT, () => console.log("Server on port " + PORT));\n',
      'public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>App</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{--primary:#6366f1;--primary-hover:#4f46e5;--bg:#0f172a;--surface:#1e293b;--surface-hover:#334155;--border:#334155;--text:#f1f5f9;--text-muted:#94a3b8;--success:#10b981;--danger:#ef4444;--radius:12px;--shadow:0 4px 24px rgba(0,0,0,0.3);--transition:0.2s ease}
body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;padding:2rem;max-width:800px;margin:0 auto;line-height:1.6}
h1{font-size:1.8rem;font-weight:700;margin-bottom:1.5rem}
.card{background:var(--surface);border:1px solid rgba(255,255,255,0.06);border-radius:var(--radius);padding:1.25rem;margin-bottom:0.75rem;transition:all var(--transition)}
.card:hover{transform:translateY(-1px);box-shadow:var(--shadow)}
.btn{padding:0.55rem 1.1rem;border:none;border-radius:8px;font-weight:600;font-size:0.875rem;cursor:pointer;transition:all var(--transition);display:inline-flex;align-items:center;gap:0.4rem}
.btn-primary{background:var(--primary);color:#fff}.btn-primary:hover{background:var(--primary-hover)}
.btn-danger{background:rgba(239,68,68,0.15);color:var(--danger)}.btn-danger:hover{background:rgba(239,68,68,0.25)}
input,textarea{padding:0.55rem 0.9rem;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:0.875rem;outline:none;transition:border var(--transition);width:100%}
input:focus,textarea:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(99,102,241,0.15)}
.add-form{display:flex;gap:0.5rem;margin-bottom:1.5rem}
.add-form input{flex:1}
.empty-state{text-align:center;padding:3rem;color:var(--text-muted)}
.toast{position:fixed;bottom:1.5rem;right:1.5rem;padding:0.75rem 1.25rem;border-radius:8px;color:#fff;font-weight:500;z-index:2000;transform:translateY(20px);opacity:0;transition:all 0.3s}
.toast.show{transform:translateY(0);opacity:1}.toast.success{background:var(--success)}.toast.error{background:var(--danger)}
@media(max-width:768px){body{padding:1rem}}
</style>
</head>
<body>
<h1>App</h1>
<div class="add-form">
  <input id="inp" placeholder="New item...">
  <button class="btn btn-primary" onclick="addItem()">Add</button>
</div>
<div id="items"></div>
<script>
const API = "";
async function load() {
  try {
    const res = await fetch(API + "/api/items");
    const items = await res.json();
    const el = document.getElementById("items");
    if (!items.length) { el.innerHTML = '<div class="empty-state">No items yet</div>'; return; }
    el.innerHTML = items.map(i =>
      '<div class="card"><span>' + i.name + '</span> ' +
      '<button class="btn btn-danger" onclick="del(' + i.id + ')">Delete</button></div>'
    ).join("");
  } catch(e) { console.error("Load error:", e); }
}
async function addItem() {
  const inp = document.getElementById("inp");
  if (!inp.value.trim()) return;
  await fetch(API + "/api/items", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name:inp.value.trim()}) });
  inp.value = ""; load();
}
async function del(id) { await fetch(API + "/api/items/" + id, { method:"DELETE" }); load(); }
load();
<\/script>
</body>
</html>`
    },
    'static': {
      'index.html': SCAFFOLD_HTML_STATIC,
      'style.css': DESIGN_SYSTEM_CSS,
      'app.js': SCAFFOLD_JS
    },
    'nextjs': {
      'package.json': '{\n  "name": "forge-app",\n  "version": "1.0.0",\n  "private": true,\n  "scripts": {\n    "dev": "next dev",\n    "build": "next build",\n    "start": "next start"\n  },\n  "dependencies": {\n    "next": "^14.0.0",\n    "react": "^18.2.0",\n    "react-dom": "^18.2.0"\n  }\n}',
      'app/page.jsx': `"use client";
import { useState } from "react";

export default function Home() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");

  const filtered = items.filter(item =>
    !search || item.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="logo">App</div>
        <nav>
          <div className="nav-item active">Home</div>
        </nav>
      </aside>
      <main className="main-content">
        <header className="toolbar">
          <h1>Dashboard</h1>
          <div className="actions">
            <input className="search-input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{width: 220}} />
            <button className="btn btn-primary">+ New</button>
          </div>
        </header>
        <section className="content-grid">
          {filtered.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📭</div><p>No items yet</p></div>
          ) : filtered.map((item, i) => (
            <div className="card" key={i}>
              <div className="card-title">{item.title}</div>
              <div className="card-desc">{item.description}</div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
`,
      'app/layout.jsx': `import "./globals.css";
export const metadata = { title: "Forge App" };
export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
`,
      'app/globals.css': DESIGN_SYSTEM_CSS.replace('#app{', '.app-layout{')
    }
  };

  // Map plan types to scaffold keys
  const typeMap = {
    'vite-react': 'vite-react',
    'nextjs': 'nextjs',
    'node-express': 'node-express',
    'static': 'static',
    'html-game': null, // single-file games don't need scaffold
    'other': null
  };

  const key = typeMap[projectType];
  return key ? scaffolds[key] : null;
}

// Run scaffold phase: apply base files, optionally smoke-test in sandbox
async function runScaffoldPhase(job, plan, mode, qual) {
  if (!plan || !plan.projectType) return { applied: false };

  const scaffoldFiles = getScaffoldFiles(plan.projectType);
  if (!scaffoldFiles) return { applied: false };

  // Check: don't overwrite if project already has these files
  const existingKeys = Object.keys(S.cur.files || {});
  const scaffoldKeys = Object.keys(scaffoldFiles);
  const newFiles = scaffoldKeys.filter(k => !existingKeys.includes(k));
  if (newFiles.length === 0) return { applied: false }; // all files already exist

  addLog('ui', '🏗', 'Scaffold', 'Creo struttura base: ' + scaffoldKeys.join(', '));

  // Apply scaffold files (don't overwrite existing)
  for (const [path, content] of Object.entries(scaffoldFiles)) {
    if (!S.cur.files[path]) {
      S.cur.files[path] = content;
    }
  }
  save();
  updateFileTabs();
  updateFilesList();

  // Show first file
  if (scaffoldKeys.length) showFile(scaffoldKeys[0]);

  addLog('ui', '✅', 'Scaffold', newFiles.length + ' file base creati');

  // Smoke test: if Node project, try sandbox
  if (S.cur.files['package.json']) {
    addLog('test', '🔥', 'Smoke Test', 'Verifico che lo scaffold compili…');
    updateJob(job, { status: 'RUN', changedFiles: scaffoldKeys });

    try {
      await runSandboxForJob(job, mode, qual);
      // If runSandboxForJob set status to DONE or FIX, check
      if (job.status === 'DONE') {
        addLog('test', '✅', 'Smoke Test', 'Scaffold OK — proseguo con implementazione');
        return { applied: true, smokeOk: true };
      } else if (job.status === 'FIX' || job.status === 'FAILED') {
        // Fix loop already ran inside runSandboxForJob → autoFixLoop
        // If it's now DONE after fix, great. If FAILED, we stop.
        if (job.status === 'FAILED') {
          return { applied: true, smokeOk: false, failed: true };
        }
        return { applied: true, smokeOk: true }; // fixed
      }
    } catch(e) {
      console.warn('Scaffold smoke test error:', e.message);
      addLog('test', '⚠️', 'Smoke Test', 'Test non disponibile: ' + e.message);
    }
  }

  return { applied: true, smokeOk: true };
}

// ══════════════════════════════════
// BATCHED GENERATION (v8j)
// ══════════════════════════════════

// Find files from plan that are not yet created or are just placeholders
function getPendingFiles(plan) {
  if (!plan || !plan.fileTree || !S.cur) return [];
  const existing = S.cur.files || {};
  return plan.fileTree.filter(f => {
    if (!existing[f]) return true; // not created
    // Check if it's just a scaffold placeholder (very short content)
    const content = existing[f];
    if (content.length < 100 && (content.includes('Loading...') || content.includes('Scaffold ready'))) return true;
    return false;
  });
}

// Find which milestone a file belongs to
function getMilestoneForFile(plan, filePath) {
  if (!plan || !plan.milestones) return null;
  return plan.milestones.find(m => (m.files || []).includes(filePath)) || null;
}

// Build a focused prompt for a specific batch of files
function buildBatchPrompt(userGoal, plan, targetFiles, batchNum, totalBatches, contextPack) {
  const existingFileList = Object.keys(S.cur?.files || {}).join(', ');
  const milestone = getMilestoneForFile(plan, targetFiles[0]);
  const summary = S.cur?.projectSummary || '';

  // Determine if any target files are CSS/style related
  const hasStyleFiles = targetFiles.some(f => /\.css$|style/i.test(f));
  const styleReminder = hasStyleFiles
    ? `\nSTILE OBBLIGATORIO: CSS vars (--primary, --bg, --surface, --text), sfondo scuro (MAI #fff), Google Fonts Inter, border-radius 12px, box-shadow, hover/focus states, flex/grid layout, @media (max-width:768px). Vedi la baseline CSS nel system prompt.\n`
    : `\nRICORDA: usa le CSS classes e gli ID già definiti nel progetto (vedi interface contract). Ogni handler JS deve corrispondere a un elemento reale.\n`;

  const batchLayer = getFileLayer(targetFiles[0]);
  const layerLabel = {layout:'LAYOUT (struttura + design)', logic:'LOGICA (funzionalità + interazioni)', integration:'INTEGRAZIONE (config + utility)'}[batchLayer] || 'GENERAZIONE';

  return `${userGoal}

CONTESTO: Stai generando file per un progetto esistente.
Batch ${batchNum}/${totalBatches} — Fase: ${layerLabel}. File già nel progetto: ${existingFileList}
${summary ? '\n' + summary + '\n' : ''}${contextPack ? '\n' + contextPack + '\n' : ''}
IN QUESTO BATCH genera SOLO questi file (${targetFiles.length}):
${targetFiles.map(f => '- ' + f).join('\n')}

${milestone ? 'Milestone: "' + milestone.name + '"' : ''}
${plan.notes ? 'Note progetto: ' + plan.notes.join('; ') : ''}
${styleReminder}
I file devono essere COMPLETI e FUNZIONANTI, integrandosi con i file già esistenti nel progetto.
Non rigenerare file già creati — genera SOLO quelli elencati sopra.
Ogni funzione deve avere un corpo reale. Nessun TODO, placeholder, o corpo vuoto.`;
}

// Classify a file into a responsibility layer
function getFileLayer(f) {
  const lower = f.toLowerCase();
  if (/\.(css|scss|sass|less)$/.test(f)) return 'layout';
  if (/\.html$/.test(f)) return 'layout';
  if (/layout\.|page\.|App\./i.test(f)) return 'layout';
  if (/\.(js|jsx|tsx|ts)$/.test(f) && !/config|\.test|\.spec|util/.test(lower)) return 'logic';
  return 'integration';
}

// Sort pending files by responsibility layer: layout → logic → integration
function sortFilesByResponsibility(pending) {
  const layers = {
    layout: [],    // .html, .css, .scss, layout/page components
    logic: [],     // .js, .jsx, .tsx (non-style, non-config)
    integration: [] // config, utils, tests, everything else
  };

  for (const f of pending) {
    const lower = f.toLowerCase();
    if (/\.(css|scss|sass|less)$/.test(f) || /globals?\.(css|scss)/.test(f)) {
      layers.layout.push(f);
    } else if (/index\.html$|\.html$/.test(f) && !f.includes('public/')) {
      layers.layout.push(f);
    } else if (/layout\.(jsx|tsx)$|page\.(jsx|tsx)$|App\.(jsx|tsx|css)$/.test(f)) {
      layers.layout.push(f);
    } else if (/public\/.*\.html$/.test(f)) {
      layers.layout.push(f);
    } else if (/\.(js|jsx|tsx|ts)$/.test(f) && !/config|\.test|\.spec|util/.test(lower)) {
      layers.logic.push(f);
    } else {
      layers.integration.push(f);
    }
  }

  return [...layers.layout, ...layers.logic, ...layers.integration];
}

// Pick batch files keeping same-layer files together when possible
function pickBatchFiles(sortedFiles, batchSize) {
  if (sortedFiles.length <= batchSize) return sortedFiles;

  const first = sortedFiles[0];
  const firstLayer = getFileLayer(first);

  // Try to fill batch with files from the same layer
  const sameLayer = sortedFiles.filter(f => getFileLayer(f) === firstLayer);
  if (sameLayer.length >= batchSize) return sameLayer.slice(0, batchSize);

  // If not enough files in same layer, take all from this layer + start next
  return sortedFiles.slice(0, batchSize);
}

// Main batched generation loop
async function runBatchedGeneration(job, plan, prompt, mode, qual) {
  const pending = getPendingFiles(plan);
  if (pending.length === 0) {
    addLog('test', '✅', 'Generator', 'Tutti i file dal piano sono già presenti');
    return { completed: true, totalFiles: 0, totalLines: 0 };
  }

  const totalBatches = Math.min(Math.ceil(pending.length / FILES_PER_BATCH), MAX_BATCHES);
  let batchNum = 0;
  let totalFilesGenerated = 0;
  let totalLinesGenerated = 0;
  let allChangedFiles = [];

  while (batchNum < totalBatches) {
    // Check cancellation
    if (!S.currentJob || S.currentJob.id !== job.id) {
      addLog('ui', '⏹', 'Generator', 'Generazione fermata dall\'utente');
      return { completed: false, totalFiles: totalFilesGenerated, totalLines: totalLinesGenerated };
    }

    batchNum++;
    const currentPending = getPendingFiles(plan);
    if (currentPending.length === 0) break;

    const sortedPending = sortFilesByResponsibility(currentPending);
    const targetFiles = pickBatchFiles(sortedPending, FILES_PER_BATCH);

    addLog('ui', '📦', 'Batch ' + batchNum + '/' + totalBatches,
      'Genero: ' + targetFiles.join(', '));
    updateJob(job, { status: 'APPLY', attempt: batchNum });

    try {
      // Build focused prompt for this batch (with fresh context pack each time)
      const ctxPack = buildContextPack(job, plan);
      const batchPrompt = buildBatchPrompt(prompt, plan, targetFiles, batchNum, totalBatches, ctxPack);
      S.history.push({role:'user', content: batchPrompt});

      const raw = await callAPIMultiFile(batchPrompt, mode, qual, true, 'ui', plan, ctxPack);
      S.history.push({role:'assistant', content:'Batch ' + batchNum + ' generato.'});

      if (!S.currentJob || S.currentJob.id !== job.id) break; // cancelled

      const parsed = parseAIResponse(raw, mode);

      // Auto-review largest file in batch
      if (parsed.type === 'json' && parsed.data.filesChanged) {
        const largest = parsed.data.filesChanged.reduce((a, b) =>
          (a.content||'').length > (b.content||'').length ? a : b, {content:''});
        if (largest.content && largest.content.length > 300) {
          try {
            const reviewed = await reviewAndFix(largest.content, mode, prompt);
            if (reviewed && reviewed.length > largest.content.length * 0.5) largest.content = reviewed;
          } catch(e) { /* optional */ }
        }
      }

      // Apply batch
      saveSnapshot('Pre-batch-' + batchNum, job.id);
      const result = applyJsonPatch(parsed, prompt);
      saveSnapshot('Post-batch-' + batchNum, job.id);

      totalFilesGenerated += result.changedFiles.length;
      totalLinesGenerated += result.totalLines;
      allChangedFiles.push(...result.changedFiles);
      updateProjectSummary(job, plan);

      addLog('ui', '✅', 'Batch ' + batchNum,
        result.changedFiles.length + ' file (' + result.totalLines + ' righe): ' + result.changedFiles.join(', '));

      // Short feedback in chat
      renderBbl('ai', '📦 **Batch ' + batchNum + '/' + totalBatches + '** — ' +
        result.changedFiles.length + ' file generati (' + result.totalLines + ' righe)');

      // Check if we've hit a milestone boundary → run sandbox verify
      const milestone = getMilestoneForFile(plan, targetFiles[0]);
      if (milestone && isNodeProject()) {
        const msFiles = milestone.files || [];
        const allMsFilesExist = msFiles.every(f => S.cur.files[f] && S.cur.files[f].length > 50);
        if (allMsFilesExist) {
          addLog('test', '🔥', 'Milestone Verify', 'Milestone "' + milestone.name + '" completa — verifico sandbox…');
          updateJob(job, { status: 'RUN', changedFiles: allChangedFiles });
          try {
            await runSandboxForJob(job, mode, qual);
            if (job.status === 'FAILED') {
              return { completed: false, totalFiles: totalFilesGenerated, totalLines: totalLinesGenerated, failed: true };
            }
            // Reset status for next batch
            updateJob(job, { status: 'APPLY' });
          } catch(e) {
            addLog('test', '⚠️', 'Milestone Verify', 'Verifica fallita: ' + e.message);
          }
        }
      }

      // Small delay between batches to avoid rate limits
      await sleep(500);

    } catch(batchErr) {
      addLog('ui', '❌', 'Batch ' + batchNum, 'Errore: ' + batchErr.message);
      // Don't abort — try next batch
      if (batchErr.message.includes('401') || batchErr.message.includes('403')) throw batchErr; // auth errors are fatal
      await sleep(2000); // longer wait on error
    }
  }

  updateJob(job, { changedFiles: allChangedFiles });

  // Check for missing files from plan
  const stillPending = getPendingFiles(plan);
  const isComplete = stillPending.length === 0;
  if (stillPending.length > 0) {
    addLog('test', '⚠️', 'Piano', stillPending.length + ' file dal piano non generati: ' + stillPending.join(', '));
  }
  return { completed: isComplete, totalFiles: totalFilesGenerated, totalLines: totalLinesGenerated };
}

// ══════════════════════════════════
// CONTEXT PACK (v8j-p2)
// ══════════════════════════════════
// Builds a compact context string the LLM receives before every generation.
// Includes: file tree, key-file extracts, changed files, recent logs.
// Budget: ~12-18k chars max.

// Extract interface contract: IDs, CSS classes, exported functions, event handlers
// Compact (~1-3k chars) but infinitely more useful than head+tail for cross-file coherence
function buildInterfaceContract(files) {
  const ids = new Set(), classes = new Set(), fns = new Set(), exports = new Set(), cssVars = new Set();
  for (const [path, content] of Object.entries(files)) {
    if (!content) continue;
    // HTML IDs
    const idMatches = content.matchAll(/\bid\s*=\s*["']([^"']+)["']/g);
    for (const m of idMatches) ids.add(m[1]);
    // CSS classes used in markup (class="x y z")
    const clsMatches = content.matchAll(/\bclass(?:Name)?\s*=\s*["']([^"']+)["']/g);
    for (const m of clsMatches) m[1].split(/\s+/).forEach(c => { if (c && c.length > 1 && c.length < 40) classes.add(c); });
    // CSS class definitions (.foo { )
    const cssDefs = content.matchAll(/\.([a-zA-Z][\w-]*)\s*[{,]/g);
    for (const m of cssDefs) classes.add(m[1]);
    // CSS custom properties
    const varDefs = content.matchAll(/(--[\w-]+)\s*:/g);
    for (const m of varDefs) cssVars.add(m[1]);
    // JS function declarations
    const fnDefs = content.matchAll(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(?.*?\)?\s*=>)/g);
    for (const m of fnDefs) fns.add(m[1] || m[2]);
    // ES exports
    const expMatches = content.matchAll(/export\s+(?:default\s+)?(?:function\s+|const\s+|class\s+)(\w+)/g);
    for (const m of expMatches) exports.add(m[1]);
  }
  let out = '── INTERFACE CONTRACT (cross-file) ──\n';
  if (ids.size) out += 'HTML IDs: ' + [...ids].slice(0, 60).join(', ') + '\n';
  if (classes.size) out += 'CSS classes: ' + [...classes].slice(0, 80).join(', ') + '\n';
  if (cssVars.size) out += 'CSS vars: ' + [...cssVars].slice(0, 30).join(', ') + '\n';
  if (fns.size) out += 'JS functions: ' + [...fns].slice(0, 60).join(', ') + '\n';
  if (exports.size) out += 'Exports: ' + [...exports].slice(0, 30).join(', ') + '\n';
  out += '\n';
  return out;
}

function buildContextPack(job, plan) {
  if (!S.cur || !S.cur.files) return '';
  const files = S.cur.files;
  const keys = Object.keys(files).sort();
  if (keys.length === 0) return '';

  const BUDGET = 16000; // soft char limit
  let out = '';

  // ── 0. Interface contract (cross-file coherence) ──
  out += buildInterfaceContract(files);

  // ── 1. File tree ──
  out += '── FILE TREE ──\n';
  out += keys.map(f => {
    const lines = (files[f] || '').split('\n').length;
    return `  ${f}  (${lines} righe)`;
  }).join('\n') + '\n\n';

  // ── 2. Key-file extracts (head + tail) ──
  const IMPORTANT = [
    'package.json',
    'server.js', 'index.js',
    'src/App.jsx', 'src/App.tsx', 'app/page.jsx', 'app/page.tsx',
    'index.html', 'public/index.html',
    'vite.config.js', 'vite.config.ts',
    'style.css', 'src/index.css'
  ];
  const HEAD_LINES = 40;
  const TAIL_LINES = 20;

  function headTail(content, headN, tailN) {
    const lines = content.split('\n');
    if (lines.length <= headN + tailN + 5) return content; // small enough, include all
    const head = lines.slice(0, headN).join('\n');
    const tail = lines.slice(-tailN).join('\n');
    return head + '\n/* … (' + (lines.length - headN - tailN) + ' righe omesse) … */\n' + tail;
  }

  // ── Small project: include FULL content (no truncation) ──
  const totalChars = keys.reduce((sum, k) => sum + (files[k] || '').length, 0);
  const isSmallProject = keys.length <= 3 && totalChars < 12000;

  if (isSmallProject) {
    out += '── CODICE COMPLETO DEL PROGETTO ──\n';
    for (const k of keys) {
      out += `--- ${k} ---\n${files[k]}\n\n`;
    }
  } else {
    // ── Large project: use head/tail extracts ──
    const extracts = [];
    for (const pattern of IMPORTANT) {
      if (files[pattern]) {
        extracts.push({ path: pattern, content: files[pattern] });
      }
    }
    // Also include any file that looks like an entry point but wasn't in the list
    for (const k of keys) {
      if (extracts.length >= 6) break;
      if (extracts.find(e => e.path === k)) continue;
      if (/^(src\/)?(main|index|app)\.(jsx?|tsx?)$/i.test(k) || k === 'app.js') {
        extracts.push({ path: k, content: files[k] });
      }
    }

    if (extracts.length) {
      out += '── FILE CHIAVE (estratti) ──\n';
      let extractBudget = Math.floor(BUDGET * 0.55);
      for (const ex of extracts) {
        const snippet = headTail(ex.content, HEAD_LINES, TAIL_LINES);
        const chunk = `--- ${ex.path} ---\n${snippet}\n\n`;
        if (out.length + chunk.length > extractBudget + 2000) {
          // over budget, use smaller extract
          const small = headTail(ex.content, 15, 8);
          out += `--- ${ex.path} ---\n${small}\n\n`;
        } else {
          out += chunk;
        }
      }
    }
  }

  // ── 3. Changed files in current job ──
  const changed = job?.changedFiles || [];
  if (changed.length) {
    out += '── FILE MODIFICATI (job corrente) ──\n';
    out += changed.join(', ') + '\n\n';
    // Include brief head of each changed file not already extracted
    const alreadyExtracted = new Set(extracts.map(e => e.path));
    for (const cf of changed) {
      if (alreadyExtracted.has(cf) || !files[cf]) continue;
      if (out.length > BUDGET - 1000) break;
      const snippet = headTail(files[cf], 20, 10);
      out += `--- ${cf} (modificato) ---\n${snippet}\n\n`;
    }
  }

  // ── 4. Recent job logs ──
  if (job?.runLogs) {
    const logSnippet = job.runLogs.slice(-1500);
    out += '── LOG RECENTI ──\n' + logSnippet + '\n\n';
  }
  if (job?.errorsDetected?.length) {
    out += '── ERRORI RILEVATI ──\n';
    out += job.errorsDetected.map(e => `[${e.type}] ${e.message}`).join('\n') + '\n\n';
  }

  // ── 5. Plan summary (compact) ──
  if (plan?.fileTree) {
    const pending = plan.fileTree.filter(f => !files[f] || files[f].length < 50);
    if (pending.length) {
      out += '── FILE DA GENERARE (dal piano) ──\n';
      out += pending.join(', ') + '\n\n';
    }
  }

  // Trim to budget
  if (out.length > BUDGET) out = out.slice(0, BUDGET) + '\n[… context troncato …]\n';

  return out;
}

// ══════════════════════════════════
// PROJECT SUMMARY (v8j-p4)
// ══════════════════════════════════
// Compact, strategic memory of the project — persisted in S.cur.projectSummary.
// The Context Pack is *technical* (file contents); this is *strategic* (status + intent).

function buildProjectSummary(job, plan) {
  const files = S.cur?.files || {};
  const keys = Object.keys(files).sort();
  const pending = plan?.fileTree ? plan.fileTree.filter(f => !files[f] || files[f].length < 100) : [];
  const created = plan?.fileTree ? plan.fileTree.filter(f => files[f] && files[f].length >= 100) : keys;

  // Detect implemented features by scanning file contents (fast heuristic)
  const allCode = Object.values(files).join('\n').slice(0, 30000);
  const features = [];
  if (/router|Route|useNavigate|Link\s+to=/i.test(allCode)) features.push('routing');
  if (/useState|setState|createContext|useReducer/i.test(allCode)) features.push('state management');
  if (/fetch\(|axios|api\//i.test(allCode)) features.push('API calls');
  if (/localStorage|sessionStorage|indexedDB/i.test(allCode)) features.push('local storage');
  if (/login|auth|token|password|session/i.test(allCode)) features.push('auth');
  if (/dark.?mode|theme|color-scheme/i.test(allCode)) features.push('dark mode');
  if (/@media|responsive|mobile/i.test(allCode)) features.push('responsive');
  if (/chart|graph|d3\.|recharts|canvas/i.test(allCode)) features.push('charts/graphs');
  if (/drag|drop|sortable|dnd/i.test(allCode)) features.push('drag & drop');
  if (/modal|dialog|popup/i.test(allCode)) features.push('modals');
  if (/express|app\.get|app\.post|router\./i.test(allCode)) features.push('server routes');

  // Determine project status
  let status = 'empty';
  if (keys.length === 0) status = 'empty';
  else if (pending.length > 0 && created.length > 0) status = 'partial';
  else if (pending.length === 0 && created.length > 0) status = 'complete';
  else if (keys.length > 0 && !plan) status = 'active';
  if (job?.status === 'FAILED') status = 'failed';

  // Recent errors
  const errors = (job?.errorsDetected || []).slice(-3).map(e => `[${e.type}] ${e.message}`);

  const summary = [
    `=== PROJECT SUMMARY ===`,
    `Tipo: ${plan?.projectType || (isNodeProject() ? 'node' : 'static-html')}`,
    `Goal: ${(job?.userGoal || S.cur?.name || 'Non definito').slice(0, 120)}`,
    `Stato: ${status} (${keys.length} file${pending.length ? ', ' + pending.length + ' pending' : ''})`,
    `File creati: ${created.length ? created.join(', ') : 'nessuno'}`,
    pending.length ? `File pending: ${pending.join(', ')}` : null,
    features.length ? `Feature implementate: ${features.join(', ')}` : null,
    plan?.stack ? `Stack: FE=${plan.stack.frontend||'–'} | BE=${plan.stack.backend||'–'} | DB=${plan.stack.db||'–'}` : null,
    plan?.notes?.length ? `Note arch.: ${plan.notes.slice(0, 3).join('; ')}` : null,
    errors.length ? `Errori recenti: ${errors.join('; ')}` : null,
    `=== FINE SUMMARY ===`
  ].filter(Boolean).join('\n');

  return summary;
}

// Update and persist the project summary. Called at lifecycle transitions.
function updateProjectSummary(job, plan) {
  if (!S.cur) return '';
  const summary = buildProjectSummary(job, plan);
  S.cur.projectSummary = summary;
  save();
  // Also trigger async project memory update (non-blocking)
  updateProjectMemory(job).catch(e => console.warn('Memory update skipped:', e.message));
  return summary;
}

// ══════════════════════════════════
// PROJECT MEMORY (persistent LLM-generated memory)
// ══════════════════════════════════
// Like CLAUDE.md — a living document that always describes the project,
// updated by Haiku after every generation. Injected into ALL system prompts.

async function updateProjectMemory(job) {
  if (!S.cur || !S.key) return;
  const files = S.cur.files || {};
  const fileKeys = Object.keys(files);
  if (fileKeys.length === 0) return;

  const existingMemory = S.cur.projectMemory || '';
  const plan = S.cur.plan;

  // Build file info (names + sizes + first meaningful line)
  const fileInfo = fileKeys.map(k => {
    const content = files[k] || '';
    const lines = content.split('\n');
    const firstMeaningful = lines.find(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('<!--') && !l.trim().startsWith('/*')) || lines[0] || '';
    return `${k} (${lines.length} righe) — ${firstMeaningful.trim().slice(0, 60)}`;
  }).join('\n');

  // Recent user requests (from history, only user messages)
  const userMsgs = S.history
    .filter(m => m.role === 'user')
    .slice(-4)
    .map(m => {
      const text = typeof m.content === 'string' ? m.content : (m.content?.[0]?.text || JSON.stringify(m.content));
      return text.slice(0, 200);
    });

  // Job info
  const jobInfo = job ? `Ultima azione: ${job.status || 'completata'}, file modificati: ${(job.changedFiles||[]).join(', ')}` : '';
  const errors = (job?.errorsDetected || []).slice(-2).map(e => `[${e.type}] ${e.message}`).join('; ');

  const sys = `Sei un assistente che mantiene una "memoria di progetto" per un IDE AI.
Genera o AGGIORNA la memoria del progetto in formato strutturato.
Questa memoria viene iniettata in OGNI chiamata API per mantenere coerenza.

FORMATO (usa esattamente questa struttura, max 600 parole):

=== PROJECT MEMORY ===
APP: [nome e descrizione in 1 riga]
TIPO: [html-game | static-html | vite-react | nextjs | node-express | fullstack-flask]
STACK: [framework, librerie, tecnologie]
OBIETTIVO: [cosa vuole ottenere l'utente, in 2-3 righe]
FILE: [elenco file con breve ruolo di ciascuno]
FUNZIONALITÀ:
- [feature 1 implementata]
- [feature 2 implementata]
- ...
DESIGN:
- [decisione 1 di design/architettura]
- [decisione 2]
STATO: [cosa è stato completato, cosa manca]
PROBLEMI: [bug noti o issue segnalati, "nessuno" se tutto ok]
ULTIMA RICHIESTA: [cosa ha chiesto l'utente per ultimo]
=== FINE MEMORY ===

REGOLE:
- Se ricevi una memoria esistente, AGGIORNALA (non riscriverla da zero)
- Aggiungi nuove feature/decisioni, aggiorna lo stato
- Mantieni le informazioni precedenti che sono ancora rilevanti
- Sii SPECIFICO: nomi di componenti, endpoint, funzioni chiave
- Scrivi in italiano`;

  const userContent = `${existingMemory ? 'MEMORIA ATTUALE DA AGGIORNARE:\n' + existingMemory + '\n\n' : 'PRIMA GENERAZIONE — crea la memoria da zero.\n\n'}INFO PROGETTO:
Nome: ${S.cur.name || 'Senza nome'}
${plan ? 'Piano: tipo=' + plan.projectType + ', file=' + (plan.fileTree||[]).join(', ') : 'Nessun piano'}

FILE:
${fileInfo}

${jobInfo}
${errors ? 'Errori: ' + errors : ''}

RICHIESTE UTENTE RECENTI:
${userMsgs.map((m, i) => (i+1) + '. ' + m).join('\n')}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': S.key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: MODELS.haiku,
        max_tokens: 1200,
        temperature: 0.2,
        system: sys,
        messages: [{ role: 'user', content: userContent }]
      })
    });
    if (!r.ok) throw new Error('API ' + r.status);
    const data = await r.json();
    const memory = data.content.map(b => b.text || '').join('').trim();
    if (memory && memory.includes('PROJECT MEMORY')) {
      S.cur.projectMemory = memory;
      save();
      console.log('[ProjectMemory] Updated (' + memory.length + ' chars)');
    }
  } catch (e) {
    console.warn('[ProjectMemory] Update failed:', e.message);
  }
}

// Get current project memory for injection into system prompts
function getProjectMemory() {
  if (!S.cur) return '';
  // Prefer LLM-generated memory, fallback to heuristic summary
  return S.cur.projectMemory || S.cur.projectSummary || '';
}

// Build the multi-file system prompt
function buildMultiFileSystemPrompt(mode, qual, isEdit, agentPersona, plan, contextPack) {
  const qd={pro:'Design professionale, raffinato, codice pulito.',fast:'Implementazione veloce ma funzionante.',detailed:'Molto dettagliato con commenti esaustivi.'};
  const fileList = S.cur && Object.keys(S.cur.files).length ? Object.keys(S.cur.files).join(', ') : 'nessuno';

  // Include plan context if available
  const planContext = plan ? `
PIANO DI PROGETTO (segui questo piano):
- Tipo: ${plan.projectType}
- File da generare: ${(plan.fileTree||[]).join(', ')}
- Milestones: ${(plan.milestones||[]).map(m => m.name + ' → ' + (m.files||[]).join(',')).join(' | ')}
${(plan.notes||[]).length ? '- Note: ' + plan.notes.join('; ') : ''}
Genera ESATTAMENTE i file elencati nel piano. Segui la struttura indicata.
` : '';

  // Anti-monofile rule for structured projects
  const antiMono = (plan && ['vite-react','nextjs','node-express'].includes(plan.projectType))
    ? `\nDIVIETO MONOFILE: Questo progetto è ${plan.projectType}. NON generare un singolo file HTML con tutto dentro. Devi rispettare la struttura multi-file dello scaffold (${fileList}). Ogni file va nel suo path corretto.\n`
    : '';

  return `Sei un expert full-stack developer e UI/UX designer. Genera un PROGETTO MULTI-FILE di qualità professionale.

${qd[qual]}
${planContext}${antiMono}
STRATEGIA SCAFFOLD-FIRST:
- Il PRIMO batch deve creare: package.json (se Node/React), struttura cartelle, entrypoints.
- I batch successivi aggiungono: componenti, pagine, servizi, styling.
- Per app HTML semplici: genera COMUNQUE file separati (index.html, style.css, app.js) — non un monolite.

REQUISITI:
1. UI/UX professionale con Google Fonts, CSS custom properties, dark mode, animazioni fluide.
2. Funzionalità COMPLETE — nessun placeholder, nessun TODO, nessun corpo funzione vuoto. Logica reale funzionante.
3. Responsivo mobile-first con flex/grid layout. Error handling robusto.
4. Per React/Vite: componenti separati, hooks, state management.
5. Per Express: routes separate, middleware, dati di esempio realistici.

BASELINE GRAFICA OBBLIGATORIA — il tuo CSS DEVE partire da questa struttura (adatta colori/nomi al progetto):

:root{--primary:#6366f1;--primary-hover:#4f46e5;--bg:#0f172a;--surface:#1e293b;--surface-hover:#334155;--border:#334155;--text:#f1f5f9;--text-muted:#94a3b8;--radius:12px;--shadow:0 4px 24px rgba(0,0,0,0.25);}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;line-height:1.6;}
h1{font-size:1.8rem;font-weight:700;} h2{font-size:1.3rem;font-weight:600;color:var(--text-muted);}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.5rem;box-shadow:var(--shadow);}
button,.btn{padding:0.6rem 1.2rem;border:none;border-radius:8px;background:var(--primary);color:#fff;font-weight:600;cursor:pointer;transition:all 0.2s;}
button:hover,.btn:hover{background:var(--primary-hover);transform:translateY(-1px);}
input,textarea,select{padding:0.6rem 1rem;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);outline:none;transition:border 0.2s;width:100%;}
input:focus,textarea:focus,select:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(99,102,241,0.15);}
@media(max-width:768px){.container{padding:1rem;}.sidebar{display:none;}}

Carica SEMPRE Google Fonts: <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
MAI sfondo bianco grezzo (#fff). Usa la palette. Ogni bottone/input/card DEVE avere hover/focus state.
Se dashboard/app: sidebar scura (250px) a sinistra, main content a destra con padding 2rem, layout flex/grid.

DESIGN SYSTEM — COMPONENTI PRE-COSTRUITI (usa questi pattern, non reinventarli):

/* Sidebar */
.sidebar{width:260px;background:var(--bg-alt,#0b1120);border-right:1px solid var(--border);padding:1.5rem;position:fixed;top:0;left:0;bottom:0;display:flex;flex-direction:column;gap:0.5rem;overflow-y:auto}
.sidebar .logo{font-size:1.25rem;font-weight:700;padding:0.5rem;margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem}
.sidebar .nav-item{padding:0.6rem 0.8rem;border-radius:8px;color:var(--text-muted);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:0.6rem;font-size:0.9rem;font-weight:500}
.sidebar .nav-item:hover,.sidebar .nav-item.active{background:var(--surface);color:var(--text)}

/* Modal */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;opacity:0;pointer-events:none;transition:opacity 0.2s}
.modal-overlay.active{opacity:1;pointer-events:all}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.5rem;width:90%;max-width:480px;box-shadow:0 25px 60px rgba(0,0,0,0.4)}

/* Toast */
.toast{position:fixed;bottom:1.5rem;right:1.5rem;padding:0.75rem 1.25rem;border-radius:8px;color:#fff;font-weight:500;z-index:2000;transform:translateY(20px);opacity:0;transition:all 0.3s}
.toast.show{transform:translateY(0);opacity:1}

/* Badge */
.badge{display:inline-flex;padding:0.2rem 0.6rem;border-radius:99px;font-size:0.75rem;font-weight:600}
.badge-primary{background:rgba(99,102,241,0.15);color:var(--primary)}
.badge-success{background:rgba(16,185,129,0.15);color:#10b981}

/* Empty state */
.empty-state{text-align:center;padding:3rem;color:var(--text-muted)}
.empty-state .empty-icon{font-size:3rem;margin-bottom:1rem;opacity:0.5}

/* Content grid */
.content-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem}

/* Toolbar */
.toolbar{display:flex;align-items:center;justify-content:space-between;gap:1rem}

/* Animations */
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}

USA questi componenti quando servono. NON reinventare sidebar, modal, toast, badge — usa esattamente questi pattern e adattali al progetto.

REGOLE ANTI-BUG FUNZIONALI:
- Ogni funzione referenziata da onclick/addEventListener DEVE essere definita nel codice
- Ogni getElementById("X") DEVE avere un elemento con id="X" nel markup
- Ogni import locale ('./file') DEVE corrispondere a un file esistente nel progetto
- Script in <head> che accedono al DOM DEVONO avere defer o usare DOMContentLoaded
- MAI funzioni con corpo vuoto — implementa logica reale
- MAI alert() o console.log() come implementazione finale

${isEdit ? `REGOLA CRITICA — MODIFICA PROGETTO ESISTENTE:
Stai MODIFICANDO un progetto già funzionante. File attuali: ${fileList}
- NON creare un progetto nuovo o diverso. NON cambiare tipo di applicazione.
- Se il progetto è un gioco snake, RESTA un gioco snake. Se è un todo app, RESTA un todo app.
- Mantieni la stessa struttura, lo stesso stile, la stessa logica base.
- Applica SOLO le modifiche richieste dall'utente. Non riscrivere tutto da zero.
- Modifica SOLO i file necessari — non rigenerare file non toccati.
- Il content di ogni file modificato deve essere il file COMPLETO aggiornato (non una patch).
${(() => {
  // Inject full code for small projects directly in system prompt
  const files = S.cur?.files || {};
  const fkeys = Object.keys(files);
  const total = fkeys.reduce((s, k) => s + (files[k] || '').length, 0);
  if (fkeys.length <= 3 && total < 15000) {
    return '\nCODICE ATTUALE DEL PROGETTO (modifica QUESTO codice, non crearne uno nuovo):\n' +
      fkeys.map(k => '--- ' + k + ' ---\n' + files[k]).join('\n\n') + '\n';
  }
  return '';
})()}` : 'Crea da zero un progetto COMPLETO.'}
${agentPersona}

REGOLE ANTI-BUG:
- Nessun nome duplicato per scopi diversi. Ogni funzione/import deve esistere.
- Testa mentalmente il flusso completo. Gestisci edge cases.
- Se generi un gioco: game loop funzionante dal primo frame, controlli responsivi, collisioni corrette.
${getProjectMemory() ? '\n' + getProjectMemory() + '\n' : ''}${contextPack ? '\n── CONTEXT PACK (dettaglio tecnico) ──\n' + contextPack + '\n── FINE CONTEXT PACK ──\n' : ''}
FORMATO OUTPUT OBBLIGATORIO — rispondi SOLO con questo JSON valido (nessun testo prima o dopo):
{
  "summary": "breve descrizione di cosa hai fatto",
  "filesChanged": [
    {"path": "nomefile.ext", "action": "create", "content": "contenuto completo del file"},
    {"path": "altro.ext", "action": "update", "content": "contenuto completo del file"}
  ],
  "nextBatch": {
    "needed": false,
    "reason": "",
    "suggestedPrompt": ""
  }
}

REGOLE JSON:
- "action" può essere "create" o "update". Mai "delete" — segnala in summary se serve.
- Ogni "content" deve essere il file COMPLETO, non una patch parziale.
- Se il progetto è troppo grande per un batch, metti nextBatch.needed=true e suggerisci il prompt per continuare.
- Per HTML semplice (senza Node): metti tutti i file in un batch. Usa file separati (html, css, js).
- Per React/Vite: primo batch = package.json + vite.config + index.html + main.jsx + App.jsx. Batch successivi = componenti.
- NON generare markdown, backtick o testo fuori dal JSON.`;
}

// Call API requesting multi-file JSON output
async function callAPIMultiFile(prompt, mode, qual, isEdit, agent, plan, contextPack) {
  const agentPersona = AGENTS[currentAgent]?.systemExtra || '';
  const sys = buildMultiFileSystemPrompt(mode, qual, isEdit, agentPersona, plan, contextPack || '');
  const msgs = S.history.slice(isEdit ? -12 : -6);
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {'Content-Type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body: JSON.stringify({ model: getModelForAgent(agent), max_tokens: 32000, temperature: 0.3, system: sys, messages: msgs })
  });
  if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error?.message || `HTTP ${r.status}`); }
  const data = await r.json();
  const raw = data.content.map(b => b.text || '').join('').trim();
  return raw;
}


// Apply multi-file JSON patch to project
function applyJsonPatch(parsed, prompt) {
  const result = { changedFiles: [], totalLines: 0 };

  if (parsed.type === 'json') {
    const { filesChanged, summary, nextBatch } = parsed.data;
    for (const fc of filesChanged) {
      if (!fc.path || !fc.content) continue;
      S.cur.files[fc.path] = fc.content;
      result.changedFiles.push(fc.path);
      result.totalLines += fc.content.split('\n').length;
    }
    result.summary = summary || '';
    result.nextBatch = nextBatch || { needed: false };
  } else {
    // Fallback: single file
    const fn = fname(S.cur.mode || 'html');
    S.cur.files[fn] = parsed.data;
    result.changedFiles.push(fn);
    result.totalLines = parsed.data.split('\n').length;
    result.summary = '';
    result.nextBatch = { needed: false };
  }

  // Update project
  S.cur.name = prompt.replace(/[^a-zA-ZÀ-ÿ\s]/g,'').split(' ').filter(w=>w.length>3).slice(0,4).join(' ') || 'App';
  S.cur.conv = S.history;
  save();
  updateFileTabs(); updateFilesList();

  // Show first changed file
  if (result.changedFiles.length) showFile(result.changedFiles[0]);
  document.getElementById('pj-name').textContent = S.cur.name;
  document.getElementById('deploy-btn').style.display = 'flex';
  document.getElementById('sandbox-btn').style.display = 'flex';

  // Preview: only for static projects; framework projects need build
  if (needsBuild()) {
    showFrameworkPreview();
    switchTab('preview');
  } else {
    const htmlFile = S.cur.files['index.html'] || S.cur.files['public/index.html'];
    if (htmlFile) { updatePrev(htmlFile); switchTab('preview'); }
    else if (result.changedFiles[0]) { switchTab('code'); }
  }

  return result;
}

// Show "Continue" button for next batch
function showNextBatchBtn(nextBatch, mode, qual) {
  if (!nextBatch || !nextBatch.needed) return;
  const mc = document.getElementById('msgs');
  const d = document.createElement('div');
  d.style.cssText = 'display:flex;justify-content:center;padding:8px 0';
  d.innerHTML = `<button onclick="continueNextBatch(this)" data-prompt="${escHtml(nextBatch.suggestedPrompt || 'Continua generazione')}" data-mode="${mode}" data-qual="${qual}" style="display:flex;align-items:center;gap:7px;padding:9px 18px;border-radius:9999px;background:rgba(58,134,255,0.12);border:1px solid rgba(58,134,255,0.3);color:#3A86FF;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s" onmouseover="this.style.background='rgba(58,134,255,0.2)'" onmouseout="this.style.background='rgba(58,134,255,0.12)'">⟩⟩ Genera prossimo batch</button>`;
  mc.appendChild(d);
  d.scrollIntoView({behavior:'smooth',block:'nearest'});
  renderBbl('ai', `ℹ️ **Progetto troppo grande per un batch.** ${nextBatch.reason || ''}\nClicca il pulsante per generare i file rimanenti.`);
}

// ══════════════════════════════════
// CONTEXT TRANSFER (stile Emergent)
// ══════════════════════════════════
// When the chat gets too long, offer to compress the conversation into
// a compact summary and restart with a clean context window.

let _ctxTransferSkippedAt = 0; // timestamp of last "skip"

function checkContextTransfer() {
  if (!S.cur || !S.history) return;
  // Cooldown: don't ask again within 8 messages of a skip
  if (_ctxTransferSkippedAt && S.history.length - _ctxTransferSkippedAt < 8) return;

  const histLen = S.history.length;
  const totalChars = S.history.reduce((sum, m) => {
    const c = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
    return sum + c.length;
  }, 0);

  // Thresholds: 16+ messages OR 120K+ chars
  if (histLen >= 16 || totalChars > 120000) {
    showContextTransferModal();
  }
}

function showContextTransferModal() {
  const ov = document.getElementById('ctx-transfer-ov');
  const btn = document.getElementById('ctx-transfer-btn');
  const skipBtn = document.getElementById('ctx-skip-btn');
  if (!ov) return;

  ov.classList.add('open');

  btn.disabled = false;
  btn.textContent = '✓ Trasferisci contesto';

  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = '⏳ Generazione riassunto…';
    try {
      const summary = await generateContextSummary();
      applyContextTransfer(summary);
      ov.classList.remove('open');
    } catch (err) {
      console.warn('Context transfer failed:', err);
      btn.disabled = false;
      btn.textContent = '✓ Trasferisci contesto';
      toast('⚠️ Trasferimento fallito: ' + err.message, 'err');
      ov.classList.remove('open');
    }
  };

  skipBtn.onclick = () => {
    _ctxTransferSkippedAt = S.history.length;
    ov.classList.remove('open');
  };
}

async function generateContextSummary() {
  const files = S.cur?.files || {};
  const fileKeys = Object.keys(files);
  const plan = S.cur?.plan;
  const projectSummary = S.cur?.projectSummary || '';

  // Build file descriptions (name + first line + size)
  const fileDescs = fileKeys.map(k => {
    const content = files[k] || '';
    const lines = content.split('\n');
    const firstLine = lines[0]?.trim().slice(0, 80) || '';
    return `  ${k} (${lines.length} righe) — ${firstLine}`;
  }).join('\n');

  // Extract recent user messages (last 6)
  const recentMsgs = S.history.slice(-6).map(m => {
    const role = m.role === 'user' ? 'UTENTE' : 'AI';
    const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
    return `[${role}]: ${text.slice(0, 300)}`;
  }).join('\n');

  const sys = `Sei un assistente che sintetizza conversazioni di sviluppo software.
Genera un RIASSUNTO COMPATTO del progetto e della conversazione, in formato testo strutturato.
Il riassunto verrà usato come contesto iniziale per una nuova conversazione, quindi deve contenere
tutte le informazioni necessarie per continuare lo sviluppo senza perdere contesto.

Includi:
1. TIPO PROGETTO e STACK (framework, linguaggi, librerie)
2. OBIETTIVO originale dell'utente
3. STRUTTURA FILE (elenco con breve descrizione di ciascuno)
4. FUNZIONALITÀ IMPLEMENTATE (cosa fa l'app attualmente)
5. DECISIONI DI DESIGN prese durante la conversazione
6. PROBLEMI NOTI o bug segnalati dall'utente
7. ULTIMA RICHIESTA dell'utente (cosa stava chiedendo di fare)

Scrivi in italiano. Max 800 parole. Sii preciso e specifico, non generico.`;

  const projectMemory = getProjectMemory();
  const userMsg = `PROGETTO: ${S.cur?.name || 'Senza nome'}
${projectMemory ? '\n' + projectMemory + '\n' : ''}
${plan ? 'PIANO: tipo=' + plan.projectType + ', file=' + (plan.fileTree||[]).join(', ') + '\n' : ''}
FILE DEL PROGETTO:
${fileDescs}

MESSAGGI RECENTI:
${recentMsgs}

NUMERO TOTALE MESSAGGI: ${S.history.length}`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': S.key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: MODELS.haiku,
      max_tokens: 1500,
      temperature: 0.2,
      system: sys,
      messages: [{ role: 'user', content: userMsg }]
    })
  });

  if (!r.ok) throw new Error('API error ' + r.status);
  const data = await r.json();
  return data.content.map(b => b.text || '').join('').trim();
}

function applyContextTransfer(summary) {
  if (!S.cur) return;

  // Reset history with summary as first message
  S.history = [
    { role: 'assistant', content: `[CONTESTO TRASFERITO]\n\n${summary}\n\n[I file del progetto sono intatti. Continua da dove eravamo.]` }
  ];

  // Persist
  S.cur.conv = S.history;
  save();

  // Clear chat UI and show transfer confirmation
  const mc = document.getElementById('msgs');
  if (mc) mc.innerHTML = '';

  renderBbl('ai', '✅ **Contesto trasferito con successo**\n\nHo compresso la conversazione in un riassunto intelligente. I tuoi file sono intatti.\n\n📋 **Riassunto:**\n' + summary.split('\n').slice(0, 8).join('\n') + '\n\n_Puoi continuare a lavorare normalmente._');
  saveMsg('ai', '✅ Contesto trasferito — conversazione compressa');

  // Update project summary too
  S.cur.projectSummary = summary;
  save();

  addLog('plan', '🔄', 'Context Transfer', 'Conversazione compressa — contesto preservato');
  toast('✅ Contesto trasferito con successo', 'ok');
}

async function continueNextBatch(btn) {
  const prompt = btn.dataset.prompt;
  const mode = btn.dataset.mode;
  const qual = btn.dataset.qual;
  btn.parentElement.remove(); // remove button
  // Put prompt in chat and send
  document.getElementById('chat-ta').value = prompt;
  send();
}

// ══════════════════════════════════
// API
// ══════════════════════════════════
async function generateFullstack(prompt, qual) {
  const agentPersona = AGENTS[currentAgent]?.systemExtra || '';
  const qd = {pro:'Design professionale, raffinato.',fast:'Implementazione veloce.',detailed:'Molto dettagliato con commenti.'};

  const _mem = getProjectMemory();
  const sysFE = `Sei un expert frontend developer e UI/UX designer. Genera SOLO un file HTML+CSS+JS completo e autocontenuto.
${qd[qual]}
${_mem ? '\n' + _mem + '\n' : ''}
REQUISITI FRONTEND:
- Design dark mode moderno, palette coerente (CSS custom properties), Google Fonts (Outfit, Plus Jakarta Sans, Sora).
- Layout responsive mobile-first con CSS Grid/Flexbox, media queries per mobile.
- Micro-animazioni fluide, transizioni hover/focus, loading states, empty states.
- Ombre layered, backdrop-filter, border-radius coerenti, gradienti.
- Interfaccia COMPLETA: tutte le view, modali, form, feedback visivo.
- Error handling nel frontend (fetch catch, retry, messaggi utente), form validation.
- Usa fetch() per chiamare il backend su http://localhost:5000.
- ALMENO 300-600 righe — interfaccia ricca, non scheletrica.

REGOLE ANTI-BUG:
- Ogni variabile dichiarata, nessun nome duplicato, nessun DOM non trovato.
- Testa mentalmente: caricamento pagina → fetch dati → render → interazione → aggiornamento.
- Gestisci: fetch falliti, risposte vuote, form vuoti, click rapidi multipli.

${agentPersona}
REGOLA ASSOLUTA: solo codice puro, zero markdown, zero backtick, zero spiegazioni.`;

  const sysBE = `Sei un expert backend developer. Genera SOLO un file Python Flask completo e funzionante.
${qd[qual]}
${_mem ? '\n' + _mem + '\n' : ''}
REQUISITI BACKEND:
- Flask con flask-cors, struttura pulita e modulare.
- TUTTI gli endpoint necessari: CRUD completo (GET, POST, PUT/PATCH, DELETE).
- Dati di esempio REALISTICI e abbondanti (almeno 10-20 entries).
- Error handling robusto con try/except, codici HTTP corretti (400, 404, 500), messaggi di errore chiari.
- Validazione input su OGNI endpoint (campi mancanti, tipi errati).
- Il server DEVE girare su porta 5000 con CORS abilitato per tutti gli origin.
- Commenti chiari per ogni sezione.
- ALMENO 150-300 righe di codice.

REGOLE ANTI-BUG:
- Ogni variabile usata deve essere dichiarata. Nessun import mancante.
- Gestisci: JSON malformato, id non trovati, liste vuote, divisione per zero.
- Se il server crasha, il codice deve essere correggibile dai log — non usare costrutti ambigui.
- Testa mentalmente: avvio server → prima richiesta GET → POST → verifica → DELETE.

${agentPersona}
REGOLA ASSOLUTA: solo codice Python puro, zero markdown, zero backtick, zero spiegazioni.`;

  const msgs = S.history.slice(-4);

  const [feRes, beRes] = await Promise.all([
    fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model: getModelForAgent('ui'), max_tokens:32000, temperature:0.3, system:sysFE, messages:[...msgs,{role:'user',content:prompt+' — genera il FRONTEND HTML completo e professionale'}]})
    }),
    fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model: getModelForAgent('logic'), max_tokens:16000, temperature:0.3, system:sysBE, messages:[...msgs,{role:'user',content:prompt+' — genera il BACKEND Python Flask completo'}]})
    })
  ]);

  if (!feRes.ok) { const e=await feRes.json().catch(()=>({})); throw new Error(e.error?.message||'Errore frontend'); }
  if (!beRes.ok) { const e=await beRes.json().catch(()=>({})); throw new Error(e.error?.message||'Errore backend'); }

  const feData = await feRes.json();
  const beData = await beRes.json();

  const feCode = feData.content.map(b=>b.text||'').join('').trim().replace(/^```[\w]*\n?/m,'').replace(/\n?```\s*$/m,'').trim();
  const beCode = beData.content.map(b=>b.text||'').join('').trim().replace(/^```[\w]*\n?/m,'').replace(/\n?```\s*$/m,'').trim();

  return { frontend: feCode, backend: beCode };
}

async function callAPI(prompt,mode,qual,isEdit,agent='direct') {
  const md={html:'HTML+CSS+JavaScript in un singolo file completo e autocontenuto',react:'componente React con hooks',python:'script Python completo',js:'JavaScript vanilla',css:'CSS moderno con variabili',sql:'query SQL commentata',bash:'script Bash commentato'};
  const qd={pro:'Design professionale, raffinato, codice pulito.',fast:'Implementazione veloce ma funzionante.',detailed:'Molto dettagliato con commenti esaustivi.'};
  const ex=S.cur&&Object.keys(S.cur.files).length?`\n\nFILE ATTUALMENTE NEL PROGETTO: ${Object.keys(S.cur.files).join(', ')}\n\nCodice attuale (${S.curFile || Object.keys(S.cur.files)[0]}):\n\`\`\`\n${Object.values(S.cur.files)[0].slice(0,6000)}\n\`\`\``:'';
  const agentPersona = AGENTS[currentAgent]?.systemExtra || '';
  const _dmem = getProjectMemory();
  const sys=`Sei un expert full-stack developer e UI/UX designer di livello mondiale. Genera codice ${md[mode]} di qualità PROFESSIONALE.

${qd[qual]}
${_dmem ? '\n' + _dmem + '\n' : ''}

REQUISITI DI QUALITÀ:
1. UI/UX professionale: spacing armonioso (8px grid), tipografia con gerarchia (Google Fonts: Outfit, Plus Jakarta Sans, Sora, Manrope). Palette coerente con CSS custom properties.
2. Interattività ricca: animazioni CSS fluide (transitions hover/focus/active), micro-interazioni, loading states, empty states, feedback visivo per ogni azione utente. Usa @keyframes per animazioni complesse.
3. Responsivo mobile-first (320px-1920px). CSS Grid/Flexbox. Media queries dove necessario.
4. Funzionalità COMPLETE — NESSUN placeholder, NESSUN mock. Implementa TUTTA la logica reale. Se è un gioco deve essere giocabile. Se è un player deve funzionare con Web Audio API. Se è una dashboard i grafici devono essere interattivi.
5. Codice robusto: error handling, input validation, edge cases. localStorage per persistenza dove utile.
6. Dark mode: sfondo #0a0a0a/#111, card con bordi rgba(255,255,255,0.06), accenti vivaci.
7. ALMENO 300-800+ righe. Non essere minimalista — aggiungi features, dettagli UI, animazioni.

${isEdit?`STAI MODIFICANDO codice esistente. REGOLE DI MODIFICA:
- Rispondi SEMPRE con il file COMPLETO (non patch parziali).
- Mantieni TUTTE le funzionalità esistenti che non sono state esplicitamente chieste di rimuovere.
- Applica SOLO le modifiche richieste + fix di eventuali bug.
- NON riscrivere da zero se non richiesto — modifica chirurgicamente.`:'Crea da zero un\'applicazione COMPLETA e FUNZIONALE.'}
${agentPersona}

REGOLE ANTI-BUG (SEGUI SEMPRE):
1. PIANIFICA prima di scrivere: elenca mentalmente tutte le variabili, funzioni e proprietà. Verifica zero conflitti di nome.
2. NON usare MAI lo stesso nome per scopi diversi (es: "coins" come numero E come array nello stesso oggetto).
3. Ogni funzione chiamata DEVE esistere nel codice. Ogni variabile referenziata DEVE essere dichiarata.
4. Testa mentalmente il flusso COMPLETO: init → primo render → interazione utente → aggiornamento stato → re-render. OGNI passaggio deve funzionare.
5. Se usi Canvas/WebGL: il canvas DEVE essere ridimensionato correttamente, TUTTI gli oggetti devono esistere prima di chiamare metodi su di essi.
6. Se usi classi: OGNI metodo referenziato deve esistere nella classe.
7. Gestisci SEMPRE: divisione per zero, array vuoti, elementi DOM non trovati (usa ?. o check null), eventi prima dell'init.
8. Se generi un gioco: il game loop DEVE funzionare dal primo frame, i controlli devono rispondere immediatamente, la fisica deve essere coerente, collisioni devono funzionare.
9. Se il build/esecuzione fallisce, correggi basandoti sui LOG DI ERRORE — non inventare soluzioni.

REGOLA ASSOLUTA: SOLO codice puro. Zero markdown, zero backtick, zero spiegazioni, zero testo prima o dopo il codice.
Per HTML: file completo <!DOCTYPE html> con TUTTO inline (CSS in <style>, JS in <script>). Includi meta viewport e font imports.${ex}`;
  const msgs=S.history.slice(-6);  // last entry already contains multipart content from buildContent
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:getModelForAgent(agent),max_tokens:32000,temperature:0.3,system:sys,messages:msgs})});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error?.message||`HTTP ${r.status}`);}
  const data=await r.json();
  return data.content.map(b=>b.text||'').join('').trim().replace(/^```[\w]*\n?/m,'').replace(/\n?```\s*$/m,'').trim();
}
