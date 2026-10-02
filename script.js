// Feature Pack 10: Learning Suite expansion (spaced review, daily challenge, listening controls, mastery analytics).
// Feature Pack 06: merged from Feature Pack 03 (light UI + global search/chapter labels), Feature Pack 04 (quiz feedback), and Feature Pack 05 (learning suite/audio).
// Feature Pack 03 — auto-next, global search, chapter labels, lightweight UI
let chapters = [];
let vocab = [];
const app = document.getElementById('app');
const toast = document.getElementById('toast');
const infoModal = document.getElementById('infoModal');
const quizFeedbackModal = document.getElementById('quizFeedbackModal');

const state = {
  view: 'home', chapter: null, search: '', cat: 'Semua', status: 'Semua',
  flashIndex: 0, flashShow: false, flashPool: null,
  quiz: null, review: null, source: 'Semua'
};

const STORE = 'epsTopikProgress';
const SETTINGS = 'epsTopikSettings';
const CREATOR_SEEN = 'epsTopikCreatorSeen';
const DATA_VERSION = '20261002-feature-pack-10';
let examTimerInterval = null;
let examTimerQuestion = null;

const defaultProgress = {
  correct: 0, wrong: 0, answered: 0, xp: 0, streak: 0, lastDate: '',
  seen: {}, wrongByWord: {}, rightByWord: {}, mastered: {}, favorites: {},
  achievements: {}, quizHistory: [], studyDays: {}, listening: 0, reviewDue: {}, dailyChallenges: {}
};

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch (e) { localStorage.removeItem(key); return typeof structuredClone === 'function' ? structuredClone(fallback) : JSON.parse(JSON.stringify(fallback)); }
}

let progress = readJSON(STORE, defaultProgress);
progress = Object.assign({}, defaultProgress, progress);
progress.seen ||= {};
progress.wrongByWord ||= {};
progress.rightByWord ||= {};
progress.mastered ||= {};
progress.favorites ||= {};
progress.achievements ||= {};
progress.quizHistory ||= [];
progress.studyDays ||= {};
progress.listening ||= 0;
let settings = readJSON(SETTINGS, { theme: 'dark', speechRate: .80, listeningPause: 650 });
settings.speechRate = Number(settings.speechRate) || .80;
settings.listeningPause = Number(settings.listeningPause) || 650;

document.documentElement.dataset.theme = settings.theme === 'dark' ? 'dark' : 'light';

async function init() {
  try {
    [chapters, vocab] = await Promise.all([
      fetch(`data/chapters.json?v=${DATA_VERSION}`, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(`chapters.json: HTTP ${r.status}`); return r.json(); }),
      fetch(`data/vocabulary.json?v=${DATA_VERSION}`, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(`vocabulary.json: HTTP ${r.status}`); return r.json(); })
    ]);
    render();
    if (localStorage.getItem(CREATOR_SEEN) !== '1') openInfoModal();
  } catch (e) {
    app.innerHTML = '<div class="card"><h2>Data tidak dapat dimuat</h2><p class="muted">Pastikan folder data/ ikut diunggah dan website dijalankan melalui server.</p></div>';
    console.error(e);
  }
}

function openInfoModal() {
  infoModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  setTimeout(() => document.getElementById('closeInfo')?.focus(), 50);
}
function closeInfoModal() {
  infoModal.classList.add('hidden');
  localStorage.setItem(CREATOR_SEEN, '1');
  document.body.classList.remove('modal-open');
}
function closeQuizFeedback() {
  quizFeedbackModal?.classList.add('hidden');
  if (!infoModal || infoModal.classList.contains('hidden')) document.body.classList.remove('modal-open');
}

function openQuizCorrectFeedback({answer=''}) {
  if (!quizFeedbackModal) return;
  const icon = document.getElementById('quizFeedbackIcon');
  const title = document.getElementById('quizFeedbackTitle');
  const message = document.getElementById('quizFeedbackMessage');
  const answerBox = document.getElementById('quizFeedbackAnswer');
  const action = document.getElementById('quizFeedbackAction');
  quizFeedbackModal.classList.remove('is-final');
  icon.textContent = '✓';
  icon.className = 'quiz-feedback-icon correct';
  title.textContent = 'Jawaban Benar!';
  message.textContent = '+10 XP · Jawaban kamu tepat. Soal berikutnya akan terbuka otomatis.';
  if (answer) {
    answerBox.classList.remove('hidden');
    answerBox.innerHTML = `<span>Jawaban benar</span><strong>${esc(answer)}</strong>`;
  } else {
    answerBox.classList.add('hidden');
    answerBox.innerHTML = '';
  }
  action.disabled = true;
  action.classList.add('hidden');
  action.textContent = '';
  action.onclick = null;
  const feedbackCard = quizFeedbackModal.querySelector('.quiz-feedback-card');
  feedbackCard?.classList.remove('pop-in');
  quizFeedbackModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => requestAnimationFrame(() => feedbackCard?.classList.add('pop-in')));
}

function openQuizFeedback({secondChance=false, answer='', onAction}) {
  if (!quizFeedbackModal) return;
  const icon = document.getElementById('quizFeedbackIcon');
  const title = document.getElementById('quizFeedbackTitle');
  const message = document.getElementById('quizFeedbackMessage');
  const answerBox = document.getElementById('quizFeedbackAnswer');
  const action = document.getElementById('quizFeedbackAction');
  quizFeedbackModal.classList.toggle('is-final', !secondChance);
  icon.textContent = secondChance ? '✕' : '↻';
  icon.className = `quiz-feedback-icon ${secondChance ? 'final' : 'retry'}`;
  title.textContent = secondChance ? 'Jawaban Salah 2×' : 'Jawaban Salah';
  message.textContent = secondChance ? 'Kedua kesempatan sudah digunakan.' : 'Tenang, kamu masih punya 1 kesempatan untuk soal ini.';
  if (answer) {
    answerBox.classList.remove('hidden');
    answerBox.innerHTML = `<span>Jawaban yang benar</span><strong>${esc(answer)}</strong>`;
  } else {
    answerBox.classList.add('hidden');
    answerBox.innerHTML = '';
  }
  action.disabled = false;
  action.classList.remove('hidden');
  action.textContent = secondChance ? 'Soal Berikutnya →' : 'Coba Lagi';
  action.onclick = () => { closeQuizFeedback(); onAction?.(); };
  const feedbackCard = quizFeedbackModal.querySelector('.quiz-feedback-card');
  feedbackCard?.classList.remove('pop-in');
  quizFeedbackModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => requestAnimationFrame(() => feedbackCard?.classList.add('pop-in')));
  setTimeout(() => action.focus(), 80);
}

document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
document.getElementById('themeBtn').addEventListener('click', () => {
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(SETTINGS, JSON.stringify(settings));
  document.documentElement.dataset.theme = settings.theme === 'dark' ? 'dark' : 'light';
});

