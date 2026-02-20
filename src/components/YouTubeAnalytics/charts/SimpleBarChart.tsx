import React from 'react';

// 📊 Simple CSS Bar Chart Component
export const SimpleBarChart = ({ data }: { data: { label: string; value: number; color?: string }[] }) => {
    if (!data || data.length === 0) return null;
    const maxValue = Math.max(...data.map(d => d.value));

    return (
        <div className="space-y-3 mt-4 bg-black/20 p-4 rounded-xl border border-white/5 animate-fade-in">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">📈 Performance Visualization</h4>
            {data.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs">
                    <div className="w-24 truncate text-slate-300 text-right" title={item.label}>{item.label}</div>
                    <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-1000 ease-out"
                            style={{
                                width: `${(item.value / maxValue) * 100}%`,
                                backgroundColor: item.color || '#8b5cf6'
                            }}
                        />
                    </div>
                    <div className="w-12 text-slate-400 font-mono">{item.value.toLocaleString()}</div>
                </div>
            ))}
        </div>
    );
};
