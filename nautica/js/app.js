// ══ STATE ══
const S = {
  screen: 'home',
  quizMode: null,       // 'esame' | 'argomento' | 'errori'
  quizTopic: null,      // topic id or null = all
  currentQuiz: null,    // active quiz session
  stats: null,
};

// ══ STORAGE ══
function loadStats() {
  try {
    S.stats = JSON.parse(localStorage.getItem('pn_stats') || 'null') || {
      exams: [],                // [{date, score, total, passed, answers:[{id,chosen,correct}]}]
      wrongIds: {},             // {questionId: count}
      categoryStats: {},        // {catLabel: {correct, total}}
    };
  } catch { S.stats = { exams: [], wrongIds: {}, categoryStats: {} }; }
}
function saveStats() {
  localStorage.setItem('pn_stats', JSON.stringify(S.stats));
}

// ══ NAVIGATION ══
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('screen-' + id);
  if (el) el.classList.add('active');
  const nav = document.querySelector(`.nav-btn[data-screen="${id}"]`);
  if (nav) nav.classList.add('active');
  S.screen = id;
  if (id === 'home') renderHome();
  if (id === 'teoria') renderTeoria();
  if (id === 'quiz') renderQuiz();
  if (id === 'progressi') renderProgressi();
}

// ══ HOME ══
function renderHome() {
  const stats = S.stats;
  const totalExams = stats.exams.length;
  const passed = stats.exams.filter(e => e.passed).length;
  const avgScore = totalExams > 0
    ? Math.round(stats.exams.reduce((a, e) => a + (e.score / e.total * 100), 0) / totalExams)
    : 0;
  const totalQ = Object.values(stats.categoryStats).reduce((a, v) => a + v.total, 0);

  document.getElementById('stat-esami').textContent = totalExams;
  document.getElementById('stat-passed').textContent = passed;
  document.getElementById('stat-avg').textContent = totalExams > 0 ? avgScore + '%' : '—';
  document.getElementById('stat-domande').textContent = totalQ;
}

// ══ TEORIA ══
function renderTeoria() {
  const list = document.getElementById('topic-list');
  list.innerHTML = THEORY.map(topic => {
    const cs = S.stats.categoryStats[topic.title] || { correct: 0, total: 0 };
    const pct = cs.total > 0 ? Math.round(cs.correct / cs.total * 100) : 0;
    const qCount = QUESTIONS.filter(q => q.id >= topic.qRange[0] && q.id <= topic.qRange[1]).length;
    return `
    <div class="topic-card" onclick="openTopic('${topic.id}')">
      <div class="topic-icon" style="background:${topic.color}22;color:${topic.color}">${topic.icon}</div>
      <div class="topic-info">
        <div class="topic-name">${topic.title}</div>
        <div class="topic-meta">${qCount} domande</div>
        ${cs.total > 0 ? `
        <div class="topic-progress" style="margin-top:6px">
          <div class="topic-pbar">
            <div class="topic-pfill" style="width:${pct}%;background:${topic.color}"></div>
          </div>
          <span class="topic-pct">${pct}%</span>
        </div>` : ''}
      </div>
      <span class="topic-chevron">›</span>
    </div>`;
  }).join('');
}

function openTopic(id) {
  const topic = THEORY.find(t => t.id === id);
  if (!topic) return;
  const screen = document.getElementById('screen-teoria-detail');
  screen.dataset.topicId = id;
  document.getElementById('teoria-detail-title').textContent = topic.title;
  document.getElementById('teoria-detail-icon').textContent = topic.icon;

  const accordion = document.getElementById('accordion-body');
  accordion.innerHTML = topic.sections.map((sec, i) => `
    <div class="accordion-item ${i === 0 ? 'open' : ''}">
      <div class="accordion-header" onclick="toggleAccordion(this.parentElement)">
        <span>${sec.title}</span>
        <span class="accordion-arrow">⌄</span>
      </div>
      <div class="accordion-body">${sec.content}</div>
    </div>
  `).join('');

  // Quiz this topic button
  document.getElementById('quiz-topic-btn').onclick = () => {
    startQuiz('argomento', id);
  };

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
  screen.scrollTop = 0;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
}

