// ========================================
// 角色注册表 - Character Registry
//
// 功能：
// 1. 定义已知角色的别名映射
// 2. 运行时从 IndexedDB 同步角色数据
// 3. 提供规范化查询接口
//
// 设计原则：
// - 找不到角色 → 抛异常，不 fallback
// - 别名映射在 parser 层提前归一化
// - 所有角色查询经过此注册表
// ========================================

import { getAllCharacters } from "@/lib/db";

export interface RegistryEntry {
  id: string;            // IndexedDB 中的 id
  name: string;          // 标准名（用于显示）
  aliases: string[];     // 别名列表（用户可能输入的任意变体）
  role: string;
  description: string;
  imageUrl: string;
}

// ========== 内置默认别名映射 ==========
// 覆盖常见中/英/拼音变体
// 用户创建角色后自动注册

const BUILTIN_ALIASES: Record<string, string[]> = {
  // 英文/拼音 → 标准中文名
  "meiqiu": ["煤球", "meiqiu", "mq"],
  "catgirl": ["猫仔", "调酒师", "猫娘", "猫女"],
};

// ========== 注册表 ==========

let cachedEntries: RegistryEntry[] | null = null;
let lastSyncTime = 0;
const SYNC_TTL = 30000; // 30 秒缓存

/**
 * 从 IndexedDB 同步角色 + 应用内置别名
 * 构建完整的注册表
 */
export async function syncRegistry(): Promise<RegistryEntry[]> {
  if (cachedEntries && Date.now() - lastSyncTime < SYNC_TTL) {
    return cachedEntries;
  }

  const allChars = await getAllCharacters();
  const entries: RegistryEntry[] = [];

  // 遍历 IndexedDB 中的角色
  for (const char of allChars) {
    // 查找该角色的内置别名
    const knownAliases = BUILTIN_ALIASES[char.id] || [];

    // 收集所有可能的别名
    const aliases: string[] = [char.name, ...knownAliases];

    // 如果 id 和 name 不同，id 本身也是别名
    if (char.id !== char.name && !aliases.includes(char.id)) {
      aliases.push(char.id);
    }

    entries.push({
      id: char.id,
      name: char.name,
      aliases: Array.from(new Set(aliases)), // 去重
      role: char.role,
      description: char.description,
      imageUrl: char.imageUrl,
    });
  }

  cachedEntries = entries;
  lastSyncTime = Date.now();
  return entries;
}

/**
 * 根据角色名（或别名）查找注册表
 *
 * @returns 找到的注册条目
 * @throws Error - 如果角色完全不存在
 */
export async function lookupCharacter(
  name: string
): Promise<RegistryEntry> {
  const entries = await syncRegistry();
  const normalized = name.trim().toLowerCase();

  // 遍历所有注册条目，检查别名是否匹配
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      if (alias.toLowerCase() === normalized) {
        return entry;
      }
    }
  }

  // 最后尝试：字面匹配包含关系（"煤球" → 条目名包含"煤球"）
  for (const entry of entries) {
    if (
      entry.name.includes(name) ||
      name.includes(entry.name)
    ) {
      return entry;
    }
  }

  throw new MissingCharacterError(name);
}

/**
 * 归一化角色名：将别名转成标准名
 *
 * 例：
 * normalizeName("meiqiu") → "煤球"
 * normalizeName("煤球") → "煤球"（不变）
 * normalizeName("不存在的角色") → 抛异常
 */
export async function normalizeName(name: string): Promise<string> {
  const entry = await lookupCharacter(name);
  return entry.name;
}

/**
 * 批量归一化
 */
export async function normalizeNames(names: string[]): Promise<{
  normalized: string[];
  missing: string[];
  error: string | null;
}> {
  const normalized: string[] = [];
  const missing: string[] = [];

  for (const name of names) {
    try {
      const entry = await lookupCharacter(name);
      normalized.push(entry.name);
    } catch {
      missing.push(name);
    }
  }

  const error =
    missing.length > 0
      ? `角色库中找不到以下角色：${missing.join("、")}。请先在「创建角色」中添加。`
      : null;

  return { normalized, missing, error };
}

/**
 * 获取所有已注册的标准角色名
 */
export async function getRegisteredNames(): Promise<string[]> {
  const entries = await syncRegistry();
  return entries.map((e) => e.name);
}

/**
 * 清理注册表缓存（强制下次重新同步）
 */
export function invalidateRegistry() {
  cachedEntries = null;
  lastSyncTime = 0;
}

// ========== 自定义错误 ==========

export class MissingCharacterError extends Error {
  characterName: string;

  constructor(name: string) {
    super(`角色「${name}」未在角色库中找到`);
    this.name = "MissingCharacterError";
    this.characterName = name;
  }
}

export function isMissingCharacterError(e: unknown): e is MissingCharacterError {
  return e instanceof MissingCharacterError;
}

// ========== 验证函数 ==========

/**
 * 验证所有剧本中提到的角色是否都存在
 *
 * @returns 成功 → true，失败 → 抛异常，或返回错误列表
 */
export async function validateCharacters(
  characterNames: string[]
): Promise<{ valid: boolean; missing: string[]; error: string | null }> {
  const { missing, error } = await normalizeNames(characterNames);
  return {
    valid: missing.length === 0,
    missing,
    error,
  };
}
