/**
 * Telegram Service
 * 
 * Handles Telegram Bot API integration for notifications.
 * 
 * @module services/telegramService
 * @version 1.0.0
 * @date 2026-01-04
 */

// Storage keys
const STORAGE_KEY = 'telegram_config';

/**
 * Telegram configuration
 */
export interface TelegramConfig {
    botToken: string;
    chatId: string;
    enabled: boolean;
    notifyOnUpload: boolean;
    notifyOnError: boolean;
    notifyOnSchedule: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TelegramConfig = {
    botToken: '',
    chatId: '',
    enabled: false,
    notifyOnUpload: true,
    notifyOnError: true,
    notifyOnSchedule: false,
};

/**
 * Load Telegram configuration from localStorage
 */
export const loadTelegramConfig = (): TelegramConfig => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.error('Failed to load Telegram config:', e);
    }
    return DEFAULT_CONFIG;
};

/**
 * Save Telegram configuration to localStorage
 */
export const saveTelegramConfig = (config: TelegramConfig): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        console.log('✅ [Telegram] Config saved');
    } catch (e) {
        console.error('Failed to save Telegram config:', e);
    }
};

/**
 * Send a message via Telegram Bot API
 * 
 * @param message - The message to send
 * @param config - Optional config override
 */
export const sendTelegramMessage = async (
    message: string,
    config?: Partial<TelegramConfig>
): Promise<{ success: boolean; error?: string }> => {
    const cfg = { ...loadTelegramConfig(), ...config };

    if (!cfg.enabled || !cfg.botToken || !cfg.chatId) {
        return { success: false, error: 'Telegram not configured or disabled' };
    }

    try {
        const url = `https://api.telegram.org/bot${cfg.botToken}/sendMessage`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: cfg.chatId,
                text: message,
                parse_mode: 'HTML',
            }),
        });

        const data = await response.json();

        if (data.ok) {
            console.log('✅ [Telegram] Message sent');
            return { success: true };
        } else {
            console.error('❌ [Telegram] API error:', data.description);
            return { success: false, error: data.description };
        }
    } catch (e: any) {
        console.error('❌ [Telegram] Send failed:', e);
        return { success: false, error: e.message };
    }
};

/**
 * Test Telegram connection
 */
export const testTelegramConnection = async (
    botToken: string,
    chatId: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: '🤖 <b>AI 内容创作平台</b>\n\n✅ Telegram 连接测试成功！',
                parse_mode: 'HTML',
            }),
        });

        const data = await response.json();

        if (data.ok) {
            return { success: true };
        } else {
            return { success: false, error: data.description };
        }
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

/**
 * Notification helpers
 */
export const telegramNotify = {
    /**
     * Notify on video upload complete
     */
    uploadComplete: async (title: string, url: string) => {
        const config = loadTelegramConfig();
        if (!config.notifyOnUpload) return;

        const message = `📹 <b>视频已上传</b>\n\n` +
            `标题: ${title}\n` +
            `链接: ${url}`;

        return sendTelegramMessage(message);
    },

    /**
     * Notify on error
     */
    error: async (title: string, error: string) => {
        const config = loadTelegramConfig();
        if (!config.notifyOnError) return;

        const message = `❌ <b>错误通知</b>\n\n` +
            `视频: ${title}\n` +
            `错误: ${error}`;

        return sendTelegramMessage(message);
    },

    /**
     * Notify on scheduled video going live
     */
    scheduledLive: async (title: string, url: string) => {
        const config = loadTelegramConfig();
        if (!config.notifyOnSchedule) return;

        const message = `🎉 <b>定时视频已发布</b>\n\n` +
            `标题: ${title}\n` +
            `链接: ${url}`;

        return sendTelegramMessage(message);
    },

    /**
     * Custom notification
     */
    custom: async (title: string, body: string, emoji: string = '📢') => {
        const message = `${emoji} <b>${title}</b>\n\n${body}`;
        return sendTelegramMessage(message);
    }
};

export default {
    loadConfig: loadTelegramConfig,
    saveConfig: saveTelegramConfig,
    sendMessage: sendTelegramMessage,
    testConnection: testTelegramConnection,
    notify: telegramNotify,
};
