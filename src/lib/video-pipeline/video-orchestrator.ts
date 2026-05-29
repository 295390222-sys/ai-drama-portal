// ========================================
// Pipeline Orchestrator - 视频生成总控（导演系统）
//
// 完整链路：
// script → parse → scene build → character bind →
// prompt build → execute kling → quality check → collect → stitch
// ========================================

import { parseScript, ScriptEvent } from "./script-parser";
import { bindCharacters, BoundCharacter } from "./character-binder";
import { generateScenes, Shot } from "./scene-builder";
import {
  ExecutionManager,
  ExecutionState,
  createExecutionManager,
} from "./executor";
import {
  VideoQualityGate,
  QualityReport,
  createQualityGate,
} from "./quality-gate";

// ========== 配置 ==========

export interface OrchestratorConfig {
  outputDir: string;
  maxConcurrent: number;
  maxRetries: number;
  qualityThreshold: number; // 0-100
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  outputDir: "./output/video",
  maxConcurrent: 2,
  maxRetries: 2,
  qualityThreshold: 60,
};

// ========== 输入参数 ==========

export interface VideoGenParams {
  script: string;
  genre: string;
}

// ========== 分步结果 ==========

export interface PipelineResult {
  // 每步中间结果（可追溯）
  parsing: {
    events: ScriptEvent[];
    success: boolean;
    error?: string;
  };
  binding: {
    boundChars: BoundCharacter[];
    missingChars: string[];
  };
  scenes: {
    shots: Shot[];
  };
  execution: {
    state: ExecutionState | null;
    commands: string[];
  };
  quality: {
    reports: QualityReport[];
    summary: string;
    passed: boolean;
  } | null;

  // 最终输出
  finalVideoUrl: string;
  overallSuccess: boolean;
  error?: string;
}

// ========== 导演（Orchestrator） ==========

