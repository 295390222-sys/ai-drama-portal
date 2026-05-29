// ========================================
// 剧情生成引擎
// - 严格 Prompt 分层（system / developer / user）
// - 禁止现代词汇污染
// - 正确 API 结构（model: deepseek-chat, stream: false）
// - 完整错误分类和展示
// ========================================

export interface CharacterBrief {
  id: string;
  name: string;
  role: string;
  description: string;
}

export interface GenParams {
  title: string;
  genre: string;
  setting: string;
  episodeCount: number;
  characters: CharacterBrief[];
  selectedCharIds: string[];
}

export interface GenResult {
  title: string;
  outline: string;
  episodes: { episodeNumber: number; title: string; content: string }[];
  success: boolean;
  error?: string;
  usedLocal: boolean;
}

// ========== Prompt 模板 ==========

const ROLE_LABELS: Record<string, string> = {
  "主角": "⭐ 主角",
  "配角": "🎭 配角",
  "反派": "😈 反派",
  "男2": "🥈 男2",
  "女2": "🥈 女2",
  "男3": "🥉 男3",
  "女3": "🥉 女3",
};

function buildCharacterSummary(chars: CharacterBrief[]): string {
  return chars
    .map((c) => {
      const roleLabel = ROLE_LABELS[c.role] || c.role || "角色";
      const desc = c.description || "暂无详细描述";
      return `【${roleLabel}】${c.name}：${desc}`;
    })
    .join("\n");
}

export function buildSystemPrompt(genre: string): string {
  const genreRules: Record<string, string> = {
    "古装":
      "古代王朝背景，宫廷、江湖、权谋风格。所有对话、叙述必须使用古风语言。不得出现任何现代或科技元素。",
    "现代":
      "当代城市生活，现实向剧情。语言自然现代。",
    "仙侠":
      "修仙世界，门派、功法、飞升体系。语言风格偏文言白话结合，禁止现代科技词汇。",
    "都市":
      "现代都市+职场+情感冲突。语言自然现代。",
    "科幻":
      "未来科技、AI、太空、赛博世界。允许科技和未来元素，语言前瞻但不生硬。",
    "悬疑":
      "推理、案件、反转剧情。设定在现代或近现代。语言简洁克制。",
    "甜宠":
      "高糖恋爱、轻冲突、情感向。设定在现代都市，语言轻松甜蜜。",
    "穿越":
      "跨时空设定，古今/异世界切换。注意保持每个时代的世界观一致性。",
  };

  const rule = genreRules[genre];

  return `你是专业古风短剧编剧。擅长创作紧凑、有冲突的连续剧剧本。

== 禁止规则 ==
- 禁止出现任何现代互联网词汇：API、代码、模型、服务器、接口、AI、OpenAI、DeepSeek、算法、数据、配置、网络、缓存、token、数据库
- 禁止出现任何编程/开发相关词汇
- 禁止使用括号或中英混杂术语
- 对话要自然，符合人物身份和时代背景

== 世界观规则 ==
${rule || "请根据故事类型自然地设定世界观。"}

== 格式规则 ==
每集输出格式：
第{N}集：{集标题}
{剧情内容，包含场景描写和角色对话}

全部输出结束后，用"【完】"结尾。`;
}

function buildUserPrompt(params: GenParams): string {
  const { title, genre, setting, episodeCount, characters, selectedCharIds } =
    params;

  const selectedChars = characters.filter((c) =>
    selectedCharIds.includes(c.id)
  );
  const charSummary = buildCharacterSummary(selectedChars);
  const charNames =
    selectedChars.length > 0
      ? selectedChars.map((c) => c.name).join("、")
      : "（由你决定主角和配角）";

  return `请创作一部${episodeCount}集${genre}短剧剧本。

【剧名】${title || "（由你取名）"}
【类型】${genre}
【世界设定】${setting}
【集数】${episodeCount}集（每集200-400字）

【参演角色】
${charNames}

【角色详情】
${charSummary || "（无角色设定，请自行创作）"}

【要求】
- 每集包含场景描写和角色对话
- 剧情要有起承转合
- 对话符合人物性格
- 有冲突和转折`;
}

// ========== 本地备用模板 ==========

