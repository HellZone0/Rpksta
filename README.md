# EPS-TOPIK Latihan Kosakata Bab 1–30

Website statis HTML/CSS/JavaScript vanilla, siap dijalankan lokal, Vercel, atau Cloudflare Pages.

## Isi
- `index.html` — halaman utama
- `style.css` — tampilan responsif dan mode gelap
- `script.js` — navigasi, pencarian kosakata, kartu belajar, latihan, statistik, localStorage
- `data/chapters.json` — metadata Bab 1–30 dan jumlah kosakata per bab
- `data/vocabulary.json` — dataset kosakata lengkap Bab 1–30
- `data/audit_bab1-30.json` — audit per bab
- `data/audit_manifest.json` — ringkasan metode dan hasil audit
- `AUDIT_LAPORAN.md` — laporan pemeriksaan kelengkapan

## Menjalankan lokal
Buka `index.html`, atau jalankan server statis:

```bash
python3 -m http.server 8000
```

Lalu buka `http://localhost:8000`.

## Deploy
Tidak membutuhkan backend atau database. Untuk Vercel/Cloudflare Pages, unggah isi folder proyek ini sebagai situs statis.

## Cakupan data
Dataset mencakup:
1. Semua entri pada bagian `어휘 / KOSAKATA` Bab 1–30 yang sudah tersedia dalam dataset sumber.
2. Glosarium istilah leksikal dari seluruh **30 halaman `문화와 정보 / Budaya & Informasi`**, satu halaman untuk setiap bab.
3. Arti Indonesia mengikuti terjemahan pada PDF sejauh didukung sumber; istilah dipertahankan dalam bahasa Korea.
4. Untuk bagian `문화와 정보`, bentuk kata dinormalisasi ke bentuk leksikal/dasar agar dapat dipelajari dan dicari tanpa harus menghafal semua perubahan akhiran gramatikal.
5. Kata/istilah yang sama di bab berbeda tetap disimpan pada bab sumbernya.

**Catatan penting:** bagian `문화와 정보` pada buku berbentuk bacaan/informasi, bukan tabel `어휘` resmi. Karena permintaan proyek adalah memasukkan kosakata `정보` untuk belajar dan ujian harian, istilah leksikal yang relevan dari bacaan tersebut disusun sebagai glosarium tambahan. Jadi jumlah `문화와 정보` bukan klaim jumlah kosakata resmi yang dicetak sebagai tabel oleh buku.

## Audit
Laporan audit memeriksa 30/30 halaman `문화와 정보`, keberadaan Bab 1–30, field data wajib, dan duplikasi Korea dalam bab yang sama. Jumlah pada card bab dihitung otomatis dari dataset, bukan hard-code.

## Perbaikan Quiz — 28 September 2026

- Memilih opsi jawaban **tidak langsung berpindah soal**.
- Setelah memilih opsi, tombol **Jawab** harus ditekan.
- Jawaban benar menampilkan konfirmasi dan tombol **Soal Berikutnya**.
- Jawaban salah pertama menampilkan notifikasi dan memberi kesempatan kedua.
- Jawaban salah kedua menampilkan jawaban yang benar dan tombol **Soal Berikutnya**.
- Opsi yang sudah salah tidak dapat dipilih lagi pada soal yang sama.
- Jumlah kosakata pada kartu Bab dihitung langsung dari `vocabulary.json`, sehingga Bab 1–30 menampilkan jumlah dataset aktual.
- `chapters.json` dan `vocabulary.json` dimuat dengan cache-busting version agar deployment baru tidak terus mengambil JSON lama dari cache browser/CDN.


## Perbaikan versi 20260928-quizfix-02
- Field `sumber` pada seluruh 2.355 entri disinkronkan dengan jumlah utama/informasi per bab.
- Jumlah pada kartu Bab dihitung langsung dari `vocabulary.json`.
- Pilihan jawaban kuis tidak boleh memiliki arti Indonesia yang sama.
- Kategori di-reset otomatis saat berpindah bab agar tidak menghasilkan daftar kosong palsu.
- Popup pembuat hanya muncul pada kunjungan pertama di perangkat/browser.
- Modal jawaban lama yang tidak digunakan dihapus; feedback kuis tetap inline.
- Cache-busting dataset dinaikkan ke `20260928-quizfix-02`.


## Audit typo terbaru
Versi dataset: `20260928-typo-audit-03`. Pemeriksaan ejaan Korea terhadap PDF sumber telah dilakukan; lihat `TYPO_AUDIT.md` dan `data/typo_audit.json`.

