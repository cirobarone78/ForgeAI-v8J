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

async function capture({ url, waitMs, width, height }) {
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width, height } });
  const consoleErrors = [];
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning') {
      consoleErrors.push(`[${m.type()}] ${m.text()}`.slice(0, 300));
    }
  });
  page.on('pageerror', err => consoleErrors.push('[pageerror] ' + String(err).slice(0, 300)));
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 }).catch(async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    });
    await page.waitForTimeout(Math.min(waitMs, 8000));
    const buf = await page.screenshot({ type: 'jpeg', quality: 70 });
    return { data: buf.toString('base64'), consoleErrors };
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
    ],
  });
}
