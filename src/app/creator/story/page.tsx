"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// ========== 类型定义 ==========

interface Character {
  id: string;
  name: string;
  role: string;
  description: string;
  imageUrl: string;
  imageSource: "ai" | "upload";
  createdAt: number;
}

interface Story {
  id: string;
  title: string;
  genre: string;
  setting: string;
  outline: string;
  episodes: Episode[];
  characterIds: string[];
  createdAt: number;
}

interface Episode {
  episodeNumber: number;
  title: string;
  content: string;
}

const GENRES = [
  { value: "古装", label: "🏯 古装" },
  { value: "现代", label: "🏙️ 现代" },
  { value: "仙侠", label: "🗡️ 仙侠" },
  { value: "都市", label: "🌆 都市" },
  { value: "科幻", label: "🚀 科幻" },
  { value: "悬疑", label: "🔍 悬疑" },
  { value: "甜宠", label: "💕 甜宠" },
  { value: "穿越", label: "⏳ 穿越" },
  { value: "喜剧", label: "😂 喜剧" },
  { value: "豪门", label: "💎 豪门" },
];

const DEFAULT_SETTINGS: Record<string, string> = {
  "古装": "古代王朝背景，宫廷、江湖、权谋风格",
  "现代": "当代城市生活，现实向剧情",
  "仙侠": "修仙世界，门派、功法、飞升体系",
  "都市": "现代都市+职场+情感冲突",
  "科幻": "未来科技、AI、太空、赛博世界",
  "悬疑": "推理、案件、反转剧情",
  "甜宠": "高糖恋爱、轻冲突、情感向",
  "穿越": "跨时空设定，古今/异世界切换",
  "喜剧": "轻松搞笑风格，日常都市背景",
  "豪门": "现代都市，涉及商战和家族恩怨",
};

const ROLE_LABELS: Record<string, string> = {
  "主角": "⭐ 主角",
  "配角": "🎭 配角",
  "反派": "😈 反派",
  "男2": "🥈 男2",
  "女2": "🥈 女2",
  "男3": "🥉 男3",
  "女3": "🥉 女3",
};

