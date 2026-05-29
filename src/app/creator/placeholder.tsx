"use client";

import Link from "next/link";

export default function PlaceholderPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center">
      <div className="mb-4 text-4xl">🚧</div>
      <h1 className="mb-2 text-xl font-bold text-white">建设中</h1>
      <p className="mb-6 text-sm text-zinc-500">这个功能正在开发中，敬请期待</p>
      <Link
        href="/creator"
        className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
      >
        ← 返回创作者中心
      </Link>
    </div>
  );
}
