// ========================================
// 分镜生成器：事件 → 镜头描述
// ========================================

import { ScriptEvent } from "./script-parser";
import { BoundCharacter } from "./character-binder";

export interface Shot {
  index: number;
  scene: string;
  characters: BoundCharacter[];
  action: string;
  duration: number; // 秒（2-4）
  imgPrompt: string; // 发给图生视频的描述
  lockPrompt: string; // 角色一致性的 lock prompt
}

export interface SceneResult {
  shots: Shot[];
}

// 根据类型生成场景氛围描述
function getAtmosphere(genre: string): string {
  const map: Record<string, string> = {
    "古装": "古风色调，暖黄光线，古建筑背景",
    "现代": "现代都市色调，自然光线",
    "仙侠": "仙气缭绕，淡蓝紫色调，云雾背景",
    "都市": "现代都市，冷色调，玻璃幕墙光线",
    "科幻": "赛博朋克色调，霓虹灯光，金属质感",
    "悬疑": "暗调，冷色，阴影氛围",
    "甜宠": "暖色柔和光线，粉白基调",
    "穿越": "时空扭曲光效，蓝紫色过渡",
  };
  return map[genre] || "自然光线，写实风格";
}

export function generateScenes(
  events: ScriptEvent[],
  boundChars: Map<string, BoundCharacter>,
  genre: string
): SceneResult {
  const atmosphere = getAtmosphere(genre);

  // 为每个事件生成 lock prompt
  const shots: Shot[] = events.map((event, i) => {
    // 绑定该镜头的角色
    const shotChars = event.characters
      .map((name) => boundChars.get(name))
      .filter((c): c is BoundCharacter => !!c);

    // 生成 imgPrompt
    const charDesc = shotChars.map((c) => c.name).join("和");
    const imgPrompt = `${charDesc}在${event.scene}场景中，${event.action}。${atmosphere}。`;

    // 角色一致性 lock prompt
    const lockParts = shotChars.map(
      (c) =>
        `${c.name}: ${c.description || "无描述"}，使用角色设定图`
    );
    const lockPrompt =
      lockParts.length > 0
        ? `角色外观必须严格参照参考图：${lockParts.join("；")}。场景为${event.scene}。`
        : `场景为${event.scene}。`;

    return {
      index: i,
      scene: event.scene,
      characters: shotChars,
      action: event.action,
      duration: event.endTime - event.startTime || 3,
      imgPrompt,
      lockPrompt,
    };
  });

  return { shots };
}
