# EPS-TOPIK Flat Design V5

Rombakan UI total ke gaya flat design.

## Prinsip
- Warna solid dan hierarchy tipografi.
- Border 1px sebagai pemisah utama.
- Tanpa gradient, glassmorphism, blur, glow, dan shadow dekoratif.
- Animasi hanya untuk feedback fungsional.
- Data dan quiz engine tetap dipertahankan.

## File yang diubah
- `style.css` — sistem visual Flat Design V5.
- `index.html` — cache-busting dan theme color.
- `sw.js` — cache version V5 agar CSS baru tidak tertahan cache lama.
- `manifest.webmanifest` — background/theme color.

## File inti yang dipertahankan
- `script.js`
- `data/vocabulary.json` (2.355 entri)
- `data/chapters.json` (30 bab)

## Menjalankan
Jalankan melalui web server agar `fetch()` data JSON bekerja, misalnya:

```bash
python -m http.server 8000
```

Lalu buka folder website melalui browser.
