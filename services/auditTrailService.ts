/**
 * Audit Trail Service
 *
 * Comprehensive state change logging with user tracking,
 * data integrity verification, and audit trail export.
 *
 * @module services/auditTrailService
 * @version 1.0.0
 * @date 2026-01-12
 */

// ═══════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════

export interface AuditEvent {
    id: string;
    eventType: 'SET' | 'UPDATE' | 'DELETE' | 'MERGE' | 'ROLLBACK' | 'RETRY' | 'CONFLICT' | 'VALIDATION_FAILED';
    key: string;
    timestamp: number;
    userId: string | null;
    oldValue: any;
    newValue: any;
    metadata?: {
        source?: 'local' | 'remote' | 'server';
        reason?: string;
        version?: number;
        checksum?: string;
        conflictStrategy?: string;
    };
    severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface AuditFilter {
    eventTypes?: AuditEvent['eventType'][];
    keys?: string[];
    severity?: AuditEvent['severity'];
    startTime?: number;
    endTime?: number;
    userId?: string;
}

export interface AuditStats {
    totalEvents: number;
    eventsByType: Record<AuditEvent['eventType'], number>;
    eventsBySeverity: Record<AuditEvent['severity'], number>;
    eventsByKey: Record<string, number>;
    timeRange: {
        start: number;
        end: number;
    };
}

export interface AuditExport {
    events: AuditEvent[];
    stats: AuditStats;
    exportedAt: number;
}

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════

const AUDIT_CONFIG = {
    STORAGE_KEY: 'audit_trail',
    MAX_EVENTS: 1000,
    RETENTION_DAYS: 30,
    AUTO_EXPORT_ON_THRESHOLD: 0.9, // Export when storage is 90% full
};

const EVENT_SEVERITY_WEIGHTS = {
    info: 1,
    warning: 3,
    error: 5,
    critical: 10
} as const;

// ═══════════════════════════════════════════════════════════
// AUDIT TRAIL SERVICE CLASS
// ═════════════════════════════════════════════════════════════

export class AuditTrailService {
    private events: AuditEvent[] = [];
    private currentSessionId: string;
    private sessionStart: number;

    constructor() {
        this.currentSessionId = this.generateSessionId();
        this.sessionStart = Date.now();
        this.loadFromStorage();
        console.log(`📝 [AuditTrail] Initialized. Session: ${this.currentSessionId}`);
    }