function save() { localStorage.setItem(STORE, JSON.stringify(progress)); }
function esc(s) { return String(s).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
function toastMsg(s) { toast.textContent = s; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 1700); }
function itemsFor(ch) { return vocab.filter(v => v.bab === ch); }
function wordKey(v) { return String(v.id ?? `${v.bab}-${v.korea}-${v.arti}`); }
function wordStats(v) {
  const key = wordKey(v);
  return { wrong: progress.wrongByWord[key] || 0, right: progress.rightByWord[key] || 0, seen: !!progress.seen[key], mastered: !!progress.mastered[key], favorite: !!progress.favorites[key] };
}
let speechRunId = 0;
function speakKorean(text) {
  if (!('speechSynthesis' in window)) { toastMsg('Browser ini belum mendukung audio Korea.'); return; }
  const runId = ++speechRunId;
  speechSynthesis.cancel();

  // A slash in the source vocabulary means the Korean alternatives should be
  // pronounced separately. Speaking them as one utterance can make the
  // second word start before the first one has finished on some browsers.
  const parts = String(text)
    .split('/')
    .map(s => s.trim())
    .filter(Boolean);

  const speakPart = (index) => {
    if (runId !== speechRunId || index >= parts.length) return;
    const u = new SpeechSynthesisUtterance(parts[index]);
    u.lang = 'ko-KR';
    u.rate = settings.speechRate;
    u.pitch = 1;
    u.onend = () => {
      if (runId !== speechRunId) return;
      if (index + 1 < parts.length) {
        // Deliberate pause for entries such as "무엇/뭐" or "누나/언니".
        setTimeout(() => speakPart(index + 1), settings.listeningPause);
      }
    };
    u.onerror = () => {
      if (runId !== speechRunId) return;
      if (index + 1 < parts.length) setTimeout(() => speakPart(index + 1), settings.listeningPause);
    };
    speechSynthesis.speak(u);
  };

  speakPart(0);
}
function todayKey(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function markReviewSchedule(v, wasCorrect, attempts=1){
  const key=wordKey(v), now=Date.now();
  let days = wasCorrect ? (attempts===1 ? 3 : 1) : 0;
  if((progress.wrongByWord[key]||0)>=2) days=0;
  progress.reviewDue[key] = now + days*86400000;
}
function dueReviewPool(base=vocab){
  const now=Date.now();
  return base.filter(v => progress.reviewDue[wordKey(v)] && progress.reviewDue[wordKey(v)] <= now);
}
function dailySeededPool(base=vocab, date=todayKey()){
  const arr=base.slice(); let seed=0;
  for(const ch of date) seed=(seed*31+ch.charCodeAt(0))>>>0;
  const rand=()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };
  for(let i=arr.length-1;i>0;i--){ const j=Math.floor(rand()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  return arr;
}
function dailyChallengeDone(){ return !!progress.dailyChallenges[todayKey()]; }
function markDailyChallengeDone(){ progress.dailyChallenges[todayKey()]={done:true,date:new Date().toISOString()}; }
function filteredBase() {
  return state.source === 'Semua' ? vocab : vocab.filter(v => v.sumber === state.source);
}
function difficultPool(base=vocab) { return base.filter(v => mastery(v)==='salah' || (progress.wrongByWord[wordKey(v)]||0) >= 1); }
function recordStudyDay(){ const d=todayKey(); progress.studyDays[d]=true; updateStreak(); }
function mastery(v) {
  const s = wordStats(v);
  if (s.mastered || (s.right >= 2 && s.wrong === 0)) return 'dikuasai';
  if (s.wrong >= 2) return 'salah';
  if (s.seen || s.right > 0 || s.wrong > 0) return 'perlu';
  return 'belum';
}
function masteryLabel(v) {
  return ({ dikuasai:'🟢 Dikuasai', perlu:'🟡 Perlu latihan', salah:'🔴 Sering salah', belum:'⚪ Belum dipelajari' })[mastery(v)];
}
function masteryClass(v) { return `mastery-${mastery(v)}`; }

function updateStreak() {
  const today = todayKey();
  if (progress.lastDate === today) return false;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const y = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
  progress.streak = progress.lastDate === y ? (progress.streak || 0) + 1 : 1;
  progress.lastDate = today;
  return true;
}

const levelData = [
  [1,'Pemula',0],[2,'Pelajar',100],[3,'Pembelajar Aktif',250],[4,'Konsisten',500],[5,'Kosakata Hunter',850],
  [6,'TOPIK Learner',1300],[7,'Vocabulary Pro',1900],[8,'Korean Explorer',2700],[9,'EPS Learner',3700],[10,'Master Kandidat',5000]
];
function levelInfo(xp) {
  let level = 1, name = 'Pemula', current = 0, next = 100;
  for (let i=0;i<levelData.length;i++) if (xp >= levelData[i][2]) { level=levelData[i][0]; name=levelData[i][1]; current=levelData[i][2]; next=levelData[i+1]?.[2] ?? Math.ceil((xp + 1) / 1000) * 1000; }
  return { level, name, current, next, pct: Math.min(100, Math.round(((xp-current)/Math.max(1,next-current))*100)) };
}

const achievementDefs = [
  ['first_quiz','🌱 Langkah Pertama','Selesaikan 1 latihan soal.'],
  ['ten_words','📚 10 Kosakata','Pelajari 10 kosakata.'],
  ['fifty_words','🧠 50 Kosakata','Pelajari 50 kosakata.'],
  ['hundred_words','🏅 100 Kosakata','Pelajari 100 kosakata.'],
  ['accuracy_90','🎯 Akurat','Menyelesaikan latihan dengan akurasi minimal 90%.'],
  ['streak_3','🔥 3 Hari','Memiliki streak belajar 3 hari.'],
  ['streak_7','🔥 7 Hari','Memiliki streak belajar 7 hari.'],
  ['xp_1000','⚡ 1.000 XP','Mengumpulkan 1.000 XP.']
];
function earnedAchievements() { return Object.keys(progress.achievements || {}).filter(k => progress.achievements[k]); }
function checkAchievements(lastQuizPct = null) {
  const seen = Object.keys(progress.seen || {}).length;
  const defs = {
    first_quiz: (progress.quizHistory || []).length >= 1,
    ten_words: seen >= 10,
    fifty_words: seen >= 50,
    hundred_words: seen >= 100,
    accuracy_90: lastQuizPct !== null && lastQuizPct >= 90,
    streak_3: (progress.streak || 0) >= 3,
    streak_7: (progress.streak || 0) >= 7,
    xp_1000: (progress.xp || 0) >= 1000
  };
  const newly = [];
  for (const [id, ok] of Object.entries(defs)) if (ok && !progress.achievements[id]) { progress.achievements[id] = true; newly.push(id); }
  if (newly.length) save();
  return newly;
}
function awardXp(amount) {
  const before = levelInfo(progress.xp || 0);
  progress.xp = (progress.xp || 0) + amount;
  const after = levelInfo(progress.xp);
  if (after.level > before.level) toastMsg(`Level ${after.level}! ${after.name} 🎉`);
}

function show(view, opts = {}) {
  state.view = view;
  if (opts.chapter !== undefined) {
    const nextChapter = Number(opts.chapter) || null;
    if (state.chapter !== nextChapter) { state.cat = 'Semua'; state.status = 'Semua'; }
    state.chapter = nextChapter;
  }
  if (view !== 'vocab') state.search = '';
  if (view !== 'flashcards') state.flashPool = null;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function stopExamTimer() {
  if (examTimerInterval) { clearInterval(examTimerInterval); examTimerInterval = null; }
  examTimerQuestion = null;
}
function startExamTimer(q) {
  stopExamTimer();
  if (!q || q.mode !== 'exam' || !q.timerEnd || q.i >= q.pool.length) return;
  examTimerQuestion = q;
  const update = () => {
    if (state.quiz !== q || q.mode !== 'exam') { stopExamTimer(); return; }
    const left = Math.max(0, Math.ceil((q.timerEnd - Date.now()) / 1000));
    const timerEl = document.querySelector('.exam-timer');
    if (timerEl) timerEl.textContent = `⏱ ${left} dtk`;
    if (left <= 0) {
      stopExamTimer();
      q.i = q.pool.length;
      render();
    }
  };
  update();
  examTimerInterval = setInterval(update, 250);
}
function render() {
  stopExamTimer();
  updateActiveNav();
  if (state.view === 'home') return home();
  if (state.view === 'chapters') return chapterList();
  if (state.view === 'vocab') return vocabView();
  if (state.view === 'flashcards') return flashcards();
  if (state.view === 'quiz') return quizView();
  if (state.view === 'stats') return statsView();
}

function home() {
  const total = vocab.length;
  const mainCount = vocab.filter(v => v.sumber === '어휘').length;
  const infoCount = total - mainCount;
  const seen = Object.keys(progress.seen || {}).length;
  const pct = total ? Math.round(seen / total * 100) : 0;
  const level = levelInfo(progress.xp || 0);
  app.innerHTML = `<section class="hero"><div><div class="eyebrow">EPS-TOPIK 한국어 어휘</div><h1>Belajar kosakata Korea <span class="accent">lebih terarah.</span></h1><p>Pelajari dan uji kosakata EPS-TOPIK Bab 1–30. Lengkap dengan kosakata utama dan <strong>문화와 정보</strong>.</p><div class="actions"><button class="btn primary" data-action="chapters">Lihat Bab 1–30 →</button><button class="btn" data-action="quiz">Mulai Latihan Soal</button></div></div><div class="hero-card"><span>Total kosakata</span><strong>${total.toLocaleString('id-ID')}</strong><span>Bab 1–30 · ${mainCount.toLocaleString('id-ID')} utama + ${infoCount.toLocaleString('id-ID')} 정보</span><span class="source-note">Dataset ${DATA_VERSION}</span><hr><span>Sudah dipelajari</span><strong>${seen}</strong><div class="progress"><span style="width:${pct}%"></span></div></div></section>
  <div class="dashboard-stats"><div class="mini-stat"><span class="muted">Total kosakata</span><strong>${total.toLocaleString('id-ID')}</strong></div><div class="mini-stat"><span class="muted">Akurasi</span><strong>${accuracy()}%</strong></div><div class="mini-stat"><span class="muted">Streak</span><strong>🔥 ${progress.streak || 0}</strong></div></div>
  <div class="card level-card"><div><span class="eyebrow">LEVEL BELAJAR</span><h2>Level ${level.level} · ${esc(level.name)}</h2><p class="muted">${progress.xp || 0} XP total · ${Math.max(0, level.next-(progress.xp||0))} XP menuju level berikutnya</p></div><div class="level-ring"><strong>${level.level}</strong><span>LEVEL</span></div><div class="level-progress"><div class="progress"><span style="width:${level.pct}%"></span></div><small>${level.pct}% ke level berikutnya</small></div></div>
  <div class="section-head"><div><h2>Bab tersedia</h2><p class="muted">Mulai dari Bab 1 atau pilih bab tertentu.</p></div><button class="btn" data-action="chapters">Lihat semua</button></div><div class="grid">${chapters.slice(0,6).map(chapterCard).join('')}</div>
  <div class="section-head"><div><h2>Tantangan Hari Ini</h2><p class="muted">10 soal pilihan harian + review terjadwal. ${dailyChallengeDone()?'✅ Sudah selesai hari ini.':'🎯 Belum selesai.'}</p></div></div><div class="grid"><div class="card feature-card daily-card"><div class="feature-icon">🌟</div><h3>Daily Challenge</h3><p class="muted">10 soal yang berubah setiap hari. Selesaikan untuk mendapatkan bonus XP.</p><button class="btn primary" data-action="quiz" data-mode="daily">${dailyChallengeDone()?'Ulangi Tantangan':'Mulai Tantangan'} →</button></div><div class="card feature-card"><div class="feature-icon">🧠</div><h3>Review Terjadwal</h3><p class="muted">Kosakata yang waktunya sudah tiba akan muncul kembali secara otomatis.</p><button class="btn" data-action="quiz" data-mode="spaced">Review Sekarang</button></div></div><div class="section-head"><div><h2>Fokus belajar</h2><p class="muted">Kata yang belum dikuasai dan sering salah akan lebih mudah ditemukan.</p></div></div><div class="grid"><div class="card feature-card"><div class="feature-icon">🎯</div><h3>Simulasi Ujian</h3><p class="muted">Mode ujian tanpa feedback langsung.</p><button class="btn" data-action="quiz" data-mode="exam">Mulai Simulasi</button></div><div class="card feature-card"><div class="feature-icon">🔴</div><h3>Kosakata Sulit</h3><p class="muted">Latih kembali kata yang sering salah.</p><button class="btn" data-action="vocab" data-status="salah">Latihan Kata Sulit</button></div><div class="card feature-card"><div class="feature-icon">🃏</div><h3>Kartu Belajar</h3><p class="muted">Balik kartu dengan animasi dan tandai “Saya tahu”.</p><button class="btn" data-action="flashcards">Buka Kartu</button></div><div class="card feature-card"><div class="feature-icon">🔊</div><h3>Listening Korea</h3><p class="muted">Dengarkan pelafalan Korea lalu pilih arti yang benar.</p><button class="btn" data-action="quiz" data-mode="listening">Mulai Listening</button></div><div class="card feature-card"><div class="feature-icon">🏆</div><h3>Pencapaian</h3><p class="muted">${earnedAchievements().length} / ${achievementDefs.length} pencapaian terbuka.</p><button class="btn" data-action="stats">Lihat Statistik</button></div></div>`;
  bindActions(); updateActiveNav();
}

function accuracy() { return progress.answered ? Math.round((progress.correct || 0) / progress.answered * 100) : 0; }
function chapterCard(c) {
  const actualCount = vocab.length ? itemsFor(c.bab).length : Number(c.jumlahKosakata || 0);
  const chapterItems = itemsFor(c.bab);
  const seen = chapterItems.filter(v => progress.seen[wordKey(v)]).length;
  const pct = actualCount ? Math.round(seen / actualCount * 100) : 0;
  return `<div class="card chapter-card"><div class="chapter-top"><div class="chapter-icon">${['◉','▣','⌖','◆','▦','◷'][((c.bab-1)%6)]}</div><div><span class="chapter-num">BAB ${c.bab}</span><h3>${esc(c.korea)}</h3><p>${esc(c.indonesia)}</p></div></div><div class="chapter-progress"><div class="progress"><span style="width:${pct}%"></span></div><small>${seen}/${actualCount} dipelajari</small></div><div class="chapter-bottom"><span class="count">${actualCount} kosakata</span><button class="btn" data-open="${c.bab}">Buka →</button></div></div>`;
}
function chapterList() {
  app.innerHTML = `<div class="section-head"><div><div class="eyebrow">EPS-TOPIK</div><h1>Daftar Bab 1–30</h1><p class="muted">Pilih bab untuk melihat seluruh kosakata, termasuk budaya dan informasi.</p></div></div><div class="filter-pills"><button class="pill active">Semua Bab</button><button class="pill" data-action="vocab">Semua Kosakata</button></div><div class="grid" style="margin-top:14px">${chapters.map(chapterCard).join('')}</div>`;
  bindActions(); updateActiveNav();
}

function vocabView() {
  const ch = state.chapter;
  const base = (ch ? itemsFor(ch) : vocab).filter(v => state.source === 'Semua' || v.sumber === state.source);
  const cats = [...new Set(base.map(v => v.kategori))];
  if (state.cat !== 'Semua' && !cats.includes(state.cat)) state.cat = 'Semua';
  const qSearch = state.search.trim().toLowerCase();
  const list = base.filter(v => {
    const chInfo = chapters[v.bab-1] || {};
    const hay = [v.korea, v.arti, v.kategori, chInfo.korea, chInfo.indonesia, `bab ${v.bab}`].join(' ').toLowerCase();
    return (state.cat === 'Semua' || v.kategori === state.cat)
      && (state.status === 'Semua' || mastery(v) === state.status)
      && (!qSearch || hay.includes(qSearch));
  });
  const statusCounts = { semua:base.length, belum:base.filter(v=>mastery(v)==='belum').length, perlu:base.filter(v=>mastery(v)==='perlu').length, salah:base.filter(v=>mastery(v)==='salah').length, dikuasai:base.filter(v=>mastery(v)==='dikuasai').length };
  app.innerHTML = `<div class="section-head"><div><div class="eyebrow">KOSAKATA</div><h1>${ch ? `Bab ${ch} — ${esc(chapters[ch-1].korea)}` : 'Semua Kosakata'}</h1><p class="muted">${ch ? esc(chapters[ch-1].indonesia) : 'Kosakata EPS-TOPIK Bab 1–30'}</p></div><button class="btn" data-action="chapters">Daftar Bab</button></div>
  <div class="toolbar"><input id="vsearch" class="search" placeholder="Cari Korea, Indonesia, kategori, atau Bab..." value="${esc(state.search)}"><select id="vchapter" class="select"><option value="">Semua Bab</option>${chapters.map(c=>`<option value="${c.bab}" ${ch===c.bab?'selected':''}>Bab ${c.bab} — ${esc(c.korea)}</option>`).join('')}</select><select id="vsource" class="select"><option>Semua</option><option value="어휘" ${state.source==='어휘'?'selected':''}>어휘</option><option value="문화와 정보" ${state.source==='문화와 정보'?'selected':''}>문화와 정보</option></select><select id="vcat" class="select"><option>Semua</option>${cats.map(x=>`<option ${x===state.cat?'selected':''}>${esc(x)}</option>`).join('')}</select>${ch ? `<button class="btn primary" data-flash="${ch}">Kartu Bab Ini</button>` : ''}</div>
  <div class="mastery-pills"><button class="pill ${state.status==='Semua'?'active':''}" data-status="Semua">Semua <b>${statusCounts.semua}</b></button><button class="pill ${state.status==='belum'?'active':''}" data-status="belum">⚪ Belum <b>${statusCounts.belum}</b></button><button class="pill ${state.status==='perlu'?'active':''}" data-status="perlu">🟡 Perlu latihan <b>${statusCounts.perlu}</b></button><button class="pill ${state.status==='salah'?'active':''}" data-status="salah">🔴 Sering salah <b>${statusCounts.salah}</b></button><button class="pill ${state.status==='dikuasai'?'active':''}" data-status="dikuasai">🟢 Dikuasai <b>${statusCounts.dikuasai}</b></button></div>
  <div class="notice">Menampilkan <strong>${list.length}</strong> kosakata${ch ? ` dari Bab ${ch}` : ''}. Status setiap kata tersimpan otomatis di perangkat.</div>
  <div class="vocab-list">${list.length ? list.map(v => vocabItem(v)).join('') : `<div class="card empty">Kosakata dengan filter ini belum tersedia.</div>`}</div><p class="source-note">Data disusun dari entri 어휘/KOSAKATA Bab 1–30 serta istilah leksikal dari bagian 문화와 정보/Budaya & Informasi pada PDF EPS-TOPIK yang diberikan.</p>`;
  document.getElementById('vsearch').addEventListener('input', e => { state.search = e.target.value; render(); const el=document.getElementById('vsearch'); if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);} });
  document.getElementById('vchapter').addEventListener('change', e => { state.chapter = Number(e.target.value) || null; state.cat='Semua'; state.status='Semua'; render(); });
  document.getElementById('vsource').addEventListener('change', e => { state.source=e.target.value; state.cat='Semua'; render(); });
  document.getElementById('vcat').addEventListener('change', e => { state.cat=e.target.value; render(); });
  document.querySelectorAll('[data-status]').forEach(b => b.onclick = () => { state.status=b.dataset.status; render(); });
  bindActions(); updateActiveNav();
}
function vocabItem(v) {
  const s = wordStats(v);
  const chInfo = chapters[v.bab-1] || {};
  const chapterLabel = `Bab ${v.bab} · ${chInfo.korea || ''}`;
  return `<div class="vocab-item ${masteryClass(v)}"><div class="word-main"><div class="ko">${esc(v.korea)}</div><div class="meaning">${esc(v.arti)}</div><div class="vocab-chapter">${esc(chapterLabel)}${chInfo.indonesia ? ` — ${esc(chInfo.indonesia)}` : ''}</div><div class="word-meta"><span class="status-chip">${masteryLabel(v)}</span>${s.wrong?`<span class="mistake-chip">${s.wrong}× salah</span>`:''}${s.favorite?'<span class="favorite-chip">★ Disimpan</span>':''}</div></div><span class="cat">${esc(v.kategori)}</span><div class="word-actions"><button class="round-btn" data-speak="${encodeURIComponent(v.korea)}" title="Dengarkan pelafalan Korea" aria-label="Dengarkan pelafalan Korea">🔊</button><button class="round-btn favorite-btn ${s.favorite?'is-favorite':''}" data-favorite="${encodeURIComponent(wordKey(v))}" title="Simpan kata" aria-label="Simpan kata">${s.favorite?'★':'☆'}</button><button class="round-btn" data-oneflash="${encodeURIComponent(wordKey(v))}" title="Buka kartu" aria-label="Buka kartu">🃏</button></div></div>`;
}

function flashcards() {
  let pool = state.flashPool;
  if (!pool) pool = state.flashPool = state.chapter ? itemsFor(state.chapter).slice() : vocab.slice();
  if (!pool.length) { app.innerHTML='<div class="card empty">Tidak ada kosakata.</div>'; return; }
  if (state.flashIndex >= pool.length) state.flashIndex = 0;
  const v = pool[state.flashIndex];
  const s = wordStats(v);
  app.innerHTML = `<div class="section-head"><div><div class="eyebrow">KARTU BELAJAR</div><h1>Ulangi sampai ingat.</h1><p class="muted">${state.chapter ? `Bab ${state.chapter} — ${esc(chapters[state.chapter-1].korea)}` : 'Semua Bab'}</p></div><button class="btn" data-action="chapters">Pilih Bab</button></div>
  <div class="flash-toolbar"><span class="status-chip ${masteryClass(v)}">${masteryLabel(v)}</span><span class="muted">${state.flashIndex+1} / ${pool.length}</span></div>
  <div class="quiz-wrap"><div class="flash-scene ${state.flashShow?'flipped':''}" id="flash" tabindex="0" role="button" aria-label="Kartu belajar, ketuk untuk membalik"><div class="flash-inner"><div class="flash-face flash-front"><span class="cat">${esc(v.kategori)}</span><div class="flash-main">${esc(v.korea)}</div><button class="btn audio-btn" id="speakFlash">🔊 Dengarkan</button><div class="flash-hint">Ketuk untuk melihat arti</div></div><div class="flash-face flash-back"><span class="cat">Arti Indonesia</span><div class="flash-main flash-meaning">${esc(v.arti)}</div><div class="flash-hint">${esc(v.korea)}</div></div></div></div>
  <div class="flash-controls"><button class="btn" id="prevFlash">← Sebelumnya</button><button class="btn" id="repeatFlash">↻ Perlu diulang</button><button class="btn primary" id="knowFlash">✓ Saya tahu</button><button class="btn" id="nextFlash">Berikutnya →</button></div></div>`;
  const flip=()=>{state.flashShow=!state.flashShow;render();};
  document.getElementById('flash').onclick=(e)=>{if(e.target.closest('#speakFlash')) return; flip();};
  document.getElementById('speakFlash').onclick=e=>{e.stopPropagation();speakKorean(v.korea);};
  document.getElementById('flash').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();flip();}};
  document.getElementById('prevFlash').onclick=()=>{state.flashIndex=(state.flashIndex-1+pool.length)%pool.length;state.flashShow=false;render();};
  document.getElementById('nextFlash').onclick=()=>{state.flashIndex=(state.flashIndex+1)%pool.length;state.flashShow=false;render();};
  document.getElementById('repeatFlash').onclick=()=>{progress.wrongByWord[wordKey(v)]=(progress.wrongByWord[wordKey(v)]||0)+1;delete progress.mastered[wordKey(v)];save();toastMsg('Ditandai perlu diulang');render();};
  document.getElementById('knowFlash').onclick=()=>{const key=wordKey(v);progress.seen[key]=true;progress.rightByWord[key]=(progress.rightByWord[key]||0)+1;if(progress.rightByWord[key]>=2)progress.mastered[key]=true;awardXp(3);updateStreak();checkAchievements();save();toastMsg('Kosakata dipelajari +3 XP');state.flashIndex=(state.flashIndex+1)%pool.length;state.flashShow=false;render();};
  bindActions(); updateActiveNav();
}

