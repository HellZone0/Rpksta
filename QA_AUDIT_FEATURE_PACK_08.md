# QA Audit — EPS-TOPIK Feature Pack 08

Tanggal: 2026-10-02

## Hasil
- Arsip sumber Feature Pack 07 dapat diekstrak tanpa error.
- `script.js` lulus `node --check`.
- `chapters.json`: 30 Bab.
- `vocabulary.json`: 2.355 entri.
- Semua entri memiliki `id`, `bab`, `korea`, `arti`, `sumber`, dan `kategori`.
- ID kosakata unik.
- Tidak ada Bab di luar 1–30.
- Tidak ada duplikasi Korea dalam Bab + sumber yang sama.
- Tidak ada replacement character `�` atau whitespace luar pada Korea/arti.
- `받치다` tetap dipertahankan; `발치다` tidak digunakan.

## Perbaikan yang diterapkan
1. Timer simulasi tidak lagi memanggil `render()` setiap detik. DOM quiz tetap stabil; hanya elemen `.exam-timer` yang diperbarui.
2. Animasi masuk pada mode ujian dimatikan untuk kartu, wrapper, pertanyaan, choices, dan progress. Hanya `.exam-timer` yang melakukan pulse.
3. Popup jawaban benar tidak memiliki tombol “Berikutnya”. Popup ditutup otomatis sebelum soal berikutnya.
4. Jawaban salah dalam simulasi ujian masuk ke daftar review hasil.
5. “Coba Lagi” mempertahankan mode dan kumpulan soal sebelumnya.
6. Label ujian diperjelas menjadi “Ujian · Tanpa kesempatan kedua”.
7. Cache-busting HTML/CSS/JS dan service worker dinaikkan ke `20261002-feature-pack-08`.

## Fitur yang dipertahankan
- Bab 1–30 dan 2.355 kosakata.
- `어휘` + `문화와 정보`.
- Pencarian global dan filter Bab.
- Kartu Belajar.
- Audio Korea via Speech Synthesis.
- Listening Quiz.
- Kosakata Sulit.
- Review Jawaban Salah.
- Simulasi Ujian 20 menit.
- XP, level, streak, achievement.
- Statistik per Bab.
- Backup/restore progress.
- Dark/light mode.
- Mobile bottom navigation.
- PWA/service worker.
