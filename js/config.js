// ══════════════════════════════════
// CONFIG — Costanti e configurazione
// ══════════════════════════════════

const MODELS = {
  haiku:  'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-5-20250929',
  opus:   'claude-opus-4-5-20250918'
};

const MODEL_META = {
  auto:   { label:'Auto',   dot:'#10B981' },
  haiku:  { label:'Haiku',  dot:'#3A86FF' },
  sonnet: { label:'Sonnet', dot:'#FF9F1C' },
  opus:   { label:'Opus',   dot:'#a855f7' }
};

// Agent personas
const AGENTS = {
  e1: {
    id: 'e1',
    name: 'F-1',
    desc: 'Stabile & accurato',
    icon: '🛡',
    color: '#3A86FF',
    colorSoft: 'rgba(58,134,255,0.1)',
    colorBorder: 'rgba(58,134,255,0.2)',
    systemExtra: `Approccio metodico e professionale. Genera codice di produzione: strutturato, ben organizzato, con error handling completo. Privilegia stabilità e best practices. Il risultato deve sembrare un'app commerciale con UI curata, animazioni fluide e funzionalità complete. Genera SEMPRE tanto codice — ogni feature deve essere implementata, nessun placeholder.`
  },
  e2: {
    id: 'e2',
    name: 'F-2',
    desc: 'Accurato & instancabile',
    icon: '🔥',
    color: '#FF9F1C',
    colorSoft: 'rgba(255,159,28,0.1)',
    colorBorder: 'rgba(255,159,28,0.2)',
    systemExtra: `Approccio aggressivo e completo. Genera il MASSIMO codice possibile — aggiungi OGNI feature possibile, animazioni elaborate, micro-interazioni, effetti visivi, stati multipli. Gestisci ogni edge case, aggiungi features extra non richieste ma che migliorano drammaticamente l'app. Minimo 500 righe di codice, idealmente 800+.`
  },
  proto: {
    id: 'proto',
    name: 'Prototipo',
    desc: 'Agente sperimentale',
    icon: '⚗️',
    color: '#a855f7',
    colorSoft: 'rgba(168,85,247,0.1)',
    colorBorder: 'rgba(168,85,247,0.2)',
    systemExtra: `Approccio sperimentale e creativo. Usa design non convenzionali: layout asimmetrici, colori audaci, animazioni sorprendenti, interazioni innovative (drag & drop, gesture, parallax, 3D CSS). Sorprendi con scelte di design inaspettate ma funzionali.`
  },
  mobile: {
    id: 'mobile',
    name: 'Mobile',
    desc: 'Agente per app mobile',
    icon: '📱',
    color: '#10B981',
    colorSoft: 'rgba(16,185,129,0.1)',
    colorBorder: 'rgba(16,185,129,0.2)',
    systemExtra: `Ottimizzato per mobile-first. Touch targets grandi (min 44px), layout responsive perfetto su tutti gli schermi, niente hover-only interactions, font leggibili su schermi piccoli, performance ottimizzata. Bottom navigation, swipeable cards, gesture naturali. Safe areas per iPhone con notch. L'app deve sembrare una vera app nativa iOS/Android.`
  }
};

// Plan enforcement minimums per project type
const PLAN_MINIMUMS = {
  'static':       ['index.html', 'style.css', 'app.js'],
  'static-html':  ['index.html', 'style.css', 'app.js'],
  'html-game':    ['index.html'],  // single-file allowed
  'vite-react':   ['package.json', 'vite.config.js', 'index.html', 'src/main.jsx', 'src/App.jsx'],
  'nextjs':       ['package.json', 'app/layout.jsx', 'app/page.jsx', 'app/globals.css'],
  'node-express': ['package.json', 'server.js', 'public/index.html']
};

// Keywords that signal complex structure
const COMPLEX_KEYWORDS = /dashboard|sidebar|login|auth|register|crud|admin|kanban|drag.?drop|storage|database|api|router|navigation|tabs?|modal|chart|calendar|settings|profile|todo|chat|notifications?|search|filter/i;

// Iterative generation: 1 file at a time for full cross-file coherence
const MAX_BATCHES = 15;
const FILES_PER_BATCH = 1;

// Job pipeline
const JOB_MAX_FIX = 3;

