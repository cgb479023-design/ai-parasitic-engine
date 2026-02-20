/**
 * Telegram Configuration Component (Settings Panel)
 * Migrated from components/YouTubeAnalytics/Settings/TelegramConfig.tsx
 */
import React, { useState, useEffect } from 'react';
import {
    loadTelegramConfig,
    saveTelegramConfig,
    testTelegramConnection,
    TelegramConfig as TelegramConfigType,
} from '@/services/telegramService';

interface TelegramConfigProps {
    onConfigChange?: (config: TelegramConfigType) => void;
    compact?: boolean;
}

export const TelegramConfig: React.FC<TelegramConfigProps> = ({
    onConfigChange,
    compact = false,
}) => {
    const [config, setConfig] = useState<TelegramConfigType>({
        botToken: '', chatId: '', enabled: false,
        notifyOnUpload: true, notifyOnError: true, notifyOnSchedule: false,
    });
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
    const [showToken, setShowToken] = useState(false);

    useEffect(() => { setConfig(loadTelegramConfig()); }, []);

    const updateConfig = (updates: Partial<TelegramConfigType>) => {
        const newConfig = { ...config, ...updates };
        setConfig(newConfig);
        saveTelegramConfig(newConfig);
        onConfigChange?.(newConfig);
    };

    const handleTest = async () => {
        if (!config.botToken || !config.chatId) {
            setTestResult({ success: false, error: '请填写 Bot Token 和 Chat ID' });
            return;
        }
        setTesting(true); setTestResult(null);
        const result = await testTelegramConnection(config.botToken, config.chatId);
        setTestResult(result); setTesting(false);
    };

    return (
        <div className={`bg-gray-800/50 rounded-lg p-4 ${compact ? 'text-sm' : ''}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">📱 Telegram 通知配置</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                    <span className={config.enabled ? 'text-green-400' : 'text-gray-400'}>
                        {config.enabled ? '已启用' : '已禁用'}
                    </span>
                    <div className={`relative w-12 h-6 rounded-full transition-colors ${config.enabled ? 'bg-green-600' : 'bg-gray-600'}`}
                        onClick={() => updateConfig({ enabled: !config.enabled })}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
                    </div>
                </label>
            </div>
            <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1">Bot Token</label>
                <div className="flex gap-2">
                    <input type={showToken ? 'text' : 'password'} value={config.botToken}
                        onChange={(e) => updateConfig({ botToken: e.target.value })}
                        placeholder="123456789:ABCdefGHI..."
                        className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
                    <button onClick={() => setShowToken(!showToken)} className="px-3 py-2 bg-gray-600 rounded hover:bg-gray-500">
                        {showToken ? '🙈' : '👁️'}
                    </button>
                </div>
            </div>
            <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1">Chat ID</label>
                <input type="text" value={config.chatId} onChange={(e) => updateConfig({ chatId: e.target.value })}
                    placeholder="-1001234567890"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
            </div>
            <div className="mb-4">
                <button onClick={handleTest} disabled={testing || !config.botToken || !config.chatId}
                    className={`px-4 py-2 rounded font-medium ${testing || !config.botToken || !config.chatId
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                    {testing ? '⏳ 测试中...' : '🧪 测试连接'}
                </button>
                {testResult && (
                    <span className={`ml-3 ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                        {testResult.success ? '✅ 成功!' : `❌ ${testResult.error}`}
                    </span>
                )}
            </div>
            <div className="border-t border-gray-700 pt-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3">通知选项</h4>
                <div className="space-y-2">
                    {[
                        { key: 'notifyOnUpload' as const, icon: '📹', label: '视频上传完成' },
                        { key: 'notifyOnError' as const, icon: '❌', label: '错误提醒' },
                        { key: 'notifyOnSchedule' as const, icon: '🎉', label: '定时视频发布' },
                    ].map(opt => (
                        <label key={opt.key} className="flex items-center gap-3 cursor-pointer hover:bg-gray-700/50 p-2 rounded">
                            <input type="checkbox" checked={config[opt.key]}
                                onChange={(e) => updateConfig({ [opt.key]: e.target.checked })}
                                className="w-4 h-4 rounded" />
                            <span>{opt.icon} {opt.label}</span>
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TelegramConfig;
export type { TelegramConfigProps };
