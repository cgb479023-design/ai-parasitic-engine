// 🎯 VIRAL POTENTIAL GAUGE - Semi-circle SVG with breathing animation
// Extracted from monolithic YouTubeAnalytics.tsx

import React from 'react';

interface ViralPotentialGaugeProps {
    value: number;
    label?: string;
}

const ViralPotentialGauge: React.FC<ViralPotentialGaugeProps> = ({ value, label = 'Viral Potential' }) => {
    // Clamp value between 0 and 100
    const percentage = Math.max(0, Math.min(100, value));

    // Determine color based on value
    const getColor = () => {
        if (percentage >= 70) return { fill: '#10b981', glow: 'rgba(16, 185, 129, 0.5)', label: '🚀 HIGH' };
        if (percentage >= 40) return { fill: '#f59e0b', glow: 'rgba(245, 158, 11, 0.5)', label: '⚠️ MEDIUM' };
        return { fill: '#ef4444', glow: 'rgba(239, 68, 68, 0.5)', label: '🔻 LOW' };
    };
    const colorInfo = getColor();

    // SVG arc calculation (180 degrees = semi-circle)
    const radius = 40;
    const strokeWidth = 8;
    const circumference = Math.PI * radius; // Half circle
    const progress = (percentage / 100) * circumference;

    return (
        <div className="flex flex-col items-center">
            <div className={`relative ${percentage >= 80 ? 'animate-pulse' : ''}`}>
                <svg width="100" height="60" viewBox="0 0 100 60">
                    {/* Background arc (gray) */}
                    <path
                        d="M 10 50 A 40 40 0 0 1 90 50"
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />
                    {/* Progress arc (colored) */}
                    <path
                        d="M 10 50 A 40 40 0 0 1 90 50"
                        fill="none"
                        stroke={colorInfo.fill}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={`${progress} ${circumference}`}
                        style={{
                            filter: percentage >= 80 ? `drop-shadow(0 0 8px ${colorInfo.glow})` : 'none',
                            transition: 'stroke-dasharray 0.5s ease-in-out'
                        }}
                    />
                    {/* Center value */}
                    <text x="50" y="48" textAnchor="middle" className="fill-white font-black text-lg">
                        {percentage}%
                    </text>
                </svg>
            </div>
            <div className="text-xs text-slate-400 mt-1">{label}</div>
            <div className={`text-xs font-bold mt-0.5 ${percentage >= 70 ? 'text-emerald-400' :
                percentage >= 40 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                {colorInfo.label}
            </div>
        </div>
    );
};

export default ViralPotentialGauge;
export { ViralPotentialGauge };
export type { ViralPotentialGaugeProps };
