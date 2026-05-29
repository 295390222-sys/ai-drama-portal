"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CreatorPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ nickname: string; avatar: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openId = params.get("open_id");
    const uin = params.get("uin");
    const dev = params.get("dev");

    if (openId || uin) {
      setUser({
        nickname: `用户${uin || openId?.slice(-4) || "未知"}`,
        avatar: "",
      });
      setLoading(false);
      return;
    }

    // dev 模式：URL 加 ?dev=1 跳过登录
    if (dev === "1") {
      const devUser = { nickname: "煤球（测试）", avatar: "" };
      localStorage.setItem("ai_drama_user", JSON.stringify(devUser));
      setUser(devUser);
      setLoading(false);
      return;
    }

    const saved = localStorage.getItem("ai_drama_user");
    if (saved) {
      setUser(JSON.parse(saved));
      setLoading(false);
    } else {
      // QQ 内置浏览器对 SPA 路由支持不好，用整页加载代替
      window.location.href = "/";
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("ai_drama_user");
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-zinc-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-purple-500/5 blur-3xl" />
      </div>

      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-sm">
            🎬
          </div>
          <span className="text-sm font-semibold">AI 短剧宇宙</span>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
        >
          退出
        </button>
      </header>

      <section className="border-b border-zinc-800 px-4 py-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-lg font-bold text-white">
            {user?.nickname?.charAt(0) || "?"}
          </div>
          <div>
            <h2 className="text-lg font-bold">{user?.nickname}</h2>
            <p className="text-xs text-zinc-500">创作者</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 p-4">
        <FeatureCard
          icon="🎭"
          title="创建角色"
          desc="设计你的AI角色"
          href="/creator/characters"
        />
        <FeatureCard
          icon="📝"
          title="生成剧情"
          desc="AI替你写连续剧"
          href="/creator/story"
        />
        <FeatureCard
          icon="📡"
          title="发布到频道"
          desc="一键同步腾讯频道"
          href="/creator/publish"
        />
        <FeatureCard
          icon="📊"
          title="我的作品"
          desc="管理你的创作"
          href="/creator/works"
        />
        <FeatureCard
          icon="⚙️"
          title="AI 设置"
          desc="配置API密钥与模型"
          href="/creator/settings"
        />
      </section>

      <section className="px-4 pb-8">
        <h3 className="mb-3 text-sm font-semibold text-zinc-400">快速开始</h3>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 backdrop-blur-sm">
          <p className="text-sm text-zinc-300">
            还没创建角色？先设计一个 AI 角色，让 TA 成为你短剧的主角。
          </p>
          <button
            onClick={() => window.location.href = "/creator/characters"}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            创建第一个角色 →
          </button>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  href,
}: {
  icon: string;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <button
      onClick={() => window.location.href = href}
      className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-left backdrop-blur-sm transition hover:border-zinc-700 hover:bg-zinc-800/50"
    >
      <div className="mb-2 text-2xl">{icon}</div>
      <h4 className="text-sm font-semibold text-white group-hover:text-blue-400">
        {title}
      </h4>
      <p className="mt-0.5 text-xs text-zinc-500">{desc}</p>
    </button>
  );
}
