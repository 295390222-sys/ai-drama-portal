// ========================================
// 角色绑定器：角色名 → 角色图片
//
// 核心改动：
// - 使用角色注册表（character-registry）查找
// - 找不到角色 → 抛出错误，不生成 fallback SVG
// - 绑定成功后保证 imageUrl 存在
// ========================================

import { lookupCharacter, MissingCharacterError } from "./character-registry";

export interface BoundCharacter {
  id: string;
  name: string;
  imageUrl: string;
  description: string;
  role: string;
  matched: true; // 现在只有 matched: true 的情况
}

export interface BindResult {
  characters: BoundCharacter[];
  errors: BindError[];
}

export interface BindError {
  name: string;        // 输入的原始名字
  message: string;     // 错误描述
}

/**
 * 批量绑定角色
 *
 * @param characterNames - 需要绑定的角色名列表
 * @returns BindeResult - 包含成功绑定的角色 + 绑定失败的错误列表
 */
export async function bindCharacters(
  characterNames: string[]
): Promise<BindResult> {
  const characters: BoundCharacter[] = [];
  const errors: BindError[] = [];

  for (const rawName of characterNames) {
    try {
      const entry = await lookupCharacter(rawName);

      if (!entry.imageUrl) {
        errors.push({
          name: rawName,
          message: `角色「${entry.name}」存在但缺少形象图片，请在角色编辑中上传或生成图片`,
        });
        continue;
      }

      characters.push({
        id: entry.id,
        name: entry.name,
        imageUrl: entry.imageUrl,
        description: entry.description,
        role: entry.role,
        matched: true,
      });
    } catch (e) {
      if (e instanceof MissingCharacterError) {
        errors.push({
          name: rawName,
          message: `角色「${rawName}」未在角色库中找到。请确认已在「创建角色」中添加该角色`,
        });
      } else {
        errors.push({
          name: rawName,
          message: `绑定角色「${rawName}」时发生错误：${e instanceof Error ? e.message : "未知错误"}`,
        });
      }
    }
  }

  return { characters, errors };
}
