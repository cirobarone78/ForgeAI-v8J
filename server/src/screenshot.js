// Tool MCP "screenshot": rende una URL in Chromium headless (Playwright),
// restituisce lo screenshot come immagine + gli errori console della pagina.
// Se Playwright non è installato il tool degrada con un messaggio chiaro.
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import('playwright');
      const executablePath = process.env.FORGE_CHROMIUM_PATH || undefined;
      return chromium.launch({ headless: true, executablePath });
    })().catch(err => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) {
    try { (await browserPromise).close(); } catch { /* ignore */ }
    browserPromise = null;
  }
}

async function openPage(url, width, height) {
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width, height } });
  const consoleErrors = [];
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning') {
      consoleErrors.push(`[${m.type()}] ${m.text()}`.slice(0, 300));
    }
  });
  page.on('pageerror', err => consoleErrors.push('[pageerror] ' + String(err).slice(0, 300)));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 }).catch(async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  });
  return { page, consoleErrors };
}

async function capture({ url, waitMs, width, height }) {
  const { page, consoleErrors } = await openPage(url, width, height);
  try {
    await page.waitForTimeout(Math.min(waitMs, 8000));
    const buf = await page.screenshot({ type: 'jpeg', quality: 70 });
    return { data: buf.toString('base64'), consoleErrors };
  } finally {
    await page.close().catch(() => {});
  }
}

// Esegue una sessione di gioco reale: azioni sequenziali + screenshot prima/dopo.
export async function runPlaytest({ url, actions, width, height, settleMs, finalWaitMs }) {
  const { page, consoleErrors } = await openPage(url, width, height);
  const report = [];
  try {
    await page.waitForTimeout(Math.min(settleMs ?? 1000, 8000));
    const before = (await page.screenshot({ type: 'jpeg', quality: 60 })).toString('base64');

    for (const a of (actions || []).slice(0, 40)) {
      try {
        if (a.do === 'wait') {
          const ms = Math.min(a.ms ?? 500, 8000);
          await page.waitForTimeout(ms);
          report.push(`✓ wait ${ms}ms`);
        } else if (a.do === 'key') {
          const times = Math.min(Math.max(a.times ?? 1, 1), 60);
          const gap = Math.min(a.ms ?? 80, 1000);
          for (let i = 0; i < times; i++) {
            await page.keyboard.press(a.key || 'Space');
            await page.waitForTimeout(gap);
          }
          report.push(`✓ key ${a.key || 'Space'} ×${times}`);
        } else if (a.do === 'click') {
          if (a.selector) {
            await page.click(a.selector, { timeout: 3000 });
            report.push(`✓ click ${a.selector}`);
          } else {
            const x = a.x ?? Math.floor((width || 1280) / 2);
            const y = a.y ?? Math.floor((height || 800) / 2);
            await page.mouse.click(x, y);
            report.push(`✓ click (${x},${y})`);
          }
        } else if (a.do === 'text') {
          const t = await page.textContent(a.selector, { timeout: 3000 });
          report.push(`✓ text ${a.selector} = "${(t || '').trim().replace(/\s+/g, ' ').slice(0, 80)}"`);
        } else {
          report.push(`✗ azione sconosciuta: ${a.do}`);
        }
      } catch (e) {
        const msg = String(e.message || e).split('\n')[0].slice(0, 100);
        report.push(`✗ ${a.do} ${a.selector || a.key || ''}: ${msg}`);
      }
    }

    await page.waitForTimeout(Math.min(finalWaitMs ?? 800, 8000));
    const after = (await page.screenshot({ type: 'jpeg', quality: 60 })).toString('base64');
    return { before, after, report, consoleErrors };
  } finally {
    await page.close().catch(() => {});
  }
}

