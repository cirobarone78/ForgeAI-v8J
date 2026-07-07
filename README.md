# ⚡ ForgeAI v9

Genera app web e giochi descrivendoli in chat — stile Emergent/Lovable, in locale.

Dalla v9 la generazione non avviene più "alla cieca" nel browser: la UI si collega a un
**motore ad agente** (Claude Agent SDK) che lavora in un workspace reale sul tuo computer:
scrive i file, esegue `npm install` e le build, avvia l'app, **guarda screenshot reali**
del risultato (Playwright) e itera finché funziona ed è visivamente curata.

## Architettura

```
Browser (questa UI: index.html + js/)
   │  WebSocket + REST
   ▼
server/ (Node + Express)
   ├─ Claude Agent SDK  → agente con filesystem, shell, build reali
   ├─ tool screenshot   → Chromium headless: feedback visivo + errori console
   ├─ workspaces/<id>/  → i file di ogni progetto
   └─ /preview/<id>/    → preview servita nell'iframe della UI
```

Se il backend non è attivo, la UI ricade automaticamente nella vecchia pipeline
browser-only (v8), che resta funzionante ma con qualità inferiore.

## Avvio da iPad / iPhone (GitHub Codespaces)

Non serve un computer: il server gira in un Codespace gratuito (120 ore/mese) direttamente dal browser.

1. Apri questo repository su **github.com** da Safari.
2. Tocca **Code → Codespaces → Create codespace** (sul branch che vuoi usare).
3. Aspetta che l'ambiente si prepari (la prima volta installa tutto da solo).
4. Nel terminale in basso scrivi: `cd server && npm start`
5. Appare la notifica che la **porta 8787** è disponibile: tocca **"Open in Browser"**
   (oppure tab "Ports" → apri l'indirizzo della porta 8787).
6. Si apre ForgeAI: imposta la API key con ⚙ e inizia a generare.

Quando hai finito, ferma il Codespace da github.com → Codespaces per non consumare ore.

## Avvio da computer

Richiede Node.js ≥ 18.

```bash
cd server
npm install
npx playwright install chromium   # opzionale ma consigliato: abilita il feedback visivo
npm start
```

Apri **http://localhost:8787**, imposta la tua API key Anthropic (⚙ in alto a destra)
e descrivi l'app o il gioco che vuoi. In alternativa alla key nella UI puoi esportare
`ANTHROPIC_API_KEY` prima di `npm start`.

## Pubblica online (link condivisibile)

Il bottone **🌍 Pubblica** mette il progetto su GitHub Pages con un click:

- La prima volta chiede un GitHub Token (permesso `public_repo`), salvato nel browser.
- Crea una repo pubblica `forge-<nome>` sul tuo account e attiva Pages; il link
  `https://<tuo-utente>.github.io/forge-<nome>/` appare in chat, pronto da condividere.
- Le pubblicazioni successive **aggiornano** la stessa repo (niente cancellazioni).
- Funziona per i progetti statici (con `index.html`); per progetti con build usa 🐙 GitHub + Vercel/Netlify.

### 🕹 Galleria arcade

Ogni pubblicazione aggiorna anche il tuo **arcade personale**: una pagina
`https://<tuo-utente>.github.io/forge-arcade/` con tutti i giochi pubblicati in una
griglia di card (anteprima live in miniatura, tocca per giocare). Un solo link da
condividere per tutta la collezione — si costruisce da sola, senza passaggi extra.

## Note

- I progetti generati vivono in `server/workspaces/` (esclusi da git).
- Il modello si sceglie dal selettore in alto (Auto = Sonnet; Opus per i task più complessi).
- Puoi scrivere in chat **mentre** l'agente lavora: il messaggio gli viene inoltrato subito.
- L'agente gira con permessi shell reali sulla tua macchina (come Claude Code): usa il
  progetto in locale e per uso personale.

## Variabili d'ambiente (server)

| Variabile | Effetto |
|---|---|
| `PORT` | Porta del server (default 8787) |
| `ANTHROPIC_API_KEY` | API key lato server (la UI non la chiede più) |
| `FORGE_MODEL` | Modello di default (default `claude-sonnet-5`) |
| `FORGE_CHROMIUM_PATH` | Percorso Chromium custom per gli screenshot |
| `FORGE_DEBUG` | Log stderr dell'agente in console |