function generateLocalEpisodes(chars: CharacterBrief[], genre: string, setting: string, count: number) {
  const mainChar = chars.find(c => c.role === "主角") || chars[0];
  const villainChar = chars.find(c => c.role === "反派") || chars[1] || chars[0];
  const sideChar = chars.find(c => ["配角", "男2", "女2"].includes(c.role)) || chars[0];
  const mainName = mainChar?.name || "主角";
  const villainName = villainChar?.name || "反派";
  const sideName = sideChar?.name || "配角";
  const otherNames = chars.filter(c => c.id !== mainChar?.id && c.id !== villainChar?.id && c.id !== sideChar?.id);

  const scenarios = [
    {
      title: `${mainName}的初遇`,
      content: `【场景：${setting}，一个普通的清晨】

${mainName}站在窗前，望着远处的天际线。脚步声响起，${sideName}走了进来。

（${sideName}）：你真的想好了吗？
（${mainName}）：没有退路了。
（${sideName}）：可是……
（${mainName}）：别再劝我了。

${villainName}从阴影中走出，嘴角带着一丝冷笑。

（${villainName}）：我就知道你在这里。
（${mainName}）：你来做什么？
（${villainName}）：给你最后一次机会。`
    },
    {
      title: `暗流涌动`,
      content: `【场景：夜晚，${setting}的某个角落】

${mainName}独自一人，手中握着一封信。

（${mainName}）：（自言自语）原来一切都不是巧合。

${sideName}从背后走来。

（${sideName}）：你发现了什么？
（${mainName}）：太多事情了。${villainName}比我想象的还要危险。

远处传来${villainName}的笑声。

（${villainName}）：聪明。可惜，聪明人往往活不长。`
    },
    {
      title: `生死抉择`,
      content: `【场景：${setting}的中心】

${mainName}被${villainName}堵住了去路。周围的气氛紧张到了极点。

（${villainName}）：你逃不掉的。
（${mainName}）：我也没打算逃。
（${villainName}）：哦？倒是出乎我的意料。
（${mainName}）：该做个了结了。

${sideName}突然出现，站在了${mainName}身边。

（${sideName}）：不是一个人。是两个人。`
    },
    {
      title: `真相大白`,
      content: `【场景：${setting}，决战前夕】

${mainName}找到了证据，一切的真相开始浮出水面。

（${mainName}）：原来这一切都是他在背后操控。
（${sideName}）：那你打算怎么办？
（${mainName}）：不能再让他继续下去了。

${villainName}似乎察觉到了什么，开始加紧行动。暴风雨即将来临。`
    },
    {
      title: `新的开始`,
      content: `【场景：${setting}，风波过后】

${mainName}站在阳光下，${sideName}站在身旁。

（${sideName}）：一切都结束了。
（${mainName}）：不。是刚刚开始。
（${sideName}）：接下来打算做什么？
（${mainName}）：还有很多事要去完成。

远处，天空晴朗。新的篇章，才刚刚翻开。`
    }
  ];

  return {
    title: `${mainName}的故事`,
    outline: `在${setting}中，${mainName}意外卷入了一场命运之争。${villainName}的阴影笼罩着一切，${sideName}在关键时刻伸出了援手。真相一步步浮出水面，但代价也越来越大。`,
    episodes: Array.from({ length: Math.min(count, scenarios.length) }, (_, i) => ({
      episodeNumber: i + 1,
      title: scenarios[i].title,
      content: scenarios[i].content,
    }))
  };
}

// ========== 调用 AI API ==========

function getApiConfig(): { key: string; provider: string; model: string } | null {
  try {
    const raw = localStorage.getItem("ai_drama_api_config");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

interface AIResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message: string };
}

