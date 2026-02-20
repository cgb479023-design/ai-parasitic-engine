import { vi } from 'vitest';

// Mock the matchMedia API for jest-dom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock indexedDB
Object.defineProperty(window, 'indexedDB', {
  writable: true,
  value: {
    open: vi.fn(() => ({
      // Mock a basic IDBOpenDBRequest interface
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      result: {
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            put: vi.fn(),
            get: vi.fn(),
            delete: vi.fn(),
            clear: vi.fn(),
          })),
        })),
        createObjectStore: vi.fn(),
      },
      // You might need to mock these to trigger the onsuccess/onerror callbacks
      // For now, a minimal mock is sufficient to prevent ReferenceError
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
    deleteDatabase: vi.fn(() => ({
      onsuccess: null,
      onerror: null,
    })),
  },
});
