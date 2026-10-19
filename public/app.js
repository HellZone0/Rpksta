// ---------- Logika dasar (dipertahankan dari versi sebelumnya) ----------
function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch (e) { localStorage.removeItem(key); return typeof structuredClone === 'function' ? structuredClone(fallback) : JSON.parse(JSON.stringify(fallback)); }
}

function esc(s) { return String(s).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }

function itemsFor(ch) { return vocab.filter(v => v.bab === ch); }

function wordKey(v) { return String(v.id ?? `${v.bab}-${v.korea}-${v.arti}`); }

function wordStats(v) {
  const key = wordKey(v);
  return { wrong: progress.wrongByWord[key] || 0, right: progress.rightByWord[key] || 0, seen: !!progress.seen[key], mastered: !!progress.mastered[key], favorite: !!progress.favorites[key] };
}

function mastery(v) {
  const s = wordStats(v);
  if (s.mastered || (s.right >= 2 && s.wrong === 0)) return 'dikuasai';
  if (s.wrong >= 2) return 'salah';
  if (s.seen || s.right > 0 || s.wrong > 0) return 'perlu';
  return 'belum';
}

function masteryLabel(v) {
  return ({ dikuasai:'Dikuasai', perlu:'Perlu latihan', salah:'Sering salah', belum:'Belum dipelajari' })[mastery(v)];
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

function difficultPool(base=vocab) { return base.filter(v => mastery(v)==='salah' || (progress.wrongByWord[wordKey(v)]||0) >= 1); }

function updateStreak() {
  const today = todayKey();
  if (progress.lastDate === today) return false;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const y = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
  progress.streak = progress.lastDate === y ? (progress.streak || 0) + 1 : 1;
  progress.lastDate = today;
  return true;
}

function recordStudyDay(){ const d=todayKey(); progress.studyDays[d]=true; updateStreak(); }

function levelInfo(xp) {
  let level = 1, name = 'Pemula', current = 0, next = 100;
  for (let i=0;i<levelData.length;i++) if (xp >= levelData[i][2]) { level=levelData[i][0]; name=levelData[i][1]; current=levelData[i][2]; next=levelData[i+1]?.[2] ?? Math.ceil((xp + 1) / 1000) * 1000; }
  return { level, name, current, next, pct: Math.min(100, Math.round(((xp-current)/Math.max(1,next-current))*100)) };
}

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
  if (after.level > before.level) toastMsg(`Level ${after.level} · ${after.name}`);
}

function speakKorean(text) {
  if (!('speechSynthesis' in window)) { toastMsg('Browser ini belum mendukung audio Korea.'); return; }
  const runId = ++speechRunId;
  speechSynthesis.cancel();

  // A slash in the source vocabulary means the Korean alternatives should be
  // pronounced separately. Speaking them as one utterance can make the
  // second word start before the first one has finished on some browsers.
  const parts = String(text).replace(/[()]/g, ' ').replace(/^\s*-+/, '')
    .split('/')
    .map(s => s.trim())
    .filter(Boolean);

  const speakPart = (index) => {
    if (runId !== speechRunId || index >= parts.length) return;
    const u = new SpeechSynthesisUtterance(parts[index]);
    u.lang = 'ko-KR';
    const kv = pickKoVoice(); if (kv) u.voice = kv;
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

function makeChoices(v,pool) {
  const result=[v], used=new Set([v.arti]);
  const candidates=pool.filter(x=>x!==v).slice().sort(()=>Math.random()-.5);
  for(const x of candidates){if(!used.has(x.arti)){result.push(x);used.add(x.arti);if(result.length===4)break;}}
  if(result.length<4) for(const x of vocab.slice().sort(()=>Math.random()-.5)){if(x!==v&&!used.has(x.arti)){result.push(x);used.add(x.arti);if(result.length===4)break;}}
  return result.sort(()=>Math.random()-.5);
}

function findAiContext(prompt) {
  const q=prompt.toLowerCase();
  const tokens=q.match(/[가-힣]{2,}/g)||[];
  const candidates=vocab.filter(v=>tokens.some(t=>v.korea.includes(t)) || q.includes(String(v.arti).toLowerCase()));
  if(candidates.length) return candidates.slice(0,8);
  const latin=q.split(/[^a-zA-ZÀ-ÿ0-9]+/).filter(x=>x.length>2);
  return vocab.filter(v=>latin.some(t=>String(v.arti).toLowerCase().includes(t))).slice(0,8);
}

function getAiChapter(userPrompt = '') {
  const explicit = String(userPrompt).match(/\bbab\s*(\d{1,2})\b/i);
  if (explicit) {
    const n = Number(explicit[1]);
    if (n >= 1 && n <= 60) return n;
  }
  const route = currentRoute();
  if (route.name === 'ai' && route.arg && /^\d+$/.test(route.arg)) {
    const n = Number(route.arg); if (n >= 1 && n <= 60) return n;
  }
  return Number(S.aiChapter || S.kq.chapter || 0) || null;
}

function buildAiPrompt(userPrompt) {
  const bab = getAiChapter(userPrompt);
  const chapter = bab ? chapters.find(c => Number(c.bab) === bab) : null;
  const chapterWords = bab ? vocab.filter(v => Number(v.bab) === bab) : [];
  const matches = findAiContext(userPrompt);
  const combined = [...chapterWords, ...matches].filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i);
  const contextText = combined.length
    ? combined.map(v => `- ${v.korea} — ${v.arti} — ${v.kategori} — Bab ${v.bab} — ${v.sumber}`).join('\n')
    : 'Tidak ada kecocokan langsung di dataset lokal.';
  const chapterInfo = chapter
    ? `Bab yang sedang dipelajari/dibahas: Bab ${chapter.bab} — ${chapter.korea} (${chapter.indonesia}).\nJumlah kosakata pada dataset bab ini: ${chapterWords.length}. Jika pengguna mengatakan “bab ini”, “bab tersebut”, atau bertanya tentang bab tanpa nomor, anggap yang dimaksud adalah Bab ${chapter.bab}, kecuali pengguna menyebut nomor bab lain secara eksplisit.`
    : 'Belum ada Bab aktif yang dipilih. Jika pengguna menyebut nomor Bab 1–60, gunakan bab tersebut. Jika pengguna bertanya “bab ini” tanpa memilih bab, tanyakan bab yang dimaksud.';
  return `Kamu adalah AI Tutor kosakata Korea untuk pelajar Indonesia yang sedang belajar EPS-TOPIK. Jawab profesional, ramah, terstruktur, dan dalam bahasa Indonesia. Pertahankan Hangul dan berikan romanisasi hanya jika membantu.\n\nATURAN UTAMA:\n- ${chapterInfo}\n- Gunakan daftar kosakata konteks sebagai sumber utama untuk arti dan kategori yang tercatat. Jangan mengarang data bab.\n- Kamu boleh menjawab kosakata Korea apa pun, termasuk yang tidak ada di Bab 1–60. Jangan menolak hanya karena kata tidak ada di dataset.\n- Jika kata ditemukan pada konteks lokal, sebutkan Bab, kategori, dan arti yang tersedia. Jika tidak ditemukan, jelaskan berdasarkan pengetahuan bahasa Korea dan jangan mengklaim berasal dari dataset.\n- Untuk contoh kalimat, berikan kalimat Korea beserta terjemahan Indonesia yang natural. Untuk perbandingan kata, jelaskan perbedaan arti, nuansa, dan penggunaan.\n- Jika pengguna meminta ringkasan/penjelasan satu Bab, prioritaskan seluruh kosakata Bab aktif yang diberikan di bawah, kelompokkan berdasarkan kategori jika berguna, dan jangan mencampur kosakata bab lain tanpa menjelaskannya.\n- Untuk pertanyaan di luar kosakata/bahasa Korea, jawab singkat lalu arahkan kembali ke pembelajaran Korea.\n\nKonteks Bab dan dataset lokal:\n${contextText}\n\nPertanyaan pengguna:\n${userPrompt}`;
}

function extractAiText(data) {
  if(typeof data==='string') return data;
  const candidates=[data?.answer,data?.response,data?.message,data?.text,data?.result,data?.content,data?.data?.answer,data?.data?.response,data?.data?.message,data?.data?.text,data?.data?.content];
  for(const x of candidates) if(typeof x==='string' && x.trim()) return x;
  if(Array.isArray(data?.choices) && data.choices[0]) return data.choices[0]?.message?.content || data.choices[0]?.text || '';
  return JSON.stringify(data,null,2);
}

async function askAiTutor(userPrompt) {
  aiBusy=true; const send=document.getElementById('aiSend'); if(send){send.disabled=true;send.textContent='Memproses…';}
  const thinking=document.createElement('div'); thinking.className='ai-message ai-message-bot ai-thinking'; thinking.id='aiThinking'; thinking.innerHTML='<strong>AI Tutor</strong><p>Sedang menyusun jawaban…</p>'; document.getElementById('aiMessages')?.appendChild(thinking);
  try {
    const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:buildAiPrompt(userPrompt)})});
    const data=await res.json().catch(()=>({error:'Respons server tidak valid.'}));
    if(!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    document.getElementById('aiThinking')?.remove(); addAiMessage('bot',extractAiText(data));
  } catch(err) {
    document.getElementById('aiThinking')?.remove(); addAiMessage('bot',`Maaf, AI tidak dapat dihubungi. Pastikan fungsi server Cloudflare sudah terpasang dan secret GEMINI_API_KEY sudah diatur.\n\nDetail: ${err.message}`);
  } finally { aiBusy=false; if(send){send.disabled=false;send.textContent='Kirim';} }
}

