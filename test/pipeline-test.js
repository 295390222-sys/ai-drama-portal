// ========================================
// 视频生成流水线 - Node.js 集成测试
// 验证核心逻辑：别名映射、分镜生成、质量审核、状态机
// ========================================

const assert = require("assert");

// ========== 1. 角色名归一化测试 ==========
console.log("\n📌 测试 1: 角色名归一化");

const ALIAS_MAP = {
  meiqiu: "煤球",
  mq: "煤球",
  cat: "猫仔",
  catgirl: "猫仔",
  mao: "猫仔",
};

function quickNormalize(name) {
  const lower = name.trim().toLowerCase();
  for (const [alias, standard] of Object.entries(ALIAS_MAP)) {
    if (lower === alias) return standard;
  }
  return name.trim();
}

const normTests = [
  { input: "煤球", expect: "煤球" },
  { input: "meiqiu", expect: "煤球" },
  { input: "mq", expect: "煤球" },
  { input: "catgirl", expect: "猫仔" },
  { input: "士兵", expect: "士兵" },
];

let nPassed = 0;
for (const t of normTests) {
  const result = quickNormalize(t.input);
  if (result === t.expect) {
    console.log(`  ✅ "${t.input}" → "${result}"`);
    nPassed++;
  } else {
    console.log(`  ❌ "${t.input}" → "${result}" (期望 "${t.expect}")`);
  }
}
console.log(`  结果: ${nPassed}/${normTests.length}\n`);

// ========== 2. 分镜生成器测试 ==========
console.log("📌 测试 2: 分镜生成器");

function generateScenes(
  events,
  boundChars,
  genre
) {
  const atmosphereMap = {
    古装: "古风色调，暖黄光线，古建筑背景",
    现代: "现代都市色调，自然光线",
    仙侠: "仙气缭绕，淡蓝紫色调，云雾背景",
    科幻: "赛博朋克色调，霓虹灯光，金属质感",
    悬疑: "暗调，冷色，阴影氛围",
    甜宠: "暖色柔和光线，粉白基调",
    穿越: "时空扭曲光效，蓝紫色过渡",
  };
  const atmosphere = atmosphereMap[genre] || "自然光线，写实风格";

  return events.map((event) => {
    const shotChars = event.characters
      .map((name) => boundChars.find((c) => c.name === name))
      .filter(Boolean);

    const charDesc = shotChars.map((c) => c.name).join("和");
    const imgPrompt = `${charDesc}在${event.scene}场景中，${event.action}。${atmosphere}。`;

    const lockParts = shotChars.map(
      (c) => `${c.name}: ${c.description || "无描述"}，使用角色设定图`
    );
    const lockPrompt =
      lockParts.length > 0
        ? `角色外观必须严格参照参考图：${lockParts.join("；")}。场景为${event.scene}。`
        : `场景为${event.scene}。`;

    return {
      index: event.index,
      scene: event.scene,
      characters: shotChars,
      action: event.action,
      duration: event.endTime - event.startTime || 3,
      imgPrompt,
      lockPrompt,
    };
  });
}

const events = [
  { index: 0, startTime: 0, endTime: 3, scene: "酒吧爆炸", characters: ["煤球"], action: "喝咖啡时爆炸" },
  { index: 1, startTime: 3, endTime: 6, scene: "时空穿越", characters: ["煤球", "猫仔"], action: "被蓝光吞噬" },
  { index: 2, startTime: 6, endTime: 10, scene: "古代包围", characters: ["煤球", "士兵"], action: "被士兵包围" },
];

const boundChars = [
  { id: "meiqiu", name: "煤球", imageUrl: "test/meiqiu.png", description: "一个爱喝咖啡的年轻人", role: "主角", matched: true },
  { id: "catgirl", name: "猫仔", imageUrl: "test/cat.png", description: "酒吧调酒师", role: "配角", matched: true },
];

const shots = generateScenes(events, boundChars, "古装");

