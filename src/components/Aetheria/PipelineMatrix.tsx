// h:\AI_Neural_Engine_Clean_v3.5\src\components\Aetheria\PipelineMatrix.tsx
import React from 'react';
import { Intent } from '../../core/IntentStream';

// 定义我们流水线的核心阶段，严格映射后端的 SQLite 状态机
const PIPELINE_STAGES = [
    { key: 'pending', label: '⏳ 队列中' },
    { key: 'scraping', label: '🧬 提取基因' },
    { key: 'mutating', label: '🧠 变异重组' },
    { key: 'muxing', label: '🎬 硬核合成' },
    { key: 'uploading', label: '🛡️ 自愈上传' },
    { key: 'completed', label: '✅ 驻扎完毕' }
];

interface PipelineMatrixProps {
    intents: Intent[];
}

export default function PipelineMatrix({ intents }: PipelineMatrixProps) {
    // 过滤出正在处理或刚刚完成的任务（排除太老的历史记录）
    const activeIntents = (intents || [])
        .filter(intent => intent.status !== 'archived')
        .slice(0, 5); // 展示最近5个最高频任务

    // 辅助函数：判断当前阶段的 UI 状态
    const getStageStatus = (currentStatus: string, stageKey: string) => {
        const statuses = PIPELINE_STAGES.map(s => s.key);
        // 映射前端的 proposed 状态到 pending
        const normalizedStatus = currentStatus === 'proposed' ? 'pending' : currentStatus;

        const currentIndex = statuses.indexOf(normalizedStatus);
        const stageIndex = statuses.indexOf(stageKey);

        if (stageIndex < currentIndex && currentIndex !== -1) return 'completed'; // 已经跑完的阶段
        if (stageIndex === currentIndex) return 'active';  // 正在疯狂运转的阶段
        return 'waiting';                                  // 还没轮到的阶段
    };

    return (
        <div className="bg-[#121212] border border-[#333] rounded-xl p-6 shadow-2xl h-full flex flex-col font-sans">
            <h2 className="border-b border-[#333] pb-4 mb-6 flex justify-between items-center">
                <span className="text-white font-bold tracking-tight text-lg flex items-center gap-2">
                    <span className="p-1.5 bg-yellow-500/10 rounded-lg text-yellow-500">🏭</span>
                    DFL 绞肉机状态流 (Pipeline Matrix)
                </span>
                <span className="text-[10px] text-[#00ff00] font-mono flex items-center gap-2 uppercase">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    引擎在线 (轮询同步中)
                </span>
            </h2>

            <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar pr-2">
                {activeIntents.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-20">
                        <div className="text-6xl mb-4 grayscale">⚙️</div>
                        <div className="text-xl font-bold uppercase tracking-[0.2em] text-[#666]">流水线空闲</div>
                        <div className="text-xs text-[#444]">等待雷达投喂目标...</div>
                    </div>
                ) : (
                    activeIntents.map((intent) => (
                        <div key={intent.id} className="bg-[#1e1e1e] border border-[#333] rounded-lg p-5 hover:border-[#444] transition-all shadow-inner relative group">
                            {/* 任务头部信息 */}
                            <div className="flex justify-between items-start mb-6">
                                <div className="max-w-[75%]">
                                    <div className="text-[9px] font-mono text-gray-500 mb-1 uppercase tracking-widest flex items-center gap-2">
                                        <span className="text-yellow-500/50">TARGET:</span>
                                        {intent.payload.videoId || 'SCRATCH_TRIGGER'}
                                    </div>
                                    <strong className="text-sm text-gray-100 truncate block font-medium group-hover:text-white transition-colors">
                                        {intent.payload.originalTitle || 'AUTO_NINJA_MISSION'}
                                    </strong>
                                </div>
                                <span className="text-[9px] text-gray-500 font-mono bg-black/50 px-2 py-1 rounded border border-[#333]">
                                    ID: {intent.id.split('_').pop()?.substring(0, 6)}
                                </span>
                            </div>

                            {/* 核心流水线进度条 */}
                            <div className="flex justify-between relative px-2">
                                {/* 背景连接线 */}
                                <div className="absolute top-[14px] left-[8%] right-[8%] h-[1px] bg-[#333] z-0" />

                                {PIPELINE_STAGES.map((stage) => {
                                    const status = getStageStatus(intent.status, stage.key);
                                    let nodeClass = 'border-[#333] bg-[#1a1a1a]';
                                    let textClass = 'text-gray-600';
                                    let glow = '';

                                    if (status === 'completed') {
                                        nodeClass = 'border-[#00ff00] bg-[#00ff00]/5';
                                        textClass = 'text-gray-400';
                                    } else if (status === 'active') {
                                        nodeClass = 'border-[#ffaa00] bg-[#ffaa00]/10 scale-110';
                                        textClass = 'text-[#ffaa00] font-bold';
                                        glow = 'shadow-[0_0_15px_rgba(255,170,0,0.4)]';
                                    }

                                    return (
                                        <div key={stage.key} className="flex flex-col items-center z-10 w-20">
                                            {/* 状态节点 */}
                                            <div className={`w-7 h-7 rounded-full border-2 ${nodeClass} ${glow} mb-2 transition-all duration-700 flex items-center justify-center text-[10px]`}>
                                                {status === 'completed' && <span className="text-[#00ff00]">✓</span>}
                                                {status === 'active' && <span className="animate-spin duration-[3000ms]">⚡</span>}
                                                {status === 'waiting' && <span className="w-1 h-1 bg-[#444] rounded-full"></span>}
                                            </div>
                                            {/* 状态文字 */}
                                            <span className={`text-[8px] ${textClass} text-center leading-tight tracking-tighter uppercase font-mono h-8 flex items-center transition-colors duration-500`}>
                                                {stage.label.split(' ').pop()}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* 错误自愈提示 */}
                            {intent.status === 'failed' && (
                                <div className="mt-4 p-2 bg-red-900/10 border-l border-red-500 text-red-400 text-[9px] font-mono flex items-center gap-2">
                                    <span className="animate-pulse">⚠</span>
                                    <span>FATAL_ERR: {intent.error || 'Automation Interrupt'} | Awaiting EvoMap Patch...</span>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="mt-6 p-4 bg-[#0a0a0a] rounded-lg border border-[#222] flex items-center justify-between overflow-hidden">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full border border-[#333] flex items-center justify-center relative bg-black">
                        <div className="absolute inset-0 rounded-full border-t-2 border-yellow-500/50 animate-spin"></div>
                        <span className="text-[9px] font-bold text-gray-500">CORE</span>
                    </div>
                    <div>
                        <div className="text-[9px] text-gray-600 uppercase">Industrial Load</div>
                        <div className="text-[10px] font-mono text-[#00ff9d]">THROUGHPUT: 1.2 GB/s</div>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="text-right">
                        <div className="text-[9px] text-gray-600 uppercase">Mission Velocity</div>
                        <div className="text-[10px] font-mono text-white">4.2 Ops/min</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[9px] text-gray-600 uppercase">Uptime</div>
                        <div className="text-[10px] font-mono text-white">72:14:03</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