export function makeForgeMcpServer() {
  return createSdkMcpServer({
    name: 'forge',
    version: '1.0.0',
    tools: [
      tool(
        'screenshot',
        'Renderizza una URL in un browser headless e restituisce screenshot (1280x800) + errori console della pagina. Usalo sulla PREVIEW_URL per verificare visivamente il risultato, o su un dev server che hai avviato.',
        {
          url: z.string().describe('URL da catturare, es. la PREVIEW_URL del progetto'),
          waitMs: z.number().optional().describe('Attesa extra in ms dopo il load (default 1200, max 8000) — utile per animazioni/giochi'),
          width: z.number().optional().describe('Larghezza viewport (default 1280; usa 390 per verificare il mobile)'),
        },
        async (args) => {
          try {
            const { data, consoleErrors } = await capture({
              url: args.url,
              waitMs: args.waitMs ?? 1200,
              width: args.width ?? 1280,
              height: args.width && args.width < 600 ? 844 : 800,
            });
            const errText = consoleErrors.length
              ? 'ERRORI CONSOLE (' + consoleErrors.length + '):\n' + consoleErrors.slice(0, 15).join('\n')
              : 'Nessun errore console.';
            return {
              content: [
                { type: 'image', data, mimeType: 'image/jpeg' },
                { type: 'text', text: errText },
              ],
            };
          } catch (err) {
            return {
              content: [{
                type: 'text',
                text: 'Screenshot non disponibile (' + String(err.message || err).slice(0, 200) +
                  '). Playwright potrebbe non essere installato: procedi verificando il codice con node --check e la build, e cura il CSS con particolare attenzione.',
              }],
            };
          }
        }
      ),
      tool(
        'playtest',
        'GIOCA davvero alla pagina: esegue una sequenza di azioni (tasti, click, letture di testo) e restituisce screenshot PRIMA e DOPO + report azioni + errori console. Usalo per verificare che i controlli rispondano, che l\'HUD si aggiorni e che il gameplay funzioni. Esempi di azioni: {"do":"click","selector":"#play-btn"}, {"do":"key","key":"ArrowRight","times":8}, {"do":"wait","ms":1500}, {"do":"text","selector":"#score"}.',
        {
          url: z.string().describe('URL da testare (di solito la PREVIEW_URL)'),
          actions: z.array(z.object({
            do: z.enum(['key', 'click', 'wait', 'text']).describe('key=premi tasto, click=clicca (selector oppure x/y), wait=attendi, text=leggi il testo di un elemento (es. lo score)'),
            key: z.string().optional().describe('Per do=key: nome tasto Playwright (ArrowRight, Space, Enter, a, …)'),
            times: z.number().optional().describe('Per do=key: ripetizioni (default 1, max 60)'),
            ms: z.number().optional().describe('Per do=wait: durata; per do=key: pausa tra ripetizioni (default 80)'),
            selector: z.string().optional().describe('Per do=click/text: selettore CSS'),
            x: z.number().optional().describe('Per do=click senza selector: coordinata X'),
            y: z.number().optional().describe('Per do=click senza selector: coordinata Y'),
          })).describe('Sequenza di azioni da eseguire in ordine (max 40)'),
          width: z.number().optional().describe('Larghezza viewport (default 1280; usa 390 per testare il mobile)'),
          settleMs: z.number().optional().describe('Attesa dopo il load prima dello screenshot iniziale (default 1000)'),
          finalWaitMs: z.number().optional().describe('Attesa prima dello screenshot finale (default 800)'),
        },
        async (args) => {
          try {
            const width = args.width ?? 1280;
            const { before, after, report, consoleErrors } = await runPlaytest({
              ...args,
              width,
              height: width < 600 ? 844 : 800,
            });
            const errText = consoleErrors.length
              ? 'ERRORI CONSOLE (' + consoleErrors.length + '):\n' + consoleErrors.slice(0, 15).join('\n')
              : 'Nessun errore console.';
            return {
              content: [
                { type: 'text', text: 'SCREENSHOT PRIMA delle azioni:' },
                { type: 'image', data: before, mimeType: 'image/jpeg' },
                { type: 'text', text: 'SCREENSHOT DOPO le azioni:' },
                { type: 'image', data: after, mimeType: 'image/jpeg' },
                { type: 'text', text: 'REPORT AZIONI:\n' + report.join('\n') + '\n\n' + errText + '\n\nConfronta i due screenshot: se sono identici dopo input di movimento, i controlli probabilmente NON funzionano.' },
              ],
            };
          } catch (err) {
            return {
              content: [{
                type: 'text',
                text: 'Playtest non disponibile (' + String(err.message || err).slice(0, 200) + '). Verifica il codice staticamente con node --check.',
              }],
            };
          }
        }
      ),
    ],
  });
}
