# DESIGN BRIEF — EPS-TOPIK VOCABULARY QUIZ

## 1. Product Direction

**Nama:** EPS-TOPIK Vocabulary Quiz  
**Nama Korea:** EPS-TOPIK 한국어 어휘 퀴즈

Website pembelajaran kosakata Bahasa Korea untuk persiapan EPS-TOPIK Bab 1–30.

Fokus utama:
- belajar kosakata
- flashcard
- audio/pelafalan
- quiz
- pencarian dan filter
- progress
- statistik
- review jawaban salah
- penyimpanan progress lokal tanpa login

Prioritas:
1. Akurasi data
2. Fungsi belajar
3. Quiz
4. Progress
5. Usability
6. Visual

---

## 2. Design Principles

### 01 — Learning First
Setiap elemen UI harus membantu pengguna belajar atau memahami progress.

### 02 — Calm, Clear, Focused
Modern tetapi tidak terasa seperti AI dashboard. Hindari dekorasi berlebihan.

### 03 — Meaningful Feedback
Animasi dan feedback hanya digunakan jika memberikan informasi atau membantu pengguna memahami hasil.

---

## 3. Visual Direction

### Mood
**Clean Korean Study Dashboard**

Karakter:
- modern
- akademis
- profesional
- ringan
- fokus
- nyaman untuk sesi belajar panjang

Hindari:
- gradient berlebihan
- glow di mana-mana
- glassmorphism berat
- terlalu banyak floating card
- radius ekstrem
- animasi dekoratif
- dashboard yang terlalu ramai

Gunakan:
- whitespace
- hierarchy tipografi
- border tipis
- shadow ringan
- satu warna aksen utama
- layout konsisten

---

## 4. Color Tokens

### Light Mode

| Token | Hex | Fungsi |
|---|---|---|
| Background | #F7F9FC | Background utama |
| Surface | #FFFFFF | Card/panel |
| Surface Soft | #F1F5F9 | Secondary surface |
| Text | #172033 | Teks utama |
| Text Muted | #64748B | Teks sekunder |
| Border | #E2E8F0 | Border |
| Primary | #2563EB | Action utama |
| Primary Dark | #1D4ED8 | Hover/active |
| Success | #16A34A | Jawaban benar |
| Error | #DC2626 | Jawaban salah |
| Warning | #D97706 | Peringatan |

### Dark Mode

| Token | Hex |
|---|---|
| Background | #0B1120 |
| Surface | #111827 |
| Surface Soft | #172033 |
| Text | #F8FAFC |
| Text Muted | #94A3B8 |
| Border | #263247 |
| Primary | #60A5FA |
| Primary Dark | #3B82F6 |

**Keputusan:** gradient tidak digunakan sebagai background utama.

---

## 5. Typography

Font:
`Pretendard, Noto Sans KR, system-ui, sans-serif`

Alasan:
- Hangul jelas
- Bahasa Indonesia nyaman dibaca
- angka mudah dibaca
- cocok untuk aplikasi edukasi

| Level | Desktop | Mobile |
|---|---:|---:|
| Display | 36px | 30px |
| H1 | 30px | 24px |
| H2 | 24px | 20px |
| H3 | 20px | 18px |
| Body | 16px | 15–16px |
| Small | 14px | 14px |
| Caption | 12px | 12px |

---

## 6. Spacing & Radius

### Spacing
Gunakan skala:
`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80`

### Radius
- Small: 6px
- Medium: 10px
- Large: 14px
- XL: 18px
- Pill: 999px

Button: 8–10px  
Card: 12–14px  
Modal: 16px

---

## 7. Screen Inventory

### Beranda
Tujuan: akses cepat ke aktivitas belajar.

Isi:
- Header
- Greeting
- Overall progress
- Continue Learning
- Pilih Bab
- Quick Actions
- Statistik
- Achievement

Primary action: **Lanjut Belajar**

### Daftar Bab
Menampilkan Bab 01–30.

Setiap item:
- nomor bab
- judul
- jumlah vocabulary
- progress
- tombol mulai

Responsive:
- desktop: 3–4 kolom
- tablet: 2–3 kolom
- mobile: 1 kolom

### Chapter Detail
- judul bab
- progress
- jumlah vocabulary
- Mulai Quiz
- Flashcard
- daftar vocabulary
- filter `어휘` / `문화와 정보`

### Vocabulary Explorer
- search
- filter Bab
- filter kategori
- daftar vocabulary
- audio
- status mastered

### Flashcard
- kata Korea
- flip untuk arti
- audio
- Belum Hafal
- Sudah Hafal
- navigasi

### Quiz Setup
- Bab
- mode
- jumlah soal
- timer
- Mulai Quiz

### Quiz
- progress soal
- pertanyaan
- pilihan jawaban
- Jawab
- feedback

### Result
- skor
- benar/salah
- waktu
- XP
- streak
- Ulangi
- Review Kesalahan
- Kembali ke Bab

### Statistics
- vocabulary dipelajari
- mastered
- jumlah quiz
- accuracy
- progress per bab

