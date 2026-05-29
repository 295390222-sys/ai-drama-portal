// ========================================
// Execution Manager - 视频生成执行管理器
// 管理每个 Scene 的生成状态、重试、并发
// 使用通义万相 API 生成视频
// ========================================

import { Shot } from "./scene-builder";
import { submitImageToVideo, submitTextToVideo, pollTask } from "./wanxiang-gen";

// ========== 状态类型 ==========

export type SceneStatus = "pending" | "running" | "success" | "failed" | "skipped";

export interface SceneExecution {
  sceneId: number;
  scene: string;
  status: SceneStatus;
  videoUrl: string;
  error: string;
  retryCount: number;
  maxRetries: number;
  startedAt: number | null;
  completedAt: number | null;
  duration: number;
}

export interface ExecutionState {
  scenes: SceneExecution[];
  overallStatus: "idle" | "running" | "partial" | "complete" | "failed";
  progress: {
    total: number;
    completed: number;
    failed: number;
    running: number;
  };
}

const MAX_CONCURRENT = 2; // 通义万相 API 并发限制

// ========== 主执行器 ==========

export class ExecutionManager {
  private scenes: SceneExecution[] = [];
  private shots: Shot[] = [];
  private listeners: Array<(state: ExecutionState) => void> = [];
  private activeCount = 0;
  private queue: number[] = [];

  constructor() {}

  /** 初始化场景列表 */
  initShots(shots: Shot[]) {
    this.shots = shots;
    this.scenes = shots.map((shot) => ({
      sceneId: shot.index,
      scene: shot.scene,
      status: "pending" as SceneStatus,
      videoUrl: "",
      error: "",
      retryCount: 0,
      maxRetries: 2,
      startedAt: null,
      completedAt: null,
      duration: shot.duration,
    }));
    this.queue = shots.map((s) => s.index);
    this.notify();
  }

  /** 订阅状态变更 */
  subscribe(cb: (state: ExecutionState) => void) {
    this.listeners.push(cb);
    cb(this.getState());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  /** 获取当前状态 */
  getState(): ExecutionState {
    const completed = this.scenes.filter((s) => s.status === "success").length;
    const failed = this.scenes.filter((s) => s.status === "failed").length;
    const running = this.scenes.filter((s) => s.status === "running").length;

    let overallStatus: ExecutionState["overallStatus"] = "idle";
    if (completed === this.scenes.length && this.scenes.length > 0) {
      overallStatus = "complete";
    } else if (running > 0) {
      overallStatus = "running";
    } else if (failed > 0 && completed + failed === this.scenes.length) {
      overallStatus = "partial";
    } else if (failed === this.scenes.length) {
      overallStatus = "failed";
    }

    return {
      scenes: this.scenes,
      overallStatus,
      progress: { total: this.scenes.length, completed, failed, running },
    };
  }

  /** 开始执行全部场景 */
  async executeAll(): Promise<ExecutionState> {
    if (this.scenes.length === 0) return this.getState();

    this.scenes.forEach((s) => {
      if (s.status !== "success") {
        s.status = "pending";
        s.error = "";
      }
    });
    this.queue = this.scenes
      .filter((s) => s.status !== "success")
      .map((s) => s.sceneId);
    this.notify();

    const promises: Promise<void>[] = [];
    while (this.queue.length > 0 || this.activeCount > 0) {
      while (this.queue.length > 0 && this.activeCount < MAX_CONCURRENT) {
        const sceneId = this.queue.shift()!;
        promises.push(this.executeScene(sceneId));
      }
      if (this.activeCount >= MAX_CONCURRENT || (this.queue.length === 0 && this.activeCount > 0)) {
        await this.delay(500);
      }
    }

    await Promise.all(promises);
    return this.getState();
  }

  /** 执行单个场景 */
  private async executeScene(sceneId: number): Promise<void> {
    const scene = this.scenes.find((s) => s.sceneId === sceneId);
    if (!scene) return;

    this.activeCount++;
    scene.status = "running";
    scene.startedAt = Date.now();
    this.notify();

    const shot = this.shots.find((s) => s.index === sceneId);

    try {
      const result = await this.callWanxiangAPI(scene, shot);
      if (result.success) {
        scene.status = "success";
        scene.videoUrl = result.videoUrl;
        scene.completedAt = Date.now();
      } else {
        throw new Error(result.error || "生成失败");
      }
    } catch (e: any) {
      scene.retryCount++;
      scene.error = e?.message || "未知错误";

      if (scene.retryCount <= scene.maxRetries) {
        await this.delay(2000 * scene.retryCount);
        return this.executeScene(sceneId);
      }

      scene.status = "failed";
      scene.completedAt = Date.now();
    } finally {
      this.activeCount--;
      this.notify();
    }
  }

  /** 调用通义万相 API */
  private async callWanxiangAPI(
    scene: SceneExecution,
    shot?: Shot
  ): Promise<{ success: boolean; videoUrl: string; error?: string }> {
    const imageUrl = shot?.characters?.[0]?.imageUrl;
    const prompt = shot?.imgPrompt || `${scene.scene}场景，时长${scene.duration}秒`;

    // 有角色图 → 图生视频
    if (imageUrl && imageUrl.startsWith("http")) {
      const submit = await submitImageToVideo(prompt, imageUrl, scene.duration);
      if (!submit.success) {
        return { success: false, videoUrl: "", error: submit.error };
      }
      const result = await pollTask(submit.taskId, 300000, 15000);
      if (result.status === "SUCCEEDED" && result.videoUrl) {
        return { success: true, videoUrl: result.videoUrl };
      }
      return { success: false, videoUrl: "", error: result.error || "生成失败" };
    }

    // 无角色图 → 文生视频
    const submit = await submitTextToVideo(prompt, scene.duration);
    if (!submit.success) {
      return { success: false, videoUrl: "", error: submit.error };
    }
    const result = await pollTask(submit.taskId, 300000, 15000);
    if (result.status === "SUCCEEDED" && result.videoUrl) {
      return { success: true, videoUrl: result.videoUrl };
    }
    return { success: false, videoUrl: "", error: result.error || "生成失败" };
  }

  /** 重试失败场景 */
  async retryFailed(): Promise<ExecutionState> {
    const failed = this.scenes.filter((s) => s.status === "failed");
    failed.forEach((s) => {
      s.status = "pending";
      s.error = "";
      s.retryCount = 0;
    });
    this.queue = failed.map((s) => s.sceneId);
    this.notify();
    return this.executeAll();
  }

  /** 跳过某个场景 */
  skipScene(sceneId: number) {
    const scene = this.scenes.find((s) => s.sceneId === sceneId);
    if (scene && scene.status === "failed") {
      scene.status = "skipped";
      this.notify();
    }
  }

  /** 获取失败场景列表 */
  getFailedScenes(): SceneExecution[] {
    return this.scenes.filter((s) => s.status === "failed");
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((cb) => cb(state));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

// ========== 工厂函数 ==========

export function createExecutionManager(): ExecutionManager {
  return new ExecutionManager();
}
