/**
 * Mimicry Service
 * Handles searching for viral videos, scraping transcripts via extension,
 * and formatting the data for prompt injection.
 */

declare const chrome: any;

export interface MimicryData {
    transcript: string;
    title: string;
    url: string;
}

export const mimicryService = {
    /**
     * Triggers the extension to search for a viral video and scrape its transcript.
     */
    findAndScrapeViralVideo: async (theme: string): Promise<MimicryData | null> => {
        console.log(`🚀 [MimicryService] Requesting viral video for theme: ${theme}`);

        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    action: 'searchAndScrapeViralVideo',
                    theme: theme
                }, (response: any) => {
                    if (chrome.runtime.lastError || !response || !response.success) {
                        console.warn('⚠️ [MimicryService] Failed to get viral video:', chrome.runtime.lastError?.message || 'Unknown error');
                        resolve(null);
                    } else {
                        console.log(`✅ [MimicryService] Got viral video: ${response.title}`);
                        resolve({
                            transcript: response.transcript,
                            title: response.title,
                            url: response.url
                        });
                    }
                });
            } else {
                console.warn('⚠️ [MimicryService] Extension context not found');
                resolve(null);
            }
        });
    },

    /**
     * Formats the mimicry data into a prompt section for Ask Studio.
     */
    generateMimicrySection: (data: MimicryData | null): string => {
        if (!data || !data.transcript) return '';

        return `
═══════════════════════════════════════════════════════════════════════════════
🚀 VIRAL MIMICRY SOURCE: MILLION-VIEW REFERENCE (CRITICAL ANALYSIS)
═══════════════════════════════════════════════════════════════════════════════

The following is a transcript from a high-performing viral video related to today's theme.
**VIDEO TITLE**: "${data.title}"
**SOURCE URL**: ${data.url}

**TRANSCRIPT**:
"""
${data.transcript.substring(0, 5000)} 
"""

**MANDATORY INSTRUCTION FOR VIRAL MIMICRY**:
1. **Analyze the Hook**: Identify exactly how this video grabs attention in the first 3 seconds.
2. **Analyze the Pacing**: Note the rhythm of information delivery.
3. **UPGRADE & ADAPT**: Do NOT copy this script. Instead, create an "Upgraded Version" that:
   - Uses a similar high-retention structure.
   - Adds a unique "Chaos Factor" or "Twist" that the original lacks.
   - Integrates the "Mark Bobl" persona and "7-Point Protocol".
   - Ensures a 120% APV seamless loop.

> ⚡ **Viral Logic**: This video ALREADY proved the concept works. Your job is to make it 10x more engaging for today's audience!
`;
    }
};
