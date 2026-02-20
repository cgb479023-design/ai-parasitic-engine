/**
 * Recovery Service (Automatic Rollback & Retry Mechanisms)
 *
 * Provides automatic recovery from failures, retry logic with exponential backoff,
 * and rollback to previous known good states.
 *
 * @module services/recoveryService
 * @version 1.0.0
 * @date 2026-01-12
 */

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════

export interface RecoveryAction {
    id: string;
    type: 'ROLLBACK' | 'RETRY' | 'MANUAL_MERGE' | 'AUTO_RETRY';
    stateKey: string;
    targetVersion?: number;
    reason: string;
    status: 'pending' | 'completed' | 'failed';
    error?: Error;
    triggeredAt: number;
    completedAt?: number;
}

export interface RecoveryPolicy {
    maxRetryAttempts: number;
    initialBackoffMs: number;
    backoffMultiplier: number;
    maxBackoffMs: number;
    retryableErrors: RegExp[];
    autoRetryDelay: number;
    ackTimeout: number;
}

export interface RecoveryStats {
    totalActions: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    avgRecoveryTime: number;
    successRate: number;
}

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═════════════════════════════════════════════════════════════════════════════

const DEFAULT_RECOVERY_POLICY: RecoveryPolicy = {
    maxRetryAttempts: 5,
    initialBackoffMs: 1000,
    backoffMultiplier: 2,
    maxBackoffMs: 30000,
    retryableErrors: [/ECONNREFUSED|ECONNABORTED|ETIMEDOUT|502|503|504|ECONNRESET/],
    autoRetryDelay: 5000,
    ackTimeout: 10000
};

const RECOVERY_POLICIES: Record<string, Partial<RecoveryPolicy>> = {
    STATE_UPDATE_CONFLICT: {
        ...DEFAULT_RECOVERY_POLICY,
        retryableErrors: [/Conflict.*detected/],
        autoRetryDelay: 2000
    },
    API_TIMEOUT: {
        ...DEFAULT_RECOVERY_POLICY,
        retryableErrors: [/timeout/i],
        backoffMultiplier: 3
    },
    NETWORK_ERROR: {
        ...DEFAULT_RECOVERY_POLICY,
        retryableErrors: [/network|fetch/i],
        backoffMultiplier: 2
    },
    SERVER_ERROR: {
        ...DEFAULT_RECOVERY_POLICY,
        retryableErrors: [/5\d\d/i, /server/i],
        maxRetryAttempts: 3
    },
    STORAGE_FULL: {
        ...DEFAULT_RECOVERY_POLICY,
        retryableErrors: [/quota|storage|disk|memory/i],
        maxRetryAttempts: 0
    },
};

// ═════════════════════════════════════════════════════════════════════════════
// RECOVERY SERVICE CLASS
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════

export class RecoveryService {
    private config: RecoveryPolicy;
    private recoveryActions: Map<string, RecoveryAction[]> = new Map();
    private stats: RecoveryStats = {
        totalActions: 0,
        successfulRecoveries: 0,
        failedRecoveries: 0,
        avgRecoveryTime: 0,
        successRate: 0
    };

    constructor(policy?: Partial<RecoveryPolicy>) {
        this.config = { ...DEFAULT_RECOVERY_POLICY, ...policy };
        this.loadFromStorage();
        this.updateStats();
        console.log(`🔄 [RecoveryService] Initialized with policy:`, this.config);
    }

