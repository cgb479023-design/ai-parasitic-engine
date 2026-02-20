// 🆕 V0.2: Closed-Loop System Helpers
// Extracted from monolithic YouTubeAnalytics.tsx
// Provides safe state management with StateManager + localStorage fallback

import { getStateManager, getAuditTrailService } from '@/services';

// Singleton instances
const stateManager = getStateManager();
const auditTrail = getAuditTrailService();

/**
 * Safe state setter with null protection and dual-write for high-priority keys.
 * Uses StateManager when available, falls back to localStorage.
 */
export const safeSetState = (key: string, value: any, reason: string = 'Update') => {
    // 🛡️ Prevention: Don't save null/undefined data that might overwrite valid state
    if (value === null || value === undefined) {
        console.warn(`⚠️ [safeSetState] Refused to save null/undefined value for key: ${key}`);
        return;
    }

    if (!stateManager) {
        console.warn('⚠️ [StateManager] Not initialized, using localStorage fallback');
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('[safeSetState] localStorage write failed:', e);
        }
        return;
    }
    (stateManager.setState as any)(key, value, { reason, source: 'local' });

    // 🔥 [Redundancy] Also write to localStorage immediately for high-priority keys
    if (['yppPlan', 'yppQueue', 'dfl_status'].includes(key)) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch { /* silent */ }
    }
};

/**
 * Safe state getter with dual-source recovery.
 * Tries StateManager snapshot first, then localStorage fallback.
 */
export const safeGetState = (key: string): any | null => {
    // 🏷️ V9.2 Robust Version
    let result = null;
    if (stateManager) {
        try {
            const snapshot = (stateManager as any).getSnapshot(key);
            result = snapshot ? snapshot.data : null;
        } catch (e) {
            console.warn(`[safeGetState] Snapshot access failed for ${key}:`, e);
        }
    }

    // 🛡️ [Hard Fallback] If memory state is empty, check localStorage
    if (!result || (typeof result === 'object' && Object.keys(result).length === 0)) {
        // Check BOTH standard and prefixed keys (V9.5)
        const keysToTry = [key, `closedloop_${key}`];
        for (const storageKey of keysToTry) {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    // Handle StateManager snapshot format if it's a prefixed key
                    result = parsed.data ? parsed.data : parsed;
                    if (result && result.schedule) {
                        console.log(`💾 [safeGetState] V9.5 Recovered from ${storageKey}`);
                        break;
                    }
                } catch (e) {
                    console.warn(`[safeGetState] Failed to parse ${storageKey}:`, e);
                }
            }
        }
    }
    return result;
};

/**
 * Safe audit log that wraps AuditTrailService.
 * Falls back to console.log when AuditTrailService is unavailable.
 */
export const safeLog = (message: string, type: 'info' | 'warning' | 'error' = 'info', context?: any) => {
    if (!auditTrail) {
        console.log(`[${type.toUpperCase()}] ${message}`);
        return;
    }
    // Map log types to audit event types
    const eventTypeMap: Record<string, 'UPDATE' | 'VALIDATION_FAILED'> = {
        'info': 'UPDATE',
        'warning': 'UPDATE',
        'error': 'VALIDATION_FAILED'
    };
    auditTrail.logEvent({
        eventType: eventTypeMap[type] || 'UPDATE',
        key: 'YouTubeAnalytics',
        oldValue: null,
        newValue: { message, context },
        metadata: context || {},
        severity: type,
        timestamp: Date.now()
    });
};
