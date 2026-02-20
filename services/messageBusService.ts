/**
 * Message Bus Service (Reliable Inter-Component Communication)
 *
 * Implements publish-subscribe pattern with guaranteed delivery,
 * request-response pattern with timeout, and message acknowledgment.
 *
 * @module services/messageBusService
 * @version 1.0.0
 * @date 2026-01-12
 */

// ═════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

export interface MessagePayload<T = any> {
    id: string;
    type: string;
    payload: T;
    timestamp: number;
    source: string;
    requiresAck?: boolean;
    ttl?: number;
}

export interface MessageHandler<T = any> {
    (payload: MessagePayload<T>): void | Promise<void>;
    filter?: (payload: MessagePayload<T>) => boolean;
    priority?: number;
}

export interface MessageSubscription {
    id: string;
    messageType: string;
    handler: MessageHandler;
    filter?: (payload: MessagePayload<any>) => boolean;
    priority?: number;
    createdAt: number;
    lastAckedAt?: number | null;
    acknowledged: number;
    totalPublished: number;
}

export interface MessageBusConfig {
    maxSubscribers?: number;
    defaultMessageTTL?: number;
    ackTimeout?: number;
    enablePersistence?: boolean;
    enableBroadcasting?: boolean;
}

export interface RequestResponse<T = any> {
    requestId: string;
    response?: T;
    error?: Error;
    timeout: boolean;
    completedAt: number;
}

// ═════════════════════════════════════════════════════════
// MESSAGE TYPES
// ═══════════════════════════════════════════════════════

export const MESSAGE_TYPES = {
    STATE_SET: 'STATE_SET',
    STATE_UPDATE: 'STATE_UPDATE',
    STATE_DELETE: 'STATE_DELETE',
    STATE_GET: 'STATE_GET',
    STATE_ROLLBACK: 'STATE_ROLLBACK',
    AUDIT_LOG: 'AUDIT_LOG',
    AUDIT_GET_HISTORY: 'AUDIT_GET_HISTORY',
    AUDIT_EXPORT: 'AUDIT_EXPORT',
    RECOVERY_RETRY: 'RECOVERY_RETRY',
    RECOVERY_ROLLBACK: 'RECOVERY_ROLLBACK',
    SCHEDULED_PUBLISH_TRIGGER: 'SCHEDULED_PUBLISH_TRIGGER',
    SCHEDULED_PUBLISH_RESULT: 'SCHEDULED_PUBLISH_RESULT',
    SCHEDULED_PUBLISH_ERROR: 'SCHEDULED_PUBLISH_ERROR',
    CROSS_PLATFORM_DISTRIBUTE: 'CROSS_PLATFORM_DISTRIBUTE',
    CROSS_PLATFORM_PUBLISH_RESULT: 'CROSS_PLATFORM_PUBLISH_RESULT',
    CROSS_PLATFORM_ERROR: 'CROSS_PLATFORM_ERROR',
    PERFORMANCE_ALERT: 'PERFORMANCE_ALERT',
    PERFORMANCE_MONITOR_START: 'PERFORMANCE_MONITOR_START',
    PERFORMANCE_MONITOR_STOP: 'PERFORMANCE_MONITOR_STOP',
    ANALYTICS_RESULT: 'ANALYTICS_RESULT',
    ANALYTICS_ERROR: 'ANALYTICS_ERROR',
} as const;

// ═══════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════

const BUS_CONFIG: Required<MessageBusConfig> = {
    maxSubscribers: 100,
    defaultMessageTTL: 60000,
    ackTimeout: 5000,
    enablePersistence: true,
    enableBroadcasting: true,
};

// ═══════════════════════════════════════════════
// MESSAGE BUS CLASS
// ═══════════════════════════════════════════════

export class MessageBusService {
    private config: Required<MessageBusConfig>;
    private subscriptions: Map<string, MessageSubscription[]> = new Map();
    private pendingRequests: Map<string, {
        resolve: (response: any) => void;
        reject: (error: any) => void;
        timeout: NodeJS.Timeout | null;
    }> = new Map();
    private messageHistory: MessagePayload<any>[] = [];

    constructor(config: MessageBusConfig = {}) {
        this.config = { ...BUS_CONFIG, ...config };
        this.loadFromStorage();
        this.loadPendingRequests();
        console.log(`📨 [MessageBus] Initialized with config:`, this.config);
    }