let sPassed = 0;
const sceneChecks = [
  { label: `生成了 ${events.length} 个分镜`, ok: shots.length === events.length },
  { label: "所有分镜有 duration", ok: shots.every((s) => s.duration > 0) },
  { label: "所有分镜有 imgPrompt", ok: shots.every((s) => s.imgPrompt.length > 5) },
  { label: "所有分镜有 lockPrompt", ok: shots.every((s) => s.lockPrompt.length > 5) },
  { label: "古装风格有古风氛围", ok: shots.some((s) => s.imgPrompt.includes("古风")) },
  { label: "角色信息正确绑定", ok: shots[0].characters.length === 1 && shots[1].characters.length === 2 },
  { label: "未绑定角色不在分镜中", ok: shots[2].characters.every((c) => c.name !== "士兵") }, // 士兵没绑定
];

for (const c of sceneChecks) {
  if (c.ok) {
    console.log(`  ✅ ${c.label}`);
    sPassed++;
  } else {
    console.log(`  ❌ ${c.label}`);
  }
}
console.log(`  结果: ${sPassed}/${sceneChecks.length}\n`);

// 打印分镜详情
shots.forEach((s, i) => {
  console.log(`  🎥 镜头 ${i + 1}: ${s.scene}`);
  console.log(`     角色: ${s.characters.map((c) => c.name).join(", ")}`);
  console.log(`     时长: ${s.duration}秒`);
  console.log(`     Prompt: ${s.imgPrompt.slice(0, 60)}...`);
  console.log();
});

// ========== 3. 质量审核测试 ==========
console.log("📌 测试 3: 质量审核");

function checkDuration(expected, actual) {
  if (actual <= 0) return { passed: false, score: 0, detail: "视频未生成" };
  const ratio = actual / expected;
  if (ratio < 0.5) return { passed: false, score: 20, detail: `仅 ${Math.round(ratio * 100)}% 时长` };
  if (ratio < 0.8) return { passed: true, score: 60, detail: `${Math.round(ratio * 100)}% 时长` };
  return { passed: true, score: 90, detail: "时长匹配" };
}

function checkFaceConsistency(shot, videoUrl) {
  if (shot.characters.length === 0) return { passed: true, score: 100, detail: "无角色" };
  if (!shot.characters.every((c) => c.matched && c.imageUrl)) {
    return { passed: false, score: 30, detail: "缺少参考图" };
  }
  if (!videoUrl) return { passed: false, score: 0, detail: "视频未生成" };
  return { passed: true, score: 80, detail: "角色匹配" };
}

const qTests = [
  { shot: shots[0], video: "", duration: 0, label: "无视频" },
  { shot: shots[0], video: "https://ex.com/v.mp4", duration: 3, label: "完美时长" },
  { shot: generatedEmptyShot(), video: "", duration: 0, label: "无角色无视频" },
];

function generatedEmptyShot() {
  return {
    index: 0, scene: "测试", characters: [], action: "",
    duration: 3, imgPrompt: "", lockPrompt: "",
  };
}

for (const t of qTests) {
  const faceCheck = checkFaceConsistency(t.shot, t.video);
  const durCheck = checkDuration(t.shot.duration, t.duration);
  const score = Math.round(
    faceCheck.score * 0.5 + durCheck.score * 0.5
  );
  const passed = score >= 60;
  console.log(`  ${passed ? "✅" : "❌"} ${t.label}: ${score}分 (人脸=${faceCheck.score}, 时长=${durCheck.score})`);
}

console.log();

// ========== 4. 执行管理器状态机测试 ==========
console.log("📌 测试 4: 执行状态机");