function addAiMessage(role, text) {
  const box=document.getElementById('aiMessages'); if(!box)return;
  const el=document.createElement('div'); el.className=`ai-message ai-message-${role==='user'?'user':'bot'}`;
  if(role==='bot') el.innerHTML=`<strong>AI Tutor</strong><div>${formatAiText(text)}</div>`; else el.innerHTML=`<div>${esc(text).replace(/\n/g,'<br>')}</div>`;
  box.appendChild(el); box.scrollTop=box.scrollHeight;
}

function formatAiText(text) {
  const source = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  if (!source) return '<p class="ai-empty">AI tidak mengirimkan teks jawaban.</p>';

  const inline = (value) => {
    let out = esc(value);
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    return out;
  };

  const lines = source.split('\n');
  const html = [];
  let paragraph = [];
  let listType = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (listType) { html.push(`</${listType}>`); listType = null; }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushParagraph(); closeList(); continue; }

    let m = line.match(/^#{1,3}\s+(.+)$/);
    if (m) { flushParagraph(); closeList(); html.push(`<h3>${inline(m[1])}</h3>`); continue; }
    m = line.match(/^[-*•]\s+(.+)$/);
    if (m) {
      flushParagraph();
      if (listType !== 'ul') { closeList(); html.push('<ul>'); listType='ul'; }
      html.push(`<li>${inline(m[1])}</li>`);
      continue;
    }
    m = line.match(/^\d+[.)]\s+(.+)$/);
    if (m) {
      flushParagraph();
      if (listType !== 'ol') { closeList(); html.push('<ol>'); listType='ol'; }
      html.push(`<li>${inline(m[1])}</li>`);
      continue;
    }
    if (/^[-=]{3,}$/.test(line)) { flushParagraph(); closeList(); html.push('<hr>'); continue; }
    closeList();
    paragraph.push(line);
  }
  flushParagraph(); closeList();
  return html.join('');
}

function accuracy() { return progress.answered ? Math.round((progress.correct || 0) / progress.answered * 100) : 0; }

const STORE = 'epsTopikProgress';

const SETTINGS = 'epsTopikSettings';

const CREATOR_SEEN = 'epsTopikCreatorSeen';

const DATA_VERSION = '20261019-v6b-buku2';

// AI Tutor memanggil fungsi server /api/ai. Kunci Gemini hanya disimpan sebagai secret server, bukan di browser.

const defaultProgress = {
  correct: 0, wrong: 0, answered: 0, xp: 0, streak: 0, lastDate: '',
  seen: {}, wrongByWord: {}, rightByWord: {}, mastered: {}, favorites: {},
  achievements: {}, quizHistory: [], studyDays: {}, listening: 0, reviewDue: {}, dailyChallenges: {}
};

const levelData = [
  [1,'Pemula',0],[2,'Pelajar',100],[3,'Pembelajar Aktif',250],[4,'Konsisten',500],[5,'Kosakata Hunter',850],
  [6,'TOPIK Learner',1300],[7,'Vocabulary Pro',1900],[8,'Korean Explorer',2700],[9,'EPS Learner',3700],[10,'Master Kandidat',5000]
];

const achievementDefs = [
  ['first_quiz','Langkah Pertama','Selesaikan 1 latihan soal.'],
  ['ten_words','10 Kosakata','Pelajari 10 kosakata.'],
  ['fifty_words','50 Kosakata','Pelajari 50 kosakata.'],
  ['hundred_words','100 Kosakata','Pelajari 100 kosakata.'],
  ['accuracy_90','Akurat','Menyelesaikan latihan dengan akurasi minimal 90%.'],
  ['streak_3','3 Hari','Memiliki streak belajar 3 hari.'],
  ['streak_7','7 Hari','Memiliki streak belajar 7 hari.'],
  ['xp_1000','1.000 XP','Mengumpulkan 1.000 XP.']
];

let speechRunId = 0;
let aiBusy = false;

// ---------- UI baru ----------

// ---------- State ----------
let chapters = [];
let vocab = [];
const view = document.getElementById('view');
const toastEl = document.getElementById('toast');
let toastTimer = null;

let progress = readJSON(STORE, defaultProgress);
progress = Object.assign({}, defaultProgress, progress);
['seen','wrongByWord','rightByWord','mastered','favorites','achievements','studyDays','reviewDue','dailyChallenges'].forEach(k => { progress[k] ||= {}; });
progress.quizHistory ||= [];
progress.listening ||= 0;

let settings = Object.assign({ theme: 'light', speechRate: 0.8, listeningPause: 650, autoplay: false }, readJSON(SETTINGS, {}));
settings.speechRate = Number(settings.speechRate) || 0.8;
document.documentElement.dataset.theme = settings.theme === 'dark' ? 'dark' : 'light';

const S = {
  quiz: null,
  result: null,
  setup: { mode: 'campuran', count: 10, chapter: '' },
  kq: { chapter: null, search: '', status: 'Semua', source: 'Semua', book: 'Semua', limit: 50 },
  deck: null,
  match: null,
  matchSetup: { chapter: '', pairs: 6 },
  aiChapter: Number(localStorage.getItem('epsTopikAiChapter') || 0) || null
};

