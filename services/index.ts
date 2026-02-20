/**
 * Closed-Loop Services Entry Point
 *
 * Unified export for all closed-loop system services.
 * This module provides centralized state management, audit trails,
 * reliable messaging, and automatic recovery mechanisms.
 *
 * @module services
 * @version 1.0.0
 * @date 2026-01-12
 */

// OAuth Service - Import for internal use
import {
    startOAuthFlow,
    handleOAuthCallback,
    getAccessToken,
    getRefreshToken,
    isAuthenticated,
    refreshAccessToken,
    verifyToken,
    getUserInfo,
    getCachedUserInfo,
    logout,
    getValidAccessToken,
    createAuthenticatedClient,
    getAuthHeaders
} from './oauthService';

// State Management - Import for internal use
import type {
    StateManager,
    StateSnapshot,
    StateConflict,
    StateEvent,
    StateManagerConfig
} from './stateManagerService';
import {
    initializeStateManager,
    getStateManager,
    destroyStateManager
} from './stateManagerService';

// Audit Trail - Import for internal use
import type {
    AuditTrailService,
    AuditEvent,
    AuditFilter,
    AuditStats,
    AuditExport
} from './auditTrailService';
import {
    initializeAuditTrail,
    getAuditTrailService,
    destroyAuditTrail
} from './auditTrailService';

// Message Bus - Import for internal use
import type {
    MessageBusService,
    MessagePayload,
    MessageHandler,
    MessageSubscription,
    MessageBusConfig,
    RequestResponse
} from './messageBusService';
import {
    MESSAGE_TYPES,
    initializeMessageBus,
    getMessageBusService,
    destroyMessageBus
} from './messageBusService';

// Recovery - Import for internal use
import type {
    RecoveryService,
    RecoveryAction,
    RecoveryPolicy,
    RecoveryStats
} from './recoveryService';
import {
    initializeRecoveryService,
    getRecoveryService,
    destroyRecoveryService
} from './recoveryService';

// Re-exports for external consumers
export {
    StateManager,
    StateSnapshot,
    StateConflict,
    StateEvent,
    StateManagerConfig,
    initializeStateManager,
    getStateManager,
    destroyStateManager
};

export {
    AuditTrailService,
    AuditEvent,
    AuditFilter,
    AuditStats,
    AuditExport,
    initializeAuditTrail,
    getAuditTrailService,
    destroyAuditTrail
};

export {
    MessageBusService,
    MessagePayload,
    MessageHandler,
    MessageSubscription,
    MessageBusConfig,
    RequestResponse,
    MESSAGE_TYPES,
    initializeMessageBus,
    getMessageBusService,
    destroyMessageBus
};

export {
    RecoveryService,
    RecoveryAction,
    RecoveryPolicy,
    RecoveryStats,
    initializeRecoveryService,
    getRecoveryService,
    destroyRecoveryService
};

export {
    startOAuthFlow,
    handleOAuthCallback,
    getAccessToken,
    getRefreshToken,
    isAuthenticated,
    refreshAccessToken,
    verifyToken,
    getUserInfo,
    getCachedUserInfo,
    logout,
    getValidAccessToken,
    createAuthenticatedClient,
    getAuthHeaders
};

export type {
    OAuthConfig,
    TokenInfo,
    UserInfo
} from './oauthService';

// ─────────────────────────────────────────────────────────────────────────────
// INITIALIZATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize all closed-loop services
 */
export async function initializeClosedLoopServices(): Promise<{
    stateManager: StateManager<any>;
    auditTrail: AuditTrailService;
    messageBus: MessageBusService;
    recovery: RecoveryService;
}> {
    console.log('🚀 [ClosedLoopServices] Initializing all services...');

    // Initialize State Manager
    const stateManager = initializeStateManager({
        yppPlan: null,
        youtubeAnalyticsData: null
    }, {
        storagePrefix: 'closedloop_',
        maxHistory: 100,
        conflictStrategy: 'last-write-wins',
        enableOptimisticUpdates: true,
        enableAuditTrail: true
    });

    // Initialize Audit Trail
    const auditTrail = initializeAuditTrail();

    // Initialize Message Bus
    const messageBus = initializeMessageBus({
        maxSubscribers: 100,
        defaultMessageTTL: 60000,
        ackTimeout: 5000,
        enablePersistence: true,
        enableBroadcasting: true
    });

    // Initialize Recovery Service
    const recovery = initializeRecoveryService({
        maxRetryAttempts: 5,
        initialBackoffMs: 1000,
        backoffMultiplier: 2,
        maxBackoffMs: 30000,
        autoRetryDelay: 5000
    });

    console.log('✅ [ClosedLoopServices] All services initialized');

    return {
        stateManager,
        auditTrail,
        messageBus,
        recovery
    };
}

/**
 * Destroy all closed-loop services
 */
export function destroyClosedLoopServices(): void {
    console.log('🗑️ [ClosedLoopServices] Destroying all services...');

    destroyStateManager();
    destroyAuditTrail();
    destroyMessageBus();
    destroyRecoveryService();

    console.log('✅ [ClosedLoopServices] All services destroyed');
}

