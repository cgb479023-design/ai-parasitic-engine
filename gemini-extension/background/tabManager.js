// ═══════════════════════════════════════════════════════════════════════════
// 🗂️ TAB MANAGER MODULE
// ═══════════════════════════════════════════════════════════════════════════

// 🆕 Promisified Helper for chrome.tabs.create
const pTabsCreate = (createProperties) => {
    return new Promise((resolve, reject) => {
        chrome.tabs.create(createProperties, (tab) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(tab);
            }
        });
    });
};

// 🆕 Promisified Helper for chrome.tabs.remove
const pTabsRemove = (tabIds) => {
    return new Promise((resolve, reject) => {
        chrome.tabs.remove(tabIds, () => {
            if (chrome.runtime.lastError) {
                // Ignore error if tab already closed
                resolve();
            } else {
                resolve();
            }
        });
    });
};

// 🆕 Tab Manager for unified tab lifecycle management
const TabManager = {
    activeTabs: new Map(),
    maxConcurrentTabs: 10,
    tabCleanupInterval: null,

    init() {
        console.log('🗂 [TabManager] Initialized');
        // Start cleanup interval (every 5 minutes)
        this.tabCleanupInterval = setInterval(() => {
            this.cleanupStaleTabs();
        }, 300000); // 5 minutes

        // 🆕 LISTENER: Track tab closures to prevent memory leaks
        chrome.tabs.onRemoved.addListener((tabId) => {
            if (this.activeTabs.has(tabId)) {
                console.log(`🗂 [TabManager] Detected external closure of tab ${tabId}`);
                this.activeTabs.delete(tabId);
            }
        });
    },

    async create(options) {
        if (this.activeTabs.size >= this.maxConcurrentTabs) {
            console.warn('⚠️ [TabManager] Max concurrent tabs reached:', this.maxConcurrentTabs);
            throw new Error('Max concurrent tabs reached');
        }

        // 🛡️ Fix: Extract 'purpose' from options before passing to chrome.tabs.create
        const { purpose, ...createOptions } = options;

        const tab = await pTabsCreate(createOptions);
        this.activeTabs.set(tab.id, {
            created: Date.now(),
            purpose: purpose || 'general',
            url: createOptions.url
        });

        console.log(`🗂 [TabManager] Tab ${tab.id} created. Active: ${this.activeTabs.size}/${this.maxConcurrentTabs}`);

        // Set auto-cleanup timeout (10 minutes max lifetime)
        setTimeout(() => {
            if (this.activeTabs.has(tab.id)) {
                console.log(`🗂 [TabManager] Auto-closing stale tab ${tab.id}`);
                this.remove(tab.id);
            }
        }, 600000); // 10 minutes

        return tab;
    },

    async remove(tabId) {
        if (this.activeTabs.has(tabId)) {
            const info = this.activeTabs.get(tabId);
            console.log(`🗂 [TabManager] Removing tab ${tabId} (purpose: ${info.purpose}, age: ${Date.now() - info.created}ms)`);
            this.activeTabs.delete(tabId);
        }
        try {
            await pTabsRemove(tabId);
        } catch (e) {
            // Tab may already be closed
            console.debug(`🗂 [TabManager] Tab ${tabId} already closed`);
        }
    },

    cleanupStaleTabs() {
        const now = Date.now();
        const staleThreshold = 600000; // 10 minutes

        for (const [tabId, info] of this.activeTabs.entries()) {
            if (now - info.created > staleThreshold) {
                console.warn(`🗂 [TabManager] Found stale tab ${tabId}, cleaning up...`);
                this.remove(tabId);
            }
        }
    },

    getStats() {
        return {
            activeCount: this.activeTabs.size,
            maxConcurrent: this.maxConcurrentTabs,
            tabs: Array.from(this.activeTabs.entries()).map(([id, info]) => ({
                id,
                ...info,
                age: Date.now() - info.created
            }))
        };
    }
};

// Initialize Tab Manager
TabManager.init();
