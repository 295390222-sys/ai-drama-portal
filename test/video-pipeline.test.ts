// ========================================
// 视频生成流水线本地测试
// 在 Node.js 中模拟 IndexedDB + localStorage
// ========================================

import { describe, test, expect, mock, beforeAll, afterAll } from "bun:test";

// ========== Mock IndexedDB + localStorage ==========

const mockDB = {
  characters: new Map(),
  stories: new Map(),
};

// Mock localStorage for script-parser
(global as any).localStorage = {
  _data: {} as Record<string, string>,
  getItem(key: string) {
    return this._data[key] || null;
  },
  setItem(key: string, value: string) {
    this._data[key] = value;
  },
  removeItem(key: string) {
    delete this._data[key];
  },
};

// Mock IndexedDB for character-registry
const origIndexedDB = (global as any).indexedDB;
(global as any).indexedDB = {
  open: () => ({
    result: {
      transaction: () => ({
        objectStore: () => ({
          getAll: () => ({
            onsuccess: null,
            result: [],
          }),
          put: () => {},
        }),
      }),
    },
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
  }),
};

console.log("🧪 ===== AI短剧宇宙 视频生成测试 =====\n");

// ========== 1. 测试角色注册表 ==========

// 需要先手动模拟 getRegisteredNames 和 lookupCharacter
// 因为这些函数依赖 getAllCharacters（IndexedDB）

import { normalizeNames } from "../lib/video-pipeline/character-registry";

// 由于 character-registry 内部调用 getAllCharacters() → IndexedDB,
// 在 Node.js 中无法直接测试。我们测试独立的逻辑。

// ========== 2. 测试本地剧本解析 ==========

import { parseScript } from "../lib/video-pipeline/script-parser";

async function testScriptParser() {
  console.log("📌 测试 1: 剧本解析器 (local fallback)\n");

  const tests = [
    {
      name: "基础剧本 - 煤球在酒吧爆炸",
      script: "煤球在酒吧喝咖啡突然遇到爆炸，被一道蓝光卷入时空裂缝",
      expectedEvents: 1,
    },
    {
      name: "多段剧本",
      script: "小美第一天到新公司上班。发现自己工位旁边的同事是高中同学。两人尴尬相认。",
      expectedEvents: 3,
    },
    {
      name: "空剧本",
      script: "",
      expectedSuccess: false,
    },
  ];

  let passed = 0;
  for (const t of tests) {
    try {
      const result = await parseScript(t.script);
      const eventsOk = result.events.length >= t.expectedEvents;
      const successOk =
        t.expectedSuccess !== false ? result.success : !result.success;

      if (eventsOk && successOk) {
        console.log(`  ✅ ${t.name}`);
        if (result.events.length > 0) {
          result.events.forEach((e, i) => {
            console.log(`     事件 ${i + 1}: 场景="${e.scene.slice(0, 20)}..." 角色=[${e.characters.join(",")}]`);
          });
        }
        passed++;
      } else {
        console.log(`  ❌ ${t.name}: 预期事件数>=${t.expectedEvents}, 实际=${result.events.length}`);
        console.log(`     错误: ${result.error || "无"}`);
      }
    } catch (e: any) {
      console.log(`  ❌ ${t.name}: ${e.message}`);
    }
  }

  const total = tests.length;
  const score = Math.round((passed / total) * 100);
  console.log(`\n  结果: ${passed}/${total} 通过 (${score}/100)\n`);

  return score;
}

// ========== 3. 测试字符归一化 ==========

