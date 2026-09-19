// Trạm trung gian: web gọi vào đây, đây mới là chỗ giữ API key bí mật rồi
// gọi sang Claude. Dùng cho các nút viết văn bản tự do (vd: "Claude viết giúp" caption).
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "thiếu prompt" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Chưa cấu hình ANTHROPIC_API_KEY trong Vercel (Settings → Environment Variables)" });
    return;
  }

  // Nếu Anthropic đổi tên model, sửa biến ANTHROPIC_MODEL trong Vercel là đủ,
  // không cần sửa code này.
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || "Lỗi gọi Claude";
      res.status(r.status).json({ error: msg });
      return;
    }

    const text = (data.content || []).map((c) => c.text || "").join("");
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
