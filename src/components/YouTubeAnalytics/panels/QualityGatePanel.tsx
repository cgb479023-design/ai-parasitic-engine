/**
 * QualityGatePanel Component
 * Migrated from components/YouTubeAnalytics/plan/QualityGatePanel.tsx
 * 
 * Provides UI for:
 * - Solution 1: Post-generation quality check
 * - Solution 2: Real performance tracking display
 * - Solution 3: Diversity validation
 * - Solution 4: A/B testing batch management
 */

import React, { useState, useMemo } from 'react';

// Inline types since PlanItemType/QualityCheckType not yet in src/types
interface QualityCheckType {
    firstFrameHookStrength: number;
    visualClarity: number;
    textOverlayVisible: boolean;
    loopSeamless: boolean;
    audioPresent: boolean;
    overallPassFail: 'PASS' | 'FAIL' | 'REQUEUE';
    reviewedAt?: string;
}

interface PlanItemType {
    id: string;
    title: string;
    publishTimeLocal?: string;
    status?: string;
    videoData?: any;
    qualityCheck?: QualityCheckType;
    actualPerformance?: { views1h?: number; views24h?: number };
    predictionAccuracy?: number;
}

interface QualityGatePanelProps {
    schedule: PlanItemType[];
    onUpdateItem: (id: string, updates: Partial<PlanItemType>) => void;
    onRequeue: (item: PlanItemType) => void;
}

interface DiversityResult {
    score: number;
    violations: string[];
    firstWordCounts: Record<string, number>;
    themeCounts: Record<string, number>;
}

const checkDiversity = (schedule: PlanItemType[]): DiversityResult => {
    const violations: string[] = [];
    const firstWordCounts: Record<string, number> = {};
    const themeCounts: Record<string, number> = {};

    schedule.forEach(item => {
        const firstWord = item.title.split(' ')[0].replace(/[^\w\u4e00-\u9fa5]/g, '').toUpperCase();
        firstWordCounts[firstWord] = (firstWordCounts[firstWord] || 0) + 1;

        const lowerTitle = item.title.toLowerCase();
        let theme = 'Other';
        if (lowerTitle.includes('karen')) theme = 'Karen';
        else if (lowerTitle.includes('cat') || lowerTitle.includes('🐱')) theme = 'Cat';
        else if (lowerTitle.includes('dog') || lowerTitle.includes('🐕')) theme = 'Dog';
        else if (lowerTitle.includes('hack') || lowerTitle.includes('forensic')) theme = 'Tech';
        else if (lowerTitle.includes('scam')) theme = 'Scammer';

        themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    });

    Object.entries(firstWordCounts).forEach(([word, count]) => {
        if (count > 2) violations.push(`❌ "${word}" 使用了 ${count} 次 (最多2次)`);
    });

    Object.entries(themeCounts).forEach(([theme, count]) => {
        if (count > 2) violations.push(`⚠️ "${theme}" 主题使用了 ${count} 次 (建议最多2次)`);
    });

    const uniqueFirstWords = Object.keys(firstWordCounts).length;
    const uniqueThemes = Object.keys(themeCounts).length;
    const score = Math.min(100, Math.round(
        (uniqueFirstWords / schedule.length) * 50 +
        (uniqueThemes / 4) * 50
    ));

    return { score, violations, firstWordCounts, themeCounts };
};

/** Quality Rating sub-component */
const QualityRating: React.FC<{
    label: string;
    value: number;
    onChange: (value: number) => void;
}> = ({ label, value, onChange }) => (
    <div className="text-center">
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        <div className="flex justify-center gap-0.5">
            {[1, 2, 3, 4, 5].map(v => (
                <button
                    key={v}
                    onClick={() => onChange(v)}
                    className={`w-5 h-5 rounded text-xs ${v <= value ? 'bg-yellow-500 text-white' : 'bg-slate-600 text-slate-400'}`}
                >
                    ★
                </button>
            ))}
        </div>
    </div>
);