    async executeRecovery(action: RecoveryAction): Promise<boolean> {
        const { type, stateKey, targetVersion, reason } = action;

        const recoveryAction: RecoveryAction = {
            ...action,
            id: `recovery_${Date.now()}_${Math.random().toString(36).substring(2)}`,
            status: 'pending',
            triggeredAt: Date.now()
        };

        this.recoveryActions.set(stateKey, [...(this.recoveryActions.get(stateKey) || []), recoveryAction]);
        this.saveToStorage();

        console.log(`🔄 [RecoveryService] Executing ${type} for ${stateKey}:`, reason);

        try {
            let result = false;
            switch (type) {
                case 'ROLLBACK':
                    result = await this.executeRollback(stateKey, targetVersion);
                    break;
                case 'RETRY':
                    result = await this.executeRetry(stateKey, action);
                    break;
                case 'MANUAL_MERGE':
                    result = await this.executeManualMerge(stateKey, action);
                    break;
                case 'AUTO_RETRY':
                    result = await this.executeAutoRetry(stateKey);
                    break;
                default:
                    console.warn(`⚠️ [RecoveryService] Unknown recovery type: ${type}`);
                    recoveryAction.status = 'failed';
                    recoveryAction.error = new Error(`Unknown recovery type: ${type}`);
                    recoveryAction.completedAt = Date.now();
                    this.saveToStorage();
                    return false;
            }

            if (result) {
                recoveryAction.status = 'completed';
                recoveryAction.completedAt = Date.now();
                this.stats.successfulRecoveries++;
            } else {
                recoveryAction.status = 'failed';
                recoveryAction.completedAt = Date.now();
                this.stats.failedRecoveries++;
            }
            this.stats.totalActions++;
            this.updateStats();
            this.saveToStorage();
            return result;
        } catch (error) {
            console.error(`❌ [RecoveryService] Recovery failed:`, error);
            recoveryAction.status = 'failed';
            recoveryAction.error = error as Error;
            recoveryAction.completedAt = Date.now();
            this.saveToStorage();
            this.stats.totalActions++;
            this.stats.failedRecoveries++;
            return false;
        }
    }

    private async executeRollback(stateKey: string, targetVersion?: number): Promise<boolean> {
        console.log(`↩️ [RecoveryService] Rolling back ${stateKey} to version ${targetVersion || 'previous'}`);

        const result = await import('./stateManagerService').then(async m => {
            const manager = m.getStateManager();
            if (!manager) {
                throw new Error('State manager not initialized');
            }
            const snapshot = manager.getSnapshot(stateKey);
            if (!snapshot) {
                throw new Error(`No state found for key: ${stateKey}`);
            }
            await manager.rollback(stateKey, targetVersion);
            console.log(`✅ [RecoveryService] Rollback completed for ${stateKey}`);
            return true;
        }).catch(err => {
            console.error(`❌ [RecoveryService] Rollback failed:`, err);
            return false;
        });

        const actions = this.recoveryActions.get(stateKey) || [];
        const lastAction = actions.find(a => a.status === 'pending');
        if (lastAction) {
            lastAction.status = result ? 'completed' : 'failed';
            lastAction.completedAt = Date.now();
            this.saveToStorage();
            if (result) {
                this.stats.successfulRecoveries++;
                this.updateStats();
            }
        }
        return result;
    }

    private async executeRetry(stateKey: string, action: RecoveryAction): Promise<boolean> {
        const actions = this.recoveryActions.get(stateKey) || [];
        const lastAction = actions.find(a => a.status === 'pending');
        if (!lastAction) {
            console.warn(`⚠️ [RecoveryService] No pending retry action for ${stateKey}`);
            return false;
        }

        const attempt = this.getRetryCount(action) || 0;
        const maxAttempts = this.config.maxRetryAttempts;

        if (attempt >= maxAttempts) {
            console.warn(`⚠️ [RecoveryService] Max retry attempts (${maxAttempts}) reached for ${stateKey}`);
            return false;
        }

        const delay = this.calculateBackoff(attempt);
        console.log(`🔄 [RecoveryService] Retry attempt ${attempt + 1} for ${stateKey} after ${delay}ms delay`);

        await new Promise(resolve => setTimeout(resolve, delay));

        const result = await import('./messageBusService').then(async m => {
            const bus = m.getMessageBusService();
            if (!bus) {
                console.warn('⚠️ [RecoveryService] Message bus not available, skipping retry');
                return false;
            }
            const res = await bus.request<any>(
                'RECOVERY_RETRY',
                { stateKey, attempt: attempt + 1 },
                this.config.ackTimeout
            );
            return res.response ? res.response.success : false;
        }).catch(err => {
            console.error(`❌ [RecoveryService] Retry failed:`, err);
            return false;
        });

        const pendingActions = this.recoveryActions.get(stateKey) || [];
        const pendingAction = pendingActions.find(a => a.status === 'pending');
        if (pendingAction) {
            pendingAction.status = result ? 'completed' : 'failed';
            pendingAction.completedAt = Date.now();
            this.saveToStorage();
        }
        return result;
    }

