const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // AI endpoint called by app.js: POST /api/ai with { "prompt": "..." }
    if (url.pathname === "/api/ai") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Allow": "POST, OPTIONS",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      if (request.method !== "POST") {
        return json({ error: "Gunakan metode POST untuk endpoint AI." }, 405);
      }

      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        return json({
          error: "Secret GEMINI_API_KEY belum diatur di Cloudflare Workers.",
        }, 500);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Format permintaan tidak valid." }, 400);
      }

      const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
      if (!prompt) return json({ error: "Pertanyaan masih kosong." }, 400);
      if (prompt.length > 18000) {
        return json({ error: "Konteks terlalu panjang. Coba tanyakan bagian yang lebih spesifik." }, 413);
      }

      const model = env.GEMINI_MODEL || "gemini-2.5-flash";
      let upstream;
      try {
        upstream = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.35, maxOutputTokens: 1800 },
            }),
          }
        );
      } catch {
        return json({ error: "Tidak dapat terhubung ke layanan Gemini. Coba lagi nanti." }, 502);
      }

      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        const message = data?.error?.message || `Gemini API mengembalikan HTTP ${upstream.status}.`;
        return json({ error: message }, upstream.status === 429 ? 429 : 502);
      }

      const answer = (data?.candidates?.[0]?.content?.parts || [])
        .map((part) => part.text || "")
        .join("\n")
        .trim();

      if (!answer) {
        return json({ error: "Gemini tidak mengirimkan jawaban teks. Coba pertanyaan lain." }, 502);
      }

      return json({ answer });
    }

    // Serve the existing static EPS-TOPIK website and its data/PDF files.
    return env.ASSETS.fetch(request);
  },
};