async function callDeepSeek(params: GenParams): Promise<GenResult> {
  const apiConfig = getApiConfig();
  if (!apiConfig || !apiConfig.key) {
    // 无 API Key，使用本地
    const local = generateLocalEpisodes(params.characters, params.genre, params.setting, params.episodeCount);
    return { ...local, success: false, usedLocal: true, error: "未配置 API Key，使用本地模板生成" };
  }

  const systemPrompt = buildSystemPrompt(params.genre);
  const userPrompt = buildUserPrompt(params);

  let response: Response;
  try {
    response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiConfig.key.trim()}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2048,
        temperature: 0.7,
        stream: false,
      }),
    });
  } catch (e: any) {
    // 网络错误
    const local = generateLocalEpisodes(params.characters, params.genre, params.setting, params.episodeCount);
    return {
      ...local,
      success: false,
      usedLocal: true,
      error: `网络错误：${e?.message || "无法连接到 AI 服务"}。已使用本地模板替代。`,
    };
  }

  if (!response.ok) {
    let errMsg = `API 请求失败（HTTP ${response.status}）`;
    try {
      const errBody = await response.json();
      if (errBody.error?.message) {
        errMsg += `：${errBody.error.message}`;
      }
    } catch {}
    // 特定状态码提示
    if (response.status === 401) {
      errMsg += "。API Key 可能无效或已过期，请到 AI 设置中检查。";
    } else if (response.status === 429) {
      errMsg += "。请求频率超限（Token 额度不足），请稍后再试。";
    } else if (response.status === 402) {
      errMsg += "。账户余额不足，请充值。";
    } else if (response.status >= 500) {
      errMsg += "。AI 服务暂时不可用，请稍后重试。";
    }
    const local = generateLocalEpisodes(params.characters, params.genre, params.setting, params.episodeCount);
    return { ...local, success: false, usedLocal: true, error: errMsg };
  }

  let data: AIResponse;
  try {
    data = await response.json();
  } catch {
    const local = generateLocalEpisodes(params.characters, params.genre, params.setting, params.episodeCount);
    return { ...local, success: false, usedLocal: true, error: "API 返回数据格式异常，无法解析。" };
  }

  if (data.error) {
    const local = generateLocalEpisodes(params.characters, params.genre, params.setting, params.episodeCount);
    return {
      ...local,
      success: false,
      usedLocal: true,
      error: `AI 返回错误：${data.error.message}`,
    };
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    const local = generateLocalEpisodes(params.characters, params.genre, params.setting, params.episodeCount);
    return { ...local, success: false, usedLocal: true, error: "AI 返回内容为空。可能模型不支持或 Token 受限。" };
  }

  // 解析 AI 输出
  const lines = content.split("\n");
  const titleLine = lines.find((l) => l.startsWith("标题：") || l.startsWith("标题:"));
  const storyTitle = params.title || (titleLine ? titleLine.replace(/^标题[：:]\s*/, "").trim() : "");

  // 提取集标题
  const episodes: { episodeNumber: number; title: string; content: string }[] = [];
  let currentEp: { title: string; contentLines: string[] } | null = null;

  for (const line of lines) {
    const epMatch = line.match(/^第(\d+)集[：:]\s*(.*)/);
    if (epMatch) {
      if (currentEp) {
        episodes.push({
          episodeNumber: episodes.length + 1,
          title: currentEp.title,
          content: currentEp.contentLines.join("\n").trim(),
        });
      }
      currentEp = { title: epMatch[2] || `第${epMatch[1]}集`, contentLines: [] };
    } else if (currentEp && !line.match(/^标题[：:]/) && !line.match(/^【完】/)) {
      currentEp.contentLines.push(line);
    }
  }
  if (currentEp) {
    episodes.push({
      episodeNumber: episodes.length + 1,
      title: currentEp.title,
      content: currentEp.contentLines.join("\n").trim(),
    });
  }

  if (episodes.length === 0) {
    const local = generateLocalEpisodes(params.characters, params.genre, params.setting, params.episodeCount);
    return { ...local, success: false, usedLocal: true, error: "AI 返回内容格式无法解析，已使用本地模板。" };
  }

  // 从内容中提取简介
  const outlineMatch = content.match(/【剧情简介】\s*([\s\S]*?)(?=【第|$)/);
  const outline = outlineMatch ? outlineMatch[1].trim() : "";

  return {
    title: storyTitle || episodes[0]?.title || "未命名短剧",
    outline,
    episodes,
    success: true,
    usedLocal: false,
  };
}

// ========== 对外接口 ==========

export async function generateStory(params: GenParams): Promise<GenResult> {
  // 安全检查：必须有角色
  if (!params.characters || params.selectedCharIds.length === 0) {
    return {
      title: "",
      outline: "",
      episodes: [],
      success: false,
      usedLocal: false,
      error: "请至少选择一个角色参与剧情。",
    };
  }

  return callDeepSeek(params);
}
