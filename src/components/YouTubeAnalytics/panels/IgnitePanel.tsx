import React from 'react';

export interface IgnitePanelProps {
    customQuery: string;
    setCustomQuery: (query: string) => void;
    handleCustomQuerySubmit: () => void;
    isCustomCollecting: boolean;
    askAsJson: boolean;
    setAskAsJson: (value: boolean) => void;
    customResult: any;
}

const IgnitePanel: React.FC<IgnitePanelProps> = ({
    customQuery,
    setCustomQuery,
    handleCustomQuerySubmit,
    isCustomCollecting,
    askAsJson,
    setAskAsJson,
    customResult
}) => {
    return (
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">💬 Ask a Custom Question</h2>
            <div className="flex gap-4">
                <input
                    type="text"
                    value={customQuery}
                    onChange={(e) => setCustomQuery(e.target.value)}
                    placeholder="e.g., How many likes did I get yesterday?"
                    className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomQuerySubmit()}
                />
                <button
                    onClick={handleCustomQuerySubmit}
                    disabled={isCustomCollecting || !customQuery.trim()}
                    className={`px-6 py-3 rounded-xl font-bold transition-all ${isCustomCollecting || !customQuery.trim() ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-500'}`}
                >
                    {isCustomCollecting ? 'Asking...' : 'Ask'}
                </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
                <input
                    type="checkbox"
                    id="askAsJson"
                    checked={askAsJson}
                    onChange={(e) => setAskAsJson(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-500 bg-black/20 text-purple-500 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="askAsJson" className="text-xs text-slate-400 cursor-pointer hover:text-white transition-colors select-none">
                    Request Structured Data (JSON) - Useful for charts & tables
                </label>
            </div>
            {customResult && customResult.results && customResult.results.length > 0 && (
                <div className="mt-6 bg-black/20 rounded-xl p-6 border border-white/5 animate-fade-in">
                    <div className="flex items-start gap-4">
                        <div className="bg-purple-500/20 p-2 rounded-lg"><span className="text-2xl">🤖</span></div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-400 mb-1">Q: {customResult.results[0].question}</p>
                            {customResult.results[0].success ? (
                                customResult.results[0].jsonData ? (
                                    <div className="bg-black/40 p-4 rounded-lg overflow-x-auto border border-white/5">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs text-slate-500 uppercase tracking-wider">Structured Data</span>
                                            <span className="text-xs text-green-400">JSON</span>
                                        </div>
                                        <pre className="text-xs text-green-300 font-mono whitespace-pre-wrap">{JSON.stringify(customResult.results[0].jsonData, null, 2)}</pre>
                                    </div>
                                ) : (
                                    <p className="text-white text-lg leading-relaxed whitespace-pre-wrap font-mono text-sm">{customResult.results[0].response}</p>
                                )
                            ) : <p className="text-red-400">❌ {customResult.results[0].error}</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IgnitePanel;