/** Quality Checkbox sub-component */
const QualityCheckbox: React.FC<{
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => (
    <div className="text-center">
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        <button
            onClick={() => onChange(!checked)}
            className={`w-8 h-8 rounded flex items-center justify-center ${checked ? 'bg-green-500 text-white' : 'bg-slate-600 text-slate-400'}`}
        >
            {checked ? '✓' : '✗'}
        </button>
    </div>
);

export const QualityGatePanel: React.FC<QualityGatePanelProps> = ({
    schedule,
    onUpdateItem,
    onRequeue
}) => {
    const [activeTab, setActiveTab] = useState<'quality' | 'diversity' | 'abtest'>('quality');

    const diversityResult = useMemo(() => checkDiversity(schedule), [schedule]);

    const pendingQualityCheck = schedule.filter(
        item => item.status === 'quality_check' || (item.videoData && !item.qualityCheck)
    );

    const itemsWithPerformance = schedule.filter(item => item.actualPerformance);

    const handleQualityCheck = (itemId: string, result: QualityCheckType) => {
        onUpdateItem(itemId, {
            qualityCheck: { ...result, reviewedAt: new Date().toISOString() },
            status: result.overallPassFail === 'PASS' ? 'uploading' :
                result.overallPassFail === 'REQUEUE' ? 'pending' : 'failed'
        });
    };

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            {/* Tab Navigation */}
            <div className="flex gap-2 mb-4">
                <button onClick={() => setActiveTab('quality')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'quality' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                    🔍 质量检查
                    {pendingQualityCheck.length > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-red-500 rounded-full text-xs">{pendingQualityCheck.length}</span>
                    )}
                </button>
                <button onClick={() => setActiveTab('diversity')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'diversity' ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                    🎨 多样性检查
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${diversityResult.score >= 80 ? 'bg-green-500' : diversityResult.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                        {diversityResult.score}%
                    </span>
                </button>
                <button onClick={() => setActiveTab('abtest')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'abtest' ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                    📊 A/B 测试
                </button>
            </div>

            {/* Quality Check Tab */}
            {activeTab === 'quality' && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        🔍 生成后质量检查
                        <span className="text-sm text-slate-400 font-normal">(Solution 1: Quality Gate)</span>
                    </h3>
                    {pendingQualityCheck.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">✅ 没有待审核的视频</div>
                    ) : (
                        <div className="space-y-3">
                            {pendingQualityCheck.map(item => (
                                <div key={item.id} className="bg-slate-700/50 rounded-lg p-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-medium text-white">{item.title}</h4>
                                            <p className="text-sm text-slate-400">{item.publishTimeLocal}</p>
                                        </div>
                                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-xs">待审核</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                                        <QualityRating label="首帧钩子" value={3} onChange={() => { }} />
                                        <QualityRating label="画面清晰度" value={3} onChange={() => { }} />
                                        <QualityCheckbox label="文字可见" checked={true} onChange={() => { }} />
                                        <QualityCheckbox label="循环流畅" checked={true} onChange={() => { }} />
                                        <QualityCheckbox label="有音频" checked={true} onChange={() => { }} />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleQualityCheck(item.id, {
                                            firstFrameHookStrength: 4, visualClarity: 4,
                                            textOverlayVisible: true, loopSeamless: true,
                                            audioPresent: true, overallPassFail: 'PASS'
                                        })} className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-sm">
                                            ✅ 通过
                                        </button>
                                        <button onClick={() => onRequeue(item)}
                                            className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-sm">
                                            🔄 重新生成
                                        </button>
                                        <button onClick={() => handleQualityCheck(item.id, {
                                            firstFrameHookStrength: 2, visualClarity: 2,
                                            textOverlayVisible: false, loopSeamless: false,
                                            audioPresent: false, overallPassFail: 'FAIL'
                                        })} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded text-sm">
                                            ❌ 拒绝
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Real Performance Section */}
                    {itemsWithPerformance.length > 0 && (
                        <div className="mt-6">
                            <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
                                📈 真实表现数据
                                <span className="text-sm text-slate-400 font-normal">(Solution 2: Feedback Loop)</span>
                            </h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-slate-400 border-b border-slate-700">
                                            <th className="text-left py-2">标题</th>
                                            <th className="text-right py-2">1h</th>
                                            <th className="text-right py-2">24h</th>
                                            <th className="text-right py-2">预测准确度</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {itemsWithPerformance.map(item => (
                                            <tr key={item.id} className="border-b border-slate-700/50">
                                                <td className="py-2 text-white">{item.title.substring(0, 30)}...</td>
                                                <td className="py-2 text-right text-slate-300">{item.actualPerformance?.views1h || '-'}</td>
                                                <td className="py-2 text-right text-slate-300">{item.actualPerformance?.views24h || '-'}</td>
                                                <td className="py-2 text-right">
                                                    <span className={`px-2 py-0.5 rounded text-xs ${(item.predictionAccuracy || 0) >= 70 ? 'bg-green-500/20 text-green-300' :
                                                        (item.predictionAccuracy || 0) >= 40 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'}`}>
                                                        {item.predictionAccuracy || 0}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Diversity Check Tab */}
            {activeTab === 'diversity' && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        🎨 标题/主题多样性检查
                        <span className="text-sm text-slate-400 font-normal">(Solution 3: Diversity Enforcement)</span>
                    </h3>
                    <div className="flex items-center gap-4 p-4 bg-slate-700/50 rounded-lg">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold ${diversityResult.score >= 80 ? 'bg-green-500/20 text-green-400' :
                            diversityResult.score >= 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                            {diversityResult.score}
                        </div>
                        <div>
                            <p className="text-white font-medium">
                                多样性评分: {diversityResult.score >= 80 ? '✅ 优秀' : diversityResult.score >= 50 ? '⚠️ 一般' : '❌ 需改进'}
                            </p>
                            <p className="text-sm text-slate-400">
                                {Object.keys(diversityResult.firstWordCounts).length} 种开头词 |
                                {Object.keys(diversityResult.themeCounts).length} 种主题
                            </p>
                        </div>
                    </div>
                    {diversityResult.violations.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                            <h4 className="text-red-400 font-medium mb-2">发现问题:</h4>
                            <ul className="space-y-1">
                                {diversityResult.violations.map((v, i) => (
                                    <li key={i} className="text-sm text-red-300">{v}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-700/50 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-slate-300 mb-2">开头词分布</h4>
                            {Object.entries(diversityResult.firstWordCounts).map(([word, count]) => (
                                <div key={word} className="flex items-center gap-2 mb-1">
                                    <span className="text-xs text-slate-400 w-20 truncate">{word}</span>
                                    <div className="flex-1 bg-slate-600 rounded h-2">
                                        <div className={`h-2 rounded ${count > 2 ? 'bg-red-500' : 'bg-blue-500'}`}
                                            style={{ width: `${(count / schedule.length) * 100}%` }} />
                                    </div>
                                    <span className="text-xs text-slate-400">{count}</span>
                                </div>
                            ))}
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-slate-300 mb-2">主题分布</h4>
                            {Object.entries(diversityResult.themeCounts).map(([theme, count]) => (
                                <div key={theme} className="flex items-center gap-2 mb-1">
                                    <span className="text-xs text-slate-400 w-20">{theme}</span>
                                    <div className="flex-1 bg-slate-600 rounded h-2">
                                        <div className={`h-2 rounded ${count > 2 ? 'bg-red-500' : 'bg-purple-500'}`}
                                            style={{ width: `${(count / schedule.length) * 100}%` }} />
                                    </div>
                                    <span className="text-xs text-slate-400">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* A/B Testing Tab */}
            {activeTab === 'abtest' && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        📊 A/B 测试批次管理
                        <span className="text-sm text-slate-400 font-normal">(Solution 4: Smart Publishing)</span>
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                        {[1, 2, 3].map(batchNum => {
                            const batchItems = schedule.filter((_, i) => Math.floor(i / 2) + 1 === batchNum).slice(0, 2);
                            return (
                                <div key={batchNum} className="bg-slate-700/50 rounded-lg p-4">
                                    <h4 className="font-medium text-white mb-2">
                                        批次 {batchNum}: {batchNum === 1 ? '🌅 早间' : batchNum === 2 ? '☀️ 下午' : '🌙 晚间'}
                                    </h4>
                                    <div className="space-y-2">
                                        {batchItems.map((item, i) => (
                                            <div key={item.id} className={`p-2 rounded text-sm ${i === 0 ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-green-500/20 border border-green-500/30'}`}>
                                                <span className="text-xs text-slate-400">{i === 0 ? '🅰️ 测试组' : '🅱️ 对照组'}</span>
                                                <p className="text-white truncate">{item.title}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {batchNum < 3 && <p className="text-xs text-slate-400 mt-2">⏳ 发布后等待2小时观察表现</p>}
                                </div>
                            );
                        })}
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <h4 className="text-blue-400 font-medium mb-2">📋 A/B 测试策略</h4>
                        <ul className="text-sm text-blue-300 space-y-1">
                            <li>• 每批次发布 2 个不同主题的视频</li>
                            <li>• 等待 2 小时观察 1 小时播放量</li>
                            <li>• 下一批次复制表现好的主题风格</li>
                            <li>• 如果 1h views &lt; 50，该主题为失败</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QualityGatePanel;
export type { QualityGatePanelProps, PlanItemType, QualityCheckType };
