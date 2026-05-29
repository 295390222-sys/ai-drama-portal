"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ========== 类型定义 ==========
interface Character {
  id: string; name: string; role: string; description: string;
  imageUrl: string; imageSource: "ai" | "upload"; createdAt: number;
}
interface Story {
  id: string; title: string; genre: string; setting: string;
  episodes: { episodeNumber: number; title: string; content: string }[];
  characterIds: string[]; createdAt: number;
}
interface StoryTemplate { title: string; episodes: { title: string; scenes?: string[]; content?: string }[]; }

const MAX_CHARACTERS = 6;
const ROLE_OPTIONS = [
  { value: "主角", label: "主角", emoji: "⭐" }, { value: "配角", label: "配角", emoji: "🎭" },
  { value: "反派", label: "反派", emoji: "😈" }, { value: "男2", label: "男2", emoji: "🥈" },
  { value: "女2", label: "女2", emoji: "🥈" }, { value: "男3", label: "男3", emoji: "🥉" },
  { value: "女3", label: "女3", emoji: "🥉" }, { value: "其他", label: "其他", emoji: "📌" },
];
const GENRES = [
  { value: "古装", label: "🏯 古装" }, { value: "现代", label: "🏙️ 现代" },
  { value: "仙侠", label: "🗡️ 仙侠" }, { value: "都市", label: "🌆 都市" },
  { value: "科幻", label: "🚀 科幻" }, { value: "悬疑", label: "🔍 悬疑" },
  { value: "甜宠", label: "💕 甜宠" }, { value: "穿越", label: "⏳ 穿越" },
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
};

type Page = "landing" | "dashboard" | "characters" | "settings" | "story" | "publish" | "works" | "video";

