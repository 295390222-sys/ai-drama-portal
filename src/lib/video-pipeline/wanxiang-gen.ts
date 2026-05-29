// ========================================
// 通义万相（Tongyi Wanxiang）视频生成适配器
// 替代 Kling AI 的图生视频/文生视频
// ========================================

import { Shot } from "./scene-builder";

// ========== 配置 ==========

const API_BASE = "https://dashscope.aliyuncs.com";
const MODEL_T2V = "wan2.7-t2v-2026-04-25";    // 文生视频
const MODEL_I2V = "wan2.7-i2v-2026-04-25";    // 图生视频

interface WanxiangConfig {
  apiKey: string;
  endpoint?: string;
  modelT2V?: string;
  modelI2V?: string;
}

function getConfig(): WanxiangConfig | null {
  // 优先读取独立的 wanxiang_api_config
  try {
    const raw = localStorage.getItem("wanxiang_api_config");
    if (raw) {
      const cfg = JSON.parse(raw);
      if (cfg.apiKey) {
        return {
          apiKey: cfg.apiKey,
          endpoint: cfg.endpoint || API_BASE,
          modelT2V: cfg.modelT2V || MODEL_T2V,
          modelI2V: cfg.modelI2V || MODEL_I2V,
        };
      }
    }
  } catch {}

  // 兼容旧的 ai_drama_api_config（如果 provider 是 wanxiang）
  try {
    const raw = localStorage.getItem("ai_drama_api_config");
    if (raw) {
      const cfg = JSON.parse(raw);
      if (cfg.key && cfg.provider === "wanxiang") {
        return {
          apiKey: cfg.key,
          modelT2V: MODEL_T2V,
          modelI2V: MODEL_I2V,
        };
      }
    }
  } catch {}

  return null;
}

// 获取 API 端点（优先使用同域代理，解决 CORS）
function getApiEndpoint(): string {
  // 如果部署在 EdgeOne 上，/api/wanxiang 路径可用
  // 否则回退到直连 dashscope
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // 只在 COS/EdgeOne 域名下使用代理
  if (origin.includes("cos") || origin.includes("myqcloud")) {
    return "/api/wanxiang";
  }
  return "direct";
}

// ========== 提交任务 ==========

export interface SubmitResult {
  taskId: string;
  success: boolean;
  error?: string;
}

export interface TaskResult {
  taskId: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "UNKNOWN";
  videoUrl?: string;
  error?: string;
}

/**
 * 提交文生视频任务
 * 适合单镜头全片生成（带多分镜时间线）
 */
export async function submitTextToVideo(
  prompt: string,
  duration: number,
  ratio: string = "9:16"
): Promise<SubmitResult> {
  const config = getConfig();
  if (!config) {
    return { taskId: "", success: false, error: "未配置通义万相 API Key" };
  }

  // 使用代理（解决 CORS）
  const proxyEndpoint = getApiEndpoint();

  try {
    let res;
    if (proxyEndpoint === "direct") {
      res = await fetch(`${API_BASE}/api/v1/services/aigc/video-generation/video-synthesis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          "X-DashScope-Async": "enable",
        },
        body: JSON.stringify({
          model: config.modelT2V,
          input: { prompt },
          parameters: {
            resolution: "720P",
            ratio,
            duration: Math.max(2, Math.min(15, duration)),
            prompt_extend: true,
            watermark: false,
          },
        }),
      });
    } else {
      // 通过同域代理
      res = await fetch(`${proxyEndpoint}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: config.apiKey,
          model: config.modelT2V,
          prompt,
          duration,
          ratio,
        }),
      });
    }

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errBody = await res.json();
        errMsg += `: ${errBody.message || errBody.code || ""}`;
      } catch {}
      return { taskId: "", success: false, error: errMsg };
    }

    const data = await res.json();
    const taskId = data.output?.task_id;
    if (!taskId) {
      return { taskId: "", success: false, error: "API 返回缺少 task_id" };
    }

    return { taskId, success: true };
  } catch (e: any) {
    return { taskId: "", success: false, error: `网络错误: ${e?.message || "未知"}` };
  }
}

