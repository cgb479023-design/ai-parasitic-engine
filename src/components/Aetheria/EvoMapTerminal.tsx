// h:\AI_Neural_Engine_Clean_v3.5\src\components\Aetheria\EvoMapTerminal.tsx
import React, { useState, useEffect, useRef } from 'react';

export default function EvoMapTerminal() {
    // 模拟一段由于 YouTube 改版引发的自愈日志流
    const [logs, setLogs] = useState<string[]>([
        "[SYSTEM] AI Neural Engine v2.0 Industrial Initialized.",
        "[EVOMAP] Node identity established. GEP-A2A protocol ready.",
        "[DPN] Throughput synchronization active."
    ]);
    const terminalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const mockLogSequence = [
            "[Uploader] Puppeteer navigating to https://studio.youtube.com...",
            "[WARN] ElementNotFound: Selector '#create-icon' failed.",
            "[HEALING] Initiating EvoMap immune response...",
            "[EVOMAP] GET https://evomap.ai/a2a/assets/search?signals=youtube,studio,selector",
            "[EVOMAP] 200 OK. Downloaded Capsule [asset_id: sha256:7f8b9a...]",
            "[HEALING] Hot-patching DOM selectors in memory...",
            "[Uploader] Patch applied. Retrying upload step (Attempt 2)...",
            "[Uploader] SUCCESS. Video successfully injected into YouTube queue.",
            "[AB_ENGINE] Syncing new variant batch (Batch_9921)...",
            "[DB] Persistence heartbeat confirmed. Mission loop active."
        ];

        let i = 0;
        const interval = setInterval(() => {
            if (i < mockLogSequence.length) {
                setLogs(prev => [...prev, mockLogSequence[i]]);
                i++;
            } else {
                clearInterval(interval);
            }
        }, 3000); // 慢速输出以确保可读性

        return () => clearInterval(interval);
    }, []);

    // 自动滚动到最底部
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="bg-[#050505] border border-[#333] rounded-xl h-[280px] flex flex-col overflow-hidden shadow-2xl font-mono">
            <div className="bg-[#111] px-4 py-2 flex justify-between items-center border-b border-[#222]">
                <span className="text-[10px] text-gray-500 font-bold tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></span>
                    🛡️ EVOMAP IMMUNE TERMINAL (GEP-A2A)
                </span>
                <span className="text-[9px] text-[#444]">PORT: 51122</span>
            </div>

            <div
                ref={terminalRef}
                className="flex-1 p-4 overflow-y-auto custom-scrollbar text-[10px] leading-relaxed space-y-1"
                style={{ scrollBehavior: 'smooth' }}
            >
                {logs.map((log, index) => {
                    let colorClass = 'text-[#00ff00]'; // 默认绿色
                    if (log.includes('[WARN]')) colorClass = 'text-yellow-500';
                    if (log.includes('[HEALING]') || log.includes('[EVOMAP]')) colorClass = 'text-cyan-400';
                    if (log.includes('SUCCESS') || log.includes('FATAL')) colorClass = 'text-red-500';
                    if (log.includes('[SYSTEM]') || log.includes('[DPN]')) colorClass = 'text-blue-400';

                    return (
                        <div key={index} className="flex gap-3">
                            <span className="text-gray-700 whitespace-nowrap">{new Date().toLocaleTimeString().split(' ')[0]}</span>
                            <span className={`${colorClass} break-all`}>{log}</span>
                        </div>
                    );
                })}
                <div className="text-[#00ff00] animate-pulse">_</div>
            </div>
        </div>
    );
}
