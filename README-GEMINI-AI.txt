# Update AI Tutor Gemini + konteks Bab

Perubahan hanya untuk proyek WEBSITE. APK Android tidak diubah.

## Fitur
- AI Tutor menggunakan Gemini API melalui Cloudflare Pages Function `/api/ai`.
- API key tidak disimpan di `app.js`, HTML, maupun file frontend.
- Pemilih Bab 1–60 pada halaman AI Tutor. Bab yang dipilih disimpan di browser.
- Prompt AI menyertakan judul Bab, nama Indonesia/Korea, serta daftar kosakata Bab aktif.
- Pertanyaan eksplisit seperti “Bab 12” akan mengutamakan Bab 12; frasa “bab ini” memakai Bab yang dipilih.
- Jika belum ada Bab aktif dan pengguna bertanya “bab ini”, AI akan meminta klarifikasi.

## Wajib dilakukan sebelum deploy
1. Karena API key pernah dikirim di chat, cabut/revoke key tersebut di Google AI Studio dan buat key baru. Jangan gunakan kembali key yang sudah terpapar.
2. Deploy folder ini melalui integrasi GitHub → Cloudflare Pages (agar folder `functions/` diproses sebagai Pages Functions).
3. Di Cloudflare Dashboard, buka Workers & Pages → proyek Pages → Settings → Variables and Secrets. Tambahkan secret bernama `GEMINI_API_KEY` dengan key baru. Jangan tulis key ke file proyek atau GitHub.
4. Opsional: tambahkan variable `GEMINI_MODEL` jika ingin memilih model yang tersedia untuk project Google AI Studio. Default di fungsi adalah `gemini-3.8-flash`; ubah jika model tersebut tidak tersedia untuk akun/proyek.
5. Redeploy. Setelah deploy, buka AI Tutor dan uji dengan memilih Bab, lalu bertanya “Ringkas bab ini”.

Jika saat ini situs di-host sebagai file statis tanpa Cloudflare Pages Functions, endpoint `/api/ai` tidak akan tersedia sampai proyek di-deploy melalui metode yang mendukung Functions.