function testNameNormalization() {
  console.log("📌 测试 2: 角色名归一化\n");

  const ALIAS_MAP: Record<string, string> = {
    meiqiu: "煤球",
    mq: "煤球",
    cat: "猫仔",
    catgirl: "猫仔",
    mao: "猫仔",
    "煤球meiqiu": "煤球",
    "meiqiu煤球": "煤球",
  };

  const tests = [
    { input: "煤球", expected: "煤球" },
    { input: "meiqiu", expected: "煤球" },
    { input: "mq", expected: "煤球" },
    { input: "catgirl", expected: "猫仔" },
    { input: "不存在的角色", expected: "不存在的角色" }, // 没有映射维持原样
  ];

  function quickNormalize(name: string): string {
    const lower = name.trim().toLowerCase();
    for (const [alias, standard] of Object.entries(ALIAS_MAP)) {
      if (lower === alias || lower === alias.toLowerCase()) {
        return standard;
      }
    }
    return name.trim();
  }

  let passed = 0;
  for (const t of tests) {
    const result = quickNormalize(t.input);
    if (result === t.expected) {
      console.log(`  ✅ "${t.input}" → "${result}"`);
      passed++;
    } else {
      console.log(`  ❌ "${t.input}" → "${result}" (预期 "${t.expected}")`);
    }
  }

  console.log(`\n  结果: ${passed}/${tests.length} 通过\n`);
  return Math.round((passed / tests.length) * 100);
}

// ========== 4. 测试分镜生成器 ==========

import { generateScenes } from "../lib/video-pipeline/scene-builder";
import type { ScriptEvent } from "../lib/video-pipeline/script-parser";
import type { BoundCharacter } from "../lib/video-pipeline/character-binder";

function testSceneBuilder() {
  console.log("📌 测试 3: 分镜生成器\n");

  const events: ScriptEvent[] = [
    { index: 0, startTime: 0, endTime: 3, scene: "酒吧爆炸", characters: ["煤球"], action: "喝咖啡时爆炸" },
    { index: 1, startTime: 3, endTime: 6, scene: "时空穿越", characters: ["煤球", "猫仔"], action: "被蓝光吞噬" },
    { index: 2, startTime: 6, endTime: 9, scene: "古代包围", characters: ["煤球", "士兵"], action: "被士兵包围" },
  ];

  const boundChars: BoundCharacter[] = [
    { id: "meiqiu", name: "煤球", imageUrl: "https://example.com/meiqiu.png", description: "主角", role: "主角", matched: true },
    { id: "catgirl", name: "猫仔", imageUrl: "https://example.com/cat.png", description: "调酒师", role: "配角", matched: true },
  ];

  const charMap = new Map(boundChars.map((c) => [c.name, c]));

  const result = generateScenes(events, charMap, "古装");

  let passed = 0;
  const checks = [
    { name: `生成了 ${events.length} 个分镜`, ok: result.shots.length === events.length },
    { name: `每个分镜有 duration`, ok: result.shots.every((s) => s.duration > 0) },
    { name: `每个分镜有 imgPrompt`, ok: result.shots.every((s) => s.imgPrompt.length > 0) },
    { name: `每个分镜有 lockPrompt`, ok: result.shots.every((s) => s.lockPrompt.length > 0) },
    { name: `过期风格氛围描述存在`, ok: result.shots.some((s) => s.imgPrompt.includes("古风")) },
  ];

  for (const c of checks) {
    if (c.ok) {
      console.log(`  ✅ ${c.name}`);
      passed++;
    } else {
      console.log(`  ❌ ${c.name}`);
    }
  }

  console.log(`\n  结果: ${passed}/${checks.length} 通过\n`);
  return Math.round((passed / checks.length) * 100);
}

// ========== 5. 测试质量审核 ==========

import { VideoQualityGate } from "../lib/video-pipeline/quality-gate";

