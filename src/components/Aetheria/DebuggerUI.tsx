import React, { useState, useEffect, useRef } from 'react';
import { intentStream, Intent } from '../../core/IntentStream';
import { effectLogger } from '../../core/EffectLogger';
import { Terminal, Bug, Activity, X, ChevronDown, ChevronUp } from 'lucide-react';

export const DebuggerUI: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [intents, setIntents] = useState<Intent[]>([]);
    const [activeTab, setActiveTab] = useState<'intents' | 'logs' | 'effects'>('intents');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = intentStream.subscribe((intent) => {
            setIntents(prev => [...prev.slice(-49), intent]); // Keep last 50
        });

        // Toggle with Ctrl+Alt+D
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.altKey && e.key === 'd') {
                setIsOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            unsubscribe();
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [intents]);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 z-[9999] bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all flex items-center justify-center"
                title="Open Aetheria Debugger (Ctrl+Alt+D)"
            >
                <Bug size={20} />
            </button>
        );
    }

    return (
        <div className="fixed bottom-0 right-0 w-[500px] h-[400px] z-[9999] bg-[#0c0c0c] border-l border-t border-gray-800 shadow-2xl flex flex-col font-mono text-xs overflow-hidden rounded-tl-xl animate-in slide-in-from-bottom-5">
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-[#1a1a1a] border-b border-gray-800">
                <div className="flex items-center gap-2 text-gray-300">
                    <Activity size={14} className="text-blue-500" />
                    <span className="font-bold">Aetheria-Flow Debugger</span>
                    <span className="bg-green-900/30 text-green-500 px-1.5 py-0.5 rounded text-[10px]">LIVE</span>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">
                    <X size={16} />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-[#111] border-b border-gray-800">
                <button
                    onClick={() => setActiveTab('intents')}
                    className={`px-4 py-2 ${activeTab === 'intents' ? 'bg-blue-600/20 text-blue-400 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-white/5'}`}
                >
                    INTENTS
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-4 py-2 ${activeTab === 'logs' ? 'bg-blue-600/20 text-blue-400 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-white/5'}`}
                >
                    LOGS
                </button>
            </div>

            {/* Content */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {intents
                    .filter(i => activeTab === 'intents' ? i.type !== 'DEBUG_LOG' : i.type === 'DEBUG_LOG')
                    .map((item, idx) => (
                        <div key={idx} className={`p-2 rounded border border-gray-800/50 ${item.type === 'DEBUG_LOG' ? 'bg-[#0a0a0a]' : 'bg-[#151515]'}`}>
                            <div className="flex justify-between items-start mb-1">
                                <span className={`${item.type === 'DEBUG_LOG' ? 'text-gray-500' : 'text-blue-400'} font-bold`}>
                                    {item.type}
                                </span>
                                <span className="text-[10px] text-gray-600">
                                    {new Date(item.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                            <pre className="text-gray-400 whitespace-pre-wrap break-all text-[11px]">
                                {item.type === 'DEBUG_LOG' ? item.payload.content : JSON.stringify(item.payload, null, 2)}
                            </pre>
                        </div>
                    ))}
                {intents.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-600 italic">
                        <Terminal size={32} className="mb-2 opacity-20" />
                        No events captured yet
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-2 bg-[#1a1a1a] border-t border-gray-800 text-[10px] text-gray-500 flex justify-between">
                <span>Pillar 6: Debug Bridge Active</span>
                <span>Ctrl+Alt+D to toggle</span>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #444; }
            `}</style>
        </div>
    );
};
