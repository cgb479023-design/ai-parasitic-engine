// 🕐 HOURLY HEAT MAP - 24-hour visualization with peak window highlight
// Extracted from monolithic YouTubeAnalytics.tsx

import React from 'react';

interface HourlyHeatMapProps {
    optimalHours?: number[];
    peakWindow?: { start: number; end: number };
}

const HourlyHeatMap: React.FC<HourlyHeatMapProps> = ({
    optimalHours = [18, 19, 20, 21, 22],
    peakWindow = { start: 18, end: 23 }
}) => {
    // Build 24-hour array with intensity scores
    const hours = Array.from({ length: 24 }, (_, i) => {
        const isOptimal = optimalHours.includes(i);
        const isPeak = i >= peakWindow.start && i <= peakWindow.end;
        let intensity = 0;
        if (isOptimal) intensity = 3;
        else if (isPeak) intensity = 2;
        else if (i >= 12 && i <= 17) intensity = 1;

        return { hour: i, intensity, isOptimal, isPeak };
    });

    const getIntensityColor = (intensity: number, _isPeak: boolean) => {
        if (intensity === 3) return 'bg-emerald-500';
        if (intensity === 2) return 'bg-emerald-600/60';
        if (intensity === 1) return 'bg-yellow-600/30';
        return 'bg-slate-800/50';
    };

    return (
        <div className="w-full">
            <div className="text-xs text-slate-400 mb-2 flex justify-between">
                <span>📅 24-Hour Publishing Heat Map</span>
                <span className="text-emerald-400">Peak: {peakWindow.start}:00 - {peakWindow.end}:00</span>
            </div>
            <div className="flex gap-0.5">
                {hours.map(({ hour, intensity, isPeak }) => (
                    <div
                        key={hour}
                        className={`flex-1 h-6 rounded-sm transition-all ${getIntensityColor(intensity, isPeak)} ${isPeak ? 'ring-1 ring-emerald-400/50' : ''
                            }`}
                        title={`${hour}:00 - ${hour + 1}:00`}
                    />
                ))}
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>0:00</span>
                <span>6:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:00</span>
            </div>
            <div className="flex gap-3 mt-2 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500"></span> Optimal</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-600/60"></span> Peak</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-yellow-600/30"></span> Medium</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-slate-800/50"></span> Low</span>
            </div>
        </div>
    );
};

export default HourlyHeatMap;
export { HourlyHeatMap };
export type { HourlyHeatMapProps };