function startQuizFromCurrent() { const count=10; const pool=(state.chapter?itemsFor(state.chapter):vocab).slice().sort(()=>Math.random()-.5); state.quiz=makeQuizState(pool,Math.min(count,pool.length)); show('quiz'); }
function makeChoices(v,pool) {
  const result=[v], used=new Set([v.arti]);
  const candidates=pool.filter(x=>x!==v).slice().sort(()=>Math.random()-.5);
  for(const x of candidates){if(!used.has(x.arti)){result.push(x);used.add(x.arti);if(result.length===4)break;}}
  if(result.length<4) for(const x of vocab.slice().sort(()=>Math.random()-.5)){if(x!==v&&!used.has(x.arti)){result.push(x);used.add(x.arti);if(result.length===4)break;}}
  return result.sort(()=>Math.random()-.5);
}
function makeQuizState(pool,n,mode='campuran') { return {pool:pool.slice(0,n),questionCount:n,i:0,score:0,wrong:0,mode,locked:false,attempts:0,tried:[],choices:null,selected:null,pendingNext:false,feedback:null,review:[]}; }

function quizView() {
  if (!state.quiz) {
    const mode = state.pendingQuizMode || 'campuran';
    state.pendingQuizMode = null;
    app.innerHTML=`<div class="quiz-wrap"><div class="card quiz-card quiz-card-enter"><div class="eyebrow">LATIHAN SOAL</div><h1>Uji kosakata.</h1><p class="muted">Pilih mode belajar, lalu mulai. Mode belajar memberi feedback; simulasi ujian menampilkan hasil di akhir.</p><div class="two-col"><label>Bab<select id="qchap" class="select" style="width:100%"><option value="">Semua Bab</option>${chapters.map(c=>`<option value="${c.bab}" ${state.chapter===c.bab?'selected':''}>Bab ${c.bab} — ${esc(c.korea)}</option>`).join('')}</select></label><label>Jumlah soal<select id="qcount" class="select" style="width:100%"><option>10</option><option>20</option><option>30</option><option>50</option><option>100</option><option>Semua</option></select></label></div><label class="mode-label">Mode<select id="qmode" class="select" style="width:100%"><option value="campuran" ${mode==='campuran'?'selected':''}>Campuran</option><option value="listening" ${mode==='listening'?'selected':''}>🔊 Listening Korea</option><option value="hard" ${mode==='hard'?'selected':''}>🔴 Kosakata Sulit</option><option value="review" ${mode==='review'?'selected':''}>📝 Review Jawaban Salah</option><option value="spaced" ${mode==='spaced'?'selected':''}>🧠 Review Terjadwal</option><option value="daily" ${mode==='daily'?'selected':''}>🌟 Daily Challenge</option><option value="exam" ${mode==='exam'?'selected':''}>🎯 Simulasi Ujian</option></select></label><div class="notice">Listening menggunakan suara Korea dari Speech Synthesis browser. Kecepatan: <strong>${settings.speechRate.toFixed(2)}×</strong>. Simulasi ujian tidak memberi tahu benar/salah sampai selesai.</div><div class="actions"><button class="btn primary" id="startQ">Mulai Latihan →</button></div></div></div>`;
    document.getElementById('startQ').onclick=()=>{
      state.chapter=Number(document.getElementById('qchap').value)||null; const modeNow=document.getElementById('qmode').value; const poolBase=(modeNow==='daily'?vocab:(state.chapter?itemsFor(state.chapter):vocab)); let pool=poolBase.slice();
      if(modeNow==='hard') pool=difficultPool(pool);
      if(modeNow==='review') pool=pool.filter(v=>(progress.wrongByWord[wordKey(v)]||0)>0);
      if(modeNow==='spaced') pool=dueReviewPool(pool);
      if(modeNow==='daily') pool=dailySeededPool(pool, todayKey());
      if(!pool.length){toastMsg('Belum ada kosakata untuk mode ini.');return;}
      if(modeNow!=='daily') pool.sort(()=>Math.random()-.5); const selected=document.getElementById('qcount').value; const requested=modeNow==='daily'?Math.min(10,pool.length):(selected==='Semua'?pool.length:Number(selected)); const exam=modeNow==='exam'; state.quiz=makeQuizState(pool,Math.min(requested,pool.length),modeNow); state.quiz.timer=exam?1200:0; recordStudyDay(); save(); render(); if(modeNow==='listening') setTimeout(()=>speakKorean(state.quiz.pool[state.quiz.i].korea),300);
    }; updateActiveNav(); return;
  }
  const q=state.quiz;
  if(q.i>=q.pool.length) return quizResult();
  if(q.mode==='exam' && q.timerEnd && Date.now()>=q.timerEnd){ q.i=q.pool.length; return quizResult(); }
  const v=q.pool[q.i];
  if(!q.choices) q.choices=makeChoices(v,q.pool);
  const choices=q.choices, attempts=q.attempts||0, selected=q.selected||null, feedback=q.feedback;
  const canAnswer=!!selected&&!q.pendingNext&&!q.locked;
  const actionLabel=q.pendingNext?'Soal Berikutnya →':'Jawab';
  const pct=Math.round((q.i/q.pool.length)*100);
  if(q.mode==='exam' && !q.timerStarted){q.timerStarted=Date.now();q.timerEnd=q.timerStarted+(q.timer||1200)*1000;}
  const examLeft=q.mode==='exam'?Math.max(0,Math.ceil((q.timerEnd-Date.now())/1000)):0;
  const questionText=q.mode==='listening'?'🔊 Dengarkan audio Korea, lalu pilih artinya.':esc(v.korea);
  app.innerHTML=`<div class="quiz-wrap"><div class="card quiz-card quiz-card-enter ${q.feedback?.type==='correct'?'quiz-correct':''} ${q.mode==='exam'?'exam-mode':''}"><div class="quiz-meta"><span>Soal ${q.i+1}/${q.pool.length}</span><span>${q.mode==='exam'?`<span class="exam-timer">⏱ ${examLeft} dtk</span> · `:''}${q.mode==='exam'?'Ujian · Tanpa kesempatan kedua':'Kesempatan: <strong>'+Math.max(0,2-attempts)+'</strong> dari 2'}</span></div><div class="quiz-progress"><span style="width:${pct}%"></span></div><div class="quiz-question">${questionText}${q.mode==='listening'?`<button class="btn audio-btn" id="speakQ">🔊 Putar Lagi</button>`:''}</div><div class="choices">${choices.map((c,i)=>{const isSelected=selected===c.arti;const tried=q.tried?.includes(c.arti);const cls=`choice ${isSelected?'selected':''} ${tried?'tried':''}`;return `<button class="${cls}" style="--choice-i:${i}" data-answer="${encodeURIComponent(c.arti)}" ${tried||q.pendingNext?'disabled':''} aria-pressed="${isSelected?'true':'false'}">${esc(c.arti)}</button>`;}).join('')}</div><div class="actions quiz-actions"><button class="btn" id="quitQ">Keluar</button><button class="btn primary answer-main-btn" id="answerQ" ${canAnswer||q.pendingNext?'':'disabled'}>${actionLabel}</button></div></div></div>`;
  if(q.mode==='exam') startExamTimer(q);
  if(q.mode==='listening'){ document.getElementById('speakQ')?.addEventListener('click',()=>speakKorean(v.korea)); setTimeout(()=>{if(state.quiz===q && !quizFeedbackModal?.classList.contains('hidden')) return;speakKorean(v.korea);},250); }
  document.querySelectorAll('[data-answer]').forEach(btn=>btn.onclick=()=>{
    if(q.locked||q.pendingNext)return;
    q.selected=decodeURIComponent(btn.dataset.answer);
    q.feedback=null;
    document.querySelectorAll('[data-answer]').forEach(b=>{
      const active=b===btn;
      b.classList.toggle('selected',active);
      b.setAttribute('aria-pressed',active?'true':'false');
    });
    const answerBtn=document.getElementById('answerQ');
    if(answerBtn) answerBtn.disabled=false;
  });
  document.getElementById('answerQ').onclick=()=>{
    if(q.pendingNext){q.i++;q.attempts=0;q.tried=[];q.choices=null;q.selected=null;q.pendingNext=false;q.feedback=null;q.locked=false;render();return;}
    if(!q.selected||q.locked)return;
    q.locked=true;
    const answer=q.selected, correct=answer===v.arti, key=wordKey(v);
    if(correct){
      q.score++; progress.correct=(progress.correct||0)+1; progress.answered=(progress.answered||0)+1; progress.seen[key]=true; progress.rightByWord[key]=(progress.rightByWord[key]||0)+1;
      markReviewSchedule(v,true,(q.attempts||0)+1);
      if(q.attempts>0) q.review.push({ ...v, correct:true, answer:q.tried?.[0] || answer });
      if(progress.rightByWord[key]>=2 && (progress.wrongByWord[key]||0)===0) progress.mastered[key]=true;
      if(q.mode==='exam'){ q.pendingNext=true; q.locked=false; q.feedback=null; save(); setTimeout(()=>{if(state.quiz===q){q.i++;q.attempts=0;q.tried=[];q.choices=null;q.selected=null;q.pendingNext=false;render();}},80); return; }
      awardXp(10); updateStreak(); q.pendingNext=true; q.locked=false; q.feedback={type:'correct',title:'Jawaban Benar!',message:'+10 XP · Jawaban kamu tepat.'}; save(); checkAchievements(); render();
      requestAnimationFrame(()=>openQuizCorrectFeedback({answer:v.arti}));
      setTimeout(()=>{ if(state.quiz===q && q.pendingNext){ closeQuizFeedback(); q.i++; q.attempts=0; q.tried=[]; q.choices=null; q.selected=null; q.pendingNext=false; q.feedback=null; q.locked=false; render(); } }, 1100); return;
    }
    q.attempts=(q.attempts||0)+1; q.wrong=(q.wrong||0)+1; progress.wrong=(progress.wrong||0)+1; progress.wrongByWord[key]=(progress.wrongByWord[key]||0)+1; markReviewSchedule(v,false,(q.attempts||0)+1); delete progress.mastered[key]; q.tried=q.tried||[]; if(!q.tried.includes(answer))q.tried.push(answer); q.selected=null;
    if(q.mode==='exam'){ progress.answered=(progress.answered||0)+1; progress.seen[key]=true; q.review.push({ ...v, correct:false, answer }); q.pendingNext=true; q.locked=false; save(); setTimeout(()=>{if(state.quiz===q){q.i++;q.attempts=0;q.tried=[];q.choices=null;q.selected=null;q.pendingNext=false;render();}},80); return; }
    if(q.attempts<2){
      q.locked=false;
      q.feedback={type:'wrong',title:'Jawaban salah.',message:'Kesempatan tersisa 1. Pilih jawaban lain lalu tekan Jawab.'};
      save(); render();
      requestAnimationFrame(() => openQuizFeedback({
        secondChance:false,
        onAction:()=>{ q.feedback=null; render(); }
      }));
    }
    else {
      progress.answered=(progress.answered||0)+1;
      progress.seen[key]=true;
      q.pendingNext=true;
      q.locked=false;
      q.feedback={type:'wrong',title:'Jawaban salah 2×.',message:'Kedua kesempatan sudah digunakan.',answer:v.arti};
      q.review.push({ ...v, correct:false, answer:answer });
      save(); render();
      requestAnimationFrame(() => openQuizFeedback({
        secondChance:true,
        answer:v.arti,
        onAction:()=>{ q.i++; q.attempts=0; q.tried=[]; q.choices=null; q.selected=null; q.pendingNext=false; q.feedback=null; q.locked=false; render(); }
      }));
    }
  };
  document.getElementById('quitQ').onclick=()=>{state.quiz=null;show('home');};
  updateActiveNav();
}

