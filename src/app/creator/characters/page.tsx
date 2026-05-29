"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

const MAX_CHARACTERS = 6;

const ROLE_OPTIONS = [
  { value: "主角", label: "主角", emoji: "⭐" },
  { value: "配角", label: "配角", emoji: "🎭" },
  { value: "反派", label: "反派", emoji: "😈" },
  { value: "男2", label: "男2", emoji: "🥈" },
  { value: "女2", label: "女2", emoji: "🥈" },
  { value: "男3", label: "男3", emoji: "🥉" },
  { value: "女3", label: "女3", emoji: "🥉" },
  { value: "其他", label: "其他", emoji: "📌" },
];

interface Character {
  id: string;
  name: string;
  role: string;
  description: string;
  imageUrl: string;
  imageSource: "ai" | "upload";
  createdAt: number;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function generateCharacterImage(description: string): string {
  const prompt = `anime character portrait, ${description}, cute anime style, character design, high quality, 512x512`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true`;
}

function generateAvatarSVG(name: string, colors: [string, string]): string {
  const initial = name.charAt(0) || "?";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors[0]}"/>
      <stop offset="100%" style="stop-color:${colors[1]}"/>
    </linearGradient></defs>
    <rect width="512" height="512" fill="url(#g)" rx="50"/>
    <text x="256" y="276" font-size="200" font-weight="bold"
      fill="white" text-anchor="middle" font-family="Arial, sans-serif"
      filter="drop-shadow(0 4px 8px rgba(0,0,0,0.3))">${initial}</text>
  </svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

function nameToColors(name: string): [string, string] {
  const palettes: [string, string][] = [
    ["#3b82f6", "#7c3aed"], ["#06b6d4", "#3b82f6"], ["#8b5cf6", "#d946ef"],
    ["#f59e0b", "#ef4444"], ["#10b981", "#06b6d4"], ["#f472b6", "#8b5cf6"],
    ["#eab308", "#f59e0b"], ["#6366f1", "#3b82f6"], ["#ec4899", "#f43f5e"],
    ["#14b8a6", "#10b981"],
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palettes[Math.abs(hash) % palettes.length];
}

function roleColor(role: string): string {
  const map: Record<string, string> = {
    "主角": "bg-yellow-500/20 text-yellow-400 border-yellow-600/30",
    "配角": "bg-blue-500/20 text-blue-400 border-blue-600/30",
    "反派": "bg-red-500/20 text-red-400 border-red-600/30",
    "男2": "bg-cyan-500/20 text-cyan-400 border-cyan-600/30",
    "女2": "bg-pink-500/20 text-pink-400 border-pink-600/30",
    "男3": "bg-teal-500/20 text-teal-400 border-teal-600/30",
    "女3": "bg-rose-500/20 text-rose-400 border-rose-600/30",
  };
  return map[role] || "bg-zinc-500/20 text-zinc-400 border-zinc-600/30";
}

function CharacterAvatar({ name, imageUrl, imageSource, className }: {
  name: string; imageUrl: string; imageSource?: string; className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const colors = nameToColors(name || "?");
  if (failed || !imageUrl) return <img src={generateAvatarSVG(name || "?", colors)} alt={name} className={className || "h-full w-full object-cover"} />;
  return (
    <div className="relative h-full w-full">
      <img src={imageUrl} alt={name} className={className || "h-full w-full object-cover transition group-hover:scale-105"} loading="lazy" onError={() => setFailed(true)} />
      {imageSource === "upload" && <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-zinc-300">📷</span>}
    </div>
  );
}

function loadCharacters(): Character[] {
  if (typeof window === "undefined") return [];
  try { const raw = localStorage.getItem("ai_drama_characters"); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

function saveCharacters(list: Character[]) {
  localStorage.setItem("ai_drama_characters", JSON.stringify(list));
}

export default function CharactersPage() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageSource, setImageSource] = useState<"ai" | "upload">("ai");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setCharacters(loadCharacters()); setLoading(false); }, []);

  const updatePreview = useCallback((desc: string) => {
    if (!desc.trim()) { setPreviewUrl(""); return; }
    setPreviewUrl(generateCharacterImage(desc));
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setPreviewUrl(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const openCreate = () => {
    setEditingId(null); setFormName(""); setFormRole(""); setFormDesc(""); setPreviewUrl(""); setImageSource("ai"); setShowForm(true);
  };

  const openEdit = (char: Character) => {
    setEditingId(char.id); setFormName(char.name); setFormRole(char.role); setFormDesc(char.description); setPreviewUrl(char.imageUrl); setImageSource(char.imageSource || "ai"); setShowForm(true);
  };

  const navigateTo = (path: string) => {
    window.location.href = path;
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setGenerating(true);
    let imageUrl = previewUrl;
    if (imageSource === "ai" && (!previewUrl || !previewUrl.startsWith("data:"))) {
      imageUrl = formDesc.trim() ? generateCharacterImage(formDesc) : generateCharacterImage(formName);
    }
    const list = [...characters];
    if (editingId) {
      const idx = list.findIndex((c) => c.id === editingId);
      if (idx !== -1) list[idx] = { ...list[idx], name: formName.trim(), role: formRole, description: formDesc.trim(), imageUrl: imageUrl || list[idx].imageUrl, imageSource };
    } else {
      list.push({ id: genId(), name: formName.trim(), role: formRole, description: formDesc.trim(), imageUrl: imageUrl || "", imageSource, createdAt: Date.now() });
    }
    saveCharacters(list); setCharacters(list);
    // AI图片生成需要一点时间，让用户看到加载状态
    if (imageSource === "ai") await new Promise((r) => setTimeout(r, 1500));
    // 保存成功后跳到创作者首页（用 location.href 触发整页加载，解决 QQ 浏览器跳转问题）
    window.location.href = "/creator";
  };

  const handleDelete = (id: string) => {
    const list = characters.filter((c) => c.id !== id);
    saveCharacters(list); setCharacters(list); setShowForm(false);
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-black"><div className="animate-pulse text-zinc-500">加载中...</div></div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-purple-500/5 blur-3xl" />
      </div>
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <button onClick={() => window.location.href = "/creator"} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white">← 返回</button>
        <h1 className="text-sm font-semibold">我的角色</h1>
        <div className="w-12" />
      </header>
      <section className="px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs text-zinc-500">已创建 {characters.length}/{MAX_CHARACTERS} 个角色</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {characters.map((char) => (
            <button key={char.id} onClick={() => openEdit(char)} className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 text-left backdrop-blur-sm transition hover:border-zinc-600">
              <div className="aspect-square w-full overflow-hidden bg-zinc-800">
                <CharacterAvatar name={char.name} imageUrl={char.imageUrl} imageSource={char.imageSource} className="h-full w-full object-cover transition group-hover:scale-105" />
              </div>
              <div className="p-2.5">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate text-sm font-medium text-white">{char.name}</h3>
                  {char.role && <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] leading-none ${roleColor(char.role)}`}>{char.role}</span>}
                </div>
                {char.description && <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{char.description}</p>}
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/40">
                <span className="scale-0 rounded-lg bg-white/10 px-3 py-1 text-xs text-white backdrop-blur-sm transition group-hover:scale-100">编辑</span>
              </div>
            </button>
          ))}
          {characters.length < MAX_CHARACTERS && (
            <button onClick={openCreate} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 transition hover:border-blue-500 hover:bg-zinc-900/50">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-2xl text-zinc-400">+</div>
              <span className="text-xs text-zinc-500">创建新角色</span>
            </button>
          )}
        </div>
        {characters.length === 0 && (
          <div className="mt-12 text-center">
            <div className="mb-3 text-4xl">🎭</div>
            <p className="mb-1 text-sm text-zinc-300">还没有角色</p>
            <p className="mb-6 text-xs text-zinc-600">创建你的第一个AI角色，让 TA 成为短剧的主角</p>
            <button onClick={openCreate} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium transition hover:bg-blue-500">创建第一个角色</button>
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-zinc-900 p-5 sm:rounded-2xl">
            <h2 className="mb-4 text-base font-semibold">{editingId ? "编辑角色" : "创建新角色"}</h2>
            <label className="mb-1 block text-xs text-zinc-500">角色名称</label>
            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="给角色取个名字..." className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-blue-500" maxLength={20} />

            <label className="mb-1.5 block text-xs text-zinc-500">角色定位</label>
            <div className="mb-4 flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setFormRole(opt.value)} className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition ${formRole === opt.value ? "border-blue-500 bg-blue-500/20 text-blue-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
                  <span>{opt.emoji}</span><span>{opt.label}</span>
                </button>
              ))}
              {!ROLE_OPTIONS.find((o) => o.value === formRole) && formRole && (
                <span className="flex items-center gap-1 rounded-full border border-purple-500 bg-purple-500/20 px-3 py-1.5 text-xs text-purple-400">📌 {formRole}</span>
              )}
            </div>

            <label className="mb-1 block text-xs text-zinc-500">角色描述 <span className="text-zinc-600">（性格 / 外貌 / 背景）</span></label>
            <textarea value={formDesc} onChange={(e) => { setFormDesc(e.target.value); if (imageSource === "ai") updatePreview(e.target.value); }} placeholder="描述角色的外貌、性格、背景..." rows={2} className="mb-3 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-blue-500" maxLength={200} />

            <label className="mb-1.5 block text-xs text-zinc-500">角色形象图</label>
            <div className="mb-3 flex gap-2">
              <button type="button" onClick={() => { setImageSource("ai"); if (formDesc.trim()) updatePreview(formDesc.trim()); else setPreviewUrl(""); }} className={`flex-1 rounded-lg border py-2 text-xs transition ${imageSource === "ai" ? "border-blue-500 bg-blue-500/20 text-blue-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>🤖 AI 生成</button>
              <button type="button" onClick={() => { setImageSource("upload"); fileInputRef.current?.click(); }} className={`flex-1 rounded-lg border py-2 text-xs transition ${imageSource === "upload" ? "border-blue-500 bg-blue-500/20 text-blue-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>📷 从相册上传</button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

            {previewUrl && (
              <div className="mb-4 overflow-hidden rounded-lg border border-zinc-700">
                <div className="relative">
                  <img src={previewUrl} alt="角色预览" className="h-48 w-full object-cover" onError={(e) => { const target = e.currentTarget; if (formName.trim() && imageSource === "ai") { target.src = generateAvatarSVG(formName, nameToColors(formName)); } }} />
                  {imageSource === "upload" && <button type="button" onClick={() => { setPreviewUrl(""); fileInputRef.current?.click(); }} className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-[10px] text-white backdrop-blur-sm">更换照片</button>}
                  {imageSource === "ai" && previewUrl.startsWith("https://") && <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[10px] text-zinc-300 backdrop-blur-sm">AI 生成</span>}
                </div>
              </div>
            )}
            {!previewUrl && imageSource === "upload" && (
              <div onClick={() => fileInputRef.current?.click()} className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 py-6 text-zinc-500 transition hover:border-blue-500 hover:text-blue-400">
                <span className="mb-1 text-2xl">📁</span>
                <span className="text-xs">点击选择相册照片</span>
                <span className="mt-0.5 text-[10px] text-zinc-600">支持 JPG / PNG / WebP</span>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-zinc-700 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-800">取消</button>
              {editingId && <button onClick={() => handleDelete(editingId)} className="rounded-lg border border-red-900/50 px-4 py-2.5 text-sm text-red-400 transition hover:bg-red-950/50">删除</button>}
              <button onClick={handleSave} disabled={!formName.trim() || generating} className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50">
                {generating ? "处理中..." : editingId ? "保存" : "创建角色"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