function toggleAccordion(item) {
  item.classList.toggle('open');
}

function backToTeoria() {
  showScreen('teoria');
}

// ══ QUIZ MODE ══
function renderQuiz() {
  const chips = document.getElementById('topic-chips');
  chips.innerHTML = `<div class="chip active" data-topic="" onclick="selectTopicFilter(this, '')">Tutti</div>` +
    THEORY.map(t => `<div class="chip" data-topic="${t.id}" onclick="selectTopicFilter(this, '${t.id}')">${t.icon} ${t.title.split(' ')[0]}</div>`).join('');
}

function selectTopicFilter(el, topicId) {
  document.querySelectorAll('.topic-chips .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  S.quizTopic = topicId || null;
}

function startQuiz(mode, topicId) {
  S.quizMode = mode;
  S.quizTopic = topicId || S.quizTopic;

  let pool;
  if (mode === 'esame') {
    pool = buildExamPool();
  } else if (mode === 'argomento') {
    const topic = THEORY.find(t => t.id === S.quizTopic);
    if (topic) {
      pool = QUESTIONS.filter(q => q.id >= topic.qRange[0] && q.id <= topic.qRange[1]);
    } else {
      pool = [...QUESTIONS];
    }
    pool = shuffle(pool).slice(0, 20);
  } else if (mode === 'errori') {
    const wrongIds = Object.entries(S.stats.wrongIds)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([id]) => parseInt(id));
    if (wrongIds.length === 0) { toast('Nessun errore registrato ancora!'); return; }
    pool = QUESTIONS.filter(q => wrongIds.includes(q.id));
    pool = shuffle(pool).slice(0, 20);
  } else {
    pool = shuffle([...QUESTIONS]).slice(0, 20);
  }

  if (pool.length === 0) { toast('Nessuna domanda disponibile'); return; }

  S.currentQuiz = {
    mode,
    questions: pool,
    current: 0,
    answers: [],
    startTime: Date.now(),
    timerInterval: null,
    timeLimit: mode === 'esame' ? 30 * 60 : null, // 30 min for exam
    answered: false,
  };

  showExamScreen();
}

function buildExamPool() {
  const pool = [];
  for (const range of EXAM_CONFIG) {
    const candidates = QUESTIONS.filter(q => q.id >= range.from && q.id <= range.to);
    const picked = shuffle(candidates).slice(0, range.count);
    pool.push(...picked);
  }
  return shuffle(pool);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ══ EXAM SCREEN ══
function showExamScreen() {
  const screen = document.getElementById('screen-esame');
  screen.classList.add('active');
  renderQuestion();
  if (S.currentQuiz.timeLimit) startTimer();
}

function startTimer() {
  const quiz = S.currentQuiz;
  quiz.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - quiz.startTime) / 1000);
    const remaining = quiz.timeLimit - elapsed;
    if (remaining <= 0) {
      clearInterval(quiz.timerInterval);
      finishQuiz();
      return;
    }
    updateTimerDisplay(remaining);
  }, 1000);
}

function updateTimerDisplay(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const el = document.getElementById('exam-timer');
  el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  el.parentElement.className = 'exam-timer' + (seconds < 300 ? ' warning' : '') + (seconds < 60 ? ' danger' : '');
}