function quizResult() {
  stopExamTimer();
  const q=state.quiz, total=q.pool.length, pct=total?Math.round(q.score/total*100):0;
  const review=q.review||[];
  progress.quizHistory.unshift({date:new Date().toISOString(),score:q.score,total,pct,wrong:q.wrong||0,mode:q.mode}); progress.quizHistory=progress.quizHistory.slice(0,50);
  if(q.mode==='listening') progress.listening=(progress.listening||0)+1;
  if(q.mode==='daily' && total>=1 && !dailyChallengeDone()) { markDailyChallengeDone(); awardXp(50); }
  const newly=checkAchievements(pct); save();
  state.review=review;
  app.innerHTML=`<div class="quiz-wrap"><div class="card quiz-card result-card"><div class="cat">HASIL LATIHAN</div><div class="result-score">${pct}%</div><p class="muted">${q.score} benar dari ${total} soal · ${q.wrong||0} percobaan salah.</p><div class="progress"><span style="width:${pct}%"></span></div>${newly.length?`<div class="achievement-toast">🏆 Pencapaian baru terbuka: ${newly.length}</div>`:''}<div class="result-actions"><button class="btn primary" id="reviewBtn">🔎 Tinjau Jawaban${review.length?` (${review.length})`:''}</button><button class="btn" id="again">Coba Lagi</button><button class="btn" id="homeAfter">Ke Beranda</button></div></div>${reviewSection(review)}</div>`;
  document.getElementById('reviewBtn').onclick=()=>document.getElementById('reviewList')?.scrollIntoView({behavior:'smooth'});
  document.getElementById('again').onclick=()=>{const count=q.questionCount||q.pool.length;const pool=q.pool.slice().sort(()=>Math.random()-.5);state.quiz=makeQuizState(pool,Math.min(count,pool.length),q.mode);state.quiz.timer=q.mode==='exam'?1200:0;render();if(q.mode==='listening')setTimeout(()=>{if(state.quiz) speakKorean(state.quiz.pool[state.quiz.i].korea);},300);};
  document.getElementById('homeAfter').onclick=()=>{state.quiz=null;show('home');};
}
function reviewSection(review) {
  if(!review.length) return `<div class="card review-card"><h3>🎯 Semua jawaban benar</h3><p class="muted">Tidak ada soal yang perlu ditinjau. Pertahankan konsistensimu!</p></div>`;
  return `<div class="card review-card" id="reviewList"><div class="section-head compact"><div><div class="eyebrow">REVIEW</div><h2>Tinjau Jawaban</h2><p class="muted">Pelajari kembali kata yang salah atau membutuhkan percobaan kedua.</p></div></div>${review.map((r,i)=>`<div class="review-item ${r.correct?'review-good':'review-bad'}"><div class="review-index">${i+1}</div><div><strong>${esc(r.korea)}</strong><p class="muted">Jawaban benar: <b>${esc(r.arti)}</b></p>${r.answer?`<p class="review-wrong">Jawaban kamu: ${esc(r.answer)}</p>`:''}</div><button class="btn" data-review-flash="${encodeURIComponent(wordKey(r))}">🃏 Kartu</button></div>`).join('')}</div>`;
}