    private async executeManualMerge(stateKey: string, action: RecoveryAction): Promise<boolean> {
        console.log(`🔀 [RecoveryService] Requesting manual merge for ${stateKey}`);

        const actions = this.recoveryActions.get(stateKey) || [];
        const lastAction = actions.find(a => a.status === 'pending');
        if (!lastAction) {
            console.warn(`⚠️ [RecoveryService] No pending manual merge for ${stateKey}`);
            return false;
        }

        const result = await import('./messageBusService').then(async m => {
            const bus = m.getMessageBusService();
            if (!bus) {
                console.warn('⚠️ [RecoveryService] Message bus not available for manual merge');
                return false;
            }
            const res = await bus.request<any>(
                'RECOVERY_MANUAL_MERGE',
                { stateKey },
                this.config.ackTimeout
            );
            return res.response ? res.response.success : false;
        }).catch(err => {
            console.error(`❌ [RecoveryService] Manual merge failed:`, err);
            return false;
        });

        const pendingActions = this.recoveryActions.get(stateKey) || [];
        const pendingAction = pendingActions.find(a => a.status === 'pending');
        if (pendingAction) {
            pendingAction.status = result ? 'completed' : 'failed';
            pendingAction.completedAt = Date.now();
            this.saveToStorage();
        }
        return result;
    }