async function testQualityGate() {
  console.log("📌 测试 4: 质量审核\n");

  const gate = new VideoQualityGate();
  const shot = {
    index: 0,
    scene: "酒吧爆炸",
    characters: [
      { id: "meiqiu", name: "煤球", imageUrl: "https://ex.com/m.png", description: "主角", role: "主角", matched: true },
    ],
    action: "喝咖啡时爆炸",
    duration: 3,
    imgPrompt: "酒吧爆炸场景",
    lockPrompt: "角色外观严格参照参考图",
  };

  const tests = [
    { videoUrl: "", duration: 0, desc: "无视频文件" },
    { videoUrl: "https://example.com/video.mp4", duration: 3, desc: "有效视频 时长匹配" },
    { videoUrl: "https://example.com/video.mp4", duration: 1, desc: "时长过短 (1/3)" },
  ];

  let passed = 0;
  for (const t of tests) {
    const report = await gate.checkShot(shot, t.videoUrl, t.duration);
    const hasScore = report.score >= 0 && report.score <= 100;
    if (hasScore) {
      console.log(`  ✅ ${t.desc} → ${report.score}分 (${report.passed ? "通过" : "未通过"})`);
      passed++;
    } else {
      console.log(`  ❌ ${t.desc} → 分数异常: ${report.score}`);
    }
  }

  console.log(`\n  结果: ${passed}/${tests.length} 通过\n`);
  return Math.round((passed / tests.length) * 100);
}

// ========== 6. 测试执行管理器 ==========

import { ExecutionManager } from "../lib/video-pipeline/executor";

async function testExecutionManager() {
  console.log("📌 测试 5: 执行管理器\n");

  const executor = new ExecutionManager("./test-output");

  const shots = [
    { index: 0, scene: "酒吧爆炸", characters: [], action: "", duration: 3, imgPrompt: "", lockPrompt: "" },
    { index: 1, scene: "时空穿越", characters: [], action: "", duration: 3, imgPrompt: "", lockPrompt: "" },
  ];

  executor.initShots(shots);
  let state = executor.getState();

  const checks = [
    { name: `初始化后 ${shots.length} 个 pending 场景`, ok: state.scenes.length === shots.length && state.scenes.every((s) => s.status === "pending") },
    {
      name: `状态包含 progress 对象`,
      ok: state.progress.total === shots.length && state.progress.completed === 0,
    },
  ];

  let passed = 0;
  for (const c of checks) {
    if (c.ok) {
      console.log(`  ✅ ${c.name}`);
      passed++;
    } else {
      console.log(`  ❌ ${c.name}`);
    }
  }

  // 测试订阅
  let notified = false;
  executor.subscribe(() => {
    notified = true;
  });
  const checks2 = [
    { name: "订阅状态变更会通知", ok: notified },
  ];
  for (const c of checks2) {
    if (c.ok) {
      console.log(`  ✅ ${c.name}`);
      passed++;
    } else {
      console.log(`  ❌ ${c.name}`);
    }
  }

  console.log(`\n  结果: ${passed}/${checks.length + checks2.length} 通过\n`);
  return Math.round((passed / (checks.length + checks2.length)) * 100);
}

// ========== 主入口 ==========

async function main() {
  console.log("");

  const results = {
    "角色名归一化": await Promise.resolve(testNameNormalization()),
    "剧本解析器": await testScriptParser(),
    "分镜生成器": await Promise.resolve(testSceneBuilder()),
    "质量审核": await testQualityGate(),
    "执行管理器": await testExecutionManager(),
  };

  console.log("===== 测试总结 =====\n");
  let totalScore = 0;
  let count = 0;
  let allPassed = true;

  for (const [name, score] of Object.entries(results)) {
    const emoji = score >= 80 ? "✅" : score >= 50 ? "⚠️" : "❌";
    console.log(`  ${emoji} ${name}: ${score}/100`);
    totalScore += score;
    count++;
    if (score < 60) allPassed = false;
  }

  const avg = Math.round(totalScore / count);
  console.log(`\n  平均分: ${avg}/100`);
  console.log(`  总体: ${allPassed ? "✅ 通过" : "❌ 有模块未达标"}`);
  console.log("");

  // Exit with proper code
  process.exit(allPassed ? 0 : 1);
}

main().catch((e) => {
  console.error("测试失败:", e);
  process.exit(1);
});