function renderQuestion() {
  const quiz = S.currentQuiz;
  const q = quiz.questions[quiz.current];
  const total = quiz.questions.length;
  const idx = quiz.current;

  // Header
  document.getElementById('exam-qnum').textContent = `${idx + 1} / ${total}`;
  document.getElementById('exam-progress').style.width = `${((idx) / total) * 100}%`;

  // Find topic
  const topic = THEORY.find(t => q.id >= t.qRange[0] && q.id <= t.qRange[1]);

  document.getElementById('q-topic-badge').innerHTML = topic
    ? `${topic.icon} ${topic.title}`
    : '📋 Domanda';

  document.getElementById('q-text').textContent = q.q;

  const answersEl = document.getElementById('answers-list');
  const letters = ['A', 'B', 'C'];
  answersEl.innerHTML = q.a.map((ans, i) => `
    <button class="answer-btn" onclick="selectAnswer(${i})" data-idx="${i}">
      <span class="answer-letter">${letters[i]}</span>
      <span>${ans}</span>
    </button>
  `).join('');

  // Reset feedback
  const fb = document.getElementById('feedback-box');
  fb.className = 'feedback-box';
  fb.textContent = '';
  document.getElementById('next-btn').className = 'next-btn';
  quiz.answered = false;
}

function selectAnswer(chosen) {
  const quiz = S.currentQuiz;
  if (quiz.answered) return;
  quiz.answered = true;

  const q = quiz.questions[quiz.current];
  const correct = q.c;
  const isRight = chosen === correct;

  quiz.answers.push({ id: q.id, chosen, correct, isRight });

  // Update wrong stats
  if (!isRight) {
    S.stats.wrongIds[q.id] = (S.stats.wrongIds[q.id] || 0) + 1;
  } else {
    // Reduce wrong count on correct answer
    if (S.stats.wrongIds[q.id] > 0) S.stats.wrongIds[q.id]--;
    if (S.stats.wrongIds[q.id] === 0) delete S.stats.wrongIds[q.id];
  }

  // Category stats
  const topic = THEORY.find(t => q.id >= t.qRange[0] && q.id <= t.qRange[1]);
  const catKey = topic ? topic.title : 'Altro';
  if (!S.stats.categoryStats[catKey]) S.stats.categoryStats[catKey] = { correct: 0, total: 0 };
  S.stats.categoryStats[catKey].total++;
  if (isRight) S.stats.categoryStats[catKey].correct++;

  // Style buttons
  const btns = document.querySelectorAll('.answer-btn');
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === correct) btn.classList.add('correct');
    else if (i === chosen && !isRight) btn.classList.add('wrong');
    else btn.classList.add('neutral');
  });

  // Feedback
  const fb = document.getElementById('feedback-box');
  if (isRight) {
    fb.className = 'feedback-box correct show';
    fb.textContent = '✓ Risposta corretta!';
  } else {
    fb.className = 'feedback-box wrong show';
    fb.textContent = `✗ Sbagliato. La risposta corretta era: ${['A','B','C'][correct]}. ${q.a[correct]}`;
  }

  // Next button
  const nextBtn = document.getElementById('next-btn');
  const isLast = quiz.current === quiz.questions.length - 1;
  nextBtn.className = 'next-btn show';
  nextBtn.textContent = isLast ? '📊 Vedi risultati' : 'Prossima domanda →';
  nextBtn.onclick = isLast ? finishQuiz : nextQuestion;

  saveStats();
}

function nextQuestion() {
  S.currentQuiz.current++;
  renderQuestion();
  document.getElementById('screen-esame').scrollTop = 0;
}

function stopQuiz() {
  if (!confirm('Vuoi interrompere il quiz?')) return;
  if (S.currentQuiz?.timerInterval) clearInterval(S.currentQuiz.timerInterval);
  S.currentQuiz = null;
  document.getElementById('screen-esame').classList.remove('active');
  showScreen('quiz');
}

function finishQuiz() {
  const quiz = S.currentQuiz;
  if (quiz.timerInterval) clearInterval(quiz.timerInterval);

  const total = quiz.questions.length;
  const correct = quiz.answers.filter(a => a.isRight).length;
  const pct = Math.round(correct / total * 100);
  const passed = pct >= 80;
  const elapsed = Math.floor((Date.now() - quiz.startTime) / 1000);

  // Save exam
  if (quiz.mode === 'esame') {
    S.stats.exams.unshift({
      date: new Date().toISOString(),
      score: correct,
      total,
      passed,
      pct,
      elapsed,
      answers: quiz.answers,
    });
    if (S.stats.exams.length > 50) S.stats.exams = S.stats.exams.slice(0, 50);
    saveStats();
  }

  renderResult(correct, total, pct, passed, elapsed, quiz);
}

