export async function onRequestPost({ request, env }) {
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
  // Fallback key requested by the site owner. Prefer setting GEMINI_API_KEY as a Cloudflare secret.
  const apiKey = env.GEMINI_API_KEY || "AQ.Ab8RN6I--lKq5qHszq_r0VX75PbVPleqUWrBjNpkEoCC75aHDA";
  if (!apiKey) return json({ error: "API key Gemini belum diatur." }, 500);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Format permintaan tidak valid." }, 400); }
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return json({ error: "Pertanyaan masih kosong." }, 400);
  if (prompt.length > 18000) return json({ error: "Konteks terlalu panjang. Coba tanyakan bagian yang lebih spesifik." }, 413);

  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  let upstream;
  try {
    upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 1800 }
      })
    });
  } catch {
    return json({ error: "Tidak dapat terhubung ke layanan Gemini. Coba lagi nanti." }, 502);
  }
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const message = data?.error?.message || `Gemini API mengembalikan HTTP ${upstream.status}.`;
    return json({ error: message }, upstream.status === 429 ? 429 : 502);
  }
  const answer = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("\n").trim();
  if (!answer) return json({ error: "Gemini tidak mengirimkan jawaban teks. Coba pertanyaan lain." }, 502);
  return json({ answer });
}
