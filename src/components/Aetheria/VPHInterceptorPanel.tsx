// h:\AI_Neural_Engine_Clean_v3.5\src\components\Aetheria\VPHInterceptorPanel.tsx
import React, { useState, useEffect } from 'react';

export default function VPHInterceptorPanel() {
    const [breakouts, setBreakouts] = useState<any[]>([]);
    const [loadingId, setLoadingId] = useState<string | null>(null);

    // 1. 5秒一次的强悍轮询：死死盯住后端的雷达天线
    useEffect(() => {
        const fetchRadarData = async () => {
            try {
                // Using the specific backend port from App.tsx/index.js
                const res = await fetch('http://localhost:51122/api/radar/breakouts');
                const result = await res.json();
                if (result.success) {
                    setBreakouts(result.data);
                }
            } catch (error) {
                console.error("[Radar] Signal lost:", error);
            }
        };

        fetchRadarData();
        const interval = setInterval(fetchRadarData, 5000);
        return () => clearInterval(interval);
    }, []);

    // 2. 核心交互：一键下达寄生指令！
    const handleHijack = async (video: any) => {
        setLoadingId(video.id);
        console.log(`🚀 [Interceptor] Launching Hijack Mission for: ${video.videoId}`);
        try {
            const res = await fetch('http://localhost:51122/api/trigger-parasitic-workflow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoId: video.videoId,
                    originalTitle: video.title
                })
            });
            const data = await res.json();
            if (data.success) {
                console.log(`✅ [Interceptor] Mission Ignite confirmed for: ${video.id}`);
            }
        } catch (e) {
            console.error("[Interceptor] Command ignition failure:", e);
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <div className="bg-[#121212] border border-[#333] rounded-xl overflow-hidden shadow-2xl">
            <div className="bg-[#1a1a1a] px-4 py-3 border-b border-[#333] flex items-center justify-between">
                <h3 className="text-[#00ff9d] font-bold flex items-center gap-2 tracking-wider">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    VPH SENTIMENT RADAR
                </h3>
                <span className="text-[10px] text-gray-500 font-mono uppercase">REAL-TIME INTERCEPTOR V2.0</span>
            </div>

            <div className="p-4 space-y-4 max-h-[700px] overflow-y-auto custom-scrollbar">
                {breakouts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-600 italic">
                        <div className="animate-pulse mb-2">Scanning spectrum...</div>
                        <div className="text-[10px] uppercase">No viral mutations detected</div>
                    </div>
                ) : (
                    breakouts.map((video) => (
                        <div key={video.id} className="group bg-[#1e1e1e] border border-[#222] hover:border-[#444] p-3 rounded-lg transition-all duration-300">
                            <div className="relative aspect-video rounded overflow-hidden mb-3">
                                <img src={video.thumbnail} alt="cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg animate-pulse">
                                    VPH: {video.vph}
                                </div>
                            </div>

                            <h4 className="text-sm font-medium text-gray-100 line-clamp-2 mb-2 leading-snug">{video.title}</h4>

                            <div className="flex items-center justify-between text-[11px] text-gray-500 mb-3 font-mono">
                                <div className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                    ALIVE: {video.hoursAlive}H
                                </div>
                                <div className="text-[#00ff9d] opacity-70 italic uppercase text-[9px]">Potential: High</div>
                            </div>

                            <button
                                onClick={() => handleHijack(video)}
                                disabled={loadingId === video.id}
                                className={`w-full py-2.5 px-4 rounded font-bold text-xs ${loadingId === video.id
                                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed cursor-wait'
                                        : 'bg-[#ff4444] hover:bg-[#ff2222] text-white shadow-lg active:scale-[0.98]'
                                    } transition-all flex items-center justify-center gap-2 uppercase tracking-widest`}
                            >
                                {loadingId === video.id ? (
                                    <>
                                        <span className="w-3 h-3 border-2 border-gray-500 border-t-white rounded-full animate-spin"></span>
                                        Mutating...
                                    </>
                                ) : (
                                    <>🎯 Start Hijack</>
                                )}
                            </button>
                        </div>
                    ))
                )}
            </div>

            <div className="bg-[#0a0a0a] px-3 py-2 text-[9px] font-mono text-gray-700 flex justify-between border-t border-[#222]">
                <span>ENCODING: UTF-8</span>
                <span className="animate-pulse">SIGNAL STRENGTH: 98%</span>
            </div>
        </div>
    );
}
