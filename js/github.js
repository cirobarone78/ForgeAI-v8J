// ══════════════════════════════════
// GITHUB EXPORT
// ══════════════════════════════════
function openGitHub() {
  if (!S.cur || !Object.keys(S.cur.files||{}).length) {
    toast('⚠️ Genera prima un progetto', 'err'); return;
  }
  // Pre-fill token and repo name
  document.getElementById('gh-token-inp').value = S.ghToken;
  const repoName = (S.cur.name || 'forge-app')
    .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50) || 'forge-app';
  document.getElementById('gh-repo-inp').value = repoName;
  document.getElementById('gh-desc-inp').value = 'App generata con Forge AI';
  // Reset UI
  document.getElementById('gh-steps').classList.remove('show');
  document.getElementById('gh-result').classList.remove('show');
  document.getElementById('gh-push-btn').disabled = false;
  document.getElementById('gh-push-btn').textContent = '🚀 Pubblica';
  ['gs-1','gs-2','gs-3','gs-4','gs-5'].forEach(id => {
    const el = document.getElementById(id);
    el.className = 'prog-step';
  });
  openModal('gh-ov');
}

function ghStep(id, state) {
  const el = document.getElementById(id);
  if (el) el.className = 'prog-step ' + state;
}

async function pushToGitHub() {
  const token = document.getElementById('gh-token-inp').value.trim();
  const repoName = document.getElementById('gh-repo-inp').value.trim();
  const desc = document.getElementById('gh-desc-inp').value.trim();
  const isPrivate = document.getElementById('gh-private').checked;

  if (!token) { toast('❌ Inserisci il GitHub Token', 'err'); return; }
  if (!repoName) { toast('❌ Inserisci il nome della repo', 'err'); return; }
  if (!/^[a-zA-Z0-9._-]+$/.test(repoName)) { toast('❌ Nome repo non valido', 'err'); return; }

  // Save token
  S.ghToken = token;
  localStorage.setItem('fg_ghtoken', token);

  const btn = document.getElementById('gh-push-btn');
  btn.disabled = true; btn.textContent = '⏳ Pubblicazione…';
  document.getElementById('gh-steps').classList.add('show');
  document.getElementById('gh-result').classList.remove('show');

  const headers = {
    'Authorization': 'token ' + token,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github.v3+json'
  };

  try {
    // Step 1: Get user info
    ghStep('gs-1', 'active');
    const userRes = await fetch('https://api.github.com/user', { headers });
    if (!userRes.ok) throw new Error('Token non valido o scaduto');
    const user = await userRes.json();
    ghStep('gs-1', 'done');

    // Step 2: Create repo (delete if exists first)
    ghStep('gs-2', 'active');
    // Try delete existing (ignore errors)
    await fetch(`https://api.github.com/repos/${user.login}/${repoName}`, {
      method: 'DELETE', headers
    }).catch(()=>{});
    await sleep(500);

    const createRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST', headers,
      body: JSON.stringify({
        name: repoName, description: desc,
        private: isPrivate, auto_init: false
      })
    });
    if (!createRes.ok) {
      const e = await createRes.json();
      throw new Error(e.message || 'Errore creazione repo');
    }
    const repo = await createRes.json();
    ghStep('gs-2', 'done');

    // Step 3: Upload files
    ghStep('gs-3', 'active');
    await sleep(800); // Let GitHub init the repo
    const files = S.cur.files || {};
    const fileEntries = Object.entries(files);

    for (const [filename, fileContent] of fileEntries) {
      const encoded = btoa(unescape(encodeURIComponent(fileContent)));
      const uploadRes = await fetch(`https://api.github.com/repos/${user.login}/${repoName}/contents/${filename}`, {
        method: 'PUT', headers,
        body: JSON.stringify({
          message: `Add ${filename} via Forge AI`,
          content: encoded
        })
      });
      if (!uploadRes.ok) {
        const e = await uploadRes.json();
        throw new Error(`Errore upload ${filename}: ${e.message}`);
      }
    }
    ghStep('gs-3', 'done');

    // Step 4: Enable GitHub Pages (only for static projects with HTML)
    const hasHtml = Object.keys(files).some(f => f.endsWith('.html'));
    const projNeedsBuild = needsBuild();
    const gs4 = document.getElementById('gs-4');
    if (gs4) gs4.innerHTML = `<div class="step-dot"></div>${projNeedsBuild ? 'Verifica deploy' : 'Attivazione GitHub Pages'}`;
    ghStep('gs-4', 'active');
    let pagesUrl = null;
    if (!isPrivate && hasHtml && !projNeedsBuild) {
      await sleep(500);
      const pagesRes = await fetch(`https://api.github.com/repos/${user.login}/${repoName}/pages`, {
        method: 'POST', headers: {...headers, 'Accept': 'application/vnd.github.switcheroo-preview+json'},
        body: JSON.stringify({ source: { branch: 'main', path: '/' } })
      });
      if (pagesRes.ok) {
        pagesUrl = `https://${user.login}.github.io/${repoName}`;
      }
    }
    ghStep('gs-4', 'done');

    // Step 5: Done
    ghStep('gs-5', 'done');

    // Show result
    const repoUrl = repo.html_url;
    document.getElementById('gh-repo-url').textContent = repoUrl;
    document.getElementById('gh-repo-link').href = repoUrl;

    let pagesHtml = '';
    if (projNeedsBuild) {
      const kind = getProjectKind();
      const deployTips = {
        'vite-react': 'Importa la repo su <strong>Vercel</strong> o <strong>Netlify</strong> — rileveranno Vite automaticamente.',
        'nextjs': 'Importa la repo su <strong>Vercel</strong> (consigliato per Next.js) per deploy automatico.',
        'node-express': 'Usa <strong>Railway</strong>, <strong>Render</strong> o <strong>Fly.io</strong> per il deploy del server Node.',
        'node': 'Usa <strong>Railway</strong> o <strong>Render</strong> per il deploy.'
      };
      pagesHtml = `<strong style="color:#F59E0B">⚠️ Progetto ${kind}</strong> — richiede build, GitHub Pages non attivato.<br>
        ${deployTips[kind] || deployTips['node']}<br>
        <code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-size:11px;">git clone ${repoUrl}.git && npm install && npm run dev</code>`;
    } else if (pagesUrl) {
      pagesHtml = `<strong style="color:#3A86FF">🌐 GitHub Pages attivato!</strong><br>
        Il sito sarà live tra ~1 minuto su:<br>
        <a href="${pagesUrl}" target="_blank">${pagesUrl}</a>`;
    } else if (isPrivate) {
      pagesHtml = '⚠️ GitHub Pages non disponibile per repo private.';
    } else {
      pagesHtml = '💡 Puoi attivare GitHub Pages manualmente: Settings → Pages → Deploy from branch main.';
    }
    document.getElementById('gh-pages-info').innerHTML = pagesHtml;
    document.getElementById('gh-result').classList.add('show');

    btn.textContent = '✅ Pubblicato!';
    toast('🐙 Pubblicato su GitHub!', 'ok');

    // Update topbar button
    document.getElementById('gh-btn').classList.add('ready');

  } catch(err) {
    ['gs-1','gs-2','gs-3','gs-4','gs-5'].forEach(id => {
      if (document.getElementById(id).classList.contains('active')) ghStep(id, 'err');
    });
    btn.disabled = false; btn.textContent = '🚀 Riprova';
    toast('❌ ' + err.message, 'err');
  }
}
