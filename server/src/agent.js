// Esecuzione dell'agente builder tramite Claude Agent SDK.
// L'agente ha filesystem e shell veri (cwd = workspace del progetto),
// più il tool MCP forge/screenshot per il feedback visivo.
import { query } from '@anthropic-ai/claude-agent-sdk';
import { makeForgeMcpServer } from './screenshot.js';
import { BUILDER_PROMPT, buildRunPrompt } from './prompts.js';

const DEFAULT_MODEL = process.env.FORGE_MODEL || 'claude-sonnet-5';

// Stream di input: permette di iniettare messaggi dell'utente MENTRE l'agente lavora
// (la feature "interactive chat" della UI, ma vera).
export function createUserStream(initialText) {
  const queue = [];
  let notify = null;
  let ended = false;

  const toMsg = (text) => ({
    type: 'user',
    message: { role: 'user', content: [{ type: 'text', text }] },
    parent_tool_use_id: null,
  });

  return {
    push(text) {
      if (ended) return;
      queue.push(text);
      notify?.();
    },
    end() {
      ended = true;
      notify?.();
    },
    get pending() {
      return queue.length;
    },
    async *[Symbol.asyncIterator]() {
      yield toMsg(initialText);
      while (true) {
        if (queue.length) { yield toMsg(queue.shift()); continue; }
        if (ended) return;
        await new Promise(r => { notify = r; });
        notify = null;
      }
    },
  };
}

function toolDetail(name, input = {}) {
  switch (name) {
    case 'Bash': return (input.command || '').slice(0, 160);
    case 'Write': return input.file_path || '';
    case 'Edit': case 'MultiEdit': return input.file_path || '';
    case 'Read': return input.file_path || '';
    case 'Glob': return input.pattern || '';
    case 'Grep': return input.pattern || '';
    case 'TodoWrite': return (input.todos || []).map(t => t.content).slice(0, 3).join(' · ');
    case 'mcp__forge__screenshot': return input.url || '';
    case 'mcp__forge__playtest': return (input.actions || []).map(a => a.do === 'key' ? (a.key + (a.times > 1 ? '×' + a.times : '')) : a.do).join(' → ').slice(0, 120);
    default: return JSON.stringify(input).slice(0, 120);
  }
}

/**
 * Esegue un run dell'agente nel workspace.
 * onEvent riceve eventi: status | agent_text | tool | result-interni.
 * Ritorna { ok, sessionId, resultText, costUsd, turns }.
 */
export async function runAgent({ dir, userText, previewUrl, isEdit, apiKey, model, resumeSessionId, stream, abortController, onEvent, planMode }) {
  const env = { ...process.env };
  if (apiKey) env.ANTHROPIC_API_KEY = apiKey;

  const input = stream; // createUserStream già inizializzato con il prompt del run
  let sessionId = resumeSessionId || null;
  let resultText = '';
  let costUsd = 0;
  let turns = 0;
  let ok = false;

  const q = query({
    prompt: input,
    options: {
      cwd: dir,
      model: model || DEFAULT_MODEL,
      systemPrompt: { type: 'preset', preset: 'claude_code', append: BUILDER_PROMPT },
      // Approvazione programmatica: consente tutti i tool senza --dangerously-skip-permissions
      // (che è vietato come root, es. dentro container).
      permissionMode: 'acceptEdits',
      canUseTool: async (toolName, input) => ({ behavior: 'allow', updatedInput: input }),
      // In modalità piano l'agente può solo leggere: niente scrittura, shell o preview.
      allowedTools: planMode
        ? ['Read', 'Glob', 'Grep']
        : ['Bash', 'Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep', 'TodoWrite', 'WebFetch', 'mcp__forge__screenshot', 'mcp__forge__playtest'],
      mcpServers: { forge: makeForgeMcpServer() },
      maxTurns: planMode ? 8 : 120,
      settingSources: [],
      env,
      abortController,
      ...(resumeSessionId ? { resume: resumeSessionId } : {}),
      stderr: (line) => { if (process.env.FORGE_DEBUG) console.error('[agent]', line); },
    },
  });

  try {
    for await (const msg of q) {
      if (msg.type === 'system' && msg.subtype === 'init') {
        sessionId = msg.session_id || sessionId;
        onEvent({ type: 'status', text: 'Agente avviato · modello ' + (msg.model || model || DEFAULT_MODEL) });
      } else if (msg.type === 'assistant') {
        for (const block of msg.message?.content || []) {
          if (block.type === 'text' && block.text?.trim()) {
            onEvent({ type: 'agent_text', text: block.text });
          } else if (block.type === 'tool_use') {
            onEvent({ type: 'tool', name: block.name, detail: toolDetail(block.name, block.input) });
          }
        }
      } else if (msg.type === 'result') {
        turns = msg.num_turns ?? turns;
        costUsd = msg.total_cost_usd ?? costUsd;
        ok = msg.subtype === 'success';
        if (msg.subtype === 'success' && msg.result) resultText = msg.result;
        if (!ok && msg.subtype !== 'success') {
          onEvent({ type: 'status', text: 'Run terminato: ' + msg.subtype });
        }
        // Se non ci sono messaggi utente in coda, chiudiamo lo stream di input:
        // il run è completo. Altrimenti l'agente continua col prossimo messaggio.
        if (input.pending === 0) input.end();
      }
    }
  } catch (err) {
    if (abortController?.signal?.aborted) {
      onEvent({ type: 'status', text: 'Run interrotto dall\'utente.' });
      return { ok: false, aborted: true, sessionId, resultText, costUsd, turns };
    }
    throw err;
  }

  return { ok, sessionId, resultText, costUsd, turns };
}

export { buildRunPrompt };
