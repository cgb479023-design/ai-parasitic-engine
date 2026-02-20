/**
 * 统一存储抽象层
 * 解决 localStorage 和 chrome.storage.local 之间的不一致问题
 * 提供统一的 API 用于跨会话持久化
 */

// Chrome storage types
interface ChromeStorageLocal {
  get(keys: string | string[] | null, callback?: (result: Record<string, any>) => void): void;
  set(items: Record<string, any>, callback?: () => void): void;
  remove(keys: string | string[], callback?: () => void): void;
}

declare const chrome: {
  runtime?: {
    lastError: Error | null;
  };
  storage?: {
    local: ChromeStorageLocal;
  };
};

export interface StorageData<T = any> {
  id: string;
  data: T;
  timestamp: number;
  version?: number;
  checksum?: string;
}

/**
 * 计算简单校验和（用于数据完整性验证）
 */
function calculateChecksum(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * 统一存储服务
 * 优先使用 chrome.storage.local（扩展环境）
 * 降级到 localStorage（Web环境）
 */
export class UnifiedStorage {
  private useChromeStorage: boolean;

  constructor() {
    this.useChromeStorage = typeof chrome !== 'undefined' &&
                           typeof chrome.storage !== 'undefined' &&
                           typeof chrome.storage.local !== 'undefined';
  }

  /**
   * 获取视频数据（统一接口）
   * 优先从 chrome.storage.local 读取，失败则从 localStorage 读取
   */
  async getVideoData(itemId: string): Promise<StorageData<any> | null> {
    const key = `videoData_${itemId}`;

    if (this.useChromeStorage) {
      try {
        const result = await this.chromeGet<StorageData<any>>(key);
        if (result) {
          console.log(`[UnifiedStorage] Found video data in chrome.storage.local: ${key}`);
          return result;
        }
      } catch (e) {
        console.warn(`[UnifiedStorage] Failed to read from chrome.storage.local: ${key}`, e);
      }
    }

    // 降级到 localStorage
    try {
      const localData = localStorage.getItem(key);
      if (localData) {
        const parsed = JSON.parse(localData) as StorageData;
        console.log(`[UnifiedStorage] Found video data in localStorage: ${key}`);
        return parsed;
      }
    } catch (e) {
      console.error(`[UnifiedStorage] Failed to parse localStorage data: ${key}`, e);
    }

    return null;
  }

  /**
   * 保存视频数据（统一接口）
   * 同时存储到 localStorage 和 chrome.storage.local（如果可用）
   */
  async setVideoData(itemId: string, data: any): Promise<void> {
    const key = `videoData_${itemId}`;
    const storageData: StorageData = {
      id: itemId,
      data,
      timestamp: Date.now(),
      version: 1,
      checksum: calculateChecksum(data),
    };

    // 存储到 localStorage
    try {
      localStorage.setItem(key, JSON.stringify(storageData));
    } catch (e) {
      console.error(`[UnifiedStorage] Failed to save to localStorage: ${key}`, e);
      throw new Error('Storage quota exceeded. Please clear some data.');
    }

    // 存储到 chrome.storage.local（如果可用）
    if (this.useChromeStorage) {
      try {
        await this.chromeSet(key, storageData);
      } catch (e) {
        console.warn(`[UnifiedStorage] Failed to save to chrome.storage.local: ${key}`, e);
        // 不抛出错误，localStorage 已保存成功
      }
    }

    console.log(`[UnifiedStorage] Saved video data: ${key}`);
  }

  /**
   * 获取 YPP 计划（从 localStorage）
   */
  getYppPlan(): any | null {
    try {
      const data = localStorage.getItem('yppPlan');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('[UnifiedStorage] Failed to parse YPP plan', e);
      return null;
    }
  }

  /**
   * 保存 YPP 计划（到 localStorage）
   */
  setYppPlan(plan: any): void {
    try {
      localStorage.setItem('yppPlan', JSON.stringify(plan));
    } catch (e) {
      console.error('[UnifiedStorage] Failed to save YPP plan', e);
      throw new Error('Storage quota exceeded.');
    }
  }

  /**
   * 获取通用数据项（从 localStorage）
   */
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error(`[UnifiedStorage] Failed to get item: ${key}`, e);
      return null;
    }
  }

  /**
   * 保存通用数据项（到 localStorage）
   */
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error(`[UnifiedStorage] Failed to set item: ${key}`, e);
      throw new Error('Storage quota exceeded.');
    }
  }

  /**
   * 删除数据项（同时从 localStorage 和 chrome.storage.local 删除）
   */
  async removeItem(key: string): Promise<void> {
    // 从 localStorage 删除
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[UnifiedStorage] Failed to remove from localStorage: ${key}`, e);
    }

    // 从 chrome.storage.local 删除（如果可用）
    if (this.useChromeStorage) {
      try {
        await this.chromeRemove(key);
      } catch (e) {
        console.warn(`[UnifiedStorage] Failed to remove from chrome.storage.local: ${key}`, e);
      }
    }
  }

  /**
   * 清空所有存储（谨慎使用）
   */
  async clear(): Promise<void> {
    // 清空 localStorage（只清除应用相关的键）
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('videoData_') ||
                   key.startsWith('state_') ||
                   key.startsWith('gemini_') ||
                   key === 'yppPlan')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // 清空 chrome.storage.local（如果可用）
    if (this.useChromeStorage) {
      try {
        const data = await this.chromeGetAll();
        const chromeKeysToRemove = Object.keys(data).filter(key =>
          key.startsWith('videoData_') ||
          key.startsWith('gemini_') ||
          key.startsWith('pending_')
        );
        await this.chromeRemoveMultiple(chromeKeysToRemove);
      } catch (e) {
        console.warn('[UnifiedStorage] Failed to clear chrome.storage.local', e);
      }
    }

    console.log('[UnifiedStorage] Cleared all app data');
  }

  /**
   * 检查存储配额使用情况
   */
  async getStorageUsage(): Promise<{ used: number; percent: number; total: number }> {
    const total = 5 * 1024 * 1024; // 5MB (typical localStorage limit)

    let used = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          used += key.length + value.length;
        }
      }
    }

    const percent = (used / total) * 100;

    return { used, percent, total };
  }

  // --- Chrome Storage Helper Methods ---

  private chromeGet<T>(key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([key], (result: Record<string, any>) => {
        if (chrome.runtime?.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[key] || null);
        }
      });
    });
  }

  private chromeSet<T>(key: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime?.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  private chromeRemove(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(key, () => {
        if (chrome.runtime?.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  private chromeGetAll(): Promise<Record<string, any>> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(null, (result: Record<string, any>) => {
        if (chrome.runtime?.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result || {});
        }
      });
    });
  }

  private chromeRemoveMultiple(keys: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime?.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
}

// 导出单例实例
export const unifiedStorage = new UnifiedStorage();

// 导出便捷函数
export const getVideoData = (itemId: string) => unifiedStorage.getVideoData(itemId);
export const setVideoData = (itemId: string, data: any) => unifiedStorage.setVideoData(itemId, data);
export const getYppPlan = () => unifiedStorage.getYppPlan();
export const setYppPlan = (plan: any) => unifiedStorage.setYppPlan(plan);
export const getItem = (key: string) => unifiedStorage.getItem(key);
export const setItem = (key: string, value: string) => unifiedStorage.setItem(key, value);
export const removeItem = (key: string) => unifiedStorage.removeItem(key);
export const getStorageUsage = () => unifiedStorage.getStorageUsage();
