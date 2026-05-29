// ========================================
// Video Quality Gate - 视频质量审核
// 检查：人脸一致性、角色匹配、动作有效性
// ========================================

import { BoundCharacter } from "./character-binder";
import { Shot } from "./scene-builder";

// ========== 质量检查结果 ==========

export interface QualityReport {
  shotIndex: number;
  scene: string;
  passed: boolean;
  checks: {
    faceConsistency: CheckResult;
    characterMatch: CheckResult;
    motionValid: CheckResult;
    durationValid: CheckResult;
  };
  score: number; // 0-100
  issues: string[];
}

interface CheckResult {
  passed: boolean;
  score: number; // 0-100
  detail: string;
}

// ========== 审核器 ==========

export class VideoQualityGate {
  /**
   * 审核单个视频片段
   *
   * @param shot - 分镜描述（含参考角色图）
   * @param videoUrl - 生成的视频地址
   * @param actualDuration - 实际视频时长（秒）
   */
  async checkShot(
    shot: Shot,
    videoUrl: string,
    actualDuration: number
  ): Promise<QualityReport> {
    const issues: string[] = [];
    const checks = {
      faceConsistency: await checkFaceConsistency(shot, videoUrl),
      characterMatch: await checkCharacterMatch(shot, videoUrl),
      motionValid: await checkMotionValid(videoUrl),
      durationValid: checkDuration(shot.duration, actualDuration),
    };

    // 收集问题
    if (!checks.faceConsistency.passed)
      issues.push(`人脸一致性：${checks.faceConsistency.detail}`);
    if (!checks.characterMatch.passed)
      issues.push(`角色匹配：${checks.characterMatch.detail}`);
    if (!checks.motionValid.passed)
      issues.push(`动作有效：${checks.motionValid.detail}`);
    if (!checks.durationValid.passed)
      issues.push(`时长：${checks.durationValid.detail}`);

    // 综合评分
    const weights = {
      faceConsistency: 0.35,
      characterMatch: 0.30,
      motionValid: 0.20,
      durationValid: 0.15,
    };
    const score = Math.round(
      Object.entries(checks).reduce(
        (sum, [key, check]) =>
          sum + check.score * (weights as any)[key],
        0
      )
    );

    return {
      shotIndex: shot.index,
      scene: shot.scene,
      passed: score >= 60, // 60 分以上通过
      checks,
      score,
      issues,
    };
  }

  /**
   * 批量审核全部镜头
   */
  async checkAll(
    shots: Shot[],
    videoUrls: string[],
    durations: number[]
  ): Promise<{
    reports: QualityReport[];
    passed: boolean;
    summary: string;
  }> {
    if (shots.length !== videoUrls.length) {
      throw new Error("镜头数和视频数不匹配");
    }

    const reports = await Promise.all(
      shots.map((shot, i) =>
        this.checkShot(shot, videoUrls[i] || "", durations[i] || 0)
      )
    );

    const passed = reports.filter((r) => r.passed).length;
    const failedCount = reports.length - passed;
    const avgScore = Math.round(
      reports.reduce((s, r) => s + r.score, 0) / reports.length
    );

    let summary = "";
    if (failedCount === 0) {
      summary = `✅ 全部通过（平均分 ${avgScore}）`;
    } else if (failedCount <= reports.length / 2) {
      summary = `⚠️ ${passed}/${reports.length} 通过（平均分 ${avgScore}），${failedCount} 个镜头需要重审`;
    } else {
      summary = `❌ 仅 ${passed}/${reports.length} 通过（平均分 ${avgScore}），建议重生成失败镜头`;
    }

    return {
      reports,
      passed: failedCount === 0,
      summary,
    };
  }
}

// ========== 单项检查实现 ==========

/**
 * 人脸一致性检查
 *
 * 原理：
 * - 将角色参考图和视频首帧做哈希比较
 * - 如果颜色分布差异过大，说明人物可能变了
 *
 * 目前是简化版本：
 * - 检查视频 URL 是否有效
 * - 检查角色是否绑定了参考图
 * - 完整的人脸比对需要集成 face-api.js / OpenCV
 */
async function checkFaceConsistency(
  shot: Shot,
  videoUrl: string
): Promise<CheckResult> {
  // 如果没有角色绑定，算 N/A
  if (shot.characters.length === 0) {
    return { passed: true, score: 100, detail: "无角色，跳过检查" };
  }

  // 检查角色是否有参考图
  const allMatched = shot.characters.every((c) => c.matched && c.imageUrl);
  if (!allMatched) {
    return {
      passed: false,
      score: 30,
      detail: "部分角色缺少参考图，无法验证一致性",
    };
  }

  // 检查视频 URL
  if (!videoUrl) {
    return { passed: false, score: 0, detail: "视频未生成，无法检查" };
  }

  // 简化：假设通过（实际应提取视频首帧 vs 参考图做哈希/人脸比对）
  // TODO: 集成 face-api.js 进行人脸检测和相似度计算
  return {
    passed: true,
    score: 80,
    detail: "角色参考图已绑定，视频文件存在（需完整人脸比对）",
  };
}

/**
 * 角色匹配检查
 *
 * 原理：
 * - 验证生成的视频中出现了预期的角色数量
 * - 通过 prompt 中的角色名匹配
 */
async function checkCharacterMatch(
  shot: Shot,
  videoUrl: string
): Promise<CheckResult> {
  if (!videoUrl) {
    return { passed: false, score: 0, detail: "视频未生成" };
  }

  const charNames = shot.characters.map((c) => c.name).join("、");
  return {
    passed: true,
    score: 85,
    detail: `预期角色：${charNames || "无"}（需AI视觉验证）`,
  };
}

/**
 * 动作有效性检查
 *
 * 原理：
 * - 验证视频是否真的有动态内容（非静态图）
 * - 检查动作描述是否和生成内容匹配
 *
 * 简化版：检查视频文件是否存在
 */
async function checkMotionValid(videoUrl: string): Promise<CheckResult> {
  if (!videoUrl) {
    return { passed: false, score: 0, detail: "视频未生成" };
  }

  // 检查 URL 是否为有效视频链接
  const isUrl = videoUrl.startsWith("http") || videoUrl.startsWith("file://");
  if (!isUrl) {
    return { passed: false, score: 10, detail: "视频路径无效" };
  }

  // TODO: 提取视频帧序列，检查帧间差异来验证动态
  return {
    passed: true,
    score: 75,
    detail: "视频文件路径有效（需帧序列检查）",
  };
}

/**
 * 时长检查
 *
 * 验证实际时长是否接近预期
 */
function checkDuration(
  expected: number,
  actual: number
): CheckResult {
  if (actual <= 0) {
    return { passed: false, score: 0, detail: `时长为 0，视频可能未生成` };
  }

  const ratio = actual / expected;
  if (ratio < 0.5) {
    return {
      passed: false,
      score: 20,
      detail: `实际 ${actual.toFixed(1)} 秒，预期 ${expected} 秒（仅 ${Math.round(ratio * 100)}%）`,
    };
  }
  if (ratio < 0.8) {
    return {
      passed: true,
      score: 60,
      detail: `实际 ${actual.toFixed(1)} 秒，预期 ${expected} 秒（${Math.round(ratio * 100)}%）`,
    };
  }

  return {
    passed: true,
    score: 90,
    detail: `实际 ${actual.toFixed(1)} 秒，预期 ${expected} 秒`,
  };
}

// ========== 工厂函数 ==========

export function createQualityGate(): VideoQualityGate {
  return new VideoQualityGate();
}
