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

function buildAiPrompt(userPrompt) {
  const context=findAiContext(userPrompt);
  const contextText=context.length ? context.map(v=>`- ${v.korea} — ${v.arti} — ${v.kategori} — Bab ${v.bab} — ${v.sumber}`).join('\n') : 'Tidak ada kecocokan langsung di dataset Bab 1–60.';
  return `Kamu adalah AI Tutor kosakata Korea untuk pelajar Indonesia yang sedang belajar EPS-TOPIK.\n\nATURAN UTAMA:\n- Jawab dalam bahasa Indonesia dan pertahankan kata Korea dalam Hangul.\n- Kamu BOLEH menjawab kosakata Korea apa pun, termasuk kata yang TIDAK ADA di Bab 1–60. Jangan menolak hanya karena kata tersebut tidak ada di dataset lokal.\n- Jika kata ditemukan pada konteks lokal, sebutkan bahwa kata tersebut ada di dataset dan berikan Bab, kategori, serta arti yang tersedia.\n- Jika kata tidak ditemukan pada konteks lokal, jelaskan berdasarkan pengetahuan bahasa Korea yang kamu miliki, tetapi JANGAN mengklaim kata itu berasal dari dataset EPS-TOPIK ini.\n- Jika pengguna meminta contoh kalimat, berikan contoh Korea + terjemahan Indonesia yang natural dan sesuai level belajar.\n- Jika membandingkan kata, jelaskan perbedaan arti, nuansa, dan penggunaan secara sederhana.\n- Untuk pertanyaan di luar kosakata/bahasa Korea, jawab singkat dan arahkan kembali ke pembelajaran Korea.\n\nKonteks dataset lokal Bab 1–60:\n${contextText}\n\nPertanyaan pengguna:\n${userPrompt}`;
}

function extractAiText(data) {
  if(typeof data==='string') return data;
  const candidates=[data?.answer,data?.response,data?.message,data?.text,data?.result,data?.content,data?.data?.answer,data?.data?.response,data?.data?.message,data?.data?.text,data?.data?.content];
  for(const x of candidates) if(typeof x==='string' && x.trim()) return x;
  if(Array.isArray(data?.choices) && data.choices[0]) return data.choices[0]?.message?.content || data.choices[0]?.text || '';
  return JSON.stringify(data,null,2);
}

