/**
 * YPP Audit Helper
 *
 * Provides centralized audit logging for YPP service operations.
 *
 * @module services/yppAuditHelper
 * @version 1.0.0
 * @date 2026-01-12
 */

import { getAuditTrailService } from './auditTrailService';

type AuditEventType = 'SET' | 'UPDATE' | 'DELETE' | 'MERGE' | 'ROLLBACK' | 'RETRY' | 'CONFLICT' | 'VALIDATION_FAILED';

/**
 * Get YPP audit service instance
 */
export async function getYPPAuditService() {
    return getAuditTrailService();
}

/**
 * Log YPP event with audit trail
 */
export async function logYPPEvent(
    eventType: string,
    key: string,
    data: any
): Promise<void> {
    const auditService = await getYPPAuditService();
    auditService.logEvent({
        eventType: eventType as AuditEventType,
        key: `ypp_${key}`,
        oldValue: null,
        newValue: data,
        metadata: {
            source: 'local',
            reason: `YPP operation: ${eventType}`
        },
        severity: 'info'
    });
}

/**
 * Log YPP error
 */
export function logYPPError(key: string, error: Error): void {
    const auditService = getAuditTrailService();
    auditService.logEvent({
        eventType: 'VALIDATION_FAILED',
        key: `ypp_${key}`,
        oldValue: null,
        newValue: {
            error: error.message || String(error)
        },
        severity: 'error'
    });
}

/**
 * Log YPP state change
 */
export async function logYPPStateChange(
    key: string,
    oldValue: any,
    newValue: any,
    reason?: string
): Promise<void> {
    const auditService = await getYPPAuditService();
    auditService.logEvent({
        eventType: 'UPDATE',
        key: `ypp_${key}`,
        oldValue,
        newValue,
        metadata: {
            source: 'local',
            reason
        },
        severity: 'info'
    });
}

/**
 * Log YPP operation start
 */
export function logYPPOperationStart(operation: string): void {
    logYPPEvent('OPERATION_START', operation, { operation });
}

/**
 * Log YPP operation success
 */
export function logYPPOperationSuccess(operation: string): void {
    logYPPEvent('OPERATION_SUCCESS', operation, { operation });
}

/**
 * Log YPP operation failure
 */
export function logYPPOperationFailure(operation: string, error: Error): void {
    logYPPError(operation, error);
}

export default {
    getYPPAuditService,
    logYPPEvent,
    logYPPError,
    logYPPStateChange,
    logYPPOperationStart,
    logYPPOperationSuccess,
    logYPPOperationFailure
};
