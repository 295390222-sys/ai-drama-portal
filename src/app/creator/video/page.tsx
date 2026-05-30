"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAllCharacters } from "@/lib/db";
import { ErrorBoundary } from "./error-boundary";
import {
  VideoOrchestrator,
  PipelineResult,
} from "@/lib/video-pipeline/video-orchestrator";
import { ScriptEvent } from "@/lib/video-pipeline/script-parser";
import { BoundCharacter } from "@/lib/video-pipeline/character-binder";
import { Shot } from "@/lib/video-pipeline/scene-builder";
import { ExecutionState } from "@/lib/video-pipeline/executor";
import { QualityReport } from "@/lib/video-pipeline/quality-gate";

const GENRE_OPTIONS = [
  { value: "自动", label: "🎯 自动识别" },
  { value: "古装", label: "🏯 古装" },
  { value: "现代", label: "🏙️ 现代" },
  { value: "仙侠", label: "🗡️ 仙侠" },
  { value: "科幻", label: "🚀 科幻" },
  { value: "悬疑", label: "🔍 悬疑" },
  { value: "甜宠", label: "💕 甜宠" },
  { value: "穿越", label: "⏳ 穿越" },
];

type PipelineStep =
  | "idle"
  | "parsing"
  | "building"
  | "generating"
  | "checking"
  | "done"
  | "error";

export default function VideoPageWrapper() {
  return (
    <ErrorBoundary>
      <VideoPageContent />
    </ErrorBoundary>
  );
}

