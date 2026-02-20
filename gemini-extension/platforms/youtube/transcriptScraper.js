/**
 * YouTube Transcript Scraper
 * Extracts transcript from YouTube video page for viral analysis.
 */
class TranscriptScraper {
    async getTranscript() {
        console.log("📜 [Transcript] Starting extraction...");

        // 1. Expand description (new UI often hides transcript button inside description)
        const expandBtn = document.querySelector('#expand');
        if (expandBtn) {
            expandBtn.click();
            await this.delay(1000);
        }

        // 2. Click "Show transcript"
        // Try multiple selectors
        let showTranscriptBtn = Array.from(document.querySelectorAll('button')).find(b =>
            b.textContent.toLowerCase().includes('show transcript') ||
            b.getAttribute('aria-label')?.toLowerCase().includes('show transcript')
        );

        // Fallback for new UI where it's a specific renderer
        if (!showTranscriptBtn) {
            const secondaryButtons = document.querySelectorAll('ytd-button-renderer');
            for (const btn of secondaryButtons) {
                if (btn.textContent.toLowerCase().includes('transcript')) {
                    showTranscriptBtn = btn;
                    break;
                }
            }
        }

        if (showTranscriptBtn) {
            console.log("📜 [Transcript] Found 'Show transcript' button, clicking...");
            showTranscriptBtn.click();
            await this.delay(2000);
        } else {
            console.warn("📜 [Transcript] 'Show transcript' button not found. Panel might be already open.");
        }

        // 3. Extract text
        // Wait for segments to load
        await this.waitForSegments();

        const segments = document.querySelectorAll('ytd-transcript-segment-renderer');
        if (segments.length === 0) {
            console.error("📜 [Transcript] No transcript segments found");
            return null;
        }

        let fullText = "";
        segments.forEach(seg => {
            const text = seg.querySelector('.segment-text')?.textContent?.trim();
            if (text) fullText += text + " ";
        });

        // Clean up text
        fullText = fullText.replace(/\s+/g, ' ').trim();

        console.log(`📜 [Transcript] Extracted ${fullText.length} chars`);
        return fullText;
    }

    async waitForSegments() {
        for (let i = 0; i < 10; i++) {
            const segments = document.querySelectorAll('ytd-transcript-segment-renderer');
            if (segments.length > 0) return;
            await this.delay(500);
        }
    }

    delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

window.TranscriptScraper = new TranscriptScraper();
console.log("📦 [Module] platforms/youtube/transcriptScraper.js loaded");
