// 🧠 Helper to parse text into chart data
export const parseChartData = (text: string) => {
    try {
        const lines = text.split('\n');
        const data: { label: string; value: number; color?: string }[] = [];

        // Regex to match "Title ... 1,234 views" or similar patterns
        const regex = /(.+?)[:\-\s]+([\d,]+)\s*(views|次观看|观看)/i;

        lines.forEach(line => {
            const match = line.match(regex);
            if (match && match[1] && match[2]) {
                const label = match[1].trim().replace(/^\d+\.\s*/, '').substring(0, 20);
                const value = parseInt(match[2].replace(/,/g, ''));
                if (!isNaN(value) && value > 0) {
                    data.push({ label, value, color: value > 10000 ? '#ef4444' : (value > 1000 ? '#f59e0b' : '#3b82f6') });
                }
            }
        });

        // Fallback: Look for lines with numbers if no standard pattern
        if (data.length === 0) {
            lines.forEach(line => {
                if (/^[\d\-\•]/.test(line)) {
                    const numMatch = line.match(/([\d,]+)/);
                    if (numMatch) {
                        const val = parseInt(numMatch[1].replace(/,/g, ''));
                        if (val > 100 && val < 1000000000) { // Sanity check
                            data.push({ label: line.substring(0, 15) + '...', value: val, color: '#10b981' });
                        }
                    }
                }
            });
        }

        return data.slice(0, 5);
    } catch {
        return [];
    }
};