function renderResult(correct, total, pct, passed, elapsed, quiz) {
  const screen = document.getElementById('screen-esame');
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;

  screen.innerHTML = `
    <div class="result-container">
      <div class="result-emoji">${passed ? '🏆' : '📚'}</div>
      <h1 class="result-title">${passed ? 'Superato!' : 'Riprova!'}</h1>
      <p class="result-subtitle">${passed ? 'Ottimo lavoro, hai superato la soglia minima.' : 'Devi rispondere correttamente ad almeno l\'80% delle domande.'}</p>

      <div class="result-score">${correct}/${total}</div>
      <div class="result-score-label">${pct}% di risposte corrette</div>

      <div class="result-badge ${passed ? 'passed' : 'failed'}">
        ${passed ? '✓ PROMOSSO' : '✗ NON SUFFICIENTE'} (minimo 80%)
      </div>

      <div class="result-breakdown">
        <div class="breakdown-row">
          <span>Risposte corrette</span>
          <span class="breakdown-val green">${correct}</span>
        </div>
        <div class="breakdown-row">
          <span>Risposte errate</span>
          <span class="breakdown-val red">${total - correct}</span>
        </div>
        <div class="breakdown-row">
          <span>Tempo impiegato</span>
          <span class="breakdown-val">${m}:${s.toString().padStart(2,'0')}</span>
        </div>
        <div class="breakdown-row">
          <span>Modalità</span>
          <span class="breakdown-val">${quiz.mode === 'esame' ? 'Simulazione esame' : quiz.mode === 'argomento' ? 'Per argomento' : 'Ripasso errori'}</span>
        </div>
      </div>

      <div style="margin-bottom:20px">
        <div class="section-title" style="padding:0 0 10px">Riepilogo domande</div>
        <div class="review-list" style="padding:0">
          ${quiz.questions.map((q, i) => {
            const ans = quiz.answers[i];
            if (!ans) return '';
            const letters = ['A','B','C'];
            const isRight = ans.isRight;
            return `
            <div class="review-item ${isRight ? 'right-item' : 'wrong-item'}">
              <div class="review-q">${i+1}. ${q.q}</div>
              <div class="review-answers">
                ${q.a.map((a, ai) => {
                  let cls = 'neutral-ans';
                  if (ai === q.c) cls = 'correct-ans';
                  else if (ai === ans.chosen && !isRight) cls = 'wrong-ans';
                  return `<div class="review-ans ${cls}">${letters[ai]}. ${a}</div>`;
                }).join('')}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="result-actions">
        <button class="btn-primary" onclick="startQuiz('${quiz.mode}', '${quiz.quizTopic || ''}')">🔄 Rifai il quiz</button>
        <button class="btn-primary" onclick="startQuiz('esame', null)" style="background:var(--surface2);color:var(--text);border:1px solid var(--border)">📋 Nuova simulazione</button>
        <button class="btn-secondary" onclick="closeResult()">← Torna al menu</button>
      </div>
    </div>
  `;
  screen.scrollTop = 0;
}

function closeResult() {
  S.currentQuiz = null;
  document.getElementById('screen-esame').classList.remove('active');
  document.getElementById('screen-esame').innerHTML = buildExamHTML();
  showScreen('home');
}

// ══ PROGRESSI ══
function renderProgressi() {
  const stats = S.stats;
  const totalExams = stats.exams.length;
  const passed = stats.exams.filter(e => e.passed).length;
  const avgPct = totalExams > 0
    ? Math.round(stats.exams.reduce((a, e) => a + e.pct, 0) / totalExams)
    : 0;

  // Circle
  const circle = document.getElementById('progress-circle');
  circle.style.setProperty('--pct', avgPct);
  document.getElementById('circle-pct').textContent = avgPct + '%';

  // Summary stats
  document.getElementById('prog-total').textContent = totalExams;
  document.getElementById('prog-passed').textContent = passed;
  document.getElementById('prog-failed').textContent = totalExams - passed;

  // History
  const history = document.getElementById('history-list');
  if (!totalExams) {
    history.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">Nessun esame ancora</div><div class="empty-sub">Fai la tua prima simulazione!</div></div>`;
  } else {
    history.innerHTML = stats.exams.slice(0, 15).map(e => {
      const date = new Date(e.date);
      const dateStr = date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' });
      const timeStr = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      return `
      <div class="history-item">
        <div class="history-dot" style="background:${e.passed ? 'var(--success)' : 'var(--error)'}"></div>
        <div class="history-info">
          <div class="history-score">${e.score}/${e.total} — ${e.pct}%</div>
          <div class="history-date">${dateStr} alle ${timeStr}</div>
        </div>
        <div class="history-badge" style="background:${e.passed ? 'var(--success-soft)' : 'var(--error-soft)'};color:${e.passed ? 'var(--success)' : 'var(--error)'}">
          ${e.passed ? 'Superato' : 'Non sup.'}
        </div>
      </div>`;
    }).join('');
  }

  // Category breakdown
  const catList = document.getElementById('cat-progress-list');
  const cats = THEORY.map(t => {
    const cs = stats.categoryStats[t.title] || { correct: 0, total: 0 };
    const pct = cs.total > 0 ? Math.round(cs.correct / cs.total * 100) : 0;
    return { name: t.title, icon: t.icon, color: t.color, pct, total: cs.total };
  }).filter(c => c.total > 0);

  if (!cats.length) {
    catList.innerHTML = `<div class="empty-state" style="padding:24px 20px"><div class="empty-text">Nessun dato ancora</div><div class="empty-sub">Rispondi ad alcune domande per vedere le statistiche per argomento</div></div>`;
  } else {
    catList.innerHTML = cats.map(c => `
    <div class="cat-row">
      <div class="cat-row-header">
        <span class="cat-name">${c.icon} ${c.name}</span>
        <span class="cat-pct">${c.pct}% (${c.total} dom.)</span>
      </div>
      <div class="cat-bar">
        <div class="cat-fill" style="width:${c.pct}%;background:${c.color}"></div>
      </div>
    </div>`).join('');
  }
}

