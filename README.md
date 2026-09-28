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
