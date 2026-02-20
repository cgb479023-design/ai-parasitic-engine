/**
 * CalendarView Component
 * Migrated from components/YouTubeAnalytics/CalendarView/CalendarView.tsx
 * 
 * Monthly calendar for scheduled video publishing with conflict detection
 * and optimal time suggestions.
 */
import React, { useState, useMemo } from 'react';

interface ScheduleItem {
    id: string;
    title: string;
    publishTimeLocal?: string;
    status?: string;
    platform?: string;
}

interface CalendarViewProps {
    schedule: ScheduleItem[];
    onSelectDate?: (date: Date) => void;
    onSelectItem?: (item: ScheduleItem) => void;
}

// Utility: parse date from various formats
const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    // Try "2025-01-15 14:00" format
    const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (match) return new Date(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]);
    return null;
};

// Check for time conflicts (within 2 hours)
const detectConflicts = (items: ScheduleItem[]): Set<string> => {
    const conflicts = new Set<string>();
    for (let i = 0; i < items.length; i++) {
        const timeA = parseDate(items[i].publishTimeLocal || '');
        if (!timeA) continue;
        for (let j = i + 1; j < items.length; j++) {
            const timeB = parseDate(items[j].publishTimeLocal || '');
            if (!timeB) continue;
            if (Math.abs(timeA.getTime() - timeB.getTime()) < 2 * 60 * 60 * 1000) {
                conflicts.add(items[i].id);
                conflicts.add(items[j].id);
            }
        }
    }
    return conflicts;
};

const DAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const statusColors: Record<string, string> = {
    uploaded: 'bg-green-500', scheduled: 'bg-blue-500', pending: 'bg-yellow-500',
    generating: 'bg-purple-500', failed: 'bg-red-500', quality_check: 'bg-orange-500',
};

export const CalendarView: React.FC<CalendarViewProps> = ({ schedule, onSelectDate, onSelectItem }) => {
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const conflicts = useMemo(() => detectConflicts(schedule), [schedule]);

    const getItemsForDate = (day: number): ScheduleItem[] => {
        return schedule.filter(item => {
            const d = parseDate(item.publishTimeLocal || '');
            return d && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
        });
    };

    const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1));
    const handleToday = () => { setViewDate(new Date()); setSelectedDate(new Date()); };

    const handleDateClick = (day: number) => {
        const date = new Date(year, month, day);
        setSelectedDate(date);
        onSelectDate?.(date);
    };

    const today = new Date();
    const isToday = (day: number) =>
        today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

    // Build calendar grid
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const selectedDayItems = selectedDate
        ? getItemsForDate(selectedDate.getDate())
        : [];

    // Stats
    const totalScheduled = schedule.filter(s => s.publishTimeLocal).length;
    const totalConflicts = conflicts.size;

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">📅 发布日历</h3>
                <div className="flex items-center gap-2">
                    <button onClick={handlePrevMonth} className="px-2 py-1 bg-slate-700 rounded hover:bg-slate-600 text-white">◀</button>
                    <span className="text-white font-medium min-w-[100px] text-center">
                        {year}年 {MONTHS[month]}
                    </span>
                    <button onClick={handleNextMonth} className="px-2 py-1 bg-slate-700 rounded hover:bg-slate-600 text-white">▶</button>
                    <button onClick={handleToday} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded text-xs hover:bg-blue-500/30">
                        今天
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="flex gap-4 mb-3 text-xs text-slate-400">
                <span>📹 {totalScheduled} 个已安排</span>
                {totalConflicts > 0 && <span className="text-red-400">⚠️ {totalConflicts} 个时间冲突</span>}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-px bg-slate-700/30 rounded-lg overflow-hidden">
                {/* Day Headers */}
                {DAYS.map(d => (
                    <div key={d} className="text-center text-xs text-slate-400 py-2 bg-slate-800/80 font-medium">{d}</div>
                ))}
                {/* Cells */}
                {cells.map((day, i) => {
                    if (day === null) return <div key={`empty-${i}`} className="bg-slate-800/30 min-h-[60px]" />;
                    const items = getItemsForDate(day);
                    const hasConflict = items.some(item => conflicts.has(item.id));
                    const isSelected = selectedDate?.getDate() === day && selectedDate?.getMonth() === month;

                    return (
                        <div key={day} onClick={() => handleDateClick(day)}
                            className={`min-h-[60px] p-1 cursor-pointer transition-colors
                                ${isToday(day) ? 'bg-blue-500/20 border border-blue-500/50' : 'bg-slate-800/50 hover:bg-slate-700/50'}
                                ${isSelected ? 'ring-2 ring-blue-400' : ''}
                                ${hasConflict ? 'border-l-2 border-l-red-500' : ''}`}>
                            <div className={`text-xs font-medium mb-1 ${isToday(day) ? 'text-blue-400' : 'text-slate-300'}`}>{day}</div>
                            <div className="space-y-0.5">
                                {items.slice(0, 3).map(item => (
                                    <div key={item.id} onClick={(e) => { e.stopPropagation(); onSelectItem?.(item); }}
                                        className={`text-[10px] px-1 py-0.5 rounded truncate text-white ${statusColors[item.status || 'pending'] || 'bg-slate-600'}
                                            ${conflicts.has(item.id) ? 'ring-1 ring-red-400' : ''}`}
                                        title={item.title}>
                                        {item.title.substring(0, 12)}
                                    </div>
                                ))}
                                {items.length > 3 && <div className="text-[10px] text-slate-500 text-center">+{items.length - 3} more</div>}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Selected Date Detail */}
            {selectedDate && (
                <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
                    <h4 className="text-sm font-medium text-white mb-2">
                        📋 {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日 安排
                    </h4>
                    {selectedDayItems.length === 0 ? (
                        <p className="text-xs text-slate-400">暂无安排</p>
                    ) : (
                        <div className="space-y-2">
                            {selectedDayItems.map(item => {
                                const time = parseDate(item.publishTimeLocal || '');
                                return (
                                    <div key={item.id} className={`flex items-center gap-2 p-2 rounded ${conflicts.has(item.id) ? 'bg-red-500/10 border border-red-500/30' : 'bg-slate-600/50'}`}>
                                        <div className={`w-2 h-2 rounded-full ${statusColors[item.status || 'pending'] || 'bg-slate-500'}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-white truncate">{item.title}</div>
                                            <div className="text-xs text-slate-400">
                                                {time ? `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}` : '未定'}
                                                {item.platform && ` · ${item.platform}`}
                                            </div>
                                        </div>
                                        {conflicts.has(item.id) && <span className="text-xs text-red-400">⚠️ 冲突</span>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                {Object.entries(statusColors).map(([status, color]) => (
                    <div key={status} className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${color}`} />
                        <span>{status}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CalendarView;
export type { CalendarViewProps, ScheduleItem };