function resetStats() {
  if (!confirm('Sei sicuro di voler azzerare tutte le statistiche?')) return;
  S.stats = { exams: [], wrongIds: {}, categoryStats: {} };
  saveStats();
  renderProgressi();
  toast('Statistiche azzerate');
}

// ══ UTILS ══
let toastTimeout;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), 2500);
}

// ══ EXAM HTML TEMPLATE ══
function buildExamHTML() {
  return `
    <div class="exam-header">
      <button class="exam-stop-btn" onclick="stopQuiz()">✕ Esci</button>
      <div class="exam-info">
        <span class="exam-progress-text">Domanda</span>
        <span class="exam-qnum" id="exam-qnum">1 / 20</span>
      </div>
      <div class="exam-timer" id="exam-timer-wrap">
        <span>⏱</span>
        <span id="exam-timer">30:00</span>
      </div>
    </div>
    <div class="progress-bar"><div class="progress-fill" id="exam-progress"></div></div>
    <div class="question-container">
      <div class="question-topic-badge" id="q-topic-badge"></div>
      <div class="question-text" id="q-text"></div>
    </div>
    <div class="answers-list" id="answers-list"></div>
    <div class="feedback-box" id="feedback-box"></div>
    <button class="next-btn" id="next-btn"></button>
  `;
}

// ══ INIT ══
document.addEventListener('DOMContentLoaded', () => {
  loadStats();

  // Build exam screen
  document.getElementById('screen-esame').innerHTML = buildExamHTML();

  // Nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.screen));
  });

  showScreen('home');
});