async function askAiTutor(userPrompt,key) {
  aiBusy=true; const send=document.getElementById('aiSend'); if(send){send.disabled=true;send.textContent='Memproses…';}
  const thinking=document.createElement('div'); thinking.className='ai-message ai-message-bot ai-thinking'; thinking.id='aiThinking'; thinking.innerHTML='<strong>AI Tutor</strong><p>Sedang menyusun jawaban…</p>'; document.getElementById('aiMessages')?.appendChild(thinking);
  try {
    const url=new URL(AI_ENDPOINT); url.searchParams.set('prompt',buildAiPrompt(userPrompt)); url.searchParams.set('apikey',key);
    const res=await fetch(url.toString(),{method:'GET'});
    const raw=await res.text(); let data; try{data=JSON.parse(raw)}catch{data=raw}
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    document.getElementById('aiThinking')?.remove(); addAiMessage('bot',extractAiText(data));
  } catch(err) {
    document.getElementById('aiThinking')?.remove(); addAiMessage('bot',`Maaf, AI tidak dapat dihubungi. Periksa API key, koneksi, atau izin CORS endpoint.\n\nDetail: ${err.message}`);
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

const DATA_VERSION = '20261019-buku2-bab31-60';

const AI_ENDPOINT = 'https://api.kyzzz.xyz/api/ai/chatgpt';

const AI_DEFAULT_KEY = 'kyzz1226075626018';

const AI_KEY_STORE = 'epsTopikAiApiKey';

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

let settings = Object.assign({ theme: 'light', speechRate: 0.8, listeningPause: 650 }, readJSON(SETTINGS, {}));
settings.speechRate = Number(settings.speechRate) || 0.8;
document.documentElement.dataset.theme = settings.theme === 'dark' ? 'dark' : 'light';

const S = {
  quiz: null,
  result: null,
  setup: { mode: 'campuran', count: 10, chapter: '' },
  kq: { chapter: null, search: '', status: 'Semua', source: 'Semua', limit: 50 },
  deck: null,
  match: null,
  matchSetup: { chapter: '', pairs: 6 }
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
  return `<option value="">Semua bab</option>` + chapters.map(c => `<option value="${c.bab}" ${String(selected) === String(c.bab) ? 'selected' : ''}>Bab ${c.bab} · ${esc(c.korea)}</option>`).join('');
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
      ${next ? `<a class="rowlink" href="#kosakata/${next.bab}"><span>Bab ${next.bab} · ${esc(next.korea)}</span><small>${chapterDone(next.bab)} dari ${itemsFor(next.bab).length}</small></a>` : ''}
      ${hard ? `<button class="rowlink" data-act="sulit"><span>Kata sulit</span><small>${hard} kata</small></button>` : ''}
      <a class="rowlink" href="#pasangkan"><span>Pasangkan kata</span><small>Permainan singkat</small></a>
      <a class="rowlink" href="#kartu" data-act="kartu"><span>Kartu belajar</span><small>Hafalkan satu per satu</small></a>
    </section>`;
}

// ---------- Bab ----------
function pdfName(bab) { return `EPS-TOPIK-Bab-${String(bab).padStart(2, '0')}-Kosakata.pdf`; }
function babView() {
  const rows = chapters.map(c => {
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
  }).join('');
  return `
    <header class="pagehead"><h1>Bab</h1><p class="muted">Pilih bab untuk melihat kosakatanya, atau unduh PDF-nya.</p></header>
    <div class="chlist">${rows}</div>`;
}

// ---------- Kosakata ----------
function kFiltered() {
  const base = (S.kq.chapter ? itemsFor(S.kq.chapter) : vocab).filter(v => S.kq.source === 'Semua' || v.sumber === S.kq.source);
  const q = S.kq.search.trim().toLowerCase();
  return base.filter(v => {
    if (S.kq.status !== 'Semua' && mastery(v) !== S.kq.status) return false;
    if (!q) return true;
    const c = chapters[v.bab - 1] || {};
    return [v.korea, v.arti, v.kategori, c.korea, c.indonesia, `bab ${v.bab}`].join(' ').toLowerCase().includes(q);
  });
}
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
    </div>
  </article>`;
}
function kosakataView() {
  return `
    <header class="pagehead"><h1>Kosakata</h1><p class="muted" id="kcount"></p></header>
    ${S.kq.chapter ? `<a class="btn wide pdf-btn" href="pdf/${pdfName(S.kq.chapter)}" download>Unduh PDF Bab ${S.kq.chapter}</a>` : ''}
    <div class="filters">
      <input class="field" type="search" data-field="ksearch" placeholder="Cari kata, arti, atau bab" value="${esc(S.kq.search)}" autocomplete="off">
      <div class="pair">
        <label class="lbl">Bab<select class="field" data-field="kchapter">${chapterOptions(S.kq.chapter || '')}</select></label>
        <label class="lbl">Status<select class="field" data-field="kstatus">
          ${[['Semua', 'Semua'], ['belum', 'Belum dibuka'], ['perlu', 'Perlu latihan'], ['salah', 'Sering salah'], ['dikuasai', 'Dikuasai']]
            .map(([v, l]) => `<option value="${v}" ${S.kq.status === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
      </div>
      <label class="lbl">Sumber<select class="field" data-field="ksource">
        ${[['Semua', 'Semua'], ['어휘', '어휘'], ['문화와 정보', '문화와 정보']]
          .map(([v, l]) => `<option value="${v}" ${S.kq.source === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select></label>
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
      <button class="link" data-act="skip">Lewati</button>
    </div>`;
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
    <div class="actions col">
      <button class="btn wide" data-act="export">Unduh data</button>
      <label class="btn wide file-btn">Pulihkan dari file<input type="file" accept="application/json" data-field="import" hidden></label>
      <button class="btn wide danger" data-act="reset">Reset statistik</button>
    </div>`;
}
function importFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result);
      if (!d.progress) throw new Error('format');
      progress = Object.assign({}, defaultProgress, d.progress);
      ['seen','wrongByWord','rightByWord','mastered','favorites','achievements','studyDays','reviewDue','dailyChallenges'].forEach(k => { progress[k] ||= {}; });
      progress.quizHistory ||= [];
      save(); render(); toastMsg('Data berhasil dipulihkan.');
    } catch (e) { toastMsg('File tidak valid.'); }
  };
  reader.readAsText(file);
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
  return `
    <header class="pagehead"><h1>AI Tutor</h1><p class="muted">Tanyakan kosakata Korea apa pun. Kata dari Bab 1–60 dipakai sebagai konteks bila ada.</p></header>
    <div class="chips">${examples.map(p => `<button class="chip" data-act="aiprompt" data-val="${enc(p)}">${esc(p)}</button>`).join('')}</div>
    <div id="aiMessages" class="thread">
      <div class="ai-message ai-message-bot"><strong>AI Tutor</strong><p>Halo. Ketik pertanyaanmu di bawah.</p></div>
    </div>
    <form id="aiForm" class="ask">
      <textarea id="aiPrompt" class="field" rows="3" maxlength="1200" placeholder="Contoh: Apa arti 배탈이 나다?"></textarea>
      <button class="btn primary" id="aiSend" type="submit">Kirim</button>
    </form>`;
}

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
    const blob = new Blob([JSON.stringify({ progress, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
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
  else if (f === 'ksource') { S.kq.source = e.target.value; S.kq.limit = 50; paintKList(); }
  else if (f === 'lchapter') S.setup.chapter = e.target.value;
  else if (f === 'mchapter') S.matchSetup.chapter = e.target.value;
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
  askAiTutor(prompt, AI_DEFAULT_KEY);
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
