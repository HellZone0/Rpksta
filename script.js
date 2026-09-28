let chapters = []; let vocab = [];
const app = document.getElementById('app');
const toast = document.getElementById('toast');
const infoModal = document.getElementById('infoModal');
const state = {
  view: 'home', chapter: null, search: '', cat: 'Semua',
  flashIndex: 0, flashShow: false,
  quiz: null
};
const STORE='epsTopikProgress';
const SETTINGS='epsTopikSettings';
const CREATOR_SEEN='epsTopikCreatorSeen';
const DATA_VERSION='20260928-quizfix-02';
function readJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch(e){localStorage.removeItem(key);return fallback;}}
let progress=readJSON(STORE,{correct:0,wrong:0,answered:0,xp:0,streak:0,lastDate:'',seen:{}});
let settings=readJSON(SETTINGS,{theme:'dark'});

document.documentElement.dataset.theme=settings.theme==='dark'?'dark':'light';

async function init(){
  try{
    [chapters,vocab]=await Promise.all([
      fetch(`data/chapters.json?v=${DATA_VERSION}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`chapters.json: HTTP ${r.status}`);return r.json()}),
      fetch(`data/vocabulary.json?v=${DATA_VERSION}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`vocabulary.json: HTTP ${r.status}`);return r.json()})
    ]);
    render();
    if(localStorage.getItem(CREATOR_SEEN)!=='1') openInfoModal();
  }catch(e){app.innerHTML='<div class="card"><h2>Data tidak dapat dimuat</h2><p class="muted">Pastikan folder data/ ikut diunggah dan website dijalankan melalui server.</p></div>';console.error(e)}
}

function openInfoModal(){
  infoModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  setTimeout(()=>document.getElementById('closeInfo')?.focus(),50);
}
function closeInfoModal(){
  infoModal.classList.add('hidden');
  localStorage.setItem(CREATOR_SEEN,'1');
  document.body.classList.remove('modal-open');
}
/* Legacy wrong-answer modal removed: quiz feedback is rendered inline so the
   user can always choose another answer or continue to the next question. */
/* function showWrongModal(message, isFinal=false){
  document.getElementById('wrongMessage').textContent=message;
  const box=document.getElementById('correctAnswerBox');
  const action=document.getElementById('wrongAction');
  if(isFinal){
    box.textContent=`Jawaban yang benar: ${state.quiz.pool[state.quiz.i].arti}`;
    box.classList.remove('hidden');
    action.textContent='Soal Berikutnya';
  }else{
    box.classList.add('hidden');
    action.textContent='Coba Lagi';
  }
  wrongModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  action.onclick=()=>{
    wrongModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    if(isFinal){
      const q=state.quiz;
      q.i++;
      q.locked=false;
      render();
    }
  };
  setTimeout(()=>action.focus(),50);
}

*/

document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
document.getElementById('themeBtn').addEventListener('click',()=>{settings.theme=settings.theme==='dark'?'light':'dark';localStorage.setItem(SETTINGS,JSON.stringify(settings));document.documentElement.dataset.theme=settings.theme==='dark'?'dark':'light';});

