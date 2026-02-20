/**
 * Notification Service
 * 
 * Provides unified notification capabilities including:
 * - Console logging
 * - Telegram bot notifications
 * - Browser notifications
 * - Event logging for analytics
 * 
 * @module services/notificationService
 * @version 1.0.0
 * @date 2026-01-03
 */

/**
 * Notification types
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

/**
 * Notification event
 */
export interface NotificationEvent {
    type: NotificationType;
    title: string;
    message: string;
    timestamp: Date;
    category?: string;
    metadata?: Record<string, any>;
}

/**
 * Telegram configuration
 */
export interface TelegramConfig {
    botToken: string;
    chatId: string;
    enabled: boolean;
}

/**
 * Notification service configuration
 */
export interface NotificationServiceConfig {
    telegram?: TelegramConfig;
    browserNotifications?: boolean;
    consoleLogging?: boolean;
    eventLogging?: boolean;
    maxEventHistory?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: NotificationServiceConfig = {
    browserNotifications: true,
    consoleLogging: true,
    eventLogging: true,
    maxEventHistory: 100
};

/**
 * Event history for analytics
 */
let eventHistory: NotificationEvent[] = [];

/**
 * Current configuration
 */
let currentConfig: NotificationServiceConfig = { ...DEFAULT_CONFIG };

/**
 * Configure the notification service
 */
export function configureNotifications(config: Partial<NotificationServiceConfig>): void {
    currentConfig = { ...currentConfig, ...config };
    console.log('🔔 [Notification Service] Configuration updated');
}

/**
 * Get Telegram configuration from localStorage
 */
export function getTelegramConfig(): TelegramConfig | null {
    try {
        const saved = localStorage.getItem('telegram_config');
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error('❌ [Notification] Failed to load Telegram config:', e);
    }
    return null;
}

/**
 * Save Telegram configuration
 */
export function saveTelegramConfig(config: TelegramConfig): void {
    localStorage.setItem('telegram_config', JSON.stringify(config));
    currentConfig.telegram = config;
}

/**
 * Send Telegram message
 */
async function sendTelegramMessage(message: string): Promise<boolean> {
    const config = currentConfig.telegram || getTelegramConfig();
    if (!config?.enabled || !config.botToken || !config.chatId) {
        return false;
    }

    try {
        const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: config.chatId,
                text: message,
                parse_mode: 'HTML'
            })
        });

        if (!response.ok) {
            console.error('❌ [Telegram] Failed to send:', await response.text());
            return false;
        }

        return true;
    } catch (error) {
        console.error('❌ [Telegram] Error:', error);
        return false;
    }
}

/**
 * Request browser notification permission
 */
export async function requestBrowserNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
        console.warn('⚠️ [Notification] Browser notifications not supported');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    return false;
}

/**
 * Show browser notification
 */
function showBrowserNotification(title: string, message: string, icon?: string): void {
    if (!currentConfig.browserNotifications) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    new Notification(title, {
        body: message,
        icon: icon || '/favicon.ico',
        tag: 'ypp-notification'
    });
}

/**
 * Log to console with formatting
 */
function logToConsole(event: NotificationEvent): void {
    if (!currentConfig.consoleLogging) return;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    const colors = {
        success: 'color: #10b981',
        error: 'color: #ef4444',
        warning: 'color: #f59e0b',
        info: 'color: #3b82f6'
    };

    console.log(
        `%c${icons[event.type]} [${event.category || 'Notification'}] ${event.title}: ${event.message}`,
        colors[event.type]
    );
}

/**
 * Add event to history
 */
function addToHistory(event: NotificationEvent): void {
    if (!currentConfig.eventLogging) return;

    eventHistory.unshift(event);

    // Trim history if needed
    const maxHistory = currentConfig.maxEventHistory || 100;
    if (eventHistory.length > maxHistory) {
        eventHistory = eventHistory.slice(0, maxHistory);
    }
}

/**
 * Get event history
 */
