// h:\AI_Neural_Engine_Clean_v3.5\src\components\Aetheria\CTRMatrix.tsx
import React from 'react';
import { Intent } from '../../core/IntentStream';

interface CTRMatrixProps {
    intents: Intent[];
}

export default function CTRMatrix({ intents }: CTRMatrixProps) {
    // 过滤出已经驻扎完毕、正在进行 A/B 测试的任务
    const liveIntents = (intents || []).filter(i =>
        i.status === 'scheduled' ||
        i.status === 'completed' ||
        i.type === 'AB_OPTIMIZATION_SYNC'
    );

    return (
        <div className="bg-[#1a1a24] border border-[#333] rounded-xl p-5 shadow-2xl h-full flex flex-col font-sans overflow-hidden">
            <h3 className="border-b border-white/5 pb-3 mb-4 text-sm font-bold text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                    <span className="text-[#ff4444]">📊</span>
                    A/B 绞肉机战报 (CTR Matrix)
                </span>
                <span className="text-[9px] font-mono text-gray-500 uppercase">Meat Grinder v2.0</span>
            </h3>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                {liveIntents.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 py-10">
                        <div className="text-4xl mb-2">📉</div>
                        <div className="text-xs text-gray-400 italic">暂无发布任务，等待流水线产出...</div>
                    </div>
                ) : (
                    liveIntents.map(intent => (
                        <div key={intent.id} className="bg-[#232333] border border-white/5 rounded-lg p-3 hover:bg-[#2a2a3d] transition-colors shadow-lg">
                            <div className="text-[9px] font-mono text-gray-500 mb-3 flex justify-between">
                                <span>靶标 ID: {intent.payload.videoId || 'UNKNOWN'}</span>
                                <span className="text-green-500">LIVE</span>
                            </div>

                            {/* Gemini AB Variants */}
                            {(intent.payload.ab_titles || [
                                { title: intent.payload.originalTitle?.substring(0, 30) + "..." || "Gemini 变异标题 A", ctr: 4.8 },
                                { title: "【反转】备用爆款基因 B (测试中)", ctr: 13.2, active: true },
                                { title: "深度猎奇：你应该知道的真相 C", ctr: 1.4 }
                            ]).map((variant, idx) => (
                                <div key={idx} className="mb-3 last:mb-0">
                                    <div className="flex justify-between items-end mb-1">
                                        <span className={`text-[10px] leading-tight max-w-[80%] ${variant.active ? 'text-green-400 font-bold' : 'text-gray-400'}`}>
                                            {variant.active ? '▶ [主攻] ' : ''}{variant.title}
                                        </span>
                                        <span className={`text-[11px] font-mono font-bold ${variant.ctr > 10 ? 'text-red-500 animate-pulse' : 'text-gray-300'}`}>
                                            {variant.ctr}%
                                        </span>
                                    </div>
                                    {/* Cyberpunk Progress Bar */}
                                    <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                        <div
                                            className={`h-full transition-all duration-1000 ease-out ${variant.ctr > 10 ? 'bg-gradient-to-r from-red-600 to-orange-400' :
                                                    variant.active ? 'bg-green-500' : 'bg-gray-700'
                                                }`}
                                            style={{ width: `${Math.min(variant.ctr * 5, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
