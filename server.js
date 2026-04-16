const express = require("express");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
app.use(express.json());

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function notionHeaders(token) {
  return {
    "Authorization": `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

// 단어 목록 조회
app.get("/api/vocab", async (req, res) => {
  const { token, database_id } = req.headers;
  if (!token || !database_id) return res.status(400).json({ error: "token, database_id 헤더 필요" });

  try {
    const r = await fetch(`${NOTION_API}/databases/${database_id}/query`, {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify({ page_size: 100, sorts: [{ timestamp: "created_time", direction: "descending" }] }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.message || "Notion 오류" });

    const vocab = (data.results || []).map(page => ({
      id: page.id,
      word: page.properties.Name?.title?.[0]?.plain_text || "",
      meaning: page.properties.Meaning?.rich_text?.[0]?.plain_text || "",
      pos: page.properties.POS?.select?.name || "",
    })).filter(v => v.word);

    res.json(vocab);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 단어 추가
app.post("/api/vocab", async (req, res) => {
  const { token, database_id } = req.headers;
  const { word, meaning, pos } = req.body;
  if (!token || !database_id) return res.status(400).json({ error: "token, database_id 헤더 필요" });
  if (!word) return res.status(400).json({ error: "word 필요" });

  try {
    const body = {
      parent: { database_id },
      properties: {
        Name: { title: [{ text: { content: word } }] },
        Meaning: { rich_text: [{ text: { content: meaning || "" } }] },
        ...(pos ? { POS: { select: { name: pos } } } : {}),
      },
    };
    const r = await fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.message || "Notion 오류" });

    res.json({ id: data.id, word, meaning, pos });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 단어 삭제 (아카이브)
app.delete("/api/vocab/:id", async (req, res) => {
  const { token } = req.headers;
  const { id } = req.params;
  if (!token) return res.status(400).json({ error: "token 헤더 필요" });

  try {
    const r = await fetch(`${NOTION_API}/pages/${id}`, {
      method: "PATCH",
      headers: notionHeaders(token),
      body: JSON.stringify({ archived: true }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.message || "Notion 오류" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// HTML 서빙
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "bbc-toeic.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BBC TOEIC Daily → http://localhost:${PORT}`);
});