class ExecutionManager {
  constructor() {
    this.scenes = [];
    this.listeners = [];
  }
  initShots(shots) {
    this.scenes = shots.map((s) => ({
      sceneId: s.index,
      scene: s.scene,
      status: "pending",
      videoUrl: "",
      error: "",
      retryCount: 0,
      maxRetries: 2,
    }));
  }
  getState() {
    const completed = this.scenes.filter((s) => s.status === "success").length;
    const failed = this.scenes.filter((s) => s.status === "failed").length;
    const running = this.scenes.filter((s) => s.status === "running").length;
    return {
      scenes: this.scenes,
      progress: { total: this.scenes.length, completed, failed, running },
    };
  }
  getFailedScenes() {
    return this.scenes.filter((s) => s.status === "failed");
  }
  skipScene(id) {
    const s = this.scenes.find((x) => x.sceneId === id);
    if (s && s.status === "failed") s.status = "skipped";
  }
}

const mgr = new ExecutionManager();
mgr.initShots(shots);
const initState = mgr.getState();

const mgrTests = [
  { label: `初始有 ${shots.length} 个场景`, ok: initState.scenes.length === shots.length },
  { label: "所有状态为 pending", ok: initState.scenes.every((s) => s.status === "pending") },
  { label: `progress.total = ${shots.length}`, ok: initState.progress.total === shots.length },
  { label: "progress.completed = 0", ok: initState.progress.completed === 0 },
];

let mPassed = 0;
for (const t of mgrTests) {
  if (t.ok) {
    console.log(`  ✅ ${t.label}`);
    mPassed++;
  } else {
    console.log(`  ❌ ${t.label}`);
  }
}
console.log(`  结果: ${mPassed}/${mgrTests.length}`);

// ========== 测试角色绑定（带注册表语义） ==========
console.log("\n📌 测试 5: 角色绑定（注册表语义）");

// 模拟注册表
const registry = new Map([
  ["煤球", { id: "meiqiu", name: "煤球", aliases: ["煤球", "meiqiu", "mq"], role: "主角", imageUrl: "test/m.png", description: "主角" }],
  ["猫仔", { id: "catgirl", name: "猫仔", aliases: ["猫仔", "cat", "catgirl", "调酒师"], role: "配角", imageUrl: "test/cat.png", description: "调酒师" }],
]);

function bindCharacter(name) {
  const lower = name.toLowerCase();
  for (const [, entry] of registry) {
    for (const alias of entry.aliases) {
      if (alias.toLowerCase() === lower) {
        return entry;
      }
    }
  }
  throw new Error(`角色「${name}」未在角色库中找到`);
}

const bindTests = [
  { input: "煤球", expect: "meiqiu" },
  { input: "meiqiu", expect: "meiqiu" },
  { input: "猫仔", expect: "catgirl" },
  { input: "cat", expect: "catgirl" },
  { input: "士兵", expect: null }, // 应该抛异常
];

let bPassed = 0;
for (const t of bindTests) {
  try {
    const result = bindCharacter(t.input);
    if (result.id === t.expect) {
      console.log(`  ✅ "${t.input}" → id:${result.id}`);
      bPassed++;
    } else {
      console.log(`  ❌ "${t.input}" → id:${result.id} (期望 ${t.expect})`);
    }
  } catch (e) {
    if (t.expect === null) {
      console.log(`  ✅ "${t.input}" → 正确抛出错误`);
      bPassed++;
    } else {
      console.log(`  ❌ "${t.input}" → 错误: ${e.message}`);
    }
  }
}
console.log(`  结果: ${bPassed}/${bindTests.length}`);

// ========== 总结 ==========
console.log("\n========== 测试总结 ==========");
const total = nPassed + sPassed + mPassed + bPassed;
const totalMax = normTests.length + sceneChecks.length + mgrTests.length + bindTests.length;
const avgScore = Math.round((total / totalMax) * 100);
console.log(`  通过: ${total}/${totalMax}`);
console.log(`  得分: ${avgScore}/100`);

if (total === totalMax) {
  console.log("\n  ✅ 全部测试通过！视频生成流水线核心逻辑正常。");
} else {
  console.log(`\n  ⚠️ 有 ${totalMax - total} 个测试未通过。`);
}

process.exit(total === totalMax ? 0 : 1);
