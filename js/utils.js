// ══════════════════════════════════
// UTILS — Funzioni utility pure
// ══════════════════════════════════

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function toast(msg,type=''){const el=document.getElementById('toast');el.textContent=msg;el.className=`toast show ${type}`;clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),3200);}

// Simple hash for deps change detection
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ══════════════════════════════════
// MODALS
// ══════════════════════════════════
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function bgClose(e,id){if(e.target.id===id)closeModal(id);}

// ══════════════════════════════════
// PROGRESS
// ══════════════════════════════════
function startProg(){document.getElementById('ptrack').classList.add('go');}
function stopProg(){const t=document.getElementById('ptrack'),f=document.getElementById('pfill');t.classList.remove('go');f.style.width='100%';setTimeout(()=>{f.style.transition='none';f.style.width='0%';setTimeout(()=>f.style.transition='',50);},400);}

// ══════════════════════════════════
// FILE HELPERS
// ══════════════════════════════════
function fname(m){return{html:'index.html',react:'App.jsx',python:'main.py',js:'script.js',css:'styles.css',sql:'query.sql',bash:'run.sh',fullstack:'index.html'}[m]||'output.txt';}
function ficon(n){if(n.endsWith('.html'))return'🌐';if(n.endsWith('.jsx')||n.endsWith('.js'))return'📜';if(n.endsWith('.py'))return'🐍';if(n.endsWith('.css'))return'🎨';if(n.endsWith('.sql'))return'🗃️';if(n.endsWith('.sh'))return'🖥️';return'📄';}
function flang(n){if(n.endsWith('.html'))return'HTML';if(n.endsWith('.jsx'))return'JSX';if(n.endsWith('.js'))return'JS';if(n.endsWith('.py'))return'Python';if(n.endsWith('.css'))return'CSS';if(n.endsWith('.sql'))return'SQL';if(n.endsWith('.sh'))return'Bash';return'TEXT';}

// ══════════════════════════════════
// RESPONSE PARSER
// ══════════════════════════════════
function parseAIResponse(raw, mode) {
  // Strip markdown fences if present
  let cleaned = raw.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();

  // Try JSON parse
  try {
    const obj = JSON.parse(cleaned);
    if (obj.filesChanged && Array.isArray(obj.filesChanged)) {
      return { type: 'json', data: obj };
    }
  } catch(e) {}

  // Try to find JSON inside the response (LLM sometimes adds text around it)
  const jsonMatch = cleaned.match(/\{[\s\S]*"filesChanged"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      if (obj.filesChanged && Array.isArray(obj.filesChanged)) {
        return { type: 'json', data: obj };
      }
    } catch(e) {}
  }

  // Fallback: treat as raw code (backward compat)
  return { type: 'raw', data: cleaned };
}
