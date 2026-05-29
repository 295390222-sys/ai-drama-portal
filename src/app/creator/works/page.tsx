"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Story {
  id: string;
  title: string;
  genre: string;
  episodes: { episodeNumber: number; title: string; content: string }[];
  createdAt: number;
}

export default function WorksPage() {
  const router = useRouter();
  const [stories, setStories] = useState<Story[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ai_drama_stories");
      setStories(raw ? JSON.parse(raw) : []);
    } catch {
      setStories([]);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <button
          onClick={() => router.push("/creator")}
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
        >
          ← 返回
        </button>
        <h1 className="text-sm font-semibold">我的作品</h1>
        <div className="w-12" />
      </header>

      <div className="px-4 py-4">
        {stories.length === 0 ? (
          <div className="mt-12 text-center">
            <div className="mb-3 text-4xl">📊</div>
            <p className="mb-1 text-sm text-zinc-300">还没有作品</p>
            <p className="mb-6 text-xs text-zinc-600">
              生成的短剧会出现在这里
            </p>
            <button
              onClick={() => router.push("/creator/story")}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium transition hover:bg-blue-500"
            >
              去生成剧本 →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {stories
              .slice()
              .reverse()
              .map((story) => (
                <div
                  key={story.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                >
                  <h3 className="text-sm font-medium text-white">
                    {story.title}
                  </h3>
                  <p className="mt-0.5 text-[10px] text-zinc-500">
                    {story.genre} · {story.episodes.length}集 ·{" "}
                    {new Date(story.createdAt).toLocaleDateString("zh-CN")}
                  </p>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
