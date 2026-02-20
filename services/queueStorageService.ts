interface QueueItem {
  id: string;
  videoId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data: any;
  timestamp: number;
}

const DB_NAME = 'ExecutionQueueDB';
const DB_VERSION = 1;
const STORE_NAME = 'queue';

let db: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('❌ [QueueService] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('✅ [QueueService] Database opened successfully');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('✅ [QueueService] Object store created');
      }
    };
  });
}

export async function saveQueue(queue: QueueItem[]): Promise<void> {
  try {
    const database = await getDB();
    const tx = database.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Clear existing queue
    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    // Add all items
    for (const item of queue) {
      await new Promise<void>((resolve, reject) => {
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
    
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    
    console.log('✅ [QueueService] Queue saved to IndexedDB:', queue.length, 'items');
  } catch (error) {
    console.error('❌ [QueueService] Failed to save queue:', error);
    throw error;
  }
}

export async function loadQueue(): Promise<QueueItem[]> {
  try {
    const database = await getDB();
    
    return new Promise<QueueItem[]>((resolve, reject) => {
      const tx = database.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const items = request.result;
        // Sort by timestamp
        items.sort((a, b) => a.timestamp - b.timestamp);
        console.log('✅ [QueueService] Queue loaded from IndexedDB:', items.length, 'items');
        resolve(items);
      };
      
      request.onerror = () => {
        console.error('❌ [QueueService] Failed to load queue:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('❌ [QueueService] Failed to load queue:', error);
    
    // Fallback: try localStorage migration
    try {
      const fallback = localStorage.getItem('executionQueue');
      if (fallback) {
        const parsed = JSON.parse(fallback);
        console.log('🔄 [QueueService] Migrating from localStorage:', parsed.length, 'items');
        await saveQueue(parsed);
        localStorage.removeItem('executionQueue');
        return parsed;
      }
    } catch (e) {
      console.error('❌ [QueueService] Migration failed:', e);
    }
    
    return [];
  }
}

export async function clearQueue(): Promise<void> {
  try {
    const database = await getDB();
    const tx = database.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => {
        console.log('✅ [QueueService] Queue cleared');
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('❌ [QueueService] Failed to clear queue:', error);
    throw error;
  }
}

export async function addQueueItem(item: QueueItem): Promise<void> {
  try {
    const database = await getDB();
    const tx = database.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => {
        console.log('✅ [QueueService] Item added to queue:', item.id);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('❌ [QueueService] Failed to add item:', error);
    throw error;
  }
}

export async function updateQueueItem(id: string, updates: Partial<QueueItem>): Promise<void> {
  try {
    const database = await getDB();
    const tx = database.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    const item = await new Promise<QueueItem | undefined>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    if (item) {
      const updated = { ...item, ...updates };
      await new Promise<void>((resolve, reject) => {
        const request = store.put(updated);
        request.onsuccess = () => {
          console.log('✅ [QueueService] Item updated:', id);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    }
    
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('❌ [QueueService] Failed to update item:', error);
    throw error;
  }
}

export async function removeQueueItem(id: string): Promise<void> {
  try {
    const database = await getDB();
    const tx = database.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => {
        console.log('✅ [QueueService] Item removed:', id);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('❌ [QueueService] Failed to remove item:', error);
    throw error;
  }
}