    publish<T = any>(
        messageType: string,
        payload: T,
        options: {
            requiresAck?: boolean;
            source?: string;
            ttl?: number;
            filter?: (sub: MessageSubscription) => boolean;
        } = {}
    ): string {
        const { requiresAck = false, source = 'unknown', ttl = this.config.defaultMessageTTL } = options;

        const messageId = this.generateMessageId(messageType);

        const messagePayload: MessagePayload<T> = {
            id: messageId,
            type: messageType,
            payload,
            timestamp: Date.now(),
            source,
            requiresAck,
            ttl
        };

        this.messageHistory.push(messagePayload);
        this.pruneHistory();

        const subscribers = this.subscriptions.get(messageType) || [];
        const matchingSubscribers = options.filter
            ? subscribers.filter(sub => sub.filter ? sub.filter(messagePayload) : true)
            : subscribers;

        if (matchingSubscribers.length === 0) {
            console.log(`📨 [MessageBus] No subscribers for ${messageType}`);
        } else {
            matchingSubscribers.forEach(sub => {
                this.deliverMessage(sub, messagePayload);
            });
        }

        if (this.config.enablePersistence) {
            this.saveToStorage();
        }

        return messageId;
    }

    subscribe(
        messageType: string,
        handler: MessageHandler,
        options: {
            filter?: (payload: MessagePayload<any>) => boolean;
            priority?: number;
        } = {}
    ): () => void {
        const subscription: MessageSubscription = {
            id: this.generateMessageId(messageType),
            messageType,
            handler,
            filter: options.filter,
            priority: options.priority || 5,
            createdAt: Date.now(),
            lastAckedAt: null,
            acknowledged: 0,
            totalPublished: 0
        };

        if (!this.subscriptions.has(messageType)) {
            this.subscriptions.set(messageType, []);
        }

        const subs = this.subscriptions.get(messageType)!;
        subs.push(subscription);

        console.log(`📨 [MessageBus] Subscribed to ${messageType}`);

        return () => {
            const currentSubs = this.subscriptions.get(messageType);
            if (currentSubs) {
                const index = currentSubs.findIndex(s => s.id === subscription.id);
                if (index !== -1) {
                    currentSubs.splice(index, 1);
                }
                if (currentSubs.length === 0) {
                    this.subscriptions.delete(messageType);
                }
            }
        };
    }

    private deliverMessage(subscription: MessageSubscription, message: MessagePayload<any>): void {
        const startTime = Date.now();
        subscription.totalPublished++;

        try {
            const result = subscription.handler(message);

            if (result instanceof Promise) {
                result
                    .then(() => {
                        this.handleAck(subscription, message, true, startTime);
                    })
                    .catch(error => {
                        this.handleAck(subscription, message, false, startTime);
                        console.error(`❌ [MessageBus] Handler error for ${message.type}:`, error);
                    });
            } else {
                this.handleAck(subscription, message, true, startTime);
            }
        } catch (error) {
            console.error(`❌ [MessageBus] Error delivering message ${message.id}:`, error);
            this.handleAck(subscription, message, false, startTime);
        }
    }

    private handleAck(
        subscription: MessageSubscription,
        message: MessagePayload<any>,
        success: boolean,
        deliveryTime: number
    ): void {
        if (message.requiresAck && success) {
            subscription.acknowledged++;
            subscription.lastAckedAt = Date.now();
            console.log(`✅ [MessageBus] Message ${message.id} acknowledged for ${subscription.messageType}`);
        } else if (message.requiresAck && !success) {
            console.warn(`⚠️ [MessageBus] Message ${message.id} delivery failed for ${subscription.messageType}`);
        }
    }