const MODES = [
  { id: 'campuran', label: 'Campuran', desc: 'Arti dari kosakata Korea.' },
  { id: 'dengar', label: 'Dengarkan', desc: 'Dengarkan kata Korea, lalu pilih artinya.' },
  { id: 'sulit', label: 'Kata sulit', desc: 'Hanya kata yang sering salah.' },
  { id: 'ujian', label: 'Simulasi ujian', desc: 'Tanpa umpan balik sampai selesai.' }
];
const TAB_OF = { pasangkan: 'lainnya', home: 'home', bab: 'bab', kosakata: 'kosakata', latihan: 'latihan', kartu: 'lainnya', statistik: 'lainnya', ai: 'lainnya', lainnya: 'lainnya', tentang: 'lainnya' };
const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// ---------- Helpers ----------
function save() { try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch (e) {} }
function enc(s) { return encodeURIComponent(s); }
function dec(s) { return decodeURIComponent(s); }
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function fmtTime(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function dayKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function seenCount() { return Object.keys(progress.seen || {}).length; }
function chapterDone(bab) { return itemsFor(bab).filter(v => progress.seen[wordKey(v)]).length; }
function toastMsg(msg) {
  if (!toastEl) return;
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
}
function chapterOptions(selected) {
  const opt = c => `<option value="${c.bab}" ${String(selected) === String(c.bab) ? 'selected' : ''}>Bab ${c.bab} · ${esc(c.korea)}</option>`;
  return `<option value="">Semua bab</option>` + BOOKS.map(b => {
    const cs = chapters.filter(c => bookOf(c.bab) === b.id);
    return cs.length ? `<optgroup label="${b.label} · Bab ${b.from}–${b.to}">${cs.map(opt).join('')}</optgroup>` : '';
  }).join('');
}
function accuracyPct() { return progress.answered ? Math.round((progress.correct || 0) / progress.answered * 100) : 0; }

// ---------- Routing ----------
function currentRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const parts = h.split('/');
  return { name: parts[0] || 'home', arg: parts[1] || null };
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
window.addEventListener('hashchange', render);

function render() {
  if (!vocab.length) return;
  const r = currentRoute();
  const onRun = r.name === 'latihan' && r.arg === 'run';
  if (!onRun && S.quiz) { endQuizTimer(); S.quiz = null; }
  if (r.name !== 'pasangkan' && S.match) { stopMatchTimer(); S.match = null; }
  if (onRun && !S.quiz) return go('#latihan');
  if (r.name === 'latihan' && r.arg === 'result' && !S.result) return go('#latihan');

  document.querySelectorAll('[data-tab]').forEach(a => {
    const active = a.dataset.tab === (TAB_OF[r.name] || 'home');
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.body.classList.toggle('is-run', onRun);

  let html = '';
  switch (r.name) {
    case 'bab': html = babView(); break;
    case 'kosakata': S.kq.chapter = r.arg ? Number(r.arg) : null; html = kosakataView(); break;
    case 'latihan':
      html = r.arg === 'run' ? runView() : r.arg === 'result' ? resultView() : setupView();
      break;
    case 'kartu': html = kartuView(r.arg); break;
    case 'statistik': html = statsView(); break;
    case 'ai': html = aiView(); break;
    case 'lainnya': html = menuView(); break;
    case 'tentang': html = aboutView(); break;
    case 'pasangkan': html = matchView(); break;
    default: html = homeView();
  }
  view.innerHTML = html;
  if (r.name === 'kosakata') paintKList();
  if (r.name === 'latihan' && r.arg === 'run') afterRunPaint();
  if (r.name === 'kartu') autoSpeakDeck();
  window.scrollTo(0, 0);
}

// ---------- Home ----------
function homeView() {
  const w = dailySeededPool(vocab)[0];
  const done = seenCount();
  const pct = Math.round(done / vocab.length * 100);
  const next = chapters.find(c => chapterDone(c.bab) < itemsFor(c.bab).length);
  const hard = difficultPool(vocab).length;
  return `
    <section class="hero">
      <p class="kicker">Kata hari ini · Bab ${w.bab}</p>
      <p class="hero-ko">${esc(w.korea)}</p>
      <p class="hero-arti">${esc(w.arti)}</p>
      <div class="row gap">
        <button class="link" data-speak="${enc(w.korea)}">Dengarkan</button>
        <button class="link" data-act="fav" data-key="${enc(wordKey(w))}">${progress.favorites[wordKey(w)] ? 'Tersimpan' : 'Simpan'}</button>
      </div>
    </section>

    <section class="block">
      <p class="stat-big"><span class="num">${done}</span><small> dari ${vocab.length} kata</small></p>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <p class="muted">Kata yang sudah pernah kamu buka.</p>
    </section>

    <div class="actions">
      <button class="btn primary wide" data-act="quickstart">Mulai 10 soal</button>
    </div>

    <section class="list-section">
      <h2 class="sec">Lanjutkan</h2>
      ${backupReminder()}
      ${next ? `<a class="rowlink" href="#kosakata/${next.bab}"><span>Bab ${next.bab} · ${esc(next.korea)}</span><small>${chapterDone(next.bab)} dari ${itemsFor(next.bab).length}</small></a>` : ''}
      ${hard ? `<button class="rowlink" data-act="sulit"><span>Kata sulit</span><small>${hard} kata</small></button>` : ''}
      <a class="rowlink" href="#pasangkan"><span>Pasangkan kata</span><small>Permainan singkat</small></a>
      <a class="rowlink" href="#kartu" data-act="kartu"><span>Kartu belajar</span><small>Hafalkan satu per satu</small></a>
    </section>`;
}

// ---------- Bab ----------
function pdfName(bab) { return `EPS-TOPIK-Bab-${String(bab).padStart(2, '0')}-Kosakata.pdf`; }
function babView() {
  const chRow = c => {
    const total = itemsFor(c.bab).length;
    const done = chapterDone(c.bab);
    const pct = total ? Math.round(done / total * 100) : 0;
    return `<div class="chrow">
      <a class="chmain" href="#kosakata/${c.bab}">
        <span class="chnum num">${String(c.bab).padStart(2, '0')}</span>
        <span class="chtext"><b>${esc(c.korea)}</b><small>${esc(c.indonesia)}</small>
          <span class="bar thin"><i style="width:${pct}%"></i></span></span>
        <span class="chcount num">${done}/${total}</span>
      </a>
      <a class="pdflink" href="pdf/${pdfName(c.bab)}" download aria-label="Unduh PDF Bab ${c.bab}">PDF</a>
    </div>`;
  };
  const rows = BOOKS.map(b => {
    const cs = chapters.filter(c => bookOf(c.bab) === b.id);
    if (!cs.length) return '';
    const total = cs.reduce((n, c) => n + itemsFor(c.bab).length, 0);
    const done = cs.reduce((n, c) => n + chapterDone(c.bab), 0);
    return `<h2 class="sec book-head">${b.label} · Bab ${b.from}–${b.to} <small>${done}/${total} kata</small></h2>` + cs.map(chRow).join('');
  }).join('');
  return `
    <header class="pagehead"><h1>Bab</h1><p class="muted">Pilih bab untuk melihat kosakatanya, atau unduh PDF-nya.</p></header>
    <div class="chlist">${rows}</div>`;
}

// ---------- Kosakata ----------
function wordRow(v) {
  const key = wordKey(v);
  const fav = !!progress.favorites[key];
  const m = mastery(v);
  const label = { dikuasai: 'Dikuasai', perlu: 'Perlu latihan', salah: 'Sering salah', belum: 'Belum dibuka' }[m];
  return `<article class="word m-${m}">
    <div class="wmain">
      <p class="wko">${esc(v.korea)}</p>
      <p class="warti">${esc(v.arti)}</p>
      <p class="wmeta"><span>Bab ${v.bab}</span><span>${esc(v.kategori)}</span><span class="wstate">${label}</span></p>
    </div>
    <div class="wacts">
      <button class="link" data-speak="${enc(v.korea)}">Dengar</button>
      <button class="link" data-act="fav" data-key="${enc(key)}">${fav ? 'Tersimpan' : 'Simpan'}</button>
      <button class="link" data-act="flashone" data-key="${enc(key)}">Kartu</button>
      <button class="link" data-act="contoh" data-key="${enc(key)}">Contoh</button>
    </div>
    <div class="exbox" ${examples[key] && examples[key].length ? 'data-open="1"' : ''}>${exHtml(key)}</div>
  </article>`;
}
function kosakataView() {
  return `
    <header class="pagehead"><h1>Kosakata</h1><p class="muted" id="kcount"></p></header>
    ${S.kq.chapter ? `<a class="btn wide pdf-btn" href="pdf/${pdfName(S.kq.chapter)}" download>Unduh PDF Bab ${S.kq.chapter}</a>` : ''}
    <div class="filters">
      <input class="field" type="search" data-field="ksearch" placeholder="Cari kata, arti, ㄱㄴㄷ, atau bab 12" value="${esc(S.kq.search)}" autocomplete="off">
      <div class="pair">
        <label class="lbl">Bab<select class="field" data-field="kchapter">${chapterOptions(S.kq.chapter || '')}</select></label>
        <label class="lbl">Status<select class="field" data-field="kstatus">
          ${[['Semua', 'Semua'], ['belum', 'Belum dibuka'], ['perlu', 'Perlu latihan'], ['salah', 'Sering salah'], ['dikuasai', 'Dikuasai']]
            .map(([v, l]) => `<option value="${v}" ${S.kq.status === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
      </div>
      <div class="pair">
        <label class="lbl">Buku<select class="field" data-field="kbook" ${S.kq.chapter ? 'disabled' : ''}>
          ${[['Semua', 'Semua'], ['1', 'Buku 1 (Bab 1–30)'], ['2', 'Buku 2 (Bab 31–60)']]
            .map(([v, l]) => `<option value="${v}" ${S.kq.book === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
        <label class="lbl">Sumber<select class="field" data-field="ksource">
          ${[['Semua', 'Semua'], ['어휘', '어휘'], ['문화와 정보', '문화와 정보']]
            .map(([v, l]) => `<option value="${v}" ${S.kq.source === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
      </div>
    </div>
    <div id="klist" class="wordlist"></div>`;
}
function paintKList() {
  const list = kFiltered();
  const shown = list.slice(0, S.kq.limit);
  const el = document.getElementById('klist');
  const count = document.getElementById('kcount');
  if (count) count.textContent = `${list.length} kata`;
  if (!el) return;
  const more = list.length > shown.length
    ? `<div class="more"><button class="btn wide" data-act="more">Tampilkan ${Math.min(50, list.length - shown.length)} lagi</button></div>` : '';
  el.innerHTML = list.length ? shown.map(wordRow).join('') + more : `<p class="empty">Tidak ada kata yang cocok dengan filter ini.</p>`;
}

// ---------- Latihan ----------
function setupView() {
  const modes = MODES.map(m => `<button class="opt" aria-pressed="${S.setup.mode === m.id}" data-act="mode" data-val="${m.id}">
      <b>${m.label}</b><span>${m.desc}</span></button>`).join('');
  const counts = [10, 20, 30, 50].map(n => `<button class="seg-btn" aria-pressed="${S.setup.count === n}" data-act="count" data-val="${n}">${n}</button>`).join('');
  return `
    <header class="pagehead"><h1>Latihan</h1><p class="muted">Pilih mode, lalu mulai.</p></header>
    <h2 class="sec">Mode</h2>
    <div class="options">${modes}</div>
    <h2 class="sec">Jumlah soal</h2>
    <div class="seg">${counts}</div>
    <label class="lbl top">Bab<select class="field" data-field="lchapter">${chapterOptions(S.setup.chapter)}</select></label>
    <div class="actions"><button class="btn primary wide" data-act="start">Mulai</button></div>`;
}
function runView() {
  const q = S.quiz;
  const v = q.pool[q.i];
  if (!q.choices) q.choices = makeChoices(v, q.pool);
  const timer = q.exam ? `<span class="num" id="qtimer">${fmtTime(q.deadline - Date.now())}</span>` : '';
  const question = q.mode === 'dengar'
    ? `<p class="qlabel">Dengarkan, lalu pilih artinya</p><button class="link big-link" data-speak="${enc(v.korea)}">Putar lagi</button>`
    : `<p class="qko">${esc(v.korea)}</p><p class="qlabel">Pilih arti yang benar</p>`;
  const choices = q.choices.map(c => {
    const isRight = c.arti === v.arti;
    let state = '';
    if (q.locked && !q.exam) { if (isRight) state = 'right'; else if (q.tried.includes(c.arti)) state = 'wrong'; }
    else if (q.tried.includes(c.arti) && !q.exam) state = 'wrong';
    const disabled = q.locked || (q.tried.includes(c.arti) && !q.exam);
    return `<button class="choice ${state}" data-act="answer" data-val="${enc(c.arti)}" ${disabled ? 'disabled' : ''}>${esc(c.arti)}</button>`;
  }).join('');
  let feedback = '';
  if (q.feedback && !q.exam) {
    feedback = `<div class="fb fb-${q.feedback.type}"><p>${esc(q.feedback.title)}</p>${q.feedback.answer ? `<p class="fb-ans">${esc(q.feedback.answer)}</p>` : ''}</div>`;
  }
  const next = q.locked && !q.exam ? `<button class="btn primary wide" data-act="next">${q.i + 1 >= q.n ? 'Lihat hasil' : 'Lanjut'}</button>` : '';
  return `
    <div class="runhead">
      <span class="num">Soal ${q.i + 1} dari ${q.n}</span>
      ${timer}
      <button class="link" data-act="quit">Keluar</button>
    </div>
    <div class="bar thin"><i style="width:${Math.round(q.i / q.n * 100)}%"></i></div>
    <section class="question">${question}</section>
    <div class="choices">${choices}</div>
    ${feedback}
    <div class="actions">${next}</div>`;
}
function afterRunPaint() {
  const q = S.quiz;
  if (!q) return;
  if (q.mode === 'dengar' && q.spokenFor !== q.i) {
    q.spokenFor = q.i;
    speakKorean(q.pool[q.i].korea);
  }
}
function resultView() {
  const r = S.result;
  const newly = (r.newly || []).map(id => achievementDefs.find(d => d[0] === id)?.[1]).filter(Boolean);
  const review = r.review.length ? `
    <h2 class="sec">Kata yang perlu diulang</h2>
    <div class="wordlist">${r.review.map(x => `<article class="word m-salah">
      <div class="wmain"><p class="wko">${esc(x.korea)}</p><p class="warti">${esc(x.answer)}</p>
      <p class="wmeta"><span>Bab ${x.bab}</span>${x.mine ? `<span>Kamu pilih: ${esc(x.mine)}</span>` : ''}</p></div>
      <div class="wacts"><button class="link" data-speak="${enc(x.korea)}">Dengar</button></div>
    </article>`).join('')}</div>` : '';
  return `
    <section class="result">
      <p class="kicker">Hasil latihan</p>
      <p class="result-num num">${r.pct}%</p>
      <p>${r.score} benar dari ${r.n} soal</p>
      <p class="muted">${r.wrong} jawaban salah</p>
      ${newly.length ? `<p class="achv-new">Pencapaian baru: ${newly.map(esc).join(', ')}</p>` : ''}
    </section>
    <div class="actions col">
      <button class="btn primary wide" data-act="retry">Coba lagi</button>
      <a class="btn wide" href="#latihan">Ubah pengaturan</a>
      <a class="btn wide" href="#home">Ke beranda</a>
    </div>
    ${review}`;
}

// ---------- Quiz engine ----------
function startQuiz(mode, count, chapter) {
  let base = chapter ? itemsFor(chapter) : vocab.slice();
  if (mode === 'sulit') {
    base = difficultPool(base);
    if (!base.length) { toastMsg('Belum ada kata sulit.'); return; }
  }
  const pool = shuffle(base).slice(0, Math.min(count, base.length));
  endQuizTimer();
  S.quiz = {
    mode, pool, n: pool.length, i: 0, score: 0, wrong: 0,
    attempts: 0, tried: [], locked: false, feedback: null, choices: null,
    review: [], exam: mode === 'ujian', chapter, count, spokenFor: -1,
    deadline: mode === 'ujian' ? Date.now() + pool.length * 45000 : 0, timerId: null
  };
  recordStudyDay();
  save();
  go('#latihan/run');
  if (S.quiz.exam) startQuizTimer();
}
function startQuizTimer() {
  endQuizTimer();
  S.quiz.timerId = setInterval(() => {
    const q = S.quiz;
    if (!q || !q.exam) return;
    const left = q.deadline - Date.now();
    const el = document.getElementById('qtimer');
    if (el) el.textContent = fmtTime(left);
    if (left <= 0) finishQuiz();
  }, 1000);
}
function endQuizTimer() { if (S.quiz && S.quiz.timerId) { clearInterval(S.quiz.timerId); S.quiz.timerId = null; } }
function resetQuestion(q) { q.attempts = 0; q.tried = []; q.locked = false; q.feedback = null; q.choices = null; }

function answerQuiz(choice) {
  const q = S.quiz;
  if (!q || q.locked) return;
  const v = q.pool[q.i];
  const key = wordKey(v);
  const ok = choice === v.arti;

  if (q.exam) {
    progress.answered = (progress.answered || 0) + 1;
    progress.seen[key] = true;
    if (ok) {
      progress.correct = (progress.correct || 0) + 1;
      progress.rightByWord[key] = (progress.rightByWord[key] || 0) + 1;
      markReviewSchedule(v, true, 1);
      q.score++;
    } else {
      progress.wrong = (progress.wrong || 0) + 1;
      progress.wrongByWord[key] = (progress.wrongByWord[key] || 0) + 1;
      markReviewSchedule(v, false, 1);
      q.wrong++;
      q.review.push({ ...v, mine: choice, answer: v.arti });
    }
    save();
    q.i++; resetQuestion(q);
    if (q.i >= q.n) return finishQuiz();
    return render();
  }

  q.attempts++;
  q.tried.push(choice);
  if (ok) {
    q.locked = true;
    progress.answered = (progress.answered || 0) + 1;
    progress.correct = (progress.correct || 0) + 1;
    progress.seen[key] = true;
    progress.rightByWord[key] = (progress.rightByWord[key] || 0) + 1;
    markReviewSchedule(v, true, q.attempts);
    if (q.attempts === 1) q.score++;
    awardXp(q.attempts === 1 ? 10 : 4);
    q.feedback = { type: 'correct', title: q.attempts === 1 ? 'Benar' : 'Benar di percobaan kedua' };
  } else if (q.attempts >= 2) {
    q.locked = true;
    q.wrong++;
    progress.answered = (progress.answered || 0) + 1;
    progress.seen[key] = true;
    progress.wrong = (progress.wrong || 0) + 1;
    progress.wrongByWord[key] = (progress.wrongByWord[key] || 0) + 1;
    markReviewSchedule(v, false, 2);
    q.review.push({ ...v, mine: choice, answer: v.arti });
    q.feedback = { type: 'final', title: 'Jawaban yang benar', answer: v.arti };
  } else {
    progress.wrong = (progress.wrong || 0) + 1;
    progress.wrongByWord[key] = (progress.wrongByWord[key] || 0) + 1;
    q.feedback = { type: 'retry', title: 'Belum tepat. Coba sekali lagi.' };
  }
  save();
  render();
}
function nextQuestion() {
  const q = S.quiz;
  if (!q) return;
  q.i++; resetQuestion(q);
  if (q.i >= q.n) return finishQuiz();
  render();
}
function finishQuiz() {
  const q = S.quiz;
  if (!q) return;
  endQuizTimer();
  const pct = q.n ? Math.round(q.score / q.n * 100) : 0;
  progress.quizHistory.push({ date: new Date().toISOString(), score: q.score, total: q.n, mode: q.mode });
  const newly = checkAchievements(pct);
  save();
  S.result = { pct, score: q.score, n: q.n, wrong: q.wrong, review: q.review, newly, mode: q.mode, chapter: q.chapter, count: q.count };
  S.quiz = null;
  go('#latihan/result');
}

// ---------- Kartu ----------
function kartuView(arg) {
  const key = arg ? `ch-${arg}` : 'all';
  if (!S.deck || (S.deck.key !== key && !S.deck.single)) {
    const base = arg ? itemsFor(Number(arg)) : vocab;
    S.deck = { key, single: false, pool: shuffle(base), i: 0, open: false, label: arg ? `Bab ${arg}` : 'Semua bab' };
  }
  const d = S.deck;
  if (!d.pool.length) return `<p class="empty">Belum ada kartu.</p>`;
  const v = d.pool[d.i];
  return `
    <header class="pagehead"><h1>Kartu belajar</h1><p class="muted">${esc(d.label)} · ${d.i + 1} dari ${d.pool.length}</p></header>
    <section class="flash ${d.open ? 'open' : ''}">
      <p class="flash-ko">${esc(v.korea)}</p>
      ${d.open
        ? `<p class="flash-arti">${esc(v.arti)}</p><p class="muted">Bab ${v.bab} · ${esc(v.kategori)}</p>`
        : `<button class="btn wide" data-act="reveal">Lihat arti</button>`}
    </section>
    ${d.open
      ? `<div class="grid2">
          <button class="btn" data-act="unknown">Belum hafal</button>
          <button class="btn primary" data-act="known">Sudah hafal</button>
        </div>`
      : ''}
    <div class="row gap center">
      <button class="link" data-speak="${enc(v.korea)}">Dengar</button>
      <button class="link" data-act="contoh" data-key="${enc(wordKey(v))}">Contoh</button>
      <button class="link" data-act="skip">Lewati</button>
    </div>
    <div class="exbox" ${examples[wordKey(v)] && examples[wordKey(v)].length ? 'data-open="1"' : ''}>${exHtml(wordKey(v))}</div>`;
}
function deckAdvance() { const d = S.deck; d.i = (d.i + 1) % d.pool.length; d.open = false; render(); }

// ---------- Statistik ----------
function statsView() {
  const lvl = levelInfo(progress.xp || 0);
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ label: DAY_NAMES[d.getDay()], on: !!progress.studyDays[dayKey(d)] }); }
  const earned = earnedAchievements().length;
  return `
    <header class="pagehead"><h1>Statistik</h1><p class="muted">Tersimpan di perangkat ini.</p></header>
    <dl class="stats">
      <div><dt>Soal dijawab</dt><dd class="num">${progress.answered || 0}</dd></div>
      <div><dt>Jawaban benar</dt><dd class="num">${progress.correct || 0}</dd></div>
      <div><dt>Akurasi</dt><dd class="num">${accuracyPct()}%</dd></div>
      <div><dt>Kata dibuka</dt><dd class="num">${seenCount()}</dd></div>
      <div><dt>XP</dt><dd class="num">${progress.xp || 0}</dd></div>
      <div><dt>Level</dt><dd>${lvl.level} · ${esc(lvl.name)}</dd></div>
      <div><dt>Streak</dt><dd class="num">${progress.streak || 0} hari</dd></div>
      <div><dt>Pencapaian</dt><dd class="num">${earned}/${achievementDefs.length}</dd></div>
    </dl>
    <h2 class="sec">7 hari terakhir</h2>
    <div class="week">${days.map(d => `<div><i class="${d.on ? 'on' : ''}"></i><span>${d.label}</span></div>`).join('')}</div>
    <h2 class="sec">Pencapaian</h2>
    <ul class="achv">${achievementDefs.map(([id, name, desc]) => `<li class="${progress.achievements[id] ? 'on' : ''}"><b>${esc(name)}</b><span>${esc(desc)}</span></li>`).join('')}</ul>
    <h2 class="sec">Data</h2>
    <p class="muted">${backupInfo()} Cadangan memuat progres, pengaturan, dan contoh kalimat.</p>
    <div class="actions col">
      <button class="btn wide" data-act="export">Unduh data</button>
      <label class="btn wide file-btn">Pulihkan dari file<input type="file" accept="application/json" data-field="import" hidden></label>
      <button class="btn wide danger" data-act="reset">Reset statistik</button>
    </div>`;
}
// ---------- Lainnya / Tentang ----------
function menuView() {
  return `
    <header class="pagehead"><h1>Lainnya</h1></header>
    <nav class="menu">
      <a href="#kartu" data-act="kartu"><b>Kartu belajar</b><span>Hafalkan kata satu per satu</span></a>
      <a href="#pasangkan"><b>Pasangkan kata</b><span>Permainan mencocokkan kata dan arti</span></a>
      <a href="#statistik"><b>Statistik</b><span>Progres, pencapaian, dan data</span></a>
      <a href="#ai"><b>AI Tutor</b><span>Tanya arti dan contoh kalimat</span></a>
      <button data-act="theme"><b>Tampilan ${settings.theme === 'dark' ? 'gelap' : 'terang'}</b><span>Ketuk untuk mengganti</span></button>
      <button data-act="autoplay"><b>Putar suara otomatis: ${settings.autoplay ? 'aktif' : 'mati'}</b><span>Di kartu belajar dan permainan pasangkan</span></button>
      <button data-act="rate"><b>Kecepatan suara: ${settings.speechRate <= 0.65 ? 'lambat' : settings.speechRate >= 0.95 ? 'cepat' : 'normal'}</b><span>Ketuk untuk mengganti, lalu dengar contohnya</span></button>
      <a href="#tentang"><b>Tentang aplikasi</b><span>Pembuat dan kontak</span></a>
    </nav>`;
}
function aboutView() {
  return `
    <header class="pagehead"><h1>Tentang</h1></header>
    <p>Aplikasi latihan kosakata EPS-TOPIK Bab 1–60. Dibuat oleh Muhammad Ahda.</p>
    <p class="muted">Terima kasih sudah menggunakan aplikasi ini. Selamat belajar.</p>
    <nav class="menu">
      <a href="https://www.instagram.com/minns0" target="_blank" rel="noopener noreferrer"><b>Instagram</b><span>@minns0</span></a>
      <a href="https://www.tiktok.com/@arexsyy" target="_blank" rel="noopener noreferrer"><b>TikTok</b><span>@arexsyy</span></a>
    </nav>`;
}

// ---------- AI Tutor ----------
function aiView() {
  const examples = ['Apa arti 먹다?', 'Beri contoh kalimat dengan 배탈이 나다', 'Apa beda 누나 dan 언니?'];
  const route = currentRoute();
  const fromRoute = route.arg && /^\d+$/.test(route.arg) ? Number(route.arg) : null;
  const selected = fromRoute || S.aiChapter || S.kq.chapter || null;
  if (selected) S.aiChapter = selected;
  const chapterLabel = selected ? chapters.find(c => Number(c.bab) === Number(selected)) : null;
  return `
    <header class="pagehead"><h1>AI Tutor</h1><p class="muted">AI memahami Bab yang dipilih, judul bab, kategori, dan kosakata dari bab tersebut.</p></header>
    <label class="field-label" for="aiChapterSelect">Bab yang sedang dibahas</label>
    <select id="aiChapterSelect" class="field" data-field="aichapter"><option value="">Pilih Bab (belum dipilih)</option>${chapters.map(c => `<option value="${c.bab}" ${Number(selected)===Number(c.bab)?'selected':''}>Bab ${c.bab} · ${esc(c.indonesia || c.korea)}</option>`).join('')}</select>
    <p id="aiChapterContext" class="muted">${chapterLabel ? `Konteks aktif: Bab ${chapterLabel.bab} — ${esc(chapterLabel.korea)} (${esc(chapterLabel.indonesia)}). Kamu bisa bertanya “ringkas bab ini” atau “jelaskan kosakata bab ini”.` : 'Pilih Bab agar AI memahami maksud “bab ini”. Kamu juga bisa menyebut nomor bab langsung di pertanyaan.'}</p>
    <div class="chips">${examples.map(p => `<button class="chip" data-act="aiprompt" data-val="${enc(p)}">${esc(p)}</button>`).join('')}</div>
    <div id="aiMessages" class="thread">
      <div class="ai-message ai-message-bot"><strong>AI Tutor</strong><p>Halo! Pilih Bab yang sedang kamu pelajari agar saya bisa menjawab berdasarkan judul dan kosakata Bab tersebut.</p></div>
    </div>
    <form id="aiForm" class="ask">
      <textarea id="aiPrompt" class="field" rows="3" maxlength="1200" placeholder="Contoh: Jelaskan kosakata penting di bab ini…"></textarea>
      <button class="btn primary" id="aiSend" type="submit">Kirim</button>
    </form>`;
}

// ==== FITUR-V6 START ====
// ---------- Buku ----------
const BOOKS = [{ id: 1, from: 1, to: 30, label: 'Buku 1' }, { id: 2, from: 31, to: 60, label: 'Buku 2' }];
function bookOf(bab) { return bab > 30 ? 2 : 1; }

// ---------- Pencarian cerdas ----------
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
function normSearch(s) { return String(s || '').toLowerCase().normalize('NFC').replace(/[\s·.,;:!?()\[\]{}"'`~\-_/\\]+/g, ''); }
function chosungOf(s) {
  let o = '';
  for (const ch of String(s)) {
    const c = ch.charCodeAt(0);
    if (c >= 0xAC00 && c <= 0xD7A3) o += CHO[Math.floor((c - 0xAC00) / 588)];
    else if (/[ㄱ-ㅎ]/.test(ch)) o += ch;
    else if (/[a-z0-9]/i.test(ch)) o += ch.toLowerCase();
  }
  return o;
}
function lev1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
}
function parseSearch(raw) {
  let q = String(raw || '').toLowerCase().normalize('NFC');
  const f = { bab: null, buku: null };
  q = q.replace(/\bbuku\s*([12])\b/g, (_, n) => { f.buku = Number(n); return ' '; });
  q = q.replace(/\bbab\s*(\d{1,2})\b/g, (_, n) => { f.bab = Number(n); return ' '; });
  return { tokens: q.split(/\s+/).filter(Boolean), f };
}
function tokenScore(v, t, ctx) {
  const nt = normSearch(t); if (!nt) return 1;
  const nk = ctx.nk, na = ctx.na;
  if (nk === nt) return 100;
  if (nk.startsWith(nt)) return 80;
  if (/^[ㄱ-ㅎ]+$/.test(t)) {
    const ck = ctx.ck;
    if (ck.startsWith(t)) return 65;
    if (ck.includes(t)) return 45;
    return 0;
  }
  if (nk.includes(nt)) return 60;
  const words = ctx.words;
  if (words.includes(nt)) return 70;
  if (words.some(w => w.startsWith(nt))) return 55;
  if (na.includes(nt)) return 40;
  if (ctx.meta.includes(nt)) return 20;
  if (ctx.fuzzy && nt.length >= 5 && words.some(w => w.length >= 4 && lev1(w, nt))) return 25;
  return 0;
}
function searchScore(v, parsed) {
  const { tokens, f } = parsed;
  if (f.bab && v.bab !== f.bab) return 0;
  if (f.buku && bookOf(v.bab) !== f.buku) return 0;
  if (!tokens.length) return 1;
  const c = chapters[v.bab - 1] || {};
  const ctx = {
    nk: normSearch(v.korea), na: normSearch(v.arti), ck: chosungOf(v.korea),
    words: String(v.arti).toLowerCase().split(/[^a-zà-ÿ0-9]+/).filter(Boolean),
    meta: normSearch([v.kategori, c.korea, c.indonesia].join(' ')), fuzzy: !!parsed.fuzzy
  };
  let total = 0;
  for (const t of tokens) { const s = tokenScore(v, t, ctx); if (!s) return 0; total += s; }
  return total;
}

// ---------- Suara ----------
function pickKoVoice() {
  try { const vs = speechSynthesis.getVoices(); return vs.find(v => /^ko[-_]KR$/i.test(v.lang)) || vs.find(v => /^ko/i.test(v.lang)) || null; } catch (e) { return null; }
}
function saveSettings() { try { localStorage.setItem(SETTINGS, JSON.stringify(settings)); } catch (e) {} }
function autoSpeakDeck() {
  const d = S.deck; if (!settings.autoplay || !d || !d.pool.length) return;
  const tag = d.key + ':' + d.i; if (d.spoken === tag) return;
  d.spoken = tag; speakKorean(d.pool[d.i].korea);
}

// ---------- Contoh kalimat ----------
const EX_STORE = 'epsTopikExamples';
let examples = readJSON(EX_STORE, {});
const exBusy = new Set();
function saveExamples() { try { localStorage.setItem(EX_STORE, JSON.stringify(examples)); } catch (e) {} }
function exHtml(key) {
  const list = examples[key];
  if (!Array.isArray(list) || !list.length) return '';
  return list.map(x => `<div class="ex-item"><p class="ex-ko">${esc(x.ko)} <button class="link" data-speak="${enc(x.ko)}">Dengar</button></p><p class="ex-id">${esc(x.id)}</p></div>`).join('')
    + '<p class="muted ex-note">Contoh dibuat AI, bisa keliru. Cek lagi bila ragu.</p>';
}
function parseExamples(text) {
  const m = String(text).match(/\[[\s\S]*\]/); if (!m) return [];
  let arr; try { arr = JSON.parse(m[0]); } catch (e) { return []; }
  return (Array.isArray(arr) ? arr : []).filter(x => x && typeof x.ko === 'string' && /[가-힣]/.test(x.ko) && typeof x.id === 'string' && x.id.trim())
    .slice(0, 3).map(x => ({ ko: x.ko.trim().slice(0, 120), id: x.id.trim().slice(0, 160) }));
}
async function fetchExamples(v) {
  const prompt = `Buat 2 contoh kalimat bahasa Korea yang pendek dan sederhana (level pemula EPS-TOPIK, bentuk sopan) yang memakai kata/ungkapan "${v.korea}" (arti: ${v.arti}). Jawab HANYA dengan JSON array tanpa teks lain, tanpa markdown, format: [{"ko":"kalimat Korea","id":"terjemahan Indonesia"}]`;
  const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
  const list = parseExamples(extractAiText(data));
  if (!list.length) throw new Error('format');
  return list;
}
async function toggleExamples(t) {
  const key = dec(t.dataset.key);
  const v = vocab.find(x => wordKey(x) === key); if (!v) return;
  const root = t.closest('.word') || document;
  const box = root.querySelector('.exbox'); if (!box) return;
  if (box.dataset.open === '1') { box.innerHTML = ''; box.dataset.open = ''; return; }
  if (examples[key] && examples[key].length) { box.innerHTML = exHtml(key); box.dataset.open = '1'; return; }
  if (exBusy.has(key)) return;
  exBusy.add(key); box.dataset.open = '1'; box.innerHTML = '<p class="muted">Membuat contoh kalimat…</p>';
  try {
    examples[key] = await fetchExamples(v); saveExamples();
    box.innerHTML = exHtml(key);
  } catch (e) {
    box.innerHTML = '<p class="muted">Contoh belum bisa dibuat (perlu internet dan AI aktif). Coba lagi nanti.</p>'; box.dataset.open = '';
  } finally { exBusy.delete(key); }
}

// ---------- Cadangan ----------
function backupReminder() {
  if (seenCount() < 20) return '';
  const last = progress.lastBackup || 0;
  if (last && Date.now() - last < 7 * 86400000) return '';
  const info = last ? `Terakhir ${Math.floor((Date.now() - last) / 86400000)} hari lalu` : 'Belum pernah dicadangkan';
  return `<a class="rowlink" href="#statistik"><span>Cadangkan progres</span><small>${info}</small></a>`;
}
function backupInfo() {
  const last = progress.lastBackup;
  if (!last) return 'Cadangan terakhir: belum pernah.';
  const d = Math.floor((Date.now() - last) / 86400000);
  return `Cadangan terakhir: ${d === 0 ? 'hari ini' : d + ' hari lalu'}.`;
}
function mergeProgress(a, b) {
  const out = Object.assign({}, a);
  for (const k of ['correct', 'wrong', 'answered', 'xp', 'streak', 'listening', 'matchPlayed']) out[k] = Math.max(a[k] || 0, b[k] || 0);
  out.lastDate = [a.lastDate || '', b.lastDate || ''].sort().pop();
  for (const k of ['seen', 'mastered', 'favorites', 'achievements', 'studyDays', 'dailyChallenges']) out[k] = Object.assign({}, a[k] || {}, b[k] || {});
  for (const k of ['wrongByWord', 'rightByWord']) { out[k] = Object.assign({}, a[k] || {}); for (const [w, n] of Object.entries(b[k] || {})) out[k][w] = Math.max(out[k][w] || 0, n || 0); }
  out.reviewDue = Object.assign({}, a.reviewDue || {}); for (const [w, n] of Object.entries(b.reviewDue || {})) out.reviewDue[w] = out.reviewDue[w] ? Math.min(out.reviewDue[w], n) : n;
  const seenH = new Set(); out.quizHistory = (a.quizHistory || []).concat(b.quizHistory || []).filter(x => { const s = JSON.stringify(x); if (seenH.has(s)) return false; seenH.add(s); return true; }).slice(-100);
  const mb = Object.assign({}, a.matchBest || {}); for (const [p, r] of Object.entries(b.matchBest || {})) { const o = mb[p]; if (!o || r.sec < o.sec || (r.sec === o.sec && r.moves < o.moves)) mb[p] = r; }
  out.matchBest = mb;
  out.lastBackup = Math.max(a.lastBackup || 0, b.lastBackup || 0) || undefined;
  return out;
}
function importFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result);
      if (!d.progress || typeof d.progress !== 'object') throw new Error('format');
      const incoming = Object.assign({}, defaultProgress, d.progress);
      const hasData = seenCount() > 0 || (progress.answered || 0) > 0;
      const merge = hasData && confirm('Gabungkan cadangan ini dengan data di perangkat?\n\nOK = gabungkan (data lama tetap aman)\nBatal = ganti total dengan isi cadangan');
      progress = merge ? mergeProgress(progress, incoming) : incoming;
      ['seen','wrongByWord','rightByWord','mastered','favorites','achievements','studyDays','reviewDue','dailyChallenges'].forEach(k => { progress[k] ||= {}; });
      progress.quizHistory ||= [];
      if (d.examples && typeof d.examples === 'object') { examples = merge ? Object.assign({}, d.examples, examples) : d.examples; saveExamples(); }
      if (!merge && d.settings && typeof d.settings === 'object') {
        if (d.settings.theme === 'dark' || d.settings.theme === 'light') settings.theme = d.settings.theme;
        if (Number(d.settings.speechRate)) settings.speechRate = Number(d.settings.speechRate);
        settings.autoplay = !!d.settings.autoplay;
        document.documentElement.dataset.theme = settings.theme; saveSettings();
      }
      save(); render(); toastMsg(merge ? 'Data digabungkan.' : 'Data berhasil dipulihkan.');
    } catch (e) { toastMsg('File tidak valid.'); }
  };
  reader.readAsText(file);
}

