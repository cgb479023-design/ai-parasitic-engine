// 📊 ANALYTICS CATEGORY CARD - Professional, algorithm-focused visualization
// Extracted from monolithic YouTubeAnalytics.tsx

import React, { useState } from 'react';
import { ANALYTICS_CATEGORIES } from '../utils/analyticsConfig';

interface AnalyticsCategoryCardProps {
    categoryKey: string;
    data: any;
    onCollect?: () => void;
    isCollecting?: boolean;
    lastUpdated?: Date;
}

const AnalyticsCategoryCard: React.FC<AnalyticsCategoryCardProps> = ({
    categoryKey,
    data,
    onCollect,
    isCollecting = false,
    lastUpdated
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const config = ANALYTICS_CATEGORIES[categoryKey];

    if (!config) {
        console.warn(`Unknown category: ${categoryKey}`);
        return null;
    }

    // Extract actual data from wrapped format
    const rawData = data?.data || data?.results?.[0]?.data || data;
    const hasData = rawData && Object.keys(rawData).length > 0;

    // Smart metric extractor - handles various data formats
    const extractMetric = (key: string): string | number | null => {
        if (!rawData) return null;

        // Direct key access
        if (rawData[key] !== undefined) return rawData[key];

        // Try common variations
        const variations = [
            key,
            key.replace(/_/g, ''),
            key.replace(/_/g, ' '),
            key.split('_').map((w: string, i: number) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('')
        ];

        for (const variant of variations) {
            if (rawData[variant] !== undefined) return rawData[variant];
        }

        // Search in nested objects
        for (const value of Object.values(rawData)) {
            if (typeof value === 'object' && value !== null) {
                const nested = (value as any)[key];
                if (nested !== undefined) return nested;
            }
        }

        return null;
    };

    // Format metric value based on type
    const formatValue = (value: any, format: string): string => {
        if (value === null || value === undefined || value === '') return '—';

        const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;

        switch (format) {
            case 'number':
                return typeof num === 'number' && !isNaN(num) ? num.toLocaleString() : String(value);
            case 'percent':
                return typeof num === 'number' && !isNaN(num) ? `${num.toFixed(1)}%` : String(value);
            case 'time':
                return String(value);
            case 'ratio':
                return typeof num === 'number' && !isNaN(num) ? `${num.toFixed(2)}x` : String(value);
            default:
                return String(value);
        }
    };

    // Determine status color based on algorithm importance
    const getStatusColor = (): { bg: string; text: string; label: string } => {
        if (!hasData) return { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'No Data' };

        // Check for algorithm-critical metrics
        const isAlgorithmPositive = categoryKey === 'velocity' || categoryKey === 'rewatch' || categoryKey === 'subsConversion';
        const isAlgorithmNegative = categoryKey === 'swipeAway';

        if (isAlgorithmPositive) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: '🚀 Active' };
        if (isAlgorithmNegative) return { bg: 'bg-red-500/20', text: 'text-red-400', label: '⚠️ Monitor' };

        return { bg: 'bg-blue-500/20', text: 'text-blue-400', label: '✓ Ready' };
    };

    const status = getStatusColor();

    // Smart data extraction for metrics display
    const extractDisplayMetrics = (): { key: string; value: string; highlight: boolean }[] => {
        const metrics: { key: string; value: string; highlight: boolean }[] = [];

        if (Array.isArray(rawData)) {
            metrics.push({ key: '📊 Total Items', value: rawData.length.toString(), highlight: true });
            if (rawData.length > 0 && typeof rawData[0] === 'object') {
                const firstItem = rawData[0];
                const valueKeys = ['views', 'title', 'video_title', 'watch_time', 'subscribers', 'likes', 'comments'];
                for (const vk of valueKeys) {
                    if (firstItem[vk] !== undefined) {
                        metrics.push({ key: `Top: ${vk.replace(/_/g, ' ')}`, value: String(firstItem[vk]).substring(0, 25), highlight: false });
                        break;
                    }
                }
            }
        } else if (typeof rawData === 'object') {
            const algorithmKeys = ['views', 'subscribers', 'watch_time', 'retention', 'velocity', 'rewatch', 'swipe', 'feed', 'likes', 'comments', 'shares', 'conversion', 'total'];
            const entries = Object.entries(rawData);

            for (const [key, value] of entries) {
                if (metrics.length >= 6) break;

                if (Array.isArray(value)) {
                    metrics.push({ key: key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim(), value: `${value.length} items`, highlight: false });
                    continue;
                }

                if (typeof value === 'object' && value !== null) {
                    const nestedValues = Object.values(value);
                    const firstPrimitive = nestedValues.find(v => typeof v !== 'object');
                    if (firstPrimitive !== undefined) {
                        metrics.push({
                            key: key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim(),
                            value: String(firstPrimitive).substring(0, 20),
                            highlight: algorithmKeys.some(ak => key.toLowerCase().includes(ak))
                        });
                    }
                    continue;
                }

                const isImportant = algorithmKeys.some(ak => key.toLowerCase().includes(ak));
                const formattedKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()
                    .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                let formattedValue = String(value);
                if (typeof value === 'number') formattedValue = value.toLocaleString();

                metrics.push({ key: formattedKey, value: formattedValue.substring(0, 25), highlight: isImportant });
            }
        }

        if (metrics.length === 0) {
            metrics.push({ key: '📊 Data', value: 'View Details ▼', highlight: false });
        }

        return metrics;
    };

    return (
        <div className={`bg-gradient-to-br ${config.bgGradient} backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/20 hover:shadow-lg`}>
            {/* Header */}
            <div className="p-4 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{config.icon}</span>
                        <h3 className={`font-bold ${config.color}`}>{config.name}</h3>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${status.bg} ${status.text}`}>
                        {status.label}
                    </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{config.description}</p>
            </div>

            {/* Algorithm Metrics */}
            <div className="p-4 space-y-2">
                {hasData ? (
                    extractDisplayMetrics().map((m, idx) => (
                        <div key={idx} className={`flex items-center justify-between ${m.highlight ? 'bg-white/5 -mx-2 px-2 py-1.5 rounded-lg' : ''}`}>
                            <span className={`text-sm truncate max-w-[55%] ${m.highlight ? 'text-white font-medium' : 'text-slate-400'}`}>
                                {m.highlight && '⚡ '}{m.key}
                            </span>
                            <span className={`font-mono text-sm truncate max-w-[40%] ${m.highlight ? 'text-white font-bold' : 'text-slate-300'}`}>
                                {m.value}
                            </span>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-4">
                        <span className="text-slate-500 text-sm">No data collected yet</span>
                    </div>
                )}
            </div>

            {/* Expandable Details */}
            {hasData && (
                <div className="border-t border-white/5">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full px-4 py-2 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1 transition-colors"
                    >
                        {isExpanded ? '▲ Hide Details' : '▼ View Details'}
                    </button>
                    {isExpanded && (
                        <div className="px-4 pb-4 animate-fade-in">
                            <div className="bg-black/30 rounded-lg p-3 max-h-48 overflow-auto text-xs font-mono text-slate-400 whitespace-pre-wrap">
                                {typeof rawData === 'object' ? JSON.stringify(rawData, null, 2) : String(rawData)}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Footer - Collect Button & Last Updated */}
            <div className="px-4 py-3 bg-black/20 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">
                    {lastUpdated ? `Updated: ${lastUpdated.toLocaleTimeString()}` : 'Not collected'}
                </span>
                <button
                    onClick={onCollect}
                    disabled={isCollecting}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${isCollecting
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                        : `bg-gradient-to-r ${config.bgGradient.replace('/20', '')} text-white hover:opacity-80`
                        }`}
                >
                    {isCollecting ? '⏳...' : `Collect ${config.icon} ${config.name.split(' ')[0]}`}
                </button>
            </div>
        </div>
    );
};

export default AnalyticsCategoryCard;
export { AnalyticsCategoryCard };
export type { AnalyticsCategoryCardProps };
