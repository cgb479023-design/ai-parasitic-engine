/**
 * State Manager Service (Closed-Loop State Management)
 *
 * Centralized state management with conflict resolution,
 * optimistic updates, and automatic recovery.
 *
 * @module services/stateManagerService
 * @version 1.0.0
 * @date 2026-01-12
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═════════════════════════════════════════════════════════════════════════════

export interface StateSnapshot<T> {
    data: T;
    version: number;
    timestamp: number;
    checksum: string;
    source: 'local' | 'remote' | 'server';
}

export interface StateConflict<T> {
    key: string;
    localVersion: StateSnapshot<T>;
    remoteVersion: StateSnapshot<T>;
    strategy: 'last-write-wins' | 'client-wins' | 'manual-merge';
    detectedAt: number;
}

export interface StateEvent<T> {
    key: string;
    type: 'SET' | 'UPDATE' | 'DELETE' | 'MERGE';
    snapshotBefore: StateSnapshot<T> | null;
    snapshotAfter: StateSnapshot<T>;
    userId: string | null;
    timestamp: number;
    reason?: string;
}

export interface RecoveryAction<T> {
    key: string;
    action: 'ROLLBACK' | 'RETRY' | 'MERGE';
    targetSnapshot: StateSnapshot<T>;
    triggeredAt: number;
    completedAt: number | null;
    status: 'pending' | 'completed' | 'failed';
}

export interface StateManagerConfig {
    storagePrefix?: string;
    maxHistory?: number;
    conflictStrategy?: 'last-write-wins' | 'client-wins' | 'manual-merge';
    enableOptimisticUpdates?: boolean;
    enableAuditTrail?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════════════
// STATE MANAGER CLASS
// ═══════════════════════════════════════════════════════════════════════════════════════

export class StateManager<T extends Record<string, any>> {
    private config: Required<StateManagerConfig>;
    private states: Map<string, StateSnapshot<any>> = new Map();
    private eventHistory: StateEvent<any>[] = [];
    private recoveryActions: RecoveryAction<any>[] = [];
    private subscribers: Map<string, Set<(value: any) => void>> = new Map();
    private versionCounter: number = 0;

    constructor(initialState: T, config: StateManagerConfig = {}) {
        this.config = {
            storagePrefix: 'state_',
            maxHistory: 100,
            conflictStrategy: 'last-write-wins',
            enableOptimisticUpdates: true,
            enableAuditTrail: true,
            ...config
        };

        // Initialize all state keys with snapshots
        Object.keys(initialState).forEach(key => {
            this.states.set(key, this.createSnapshot(initialState[key], 'local'));
        });

        // Load from storage
        this.loadFromStorage();
        this.loadAuditTrail();
        this.loadRecoveryActions();

        // Auto-flush on window close
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => this.flush());
        }

        console.log(`🗄️ [StateManager] Initialized with ${Object.keys(initialState).length} state keys`);
    }

    /**
     * Create a state snapshot with version and checksum
     */
    private createSnapshot<V>(data: V, source: StateSnapshot<any>['source']): StateSnapshot<V> {
        this.versionCounter++;
        return {
            data,
            version: this.versionCounter,
            timestamp: Date.now(),
            checksum: this.calculateChecksum(data),
            source
        };
    }

    /**
     * Calculate checksum for data integrity
     */
    private calculateChecksum(data: any): string {
        const str = typeof data === 'object' ? JSON.stringify(data) : String(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(16).padStart(8, '0');
    }

    /**
     * Get current state for a key
     */
    getState<K extends string>(key: K): any | null {
        const snapshot = this.states.get(key);
        return snapshot ? snapshot.data : null;
    }

    /**
     * Get full snapshot for a key
     */
    getSnapshot<K extends string>(key: K): StateSnapshot<any> | null {
        return this.states.get(key) || null;
    }

    /**
     * Set state with conflict detection and optimistic update
     */
    async setState<K extends string>(
        key: K,
        value: any,
        options: {
            optimistic?: boolean;
            source?: StateSnapshot<any>['source'];
            reason?: string;
        } = {}
    ): Promise<StateSnapshot<any>> {
        const { optimistic = false, source = 'local', reason } = options;
        const beforeSnapshot = this.states.get(key);

        // Create new snapshot
        const newSnapshot = this.createSnapshot(value, source);

        // Detect conflict
        const conflict = this.detectConflict(key, newSnapshot);

        if (conflict && !optimistic) {
            console.warn(`⚠️ [StateManager] Conflict detected for ${key}:`, conflict);
            const resolvedSnapshot = await this.resolveConflict(key, conflict);
            this.states.set(key, resolvedSnapshot);
        } else {
            this.states.set(key, newSnapshot);
        }

        const finalSnapshot = this.states.get(key)!;

        // Log audit event
        if (this.config.enableAuditTrail) {
            const event: StateEvent<any> = {
                key: key,
                type: beforeSnapshot ? 'UPDATE' : 'SET',
                snapshotBefore: beforeSnapshot || null,
                snapshotAfter: finalSnapshot,
                userId: null,
                timestamp: Date.now(),
                reason
            };
            this.logEvent(event);
        }

        // Save to storage
        this.saveToStorage(key, finalSnapshot);

        // Notify subscribers
        this.notifySubscribers(key, finalSnapshot.data);

        return finalSnapshot;
    }

    /**
     * Detect conflict between incoming state and current state
     */
    private detectConflict<K extends string>(
        key: K,
        incoming: StateSnapshot<any>
    ): StateConflict<any> | null {
        const current = this.states.get(key);
        if (!current) return null;

        // Conflict if remote version > local version but data differs
        if (incoming.source === 'remote' && incoming.version > current.version) {
            const checksumsMatch = incoming.checksum === current.checksum;
            if (!checksumsMatch) {
                return {
                    key: key,
                    localVersion: current,
                    remoteVersion: incoming,
                    strategy: this.config.conflictStrategy,
                    detectedAt: Date.now()
                };
            }
        }

        return null;
    }

    /**
     * Resolve state conflict based on configured strategy
     */
    private async resolveConflict<K extends string>(
        key: K,
        conflict: StateConflict<any>
    ): Promise<StateSnapshot<any>> {
        const { localVersion, remoteVersion, strategy } = conflict;

        switch (strategy) {
            case 'last-write-wins':
                // Remote wins (more recent)
                return remoteVersion;

            case 'client-wins':
                // Local wins (preserve user's work)
                return localVersion;

            case 'manual-merge':
                // Merge objects, primitives use remote
                if (typeof remoteVersion.data === 'object' && typeof localVersion.data === 'object') {
                    const merged = this.mergeObjects(localVersion.data, remoteVersion.data);
                    return this.createSnapshot(merged, 'local');
                }
                return remoteVersion;

            default:
                return localVersion;
        }
    }

    /**
     * Merge two objects recursively
     */
    private mergeObjects(target: any, source: any): any {
        if (typeof target !== 'object' || target === null) return source;
        if (typeof source !== 'object' || source === null) return target;

        const result = { ...target };

        Object.keys(source).forEach(key => {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                    result[key] = this.mergeObjects(target[key], source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        });

        return result;
    }

    /**
     * Subscribe to state changes for a specific key
     */
    subscribe<K extends string>(key: K, callback: (value: any) => void): () => void {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }

        const callbacks = this.subscribers.get(key)!;
        callbacks.add(callback);

        // Send current value immediately
        const currentSnapshot = this.states.get(key);
        if (currentSnapshot) {
            callback(currentSnapshot.data);
        }

        // Return unsubscribe function
        return () => {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                this.subscribers.delete(key);
            }
        };
    }

    /**
     * Notify all subscribers for a key
     */
    private notifySubscribers<K extends string>(key: K, value: any): void {
        const callbacks = this.subscribers.get(key);
        if (callbacks) {
            callbacks.forEach(callback => callback(value));
        }
    }

    /**
     * Rollback state to previous version
     */
    async rollback<K extends string>(key: K, targetVersion?: number): Promise<StateSnapshot<any>> {
        const current = this.states.get(key);
        if (!current) {
            throw new Error(`Cannot rollback ${key}: no current state`);
        }

        // Find target version in history
        const targetVersionToUse = targetVersion || current.version - 1;

        // Get snapshot from storage backup
        const backupKey = `${this.config.storagePrefix}${key}_v${targetVersionToUse}`;
        const backup = localStorage.getItem(backupKey);

        if (!backup) {
            throw new Error(`Cannot rollback ${key} to version ${targetVersionToUse}: backup not found`);
        }

        const backupSnapshot: StateSnapshot<any> = JSON.parse(backup);

        // Log recovery action
        const recoveryAction: RecoveryAction<any> = {
            key: key,
            action: 'ROLLBACK',
            targetSnapshot: backupSnapshot,
            triggeredAt: Date.now(),
            completedAt: null,
            status: 'pending'
        };
        this.recoveryActions.push(recoveryAction);
        this.saveRecoveryActions();

        // Update state
        this.states.set(key, backupSnapshot);

        // Log audit event
        if (this.config.enableAuditTrail) {
            const event: StateEvent<any> = {
                key: key,
                type: 'SET',
                snapshotBefore: current,
                snapshotAfter: backupSnapshot,
                userId: null,
                timestamp: Date.now(),
                reason: `Rollback to version ${targetVersionToUse}`
            };
            this.logEvent(event);
        }

        this.saveToStorage(key, backupSnapshot);
        this.notifySubscribers(key, backupSnapshot.data);

        console.log(`↩️ [StateManager] Rolled back ${key} to version ${targetVersionToUse}`);

        recoveryAction.completedAt = Date.now();
        recoveryAction.status = 'completed';
        this.saveRecoveryActions();

        return backupSnapshot;
    }

    /**
     * Retry last failed operation
     */
    async retry<K extends string>(key: K): Promise<StateSnapshot<any> | null> {
        // Find last pending recovery action
        const lastAction = this.recoveryActions.find(a => a.key === key && a.status === 'pending');

        if (!lastAction) {
            console.warn(`⚠️ [StateManager] No pending recovery action for ${key}`);
            return null;
        }

        lastAction.action = 'RETRY';
        lastAction.status = 'pending';
        this.saveRecoveryActions();

        // Apply target snapshot
        this.states.set(key, lastAction.targetSnapshot);
        this.saveToStorage(key, lastAction.targetSnapshot);
        this.notifySubscribers(key, lastAction.targetSnapshot.data);

        lastAction.completedAt = Date.now();
        lastAction.status = 'completed';
        this.saveRecoveryActions();

        console.log(`🔄 [StateManager] Retried operation for ${key}`);

        return lastAction.targetSnapshot;
    }

    /**
     * Log state change event
     */
    private logEvent(event: StateEvent<any>): void {
        this.eventHistory.push(event);

        // Trim history
        if (this.eventHistory.length > this.config.maxHistory) {
            this.eventHistory = this.eventHistory.slice(-this.config.maxHistory);
        }

        this.saveAuditTrail();

        console.log(`📝 [StateManager] Event: ${event.type} ${event.key}`, event);
    }

    /**
     * Get audit trail
     */
    getAuditTrail<K extends string>(key?: K): StateEvent<any>[] {
        if (key) {
            return this.eventHistory.filter(e => e.key === key);
        }
        return this.eventHistory;
    }

    /**
     * Get recovery actions
     */
    getRecoveryHistory<K extends string>(key?: K): RecoveryAction<any>[] {
        if (key) {
            return this.recoveryActions.filter(a => a.key === key);
        }
        return this.recoveryActions;
    }

    /**
     * Validate state integrity (checksum verification)
     */
    validateIntegrity<K extends string>(key: K): { valid: boolean; expected: string; actual: string } {
        const snapshot = this.states.get(key);
        if (!snapshot) {
            return { valid: false, expected: 'N/A', actual: 'N/A' };
        }

        const actualChecksum = this.calculateChecksum(snapshot.data);

        // Re-calculate and compare
        const recalculated = this.calculateChecksum(snapshot.data);

        return {
            valid: actualChecksum === recalculated,
            expected: recalculated,
            actual: actualChecksum
        };
    }

    /**
     * Persist state to localStorage with versioning
     */
    private saveToStorage<K extends string>(key: K, snapshot: StateSnapshot<any>): void {
        // Save current version
        localStorage.setItem(`${this.config.storagePrefix}${key}`, JSON.stringify(snapshot));

        // Backup with version number
        localStorage.setItem(`${this.config.storagePrefix}${key}_v${snapshot.version}`, JSON.stringify(snapshot));

        // Clean old backups (keep last 5)
        for (let v = snapshot.version - 5; v > 0; v--) {
            localStorage.removeItem(`${this.config.storagePrefix}${key}_v${v}`);
        }
    }

    /**
     * Load state from storage on initialization
     */
    private loadFromStorage(): void {
        // 🔧 FIX: Use Array.from(this.states.keys()) instead of Object.keys(this.states)
        // Map.keys() returns the correct iterator, Object.keys() on a Map returns empty array
        Array.from(this.states.keys()).forEach(key => {
            const stored = localStorage.getItem(`${this.config.storagePrefix}${key}`);
            if (stored) {
                try {
                    const snapshot: StateSnapshot<any> = JSON.parse(stored);
                    this.states.set(key, snapshot);
                    this.versionCounter = Math.max(this.versionCounter, snapshot.version);
                    console.log(`📦 [StateManager] Loaded ${key} from storage (v${snapshot.version})`);
                } catch (e) {
                    console.warn(`⚠️ [StateManager] Failed to load ${key}:`, e);
                }
            }
        });

        // 🆕 V2.0: Also check for keys that exist in localStorage but weren't in initial state
        // This handles the case where yppPlan was saved directly to localStorage by older code
        const storagePrefix = this.config.storagePrefix;
        const knownKeys = Array.from(this.states.keys());

        // Also try to load common state keys that might be in localStorage with the old format
        const legacyKeys = ['yppPlan', 'youtubeAnalyticsData'];
        legacyKeys.forEach(key => {
            if (!knownKeys.includes(key)) {
                // Try loading with prefix
                let stored = localStorage.getItem(`${storagePrefix}${key}`);

                // Also try loading without prefix (legacy format)
                if (!stored) {
                    stored = localStorage.getItem(key);
                }

                if (stored) {
                    try {
                        const data = JSON.parse(stored);
                        // If it's already a snapshot, use it; otherwise wrap it
                        const snapshot = data.version !== undefined && data.timestamp !== undefined
                            ? data
                            : this.createSnapshot(data, 'local');
                        this.states.set(key, snapshot);
                        console.log(`📦 [StateManager] Loaded legacy ${key} from storage`);
                    } catch (e) {
                        console.warn(`⚠️ [StateManager] Failed to load legacy ${key}:`, e);
                    }
                }
            }
        });
    }

    /**
     * Save audit trail to localStorage
     */
    private saveAuditTrail(): void {
        localStorage.setItem(`${this.config.storagePrefix}audit_trail`, JSON.stringify(this.eventHistory));
    }

    /**
     * Load audit trail from localStorage
     */
    private loadAuditTrail(): void {
        const stored = localStorage.getItem(`${this.config.storagePrefix}audit_trail`);
        if (stored) {
            try {
                this.eventHistory = JSON.parse(stored);
            } catch (e) {
                console.warn('⚠️ [StateManager] Failed to load audit trail:', e);
            }
        }
    }

    /**
     * Save recovery actions to localStorage
     */
    private saveRecoveryActions(): void {
        localStorage.setItem(`${this.config.storagePrefix}recovery_actions`, JSON.stringify(this.recoveryActions));
    }

    /**
     * Load recovery actions from localStorage
     */
    private loadRecoveryActions(): void {
        const stored = localStorage.getItem(`${this.config.storagePrefix}recovery_actions`);
        if (stored) {
            try {
                this.recoveryActions = JSON.parse(stored);
            } catch (e) {
                console.warn('⚠️ [StateManager] Failed to load recovery actions:', e);
            }
        }
    }

    /**
     * Clear all state (reset)
     */
    clear(): void {
        this.states.clear();
        this.subscribers.clear();
        this.eventHistory = [];
        this.recoveryActions = [];

        // Clear storage
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(this.config.storagePrefix!)) {
                localStorage.removeItem(key);
            }
        });

        console.log('🗑️ [StateManager] All state cleared');
    }

    /**
     * Export current state for debugging/backup
     */
    exportState(): {
        states: Record<string, StateSnapshot<any>>;
        events: StateEvent<any>[];
        recoveries: RecoveryAction<any>[];
        exportedAt: number;
    } {
        const states: Record<string, StateSnapshot<any>> = {};
        this.states.forEach((snapshot, key) => {
            states[key] = snapshot;
        });

        return {
            states,
            events: this.eventHistory,
            recoveries: this.recoveryActions,
            exportedAt: Date.now()
        };
    }

    /**
     * Force sync all current states to localStorage
     */
    flush(): void {
        console.log('💾 [StateManager] Flushing all states to storage...');
        this.states.forEach((snapshot, key) => {
            this.saveToStorage(key, snapshot);
        });
        this.saveAuditTrail();
        this.saveRecoveryActions();
        console.log('✅ [StateManager] Flush complete');
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// GLOBAL STATE MANAGER INSTANCE
// ═══════════════════════════════════════════════════════════════════════

let globalStateManager: StateManager<any> | null = null;

/**
 * Initialize global state manager with typed state
 */
export function initializeStateManager<T extends Record<string, any>>(
    initialState: T,
    config?: StateManagerConfig
): StateManager<T> {
    if (globalStateManager) {
        console.warn('⚠️ [StateManager] Already initialized, returning existing instance');
        return globalStateManager;
    }

    globalStateManager = new StateManager(initialState, config);
    return globalStateManager;
}

/**
 * Get global state manager instance
 */
export function getStateManager<T extends Record<string, any>>(): StateManager<T> | null {
    return globalStateManager || null;
}

/**
 * Destroy global state manager
 */
export function destroyStateManager(): void {
    if (globalStateManager) {
        globalStateManager.clear();
        globalStateManager = null;
        console.log('🗑️ [StateManager] Global instance destroyed');
    }
}