---

## 8. Main User Flows

### Belajar
Beranda → Pilih Bab → Chapter Detail → Flashcard → Audio → Tandai Hafal → Progress

### Quiz
Beranda → Quiz → Setup → Mulai → Jawab → Feedback → Next → Result → Review

### Search
Vocabulary → Search → Filter → Result → Detail → Audio/Flashcard

### Continue Learning
Beranda → Continue Learning → Vocabulary terakhir → Lanjut

---

## 9. Component Library

### Button
Variants:
- Primary
- Secondary
- Ghost
- Danger
- Icon

States:
- default
- hover
- focus
- active
- disabled
- loading

### Card
Variants:
- Chapter
- Vocabulary
- Progress
- Statistic
- Quiz
- Result

States:
- default
- hover
- selected
- completed
- locked

### Progress Bar
Variants:
- chapter
- quiz
- XP
- mastery

### Badge
Contoh:
- BAB 17
- 어휘
- 문화와 정보
- Mastered

### Search
States:
- empty
- typing
- result
- no result
- error

### Audio Button
States:
- idle
- playing
- paused
- unavailable

---

## 10. Feedback & System States

### Correct
```text
✓
Jawaban Benar!
+10 XP
```
Kemudian lanjut otomatis.

### Wrong
```text
✕
Jawaban Salah
Coba sekali lagi.
```
Kesempatan kedua tetap tersedia.

### Empty
Tampilkan penjelasan singkat + satu primary action.

### Loading
Gunakan skeleton ringan.

### Error
Pesan yang mudah dipahami + tombol Muat Ulang.

### Offline
Tampilkan status offline tanpa memblokir fitur berbasis data lokal.

---

## 11. Responsive Behaviour

### Mobile < 640px
- single column
- bottom navigation
- button mudah disentuh
- pilihan quiz satu kolom
- padding 16px
- tanpa horizontal scrolling

### Tablet 640–1024px
- 2 kolom card
- statistics 2 kolom
- content tetap fokus

### Desktop > 1024px
- sidebar
- max-width 1200–1280px
- chapter grid 3–4 kolom
- content area lebih luas

---

## 12. Navigation

### Desktop
```text
EPS-TOPIK

⌂ Beranda
▣ Bab
📖 Kosakata
▤ Quiz
▤ Statistik
⚙ Pengaturan
```

### Mobile
```text
⌂     Bab     Quiz     Vocab     •••
Home  Chapter Quiz     Vocab    More
```

Maksimal 5 item.

---

## 13. Accessibility

- Kontras minimal 4.5:1 untuk teks normal
- 3:1 untuk teks besar
- visible focus state
- keyboard navigation
- semantic HTML
- jangan menggunakan warna sebagai satu-satunya indikator
- gunakan `aria-label` bila diperlukan
- feedback quiz menggunakan `aria-live="polite"`
- tidak ada keyboard trap pada modal

---

## 14. Motion

### Allowed
- hover: 120–160ms
- card transition: 150–200ms
- modal: 180–220ms
- progress update
- flashcard flip
- timer warning

### Tidak digunakan
- infinite floating
- particles
- continuous glow
- bouncing decoration
- parallax
- animated gradient background

---

## 15. Performance & Technology

Gunakan:
- HTML5
- CSS3
- Vanilla JavaScript

Tidak menggunakan React, Vue, atau Angular kecuali diminta.

Tidak membutuhkan backend/database server.

Data menggunakan file lokal.

Struktur:
```text
/
├── index.html
├── style.css
├── script.js
├── data/
│   ├── vocabulary.json
│   └── chapters.json
├── assets/
│   ├── icons/
│   └── images/
└── README.md
```

---

## 16. Progress & Local Storage

Simpan:
- XP
- Level
- Streak
- highest score
- quiz history
- chapter progress
- vocabulary mastered
- flashcard progress
- dark mode
- timer setting
- jumlah soal

Key:
```text
epsTopikProgress
epsTopikSettings
epsTopikQuizHistory
```

---

## 17. Anti-AI-Slop Rules

1. Tidak ada gradient besar sebagai background utama.
2. Tidak semua elemen dibuat rounded ekstrem.
3. Tidak menggunakan glassmorphism di setiap card.
4. Tidak menggunakan glow biru sebagai dekorasi.
5. Tidak semua section dibuat card.
6. Tidak menggunakan ikon hanya untuk dekorasi.
7. Tidak ada animasi tanpa fungsi.
8. Tidak membuat dashboard terlalu padat.
9. Typography dan spacing menjadi hierarchy utama.
10. Setiap elemen visual harus memiliki fungsi UX.

---

## 18. Final Direction

Identitas visual utama:

**Typography → Spacing → Hierarchy → Blue Accent**

Bukan:

**Gradient → Glow → Glass → Animation**

Target akhirnya adalah website edukasi yang terasa nyata, ringan, profesional, nyaman digunakan berulang kali, dan tidak terlihat seperti template AI.