## Feature Pack 01 — 2026-09-28

Pembaruan UI/fitur yang ditambahkan:
- Status penguasaan kosakata: Belum dipelajari, Perlu latihan, Sering salah, Dikuasai.
- Filter kosakata berdasarkan status dan indikator kesalahan/favorit.
- Statistik lebih detail: akurasi, streak, XP, penguasaan total, progress dan akurasi per Bab 1–30.
- Kartu Belajar dengan animasi flip 3D, tombol “Perlu diulang” dan “Saya tahu”.
- Achievement/Pencapaian yang tersimpan di localStorage.
- Sistem Level berbasis XP.
- Mobile bottom navigation: Beranda, Kosakata, Latihan, Kartu, Statistik.
- Tinjau Jawaban setelah quiz untuk soal yang pernah salah, dengan shortcut kembali ke Kartu Belajar.

Data tetap menggunakan `data/vocabulary.json` (2.355 entri) dan `data/chapters.json` (30 Bab).


## Feature Pack 03
- Jawaban benar otomatis berpindah ke soal berikutnya setelah feedback singkat.
- Search kosakata dapat digunakan untuk seluruh Bab 1–30 dan mencari nomor/judul Bab.
- Setiap kartu kosakata menampilkan nomor + nama Bab.
- UI diringankan: tanpa radial background besar, blur berat, dan shadow berlebihan.


### Feature Pack 04 — Quiz Feedback
- Pilihan jawaban tidak lagi menjalankan animasi kedip saat dipilih.
- Jawaban benar menampilkan popup tengah `✓ Jawaban Benar!` sebelum otomatis pindah ke soal berikutnya.
- Popup benar menampilkan jawaban yang benar dan +10 XP.
- Popup salah/aturan 2 kesempatan tetap dipertahankan.


## Feature Pack 06 — No Regression Build
- Base UI retained from Feature Pack 03: lightweight cards, reduced shadows, no heavy radial/background effects, global search, chapter labels.
- Feature Pack 04 quiz feedback retained: selection does not blink; correct-answer center popup; auto-next; two-attempt wrong-answer flow.
- Feature Pack 05 learning suite retained: Korean speech synthesis, listening mode, difficult/review modes, exam simulation, source filter, backup/restore, progress/streak/XP/achievements, PWA.
- Service worker updated to network-first for app-shell files and cache-busted assets to reduce stale deployment issues.


## Feature Pack 08
- Correct-answer popup auto-closes before advancing, preventing a stale modal from blocking the next listening question.
- The correct popup no longer shows a disabled 'Berikutnya otomatis…' button.
- Exam mode disables question/card/choice entrance animations so the whole question does not blink every timer refresh; only the timer pulses.


## Feature Pack 08 — QA & Fixes
- Memperbaiki timer Simulasi Ujian agar tidak me-render ulang seluruh kartu setiap detik; hanya angka timer yang diperbarui.
- Animasi exam dimatikan pada kartu, pertanyaan, pilihan, dan progress; hanya timer yang melakukan pulse.
- Popup jawaban benar tetap tanpa tombol tindakan dan otomatis ditutup sebelum soal berikutnya.
- Review jawaban salah pada Simulasi Ujian sekarang tetap tercatat di hasil.
- Tombol Coba Lagi mempertahankan mode latihan dan kumpulan soal sebelumnya.
- Label Simulasi Ujian tidak lagi menampilkan “Kesempatan 2 dari 2”; mode ujian langsung lanjut setelah jawaban.
- Cache-busting HTML/CSS/JS dan service worker dinaikkan ke versi 08.
- Pemeriksaan JSON, jumlah Bab, jumlah kosakata, ID, duplikasi, whitespace, dan sintaks JavaScript dilakukan sebelum paket dibuat.


## Feature Pack 09 — Audio slash pause
- Korean listening now treats `/` as a pronunciation separator.
- Each Korean variant is spoken as a separate SpeechSynthesis utterance.
- A 650 ms pause is inserted between slash-separated terms to prevent the voices from running together.
- Speech rate is slightly reduced to 0.80 for clearer listening.
- Existing quiz, listening, exam, UI, data, and progress features are preserved.

## Feature Pack 11 additions
- Review Terjadwal (spaced repetition)
- Daily Challenge 10 soal + bonus XP harian
- Pengaturan kecepatan audio Korea dan jeda tanda `/`
- Statistik sesi listening dan aktivitas 7 hari
- Persentase kosakata dikuasai per Bab
