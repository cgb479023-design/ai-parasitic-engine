
export interface YPPReport {
    overallScore: number;
    viralStatus: string;
    metrics: {
        apv: { value: number; target: number; status: string };
        ctr: { value: number; target: number; status: string };
        engagement: { value: number; target: number; status: string };
        shortsFeed: { value: number; target: number; status: string };
    };
    insights: string[];
    actions: string[];
}

export const analyzeYPPData = (analyticsData: any): YPPReport => {
    // Mock analysis based on provided data
    const apv = parseFloat(analyticsData?.videoPerformance?.apv || '0');
    const ctr = parseFloat(analyticsData?.videoPerformance?.ctr || '0');
    const engagement = 4.2; // Mock calculation
    const shortsFeed = parseFloat(analyticsData?.trafficSources?.shortsFeed || '0');

    return {
        overallScore: 78, // Mock calculation
        viralStatus: 'Rising',
        metrics: {
            apv: { value: apv, target: 70, status: apv >= 70 ? 'Good' : 'Warning' },
            ctr: { value: ctr, target: 5, status: ctr >= 5 ? 'Good' : 'Warning' },
            engagement: { value: engagement, target: 5, status: engagement >= 5 ? 'Good' : 'Warning' },
            shortsFeed: { value: shortsFeed, target: 90, status: shortsFeed >= 90 ? 'Good' : 'Warning' }
        },
        insights: [
            `APV (${apv}%) is ${apv >= 70 ? 'good' : 'below target (70%)'}.`,
            `CTR (${ctr}%) is ${ctr >= 5 ? 'good' : 'approaching target (5%)'}.`,
            `Shorts Feed traffic (${shortsFeed}%) is ${shortsFeed >= 90 ? 'excellent' : 'strong but can be improved'}.`
        ],
        actions: [
            'Optimize the first 3 seconds to improve retention.',
            'Test different thumbnail variations to improve CTR.',
            'Add clear calls to action to boost engagement.'
        ]
    };
};

export const generateMarkdownReport = (report: YPPReport): string => {
    return `
# 📅 YPP Daily Strategy Report

**Overall Score**: ${report.overallScore}/100 (${report.viralStatus})

## 📊 Core Metrics
- **Avg. % Viewed**: ${report.metrics.apv.value}% (Target: ${report.metrics.apv.target}%) - ${report.metrics.apv.status}
- **CTR**: ${report.metrics.ctr.value}% (Target: ${report.metrics.ctr.target}%) - ${report.metrics.ctr.status}
- **Engagement**: ${report.metrics.engagement.value}% (Target: ${report.metrics.engagement.target}%) - ${report.metrics.engagement.status}
- **Shorts Feed**: ${report.metrics.shortsFeed.value}% (Target: ${report.metrics.shortsFeed.target}%) - ${report.metrics.shortsFeed.status}

## 💡 Insights
${report.insights.map(i => `- ${i}`).join('\n')}

## 🚀 Recommended Actions
${report.actions.map(a => `- ${a}`).join('\n')}
    `.trim();
};