// ---------- Pencarian di daftar kosakata ----------
function kFiltered() {
  let base = (S.kq.chapter ? itemsFor(S.kq.chapter) : vocab).filter(v => S.kq.source === 'Semua' || v.sumber === S.kq.source);
  if (!S.kq.chapter && S.kq.book !== 'Semua') base = base.filter(v => bookOf(v.bab) === Number(S.kq.book));
  if (S.kq.status !== 'Semua') base = base.filter(v => mastery(v) === S.kq.status);
  const parsed = parseSearch(S.kq.search);
  if (!parsed.tokens.length && !parsed.f.bab && !parsed.f.buku) return base;
  let scored = [];
  const collect = () => { scored = []; base.forEach((v, i) => { const s = searchScore(v, parsed); if (s > 0) scored.push([s, i, v]); }); };
  collect();
  if (!scored.length && parsed.tokens.length) { parsed.fuzzy = true; collect(); }
  if (parsed.tokens.length) scored.sort((x, y) => y[0] - x[0] || x[1] - y[1]);
  return scored.map(x => x[2]);
}
// ==== FITUR-V6 END ====

// ---------- Actions ----------
const handlers = {
  quickstart() { startQuiz('campuran', 10, null); },
  sulit() { startQuiz('sulit', 10, null); },
  start() { startQuiz(S.setup.mode, S.setup.count, S.setup.chapter ? Number(S.setup.chapter) : null); },
  mode(t) { S.setup.mode = t.dataset.val; render(); },
  count(t) { S.setup.count = Number(t.dataset.val); render(); },
  answer(t) { answerQuiz(dec(t.dataset.val)); },
  next() { nextQuestion(); },
  quit() { if (confirm('Keluar dari latihan ini? Progres soal yang belum selesai tidak disimpan.')) { endQuizTimer(); S.quiz = null; go('#latihan'); } },
  retry() { const r = S.result; startQuiz(r.mode, r.count, r.chapter); },
  more() { S.kq.limit += 50; paintKList(); },
  fav(t) {
    const k = dec(t.dataset.key);
    progress.favorites[k] = !progress.favorites[k];
    save(); render();
    toastMsg(progress.favorites[k] ? 'Disimpan.' : 'Dihapus dari simpanan.');
  },
  flashone(t) {
    const k = dec(t.dataset.key);
    const v = vocab.find(x => wordKey(x) === k);
    if (!v) return;
    S.deck = { key: 'one', single: true, pool: [v], i: 0, open: false, label: `Bab ${v.bab}` };
    go('#kartu');
  },
  kartu() { S.deck = null; },
  reveal() { S.deck.open = true; render(); },
  known() {
    const d = S.deck; const v = d.pool[d.i]; const key = wordKey(v);
    progress.seen[key] = true;
    progress.rightByWord[key] = (progress.rightByWord[key] || 0) + 1;
    progress.answered = (progress.answered || 0) + 1;
    progress.correct = (progress.correct || 0) + 1;
    awardXp(3); recordStudyDay(); checkAchievements(); save();
    deckAdvance();
  },
  unknown() {
    const d = S.deck; const v = d.pool[d.i]; const key = wordKey(v);
    progress.seen[key] = true;
    progress.wrongByWord[key] = (progress.wrongByWord[key] || 0) + 1;
    progress.answered = (progress.answered || 0) + 1;
    save(); deckAdvance();
  },
  skip() { deckAdvance(); },
  theme() {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = settings.theme;
    try { localStorage.setItem(SETTINGS, JSON.stringify(settings)); } catch (e) {}
    render();
  },
  export() {
    progress.lastBackup = Date.now(); save();
    const blob = new Blob([JSON.stringify({ app: 'eps-topik', version: 2, progress, settings: { theme: settings.theme, speechRate: settings.speechRate, autoplay: !!settings.autoplay }, examples, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `eps-topik-progres-${dayKey(new Date())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  reset() {
    if (!confirm('Reset semua statistik di perangkat ini?')) return;
    progress = JSON.parse(JSON.stringify(defaultProgress));
    ['seen','wrongByWord','rightByWord','mastered','favorites','achievements','studyDays','reviewDue','dailyChallenges'].forEach(k => { progress[k] ||= {}; });
    progress.quizHistory = [];
    save(); render(); toastMsg('Statistik direset.');
  },
  mpairs(t) { S.matchSetup.pairs = Number(t.dataset.val); render(); },
  mstart() {
    const ch = S.matchSetup.chapter ? Number(S.matchSetup.chapter) : null;
    const m = buildMatch(ch, S.matchSetup.pairs);
    if (!m) { toastMsg('Kata di bab ini belum cukup. Pilih bab lain.'); return; }
    stopMatchTimer();
    S.match = m;
    startMatchTimer();
    go('#pasangkan');
  },
  mtile(t) { matchTile(Number(t.dataset.val)); },
  mquit() { if (confirm('Keluar dari permainan ini?')) { stopMatchTimer(); S.match = null; render(); } },
  mreset() { stopMatchTimer(); S.match = null; render(); },
  contoh(t) { toggleExamples(t); },
  autoplay() { settings.autoplay = !settings.autoplay; saveSettings(); render(); toastMsg(settings.autoplay ? 'Suara otomatis aktif.' : 'Suara otomatis mati.'); },
  rate() {
    const rates = [0.6, 0.8, 1.0]; const i = rates.findIndex(r => Math.abs(r - settings.speechRate) < 0.05);
    settings.speechRate = rates[(i + 1) % rates.length]; saveSettings(); render(); speakKorean('안녕하세요');
  },
  aiprompt(t) { const i = document.getElementById('aiPrompt'); if (i) { i.value = dec(t.dataset.val); i.focus(); } }
};

document.addEventListener('click', e => {
  const sp = e.target.closest('[data-speak]');
  if (sp) { speakKorean(dec(sp.dataset.speak)); return; }
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const fn = handlers[t.dataset.act];
  if (fn) { if (t.tagName !== 'A') e.preventDefault(); fn(t); }
});
document.addEventListener('input', e => {
  if (e.target.dataset.field === 'ksearch') {
    clearTimeout(document._kTimer);
    const val = e.target.value;
    document._kTimer = setTimeout(() => { S.kq.search = val; S.kq.limit = 50; paintKList(); }, 160);
  }
});
document.addEventListener('change', e => {
  const f = e.target.dataset.field;
  if (f === 'kchapter') go(`#kosakata${e.target.value ? '/' + e.target.value : ''}`);
  else if (f === 'kstatus') { S.kq.status = e.target.value; S.kq.limit = 50; paintKList(); }
  else if (f === 'kbook') { S.kq.book = e.target.value; S.kq.limit = 50; paintKList(); }
  else if (f === 'ksource') { S.kq.source = e.target.value; S.kq.limit = 50; paintKList(); }
  else if (f === 'lchapter') S.setup.chapter = e.target.value;
  else if (f === 'mchapter') S.matchSetup.chapter = e.target.value;
  else if (f === 'aichapter') { S.aiChapter = e.target.value ? Number(e.target.value) : null; if (S.aiChapter) localStorage.setItem('epsTopikAiChapter', String(S.aiChapter)); else localStorage.removeItem('epsTopikAiChapter'); const c = chapters.find(x => Number(x.bab) === Number(S.aiChapter)); const note = document.getElementById('aiChapterContext'); if (note) note.textContent = c ? `Konteks aktif: Bab ${c.bab} — ${c.korea} (${c.indonesia}). Kamu bisa bertanya “ringkas bab ini” atau “jelaskan kosakata bab ini”.` : 'Pilih Bab agar AI memahami maksud “bab ini”. Kamu juga bisa menyebut nomor bab langsung di pertanyaan.'; }
  else if (f === 'import') importFile(e.target.files[0]);
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'aiForm') return;
  e.preventDefault();
  const input = document.getElementById('aiPrompt');
  const prompt = input.value.trim();
  if (!prompt || aiBusy) return;
  addAiMessage('user', prompt);
  input.value = '';
  askAiTutor(prompt);
});

// ---------- Pasangkan kata (permainan) ----------
function buildMatch(chapter, pairs) {
  let base = chapter ? itemsFor(chapter) : vocab;
  const short = base.filter(v => v.arti.length <= 24 && v.korea.length <= 10);
  if (short.length >= pairs) base = short;
  const used = new Set();
  const picked = [];
  for (const v of shuffle(base)) {
    if (used.has(v.arti) || used.has(v.korea)) continue;
    used.add(v.arti); used.add(v.korea);
    picked.push(v);
    if (picked.length === pairs) break;
  }
  if (picked.length < pairs) return null;
  const raw = [];
  picked.forEach((v, i) => {
    raw.push({ pair: i, text: v.korea });
    raw.push({ pair: i, text: v.arti });
  });
  const tiles = shuffle(raw).map((t, id) => ({ ...t, id, state: 'hidden' }));
  return { tiles, pairs, matched: 0, moves: 0, open: [], lock: false, done: false, newBest: false, elapsed: 0, startedAt: Date.now(), timerId: null, chapter };
}
function startMatchTimer() {
  const m = S.match;
  if (!m) return;
  m.startedAt = Date.now();
  m.timerId = setInterval(() => {
    if (S.match !== m || m.done) return;
    m.elapsed = Math.floor((Date.now() - m.startedAt) / 1000);
    const el = document.getElementById('mtime');
    if (el) el.textContent = fmtTime(m.elapsed * 1000);
  }, 500);
}
function stopMatchTimer() { if (S.match && S.match.timerId) { clearInterval(S.match.timerId); S.match.timerId = null; } }
function matchTile(id) {
  const m = S.match;
  if (!m || m.lock || m.done) return;
  const t = m.tiles[id];
  if (!t || t.state !== 'hidden') return;
  t.state = 'open';
  if (settings.autoplay && /[가-힣]/.test(t.text)) speakKorean(t.text);
  m.open.push(id);
  if (m.open.length === 2) {
    m.moves++;
    const [a, b] = m.open.map(i => m.tiles[i]);
    if (a.pair === b.pair) {
      a.state = 'done'; b.state = 'done';
      m.matched++;
      m.open = [];
      if (m.matched === m.pairs) { finishMatch(); return render(); }
    } else {
      m.lock = true;
      setTimeout(() => {
        if (S.match !== m) return;
        a.state = 'hidden'; b.state = 'hidden';
        m.open = []; m.lock = false;
        render();
      }, 650);
    }
  }
  render();
}
function finishMatch() {
  const m = S.match;
  stopMatchTimer();
  m.done = true;
  m.elapsed = Math.floor((Date.now() - m.startedAt) / 1000);
  progress.matchBest = progress.matchBest || {};
  const old = progress.matchBest[m.pairs];
  const better = !old || m.elapsed < old.sec || (m.elapsed === old.sec && m.moves < old.moves);
  if (better) progress.matchBest[m.pairs] = { sec: m.elapsed, moves: m.moves };
  m.newBest = better;
  progress.matchPlayed = (progress.matchPlayed || 0) + 1;
  awardXp(m.pairs * 2);
  recordStudyDay();
  save();
}
function matchView() {
  const m = S.match;
  if (!m) {
    const best = Object.entries(progress.matchBest || {}).sort((a, b) => Number(a[0]) - Number(b[0]));
    const bestLines = best.length
      ? best.map(([p, b]) => `<div class="rowlink static"><span>${p} pasangan</span><small>${fmtTime(b.sec * 1000)} · ${b.moves} langkah</small></div>`).join('')
      : `<p class="muted">Belum ada rekor. Mainkan dulu untuk mencatat rekor.</p>`;
    return `
      <header class="pagehead"><h1>Pasangkan kata</h1><p class="muted">Cocokkan kata Korea dengan artinya. Makin cepat dan makin sedikit langkah, makin baik.</p></header>
      <h2 class="sec">Jumlah pasangan</h2>
      <div class="seg">${[6, 8].map(n => `<button class="seg-btn" aria-pressed="${S.matchSetup.pairs === n}" data-act="mpairs" data-val="${n}">${n}</button>`).join('')}</div>
      <label class="lbl top">Bab<select class="field" data-field="mchapter">${chapterOptions(S.matchSetup.chapter)}</select></label>
      <div class="actions"><button class="btn primary wide" data-act="mstart">Mulai</button></div>
      <h2 class="sec">Rekor</h2>
      <div class="rowlist">${bestLines}</div>`;
  }
  const cols = m.pairs === 6 ? 'c3' : 'c4';
  const tiles = m.tiles.map(t => {
    const locked = t.state !== 'hidden' || m.lock || m.done;
    const label = t.state === 'hidden' ? '' : esc(t.text);
    return `<button class="tile ${t.state}" data-act="mtile" data-val="${t.id}" ${locked ? 'disabled' : ''} aria-label="${t.state === 'hidden' ? 'Kartu tertutup' : esc(t.text)}">${label}</button>`;
  }).join('');
  const head = m.done
    ? `<section class="result">
         <p class="kicker">Selesai</p>
         <p class="result-num num">${fmtTime(m.elapsed * 1000)}</p>
         <p>${m.moves} langkah · ${m.pairs} pasangan</p>
         ${m.newBest ? '<p class="achv-new">Rekor baru</p>' : ''}
       </section>
       <div class="actions col">
         <button class="btn primary wide" data-act="mstart">Main lagi</button>
         <button class="btn wide" data-act="mreset">Ubah pengaturan</button>
         <a class="btn wide" href="#lainnya">Kembali</a>
       </div>`
    : `<div class="runhead">
         <span class="num">Langkah ${m.moves}</span>
         <span class="num" id="mtime">${fmtTime(m.elapsed * 1000)}</span>
         <button class="link" data-act="mquit">Keluar</button>
       </div>`;
  return `${head}<div class="mgrid ${cols}">${tiles}</div>`;
}

// ---------- Boot ----------
async function init() {
  try {
    [chapters, vocab] = await Promise.all([
      fetch(`data/chapters.json?v=${DATA_VERSION}`, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(`chapters.json ${r.status}`); return r.json(); }),
      fetch(`data/vocabulary.json?v=${DATA_VERSION}`, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(`vocabulary.json ${r.status}`); return r.json(); })
    ]);
    if (!location.hash) location.hash = '#home';
    render();
  } catch (e) {
    view.innerHTML = `<p class="empty">Data belum bisa dimuat. Pastikan folder data/ ikut diunggah dan website dibuka lewat server.</p>`;
    console.error(e);
  }
}
init();