// Project templates
const TEMPLATES = {
  blank: {},
  static: {
    'index.html': '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>My App</title>\n<link rel="stylesheet" href="style.css">\n</head>\n<body>\n<div id="app">\n  <h1>Hello World</h1>\n  <p>Edit this project with AI</p>\n</div>\n<script src="app.js"><\/script>\n</body>\n</html>',
    'style.css': '*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }\n\n:root {\n  --bg: #0a0a0a;\n  --text: #ffffff;\n  --accent: #FF9F1C;\n}\n\nbody {\n  font-family: system-ui, -apple-system, sans-serif;\n  background: var(--bg);\n  color: var(--text);\n  min-height: 100vh;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n\n#app {\n  text-align: center;\n  padding: 2rem;\n}\n\nh1 {\n  font-size: 2.5rem;\n  margin-bottom: 0.5rem;\n}\n\np {\n  color: rgba(255,255,255,0.5);\n}',
    'app.js': '// App logic\ndocument.addEventListener("DOMContentLoaded", () => {\n  console.log("App ready");\n});\n'
  },
  'vite-react': {
    'package.json': '{\n  "name": "forge-react-app",\n  "version": "1.0.0",\n  "private": true,\n  "type": "module",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build",\n    "preview": "vite preview"\n  },\n  "dependencies": {\n    "react": "^18.2.0",\n    "react-dom": "^18.2.0"\n  },\n  "devDependencies": {\n    "@vitejs/plugin-react": "^4.0.0",\n    "vite": "^5.0.0"\n  }\n}',
    'vite.config.js': 'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()]\n});\n',
    'index.html': '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n<title>React App</title>\n</head>\n<body>\n<div id="root"></div>\n<script type="module" src="/src/main.jsx"><\/script>\n</body>\n</html>',
    'src/main.jsx': 'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App.jsx";\n\nReactDOM.createRoot(document.getElementById("root")).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n',
    'src/App.jsx': 'import { useState } from "react";\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div style={{ textAlign: "center", padding: "2rem", fontFamily: "system-ui" }}>\n      <h1>Forge React App</h1>\n      <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: "1rem" }}>Edit with AI</p>\n      <button\n        onClick={() => setCount(c => c + 1)}\n        style={{\n          padding: "0.75rem 1.5rem",\n          fontSize: "1rem",\n          borderRadius: "8px",\n          border: "none",\n          background: "#FF9F1C",\n          color: "#000",\n          fontWeight: 700,\n          cursor: "pointer"\n        }}\n      >\n        Count: {count}\n      </button>\n    </div>\n  );\n}\n'
  },
  express: {
    'package.json': '{\n  "name": "forge-express-app",\n  "version": "1.0.0",\n  "main": "server.js",\n  "scripts": {\n    "start": "node server.js",\n    "dev": "node server.js"\n  },\n  "dependencies": {\n    "express": "^4.18.0",\n    "cors": "^2.8.5"\n  }\n}',
    'server.js': 'const express = require("express");\nconst cors = require("cors");\nconst app = express();\n\napp.use(cors());\napp.use(express.json());\napp.use(express.static("public"));\n\n// In-memory data\nlet items = [\n  { id: 1, name: "Item 1", done: false },\n  { id: 2, name: "Item 2", done: false },\n  { id: 3, name: "Item 3", done: true }\n];\nlet nextId = 4;\n\n// GET all items\napp.get("/api/items", (req, res) => {\n  res.json(items);\n});\n\n// POST new item\napp.post("/api/items", (req, res) => {\n  const { name } = req.body;\n  if (!name) return res.status(400).json({ error: "name required" });\n  const item = { id: nextId++, name, done: false };\n  items.push(item);\n  res.status(201).json(item);\n});\n\n// DELETE item\napp.delete("/api/items/:id", (req, res) => {\n  const id = parseInt(req.params.id);\n  const before = items.length;\n  items = items.filter(i => i.id !== id);\n  if (items.length === before) return res.status(404).json({ error: "not found" });\n  res.json({ ok: true });\n});\n\n// PATCH toggle done\napp.patch("/api/items/:id", (req, res) => {\n  const item = items.find(i => i.id === parseInt(req.params.id));\n  if (!item) return res.status(404).json({ error: "not found" });\n  item.done = !item.done;\n  if (req.body.name) item.name = req.body.name;\n  res.json(item);\n});\n\nconst PORT = process.env.PORT || 5000;\napp.listen(PORT, () => console.log("Server running on port " + PORT));\n',
    'public/index.html': '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Express App</title>\n<style>\n  * { margin:0; padding:0; box-sizing:border-box; }\n  body { font-family:system-ui; background:#0a0a0a; color:#fff; padding:2rem; max-width:600px; margin:0 auto; }\n  h1 { margin-bottom:1rem; }\n  .item { display:flex; align-items:center; gap:10px; padding:10px; border:1px solid rgba(255,255,255,0.1); border-radius:8px; margin-bottom:6px; }\n  .item.done span { text-decoration:line-through; opacity:0.4; }\n  .item span { flex:1; }\n  button { padding:6px 12px; border:none; border-radius:6px; cursor:pointer; font-weight:600; }\n  .toggle-btn { background:#FF9F1C; color:#000; }\n  .del-btn { background:rgba(239,68,68,0.2); color:#EF4444; }\n  .add-form { display:flex; gap:8px; margin-bottom:1rem; }\n  .add-form input { flex:1; padding:8px 12px; border:1px solid rgba(255,255,255,0.1); border-radius:8px; background:rgba(255,255,255,0.05); color:#fff; outline:none; }\n  .add-form button { background:#10B981; color:#fff; padding:8px 16px; }\n</style>\n</head>\n<body>\n<h1>Express API</h1>\n<div class="add-form">\n  <input id="inp" placeholder="New item...">\n  <button onclick="addItem()">Add</button>\n</div>\n<div id="items"></div>\n<script>\n  const API = "";\n  async function load() {\n    const res = await fetch(API + "/api/items");\n    const items = await res.json();\n    document.getElementById("items").innerHTML = items.map(i =>\n      \'<div class="item \' + (i.done?"done":"") + \'">\' +\n        \'<span>\' + i.name + \'</span>\' +\n        \'<button class="toggle-btn" onclick="toggle(\' + i.id + \')">\' + (i.done?"Undo":"Done") + \'</button>\' +\n        \'<button class="del-btn" onclick="del(\' + i.id + \')">Del</button>\' +\n      \'</div>\'\n    ).join("");\n  }\n  async function addItem() {\n    const inp = document.getElementById("inp");\n    if (!inp.value.trim()) return;\n    await fetch(API + "/api/items", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name:inp.value.trim()}) });\n    inp.value = "";\n    load();\n  }\n  async function toggle(id) { await fetch(API + "/api/items/" + id, { method:"PATCH" }); load(); }\n  async function del(id) { await fetch(API + "/api/items/" + id, { method:"DELETE" }); load(); }\n  load();\n<\/script>\n</body>\n</html>'
  }
};