function VideoPageContent() {
  const router = useRouter();
  const [script, setScript] = useState("");
  const [genre, setGenre] = useState("自动");
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<PipelineStep>("idle");
  const [stepMessage, setStepMessage] = useState("");
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [showInput, setShowInput] = useState(true);
  const [copied, setCopied] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [orchestrator] = useState(() => new VideoOrchestrator());
  const [execState, setExecState] = useState<ExecutionState | null>(null);

  useEffect(() => {
    getAllCharacters().then((chars) => setCharCount(chars.length));
    
    // 自动配置通义万相 API Key（如果 localStorage 中没有）
    try {
      const existing = localStorage.getItem("wanxiang_api_config");
      if (!existing) {
        // 检查旧的 ai_drama_api_config 是否有 Wanxiang Key
        const oldRaw = localStorage.getItem("ai_drama_api_config");
        if (oldRaw) {
          const old = JSON.parse(oldRaw);
          if (old.key && old.provider === "wanxiang") {
            localStorage.setItem(
              "wanxiang_api_config",
              JSON.stringify({ apiKey: old.key })
            );
          }
        }
        // 检查 URL 参数 ?key=xxx
        const params = new URLSearchParams(window.location.search);
        const keyFromUrl = params.get("key");
        if (keyFromUrl && keyFromUrl.startsWith("sk-")) {
          localStorage.setItem(
            "wanxiang_api_config",
            JSON.stringify({ apiKey: keyFromUrl })
          );
        }
      }
    } catch {}
  }, []);

  // ========== 主流程 ==========

  const handleGenerate = useCallback(async () => {
    if (!script.trim()) {
      setProcessing(false);
      return;
    }

    setProcessing(true);
    setResult(null);
    setExecState(null);
    setCurrentStep("idle");
    setStepMessage("");

    try {
      setCurrentStep("parsing");
      setStepMessage("🎯 解析剧本...");

      // 步骤 1-3：解析 + 绑定 + 分镜
      const buildResult = await orchestrator.parseAndBuild({
        script: script.trim(),
        genre: genre === "自动" ? "现代" : genre,
      });

      if (!buildResult.success) {
        throw new Error(buildResult.error || "解析失败");
      }

      setCurrentStep("generating");
      setStepMessage("🎬 正在生成视频...");

      // 步骤 4：执行
      const { state } = await orchestrator.executeGeneration((s) => {
        setExecState(s);
      });
      setExecState(state);

      setCurrentStep("checking");
      setStepMessage("🔍 审核视频质量...");

      // 步骤 5：质量审核
      const quality = await orchestrator.checkQuality();

      setCurrentStep("done");
      setStepMessage("");

      // 步骤 6：收集结果
      const finalResult = orchestrator.collectResult(quality, state);
      setResult(finalResult);
    } catch (e: any) {
      setCurrentStep("error");
      setStepMessage(e?.message || "处理失败");
    }

    setProcessing(false);
  }, [script, genre, orchestrator]);

  // ========== 重试 ==========

  const handleRetry = useCallback(() => {
    orchestrator.reset();
    setResult(null);
    setExecState(null);
    setCurrentStep("idle");
  }, [orchestrator]);

  // ========== 示例剧本 ==========

  const exampleScripts = [
    "煤球在酒吧喝咖啡突然遇到爆炸，被一道蓝光卷入时空裂缝，醒来发现被古代士兵包围",
    "小美第一天到新公司上班，发现自己工位旁边的同事是高中暗恋的学长，两人尴尬相认",
    "老张在深山里发现一座废弃的道观，推门进去后看到一个白衣女子在练剑",
  ];

  // ========== 渲染 ==========

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
        >
          ← 返回
        </button>
        <h1 className="text-sm font-semibold">🎬 视频生成</h1>
        <div className="w-12" />
      </header>

      {/* ====== 输入区 ====== */}
      {showInput && (
        <div className="space-y-4 px-4 py-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs leading-relaxed text-zinc-400">
            <p className="mb-1 font-medium text-zinc-300">🎬 创作流程</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>输入剧本 → AI 解析剧情结构</li>
              <li>自动绑定角色库图片</li>
              <li>生成分镜 + lock prompt</li>
              <li>逐段生成视频片段</li>
              <li>审核质量 → 输出成片</li>
            </ol>
            {charCount === 0 && (
              <p className="mt-2 text-yellow-400">
                💡 建议先创建角色，视频会自动匹配角色图
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              输入剧本 <span className="text-zinc-600">（自然语言）</span>
            </label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder={`例如：${exampleScripts[0]}`}
              rows={4}
              className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-blue-500"
            />
          </div>

          <div>
            <p className="mb-1.5 text-[10px] text-zinc-600">试试示例：</p>
            <div className="flex flex-wrap gap-2">
              {exampleScripts.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setScript(ex)}
                  className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[10px] text-zinc-400 transition hover:border-zinc-500"
                >
                  示例 {i + 1}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              视频风格
            </label>
            <div className="flex flex-wrap gap-2">
              {GENRE_OPTIONS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGenre(g.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                    genre === g.value
                      ? "border-blue-500 bg-blue-500/20 text-blue-400"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!script.trim() || processing}
            className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 py-3 text-sm font-semibold text-white transition hover:from-blue-400 hover:to-purple-500 disabled:opacity-50"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {stepMessage || "处理中..."}
              </span>
            ) : (
              "🎬 生成视频"
            )}
          </button>
        </div>
      )}

      {/* ====== 处理进度 ====== */}
      {processing && (
        <div className="px-4 py-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
              <span className="text-sm text-zinc-300">{stepMessage}</span>
            </div>

            {/* 流水线步骤 */}
            <div className="space-y-2">
              {[
                { key: "parsing", label: "🎯 解析剧本", done: currentStep !== "idle" && currentStep !== "parsing" },
                { key: "generating", label: "🎬 生成视频片段", done: currentStep === "checking" || currentStep === "done" },
                { key: "checking", label: "🔍 审核质量", done: currentStep === "done" },
              ].map((step) => (
                <div key={step.key} className="flex items-center gap-2 text-xs">
                  {step.done ? (
                    <span className="text-green-400">✅</span>
                  ) : (
                    <span className="h-4 w-4 rounded-full border border-zinc-600" />
                  )}
                  <span className={step.done ? "text-zinc-400" : "text-zinc-600"}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {/* 执行进度 */}
            {execState && execState.scenes.length > 0 && (
              <div className="mt-3 border-t border-zinc-800 pt-3">
                <p className="mb-2 text-[10px] text-zinc-500">
                  生成进度：{execState.progress.completed}/{execState.progress.total}
                </p>
                <div className="flex gap-1">
                  {execState.scenes.map((scene) => {
                    const colorMap: Record<string, string> = {
                      success: "bg-green-500",
                      failed: "bg-red-500",
                      running: "bg-blue-500 animate-pulse",
                      pending: "bg-zinc-700",
                      skipped: "bg-zinc-500",
                    };
                    return (
                      <div
                        key={scene.sceneId}
                        className={`h-2 flex-1 rounded-full ${
                          colorMap[scene.status] || "bg-zinc-700"
                        }`}
                        title={`镜头 ${scene.sceneId + 1}: ${scene.status}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====== 结果展示 ====== */}
      {result && (
        <div className="space-y-5 px-4 py-4">
          {/* 编辑入口 */}
          <button
            onClick={handleRetry}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← 重新输入
          </button>

          {/* 错误提示 */}
          {result.error && (
            <div className="rounded-lg border border-red-800/50 bg-red-950/20 p-3 text-xs text-red-400">
              ❌ {result.error}
            </div>
          )}

          {/* 解析结果 */}
          {result.parsing.events.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold text-zinc-500">
                📑 解析结果
              </h2>
              <div className="space-y-2">
                {result.parsing.events.map((event, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-600/20 text-[10px] text-blue-400">
                        {i + 1}
                      </span>
                      <span className="text-xs font-medium text-white">
                        {event.scene}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-zinc-500">角色：</span>
                      {event.characters.map((char, j) => (
                        <span
                          key={j}
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            result.binding.boundChars.find(
                              (c) => c.name === char
                            )?.matched
                              ? "bg-green-900/30 text-green-400"
                              : "bg-amber-900/30 text-amber-400"
                          }`}
                        >
                          {char}
                          {result.binding.boundChars.find(
                            (c) => c.name === char
                          )?.matched
                            ? " ✅"
                            : " ❓"}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 未匹配角色 */}
          {result.binding.missingChars.length > 0 && (
            <div className="rounded-lg border border-yellow-800/50 bg-yellow-950/20 p-3 text-xs text-yellow-400">
              ⚠️ 以下角色未在库中找到: {result.binding.missingChars.join("、")}。
              建议先去创建角色。
            </div>
          )}

          {/* 分镜列表 */}
          {result.scenes.shots.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold text-zinc-500">
                🎥 分镜列表
              </h2>
              <div className="space-y-3">
                {result.scenes.shots.map((shot, i) => (
                  <ShotCard
                    key={i}
                    shot={shot}
                    index={i}
                    execState={result.execution.state}
                    qualityReport={result.quality?.reports[i]}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 质量报告 */}
          {result.quality && (
            <section>
              <h2 className="mb-2 text-xs font-semibold text-zinc-500">
                ⭐ 质量报告
              </h2>
              <div
                className={`rounded-lg border p-3 text-xs ${
                  result.quality.passed
                    ? "border-green-800/50 bg-green-950/20 text-green-400"
                    : "border-yellow-800/50 bg-yellow-950/20 text-yellow-400"
                }`}
              >
                <p className="font-medium mb-1">
                  {result.quality.passed ? "✅ 全部通过" : "⚠️ 部分未达标"}
                </p>
                <p className="text-zinc-400">{result.quality.summary}</p>
              </div>
            </section>
          )}

          {/* 生成命令 */}
          {result.execution.commands.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold text-zinc-500">
                ⚡ 生成命令
              </h2>
              <div className="space-y-2">
                {result.execution.commands.map((cmd, i) => (
                  <button
                    key={i}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(cmd);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      } catch {}
                    }}
                    className="w-full rounded-lg border border-zinc-700 px-3 py-2 text-left text-[10px] text-zinc-400 transition hover:border-zinc-500"
                  >
                    <span className="font-medium text-zinc-300">
                      镜头 {i + 1}
                    </span>
                    <code className="ml-2 block mt-1 font-mono text-[10px] text-zinc-500 truncate">
                      {cmd}
                    </code>
                  </button>
                ))}
                <p className="text-[10px] text-zinc-600">
                  {copied ? "✅ 已复制" : "💡 点击命令复制，在终端运行生成视频"}
                </p>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ========== 分镜卡片 ==========

function ShotCard({
  shot,
  index,
  execState,
  qualityReport,
}: {
  shot: Shot;
  index: number;
  execState: ExecutionState | null;
  qualityReport?: QualityReport;
}) {
  const sceneExec = execState?.scenes.find((s) => s.sceneId === shot.index);
  const status = sceneExec?.status || "pending";

  const statusColor: Record<string, string> = {
    success: "border-green-700/50",
    failed: "border-red-700/50",
    running: "border-blue-700/50",
    pending: "border-zinc-800",
    skipped: "border-zinc-600/50",
  };

  return (
    <div
      className={`rounded-xl border bg-zinc-900/50 p-3 ${
        statusColor[status] || "border-zinc-800"
      }`}
    >
      {/* 头部 */}
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded text-[10px] ${
            status === "success"
              ? "bg-green-600/20 text-green-400"
              : status === "failed"
                ? "bg-red-600/20 text-red-400"
                : status === "running"
                  ? "bg-blue-600/20 text-blue-400"
                  : "bg-zinc-700 text-zinc-500"
          }`}
        >
          {status === "success" ? "✓" : status === "failed" ? "✗" : index + 1}
        </span>
        <span className="text-xs font-medium text-white truncate flex-1">
          {shot.scene}
        </span>
        <span className="text-[10px] text-zinc-600">{shot.duration}秒</span>
        {status === "running" && (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
        )}
      </div>

      {/* 角色 */}
      <div className="mb-2 flex gap-2">
        {shot.characters.map((char, j) => (
          <div
            key={j}
            className="flex items-center gap-1.5 rounded-full bg-zinc-800 px-2 py-1"
          >
            <div className="h-6 w-6 overflow-hidden rounded-full bg-zinc-700">
              {char.matched ? (
                <img
                  src={char.imageUrl}
                  alt={char.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      `data:image/svg+xml,${encodeURIComponent(
                        `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#555" rx="24"/><text x="24" y="30" font-size="20" fill="#999" text-anchor="middle">${char.name.charAt(0)}</text></svg>`
                      )}`;
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-zinc-700 text-[10px] text-zinc-500">
                  ?
                </div>
              )}
            </div>
            <span className="text-[10px] text-zinc-400">{char.name}</span>
          </div>
        ))}
      </div>

      {/* 质量报告 */}
      {qualityReport && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[10px] text-zinc-600 hover:text-zinc-400">
            ⭐ 质量审核：{qualityReport.passed ? "通过" : "未达标"}（
            {qualityReport.score}分）
          </summary>
          <div className="mt-1.5 space-y-1 rounded-lg bg-zinc-900 p-2">
            {Object.entries(qualityReport.checks).map(([key, check]) => (
              <div key={key} className="flex items-center gap-2 text-[10px]">
                <span>{check.passed ? "✅" : "❌"}</span>
                <span className="text-zinc-500 min-w-[60px]">
                  {checkLabel(key)}
                </span>
                <span className="text-zinc-600 text-[9px]">
                  {check.score}分
                </span>
                <span className="text-zinc-500 text-[9px] truncate">
                  {typeof check.detail === "string" ? check.detail.slice(0, 30) + (check.detail.length > 30 ? "..." : "") : ""}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Prompt */}
      <details className="mt-1">
        <summary className="cursor-pointer text-[10px] text-zinc-600 hover:text-zinc-400">
          📝 生成参数
        </summary>
        <div className="mt-1.5 space-y-1 rounded-lg bg-zinc-900 p-2">
          <p className="text-[10px] text-zinc-400">{shot.imgPrompt}</p>
          <p className="text-[10px] text-zinc-500">{shot.lockPrompt}</p>
        </div>
      </details>
    </div>
  );
}

function checkLabel(key: string): string {
  const labelMap: Record<string, string> = {
    faceConsistency: "人脸",
    characterMatch: "角色",
    motionValid: "动作",
    durationValid: "时长",
  };
  return labelMap[key] || key;
}