    /**
     * Generate unique session ID
     */
    private generateSessionId(): string {
        return `audit_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    }

    /**
     * Log an audit event
     */
    logEvent(event: Partial<Omit<AuditEvent, 'id'>>): void {
        const auditEvent: AuditEvent = {
            id: `${this.currentSessionId}_${Date.now()}_${Math.random().toString(36).substring(2)}`,
            timestamp: Date.now(),
            userId: event.userId || this.getCurrentUserId(),
            ...event
        } as AuditEvent;

        this.events.push(auditEvent);
        this.pruneOldEvents();

        // Persist to storage
        this.saveToStorage();

        // Console log with severity
        const severityPrefix = this.getSeverityPrefix(auditEvent.severity);
        console.log(`📝 [AuditTrail] ${severityPrefix}[${auditEvent.eventType}] ${auditEvent.key}`, auditEvent);
    }

    /**
     * Log multiple events
     */
    logEvents(events: Omit<AuditEvent, 'id'>[]): void {
        events.forEach(event => this.logEvent(event));
    }

    /**
     * Get severity prefix for logging
     */
    private getSeverityPrefix(severity: AuditEvent['severity']): string {
        switch (severity) {
            case 'info': return '📋';
            case 'warning': return '⚠️';
            case 'error': return '❌';
            case 'critical': return '🔴';
        }
    }

    /**
     * Get current user ID (from localStorage or session)
     */
    private getCurrentUserId(): string {
        const stored = localStorage.getItem('currentUserId');
        if (stored) return stored;

        // Generate session-based ID if no user ID
        return `session_${this.currentSessionId}`;
    }

    /**
     * Get filtered audit events
     */
    getEvents(filter?: AuditFilter): AuditEvent[] {
        let filtered = this.events;

        if (filter) {
            if (filter.eventTypes) {
                filtered = filtered.filter(e => filter.eventTypes!.includes(e.eventType));
            }

            if (filter.keys && filter.keys.length > 0) {
                filtered = filtered.filter(e => filter.keys.includes(e.key));
            }

            if (filter.severity) {
                filtered = filtered.filter(e => e.severity === filter.severity);
            }

            if (filter.startTime || filter.endTime) {
                const start = filter.startTime || 0;
                const end = filter.endTime || Date.now();
                filtered = filtered.filter(e => e.timestamp >= start && e.timestamp <= end);
            }

            if (filter.userId) {
                filtered = filtered.filter(e => e.userId === filter.userId);
            }
        }

        // Sort by timestamp (newest first)
        return filtered.sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * Get audit statistics
     */
    getStats(filter?: AuditFilter): AuditStats {
        const filtered = this.getEvents(filter);

        const eventsByType: Record<AuditEvent['eventType'], number> = {} as any;
        const eventsBySeverity: Record<AuditEvent['severity'], number> = {} as any;
        const eventsByKey: Record<string, number> = {} as any;

        filtered.forEach(event => {
            eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
            eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
            eventsByKey[event.key] = (eventsByKey[event.key] || 0) + 1;
        });

        const timeRange = {
            start: filtered.length > 0 ? filtered[filtered.length - 1].timestamp : Date.now(),
            end: filtered.length > 0 ? filtered[0].timestamp : Date.now()
        };

        return {
            totalEvents: filtered.length,
            eventsByType,
            eventsBySeverity,
            eventsByKey,
            timeRange
        };
    }

    /**
     * Clear audit trail
     */
    clear(): void {
        this.events = [];
        this.saveToStorage();
        console.log('🗑️ [AuditTrail] Audit trail cleared');
    }

    /**
     * Export audit trail as JSON
     */
    exportAudit(filter?: AuditFilter): AuditExport {
        const filtered = this.getEvents(filter);
        const stats = this.getStats(filter);

        const exportData: AuditExport = {
            events: filtered,
            stats,
            exportedAt: Date.now()
        };

        console.log(`📤 [AuditTrail] Exported ${filtered.length} events`);
        return exportData;
    }

    /**
     * Prune old events when exceeding max limit
     */
    private pruneOldEvents(): void {
        if (this.events.length > AUDIT_CONFIG.MAX_EVENTS) {
            const removedCount = this.events.length - AUDIT_CONFIG.MAX_EVENTS;
            this.events = this.events.slice(-AUDIT_CONFIG.MAX_EVENTS);

            console.warn(`⚠️ [AuditTrail] Pruned ${removedCount} old events to maintain limit of ${AUDIT_CONFIG.MAX_EVENTS}`);
        }
    }

    /**
     * Save audit events to localStorage
     */
    private saveToStorage(): void {
        try {
            const serialized = JSON.stringify(this.events);
            localStorage.setItem(AUDIT_CONFIG.STORAGE_KEY, serialized);

            // Check storage usage
            const usage = JSON.stringify(serialized).length;
            const maxStorage = 5 * 1024 * 1024; // 5MB
            const percentage = (usage / maxStorage) * 100;

            if (percentage > AUDIT_CONFIG.AUTO_EXPORT_ON_THRESHOLD) {
                console.warn(`⚠️ [AuditTrail] Storage usage at ${percentage.toFixed(1)}%, consider exporting audit trail`);
            }
        } catch (e) {
            console.error('❌ [AuditTrail] Failed to save audit trail:', e);
        }
    }

    /**
     * Load audit events from storage on initialization
     */
    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem(AUDIT_CONFIG.STORAGE_KEY);
            if (stored) {
                this.events = JSON.parse(stored);
                console.log(`📂 [AuditTrail] Loaded ${this.events.length} events from storage`);
            } else {
                console.log('📂 [AuditTrail] No audit trail found, starting fresh');
            }
        } catch (e) {
            console.warn('⚠️ [AuditTrail] Failed to load audit trail:', e);
        }
    }

    /**
     * Get current session info
     */
    getSessionInfo(): { sessionId: string; start: number; eventCount: number } {
        return {
            sessionId: this.currentSessionId,
            start: this.sessionStart,
            eventCount: this.events.length
        };
    }

    /**
     * Reset current session
     */
    resetSession(): void {
        this.currentSessionId = this.generateSessionId();
        this.sessionStart = Date.now();
        console.log(`🔄 [AuditTrail] Session reset: ${this.currentSessionId}`);
    }
}

// ═════════════════════════════════════════════════════════════════
// GLOBAL AUDIT TRAIL INSTANCE
// ═══════════════════════════════════════════════════════════════

let globalAuditTrailService: AuditTrailService | null = null;

/**
 * Initialize global audit trail service
 */
export function initializeAuditTrail(): AuditTrailService {
    if (globalAuditTrailService) {
        console.warn('⚠️ [AuditTrail] Already initialized, returning existing instance');
        return globalAuditTrailService;
    }

    globalAuditTrailService = new AuditTrailService();
    return globalAuditTrailService;
}

/**
 * Get global audit trail service instance
 */
export function getAuditTrailService(): AuditTrailService | null {
    return globalAuditTrailService || null;
}

/**
 * Destroy global audit trail service
 */
export function destroyAuditTrail(): void {
    if (globalAuditTrailService) {
        globalAuditTrailService.clear();
        globalAuditTrailService = null;
        console.log('🗑️ [AuditTrail] Global instance destroyed');
    }
}
