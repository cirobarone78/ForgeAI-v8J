// ForgeAI v9 — server: serve la UI, gestisce i workspace, la preview
// e il canale WebSocket verso il motore ad agente.
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import * as ws from './workspaces.js';
import { runAgent, createUserStream, buildRunPrompt } from './agent.js';
import { buildPlanPrompt, buildGoPrompt } from './prompts.js';
import { closeBrowser } from './screenshot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_ROOT = path.join(__dirname, '..', '..');
const PORT = Number(process.env.PORT || 8787);

const app = express();
app.use(express.json({ limit: '25mb' }));

// CORS: la UI può anche girare da file:// o GitHub Pages e parlare col server locale.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, engine: 'agent', version: 9, hasServerKey: !!process.env.ANTHROPIC_API_KEY });
});

app.post('/api/projects', (req, res) => {
  try {
    const { name, files } = req.body || {};
    const id = ws.create(name, files);
    res.json({ id, previewUrl: '/preview/' + id + '/' });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.get('/api/projects/:id/files', (req, res) => {
  const files = ws.readFiles(req.params.id);
  if (!files) return res.status(404).json({ error: 'progetto inesistente' });
  res.json({ files, hasIndexHtml: ws.hasIndexHtml(req.params.id) });
});

app.post('/api/projects/:id/files', (req, res) => {
  try {
    const written = ws.writeFiles(req.params.id, req.body?.files || {});
    res.json({ written });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

// Preview statica del workspace (dist/ o build/ se presenti).
app.use('/preview/:id', (req, res, next) => {
  const dir = ws.previewDir(req.params.id);
  if (!dir) return res.status(404).send('Progetto non trovato');
  express.static(dir)(req, res, next);
});

// Serve la UI di ForgeAI dalla root del repo.
app.use(express.static(UI_ROOT));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (socket) => {
  let running = false;
  let stream = null;
  let abortController = null;

  const send = (obj) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(obj));
  };

  socket.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'user_message' && running && stream) {
      stream.push(String(msg.text || '').slice(0, 4000));
      send({ type: 'status', text: 'Messaggio inoltrato all\'agente.' });
      return;
    }

    if (msg.type === 'stop' && running) {
      abortController?.abort();
      return;
    }

    if (msg.type !== 'run') return;
    if (running) { send({ type: 'error', message: 'Run già in corso su questa connessione.' }); return; }

    const projectId = msg.projectId;
    const dir = ws.dirOf(projectId);
    if (!dir) { send({ type: 'error', message: 'Progetto inesistente: crea prima il progetto.' }); return; }

    const apiKey = (msg.apiKey && msg.apiKey.startsWith('sk-')) ? msg.apiKey : '';
    if (!apiKey && !process.env.ANTHROPIC_API_KEY) {
      send({ type: 'error', message: 'Nessuna API key: impostala nella UI o esporta ANTHROPIC_API_KEY sul server.' });
      return;
    }

    running = true;
    abortController = new AbortController();
    const meta = ws.readMeta(projectId);
    const files = ws.readFiles(projectId) || {};
    const isEdit = Object.keys(files).length > 0;
    const previewUrl = 'http://localhost:' + PORT + '/preview/' + projectId + '/';
    const mode = msg.mode === 'plan' || msg.mode === 'build' ? msg.mode : 'direct';
    const userText = String(msg.prompt || '').slice(0, 20000);

    let runPrompt;
    if (mode === 'plan') {
      runPrompt = buildPlanPrompt({ userText, isEdit });
    } else if (mode === 'build') {
      runPrompt = buildGoPrompt({ userText, changes: String(msg.changes || '').slice(0, 4000), previewUrl });
    } else {
      runPrompt = buildRunPrompt({ userText, previewUrl, isEdit });
    }
    stream = createUserStream(runPrompt);

    send({
      type: 'status',
      text: mode === 'plan' ? 'Preparo il piano…'
        : mode === 'build' ? 'Piano approvato: costruzione in corso…'
        : isEdit ? 'Modifica progetto esistente…' : 'Nuovo progetto: avvio agente…'
    });

    try {
      const out = await runAgent({
        dir,
        userText: msg.prompt,
        previewUrl,
        isEdit,
        apiKey,
        model: typeof msg.model === 'string' ? msg.model : undefined,
        resumeSessionId: meta.sessionId || undefined,
        stream,
        abortController,
        onEvent: send,
        planMode: mode === 'plan',
      });

      if (out.sessionId) ws.writeMeta(projectId, { sessionId: out.sessionId });

      if (mode !== 'plan') send({ type: 'files', files: ws.readFiles(projectId) || {} });
      send({
        type: 'result',
        mode,
        ok: !!out.ok,
        aborted: !!out.aborted,
        costUsd: out.costUsd || 0,
        turns: out.turns || 0,
        previewUrl: '/preview/' + projectId + '/',
        hasIndexHtml: ws.hasIndexHtml(projectId),
      });
    } catch (err) {
      console.error('[run]', err);
      // Sessione di resume corrotta/scaduta: la scartiamo per il prossimo run.
      if (/resume|session/i.test(String(err.message || ''))) ws.writeMeta(projectId, { sessionId: null });
      send({ type: 'error', message: String(err.message || err).slice(0, 400) });
    } finally {
      running = false;
      stream = null;
      abortController = null;
    }
  });

  socket.on('close', () => {
    abortController?.abort();
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ⚡ ForgeAI v9 (motore ad agente)');
  console.log('  UI:      http://localhost:' + PORT);
  console.log('  Health:  http://localhost:' + PORT + '/api/health');
  console.log('  API key: ' + (process.env.ANTHROPIC_API_KEY ? 'da variabile d\'ambiente ✓' : 'da impostare nella UI'));
  console.log('');
});

process.on('SIGINT', async () => { await closeBrowser(); process.exit(0); });
process.on('SIGTERM', async () => { await closeBrowser(); process.exit(0); });
