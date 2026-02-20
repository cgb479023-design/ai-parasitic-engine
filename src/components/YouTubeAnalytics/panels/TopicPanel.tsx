import React from 'react';
import { SimpleBarChart } from '../charts/SimpleBarChart';
import { parseChartData } from '../utils/chartParsers';

export interface TopicPanelProps {
    categories: any[];
    handleCollectCategory: (categoryId: string) => void;
    analyticsData: any;
}

const TopicPanel: React.FC<TopicPanelProps> = ({
    categories,
    handleCollectCategory,
    analyticsData
}) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {categories.map(category => (
                <div key={category.id} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all cursor-pointer" onClick={() => handleCollectCategory(category.id)}>
                    <div className="flex items-center gap-3 mb-4"><span className="text-4xl">{category.icon}</span><h3 className="text-lg font-bold text-white">{category.name}</h3></div>
                    {analyticsData && analyticsData[category.id] && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                            <p className="text-sm text-slate-400 mb-2">✅ {analyticsData[category.id].successCount} / {analyticsData[category.id].totalCount} questions answered</p>
                            {analyticsData[category.id].results && analyticsData[category.id].results[0] && (
                                <>
                                    <div className="flex justify-between items-center mb-1 px-1">
                                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                                            Last Updated: {new Date(analyticsData[category.id].results[0].timestamp || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="bg-black/20 p-3 rounded text-xs text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono border border-white/5">
                                        {analyticsData[category.id].results[0].response || <span className="text-red-400">⚠️ {analyticsData[category.id].results[0].error || 'No response data'}</span>}
                                    </div>
                                    <SimpleBarChart data={parseChartData(analyticsData[category.id].results[0].response)} />
                                </>
                            )}
                        </div>
                    )}
                    <button className="mt-4 w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold text-white transition-colors">Collect {category.name}</button>
                </div>
            ))}
        </div>
    );
};

export default TopicPanel;
