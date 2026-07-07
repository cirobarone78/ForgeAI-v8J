# 🗺 ForgeAI — Roadmap

Idee future, in ordine di valore stimato. **Regola decisa insieme:** non si costruisce
nulla di questa lista finché l'uso reale non lo richiede — la prima cosa che dà fastidio
usando ForgeAI è il prossimo item da fare.

Aggiornata: luglio 2026, dopo il completamento del pacchetto v9
(motore ad agente + playtest + piano approvabile + costi sotto controllo +
pubblicazione one-click + galleria arcade).

## Backlog

### 1. Scaffold di gioco pronti
Basi collaudate (platform, endless runner, quiz, puzzle, top-down) con game loop,
input touch, audio WebAudio e "juice" già implementati. L'agente parte da una base
solida invece che da zero → giochi più ricchi, run più economici (meno turni).
**Prerequisito:** capire dai primi giochi reali quali generi servono davvero.

### 2. Verifica mobile obbligatoria
Il tool playtest supporta già il viewport da telefono (`width: 390`). Renderla un
passo fisso del workflow nel prompt del builder (screenshot desktop + mobile prima
di dichiarare finito). Modifica piccola (~10 min in `server/src/prompts.js`).
**Ha senso se:** i giochi vengono aperti soprattutto da link WhatsApp su telefono.

### 3. Mini-editor dei file nella UI
Textarea con "salva nel workspace" per ritocchi a mano (un testo, un colore) senza
scomodare l'agente. L'endpoint backend esiste già (`POST /api/projects/:id/files`);
manca solo la UI sopra il pannello codice.

### 4. Preview per app con server (proxy dev server)
Oggi l'iframe mostra solo progetti statici (o `dist/`). Un proxy verso il dev server
del workspace aprirebbe la strada ad app fullstack (Node/Express, React senza build).
**Ha senso se:** si vuole andare oltre i giochi.

### 5. Card arcade più ricche
Descrizione del gioco scritta dall'agente (invece del solo nome progetto) +
anteprima social (og:image) così i link condivisi su WhatsApp mostrano una preview.
Tocca `arcade/index.html`, `js/publish.js` e il prompt del builder.

### 6. Server sempre acceso (deploy cloud)
ForgeAI su Railway/Render con autenticazione: usabile da iPad/telefono senza
Codespaces, sempre allo stesso URL. Richiede: Dockerfile, un token di accesso,
~5$/mese. **Ha senso se:** l'uso dal Mac va stretto.

### 7. Pulizia del codice legacy v8
Le ~8.000 righe della vecchia pipeline browser-only sono ancora in `js/` come
fallback quando il backend non c'è. Ridurle a un fallback minimo (o rimuoverle)
alleggerirebbe la manutenzione. Zero impatto sull'uso quotidiano.

## Idee sparse (non prioritizzate)
- Template/remix: "prendi Snake e fallo spaziale" partendo da un gioco esistente.
- Modalità semplificata per chi non sa scrivere prompt (bambini, amici).
- Riscrittura cronologia git per eliminare i PDF personali anche dalla history
  (`git filter-repo` — solo se i contenuti sono considerati sensibili).

## Fatto (v9)
- ✅ Motore ad agente (Claude Agent SDK): filesystem, shell e build reali
- ✅ Verifica visiva con screenshot + errori console (Playwright)
- ✅ Playtest interattivo: l'agente gioca davvero prima di consegnare
- ✅ Piano approvabile prima della costruzione (fase read-only a costo minimo)
- ✅ Costi live nel badge + tetto di spesa per run (default $2)
- ✅ Pubblicazione one-click su GitHub Pages (non distruttiva)
- ✅ Galleria arcade auto-aggiornata con anteprime live
- ✅ Devcontainer per GitHub Codespaces (uso da iPad)
- ✅ Pulizia repo (PDF personali rimossi)
