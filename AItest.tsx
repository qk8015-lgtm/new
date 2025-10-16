import { GoogleGenAI } from "@google/genai";
import React, { useEffect, useMemo, useRef, useState } from "react";

/** 與你原本一致的型別 */
export type Part = { text: string };
export type ChatMsg = { role: "user" | "model"; parts: Part[] };

type Props = { defaultModel?: string };

function Lines({ text }: { text: string }) {
  return <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{text}</div>;
}

export default function AItest({ defaultModel = "gemini-2.0-flash" }: Props) {
  // ---- 狀態 ----
  const [model, setModel] = useState(defaultModel);
  const [apiKey, setApiKey] = useState("");
  const [rememberKey, setRememberKey] = useState(true);

  const [history, setHistory] = useState<ChatMsg[]>([
    { role: "model", parts: [{ text: "🎀 校園/社團活動幫手已就緒！請先貼上 Gemini API Key，再提出你的需求～" }] },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  // ---- 校園/社團參數（可在 system 指令中使用）----
  const [budgetMax, setBudgetMax] = useState<number | "">("");
  const [audiences, setAudiences] = useState<string[]>(["大學生"]);
  const [tone, setTone] = useState<"活潑" | "專業" | "走心">("活潑");
  const [platforms, setPlatforms] = useState<string[]>(["IG"]);
  const [hashtags, setHashtags] = useState("#社團 #週末活動 #台北");
  const [cta, setCta] = useState("立即私訊報名 / tag 你的同學一起來！");

  // 讀 localStorage 的 key
  useEffect(() => {
    const saved = localStorage.getItem("gemini_api_key");
    if (saved) setApiKey(saved);
  }, []);

  // 自動捲到底
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history, loading]);

  // ✅ 用 @google/genai 正確初始化
  const ai = useMemo(() => {
    try {
      return apiKey ? new GoogleGenAI({ apiKey }) : null;
    } catch (e) {
      console.error("Init error:", e);
      return null;
    }
  }, [apiKey]);

  // 系統指令（人格 + 場景）
  function buildSystemPrompt() {
    const lines: string[] = [];
    lines.push("你是專業的校園/社團活動行銷與企劃助手，回答要實用、可執行。");
    if (budgetMax !== "" && Number(budgetMax) >= 0) lines.push(`・預算上限：每人 NT$${budgetMax}`);
    if (audiences.length) lines.push(`・宣傳對象：${audiences.join("、")}`);
    if (platforms.length) lines.push(`・發文平台：${platforms.join(" / ")}`);
    lines.push(`・文案語氣：${tone}`);
    if (hashtags.trim()) lines.push(`・Hashtags：${hashtags}`);
    if (cta.trim()) lines.push(`・CTA：${cta}`);
    lines.push("輸出優先：活動清單/示範（含地點/時間/費用）→ 社群貼文範本（含 emoji/hashtag）→ 可執行的行銷建議。");
    return lines.join("\n");
  }

  // 🔎 測試連線（最小請求）
  async function pingGemini() {
    if (!ai) { setError("請先貼 Gemini API Key"); return; }
    setError("");
    setLoading(true);
    try {
      const resp = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      const text = resp.text || "";
      setHistory(h => [...h, { role: "model", parts: [{ text: `✅ 連線成功：${text}` }] }]);
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError(msg);
      setHistory(h => [...h, { role: "model", parts: [{ text: `❌ 連線失敗：${msg}` }] }]);
    } finally {
      setLoading(false);
    }
  }

  // 送出訊息
  async function sendMessage(message?: string) {
    const userText = (message ?? input).trim();
    if (!userText || loading) return;
    if (!ai) { setError("請先輸入有效的 Gemini API Key"); return; }

    setError("");
    setLoading(true);
    setHistory(h => [...h, { role: "user", parts: [{ text: userText }] }]);
    setInput("");

    try {
      // 用 system prompt + 單次 user 輸入，避免把整段 history 丟回去造成 token 浪費
      const system = buildSystemPrompt();
      const resp = await ai.models.generateContent({
        model,
        contents: [
          { role: "model", parts: [{ text: system }] },
          { role: "user", parts: [{ text: userText }] },
        ],
      });

      const reply = resp.text || "[No content]";
      setHistory(h => [...h, { role: "model", parts: [{ text: reply }] }]);
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError(msg);
      setHistory(h => [...h, { role: "model", parts: [{ text: `⚠ ${msg}` }] }]);
    } finally {
      setLoading(false);
    }
  }

  function toggle(list: string[], v: string, set: (x: string[]) => void) {
    if (list.includes(v)) set(list.filter(x => x !== v));
    else set([...list, v]);
  }

  const quicks = [
    "幫我找本週末台北 3 場適合大學生的社團活動（附地點/時間/費用）。",
    "寫 3 則不同語氣（活潑/專業/走心）的招募文案，每則 80~120 字。",
    "把以下貼文優化、加入 hashtag 與更明確 CTA：\n【在此貼上原文】",
  ];

  return (
    <div style={ui.page}>
      <div style={ui.card}>
        {/* Header */}
        <div style={ui.header}>
          <div style={ui.title}>🎀 校園/社團活動幫手</div>
          <div style={ui.headerRight}>
            <input
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="例如：gemini-2.0-flash"
              style={ui.chipInput}
            />
            <input
              type="password"
              value={apiKey}
              onChange={e => {
                const v = e.target.value;
                setApiKey(v);
                if (rememberKey) localStorage.setItem("gemini_api_key", v);
              }}
              placeholder="貼上 Gemini API Key（AI Studio 產的 AIza...）"
              style={ui.keyInput}
            />
            <label style={ui.remember}>
              <input
                type="checkbox"
                checked={rememberKey}
                onChange={e => {
                  setRememberKey(e.target.checked);
                  if (!e.target.checked) localStorage.removeItem("gemini_api_key");
                  else if (apiKey) localStorage.setItem("gemini_api_key", apiKey);
                }}
              />
              記住 Key（僅本機）
            </label>
            <button type="button" onClick={pingGemini} style={ui.ghostBtn}>測試連線</button>
          </div>
        </div>

        {/* 粉色設定面板 */}
        <div style={ui.panel}>
          <label style={ui.label}>
            <span>預算上限（NT$ / 人）</span>
            <input
              type="number"
              min={0}
              value={budgetMax}
              onChange={e => setBudgetMax(e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0))}
              placeholder="例如 300"
              style={ui.input}
            />
          </label>

          <div style={ui.label}>
            <span>宣傳對象（多選）</span>
            <div style={ui.tags}>
              {["大學生", "新生", "校友", "老師", "社群大眾"].map(a => {
                const active = audiences.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggle(audiences, a, setAudiences)}
                    style={{ ...ui.tag, ...(active ? ui.tagActive : {}) }}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          <label style={ui.label}>
            <span>文案語氣</span>
            <select value={tone} onChange={e => setTone(e.target.value as any)} style={ui.input}>
              <option value="活潑">活潑</option>
              <option value="專業">專業</option>
              <option value="走心">走心</option>
            </select>
          </label>

          <div style={ui.label}>
            <span>平台（多選）</span>
            <div style={ui.platforms}>
              {["IG", "FB", "Threads", "Discord"].map(p => (
                <label key={p} style={ui.checkItem}>
                  <input
                    type="checkbox"
                    checked={platforms.includes(p)}
                    onChange={() => toggle(platforms, p, setPlatforms)}
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>

          <label style={ui.label}>
            <span>Hashtags</span>
            <input value={hashtags} onChange={e => setHashtags(e.target.value)} style={ui.input} />
          </label>

          <label style={ui.label}>
            <span>Call-To-Action（CTA）</span>
            <input value={cta} onChange={e => setCta(e.target.value)} style={ui.input} />
          </label>
        </div>

        {/* 訊息列表 */}
        <div ref={listRef} style={ui.messages}>
          {history.map((m, i) => (
            <div key={i} style={{ ...ui.msg, ...(m.role === "user" ? ui.user : ui.assistant) }}>
              <div style={ui.msgRole}>{m.role === "user" ? "You" : "Assistant"}</div>
              <div style={ui.msgBody}><Lines text={m.parts.map(p => p.text).join("\n")} /></div>
            </div>
          ))}
          {loading && <div style={{ ...ui.msg, ...ui.assistant }}>思考中…</div>}
        </div>

        {/* 輸入列 */}
        <form onSubmit={e => { e.preventDefault(); sendMessage(); }} style={ui.composer}>
          <input
            placeholder="輸入需求（例如：幫我整理 3 場活動 + 3 種語氣文案）"
            value={input}
            onChange={e => setInput(e.target.value)}
            style={ui.textInput}
          />
          <button type="submit" disabled={loading || !input.trim() || !apiKey} style={ui.primaryBtn}>送出</button>
        </form>

        {/* 快速提問 */}
        <div style={ui.quickWrap}>
          {quicks.map(q => (
            <button key={q} type="button" onClick={() => sendMessage(q)} style={ui.quickBtn}>{q}</button>
          ))}
        </div>

        {error && <div style={ui.error}>⚠ {error}</div>}
      </div>
    </div>
  );
}

/* 粉色系樣式 */
const pink = {
  bg: "#fff1f5",
  card: "#fff",
  border: "#fbcfe8",
  textDark: "#4a001e",
  chip: "#fdf2f8",
  chipBorder: "#fbcfe8",
  chipActive: "#ec4899",
  chipActiveText: "#fff",
  btn: "#ec4899",
  btnText: "#fff",
  ghost: "#fff",
  ghostBorder: "#ec4899",
};

const ui: Record<string, React.CSSProperties> = {
  page: { display: "grid", placeItems: "start", padding: 16, background: pink.bg, minHeight: "100vh" },
  card: { width: "min(980px, 100%)", background: pink.card, border: `1px solid ${pink.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 10px 24px rgba(236,72,153,0.12)" },
  header: { display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: `1px solid ${pink.border}`, background: "#ffe4e6" },
  title: { fontWeight: 900, color: pink.textDark },
  headerRight: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  chipInput: { padding: "8px 12px", borderRadius: 999, border: `1px solid ${pink.border}`, background: pink.chip, fontSize: 12, width: 180, color: pink.textDark },
  keyInput: { padding: "8px 12px", borderRadius: 999, border: `1px solid ${pink.border}`, background: pink.chip, fontSize: 12, width: 300, color: pink.textDark },
  remember: { fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: pink.textDark },
  ghostBtn: { padding: "8px 12px", borderRadius: 999, background: pink.ghost, border: `1px solid ${pink.ghostBorder}`, color: pink.textDark, cursor: "pointer", fontWeight: 700 },
  panel: { display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: 12, padding: 14, background: "#fff5f7", borderBottom: `1px dashed ${pink.border}` },
  label: { display: "grid", gap: 6, fontSize: 13, fontWeight: 700, color: pink.textDark },
  input: { padding: "10px 12px", borderRadius: 12, border: `1px solid ${pink.border}`, background: pink.chip, color: pink.textDark },
  tags: { display: "flex", gap: 8, flexWrap: "wrap" },
  tag: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${pink.chipBorder}`, background: pink.chip, fontSize: 12, cursor: "pointer", color: pink.textDark },
  tagActive: { background: pink.chipActive, borderColor: pink.chipActive, color: pink.chipActiveText },
  platforms: { display: "flex", gap: 12, flexWrap: "wrap" },
  checkItem: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: pink.textDark },
  messages: { padding: 14, display: "grid", gap: 10, maxHeight: 460, overflow: "auto", background: "#fff" },
  msg: { borderRadius: 12, padding: 10, border: `1px solid ${pink.border}` },
  user: { background: "#fdf2f8" },
  assistant: { background: "#fff7fb" },
  msgRole: { fontSize: 12, fontWeight: 800, opacity: 0.7, color: pink.textDark, marginBottom: 6 },
  msgBody: { fontSize: 14, lineHeight: 1.6, color: pink.textDark },
  composer: { display: "grid", gridTemplateColumns: "1fr auto", gap: 8, padding: 14, borderTop: `1px solid ${pink.border}`, background: "#fff5f7" },
  textInput: { padding: "12px 14px", borderRadius: 999, border: `1px solid ${pink.border}`, background: pink.chip, color: pink.textDark },
  primaryBtn: { padding: "12px 16px", borderRadius: 999, background: pink.btn, color: pink.btnText, border: "none", cursor: "pointer", fontWeight: 800 },
  quickWrap: { display: "flex", gap: 8, flexWrap: "wrap", padding: "0 14px 14px" },
  quickBtn: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${pink.border}`, background: "#fff", cursor: "pointer", fontSize: 12, color: pink.textDark },
  error: { color: "#b91c1c", padding: "6px 14px", fontWeight: 700 },
};