    private async executeAutoRetry(stateKey: string): Promise<boolean> {
        const actions = this.recoveryActions.get(stateKey) || [];
        const lastAction = actions.find(a => a.status === 'failed' && a.error);
        if (!lastAction) {
            return false;
        }

        const error = lastAction.error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isRetryable = this.config.retryableErrors.some(regex => regex.test(errorMessage));

        if (!isRetryable) {
            console.log(`⏭ [RecoveryService] Error not retryable: ${errorMessage}`);
            return false;
        }

        console.log(`🔄 [RecoveryService] Auto-retry attempt for ${stateKey} after ${this.config.autoRetryDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, this.config.autoRetryDelay));

        const result = await import('./messageBusService').then(async m => {
            const bus = m.getMessageBusService();
            if (!bus) {
                console.warn('⚠️ [RecoveryService] Message bus not available for auto-retry');
                return false;
            }
            const res = await bus.request<any>(
                'RECOVERY_AUTO_RETRY',
                { stateKey },
                this.config.ackTimeout
            );
            return res.response ? res.response.success : false;
        }).catch(err => {
            console.error(`❌ [RecoveryService] Auto-retry failed:`, err);
            return false;
        });

        const failedActions = this.recoveryActions.get(stateKey) || [];
        const failedAction = failedActions.find(a => a.id === lastAction.id);
        if (failedAction) {
            failedAction.status = result ? 'completed' : 'failed';
            failedAction.completedAt = Date.now();
            this.saveToStorage();
        }
        return result;
    }

    getPolicy(): RecoveryPolicy {
        return { ...this.config };
    }

    getRecoveryHistory(stateKey: string): RecoveryAction[] {
        return this.recoveryActions.get(stateKey) || [];
    }

    getPendingActions(): RecoveryAction[] {
        const allActions: RecoveryAction[] = [];
        this.recoveryActions.forEach(actions => {
            actions.forEach(action => {
                if (action.status === 'pending') {
                    allActions.push(action);
                }
            });
        });
        return allActions;
    }

    getStats(): RecoveryStats {
        return this.stats;
    }

    private updateStats(): void {
        const completedActions: RecoveryAction[] = [];
        this.recoveryActions.forEach(actions => {
            actions.forEach(action => {
                if (action.status === 'completed') {
                    completedActions.push(action);
                }
            });
        });

        if (completedActions.length > 0) {
            const totalRecoveryTime = completedActions.reduce((sum, action) => {
                const duration = (action.completedAt || 0) - (action.triggeredAt || 0);
                return sum + duration;
            }, 0);
            this.stats.avgRecoveryTime = totalRecoveryTime / completedActions.length;
        }

        this.stats.successRate = this.stats.totalActions > 0
            ? (this.stats.successfulRecoveries / this.stats.totalActions) * 100
            : 0;

        console.log(`📊 [RecoveryService] Stats updated:`, this.stats);
    }

    private calculateBackoff(attempt: number): number {
        const backoffMs = this.config.initialBackoffMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
        return Math.min(backoffMs, this.config.maxBackoffMs);
    }

    private getRetryCount(action: RecoveryAction): number {
        const match = action.reason?.match(/attempt (\d+)/);
        return match ? parseInt(match[1]) : 0;
    }

    private saveToStorage(): void {
        try {
            const data = {
                actions: Array.from(this.recoveryActions.entries()).map(([key, actions]) => ({ key, actions })),
                stats: this.stats
            };
            localStorage.setItem('recoveryService_data', JSON.stringify(data));
            this.pruneCompletedActions();
            console.log('💾 [RecoveryService] Saved to storage');
        } catch (e) {
            console.error('❌ [RecoveryService] Failed to save to storage:', e);
        }
    }

    private pruneCompletedActions(): void {
        const maxCompleted = 50;
        this.recoveryActions.forEach((actions, key) => {
            const completed = actions.filter(a => a.status === 'completed');
            if (completed.length > maxCompleted) {
                const sorted = completed.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
                const otherActions = actions.filter(a => a.status !== 'completed');
                this.recoveryActions.set(key, [...otherActions, ...sorted.slice(0, maxCompleted)]);
            }
        });
    }

    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem('recoveryService_data');
            if (stored) {
                const data = JSON.parse(stored);
                this.recoveryActions = new Map(
                    Object.entries(data.actions || {}).map(([key, actions]: [string, RecoveryAction[]]) => [key, actions])
                );
                this.stats = data.stats || this.stats;
                console.log(`📂 [RecoveryService] Loaded ${this.recoveryActions.size} state keys from storage`);
            } else {
                console.log('📂 [RecoveryService] No recovery data found, starting fresh');
            }
        } catch (e) {
            console.warn('⚠️ [RecoveryService] Failed to load from storage:', e);
        }
    }

    clear(): void {
        this.recoveryActions.clear();
        this.stats = {
            totalActions: 0,
            successfulRecoveries: 0,
            failedRecoveries: 0,
            avgRecoveryTime: 0,
            successRate: 0
        };
        localStorage.removeItem('recoveryService_data');
        console.log('🗑️ [RecoveryService] All recovery data cleared');
    }

    exportState(): {
        actions: Record<string, RecoveryAction[]>;
        stats: RecoveryStats;
        exportedAt: number;
    } {
        const actions: Record<string, RecoveryAction[]> = {};
        this.recoveryActions.forEach((value, key) => {
            actions[key] = value;
        });
        return {
            actions,
            stats: this.stats,
            exportedAt: Date.now()
        };
    }
}

let globalRecoveryService: RecoveryService | null = null;

export function initializeRecoveryService(policy?: Partial<RecoveryPolicy>): RecoveryService {
    if (globalRecoveryService) {
        console.warn('⚠️ [RecoveryService] Already initialized, returning existing instance');
        return globalRecoveryService;
    }
    globalRecoveryService = new RecoveryService(policy);
    return globalRecoveryService;
}

export function getRecoveryService(): RecoveryService | null {
    return globalRecoveryService || null;
}

export function destroyRecoveryService(): void {
    if (globalRecoveryService) {
        globalRecoveryService.clear();
        globalRecoveryService = null;
        console.log('🗑️ [RecoveryService] Global instance destroyed');
    }
}