function save(){localStorage.setItem(STORE,JSON.stringify(progress));}
function esc(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function toastMsg(s){toast.textContent=s;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1700)}
function itemsFor(ch){return vocab.filter(v=>v.bab===ch)}
function show(view,opts={}){
  state.view=view;
  if(opts.chapter){
    const nextChapter=Number(opts.chapter);
    if(state.chapter!==nextChapter) state.cat='Semua';
    state.chapter=nextChapter;
  }
  if(view!=='vocab')state.search='';
  render();
  window.scrollTo({top:0,behavior:'smooth'});
}
function render(){
  updateActiveNav();
  if(state.view==='home') return home();
  if(state.view==='chapters') return chapterList();
  if(state.view==='vocab') return vocabView();
  if(state.view==='flashcards') return flashcards();
  if(state.view==='quiz') return quizView();
  if(state.view==='stats') return statsView();
}
function home(){
 const total=vocab.length, answered=progress.answered||0;
 const mainCount=vocab.filter(v=>v.sumber==='어휘').length;
 const infoCount=total-mainCount;
 const seen=Object.keys(progress.seen||{}).length;
 const pct=total?Math.round(seen/total*100):0;
 app.innerHTML=`<section class="hero"><div><div class="eyebrow">EPS-TOPIK 한국어 어휘</div><h1>Belajar kosakata Korea <span class="accent">lebih terarah.</span></h1><p>Pelajari dan uji kosakata EPS-TOPIK Bab 1–30. Lengkap dengan kosakata utama dan <strong>문화와 정보</strong>.</p><div class="actions"><button class="btn primary" data-action="chapters">Lihat Bab 1–30 →</button><button class="btn" data-action="quiz">Mulai Latihan Soal</button></div></div><div class="hero-card"><span>Total kosakata</span><strong>${total.toLocaleString('id-ID')}</strong><span>Bab 1–30 · ${mainCount.toLocaleString('id-ID')} utama + ${infoCount.toLocaleString('id-ID')} 정보</span><span class="source-note">Dataset ${DATA_VERSION}</span><hr><span>Sudah dipelajari</span><strong>${seen}</strong><div class="progress"><span style="width:${pct}%"></span></div></div></section>
 <div class="dashboard-stats"><div class="mini-stat"><span class="muted">Total kosakata</span><strong>${total.toLocaleString('id-ID')}</strong></div><div class="mini-stat"><span class="muted">Kosakata utama</span><strong>${mainCount.toLocaleString('id-ID')}</strong></div><div class="mini-stat"><span class="muted">문화와 정보</span><strong>${infoCount.toLocaleString('id-ID')}</strong></div></div>
 <div class="section-head"><div><h2>Bab tersedia</h2><p class="muted">Mulai dari Bab 1 atau pilih bab tertentu.</p></div><button class="btn" data-action="chapters">Lihat semua</button></div><div class="grid">${chapters.slice(0,6).map(chapterCard).join('')}</div>
 <div class="section-head"><div><h2>Belajar sesuai caramu</h2></div></div><div class="grid"><div class="card"><h3>📚 Kosakata</h3><p class="muted">Cari kata Korea, arti Indonesia, dan kategori.</p></div><div class="card"><h3>🃏 Kartu Belajar</h3><p class="muted">Balik kartu untuk mengingat arti.</p></div><div class="card"><h3>✎ Latihan Soal</h3><p class="muted">Dua kesempatan menjawab setiap soal.</p></div></div>`;
 bindActions();updateActiveNav();
}
function chapterCard(c){const actualCount=vocab.length?itemsFor(c.bab).length:Number(c.jumlahKosakata||0);return `<div class="card chapter-card"><div class="chapter-top"><div class="chapter-icon">${['◉','▣','⌖','◆','▦','◷'][((c.bab-1)%6)]}</div><div><span class="chapter-num">BAB ${c.bab}</span><h3>${esc(c.korea)}</h3><p>${esc(c.indonesia)}</p></div></div><div class="chapter-bottom"><span class="count">${actualCount} kosakata</span><button class="btn" data-open="${c.bab}">Buka →</button></div></div>`}
function chapterList(){app.innerHTML=`<div class="section-head"><div><div class="eyebrow">EPS-TOPIK</div><h1>Daftar Bab 1–30</h1><p class="muted">Pilih bab untuk melihat seluruh kosakata, termasuk budaya dan informasi.</p></div></div><div class="filter-pills"><button class="pill active">Semua Bab</button><button class="pill" data-action="vocab">Semua Kosakata</button></div><div class="grid" style="margin-top:14px">${chapters.map(chapterCard).join('')}</div>`;bindActions();updateActiveNav()}
function vocabView(){
 const ch=state.chapter; const base=ch?itemsFor(ch):vocab; const cats=[...new Set(base.map(v=>v.kategori))];
 if(state.cat!=='Semua'&&!cats.includes(state.cat))state.cat='Semua';
 const list=base.filter(v=>(state.cat==='Semua'||v.kategori===state.cat)&&((v.korea+' '+v.arti).toLowerCase().includes(state.search.toLowerCase())));
 app.innerHTML=`<div class="section-head"><div><div class="eyebrow">KOSAKATA</div><h1>${ch?`Bab ${ch} — ${esc(chapters[ch-1].korea)}`:'Semua Kosakata'}</h1><p class="muted">${ch?esc(chapters[ch-1].indonesia):'Kosakata EPS-TOPIK Bab 1–30'}</p></div><button class="btn" data-action="chapters">Daftar Bab</button></div>
 <div class="toolbar"><input id="vsearch" class="search" placeholder="Cari kosakata Korea atau arti Indonesia..." value="${esc(state.search)}"><select id="vcat" class="select"><option>Semua</option>${cats.map(x=>`<option ${x===state.cat?'selected':''}>${esc(x)}</option>`).join('')}</select>${ch?`<button class="btn primary" data-flash="${ch}">Kartu Bab Ini</button>`:''}</div>
 <div class="notice">Menampilkan <strong>${list.length}</strong> kosakata${ch?` dari Bab ${ch}`:''}.</div>
 <div class="vocab-list">${list.length?list.map((v,i)=>`<div class="vocab-item"><div><div class="ko">${esc(v.korea)}</div><div class="meaning">${esc(v.arti)}</div></div><span class="cat">${esc(v.kategori)}</span><div class="word-actions"><button class="round-btn" title="Simpan kata" aria-label="Simpan kata">☆</button></div></div>`).join(''):`<div class="card empty">Kosakata tidak ditemukan.</div>`}</div><p class="source-note">Data disusun dari entri 어휘/KOSAKATA Bab 1–30 serta istilah leksikal dari bagian 문화와 정보/Budaya & Informasi pada PDF EPS-TOPIK yang diberikan.</p>`;
 document.getElementById('vsearch').addEventListener('input',e=>{state.search=e.target.value;render();const el=document.getElementById('vsearch');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}});
 document.getElementById('vcat').addEventListener('change',e=>{state.cat=e.target.value;render()});bindActions();updateActiveNav();
}
function flashcards(){
 const pool=state.chapter?itemsFor(state.chapter):vocab;if(!pool.length){app.innerHTML='<div class="card empty">Tidak ada kosakata.</div>';return}if(state.flashIndex>=pool.length)state.flashIndex=0;const v=pool[state.flashIndex];
 app.innerHTML=`<div class="section-head"><div><div class="eyebrow">KARTU BELAJAR</div><h1>Ulangi sampai ingat.</h1><p class="muted">${state.chapter?`Bab ${state.chapter} — ${esc(chapters[state.chapter-1].korea)}`:'Semua Bab'}</p></div><button class="btn" data-action="chapters">Pilih Bab</button></div><div class="quiz-wrap"><div class="card flashcard" id="flash"><div><div class="cat">${esc(v.kategori)}</div><div class="flash-main">${esc(state.flashShow?v.arti:v.korea)}</div><div class="flash-answer">${state.flashShow?esc(v.korea):'Ketuk kartu untuk melihat arti'}</div></div></div><div class="actions" style="justify-content:center"><button class="btn" id="prevFlash">← Sebelumnya</button><button class="btn primary" id="nextFlash">Berikutnya →</button></div><p class="muted" style="text-align:center">${state.flashIndex+1} / ${pool.length}</p></div>`;
 document.getElementById('flash').onclick=()=>{state.flashShow=!state.flashShow;render()};document.getElementById('prevFlash').onclick=()=>{state.flashIndex=(state.flashIndex-1+pool.length)%pool.length;state.flashShow=false;render()};document.getElementById('nextFlash').onclick=()=>{state.flashIndex=(state.flashIndex+1)%pool.length;state.flashShow=false;render()};bindActions();updateActiveNav();
}
function startQuiz(){
 const ch=state.chapter||null;
 const pool=(ch?itemsFor(ch):vocab).slice().sort(()=>Math.random()-.5);
 const count=Math.min(10,pool.length);
 state.quiz={pool:pool.slice(0,count),questionCount:count,i:0,score:0,wrong:0,mode:'campuran',locked:false,attempts:0,tried:[],choices:null,selected:null,pendingNext:false,feedback:null};
 show('quiz');
}
function makeChoices(v,pool){
 const result=[v];
 const used=new Set([v.arti]);
 const candidates=pool.filter(x=>x!==v).slice().sort(()=>Math.random()-.5);
 // Prefer distractors from the current quiz pool, but never repeat the same
 // Indonesian meaning. If needed, fall back to the full dataset.
 for(const x of candidates){
   if(!used.has(x.arti)){ result.push(x); used.add(x.arti); if(result.length===4) break; }
 }
 if(result.length<4){
   const fallback=vocab.slice().sort(()=>Math.random()-.5);
   for(const x of fallback){
     if(x!==v && !used.has(x.arti)){ result.push(x); used.add(x.arti); if(result.length===4) break; }
   }
 }
 return result.sort(()=>Math.random()-.5);
}
function makeQuizState(pool,n){
 return {pool:pool.slice(0,n),questionCount:n,i:0,score:0,wrong:0,mode:'campuran',locked:false,attempts:0,tried:[],choices:null,selected:null,pendingNext:false,feedback:null};
}
function quizView(){
 if(!state.quiz){app.innerHTML=`<div class="quiz-wrap"><div class="card quiz-card"><div class="eyebrow">LATIHAN SOAL</div><h1>Uji kosakata.</h1><p class="muted">Pilih jawaban, tekan <strong>Jawab</strong>, lalu lanjutkan. Setiap soal memiliki <strong>2 kesempatan</strong>.</p><div class="two-col"><label>Bab<select id="qchap" class="select" style="width:100%"><option value="">Semua Bab</option>${chapters.map(c=>`<option value="${c.bab}" ${state.chapter===c.bab?'selected':''}>Bab ${c.bab} — ${esc(c.korea)}</option>`).join('')}</select></label><label>Jumlah soal<select id="qcount" class="select" style="width:100%"><option>10</option><option>20</option><option>30</option><option>50</option><option>100</option><option>Semua</option></select></label></div><div class="notice" style="margin-top:16px">Jawaban tidak akan diproses hanya karena opsi dipilih.</div><div class="actions"><button class="btn primary" id="startQ">Mulai Latihan →</button></div></div></div>`;document.getElementById('startQ').onclick=()=>{state.chapter=Number(document.getElementById('qchap').value)||null;const pool=(state.chapter?itemsFor(state.chapter):vocab).slice().sort(()=>Math.random()-.5);const selected=document.getElementById('qcount').value;const requested=selected==='Semua'?pool.length:Number(selected);state.quiz=makeQuizState(pool,Math.min(requested,pool.length));render()};updateActiveNav();return}
 const q=state.quiz;if(q.i>=q.pool.length)return quizResult();const v=q.pool[q.i];if(!q.choices)q.choices=makeChoices(v,q.pool);const choices=q.choices,attempts=q.attempts||0,selected=q.selected||null,feedback=q.feedback,canAnswer=!!selected&&!q.pendingNext&&!q.locked,actionLabel=q.pendingNext?'Soal Berikutnya →':'Jawab';
 const pct=Math.round((q.i/q.pool.length)*100);const feedbackHtml=feedback?`<div class="quiz-feedback ${feedback.type==='correct'?'good':'bad'}" role="status"><strong>${esc(feedback.title)}</strong><span>${esc(feedback.message)}</span>${feedback.answer?`<small>Jawaban yang benar: <strong>${esc(feedback.answer)}</strong></small>`:''}</div>`:'';
 app.innerHTML=`<div class="quiz-wrap"><div class="card quiz-card"><div class="quiz-meta"><span>Soal ${q.i+1}/${q.pool.length}</span><span>Kesempatan: <strong>${Math.max(0,2-attempts)}</strong> dari 2</span></div><div class="quiz-progress"><span style="width:${pct}%"></span></div><div class="quiz-question">${esc(v.korea)}</div><div class="choices">${choices.map(c=>{const isSelected=selected===c.arti;const tried=q.tried?.includes(c.arti);const cls=`choice ${isSelected?'selected':''} ${tried?'tried':''}`;return `<button class="${cls}" data-answer="${encodeURIComponent(c.arti)}" ${tried||q.pendingNext?'disabled':''} aria-pressed="${isSelected?'true':'false'}">${esc(c.arti)}</button>`}).join('')}</div>${feedbackHtml}<div class="actions quiz-actions"><button class="btn" id="quitQ">Keluar</button><button class="btn primary" id="answerQ" ${canAnswer||q.pendingNext?'':'disabled'}>${actionLabel}</button></div></div></div>`;
 document.querySelectorAll('[data-answer]').forEach(btn=>btn.onclick=()=>{if(q.locked||q.pendingNext)return;q.selected=decodeURIComponent(btn.dataset.answer);q.feedback=null;render()});
 document.getElementById('answerQ').onclick=()=>{if(q.pendingNext){q.i++;q.attempts=0;q.tried=[];q.choices=null;q.selected=null;q.pendingNext=false;q.feedback=null;q.locked=false;render();return}if(!q.selected||q.locked)return;q.locked=true;const answer=q.selected,correct=answer===v.arti;if(correct){q.score++;progress.correct=(progress.correct||0)+1;progress.xp=(progress.xp||0)+10;progress.answered=(progress.answered||0)+1;progress.seen[v.id||`${v.bab}-${v.korea}`]=true;save();q.pendingNext=true;q.locked=false;q.feedback={type:'correct',title:'Jawaban benar!',message:'+10 XP. Tekan “Soal Berikutnya” untuk melanjutkan.'};render();toastMsg('Benar! +10 XP');return}q.attempts=(q.attempts||0)+1;q.wrong=(q.wrong||0)+1;progress.wrong=(progress.wrong||0)+1;q.tried=q.tried||[];if(!q.tried.includes(answer))q.tried.push(answer);q.selected=null;save();if(q.attempts<2){q.locked=false;q.feedback={type:'wrong',title:'Jawaban salah.',message:'Kesempatan tersisa 1. Pilih jawaban lain lalu tekan Jawab.'};render();toastMsg('Salah. Coba lagi!')}else{progress.answered=(progress.answered||0)+1;q.pendingNext=true;q.locked=false;q.feedback={type:'wrong',title:'Jawaban salah 2×.',message:'Kedua kesempatan sudah digunakan.',answer:v.arti};save();render();toastMsg('Kesempatan habis.')}};
 document.getElementById('quitQ').onclick=()=>{state.quiz=null;show('home')};updateActiveNav();
}
function quizResult(){const q=state.quiz;const total=q.pool.length;const pct=total?Math.round(q.score/total*100):0;app.innerHTML=`<div class="quiz-wrap"><div class="card quiz-card" style="text-align:center"><div class="cat">HASIL LATIHAN</div><h1>${pct}%</h1><p class="muted">${q.score} benar dari ${total} soal.</p><p class="muted">Kesalahan: ${q.wrong||0} kali.</p><div class="progress"><span style="width:${pct}%"></span></div><div class="actions" style="justify-content:center"><button class="btn primary" id="again">Coba Lagi</button><button class="btn" id="homeAfter">Ke Beranda</button></div></div></div>`;document.getElementById('again').onclick=()=>{
  const count=q.questionCount||q.pool.length;
  const ch=state.chapter||null;
  const pool=(ch?itemsFor(ch):vocab).slice().sort(()=>Math.random()-.5);
  state.quiz=makeQuizState(pool,Math.min(count,pool.length));
  render();
};document.getElementById('homeAfter').onclick=()=>{state.quiz=null;show('home')}}
function statsView(){const total=vocab.length;const seen=Object.keys(progress.seen||{}).length;const pct=total?Math.min(100,Math.round(seen/total*100)):0;app.innerHTML=`<div class="section-head"><div><div class="eyebrow">STATISTIK</div><h1>Perkembangan belajar.</h1><p class="muted">Semua progres tersimpan di perangkat ini.</p></div></div><div class="stats-grid"><div class="card stat"><span class="muted">Soal dijawab</span><strong>${progress.answered||0}</strong></div><div class="card stat"><span class="muted">Jawaban benar</span><strong>${progress.correct||0}</strong></div><div class="card stat"><span class="muted">XP</span><strong>${progress.xp||0}</strong></div></div><div class="card" style="margin-top:14px"><h3>Kemajuan kosakata</h3><p class="muted">${seen} dari ${total} kosakata pernah dipelajari.</p><div class="progress"><span style="width:${pct}%"></span></div><p class="source-note">${pct}% selesai</p></div><div class="actions"><button class="btn" id="resetStats">Reset statistik</button></div>`;document.getElementById('resetStats').onclick=()=>{if(confirm('Reset statistik di perangkat ini?')){progress={correct:0,wrong:0,answered:0,xp:0,streak:0,lastDate:'',seen:{}};save();render();toastMsg('Statistik direset')}};updateActiveNav()}
function updateActiveNav(){document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));}
function bindActions(){document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>show('vocab',{chapter:b.dataset.open}));document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>show(b.dataset.action));document.querySelectorAll('[data-flash]').forEach(b=>b.onclick=()=>{state.chapter=Number(b.dataset.flash);state.flashIndex=0;state.flashShow=false;show('flashcards')});}
document.getElementById('closeInfo').onclick=closeInfoModal;
document.getElementById('closeInfoBottom').onclick=closeInfoModal;
infoModal.addEventListener('click',e=>{if(e.target===infoModal)closeInfoModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!infoModal.classList.contains('hidden'))closeInfoModal()});
init();