export function getEventHistory(): NotificationEvent[] {
    return [...eventHistory];
}

/**
 * Clear event history
 */
export function clearEventHistory(): void {
    eventHistory = [];
}

/**
 * Format message for Telegram
 */
function formatTelegramMessage(event: NotificationEvent): string {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    let message = `${icons[event.type]} <b>${event.title}</b>\n`;
    message += `${event.message}\n`;
    message += `\n<i>${event.timestamp.toLocaleString()}</i>`;

    if (event.category) {
        message += `\n🏷️ ${event.category}`;
    }

    return message;
}

/**
 * Main notification function
 */
import { getSysLogService } from './sysLogService';

/**
 * Main notification function
 */
export async function notify(
    type: NotificationType,
    title: string,
    message: string,
    options: {
        category?: string;
        metadata?: Record<string, any>;
        telegram?: boolean;
        browser?: boolean;
    } = {}
): Promise<void> {
    const event: NotificationEvent = {
        type,
        title,
        message,
        timestamp: new Date(),
        category: options.category,
        metadata: options.metadata
    };

    // Console logging
    logToConsole(event);

    // Event history
    addToHistory(event);

    // 🆕 Log to SysLog Service
    try {
        const sysLog = getSysLogService();
        const sysLogLevel = type === 'error' ? 'error' : type === 'warning' ? 'warn' : type === 'success' ? 'success' : 'info';
        sysLog.log(`[${options.category || 'System'}] ${title}: ${message}`, sysLogLevel, 'UI');
    } catch (e) {
        // Fail silently to prevent notification loops
        console.warn('Failed to log to SysLog:', e);
    }

    // Browser notification
    if (options.browser !== false) {
        showBrowserNotification(title, message);
    }

    // Telegram notification (for important events)
    if (options.telegram && currentConfig.telegram?.enabled) {
        await sendTelegramMessage(formatTelegramMessage(event));
    }
}

/**
 * Convenience methods
 */
export const notifySuccess = (title: string, message: string, options = {}) =>
    notify('success', title, message, options);

export const notifyError = (title: string, message: string, options = {}) =>
    notify('error', title, message, { ...options, telegram: true });

export const notifyWarning = (title: string, message: string, options = {}) =>
    notify('warning', title, message, options);

export const notifyInfo = (title: string, message: string, options = {}) =>
    notify('info', title, message, options);

/**
 * Pre-defined notification templates
 */
export const notifications = {
    // Video notifications
    videoUploaded: (title: string) =>
        notifySuccess('Video Uploaded', `"${title}" has been uploaded successfully`, { category: 'Video' }),

    videoScheduled: (title: string, time: string) =>
        notifySuccess('Video Scheduled', `"${title}" scheduled for ${time}`, { category: 'Video' }),

    videoPublished: (title: string) =>
        notifySuccess('Video Published', `"${title}" is now live!`, { category: 'Video', telegram: true }),

    videoFailed: (title: string, error: string) =>
        notifyError('Video Failed', `"${title}" failed: ${error}`, { category: 'Video' }),

    // Comment notifications
    commentPosted: (videoTitle: string) =>
        notifySuccess('Comment Posted', `First comment posted on "${videoTitle}"`, { category: 'Comment' }),

    commentFailed: (videoTitle: string, error: string) =>
        notifyError('Comment Failed', `Failed to post comment on "${videoTitle}": ${error}`, { category: 'Comment' }),

    // Queue notifications
    queueStarted: (count: number) =>
        notifyInfo('Queue Started', `Processing ${count} video(s)`, { category: 'Queue' }),

    queueCompleted: (success: number, failed: number) =>
        notifySuccess('Queue Completed', `${success} succeeded, ${failed} failed`, { category: 'Queue', telegram: true }),

    // System notifications
    syncCompleted: (count: number) =>
        notifyInfo('Sync Completed', `Synchronized ${count} video(s)`, { category: 'System' }),

    errorOccurred: (error: string) =>
        notifyError('Error', error, { category: 'System' })
};