/**
 * 提交图生视频任务（使用角色图作为首帧）
 * 适合逐镜头生成
 */
export async function submitImageToVideo(
  prompt: string,
  imageUrl: string,
  duration: number,
  ratio: string = "9:16"
): Promise<SubmitResult> {
  const config = getConfig();
  if (!config) {
    return { taskId: "", success: false, error: "未配置通义万相 API Key" };
  }

  try {
    const body: any = {
      model: config.modelI2V,
      input: {
        prompt,
        media: [{ type: "first_frame", url: imageUrl }],
      },
      parameters: {
        resolution: "720P",
        ratio,
        duration: Math.max(2, Math.min(15, duration)),
        prompt_extend: true,
        watermark: false,
      },
    };

    const res = await fetch(`${config.endpoint || API_BASE}/api/v1/services/aigc/video-generation/video-synthesis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errBody = await res.json();
        errMsg += `: ${errBody.message || errBody.code || ""}`;
      } catch {}
      return { taskId: "", success: false, error: errMsg };
    }

    const data = await res.json();
    const taskId = data.output?.task_id;
    if (!taskId) {
      return { taskId: "", success: false, error: "API 返回缺少 task_id" };
    }

    return { taskId, success: true };
  } catch (e: any) {
    return { taskId: "", success: false, error: `网络错误: ${e?.message || "未知"}` };
  }
}

/**
 * 查询任务结果
 */
export async function queryTask(taskId: string): Promise<TaskResult> {
  const config = getConfig();
  if (!config) {
    return { taskId, status: "FAILED", error: "未配置通义万相 API Key" };
  }

  try {
    const res = await fetch(
      `${config.endpoint || API_BASE}/api/v1/tasks/${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
      }
    );

    if (!res.ok) {
      return { taskId, status: "FAILED", error: `查询失败: HTTP ${res.status}` };
    }

    const data = await res.json();
    const output = data.output || {};
    const status = output.task_status || "UNKNOWN";

    return {
      taskId,
      status,
      videoUrl: output.video_url,
      error: status === "FAILED" ? (output.failure_reason || "生成失败") : undefined,
    };
  } catch (e: any) {
    return { taskId, status: "FAILED", error: `网络错误: ${e?.message || "未知"}` };
  }
}

/**
 * 轮询任务直到完成
 * @param taskId 任务ID
 * @param maxWait 最大等待时间（毫秒）
 * @param interval 轮询间隔（毫秒）
 */
export async function pollTask(
  taskId: string,
  maxWait: number = 300000,
  interval: number = 10000
): Promise<TaskResult> {
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const result = await queryTask(taskId);

    if (result.status === "SUCCEEDED") {
      return result;
    }
    if (result.status === "FAILED" || result.status === "CANCELED") {
      return result;
    }
    if (result.status === "UNKNOWN") {
      return { taskId, status: "FAILED", error: "任务不存在或已过期" };
    }

    // 继续轮询
    await new Promise((r) => setTimeout(r, interval));
  }

  return {
    taskId,
    status: "FAILED",
    error: `轮询超时（${maxWait / 1000}秒），任务仍在处理中`,
  };
}

/**
 * 从分镜生成全片 Prompt（多镜头时间线）
 * 用于 t2v 一次性生成
 */
export function buildMultiShotPrompt(shots: Shot[]): string {
  const parts: string[] = [];

  shots.forEach((shot, i) => {
    const startTime = i * Math.round(shot.duration);
    const endTime = startTime + shot.duration;
    const charNames = shot.characters.map((c) => c.name).join("、");
    parts.push(
      `第${i + 1}个镜头[${startTime}-${endTime}秒]：${shot.scene}，${charNames} ${shot.action}`
    );
  });

  return parts.join("。");
}