function statsView() {
  const total=vocab.length, seen=Object.keys(progress.seen||{}).length, pct=total?Math.min(100,Math.round(seen/total*100)):0;
  const level=levelInfo(progress.xp||0), earned=earnedAchievements();
  const chapterRows=chapters.map(c=>{const items=itemsFor(c.bab), s=items.filter(v=>progress.seen[wordKey(v)]).length, masteredCount=items.filter(v=>mastery(v)==='dikuasai').length, accItems=items.filter(v=>progress.rightByWord[wordKey(v)]||progress.wrongByWord[wordKey(v)]);const right=accItems.reduce((a,v)=>a+(progress.rightByWord[wordKey(v)]||0),0),wrong=accItems.reduce((a,v)=>a+(progress.wrongByWord[wordKey(v)]||0),0),acc=right+wrong?Math.round(right/(right+wrong)*100):0, masterPct=items.length?Math.round(masteredCount/items.length*100):0;return `<div class="chapter-stat-row"><div><strong>Bab ${c.bab} · ${esc(c.korea)}</strong><small>${s}/${items.length} dipelajari · ${masteredCount} dikuasai</small></div><div class="chapter-mini-progress"><div class="progress"><span style="width:${masterPct}%"></span></div><small>${masterPct}% dikuasai</small></div><div class="chapter-acc"><strong>${acc}%</strong><small>akurasi</small></div></div>`;}).join('');
  app.innerHTML=`<div class="section-head"><div><div class="eyebrow">STATISTIK</div><h1>Perkembangan belajar.</h1><p class="muted">Semua progres tersimpan di perangkat ini.</p></div></div><div class="stats-grid"><div class="card stat"><span class="muted">Soal dijawab</span><strong>${progress.answered||0}</strong></div><div class="card stat"><span class="muted">Jawaban benar</span><strong>${progress.correct||0}</strong></div><div class="card stat"><span class="muted">Akurasi</span><strong>${accuracy()}%</strong></div><div class="card stat"><span class="muted">XP</span><strong>${progress.xp||0}</strong></div><div class="card stat"><span class="muted">Streak</span><strong>🔥 ${progress.streak||0}</strong></div><div class="card stat"><span class="muted">Pencapaian</span><strong>${earned.length}/${achievementDefs.length}</strong></div><div class="card stat"><span class="muted">Sesi Listening</span><strong>${progress.listening||0}</strong></div></div>
  <div class="two-col stats-main"><div class="card"><div class="eyebrow">LEVEL</div><h2>Level ${level.level} · ${esc(level.name)}</h2><p class="muted">${progress.xp||0} XP · ${Math.max(0,level.next-(progress.xp||0))} XP menuju level berikutnya</p><div class="progress"><span style="width:${level.pct}%"></span></div><small>${level.pct}%</small></div><div class="card"><div class="eyebrow">PENGUASAAN</div><h2>${seen.toLocaleString('id-ID')} / ${total.toLocaleString('id-ID')}</h2><p class="muted">Kosakata yang pernah dipelajari.</p><div class="progress"><span style="width:${pct}%"></span></div><small>${pct}% selesai</small></div></div>
  <div class="section-head"><div><div class="eyebrow">PER BAB</div><h2>Progress & akurasi</h2></div></div><div class="card chapter-stats">${chapterRows}</div>
  <div class="two-col stats-main"><div class="card"><div class="eyebrow">LISTENING</div><h2>🔊 Pengaturan Audio Korea</h2><div class="two-col"><label>Kecepatan<select id="speechRate" class="select" style="width:100%"><option value="0.70">0.70× Pelan</option><option value="0.85">0.85× Jelas</option><option value="1">1.00× Normal</option><option value="1.15">1.15× Cepat</option></select></label><label>Jeda “/”<select id="listenPause" class="select" style="width:100%"><option value="500">500 ms</option><option value="650">650 ms</option><option value="800">800 ms</option><option value="1000">1 detik</option></select></label></div><p class="muted">Saat ada tanda <strong>/</strong>, setiap bagian dibacakan terpisah agar tidak bertabrakan.</p></div><div class="card"><div class="eyebrow">REVIEW TERJADWAL</div><h2>${dueReviewPool(vocab).length} kosakata siap direview</h2><p class="muted">Jadwal review dibuat berdasarkan jawabanmu. Kata yang benar akan diberi jarak lebih panjang.</p><button class="btn primary" data-action="quiz" data-mode="spaced">🧠 Mulai Review</button></div></div>
  <div class="section-head"><div><div class="eyebrow">7 HARI TERAKHIR</div><h2>Aktivitas belajar</h2></div></div><div class="card weekly-chart">${[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const k=d.toISOString().slice(0,10);const count=Object.keys(progress.studyDays||{}).includes(k)?1:0;return `<div class="day-bar"><span>${d.toLocaleDateString('id-ID',{weekday:'short'}).slice(0,3)}</span><div class="day-track"><i style="height:${count?100:12}%"></i></div><small>${count?'Belajar':'-'}</small></div>`;}).join('')}</div>
  <div class="section-head"><div><div class="eyebrow">PENCAPAIAN</div><h2>Achievement</h2></div></div><div class="achievement-grid">${achievementDefs.map(a=>`<div class="achievement ${progress.achievements[a[0]]?'earned':''}"><div class="achievement-icon">${a[1].split(' ')[0]}</div><div><strong>${esc(a[1].slice(a[1].indexOf(' ')+1))}</strong><p class="muted">${esc(a[2])}</p></div><span>${progress.achievements[a[0]]?'✓':'🔒'}</span></div>`).join('')}</div>
  <div class="card focus-panel"><div class="section-head compact"><div><div class="eyebrow">FOKUS</div><h2>Latihan berikutnya</h2><p class="muted">${difficultPool(vocab).length} kosakata perlu perhatian dan ${vocab.filter(v=>(progress.wrongByWord[wordKey(v)]||0)>0).length} kosakata punya riwayat salah.</p></div></div><div class="actions"><button class="btn" data-action="quiz" data-mode="hard">🔴 Latihan Sulit</button><button class="btn" data-action="quiz" data-mode="review">📝 Review Salah</button><button class="btn" data-action="quiz" data-mode="listening">🔊 Listening</button><button class="btn" data-action="quiz" data-mode="exam">🎯 Simulasi Ujian</button></div></div><div class="actions"><button class="btn" id="exportStats">Backup Progress</button><label class="btn">Restore Progress<input id="importStats" type="file" accept="application/json" hidden></label><button class="btn" id="resetStats">Reset statistik</button></div>`;
  document.getElementById('resetStats').onclick=()=>{if(confirm('Reset statistik di perangkat ini?')){progress=typeof structuredClone==='function'?structuredClone(defaultProgress):JSON.parse(JSON.stringify(defaultProgress));save();render();toastMsg('Statistik direset');}};
  document.getElementById('exportStats').onclick=()=>{const blob=new Blob([JSON.stringify({version:DATA_VERSION,progress,settings},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='eps-topik-progress.json';a.click();URL.revokeObjectURL(a.href);};
  document.getElementById('importStats').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.progress)throw Error();progress=Object.assign({},defaultProgress,d.progress);progress.seen ||= {};progress.wrongByWord ||= {};progress.rightByWord ||= {};progress.mastered ||= {};progress.favorites ||= {};progress.achievements ||= {};progress.quizHistory ||= []; progress.studyDays ||= {}; progress.reviewDue ||= {}; progress.dailyChallenges ||= {}; progress.listening ||= 0; save();render();toastMsg('Progress berhasil dipulihkan');}catch(err){toastMsg('File progress tidak valid');}};r.readAsText(f);};
  const speechRateEl=document.getElementById('speechRate'); if(speechRateEl){speechRateEl.value=String(settings.speechRate); speechRateEl.onchange=e=>{settings.speechRate=Number(e.target.value);localStorage.setItem(SETTINGS,JSON.stringify(settings));toastMsg(`Kecepatan audio ${settings.speechRate.toFixed(2)}×`);};}
  const pauseEl=document.getElementById('listenPause'); if(pauseEl){pauseEl.value=String(settings.listeningPause); pauseEl.onchange=e=>{settings.listeningPause=Number(e.target.value);localStorage.setItem(SETTINGS,JSON.stringify(settings));toastMsg(`Jeda audio ${settings.listeningPause} ms`);};}
  bindActions();
  updateActiveNav();
}