// ========== 工具函数 ==========

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function loadCharacters(): Character[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("ai_drama_characters");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadStories(): Story[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("ai_drama_stories");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStories(list: Story[]) {
  localStorage.setItem("ai_drama_stories", JSON.stringify(list));
}

// 构建角色信息摘要（给 AI 用的 prompt 素材）
function buildCharacterSummary(characters: Character[]): string {
  return characters
    .map((c) => {
      const roleLabel = ROLE_LABELS[c.role] || c.role || "角色";
      const desc = c.description || "暂无详细描述";
      return `【${roleLabel}】${c.name}：${desc}`;
    })
    .join("\n");
}

// ========== 主组件 ==========

export default function StoryPage() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  // 表单状态
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedCharIds, setSelectedCharIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("古装");
  const [setting, setSetting] = useState("");
  const [episodeCount, setEpisodeCount] = useState(3);
  const [generating, setGenerating] = useState(false);

  // 当前生成中的进度
  const [genProgress, setGenProgress] = useState("");

  // 已保存的故事列表
  const [savedStories, setSavedStories] = useState<Story[]>([]);

  // 当前查看的故事
  const [viewingStory, setViewingStory] = useState<Story | null>(null);

  useEffect(() => {
    setCharacters(loadCharacters());
    const s = loadStories();
    setStories(s);
    setSavedStories(s);
    setLoading(false);
  }, []);

  // 默认世界设定跟随类型
  useEffect(() => {
    if (!setting || DEFAULT_SETTINGS[genre]) {
      setSetting(DEFAULT_SETTINGS[genre] || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genre]);

  const toggleCharacter = (id: string) => {
    const next = new Set(selectedCharIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedCharIds(next);
  };

  const generateStory = useCallback(async () => {
    if (selectedCharIds.size === 0) return;

    setGenerating(true);
    setGenProgress("正在准备角色资料...");

    // 获取选中的角色
    const selectedChars = characters.filter((c) =>
      selectedCharIds.has(c.id)
    );

    const charSummary = buildCharacterSummary(selectedChars);
    const worldSetting = setting || DEFAULT_SETTINGS[genre] || "未知世界";
    const storyTitle = title.trim() || `未命名短剧`;

    setGenProgress("正在生成剧情大纲...");
    await new Promise((r) => setTimeout(r, 800));

    // 构建 Prompt
    const systemPrompt = `你是一个短剧编剧。根据提供的角色和设定，生成一部短剧。注意：
1. 角色定位决定了戏份轻重：主角戏份最多，反派制造冲突，配角辅助推动剧情
2. 每个角色的性格、外貌要贴合描述
3. 对话要自然生动，符合角色身份
4. 剧情要有起承转合`;
    const userPrompt = `【剧名】${storyTitle}
【类型】${genre}
【世界设定】${worldSetting}
【集数】${episodeCount}集（每集约300字）
【角色库】
${charSummary}
---
请生成：
1. 一段100字以内的剧情简介
2. 分集剧情，每集包含：集标题 + 场景描述 + 台词对话

输出格式：
【剧情简介】
...

【第1集：集标题】
场景：（场景描述）
（角色A）：（台词）
（角色B）：（台词）
...

【第2集：集标题】
...`;

    setGenProgress("AI 正在创作剧情...");

    // 尝试调 AI API
    let resultText = "";
    let apiSuccess = false;

    try {
      // 从 localStorage 读取 API 配置
      const apiConfigRaw = localStorage.getItem("ai_drama_api_config");
      const apiConfig = apiConfigRaw
        ? JSON.parse(apiConfigRaw)
        : { provider: "openrouter", key: "" };

      if (apiConfig.key) {
        // 有 API key，通过代理调真实接口（解决浏览器跨域问题）
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: apiConfig.provider || "openrouter",
            key: apiConfig.key,
            model: apiConfig.model || "google/gemini-2.0-flash-001",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            max_tokens: 4000,
          }),
        });

        if (!response.ok) {
          let errMsg = `API error: ${response.status}`;
          try { const err = await response.json(); errMsg = err.error?.message || errMsg; } catch {}
          throw new Error(errMsg);
        }

        const data = await response.json();
        resultText = data.choices?.[0]?.message?.content || "";
        if (resultText) apiSuccess = true;
      }
    } catch (err) {
      console.warn("API 调用失败，使用本地备用生成", err);
    }

    // API 失败或没有 key → 本地模拟生成
    if (!apiSuccess) {
      // 按角色定位取名字
      const mainChar = selectedChars.find((c) => c.role === "主角");
      const villainChar = selectedChars.find((c) => c.role === "反派");
      const sideChar = selectedChars.find((c) => c.role === "配角" || c.role === "男2" || c.role === "女2");
      const otherChars = selectedChars.filter(
        (c) => c.id !== mainChar?.id && c.id !== villainChar?.id && c.id !== sideChar?.id
      );

      const mainName = mainChar?.name || "主角";
      const villainName = villainChar?.name || "反派";
      const sideName = sideChar?.name || "配角";
      const otherNames = otherChars.map((c) => c.name);

      let episodes = [];
      for (let i = 1; i <= episodeCount; i++) {
        const epTemplates = [
          {
            title: `${mainName}的初遇`,
            content: `【场景：${worldSetting}，一个普通的清晨】

${mainName}站在窗前，望着远处的天际线。脚步声响起，${sideName}走了进来。

（${sideName}）：你真的想好了吗？
（${mainName}）：没有退路了。
（${sideName}）：可是...
（${mainName}）：别再劝我了。

${villainName}从阴影中走出，嘴角带着一丝冷笑。

（${villainName}）：我就知道你在这里。
（${mainName}）：你来做什么？
（${villainName}）：给你最后一次机会。

${otherNames.length > 0 ? `（${otherNames[0]}）：都别冲动！` : ""}`
          },
          {
            title: `暗流涌动`,
            content: `【场景：夜晚，${worldSetting}的某个角落】

${mainName}独自一人，手中握着一封信。

（${mainName}）：（自言自语）原来一切都不是巧合。

${sideName}从背后走来。

（${sideName}）：你发现了什么？
（${mainName}）：太多事情了。${villainName}比我想象的要危险得多。

远处传来${villainName}的笑声。

（${villainName}）：聪明。可惜，聪明人往往活不长。`
          },
          {
            title: `终局之战`,
            content: `【场景：${worldSetting}的中心，决战之地】

${mainName}和${villainName}对峙着。气氛紧张到极点。

（${villainName}）：你终于来了。
（${mainName}）：一切该结束了。
（${villainName}）：你以为你能赢？

${sideName}带着人赶到。

（${sideName}）：不是一个人。是所有人。

${mainName}走向${villainName}，目光坚定。

（${mainName}）：你错了。正义可能会迟到，但从不缺席。`
          },
          {
            title: `新的开始`,
            content: `【场景：${worldSetting}，风波过后】

${mainName}站在阳光下，${sideName}站在身旁。

（${sideName}）：一切都结束了。
（${mainName}）：不。是刚刚开始。
（${sideName}）：接下来打算做什么？
（${mainName}）：还有很多事要去完成。

远处，天空晴朗。新的篇章，才刚刚翻开。`
          },
        ];

        const template = epTemplates[(i - 1) % epTemplates.length];
        episodes.push({
          episodeNumber: i,
          title: template.title,
          content: template.content,
        });
      }

      const outlines = [
        `在${worldSetting}中，${mainName}意外卷入了一场关乎命运的纷争。${villainName}的阴谋笼罩着每一个人，${sideName}在关键时刻伸出援手。当真相逐渐浮出水面，${mainName}发现，一切的源头远比想象中更加复杂...`,
        `${mainName}进入${worldSetting}，本以为只是一次普通的旅程。但${villainName}的出现打乱了一切。${sideName}的忠诚与背叛交织，${otherNames.length > 0 ? otherNames[0] + "的出场" : "一段尘封的记忆"}让故事走向了不可预知的方向。`,
      ];

      resultText = `【剧情简介】
${outlines[0]}

${episodes.map((ep) => `【第${ep.episodeNumber}集：${ep.title}】\n${ep.content}`).join("\n\n")}`;

      setGenProgress("剧情生成完成！");
      await new Promise((r) => setTimeout(r, 500));
    } else {
      setGenProgress("剧情生成完成！");
    }

    // 解析生成结果
    const outlineMatch = resultText.match(/【剧情简介】\s*([\s\S]*?)(?=【第|$)/);
    const outline = outlineMatch ? outlineMatch[1].trim() : "";

    const episodeBlocks = resultText.split(/(?=【第\d+集)/g).slice(1);
    const episodes: Episode[] = episodeBlocks.map((block, idx) => {
      const titleMatch = block.match(/【第\d+集：(.*?)】/);
      const content = block.replace(/【第\d+集：.*?】\n?/, "").trim();
      return {
        episodeNumber: idx + 1,
        title: titleMatch ? titleMatch[1].trim() : `第${idx + 1}集`,
        content,
      };
    });

    const finalStory: Story = {
      id: genId(),
      title: storyTitle,
      genre,
      setting: worldSetting,
      outline,
      episodes: episodes.length > 0 ? episodes : [],
      characterIds: Array.from(selectedCharIds),
      createdAt: Date.now(),
    };

    const updated = [...stories, finalStory];
    setStories(updated);
    setSavedStories(updated);
    saveStories(updated);

    setGenerating(false);
    setGenProgress("");
    setShowGenerator(false);
    setViewingStory(finalStory);

    // 重置表单
    setSelectedCharIds(new Set());
    setTitle("");
  }, [characters, selectedCharIds, title, genre, setting, episodeCount, stories]);

  // —— 删除故事
  const deleteStory = (id: string) => {
    const updated = stories.filter((s) => s.id !== id);
    setStories(updated);
    setSavedStories(updated);
    saveStories(updated);
    if (viewingStory?.id === id) setViewingStory(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="animate-pulse text-zinc-500">加载中...</div>
      </div>
    );
  }

  // ========== 查看故事详情 ==========
  if (viewingStory) {
    const storyChars = characters.filter((c) =>
      viewingStory.characterIds.includes(c.id)
    );

    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-blue-500/5 blur-3xl" />
          <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-purple-500/5 blur-3xl" />
        </div>
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <button
            onClick={() => setViewingStory(null)}
            className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
          >
            ← 返回
          </button>
          <h1 className="truncate text-sm font-semibold">
            {viewingStory.title}
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => deleteStory(viewingStory.id)}
              className="text-xs text-red-500 hover:text-red-400"
            >
              删除
            </button>
            <button
              onClick={() =>
                router.push(
                  `/creator/publish?storyId=${viewingStory.id}`
                )
              }
              className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500"
            >
              发布
            </button>
          </div>
        </header>
        <div className="px-4 py-4">
          {/* 参与角色 */}
          <section className="mb-4">
            <h2 className="mb-2 text-xs font-semibold text-zinc-500">
              参与角色
            </h2>
            <div className="flex flex-wrap gap-2">
              {storyChars.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/50 px-2.5 py-1 text-xs"
                >
                  <div className="h-4 w-4 overflow-hidden rounded-full bg-zinc-700">
                    <img
                      src={c.imageUrl}
                      alt={c.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = "none";
                      }}
                    />
                  </div>
                  <span className="text-zinc-300">{c.name}</span>
                  {c.role && (
                    <span className="rounded bg-zinc-700 px-1 text-[10px] text-zinc-400">
                      {c.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 剧情简介 */}
          {viewingStory.outline && (
            <section className="mb-4">
              <h2 className="mb-1.5 text-xs font-semibold text-zinc-500">
                剧情简介
              </h2>
              <p className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm leading-relaxed text-zinc-300">
                {viewingStory.outline}
              </p>
            </section>
          )}

          {/* 分集内容 */}
          <section>
            <h2 className="mb-2 text-xs font-semibold text-zinc-500">
              分集剧情（{viewingStory.episodes.length}集）
            </h2>
            <div className="space-y-3">
              {viewingStory.episodes.map((ep) => (
                <div
                  key={ep.episodeNumber}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-600/20 text-[10px] text-blue-400">
                      {ep.episodeNumber}
                    </span>
                    <h3 className="text-sm font-medium text-white">
                      {ep.title}
                    </h3>
                  </div>
                  <pre className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">
                    {ep.content}
                  </pre>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ========== 主列表页 ==========
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black">
      {/* 装饰 */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-purple-500/5 blur-3xl" />
      </div>

      {/* 页头 */}
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <button
          onClick={() => router.push("/creator")}
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
        >
          ← 返回
        </button>
        <h1 className="text-sm font-semibold">生成剧情</h1>
        <div className="w-12" />
      </header>

      {/* 已生成的故事列表 */}
      <section className="px-4 py-4">
        {savedStories.length > 0 && (
          <>
            <h2 className="mb-3 text-xs font-semibold text-zinc-500">
              已保存的剧本
            </h2>
            <div className="mb-6 space-y-2">
              {savedStories
                .slice()
                .reverse()
                .map((story) => (
                  <button
                    key={story.id}
                    onClick={() => setViewingStory(story)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-left transition hover:border-zinc-600"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">
                          {GENRES.find((g) => g.value === story.genre)
                            ?.label?.charAt(0) || "📖"}
                        </span>
                        <div>
                          <h3 className="text-sm font-medium text-white">
                            {story.title}
                          </h3>
                          <p className="text-[10px] text-zinc-500">
                            {story.genre} · {story.episodes.length}集 ·{" "}
                            {new Date(story.createdAt).toLocaleDateString("zh-CN")}
                          </p>
                        </div>
                      </div>
                      <span className="text-zinc-600">→</span>
                    </div>
                  </button>
                ))}
            </div>
          </>
        )}
      </section>

      {/* 创建新剧本 */}
      <section className="px-4 pb-8">
        {savedStories.length > 0 && (
          <h2 className="mb-3 text-xs font-semibold text-zinc-500">
            创作新剧本
          </h2>
        )}

        {/* 快捷入口 */}
        <button
          onClick={() => {
            if (characters.length === 0) {
              router.push("/creator/characters");
              return;
            }
            setShowGenerator(!showGenerator);
            if (!showGenerator && selectedCharIds.size === 0) {
              // 默认选中主角
              const mainChar = characters.find((c) => c.role === "主角");
              if (mainChar) setSelectedCharIds(new Set([mainChar.id]));
            }
          }}
          className="w-full rounded-lg border border-dashed border-zinc-700 p-4 text-center transition hover:border-blue-500"
        >
          {showGenerator ? "收起" : characters.length === 0 ? "还没有角色，先去创建 →" : "✏️ 开始新剧本"}
        </button>

        {/* 生成器表单 */}
        {showGenerator && (
          <div className="mt-4 space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 backdrop-blur-sm">
            {/* 剧名 */}
            <div>
              <label className="mb-1 block text-xs text-zinc-500">剧名</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="给你的短剧取个名字..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-blue-500"
                maxLength={30}
              />
            </div>

            {/* 故事类型 */}
            <div>
              <label className="mb-1.5 block text-xs text-zinc-500">故事类型</label>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => setGenre(g.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      genre === g.value
                        ? "border-blue-500 bg-blue-500/20 text-blue-400"
                        : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 世界设定 */}
            <div>
              <label className="mb-1 block text-xs text-zinc-500">世界设定</label>
              <input
                type="text"
                value={setting}
                onChange={(e) => setSetting(e.target.value)}
                placeholder={`例如：${DEFAULT_SETTINGS[genre] || ""}`}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-blue-500"
              />
            </div>

            {/* 集数 */}
            <div>
              <label className="mb-1 block text-xs text-zinc-500">
                集数：{episodeCount}集
              </label>
              <input
                type="range"
                min={1}
                max={8}
                value={episodeCount}
                onChange={(e) => setEpisodeCount(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="mt-0.5 flex justify-between text-[10px] text-zinc-600">
                <span>1集</span>
                <span>8集</span>
              </div>
            </div>

            {/* 选择角色 */}
            <div>
              <label className="mb-1.5 block text-xs text-zinc-500">
                选择角色 <span className="text-zinc-600">（已选 {selectedCharIds.size} 个）</span>
              </label>
              {characters.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-700 p-4 text-center text-xs text-zinc-500">
                  还没有角色，先去{" "}
                  <button
                    onClick={() => router.push("/creator/characters")}
                    className="text-blue-500 underline"
                  >
                    创建角色
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* 按角色定位分组 */}
                  {["主角", "反派", "男2", "女2", "男3", "女3", "配角", "其他"].map((roleKey) => {
                    const roleChars = characters.filter((c) => c.role === roleKey);
                    if (roleChars.length === 0) return null;
                    return (
                      <div key={roleKey}>
                        <p className="mb-1 text-[10px] text-zinc-600">
                          {ROLE_LABELS[roleKey] || roleKey}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {roleChars.map((c) => {
                            const selected = selectedCharIds.has(c.id);
                            return (
                              <button
                                key={c.id}
                                onClick={() => toggleCharacter(c.id)}
                                className={`flex items-center gap-2 rounded-lg border p-2 text-left transition ${
                                  selected
                                    ? "border-blue-500 bg-blue-500/10"
                                    : "border-zinc-700 bg-zinc-800/30 hover:border-zinc-500"
                                }`}
                              >
                                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-zinc-700">
                                  <img
                                    src={c.imageUrl}
                                    alt={c.name}
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      const target = e.currentTarget;
                                      target.style.display = "none";
                                    }}
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-medium text-white">
                                    {c.name}
                                  </p>
                                  <p className="truncate text-[10px] text-zinc-500">
                                    {c.description?.slice(0, 15) || ""}
                                  </p>
                                </div>
                                {selected && (
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
                                    ✓
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 生成按钮 */}
            <button
              onClick={generateStory}
              disabled={selectedCharIds.size === 0 || generating}
              className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 py-3 text-sm font-medium text-white transition hover:from-blue-500 hover:to-purple-500 disabled:opacity-50"
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {genProgress || "生成中..."}
                </span>
              ) : (
                "✨ AI 生成剧情"
              )}
            </button>
          </div>
        )}
      </section>

      {/* 空状态 */}
      {savedStories.length === 0 && !showGenerator && (
        <div className="px-4 text-center">
          <div className="mb-3 text-4xl">📝</div>
          <p className="mb-1 text-sm text-zinc-300">还没有剧本</p>
          <p className="mb-6 text-xs text-zinc-600">
            选择角色，让 AI 为你写出精彩剧情
          </p>
          {characters.length === 0 && (
            <p className="text-xs text-zinc-600">
              需要先{" "}
              <button
                onClick={() => router.push("/creator/characters")}
                className="text-blue-500 underline"
              >
                创建角色
              </button>{" "}
              才能生成剧情
            </p>
          )}
        </div>
      )}
    </div>
  );
}
