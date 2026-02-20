
export function generateViralMetadataFromTemplate(prompt: string, aspectRatio: string): any {
    const cleanPrompt = prompt ? prompt.replace(/[^\w\s]/gi, '').split(' ').slice(0, 5).join(' ') : 'AI Video';

    // 🏗️ 7-POINT VIRAL PROTOCOL IMPLEMENTATION
    const protocol = {
        hook: "Visual disruption in first 0.1s (Action Burst)",
        conflict: "Man vs Machine / Expectation vs Reality",
        pacing: "Fast cuts (0.8s avg)",
        tension: "Will it fail?",
        payoff: "Unexpected twist ending",
        audio: "Viral trending sound",
        loop: "Seamless loop to start"
    };

    // 🎣 KILLER HOOK STRATEGIES
    const hooks = [
        "Action Burst: Sudden movement/impact",
        "Audio Spike: Loud noise/scream",
        "Visual Contrast: Zoom out reveal",
        "Text Tease: 'Wait for it...'",
        "Direct Address: 'You won't believe...'"
    ];
    const selectedHook = hooks[Math.floor(Math.random() * hooks.length)];

    // 📝 VIRAL TITLE FORMULA (50-70 Chars, Emoji, Clickbait)
    const titles = [
        `I Tried ${cleanPrompt} AND THIS HAPPENED! 😱`, // Suspense
        `The TRUTH About ${cleanPrompt} (SHOCKING)`,   // Reveal
        `Why ${cleanPrompt} is TAKING OVER 🚀`,        // Trend
        `STOP Doing ${cleanPrompt} Right Now! 🛑`,     // Urgency
        `Is ${cleanPrompt} The Future? 🤯`             // Question
    ];
    const randomTitle = titles[Math.floor(Math.random() * titles.length)].substring(0, 70); // Enforce limit

    return {
        marketingCopy: {
            title: randomTitle,
            description: `You won't believe the results when we tested ${prompt}. This changes everything!\n\n👇 Rate this 1-10!\n\n#viral #trending #${cleanPrompt.replace(/\s/g, '')}`,
            tags: ["#viral", "#trending", "#fyp", "#shocking", "#mustwatch", `#${cleanPrompt.replace(/\s/g, '')}`],
            comment1: { type: 'Engagement', content: "Who else is seeing this?? 👇" },
            comment2: { type: 'Hook', content: "Wait for the end... 🤯" }
        },
        viralityAnalysis: {
            score: { score: 98, grade: 'S+' },
            metrics: { playCount: 1000000, ctr: 15.5, retention: 92 },
            advice: {
                recommendedTimes: ["6:00 PM", "8:00 PM"],
                publishingSchedule: "Post immediately for maximum reach (Burst Mode).",
                thumbnailAdvice: "Use high contrast, red arrow, and shocked face.",
                ctaAdvice: "Ask a controversial question in the comments.",
                protocol: protocol,
                selectedHook: selectedHook
            }
        }
    };
}
