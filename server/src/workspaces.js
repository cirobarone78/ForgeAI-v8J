// Gestione workspace progetti: ogni progetto vive in server/workspaces/<id>/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, '..', 'workspaces');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.cache', '.claude']);
const TEXT_EXT = /\.(html?|css|js|mjs|cjs|jsx|tsx?|json|md|txt|svg|xml|yml|yaml|py|toml|env|gitignore|sh)$/i;
const MAX_FILE_BYTES = 300 * 1024;
const MAX_TOTAL_FILES = 200;

function ensureRoot() {
  fs.mkdirSync(ROOT, { recursive: true });
}

function safeId(id) {
  if (typeof id !== 'string' || !/^[a-z0-9-]{4,64}$/.test(id)) return null;
  return id;
}

export function dirOf(id) {
  const clean = safeId(id);
  if (!clean) return null;
  const dir = path.join(ROOT, clean);
  return fs.existsSync(dir) ? dir : null;
}

// La preview serve dist/ o build/ se contengono un index.html, altrimenti la root.
export function previewDir(id) {
  const dir = dirOf(id);
  if (!dir) return null;
  for (const sub of ['dist', 'build']) {
    const cand = path.join(dir, sub);
    if (fs.existsSync(path.join(cand, 'index.html'))) return cand;
  }
  return dir;
}

export function create(name, files) {
  ensureRoot();
  const id = 'p' + crypto.randomBytes(6).toString('hex');
  const dir = path.join(ROOT, id);
  fs.mkdirSync(dir, { recursive: true });
  writeMeta(id, { name: String(name || 'app').slice(0, 80), createdAt: new Date().toISOString() });
  if (files && typeof files === 'object') writeFiles(id, files);
  return id;
}

function metaPath(id) {
  return path.join(ROOT, safeId(id), '.forge-meta.json');
}

export function readMeta(id) {
  try {
    return JSON.parse(fs.readFileSync(metaPath(id), 'utf8'));
  } catch {
    return {};
  }
}

export function writeMeta(id, patch) {
  const meta = { ...readMeta(id), ...patch };
  fs.writeFileSync(metaPath(id), JSON.stringify(meta, null, 2));
  return meta;
}

// Scrive file nel workspace, bloccando path traversal.
export function writeFiles(id, files) {
  const dir = dirOf(id);
  if (!dir) throw new Error('progetto inesistente');
  let written = 0;
  for (const [rel, content] of Object.entries(files)) {
    if (typeof content !== 'string') continue;
    const target = path.resolve(dir, rel);
    if (!target.startsWith(dir + path.sep)) continue; // traversal
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
    written++;
  }
  return written;
}

// Legge i file testuali del workspace (per la file tree del frontend).
export function readFiles(id) {
  const dir = dirOf(id);
  if (!dir) return null;
  const files = {};
  let count = 0;
  const walk = (d, prefix) => {
    if (count >= MAX_TOTAL_FILES) return;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (count >= MAX_TOTAL_FILES) return;
      if (e.name.startsWith('.') || e.name === '.forge-meta.json') {
        if (e.name !== '.gitignore' && e.name !== '.env.example') continue;
      }
      const rel = prefix ? prefix + '/' + e.name : e.name;
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(path.join(d, e.name), rel);
      } else if (e.isFile()) {
        if (e.name === 'package-lock.json' || e.name.endsWith('.lock')) continue;
        if (!TEXT_EXT.test(e.name)) continue;
        try {
          const st = fs.statSync(path.join(d, e.name));
          if (st.size > MAX_FILE_BYTES) continue;
          files[rel] = fs.readFileSync(path.join(d, e.name), 'utf8');
          count++;
        } catch { /* skip */ }
      }
    }
  };
  walk(dir, '');
  return files;
}

export function hasIndexHtml(id) {
  const dir = previewDir(id);
  return !!dir && fs.existsSync(path.join(dir, 'index.html'));
}
