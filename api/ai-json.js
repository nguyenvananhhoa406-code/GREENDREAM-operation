// Giống ai-text.js, nhưng ép Claude trả về JSON và tự bóc tách JSON ra
// (đề phòng Claude lỡ bọc thêm chữ hoặc ```json quanh kết quả).
// Dùng cho: đọc bill (docBillAI), quét trend, chấm điểm trend tự nhập.

function boTachJSON(text) {
  let t = String(text || "").trim();
  const rao = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (rao) t = rao[1].trim();
  const iCong = t.indexOf("{");
  const iVuong = t.indexOf("[");
  let start = -1;
  if (iCong === -1) start = iVuong;
  else if (iVuong === -1) start = iCong;
  else start = Math.min(iCong, iVuong);
  const end = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

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

  // Việc đọc bill / quét trend không cần model đắt tiền - mặc định dùng bản
  // rẻ hơn (Haiku) cho tiết kiệm. Đổi ở biến môi trường ANTHROPIC_MODEL_JSON
  // trong Vercel nếu muốn dùng bản khác.
  const model = process.env.ANTHROPIC_MODEL_JSON || process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

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
        max_tokens: 1200,
        messages: [
          {
            role: "user",
            content:
              prompt +
              "\n\nChỉ trả về JSON hợp lệ, không thêm chữ nào khác, không bọc trong ```.",
          },
        ],
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || "Lỗi gọi Claude";
      // trả 200 kèm error để phía web (đang chờ .data hoặc .error) xử lý êm, không throw network error
      res.status(200).json({ error: msg });
      return;
    }

    const raw = (data.content || []).map((c) => c.text || "").join("");
    try {
      const parsed = boTachJSON(raw);
      res.status(200).json({ data: parsed });
    } catch (e) {
      res.status(200).json({ error: "Claude trả sai định dạng JSON" });
    }
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
