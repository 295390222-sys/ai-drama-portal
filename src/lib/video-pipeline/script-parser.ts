// ========================================
// 剧本解析器：自然语言 → 结构化事件
//
// 关键改动：
// - 解析结果中的角色名自动通过注册表归一化
// - `meiqiu` → `煤球`（别名转标准名）
// - 角色名在 parser 层就保证正确
// ========================================

import { getRegisteredNames } from "./character-registry";

export interface ScriptEvent {
  index: number;
  startTime: number;
  endTime: number;
  scene: string;
  characters: string[];
  action: string;
}

export interface ParseResult {
  events: ScriptEvent[];
  raw: string;
  success: boolean;
  error?: string;
}

// ========== 角色名归一化映射 ==========
//
// 硬编码别名映射（无需查询 IndexedDB）
// 覆盖剧本中常见的中/英混写
// 注意：这层只是"猜测映射"，最终绑定由 character-registry 确保

const ALIAS_MAP: Record<string, string> = {
  // 常见英文/拼音 → 中文
  "meiqiu": "煤球",
  "mq": "煤球",
  "cat": "猫仔",
  "catgirl": "猫仔",
  "mao": "猫仔",
  // 中英混写
  "煤球meiqiu": "煤球",
  "meiqiu煤球": "煤球",
};

/** 对单个角色名做快速别名归一化 */
function quickNormalize(name: string): string {
  const lower = name.trim().toLowerCase();
  for (const [alias, standard] of Object.entries(ALIAS_MAP)) {
    if (lower === alias || lower === alias.toLowerCase()) {
      return standard;
    }
  }
  return name.trim();
}

/** 从中文文本中猜测可能提及的角色名 */
function guessCharacterFromText(text: string, knownNames: string[]): string[] {
  const found: string[] = [];

  for (const name of knownNames) {
    if (text.includes(name)) {
      found.push(name);
    }
  }

  // 如果没有匹配到已知角色名，尝试正则提取
  if (found.length === 0) {
    const match = text.match(/(.{1,4})(?:在|遇到|发现|走进|来到|被|看着|对|和|说)/);
    if (match) {
      const guessed = quickNormalize(match[1]);
      found.push(guessed);
    }
  }

  return found;
}

// ========== 本地备用解析 ==========

function localParse(script: string, knownNames: string[]): ScriptEvent[] {
  const sentences = script
    .split(/[。！？\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  const events: ScriptEvent[] = [];
  const durationPerEvent = 3;

  for (let i = 0; i < Math.min(sentences.length, 6); i++) {
    const text = sentences[i];
    const characters = guessCharacterFromText(text, knownNames);

    events.push({
      index: i,
      startTime: i * durationPerEvent,
      endTime: (i + 1) * durationPerEvent,
      scene: text.slice(0, 30),
      characters,
      action: text.length > 20 ? text.slice(20, 50) : text,
    });
  }

  return events;
}

// ========== 主解析入口 ==========

export async function parseScript(
  script: string
): Promise<ParseResult> {
  if (!script.trim()) {
    return { events: [], raw: "", success: false, error: "请输入剧本内容" };
  }

  // 预先获取已知角色名列表（用于本地解析的实体识别）
  let knownNames: string[] = [];
  try {
    const { getRegisteredNames } = await import("./character-registry");
    knownNames = await getRegisteredNames();
  } catch {
    knownNames = [];
  }

  // 先尝试用 DeepSeek 解析（只有配了 DeepSeek Key 才试）
  try {
    const apiConfigRaw = localStorage.getItem("ai_drama_api_config");
    if (apiConfigRaw) {
      const apiConfig = JSON.parse(apiConfigRaw);
      // 只有 provider 是 deepseek 且 key 有效时才调 API
      // 如果配的是 wanxiang（万相Key），跳过 DeepSeek 直接走本地解析
      if (apiConfig.key && (!apiConfig.provider || apiConfig.provider === "deepseek")) {
        const response = await fetch(
          "https://api.deepseek.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiConfig.key.trim()}`,
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: [
                {
                  role: "system",
                  content: `你是一个视频剧本解析器。将用户输入的剧本解析成结构化的事件列表。

输出严格的 JSON 格式（不要 markdown 代码块），格式如下：
[
  { "index": 0, "scene": "场景描述（10字内）", "characters": ["角色名"], "action": "动作描述（15字内）" },
  { "index": 1, "scene": "...", "characters": [...], "action": "..." }
]

已注册角色名：${knownNames.join("、")}

规则：
- 每个事件 2-4 秒视频时长
- 每个事件最多 3 个角色
- 按时间顺序排列
- 只输出 JSON，不要多余文字
- 总事件数控制在 3-6 个
- characters 字段必须使用已注册的标准角色名`,
                },
                { role: "user", content: script },
              ],
              max_tokens: 1024,
              temperature: 0.3,
              stream: false,
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const rawContent = data.choices?.[0]?.message?.content || "";

          const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const events: ScriptEvent[] = parsed.map(
                (e: any, i: number) => ({
                  index: i,
                  startTime: i * 3,
                  endTime: (i + 1) * 3,
                  scene: e.scene || e.description || "",
                  characters: (e.characters || []).map((c: string) =>
                    quickNormalize(c)
                  ),
                  action: e.action || "",
                })
              );
              return { events, raw: script, success: true };
            }
          }
        }
      }
    }
  } catch {
    // fall through to local parse
  }

  // 降级到本地解析
  const events = localParse(script, knownNames);
  return {
    events,
    raw: script,
    success: events.length > 0,
    error: events.length === 0 ? "无法解析剧本" : undefined,
  };
}