function updateActiveNav(){document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));}
function bindActions(){
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>show('vocab',{chapter:b.dataset.open}));
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{if(b.dataset.status){state.status=b.dataset.status;if(b.dataset.status!=='Semua')state.chapter=null;} if(b.dataset.mode){state.pendingQuizMode=b.dataset.mode;} show(b.dataset.action);});
  document.querySelectorAll('[data-flash]').forEach(b=>b.onclick=()=>{state.chapter=Number(b.dataset.flash);state.flashIndex=0;state.flashShow=false;state.flashPool=null;show('flashcards');});
  document.querySelectorAll('[data-speak]').forEach(b=>b.onclick=()=>speakKorean(decodeURIComponent(b.dataset.speak)));
  document.querySelectorAll('[data-favorite]').forEach(b=>b.onclick=()=>{const key=decodeURIComponent(b.dataset.favorite);progress.favorites[key]=!progress.favorites[key];save();render();toastMsg(progress.favorites[key]?'Disimpan ke favorit':'Dihapus dari favorit');});
  document.querySelectorAll('[data-oneflash]').forEach(b=>b.onclick=()=>{const key=decodeURIComponent(b.dataset.oneflash);const found=vocab.find(v=>wordKey(v)===key);if(found){state.chapter=found.bab;state.flashPool=[found];state.flashIndex=0;state.flashShow=false;show('flashcards');}});
  document.querySelectorAll('[data-review-flash]').forEach(b=>b.onclick=()=>{const key=decodeURIComponent(b.dataset.reviewFlash);const found=vocab.find(v=>wordKey(v)===key);if(found){state.chapter=found.bab;state.flashPool=[found];state.flashIndex=0;state.flashShow=false;show('flashcards');}});
}

document.getElementById('closeInfo').onclick=closeInfoModal;
document.getElementById('closeInfoBottom').onclick=closeInfoModal;
infoModal.addEventListener('click',e=>{if(e.target===infoModal)closeInfoModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!infoModal.classList.contains('hidden'))closeInfoModal();});
init();
