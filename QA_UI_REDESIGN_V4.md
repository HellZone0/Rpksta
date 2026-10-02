# QA UI Redesign V4

Tanggal: 2026-10-02

## Structural checks
- `script.js` lolos `node --check`.
- `data/vocabulary.json` valid JSON dan berisi 2.355 entri.
- `data/chapters.json` valid JSON dan berisi 30 bab.
- Rentang bab vocabulary: 1–30.
- `script.js` tidak berubah dari source ZIP sebelumnya.
- `vocabulary.json` tidak berubah dari source ZIP sebelumnya.
- `chapters.json` tidak berubah dari source ZIP sebelumnya.

## CSS checks
- CSS berhasil diparse Chromium dengan 204 CSS rules.
- Tidak ada `backdrop-filter`.
- Tidak ada `linear-gradient`.
- Tidak ada `radial-gradient`.
- Mobile hero: satu kolom.
- Desktop hero: dua kolom.
- `prefers-reduced-motion` tersedia.

## Catatan
Smoke test penuh aplikasi menggunakan HTTP local server tidak dapat dijalankan pada environment ini karena navigasi Chromium ke localhost diblokir oleh environment (`ERR_BLOCKED_BY_ADMINISTRATOR`). Karena itu, validasi aplikasi end-to-end melalui runtime tidak diklaim sebagai lulus penuh.
