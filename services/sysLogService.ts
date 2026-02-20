/**
 * SysLog Service
 * 
 * Lightweight singleton to manage real-time system logs.
 * Captures events from Services and the Extension Background.
 */

import { getMessageBusService } from './messageBusService';

export interface LogEntry {
    id: string;
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'success';
    source: 'UI' | 'BCK' | 'SCH' | 'EXT';
    message: string;
}

class SysLogService {
    private logs: LogEntry[] = [];
    private maxLogs = 200;
    private subscribers: ((logs: LogEntry[]) => void)[] = [];

    constructor() {
        console.log("📟 [SysLog] Service Initialized");
    }

    /**
     * Add a new log entry
     */
    log(message: string, level: LogEntry['level'] = 'info', source: LogEntry['source'] = 'UI') {
        const entry: LogEntry = {
            id: `log_${Date.now()}_${Math.random().toString(36).substring(2)}`,
            timestamp: Date.now(),
            level,
            source,
            message
        };

        this.logs = [entry, ...this.logs].slice(0, this.maxLogs);
        this.notify();

        // Broadcast via MessageBus if available
        const bus = getMessageBusService();
        if (bus) {
            bus.broadcast('SYSLOG_ENTRY', entry);
        }

        // Output to console for dev visibility
        const styles = {
            info: 'color: #94a3b8',
            warn: 'color: #fbbf24',
            error: 'color: #f87171',
            success: 'color: #34d399'
        };
        console.log(`%c[${source}] %c${message}`, 'font-weight: bold; color: #38bdf8', styles[level]);
    }

    info(msg: string, source: LogEntry['source'] = 'UI') { this.log(msg, 'info', source); }
    warn(msg: string, source: LogEntry['source'] = 'UI') { this.log(msg, 'warn', source); }
    error(msg: string, source: LogEntry['source'] = 'UI') { this.log(msg, 'error', source); }
    success(msg: string, source: LogEntry['source'] = 'UI') { this.log(msg, 'success', source); }

    /**
     * Inject a fully formed log entry (e.g. from Extension)
     */
    injectLog(entry: LogEntry) {
        // Dedup check: skip if ID already exists
        if (this.logs.some(l => l.id === entry.id)) return;

        this.logs = [entry, ...this.logs].slice(0, this.maxLogs);
        this.notify();
    }

    /**
     * Subscribe to log updates
     */
    subscribe(callback: (logs: LogEntry[]) => void) {
        this.subscribers.push(callback);
        callback(this.logs);
        return () => {
            this.subscribers = this.subscribers.filter(s => s !== callback);
        };
    }

    getLogs() {
        return this.logs;
    }

    clear() {
        this.logs = [];
        this.notify();
    }

    private notify() {
        this.subscribers.forEach(s => s(this.logs));
    }
}

// Add type definition for global window object
declare global {
    interface Window {
        __GLOBAL_SYSLOG_SERVICE__?: SysLogService;
    }
}

let globalSysLogService: SysLogService | null = null;

export function getSysLogService(): SysLogService {
    // 1. Check module-level variable
    if (globalSysLogService) return globalSysLogService;

    // 2. Check window-level variable (Cross-module persistence)
    if (window.__GLOBAL_SYSLOG_SERVICE__) {
        globalSysLogService = window.__GLOBAL_SYSLOG_SERVICE__;
        return globalSysLogService;
    }

    // 3. Create new instance and attach to window
    globalSysLogService = new SysLogService();
    window.__GLOBAL_SYSLOG_SERVICE__ = globalSysLogService;
    return globalSysLogService;
}
