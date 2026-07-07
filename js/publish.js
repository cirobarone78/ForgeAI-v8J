// ══════════════════════════════════
// PUBBLICA (one-click publish su GitHub Pages)
// Non distruttivo: crea la repo la prima volta, poi aggiorna solo i file.
// Il link pubblico viene salvato nel progetto e mostrato in chat.
// ══════════════════════════════════

(function () {

  const GH_API = 'https://api.github.com';

  function ghHeaders() {
    return {
      'Authorization': 'token ' + S.ghToken,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
    };
  }

  function publishSlug() {
    if (S.cur.publishRepo) return S.cur.publishRepo;
    const base = (S.cur.name || 'app').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'app';
    return 'forge-' + base;
  }

  function b64(content) {
    return btoa(unescape(encodeURIComponent(content)));
  }

  function b64decode(content) {
    return decodeURIComponent(escape(atob(String(content).replace(/\s/g, ''))));
  }

  // ── Helper GitHub API ──
  async function ghGetFile(login, repo, path) {
    const r = await fetch(`${GH_API}/repos/${login}/${repo}/contents/${path}`, { headers: ghHeaders() });
    return r.ok ? r.json() : null;
  }

  async function ghPut(login, repo, path, content, message) {
    const existing = await ghGetFile(login, repo, path);
    const r = await fetch(`${GH_API}/repos/${login}/${repo}/contents/${path}`, {
      method: 'PUT', headers: ghHeaders(),
      body: JSON.stringify({
        message,
        content: b64(content),
        ...(existing ? { sha: existing.sha } : {})
      })
    });
    if (!r.ok) throw new Error(path + ': ' + ((await r.json()).message || r.status));
  }

  // Ritorna true se la repo è stata appena creata
  async function ensureRepo(login, name, description) {
    const r = await fetch(`${GH_API}/repos/${login}/${name}`, { headers: ghHeaders() });
    if (r.ok) return false;
    const cRes = await fetch(GH_API + '/user/repos', {
      method: 'POST', headers: ghHeaders(),
      body: JSON.stringify({ name, description, private: false, auto_init: false })
    });
    if (!cRes.ok) throw new Error((await cRes.json()).message || 'Errore creazione repo ' + name);
    await sleep(800);
    return true;
  }

  async function enablePages(login, repo) {
    const r = await fetch(`${GH_API}/repos/${login}/${repo}/pages`, {
      method: 'POST',
      headers: { ...ghHeaders(), 'Accept': 'application/vnd.github+json' },
      body: JSON.stringify({ source: { branch: 'main', path: '/' } })
    });
    if (!r.ok && r.status !== 409) console.warn('Pages ' + repo + ':', r.status);
  }

  // ── Galleria arcade: aggiorna games.json + pagina su forge-arcade ──
  const ARCADE_REPO = 'forge-arcade';

  async function updateArcade(login, gameEntry) {
    await ensureRepo(login, ARCADE_REPO, 'Il mio arcade — giochi creati con ForgeAI');

    // games.json: leggi, unisci, riscrivi
    let data = { games: [] };
    const existing = await ghGetFile(login, ARCADE_REPO, 'games.json');
    if (existing && existing.content) {
      try { data = JSON.parse(b64decode(existing.content)); } catch { /* riparte pulito */ }
    }
    if (!Array.isArray(data.games)) data.games = [];
    const i = data.games.findIndex(g => g.id === gameEntry.id);
    if (i >= 0) {
      data.games[i] = { ...gameEntry, addedAt: data.games[i].addedAt || gameEntry.addedAt };
    } else {
      data.games.unshift(gameEntry);
    }
    data.updated = new Date().toISOString();
    await ghPut(login, ARCADE_REPO, 'games.json', JSON.stringify(data, null, 2), 'Update games.json (ForgeAI)');

    // Pagina arcade: presa da questa app e pushata (così gli aggiornamenti della
    // pagina arrivano a tutti gli arcade alla pubblicazione successiva)
    try {
      const tplRes = await fetch('arcade/index.html');
      if (tplRes.ok) {
        await ghPut(login, ARCADE_REPO, 'index.html', await tplRes.text(), 'Update arcade page (ForgeAI)');
      }
    } catch { /* la pagina resta quella già pubblicata */ }

    await enablePages(login, ARCADE_REPO);
    return `https://${login}.github.io/${ARCADE_REPO}/`;
  }

  function isPublishable() {
    return S.cur && S.cur.files && S.cur.files['index.html'] && !needsBuild();
  }

  // ── Modal token (creato al volo, stile coerente con gli altri modal) ──
  function ensureTokenModal() {
    if (document.getElementById('pub-ov')) return;
    const div = document.createElement('div');
    div.id = 'pub-ov';
    div.className = 'ov';
    div.addEventListener('click', e => { if (e.target.id === 'pub-ov') closeModal('pub-ov'); });
    div.innerHTML = `
      <div class="mbox" style="max-width:440px">
        <div class="mhead">
          <span class="mtitle">🌍 Pubblica online</span>
          <button class="mclose" onclick="closeModal('pub-ov')">✕</button>
        </div>
        <div class="mbody">
          <div class="field">
            <div class="flabel">GitHub Token</div>
            <input type="password" class="finput" id="pub-token-inp" placeholder="ghp_…">
            <div class="fhint">
              Serve una sola volta, resta nel tuo browser.<br><br>
              Crealo su <a href="https://github.com/settings/tokens/new?scopes=public_repo&description=ForgeAI%20Publish" target="_blank">github.com/settings/tokens</a> con permesso <strong>public_repo</strong>, poi incollalo qui.
            </div>
          </div>
        </div>
        <div class="mfooter">
          <button class="mbtn" onclick="closeModal('pub-ov')">Annulla</button>
          <button class="mbtn pri" onclick="savePubToken()">Salva e pubblica</button>
        </div>
      </div>`;
    document.body.appendChild(div);
  }

  window.savePubToken = function () {
    const t = document.getElementById('pub-token-inp').value.trim();
    if (!t) { toast('❌ Inserisci il token', 'err'); return; }
    S.ghToken = t;
    localStorage.setItem('fg_ghtoken', t);
    closeModal('pub-ov');
    publishNow();
  };

  // ── Card in chat con il link pubblico (+ galleria arcade) ──
  function showPublishedCard(url, isUpdate, arcadeUrl) {
    const mc = document.getElementById('msgs');
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;justify-content:center;padding:6px 0';
    d.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;align-items:center;padding:14px 20px;border-radius:16px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);max-width:90%">
        <div style="font-family:'Outfit',sans-serif;font-size:13px;font-weight:700;color:#10B981">🌍 ${isUpdate ? 'Aggiornato online' : 'Pubblicato online'}</div>
        <a href="${url}" target="_blank" style="color:#3A86FF;font-size:13px;word-break:break-all;text-align:center">${url}</a>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
          <button onclick="navigator.clipboard.writeText('${url}').then(()=>toast('⎘ Link copiato','ok'))" style="padding:7px 14px;border-radius:9999px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:#fff;font-size:12px;font-weight:600;cursor:pointer">⎘ Copia link</button>
          <a href="${url}" target="_blank" style="padding:7px 14px;border-radius:9999px;border:1px solid rgba(16,185,129,0.3);background:rgba(16,185,129,0.12);color:#10B981;font-size:12px;font-weight:600;text-decoration:none">▶ Apri</a>
          ${arcadeUrl ? `<a href="${arcadeUrl}" target="_blank" style="padding:7px 14px;border-radius:9999px;border:1px solid rgba(255,159,28,0.3);background:rgba(255,159,28,0.1);color:#FF9F1C;font-size:12px;font-weight:600;text-decoration:none">🕹 Arcade</a>` : ''}
        </div>
        ${arcadeUrl ? `<div style="font-size:11px;color:rgba(255,255,255,0.35)">Aggiunto alla tua galleria: <a href="${arcadeUrl}" target="_blank" style="color:rgba(255,159,28,0.7)">${arcadeUrl}</a></div>` : ''}
        <div style="font-size:11px;color:rgba(255,255,255,0.3)">La prima pubblicazione può richiedere ~1 minuto per andare live.</div>
      </div>`;
    mc.appendChild(d);
    d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── Pill "Pubblica" mostrata in chat dopo una generazione riuscita ──
  window.addPublishBtn = function () {
    if (!isPublishable()) return;
    const mc = document.getElementById('msgs');
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;justify-content:center;padding:4px 0';
    d.innerHTML = `<button onclick="publishNow()" style="display:flex;align-items:center;gap:7px;padding:9px 18px;border-radius:9999px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);color:#10B981;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s" onmouseover="this.style.background='rgba(16,185,129,0.2)'" onmouseout="this.style.background='rgba(16,185,129,0.12)'">🌍 ${S.cur.publishedUrl ? 'Aggiorna la versione online' : 'Pubblica online — link condivisibile'}</button>`;
    mc.appendChild(d);
    d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  function setPubBtnState(busyText) {
    const btn = document.getElementById('pub-btn');
    if (!btn) return;
    if (busyText) { btn.disabled = true; btn.textContent = busyText; }
    else {
      btn.disabled = false;
      btn.textContent = S.cur?.publishedUrl ? '🌍 Aggiorna' : '🌍 Pubblica';
    }
  }

  // ── Flusso principale ──
  window.publishNow = async function () {
    if (!S.cur || !Object.keys(S.cur.files || {}).length) {
      toast('⚠️ Genera prima un progetto', 'err'); return;
    }
    if (!S.cur.files['index.html']) {
      toast('⚠️ Serve un index.html per pubblicare su Pages', 'err'); return;
    }
    if (needsBuild()) {
      toast('⚠️ Progetto con build: usa 🐙 GitHub + Vercel/Netlify', 'err');
      openGitHub(); return;
    }
    if (!S.ghToken) { ensureTokenModal(); openModal('pub-ov'); return; }

    setPubBtnState('⏳ Pubblico…');
    toast('🌍 Pubblicazione in corso…', 'ok');

    try {
      // 1. Utente
      const uRes = await fetch(GH_API + '/user', { headers: ghHeaders() });
      if (!uRes.ok) {
        S.ghToken = ''; localStorage.removeItem('fg_ghtoken');
        throw new Error('Token non valido o scaduto — reinseriscilo');
      }
      const user = await uRes.json();

      // 2. Repo: riusa quella del progetto o creala
      const repoName = publishSlug();
      const created = await ensureRepo(user.login, repoName, 'Creato con ForgeAI — ' + (S.cur.name || 'app'));
      const isUpdate = !created;

      // 3. Upload/aggiornamento file (non distruttivo: PUT con sha se esiste)
      const files = Object.entries(S.cur.files);
      let done = 0;
      for (const [path, content] of files) {
        await ghPut(user.login, repoName, path, content, (isUpdate ? 'Update ' : 'Add ') + path + ' (ForgeAI)');
        done++;
        setPubBtnState(`⏳ ${done}/${files.length}`);
      }

      // 4. Attiva Pages (409 = già attivo, ok)
      await enablePages(user.login, repoName);

      // 5. Salva
      const url = `https://${user.login}.github.io/${repoName}/`;
      S.cur.publishRepo = repoName;
      S.cur.publishedUrl = url;
      save();

      // 6. Aggiorna la galleria arcade (non fatale se fallisce)
      let arcadeUrl = null;
      try {
        setPubBtnState('⏳ Galleria…');
        const now = new Date().toISOString();
        arcadeUrl = await updateArcade(user.login, {
          id: repoName,
          name: S.cur.name || repoName,
          url,
          addedAt: now,
          updatedAt: now
        });
        localStorage.setItem('fg_arcade_url', arcadeUrl);
      } catch (aErr) {
        console.warn('Arcade:', aErr);
        toast('⚠️ Galleria non aggiornata: ' + aErr.message, 'err');
      }

      // 7. Mostra i link
      showPublishedCard(url, isUpdate, arcadeUrl);
      saveMsg('ai', '🌍 ' + (isUpdate ? 'Aggiornato' : 'Pubblicato') + ': ' + url + (arcadeUrl ? ' · Arcade: ' + arcadeUrl : ''));
      toast(isUpdate ? '🌍 Versione online aggiornata!' : '🌍 Pubblicato online!', 'ok');
    } catch (err) {
      toast('❌ ' + err.message, 'err');
      if (/token/i.test(err.message)) { ensureTokenModal(); openModal('pub-ov'); }
    } finally {
      setPubBtnState(null);
    }
  };
})();
