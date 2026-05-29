// ========================================
// 可灵视频生成辅助
// 生成可执行 CLI 命令 或 调用 API
// ========================================

import { Shot } from "./scene-builder";

/** 为单个镜头生成可灵 CLI 命令 */
export function buildKlingCommand(
  shot: Shot,
  outputDir: string
): string {
  // 角色图路径（从绑定的角色信息取）
  const charImages = shot.characters
    .filter((c) => c.imageUrl && c.matched)
    .map((c) => c.imageUrl)
    .slice(0, 1); // 最多一张图（可灵单图 i2v）

  const prompt =
    `${shot.scene}，${shot.action}。` +
    `角色外观严格遵循参考图，不要改变角色穿着和面容。` +
    shot.lockPrompt;

  const cmdParts = [
    `node`,
    `~/.openclaw/workspace/skills/klingai/scripts/kling.mjs`,
    `video`,
    `--prompt "${prompt}"`,
    `--duration ${shot.duration}`,
    `--mode std`,
    `--aspect_ratio 9:16`,
    `--output_dir "${outputDir}/shot_${shot.index}"`,
  ];

  if (charImages.length > 0) {
    cmdParts.push(`--image "${charImages[0]}"`);
  }

  return cmdParts.join(" \\\n  ");
}

/** 为全部分镜生成批量执行的 Shell 脚本 */
export function buildKlingBatchScript(
  shots: Shot[],
  outputDir: string
): string {
  const lines = [
    "#!/bin/bash",
    `# 批量生成视频分镜`,
    `# 输出目录: ${outputDir}`,
    "",
  ];

  shots.forEach((shot, i) => {
    lines.push(`# ===== 镜头 ${i + 1}: ${shot.scene} =====`);
    lines.push(buildKlingCommand(shot, `${outputDir}/shot_${shot.index}`));
    lines.push(`sleep 5  # 等待上一任务提交`);
    lines.push("");
  });

  return lines.join("\n");
}

/** 生成分镜的 img2img 提示词列表（人工使用可灵 UI 时参考） */
export function buildShotPrompts(shots: Shot[]): string[] {
  return shots.map((shot) => {
    const chars = shot.characters.map((c) => c.name).join("、");
    return `[镜头${shot.index + 1}] ${shot.scene}
角色：${chars || "无"}
动作：${shot.action}
时长：${shot.duration}秒
提示词：${shot.imgPrompt}
Lock：${shot.lockPrompt}`;
  });
}
