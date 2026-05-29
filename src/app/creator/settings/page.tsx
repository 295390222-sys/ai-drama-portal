"use client";

import { useEffect, useState } from "react";

const API_PROXY = "/api/chat";

const PROVIDERS = [
  {
    id: "openrouter",
    label: "🚀 OpenRouter",
    desc: "综合推荐，海外模型多",
    keyPlaceholder: "sk-or-v1-...",
    keyHint: "在 openrouter.ai/keys 免费获取",
    models: [
      { value: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash", tag: "免费" },
      { value: "google/gemini-2.5-flash-preview", label: "Gemini 2.5 Flash", tag: "免费" },
      { value: "deepseek/deepseek-chat", label: "DeepSeek V3", tag: "免费" },
      { value: "qwen/qwen2.5-vl-72b-instruct", label: "Qwen 2.5 VL 72B", tag: "免费" },
      { value: "mistralai/mistral-7b-instruct", label: "Mistral 7B", tag: "免费" },
    ],
  },
  {
    id: "deepseek",
    label: "🧠 DeepSeek（国内）",
    desc: "国产推理模型，速度快",
    keyPlaceholder: "sk-...",
    keyHint: "在 platform.deepseek.com/api_keys 免费获取，注册送 500 万 token",
    models: [
      { value: "deepseek-chat", label: "DeepSeek V3（通用）", tag: "免费" },
      { value: "deepseek-reasoner", label: "DeepSeek R1（推理）", tag: "免费" },
    ],
  },
];

export default function SettingsPage() {
  const [provider, setProvider] = useState("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("google/gemini-2.0-flash-001");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);
  const [testError, setTestError] = useState("");

  const prov = PROVIDERS.find((p) => p.id === provider) || PROVIDERS[0];

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ai_drama_api_config");
      if (raw) {
        const config = JSON.parse(raw);
        setProvider(config.provider || "openrouter");
        setApiKey(config.key || "");
        setModel(config.model || "google/gemini-2.0-flash-001");
      }
    } catch {}
  }, []);

  const handleSave = () => {
    localStorage.setItem(
      "ai_drama_api_config",
      JSON.stringify({ provider, key: apiKey, model })
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    if (!apiKey.trim()) return;
    setTesting(true);
    setTestResult(null);
    setTestError("");

    try {
      const res = await fetch(API_PROXY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          key: apiKey.trim(),
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.choices?.[0]?.message?.content) {
          setTestResult("ok");
        } else {
          setTestResult("fail");
          setTestError(data.error?.message || "API 返回格式异常");
        }
      } else {
        setTestResult("fail");
        try {
          const err = await res.json();
          setTestError(err.error?.message || `${res.status} ${res.statusText}`);
        } catch {
          setTestError(`${res.status} ${res.statusText}`);
        }
      }
    } catch (e: any) {
      setTestResult("fail");
      setTestError(e?.message || "网络错误");
    }

    setTesting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-purple-500/5 blur-3xl" />
      </div>

      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <button onClick={() => window.location.href = "/creator"} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
          ← 返回
        </button>
        <h1 className="text-sm font-semibold">AI 设置</h1>
        <div className="w-12" />
      </header>

      <div className="px-4 py-4 space-y-5">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-400 leading-relaxed">
          配置 AI API 后，生成剧情将使用真实大模型，质量远高于本地模板。
          {!apiKey && (
            <span className="block mt-1.5 text-yellow-400">
              💡 目前未配置，生成时使用本地模板
            </span>
          )}
        </div>

        {/* 服务商 */}
        <div>
          <label className="mb-1.5 block text-xs text-zinc-500">服务商</label>
          <div className="space-y-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setProvider(p.id);
                  setModel(p.models[0].value);
                }}
                className={`w-full rounded-lg border px-3 py-2.5 text-left text-xs transition ${
                  provider === p.id
                    ? "border-blue-500 bg-blue-500/20 text-blue-400"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                <span className="font-medium">{p.label}</span>
                <span className="ml-2 text-zinc-500">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div>
          <label className="mb-1 block text-xs text-zinc-500">API Key</label>
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={prov.keyPlaceholder}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-blue-500"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="rounded-lg border border-zinc-700 px-3 py-2.5 text-xs text-zinc-400 hover:bg-zinc-800"
            >
              {showKey ? "🙈" : "👁️"}
            </button>
          </div>
          <p className="mt-1 text-[10px] text-zinc-600">{prov.keyHint}</p>
        </div>

        {/* 模型选择 */}
        <div>
          <label className="mb-1.5 block text-xs text-zinc-500">模型</label>
          <div className="space-y-1.5">
            {prov.models.map((m) => (
              <button
                key={m.value}
                onClick={() => setModel(m.value)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                  model === m.value
                    ? "border-blue-500 bg-blue-500/10 text-blue-400"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                <span className="font-medium">{m.label}</span>
                {m.tag && (
                  <span className="ml-1.5 rounded bg-green-900/30 px-1.5 py-0.5 text-[10px] text-green-400">
                    {m.tag}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <button
            onClick={handleTest}
            disabled={!apiKey.trim() || testing}
            className="flex-1 rounded-lg border border-zinc-700 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {testing ? "测试中..." : testResult === "ok" ? "✅ 连接成功" : testResult === "fail" ? "❌ 连接失败" : "🔌 测试连接"}
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {saved ? "✅ 已保存" : "💾 保存"}
          </button>
        </div>
        {testError && (
          <div className="rounded-lg border border-red-800/50 bg-red-950/20 p-3 text-xs text-red-400">
            {testError}
          </div>
        )}
      </div>
    </div>
  );
}