// ========== 工具函数 ==========
function genId(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function nameToColors(name: string): [string, string] {
  const palettes: [string, string][] = [
    ["#3b82f6", "#7c3aed"], ["#06b6d4", "#3b82f6"], ["#8b5cf6", "#d946ef"],
    ["#f59e0b", "#ef4444"], ["#10b981", "#06b6d4"], ["#f472b6", "#8b5cf6"],
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palettes[Math.abs(hash) % palettes.length];
}
function generateAvatarSVG(name: string, colors: [string, string]): string {
  const initial = name.charAt(0) || "?";
  return "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:${colors[0]}"/><stop offset="100%" style="stop-color:${colors[1]}"/></linearGradient></defs><rect width="512" height="512" fill="url(#g)" rx="50"/><text x="256" y="276" font-size="200" font-weight="bold" fill="white" text-anchor="middle" font-family="Arial, sans-serif">${initial}</text></svg>`);
}
function loadChars(): Character[] {
  try { const raw = localStorage.getItem("ai_drama_characters"); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveChars(list: Character[]) { localStorage.setItem("ai_drama_characters", JSON.stringify(list)); }
function loadStories(): Story[] {
  try { const raw = localStorage.getItem("ai_drama_stories"); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveStories(list: Story[]) { localStorage.setItem("ai_drama_stories", JSON.stringify(list)); }

function generateCharacterImage(description: string): string {
  const prompt = `full body character design, ${description}, anime style, standing full body, from head to toe, character sheet, high quality, detailed outfit`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=768&nologo=true`;
}

// ========== 模板剧情生成 ==========
function generateLocalStory(genre: string, setting: string, chars: Character[], episodeCount: number): StoryTemplate {
  const mainChar = chars.find(c => c.role === "主角") || chars[0];
  const villainChar = chars.find(c => c.role === "反派");
  const sideChar = chars.find(c => c.role === "配角" || c.role === "男2" || c.role === "女2");
  const mainName = mainChar?.name || "主角";
  const villainName = villainChar?.name || "反派";
  const sideName = sideChar?.name || "配角";

  const templates: Record<string, StoryTemplate> = {
    "古装": {
      title: `${mainName}传`,
      episodes: [
        { title: "离别", scenes: [`${setting}，清晨。${mainName}站在城门口，背着一个简单的包裹。`, `${mainName}回头看了一眼生活了十八年的小镇，深吸一口气，踏上了前往京城的道路。`, `他不知道的是，前方等待着的不只是功名利禄，还有一场足以改变天下格局的阴谋。`] },
        { title: "入京", scenes: [`京城繁华似锦，车水马龙。${mainName}第一次看到这样的景象，不由得看呆了。`, `人群中，一顶华丽的轿子经过，帘子掀开一角，露出一张绝美的面容。`, `${mainName}的心跳漏了一拍。他不知道，这个惊鸿一瞥会改变他的一生。`] },
        { title: "相遇", scenes: [`原来轿中的女子是丞相府的大小姐，${sideName}。`, `${sideName}对${mainName}一见倾心，但丞相府显然不会看好一个穷小子。`, `${villainName}作为丞相府的幕僚，看出了${mainName}的潜力，想要拉拢他。`] },
        ...(villainChar ? [{ title: "暗流", scenes: [`${villainName}在暗中策划着什么。`, `${mainName}察觉到了异样，决定暗中调查。`, `真相远比${mainName}想象的更加复杂。`] }] : []),
      ].slice(0, episodeCount)
    },
    "现代": {
      title: `${mainName}的都市生活`,
      episodes: [
        { title: "新工作", scenes: [`${mainName}第一天到新公司报到，有点紧张。`, `公司很大，人很多，${mainName}在前台的指引下找到了自己的工位。`, `旁边工位的同事看起来很友善，微笑着打了个招呼。`] },
        { title: "意外", scenes: [`${mainName}在公司茶水间遇到了${sideName}。`, `两人聊得很投机，发现竟然是校友。`, `但${villainName}似乎对${mainName}的出现很不满。`] },
        { title: "反击", scenes: [`${villainName}开始在工作中处处针对${mainName}。`, `${mainName}没有被吓倒，反而更加努力。`, `${sideName}在暗中支持着${mainName}。`] },
        { title: "转机", scenes: [`一个重要的项目让${mainName}有了证明自己的机会。`, `${mainName}的方案获得了客户的高度认可。`, `${villainName}的脸色很难看，但不得不承认${mainName}的能力。`] },
        { title: "共赢", scenes: [`项目成功后，${mainName}在公司站稳了脚跟。`, `${sideName}和${mainName}的关系也更进一步。`, `就连${villainName}也开始对${mainName}刮目相看。`] },
      ].slice(0, episodeCount)
    },
    "仙侠": {
      title: `${mainName}修仙录`,
      episodes: [
        { title: "入门", scenes: [`灵气复苏的时代，${mainName}偶然发现了自己的修仙天赋。`, `在${sideName}的引荐下，${mainName}进入了青云宗。`, `但${villainName}似乎对${mainName}的到来充满了敌意。`] },
        { title: "试炼", scenes: [`宗门试炼开始了，${mainName}必须通过重重考验。`, `${villainName}在试炼中暗中使绊，但${mainName}凭借着坚韧的意志挺了过来。`, `这一战，让${mainName}在宗门中声名鹊起。`] },
        { title: "突破", scenes: [`${mainName}在修炼中遇到了瓶颈，始终无法突破。`, `${sideName}偷偷给了${mainName}一本上古秘籍。`, `${mainName}感激不已，但也意识到这份恩情太重。`] },
        { title: "真相", scenes: [`原来${villainName}一直在暗中操控一切。`, `${mainName}决定正面面对，不再逃避。`, `一场大战一触即发。`] },
        { title: "决战", scenes: [`最终决战在青云宗山顶展开。`, `${mainName}拼尽全力，终于击败了${villainName}。`, `但胜利的代价，比想象中更大。`] },
      ].slice(0, episodeCount)
    },
    "科幻": {
      title: `${mainName}2045`,
      episodes: [
        { title: "觉醒", scenes: [`${setting}。${mainName}从实验舱中醒来，发现自己的记忆一片空白。`, `周围是冰冷的金属墙壁，只有一段神秘的录音在重复播放。`, `"你是人类最后的希望。"`] },
        { title: "追猎", scenes: [`${mainName}逃离了实验室，来到了废土般的地表城市。`, `${sideName}突然出现，似乎认识${mainName}。`, `但${villainName}的无人机已经在头顶盘旋。`] },
        { title: "真相", scenes: [`${sideName}告诉${mainName}，他是一场AI战争的产物。`, `${villainName}是控制全球网络的主脑，想要抹除${mainName}的存在。`, `${mainName}必须抉择：逃避还是反抗。`] },
        { title: "反击", scenes: [`${mainName}组建了一支由幸存者组成的队伍。`, `他们潜入了${villainName}的数据中心，准备发起最后的攻击。`, `但一切似乎都在${villainName}的预料之中。`] },
        { title: "新生", scenes: [`最终之战中，${mainName}找到了${villainName}的弱点。`, `用一个意想不到的方式，${mainName}摧毁了主脑的核心程序。`, `人类获得了第二次机会。${mainName}看着初升的太阳，露出了微笑。`] },
      ].slice(0, episodeCount)
    },
    "都市": {
      title: `${mainName}的奋斗`,
      episodes: [
        { title: "入职", scenes: [`${setting}。${mainName}第一天来到这家知名公司实习。`, `没想到${sideName}也在这里工作，而且竟是自己的上司。`, `${villainName}作为竞争对手部门的负责人，对${mainName}的到来很不满。`] },
        { title: "挑战", scenes: [`${mainName}接到了第一个重要项目，期限非常紧张。`, `${sideName}暗中帮助却不敢公开，因为公司有严格的利益回避政策。`, `${villainName}在背后使坏，让项目雪上加霜。`] },
        { title: "危机", scenes: [`项目出了问题，${mainName}面临被辞退的风险。`, `${sideName}冒着风险站出来替${mainName}说话。`, `但${villainName}抓住这个机会向上级告状。`] },
        { title: "转机", scenes: [`${mainName}连夜重做了方案，发现了一个被所有人忽略的突破口。`, `在汇报会上，${mainName}的方案获得了高层的认可。`, `${villainName}的脸色非常难看。`] },
        { title: "认可", scenes: [`项目大获成功，${mainName}提前转正。`, `${sideName}和${mainName}的关系也更近了一步。`, `但${villainName}显然不会就此罢休。`] },
      ].slice(0, episodeCount)
    },
  };

  return templates[genre] || {
    title: `${mainName}的故事`,
    episodes: Array.from({ length: Math.min(episodeCount, 5) }, (_, i) => ({
      title: [`开始`, `发展`, `转折`, `高潮`, `结局`][i] || `第${i + 1}集`,
      scenes: [`${setting}。${mainName}${i === 0 ? "开始了新的旅程" : "面临新的挑战"}。`, i < 4 ? `${mainName}遇到了${sideName}，两人决定一起行动。` : `${mainName}做出了最终的决定。`, i < 4 ? `但${villainName}的出现让事情变得复杂。` : `一切尘埃落定，新的生活即将开始。`],
    }))
  };
}

// ========== 主组件 ==========
export default function UnifiedPage() {
  const [page, setPage] = useState<Page>("landing");
  const [user, setUser] = useState<{ nickname: string } | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  // 角色创建
  const [showForm, setShowForm] = useState(false);
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formImageSource, setFormImageSource] = useState<"ai" | "upload">("ai");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 设置
  const [settingsKey, setSettingsKey] = useState("");
  const [settingsShowKey, setSettingsShowKey] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsProvider, setSettingsProvider] = useState("deepseek");
  const [settingsModel, setSettingsModel] = useState("deepseek-reasoner");
  const [settingsTesting, setSettingsTesting] = useState(false);
  const [settingsTestResult, setSettingsTestResult] = useState<"ok" | "fail" | null>(null);

  const PROVIDERS: Record<string, { label: string; desc: string; models: { value: string; label: string; tag?: string }[]; keyHint: string; keyPlaceholder: string }> = {
    deepseek: {
      label: "🧠 DeepSeek（国内）", desc: "国产推理模型，速度快，免费500万token", keyHint: "在 platform.deepseek.com/api_keys 免费获取", keyPlaceholder: "sk-...",
      models: [
        { value: "deepseek-reasoner", label: "DeepSeek R1（推理模型）", tag: "推荐" },
        { value: "deepseek-chat", label: "DeepSeek V3（通用）", tag: "免费" },
      ],
    },
    wanxiang: {
      label: "🎥 通义万相（视频）", desc: "阿里云视频生成，新用户送50秒免费", keyHint: "在 bailian.console.aliyun.com 获取", keyPlaceholder: "sk-...",
      models: [
        { value: "wan2.7-t2v-2026-04-25", label: "万相2.7 文生视频", tag: "推荐" },
        { value: "wan2.7-i2v-2026-04-25", label: "万相2.7 图生视频", tag: "支持角色图" },
      ],
    },
  };
  // 剧情
  const [storyGenre, setStoryGenre] = useState("古装");
  const [storySetting, setStorySetting] = useState("架空古代王朝");
  const [storyEpCount, setStoryEpCount] = useState(3);
  const [storyResult, setStoryResult] = useState<StoryTemplate | null>(null);
  const [generating, setGenerating] = useState(false);
  const [storyError, setStoryError] = useState("");
  const [storyTitle, setStoryTitle] = useState("");
  const [storySelectedCharIds, setStorySelectedCharIds] = useState<string[]>([]);
  // 作品
  const [stories, setStories] = useState<Story[]>([]);
  const [publishCopiedId, setPublishCopiedId] = useState<string | null>(null);

  // ========== 初始化 ==========
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openId = params.get("open_id");
    const uin = params.get("uin");
    const dev = params.get("dev");
    if (openId || uin) {
      const nickname = `用户${uin || openId?.slice(-4) || "未知"}`;
      localStorage.setItem("ai_drama_user", JSON.stringify({ nickname, openId: openId || "" }));
      setUser({ nickname }); setPage("dashboard"); return;
    }
    if (dev === "1") {
      const nickname = "煤球（测试）";
      localStorage.setItem("ai_drama_user", JSON.stringify({ nickname }));
      setUser({ nickname }); setPage("dashboard"); return;
    }
    const saved = localStorage.getItem("ai_drama_user");
    if (saved) { setUser(JSON.parse(saved)); setPage("dashboard"); return; }
  }, []);

  useEffect(() => { setCharacters(loadChars()); }, [page]);
  useEffect(() => {
    try {
      // 加载 DeepSeek Key
      const raw = localStorage.getItem("ai_drama_api_config");
      if (raw) {
        const c = JSON.parse(raw);
        if (c.key) setSettingsKey(c.key);
        if (c.provider) setSettingsProvider(c.provider);
        if (c.model) setSettingsModel(c.model);
      }
    } catch {}
  }, []);
  useEffect(() => { setStories(loadStories()); }, [page]);

  // ========== 保存角色 ==========
  const handleSaveCharacter = () => {
    if (!formName.trim()) return;
    const list = [...characters];
    let imageUrl = formImageUrl;
    if (!imageUrl || formImageSource !== "upload") {
      imageUrl = formDesc.trim() ? generateCharacterImage(formDesc) : generateCharacterImage(formName);
    }
    if (editingCharId) {
      // 编辑已有角色
      const idx = list.findIndex(c => c.id === editingCharId);
      if (idx !== -1) {
        list[idx] = { ...list[idx], name: formName.trim(), role: formRole, description: formDesc.trim(), imageUrl: imageUrl || list[idx].imageUrl, imageSource: formImageSource };
      }
    } else {
      // 新建角色
      list.push({ id: genId(), name: formName.trim(), role: formRole, description: formDesc.trim(), imageUrl: imageUrl || "", imageSource: formImageSource, createdAt: Date.now() });
    }
    saveChars(list); setCharacters(list); setShowForm(false); setEditingCharId(null);
    setFormName(""); setFormRole(""); setFormDesc(""); setFormImageUrl("");
  };

  const handleDeleteCharacter = (id: string) => {
    const list = loadChars().filter(c => c.id !== id);
    saveChars(list); setCharacters(list); setShowForm(false); setEditingCharId(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setFormImageUrl(event.target?.result as string);
      setFormImageSource("upload");
    };
    reader.readAsDataURL(file);
  };

  // ========== 生成剧情 ==========
  const handleGenerateStory = useCallback(async () => {
    setGenerating(true);
    const allChars = loadChars();
    const chars = allChars.filter(c => storySelectedCharIds.includes(c.id));
    let resultTitle = "";
    let episodes: { title: string; content: string }[] = [];
    let usedAI = false;

    // 读取 API 配置
    const apiRaw = localStorage.getItem("ai_drama_api_config");
    const apiConfig = apiRaw ? JSON.parse(apiRaw) : null;

    setStoryError("");
    if (!apiConfig?.key) {
      setStoryError("⚠️ 未配置 API Key，使用本地模板生成。请先到 AI 设置中配置。");
    } else {
      try {
        const charNames = chars.map(c => c.name).join("、");
        const charDetails = chars.map(c => `- ${c.name}（${c.role || "未设定"}）：${c.description || "无描述"}`).join("\n");
        const prompt = `${storyTitle ? `剧名：${storyTitle}\n` : ""}
请创作一部${storyEpCount}集${storyGenre}短剧剧本。背景设定：${storySetting}。

参演角色：${charNames || "（请自行创造）"}
${charDetails ? "\n角色详情：\n" + charDetails : ""}

要求：
- 每集要有具体场景、对话、情节推进
- 每集300-500字
- 剧情要完整，有冲突、转折、高潮、结局
- 严格按以下格式输出：

标题：<剧名>

第1集：<集标题>
<具体剧情内容，包含场景描述和角色对话>

第2集：<集标题>
<具体剧情内容>

...`;

        const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${(apiConfig.key || "").trim()}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1024,
            temperature: 0.8,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content || "";
          if (text) {
            setStoryError("");
            // 解析 AI 输出
            const lines = text.split("\n").filter(Boolean);
            const titleLine = lines.find(l => l.startsWith("标题："));
            resultTitle = storyTitle || (titleLine ? titleLine.replace("标题：", "").trim() : `${storyGenre}短剧`);

            let currentEp: { title: string; content: string[] } | null = null;
            for (const line of lines) {
              const epMatch = line.match(/^第(\d+)集[：:]\s*(.*)/);
              if (epMatch) {
                if (currentEp) episodes.push({ title: currentEp.title, content: currentEp.content.join("\n") });
                currentEp = { title: epMatch[2] || `第${epMatch[1]}集`, content: [] };
              } else if (currentEp && !line.startsWith("标题：")) {
                currentEp.content.push(line);
              }
            }
            if (currentEp) episodes.push({ title: currentEp.title, content: currentEp.content.join("\n") });

            if (episodes.length > 0) usedAI = true;
          } else {
            setStoryError("⚠️ AI 返回内容为空，可能模型不支持或 Key 不匹配");
          }
        } else {
          setStoryError("⚠️ AI 请求失败（HTTP " + res.status + "），请检查 API Key 是否正确");
        }
      } catch (e) {
        console.warn("AI 生成失败，使用本地模板", e);
        let errMsg = "⚠️ AI 调用失败";
        if (e?.name === "AbortError") errMsg += "（请求超时，服务器响应太慢）";
        else if (e?.message?.includes("fetch")) errMsg += "（网络错误，无法连接到 AI 服务）";
        else errMsg += "，已使用本地模板。检查 AI 设置中的 API Key 是否正确。";
        setStoryError(errMsg);
      }
    }

    // API 失败或没有 key → 本地模板
    if (!usedAI) {
      const template = generateLocalStory(storyGenre, storySetting, chars, storyEpCount);
      resultTitle = storyTitle || template.title;
      episodes = template.episodes.map((ep, i) => ({
        episodeNumber: i + 1, title: ep.title,
        content: ep.scenes.join("\n\n"),
      }));
    }

    // 显示结果
    const finalEpisodes: Story['episodes'] = episodes.map((ep, i) => ({ episodeNumber: i + 1, title: ep.title, content: ep.content }));
    setStoryResult({ title: resultTitle, episodes: finalEpisodes.map(ep => ({ title: ep.title, content: ep.content })) });
    setGenerating(false);

    // 保存到作品
    const s: Story = {
      id: genId(), title: resultTitle, genre: storyGenre, setting: storySetting,
      episodes: finalEpisodes,
      characterIds: chars.map(c => c.id), createdAt: Date.now(),
    };
    const list = loadStories();
    list.unshift(s);
    saveStories(list);
  }, [storyGenre, storySetting, storyEpCount]);

  // ========== 登录页 ==========
  if (page === "landing") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-950 to-black p-6 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[20px] bg-gradient-to-br from-blue-500 to-purple-600 text-4xl shadow-[0_0_40px_rgba(59,130,246,0.3)]">🎬</div>
        <h1 className="mb-2 text-2xl font-bold">AI短剧宇宙</h1>
        <p className="mb-8 text-sm text-zinc-500">人人都能创造AI连续剧</p>
        <div className="mx-auto mb-8 flex justify-center gap-6">
          <div className="text-center"><div className="mb-1 text-[28px]">🎭</div><div className="text-[11px] text-zinc-600">创建角色</div></div>
          <div className="text-center"><div className="mb-1 text-[28px]">📝</div><div className="text-[11px] text-zinc-600">AI编剧</div></div>
          <div className="text-center"><div className="mb-1 text-[28px]">📡</div><div className="text-[11px] text-zinc-600">一键发布</div></div>
        </div>
        <button onClick={() => setPage("dashboard")} className="block w-full max-w-[280px] rounded-xl border-0 bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 text-[15px] font-semibold text-white shadow-[0_4px_20px_rgba(59,130,246,0.3)] transition hover:scale-[1.02]">开始创作</button>
        <p className="mt-3 text-[11px] text-zinc-700">通过QQ频道自定义应用进入将自动登录</p>
      </div>
    );
  }

  // ========== 创作者首页 ==========
  if (page === "dashboard") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-sm">🎬</div>
            <span className="text-sm font-semibold">AI 短剧宇宙</span>
          </div>
          <button onClick={() => { localStorage.removeItem("ai_drama_user"); setPage("landing"); }} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800">退出</button>
        </header>
        <section className="border-b border-zinc-800 px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-lg font-bold text-white">{user?.nickname?.charAt(0) || "?"}</div>
            <div><h2 className="text-lg font-bold">{user?.nickname}</h2><p className="text-xs text-zinc-500">创作者</p></div>
          </div>
        </section>
        <section className="grid grid-cols-2 gap-3 p-4">
          <FeatureCard icon="🎭" title="创建角色" desc="设计你的AI角色" onClick={() => { setCharacters(loadChars()); setPage("characters"); }} />
          <FeatureCard icon="📝" title="生成剧情" desc="AI替你写连续剧" onClick={() => { setStoryResult(null); setStorySelectedCharIds(loadChars().map(c => c.id)); setPage("story"); }} />
          <FeatureCard icon="🎬" title="生成视频" desc="剧本→分镜→视频" onClick={() => { window.location.href = "/video.html"; }} />
          <FeatureCard icon="📡" title="发布到频道" desc="一键同步腾讯频道" onClick={() => setPage("publish")} />
          <FeatureCard icon="📊" title="我的作品" desc="管理你的创作" onClick={() => { setStories(loadStories()); setPage("works"); }} />
          <FeatureCard icon="⚙️" title="AI 设置" desc="配置API密钥与模型" onClick={() => setPage("settings")} />
        </section>
      </div>
    );
  }

  // ========== 设置页 ==========
  if (page === "settings") {
    const prov = PROVIDERS[settingsProvider];
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <button onClick={() => setPage("dashboard")} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white">← 返回</button>
          <h1 className="text-sm font-semibold">AI 设置</h1><div className="w-12" />
        </header>
        <div className="px-4 py-4 space-y-5">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-400 leading-relaxed">
            配置 AI API 后，生成剧情将使用真实大模型。
            {!settingsKey && <span className="block mt-1.5 text-yellow-400">💡 目前未配置，生成时使用本地模板</span>}
          </div>

          {/* 服务商选择 */}
          <div>
            <label className="mb-1.5 block text-xs text-zinc-500">服务商</label>
            <div className="space-y-2">
              {Object.entries(PROVIDERS).map(([key, p]) => (
                <button key={key} onClick={() => { 
                  // 切换服务商时加载对应已保存的 Key
                  let existingKey = "";
                  try {
                    if (key === "wanxiang") {
                      const raw = localStorage.getItem("wanxiang_api_config");
                      if (raw) existingKey = JSON.parse(raw).apiKey || "";
                    } else {
                      const raw = localStorage.getItem("ai_drama_api_config");
                      if (raw) {
                        const c = JSON.parse(raw);
                        if (c.provider === key) existingKey = c.key || "";
                      }
                    }
                  } catch {}
                  setSettingsProvider(key);
                  setSettingsKey(existingKey);
                  setSettingsModel(p.models[0].value);
                  setSettingsTestResult(null);
                }} className={`w-full rounded-lg border px-3 py-2.5 text-left text-xs transition ${settingsProvider === key ? "border-blue-500 bg-blue-500/20 text-blue-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
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
              <input type={settingsShowKey ? "text" : "password"} value={settingsKey} onChange={e => { setSettingsKey(e.target.value); setSettingsTestResult(null); }} placeholder={prov.keyPlaceholder} className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-blue-500" />
              <button onClick={() => setSettingsShowKey(!settingsShowKey)} className="rounded-lg border border-zinc-700 px-3 py-2.5 text-xs text-zinc-400 hover:bg-zinc-800">{settingsShowKey ? "🙈" : "👁️"}</button>
            </div>
            <p className="mt-1 text-[10px] text-zinc-600">{prov.keyHint}</p>
          </div>

          {/* 模型选择 */}
          <div>
            <label className="mb-1.5 block text-xs text-zinc-500">模型</label>
            <div className="space-y-1.5">
              {prov.models.map(m => (
                <button key={m.value} onClick={() => setSettingsModel(m.value)} className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${settingsModel === m.value ? "border-blue-500 bg-blue-500/10 text-blue-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
                  <span className="font-medium">{m.label}</span>
                  {m.tag && <span className="ml-1.5 rounded bg-green-900/30 px-1.5 py-0.5 text-[10px] text-green-400">{m.tag}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <button onClick={async () => {
              if (!settingsKey.trim()) return;
              setSettingsTesting(true);
              setSettingsTestResult(null);
              try {
                let ok = false;
            if (settingsProvider === "wanxiang") {
                  // 万相 API 有 CORS 限制，改为格式校验直接保存
                  const key = settingsKey.trim();
                  if (key.startsWith("sk-") && key.length > 10) {
                    ok = true;
                    localStorage.setItem("wanxiang_api_config", JSON.stringify({ apiKey: key }));
                  }
                } else {
                  // 测试 DeepSeek Key
                  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${settingsKey.trim()}`,
                    },
                    body: JSON.stringify({
                      model: settingsModel,
                      messages: [{ role: "user", content: "ping" }],
                      max_tokens: 5,
                    }),
                  });
                  if (res.ok) {
                    ok = true;
                    localStorage.setItem("ai_drama_api_config", JSON.stringify({ provider: settingsProvider, key: settingsKey.trim(), model: settingsModel }));
                  }
                }
                setSettingsTestResult(ok ? "ok" : "fail");
              } catch {
                setSettingsTestResult("fail");
              }
              setSettingsTesting(false);
            }} disabled={!settingsKey.trim() || settingsTesting} className="flex-1 rounded-lg border border-zinc-700 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-50">
              {settingsTesting ? "测试中..." : settingsTestResult === "ok" ? "✅ 连接成功" : settingsTestResult === "fail" ? "❌ 连接失败" : "🔌 测试连接"}
            </button>
            <button onClick={() => {
              const cfg = { provider: settingsProvider, key: settingsKey, model: settingsModel };
              localStorage.setItem("ai_drama_api_config", JSON.stringify(cfg));
              if (settingsProvider === "wanxiang") {
                localStorage.setItem("wanxiang_api_config", JSON.stringify({ apiKey: settingsKey }));
              }
              setPage("dashboard");
            }} disabled={!settingsKey.trim()} className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50">保存并返回</button>
          </div>
        </div>
      </div>
    );
  }

  // ========== 角色页 ==========
  if (page === "characters") {
    const chars = characters;
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <button onClick={() => setPage("dashboard")} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white">← 返回</button>
          <h1 className="text-sm font-semibold">我的角色</h1><div className="w-12" />
        </header>
        <section className="px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-zinc-500">已创建 {chars.length}/{MAX_CHARACTERS} 个角色</p>
            {chars.length < MAX_CHARACTERS && <button onClick={() => { setFormName(""); setFormRole(""); setFormDesc(""); setShowForm(true); }} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">+ 新角色</button>}
          </div>
          {chars.length === 0 ? (
            <div className="mt-12 text-center">
              <div className="mb-3 text-4xl">🎭</div>
              <p className="mb-1 text-sm text-zinc-300">还没有角色</p>
              <p className="mb-6 text-xs text-zinc-600">创建你的第一个AI角色，让 TA 成为短剧的主角</p>
              <button onClick={() => { setEditingCharId(null); setFormName(""); setFormRole(""); setFormDesc(""); setFormImageUrl(""); setFormImageSource("ai"); setShowForm(true); }} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium">创建第一个角色</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {chars.map(c => (
                <button key={c.id} onClick={() => {
                  setEditingCharId(c.id); setFormName(c.name); setFormRole(c.role); setFormDesc(c.description);
                  setFormImageUrl(c.imageUrl); setFormImageSource(c.imageSource || "ai"); setShowForm(true);
                }} className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden text-left group w-full">
                  <div className="aspect-square w-full bg-zinc-800 flex items-center justify-center text-4xl">
                    {c.imageUrl ? <img src={c.imageUrl} alt={c.name} className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).src = generateAvatarSVG(c.name, nameToColors(c.name)); }} /> : <img src={generateAvatarSVG(c.name, nameToColors(c.name))} alt={c.name} className="h-full w-full object-cover" />}
                  </div>
                  <div className="p-2.5">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-sm font-medium text-white">{c.name}</h3>
                      {c.role && <span className="shrink-0 rounded border border-zinc-600/30 bg-zinc-500/20 px-1.5 py-0.5 text-[10px] text-zinc-400">{c.role}</span>}
                    </div>
                    {c.description && <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{c.description}</p>}
                  </div>
                </button>
              ))}
              {chars.length < MAX_CHARACTERS && (
                <button onClick={() => { setFormName(""); setFormRole(""); setFormDesc(""); setShowForm(true); }} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-2xl text-zinc-400">+</div>
                  <span className="text-xs text-zinc-500">创建新角色</span>
                </button>
              )}
            </div>
          )}
        </section>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
            <div className="w-full max-w-md rounded-t-2xl bg-zinc-900 p-5 sm:rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">{editingCharId ? "编辑角色" : "创建新角色"}</h2>
                {editingCharId && (
                  <button onClick={() => handleDeleteCharacter(editingCharId)} className="text-xs text-red-400 border border-red-800/50 rounded-lg px-3 py-1.5 hover:bg-red-950/30">🗑️ 删除此角色</button>
                )}
              </div>
              <label className="mb-1 block text-xs text-zinc-500">角色名称</label>
              <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="给角色取个名字..." className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-blue-500" maxLength={20} />
              <label className="mb-1.5 block text-xs text-zinc-500">角色定位</label>
              <div className="mb-4 flex flex-wrap gap-2">
                {ROLE_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setFormRole(opt.value)} className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition ${formRole === opt.value ? "border-blue-500 bg-blue-500/20 text-blue-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
                    <span>{opt.emoji}</span><span>{opt.label}</span>
                  </button>
                ))}
              </div>
              <label className="mb-1 block text-xs text-zinc-500">角色描述</label>
              <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="性格 / 外貌 / 背景..." rows={2} className="mb-4 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-blue-500" maxLength={200} />

              {/* 角色形象图 */}
              <label className="mb-1.5 block text-xs text-zinc-500">角色形象图</label>
              <div className="mb-3 flex gap-2">
                <button type="button" onClick={() => { setFormImageSource("ai"); if (!formImageUrl.startsWith("data:")) setFormImageUrl(formDesc.trim() ? generateCharacterImage(formDesc) : ""); }} className={`flex-1 rounded-lg border py-2 text-xs transition ${formImageSource === "ai" ? "border-blue-500 bg-blue-500/20 text-blue-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>🤖 AI 生成</button>
                <button type="button" onClick={() => { fileInputRef.current?.click(); }} className={`flex-1 rounded-lg border py-2 text-xs transition ${formImageSource === "upload" ? "border-blue-500 bg-blue-500/20 text-blue-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>📷 从相册上传</button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

              {formImageUrl && (
                <div className="mb-4 overflow-hidden rounded-lg border border-zinc-700">
                  <img src={formImageUrl} alt="角色预览" className="w-full max-h-64 object-contain" />
                </div>
              )}
              {!formImageUrl && formImageSource === "upload" && (
                <div onClick={() => fileInputRef.current?.click()} className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 py-5 text-zinc-500">
                  <span className="mb-1 text-2xl">📁</span>
                  <span className="text-xs">点击选择相册照片</span>
                  <span className="mt-0.5 text-[10px] text-zinc-600">支持 JPG / PNG / WebP</span>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-zinc-700 py-2.5 text-sm text-zinc-400">取消</button>
                <button onClick={handleSaveCharacter} disabled={!formName.trim()} className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-50">{editingCharId ? "保存修改" : "创建角色"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========== 剧情生成页 ==========
  if (page === "story") {
    const chars = loadChars();
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <button onClick={() => setPage("dashboard")} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white">← 返回</button>
          <h1 className="text-sm font-semibold">生成剧情</h1><div className="w-12" />
        </header>
        <div className="px-4 py-4 space-y-4">
          {/* 故事名称 */}
          <div>
            <label className="mb-1 block text-xs text-zinc-500">故事名称 <span className="text-zinc-700">（留空让AI取名）</span></label>
            <input type="text" value={storyTitle} onChange={e => setStoryTitle(e.target.value)} placeholder="给故事取个名字..." className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-blue-500" maxLength={30} />
          </div>

          {/* 选择风格 */}
          <div>
            <label className="mb-1.5 block text-xs text-zinc-500">故事风格</label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map(g => (
                <button key={g.value} onClick={() => { setStoryGenre(g.value); setStorySetting(DEFAULT_SETTINGS[g.value] || ""); }} className={`rounded-lg border px-3 py-1.5 text-xs transition ${storyGenre === g.value ? "border-blue-500 bg-blue-500/20 text-blue-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>{g.label}</button>
              ))}
            </div>
          </div>
          {/* 设定 */}
          <div>
            <label className="mb-1 block text-xs text-zinc-500">故事背景</label>
            <input type="text" value={storySetting} onChange={e => setStorySetting(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
          </div>
          {/* 集数 */}
          <div>
            <label className="mb-1 block text-xs text-zinc-500">集数</label>
            <div className="flex gap-2">
              {[1, 2, 3, 5].map(n => (
                <button key={n} onClick={() => setStoryEpCount(n)} className={`rounded-lg border px-4 py-2 text-xs transition ${storyEpCount === n ? "border-blue-500 bg-blue-500/20 text-blue-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>{n} 集</button>
              ))}
            </div>
          </div>
          {/* 选择参与角色（可多选） */}
          <div>
            <label className="mb-1.5 block text-xs text-zinc-500">选择参演角色 <span className="text-zinc-700">（点击切换）</span></label>
            {chars.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {chars.map(c => {
                    const selected = storySelectedCharIds.includes(c.id);
                    return (
                      <button key={c.id} onClick={() => {
                        setStorySelectedCharIds(prev =>
                          prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                        );
                      }} className={`rounded-full border px-3 py-1 text-xs transition ${selected ? "bg-blue-600 border-blue-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
                        {c.role ? `${c.name}（${c.role}）` : c.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-zinc-600">已选 {storySelectedCharIds.length}/{chars.length} 个角色</p>
              </>
            ) : (
              <div className="rounded-lg border border-yellow-800/30 bg-yellow-950/10 p-3 text-xs text-yellow-500">⚠️ 还没有创建角色，请先创建角色再生成剧情</div>
            )}
          </div>

          <button onClick={handleGenerateStory} disabled={generating} className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {generating ? "生成中..." : "🎬 生成剧情"}
          </button>

          {/* 错误提示 */}
          {storyError && (
            <div className="rounded-lg border border-red-800/50 bg-red-950/20 p-3 text-xs text-red-400">{storyError}</div>
          )}

          {/* 结果显示 */}
          {storyResult && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <h2 className="text-lg font-bold text-white mb-3">{storyResult.title}</h2>
              {storyResult.episodes.map((ep, i) => (
                <div key={i} className="mb-4 last:mb-0">
                  <h3 className="text-sm font-semibold text-blue-400 mb-2">第{i + 1}集：{ep.title}</h3>
                  {(ep.scenes || []).map((scene, j) => (
                    <p key={j} className="text-xs text-zinc-400 mb-1.5 leading-relaxed">{scene}</p>
                  ))}
                  {ep.content && <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{ep.content}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========== 发布页 ==========
  // ========== 发布到频道页 ==========
  if (page === "publish") {
    const storyList = loadStories();

    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <button onClick={() => setPage("dashboard")} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white">← 返回</button>
          <h1 className="text-sm font-semibold">发布到频道</h1><div className="w-12" />
        </header>
        <div className="px-4 py-4 space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-xs text-zinc-400 leading-relaxed">
            <p className="font-medium text-white mb-1">📡 一键发布到「热门AI精选」频道</p>
            <p className="mt-2">选择一个作品，点发布按钮会自动发到频道「AI讨论」版块。</p>
            <p className="mt-1">已创作 {storyList.length} 个作品。</p>
          </div>
          {storyList.length === 0 ? (
            <div className="mt-8 text-center">
              <div className="mb-3 text-4xl">📝</div>
              <p className="text-sm text-zinc-300">还没有作品</p>
              <p className="mt-1 text-xs text-zinc-600">先去生成剧情吧</p>
            </div>
          ) : (
            <div className="space-y-3">
              {storyList.slice(0, 10).map(s => (
                <div key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 mr-2">
                      <h3 className="text-sm font-semibold text-white truncate">{s.title}</h3>
                      <p className="text-[10px] text-zinc-600 mt-0.5">{s.genre} · {s.episodes.length}集</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={async () => {
                        try {
                          const content = `${s.title}\n\n${s.episodes.map(ep => `第${ep.episodeNumber}集：${ep.title}\n${ep.content}`).join("\n\n")}`;
                          await navigator.clipboard.writeText(content);
                          setPublishCopiedId(s.id);
                          setTimeout(() => setPublishCopiedId(null), 2000);
                        } catch {}
                      }} className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[10px] text-zinc-400 hover:bg-zinc-800">{publishCopiedId === s.id ? "✅" : "📋 复制"}</button>
                      <button onClick={() => {
                        const content = `${s.title}\n\n${s.episodes.map(ep => `第${ep.episodeNumber}集：${ep.title}\n${ep.content}`).join("\n\n")}`;
                        window.open(`https://pd.qq.com/s/cniwz5s91`, '_blank');
                      }} className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[10px] font-medium text-white">📡 去发布</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========== 作品页 ==========
  if (page === "works") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <button onClick={() => setPage("dashboard")} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white">← 返回</button>
          <h1 className="text-sm font-semibold">我的作品</h1><div className="w-12" />
        </header>
        <div className="px-4 py-4">
          {stories.length === 0 ? (
            <div className="mt-12 text-center">
              <div className="mb-3 text-4xl">📊</div>
              <p className="text-sm text-zinc-300">还没有作品</p>
              <p className="mt-1 text-xs text-zinc-600">先创建角色、生成剧情，作品会出现在这里</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stories.map(s => (
                <div key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 relative group">
                  <button onClick={() => {
                    const list = loadStories().filter(x => x.id !== s.id);
                    saveStories(list); setStories(list);
                  }} className="absolute top-3 right-3 rounded-full bg-red-900/70 w-6 h-6 flex items-center justify-center text-xs text-red-300 opacity-0 group-hover:opacity-100 transition hover:bg-red-800">✕</button>
                  <div className="flex items-start justify-between pr-8">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{s.title}</h3>
                      <p className="text-[10px] text-zinc-600 mt-1">{s.genre} · {s.episodes.length}集</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {s.episodes.map((ep, i) => (
                      <details key={i} className="text-xs">
                        <summary className="cursor-pointer text-zinc-400 hover:text-white">第{ep.episodeNumber}集：{ep.title}</summary>
                        <p className="mt-1.5 text-zinc-500 whitespace-pre-wrap leading-relaxed pl-2">{ep.content}</p>
                      </details>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

function FeatureCard({ icon, title, desc, onClick }: { icon: string; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-left backdrop-blur-sm transition hover:border-zinc-700 hover:bg-zinc-800/50">
      <div className="mb-2 text-2xl">{icon}</div>
      <h4 className="text-sm font-semibold text-white group-hover:text-blue-400">{title}</h4>
      <p className="mt-0.5 text-xs text-zinc-500">{desc}</p>
    </button>
  );
}
