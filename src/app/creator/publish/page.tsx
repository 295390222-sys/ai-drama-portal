"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Story {
  id: string;
  title: string;
  genre: string;
  setting: string;
  outline: string;
  episodes: { episodeNumber: number; title: string; content: string }[];
  characterIds: string[];
  createdAt: number;
}

function PublishContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storyId = searchParams.get("storyId");

  const [stories, setStories] = useState<Story[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(storyId);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ai_drama_stories");
      setStories(raw ? JSON.parse(raw) : []);
    } catch {
      setStories([]);
    }
  }, [storyId]);

  const selectedStory = stories.find((s) => s.id === selectedId);

  const handlePublish = async () => {
    if (!selectedStory) return;
    setPublishing(true);

    const episodeText = selectedStory.episodes
      .map((ep) => `【第${ep.episodeNumber}集：${ep.title}】\n${ep.content}`)
      .join("\n\n");

    const content = `🎬 ${selectedStory.title}\n类型：${selectedStory.genre} | 设定：${selectedStory.setting}\n\n${selectedStory.outline ? "📖 " + selectedStory.outline + "\n\n" : ""}${episodeText}`;

    navigator.clipboard.writeText(content).catch(() => {});
    setPublished(true);
    setPublishing(false);
  };

  return (
    <div className="px-4 py-4">
      <label className="mb-1.5 block text-xs text-zinc-500">选择要发布的剧本</label>
      <select
        value={selectedId || ""}
        onChange={(e) => setSelectedId(e.target.value || null)}
        className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
      >
        <option value="" disabled>
          {stories.length === 0 ? "还没有剧本" : "请选择"}
        </option>
        {stories.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title} ({s.genre} · {s.episodes.length}集)
          </option>
        ))}
      </select>

      {selectedStory && (
        <>
          <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <h2 className="mb-1 text-sm font-semibold text-white">{selectedStory.title}</h2>
            <div className="mb-2 flex gap-2">
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">{selectedStory.genre}</span>
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">{selectedStory.episodes.length}集</span>
            </div>
            {selectedStory.outline && <p className="mb-2 text-xs text-zinc-400">{selectedStory.outline.slice(0, 100)}...</p>}
          </div>

          {published ? (
            <div className="rounded-lg bg-green-900/20 p-4 text-center">
              <p className="mb-1 text-sm text-green-400">✨ 内容已复制到剪贴板</p>
              <p className="text-xs text-zinc-500">发帖功能即将上线</p>
            </div>
          ) : (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 py-3 text-sm font-medium text-white transition hover:from-blue-500 hover:to-purple-500 disabled:opacity-50"
            >
              {publishing ? "发布中..." : "📡 发布到频道"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function PublishPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-purple-500/5 blur-3xl" />
      </div>

      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <button onClick={() => router.push("/creator")} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white">← 返回</button>
        <h1 className="text-sm font-semibold">发布到频道</h1>
        <div className="w-12" />
      </header>

      <Suspense fallback={<div className="px-4 py-4 text-center text-zinc-500">加载中...</div>}>
        <PublishContent />
      </Suspense>
    </div>
  );
}