/**
 * Get service instances
 */
export function getClosedLoopServices(): {
    stateManager: StateManager<any> | null;
    auditTrail: AuditTrailService | null;
    messageBus: MessageBusService | null;
    recovery: RecoveryService | null;
} {
    return {
        stateManager: getStateManager(),
        auditTrail: getAuditTrailService(),
        messageBus: getMessageBusService(),
        recovery: getRecoveryService()
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Integration helper: Migrate existing localStorage keys to State Manager
 */
export function migrateToStateManager(oldKeys: string[]): void {
    const stateManager = getStateManager();
    if (!stateManager) {
        console.warn('⚠️ [Integration] State manager not initialized, skipping migration');
        return;
    }

    console.log(`🔄 [Integration] Migrating ${oldKeys.length} keys to State Manager...`);

    oldKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) {
            try {
                const parsed = JSON.parse(value);
                stateManager.setState(key, parsed, {
                    reason: 'Migration from localStorage',
                    source: 'local'
                });

                // 🔥 [CRITICAL FIX] DO NOT remove old key. 
                // Removing it causes persistence loss on refresh because other components
                // (like the Force Recover button) still look for the original key.
                // localStorage.removeItem(key);

                console.log(`✅ [Integration] Mirrored ${key} to State Manager`);
            } catch (e) {
                console.error(`❌ [Integration] Failed to migrate ${key}:`, e);
            }
        }
    });
}

/**
 * Integration helper: Subscribe to system-wide events
 */
export function subscribeToSystemEvents(): void {
    const { auditTrail, messageBus, recovery } = getClosedLoopServices();

    if (!auditTrail || !messageBus || !recovery) {
        console.warn('⚠️ [Integration] Some services not initialized');
        return;
    }

    // Subscribe to state changes for audit logging
    if (messageBus) {
        messageBus.subscribe('STATE_SET', (msg) => {
            auditTrail.logEvent({
                eventType: 'SET',
                key: msg.payload.key,
                oldValue: msg.payload.oldValue,
                newValue: msg.payload.newValue,
                metadata: {
                    source: 'local',
                    reason: msg.payload.reason
                },
                severity: 'info'
            });
        });

        messageBus.subscribe('STATE_UPDATE', (msg) => {
            auditTrail.logEvent({
                eventType: 'UPDATE',
                key: msg.payload.key,
                oldValue: msg.payload.oldValue,
                newValue: msg.payload.newValue,
                metadata: {
                    source: 'local',
                    reason: msg.payload.reason
                },
                severity: 'info'
            });
        });

        messageBus.subscribe('STATE_ROLLBACK', (msg) => {
            auditTrail.logEvent({
                eventType: 'ROLLBACK',
                key: msg.payload.key,
                oldValue: msg.payload.oldValue,
                newValue: msg.payload.newValue,
                metadata: {
                    reason: msg.payload.reason,
                    version: msg.payload.targetVersion
                },
                severity: 'warning'
            });
        });
    }

    console.log('✅ [Integration] System events subscribed');
}

/**
 * Integration helper: Enable automatic recovery on errors
 */
export function enableAutomaticRecovery(): void {
    const { messageBus, recovery } = getClosedLoopServices();

    if (!messageBus || !recovery) {
        console.warn('⚠️ [Integration] Some services not initialized');
        return;
    }

    // Subscribe to error messages and trigger recovery
    messageBus.subscribe('STATE_UPDATE_ERROR', async (msg) => {
        console.log(`🔄 [Integration] Triggering automatic recovery for ${msg.payload.key}`);

        const recoveryAction: RecoveryAction = {
            id: `auto_recovery_${Date.now()}`,
            type: 'AUTO_RETRY',
            stateKey: msg.payload.key,
            reason: `Automatic recovery from error: ${msg.payload.error?.message || 'Unknown error'}`,
            status: 'pending',
            triggeredAt: Date.now()
        };

        const success = await recovery.executeRecovery(recoveryAction);

        if (success) {
            console.log(`✅ [Integration] Automatic recovery succeeded for ${msg.payload.key}`);
        } else {
            console.error(`❌ [Integration] Automatic recovery failed for ${msg.payload.key}`);
        }
    });

    console.log('✅ [Integration] Automatic recovery enabled');
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS FOR COMPATIBILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Legacy export for backward compatibility
 */
export const ClosedLoopServices = {
    stateManager: {
        initialize: initializeStateManager,
        get: getStateManager,
        destroy: destroyStateManager
    },
    auditTrail: {
        initialize: initializeAuditTrail,
        get: getAuditTrailService,
        destroy: destroyAuditTrail
    },
    messageBus: {
        initialize: initializeMessageBus,
        get: getMessageBusService,
        destroy: destroyMessageBus
    },
    recovery: {
        initialize: initializeRecoveryService,
        get: getRecoveryService,
        destroy: destroyRecoveryService
    }
};