export class VideoOrchestrator {
  private config: OrchestratorConfig;
  private executor: ExecutionManager;
  private qualityGate: VideoQualityGate;
  private shots: Shot[] = [];
  private boundChars: BoundCharacter[] = [];
  private events: ScriptEvent[] = [];
  private videoUrls: string[] = [];

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.executor = createExecutionManager();
    this.qualityGate = createQualityGate();
  }

  /**
   * 步骤 1-3：解析 → 绑定 → 分镜（可快速预览）
   */
  async parseAndBuild(params: VideoGenParams): Promise<{
    events: ScriptEvent[];
    boundChars: BoundCharacter[];
    missingChars: string[];
    shots: Shot[];
    success: boolean;
    error?: string;
  }> {
    // 1. 解析剧本
    const parseResult = await parseScript(params.script);
    if (!parseResult.success || parseResult.events.length === 0) {
      return {
        events: [],
        boundChars: [],
        missingChars: [],
        shots: [],
        success: false,
        error: parseResult.error || "剧本解析失败",
      };
    }
    this.events = parseResult.events;

    // 2. 收集所有角色名并绑定
    const charSet = new Set(this.events.flatMap((e) => e.characters));
    const allCharNames = Array.from(charSet);
    const bindResult = await bindCharacters(allCharNames);
    this.boundChars = bindResult.characters;

    // ⚠️ 关键防御：存在绑定错误则中断流程
    // 不允许使用 fallback，一旦角色未匹配就返回错误
    if (bindResult.errors.length > 0) {
      const errorMsg = bindResult.errors.map((e) => e.message).join("；");
      return {
        events: this.events,
        boundChars: [],
        missingChars: bindResult.errors.map((e) => e.name),
        shots: [],
        success: false,
        error: errorMsg,
      };
    }

    const charMap = new Map<string, BoundCharacter>();
    this.boundChars.forEach((c) => charMap.set(c.name, c));

    // 3. 生成分镜
    const sceneResult = generateScenes(
      this.events,
      charMap,
      params.genre || "自动"
    );
    this.shots = sceneResult.shots;

    return {
      events: this.events,
      boundChars: this.boundChars,
      missingChars: [],
      shots: this.shots,
      success: true,
    };
  }

  /**
   * 步骤 4：执行视频生成
   */
  async executeGeneration(
    onProgress?: (state: ExecutionState) => void
  ): Promise<{
    state: ExecutionState;
    commands: string[];
  }> {
    // 初始化执行器
    this.executor.initShots(this.shots);

    // 注册进度回调
    if (onProgress) {
      this.executor.subscribe(onProgress);
    }

    // 生成 CLI 命令（调试/降级用）
    const commands = this.shots.map(
      (shot) =>
        `kling.mjs video --image "${shot.characters[0]?.imageUrl || ""}" --prompt "${shot.imgPrompt}" --duration ${shot.duration}`
    );

    // 执行（当前为模拟）
    const state = await this.executor.executeAll();

    // 收集视频 URL
    this.videoUrls = state.scenes.map((s) => s.videoUrl);

    return { state, commands };
  }

  /**
   * 步骤 5：质量审核
   */
  async checkQuality(): Promise<{
    reports: QualityReport[];
    summary: string;
    passed: boolean;
  } | null> {
    if (this.shots.length === 0 || this.videoUrls.length === 0) return null;

    // 模拟时长（实际应读取视频文件信息）
    const durations = this.shots.map(
      (shot, i) =>
        this.executor.getState().scenes[i]?.duration || shot.duration
    );

    return this.qualityGate.checkAll(
      this.shots,
      this.videoUrls,
      durations
    );
  }

  /**
   * 步骤 6：收集结果
   */
  collectResult(
    qualityResult: {
      reports: QualityReport[];
      summary: string;
      passed: boolean;
    } | null,
    execState: ExecutionState
  ): PipelineResult {
    const failedScenes = execState.scenes.filter(
      (s) => s.status === "failed"
    );
    const successCount = execState.scenes.filter(
      (s) => s.status === "success"
    ).length;

    return {
      parsing: {
        events: this.events,
        success: this.events.length > 0,
      },
      binding: {
        boundChars: this.boundChars,
        missingChars: [],
      },
      scenes: { shots: this.shots },
      execution: {
        state: execState,
        commands: this.shots.map(
          (shot) =>
            `kling.mjs video --image "${shot.characters[0]?.imageUrl || ""}" --prompt "${shot.imgPrompt}"`
        ),
      },
      quality: qualityResult,
      finalVideoUrl: "",
      overallSuccess:
        failedScenes.length === 0 &&
        this.shots.length > 0,
      error:
        failedScenes.length > 0
          ? `${failedScenes.length} 个镜头生成失败`
          : undefined,
    };
  }

  /**
   * 全流水线执行（一键生成）
   */
  async runFullPipeline(
    params: VideoGenParams,
    onProgress?: (step: string, state?: ExecutionState) => void
  ): Promise<PipelineResult> {
    onProgress?.("解析剧本中...");

    // 步骤 1-3
    const buildResult = await this.parseAndBuild(params);
    if (!buildResult.success) {
      return {
        parsing: {
          events: [],
          success: false,
          error: buildResult.error,
        },
        binding: { boundChars: [], missingChars: [] },
        scenes: { shots: [] },
        execution: { state: null, commands: [] },
        quality: null,
        finalVideoUrl: "",
        overallSuccess: false,
        error: buildResult.error,
      };
    }

    onProgress?.("生成视频中...");

    // 步骤 4
    const { state } = await this.executeGeneration((s) =>
      onProgress?.("生成中...", s)
    );

    onProgress?.("审核质量中...");

    // 步骤 5
    const qualityResult = await this.checkQuality();

    onProgress?.("完成");

    // 步骤 6
    const result = this.collectResult(qualityResult, state);

    // 如果质量不达标，标记但不断流
    if (qualityResult && !qualityResult.passed) {
      result.overallSuccess = false;
      result.error = (result.error ? result.error + "；" : "") + "部分视频质量未达标";
    }

    return result;
  }

  /** 重置状态 */
  reset() {
    this.shots = [];
    this.boundChars = [];
    this.events = [];
    this.videoUrls = [];
    this.executor = createExecutionManager();
  }
}

// ========== 工厂函数 ==========

let _orchestrator: VideoOrchestrator | null = null;

export function getOrchestrator(
  config?: Partial<OrchestratorConfig>
): VideoOrchestrator {
  if (!_orchestrator) {
    _orchestrator = new VideoOrchestrator(config);
  }
  return _orchestrator;
}

export function resetOrchestrator() {
  if (_orchestrator) {
    _orchestrator.reset();
    _orchestrator = null;
  }
}