    private generateMessageId(messageType: string): string {
        return `${messageType}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    }

    async request<T = any>(
        requestType: string,
        payload: T,
        timeout: number = this.config.ackTimeout
    ): Promise<RequestResponse<T>> {
        const requestId = this.generateMessageId(requestType);
        const ttl = this.config.ackTimeout;

        const messagePayload: MessagePayload<T> = {
            id: requestId,
            type: requestType,
            payload,
            timestamp: Date.now(),
            source: 'local',
            requiresAck: true,
            ttl
        };

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                console.warn(`⏰ [MessageBus] Request ${requestId} timed out`);
                if (this.pendingRequests.has(requestId)) {
                    const { reject: reqReject } = this.pendingRequests.get(requestId)!;
                    reqReject({
                        requestId,
                        error: new Error(`Request timeout after ${timeout}ms`),
                        timeout: true
                    });
                    this.pendingRequests.delete(requestId);
                }
            }, timeout);

            this.pendingRequests.set(requestId, { resolve, reject, timeout: timeoutId });

            this.publish(requestType, payload, { source: 'local' });

            this.subscribe(
                `${requestType}_RESPONSE`,
                (response: MessagePayload<RequestResponse<T>>) => {
                    if (response.payload.requestId === requestId) {
                        clearTimeout(timeoutId);
                        this.pendingRequests.delete(requestId);
                        if (response.payload.error || response.payload.timeout) {
                            reject(response.payload);
                        } else {
                            resolve(response.payload);
                        }
                    }
                },
                { priority: 10 }
            );
        });
    }

    getStats(): {
        totalSubscriptions: number;
        subscriptionsByType: Record<string, number>;
        pendingRequestsCount: number;
        messageHistorySize: number;
    } {
        const subscriptionsByType: Record<string, number> = {};
        let totalSubs = 0;

        this.subscriptions.forEach((subs, type) => {
            if (subs) {
                subscriptionsByType[type] = subs.length;
                totalSubs += subs.length;
            }
        });

        return {
            totalSubscriptions: totalSubs,
            subscriptionsByType,
            pendingRequestsCount: this.pendingRequests.size,
            messageHistorySize: this.messageHistory.length
        };
    }

    getMessageHistory(filter?: { type?: string; since?: number; limit?: number }): MessagePayload<any>[] {
        let filtered = this.messageHistory;

        if (filter?.type) {
            filtered = filtered.filter(msg => msg.type === filter.type);
        }

        if (filter?.since) {
            filtered = filtered.filter(msg => msg.timestamp >= filter.since);
        }

        if (filter?.limit) {
            filtered = filtered.slice(0, filter.limit);
        }

        return filtered.sort((a, b) => b.timestamp - a.timestamp);
    }

    clearHistory(): void {
        this.messageHistory = [];
        this.saveToStorage();
        console.log('🗑️ [MessageBus] Message history cleared');
    }

    unsubscribeAll(messageType: string): void {
        const subs = this.subscriptions.get(messageType);
        if (subs) {
            this.subscriptions.delete(messageType);
        }
    }

    broadcast<T = any>(messageType: string, payload: T): string {
        return this.publish(messageType, payload, {
            requiresAck: false,
            filter: undefined
        });
    }

    private pruneHistory(): void {
        const now = Date.now();
        const maxAge = Math.max(60000, this.config.defaultMessageTTL);
        this.messageHistory = this.messageHistory.filter(msg => {
            const age = now - msg.timestamp;
            return age <= maxAge;
        });
    }

    private saveToStorage(): void {
        try {
            const data = {
                subscriptions: Array.from(this.subscriptions.entries()).map(([type, subs]) => ({ type, subs })),
                messageHistory: this.messageHistory
            };
            localStorage.setItem('messageBus_data', JSON.stringify(data));
        } catch (e) {
            console.error('❌ [MessageBus] Failed to save to storage:', e);
        }
    }

    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem('messageBus_data');
            if (stored) {
                const data = JSON.parse(stored);
                if (data.subscriptions) {
                    data.subscriptions.forEach(({ type, subs }: { type: string; subs: MessageSubscription[] }) => {
                        this.subscriptions.set(type, subs);
                    });
                }
                if (data.messageHistory) {
                    this.messageHistory = data.messageHistory;
                }
            }
            console.log(`📨 [MessageBus] Loaded ${this.subscriptions.size} subscription types, ${this.messageHistory.length} messages`);
        } catch (e) {
            console.warn('⚠️ [MessageBus] Failed to load from storage:', e);
        }
    }

    private loadPendingRequests(): void {
        try {
            const stored = localStorage.getItem('messageBus_pending_requests');
            if (stored) {
                this.pendingRequests = new Map(JSON.parse(stored));
            }
        } catch (e) {
            console.warn('⚠️ [MessageBus] Failed to load pending requests:', e);
        }
    }

    clear(): void {
        this.subscriptions.clear();
        this.pendingRequests.clear();
        this.messageHistory = [];
        localStorage.removeItem('messageBus_data');
        localStorage.removeItem('messageBus_pending_requests');
        console.log('🗑️ [MessageBus] All data cleared');
    }

    exportState(): {
        subscriptions: Record<string, MessageSubscription[]>;
        messageHistory: MessagePayload<any>[];
        pendingRequests: string[];
        exportedAt: number;
    } {
        const subscriptions: Record<string, MessageSubscription[]> = {};
        this.subscriptions.forEach((subs, type) => {
            subscriptions[type] = subs;
        });
        return {
            subscriptions,
            messageHistory: this.messageHistory,
            pendingRequests: Array.from(this.pendingRequests.keys()),
            exportedAt: Date.now()
        };
    }
}

let globalMessageBusService: MessageBusService | null = null;

export function initializeMessageBus(config?: MessageBusConfig): MessageBusService {
    if (globalMessageBusService) {
        console.warn('⚠️ [MessageBus] Already initialized, returning existing instance');
        return globalMessageBusService;
    }
    globalMessageBusService = new MessageBusService(config);
    return globalMessageBusService;
}

export function getMessageBusService(): MessageBusService | null {
    return globalMessageBusService || null;
}

export function destroyMessageBus(): void {
    if (globalMessageBusService) {
        globalMessageBusService.clear();
        globalMessageBusService = null;
        console.log('🗑️ [MessageBus] Global instance destroyed');
    }
}
