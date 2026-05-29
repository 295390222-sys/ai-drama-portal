// ========================================
// IndexedDB 封装 —— 替代 localStorage 存储剧情和角色
// localStorage 只保留：用户配置、API Key
// ========================================

const DB_NAME = "ai_drama_db";
const DB_VERSION = 1;

interface Character {
  id: string;
  name: string;
  role: string;
  description: string;
  imageUrl: string;
  imageSource: "ai" | "upload";
  createdAt: number;
}

interface Episode {
  episodeNumber: number;
  title: string;
  content: string;
}

interface Story {
  id: string;
  title: string;
  genre: string;
  setting: string;
  outline: string;
  episodes: Episode[];
  characterIds: string[];
  createdAt: number;
}

type StoreName = "characters" | "stories";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("characters")) {
        const store = db.createObjectStore("characters", { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains("stories")) {
        const store = db.createObjectStore("stories", { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  });
}

// ========== Characters ==========

export function getAllCharacters(): Promise<Character[]> {
  return withStore("characters", "readonly", (store) =>
    store.getAll()
  ).catch(() => []);
}

export function getCharacter(id: string): Promise<Character | undefined> {
  return withStore("characters", "readonly", (store) => store.get(id));
}

export function putCharacter(char: Character): Promise<void> {
  return withStore("characters", "readwrite", (store) =>
    store.put(char)
  ) as Promise<any>;
}

export function deleteCharacter(id: string): Promise<void> {
  return withStore("characters", "readwrite", (store) =>
    store.delete(id)
  ) as Promise<any>;
}

// ========== Stories ==========

export function getAllStories(): Promise<Story[]> {
  return withStore("stories", "readonly", (store) =>
    store.getAll()
  ).catch(() => []);
}

export function getStory(id: string): Promise<Story | undefined> {
  return withStore("stories", "readonly", (store) => store.get(id));
}

export function putStory(story: Story): Promise<void> {
  return withStore("stories", "readwrite", (store) =>
    store.put(story)
  ) as Promise<any>;
}

export function deleteStory(id: string): Promise<void> {
  return withStore("stories", "readwrite", (store) =>
    store.delete(id)
  ) as Promise<any>;
}

// ========== 迁移工具：从 localStorage 导入 ==========
export function migrateFromLocalStorage(): Promise<{
  characters: number;
  stories: number;
}> {
  return openDB().then((db) => {
    let charCount = 0;
    let storyCount = 0;

    return new Promise<{ characters: number; stories: number }>(
      (resolve, reject) => {
        // 迁移角色
        try {
          const rawChars = localStorage.getItem("ai_drama_characters");
          if (rawChars) {
            const chars: Character[] = JSON.parse(rawChars);
            if (Array.isArray(chars) && chars.length > 0) {
              const tx1 = db.transaction("characters", "readwrite");
              chars.forEach((c) => tx1.objectStore("characters").put(c));
              tx1.oncomplete = () => {
                charCount = chars.length;
                // 迁移剧情
                const rawStories = localStorage.getItem("ai_drama_stories");
                if (rawStories) {
                  const stories: Story[] = JSON.parse(rawStories);
                  if (Array.isArray(stories) && stories.length > 0) {
                    const tx2 = db.transaction(
                      "stories",
                      "readwrite"
                    );
                    stories.forEach((s) =>
                      tx2.objectStore("stories").put(s)
                    );
                    tx2.oncomplete = () => {
                      storyCount = stories.length;
                      db.close();
                      resolve({ characters: charCount, stories: storyCount });
                    };
                    tx2.onerror = () => {
                      db.close();
                      reject(tx2.error);
                    };
                  } else {
                    db.close();
                    resolve({ characters: charCount, stories: storyCount });
                  }
                } else {
                  db.close();
                  resolve({ characters: charCount, stories: storyCount });
                }
              };
              tx1.onerror = () => {
                db.close();
                reject(tx1.error);
              };
            } else {
              db.close();
              resolve({ characters: 0, stories: 0 });
            }
          } else {
            db.close();
            resolve({ characters: 0, stories: 0 });
          }
        } catch (e) {
          db.close();
          reject(e);
        }
      }
    );
  });
}

// ========== 清理过旧故事（30天前的自动清理） ==========
export async function cleanOldStories(maxAgeDays = 30): Promise<number> {
  const stories = await getAllStories();
  const cutoff = Date.now() - maxAgeDays * 86400000;
  const old = stories.filter((s) => s.createdAt < cutoff);
  for (const s of old) {
    await deleteStory(s.id);
  }
  return old.length;
}
