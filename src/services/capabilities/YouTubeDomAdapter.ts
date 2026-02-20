/**
 * 🏛️ Aetheria-Flow Architecture: The Concrete Hand
 * ---------------------------------------------------------------------------
 * COMPLIANCE: Pillar 2 (Semantic Sandboxing) & Article III (Robustness)
 * ROLE: The ONLY file in the system authorized to access `document` or `window`.
 * LOGIC SOURCE: V10 Scheduling Protocol, DFL V8.0 Specs, Knowledge Base 2025.
 * ---------------------------------------------------------------------------
 */

import { IYouTubeDomCapability, YouTubeMetadataPayload } from './YouTubeDomCapability';

export class YouTubeDomAdapter implements IYouTubeDomCapability {
    private static instance: YouTubeDomAdapter;

    private constructor() {
        console.log("🖐️ [YouTubeDomAdapter] Initialized. Ready to interact with DOM.");
    }

    public static getInstance(): YouTubeDomAdapter {
        if (!YouTubeDomAdapter.instance) {
            YouTubeDomAdapter.instance = new YouTubeDomAdapter();
        }
        return YouTubeDomAdapter.instance;
    }

    // =========================================================================
    // 🛠️ Core Engines (Shadow DOM & Interaction)
    // =========================================================================

    /**
     * 🧠 Deep Query Engine: The only way to pierce YouTube's Shadow DOMs.
     * Source: YOUTUBE_SCHEDULE_AUTOMATION_KNOWLEDGE_BASE.md
     */
    private deepQueryAll(root: ParentNode, selector: string): HTMLElement[] {
        const results: HTMLElement[] = [];
        if ((root as ParentNode).querySelectorAll) {
            root.querySelectorAll(selector).forEach((el) => results.push(el as HTMLElement));
        }

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
        while (walker.nextNode()) {
            const el = walker.currentNode as Element;
            if (el.shadowRoot) {
                results.push(...this.deepQueryAll(el.shadowRoot, selector));
            }
        }
        return results;
    }

    private async findDeep(selector: string, timeout = 5000, contextStr = ""): Promise<HTMLElement> {
        console.log(`🖐️ [Find] Searching for: ${selector} ${contextStr ? `(${contextStr})` : ''}`);
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const elements = this.deepQueryAll(document.body, selector);
            const visibleEl = elements.find(el => el.offsetParent !== null && (el as HTMLElement).style.display !== 'none');
            if (visibleEl) return visibleEl;
            await new Promise(r => setTimeout(r, 500));
        }
        throw new Error(`🛑 [DOM Failure] Element not found: ${selector}`);
    }

    /**
     * 🧠 Robust Input Engine: Direct assignment + Event dispatching.
     * Replaces unreliable execCommand.
     * Source: TAGS_AUTO_FILL_ENABLED.md
     */
    private async robustInput(element: HTMLElement, value: string) {
        element.focus();
        (element as any).value = value;
        if (element.getAttribute('contenteditable')) {
            element.textContent = value;
        }
        const events = ['input', 'change'];
        for (const eventType of events) {
            element.dispatchEvent(new Event(eventType, { bubbles: true }));
            await new Promise(r => setTimeout(r, 50));
        }
        element.blur();
    }

    // =========================================================================
    // 📦 Metadata Capability (The Content)
    // =========================================================================

    async enterMetadata(payload: YouTubeMetadataPayload): Promise<void> {
        console.log("🖐️ [Capability] Entering Metadata...");

        const titleInput = await this.findDeep('#textbox[aria-label*="Add a title"]');
        await this.robustInput(titleInput, payload.title.substring(0, 80));

        const descInput = await this.findDeep('#textbox[aria-label*="Tell viewers"]');
        await this.robustInput(descInput, payload.description);

        if (payload.playlists && payload.playlists.length > 0) {
            await this.selectPlaylists(payload.playlists);
        }

        try {
            const notKids = await this.findDeep('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]');
            notKids.click();
        } catch (e) {
            console.warn("Kids radio not found by name, trying text search...");
            const radios = this.deepQueryAll(document.body, 'tp-yt-paper-radio-button');
            const kidOption = radios.find(r => r.textContent?.includes('not made for kids'));
            if (kidOption) kidOption.click();
        }

        await this.handleAlteredContent();

        if (payload.tags) {
            await this.enterTags(payload.tags);
        }
    }

    async selectPlaylist(name: string): Promise<void> {
        await this.selectPlaylists([name]);
    }

    private async selectPlaylists(targetNames: string[]) {
        // Click Trigger
        const trigger = await this.findDeep('ytcp-text-dropdown-trigger[label="Select"]');
        trigger.click();
        await new Promise(r => setTimeout(r, 2000)); // Wait for dialog

        // Find all playlist checkboxes (ytcp-ve logic)
        const checkboxes = this.deepQueryAll(document.body, 'ytcp-ve li');

        for (const target of targetNames) {
            const match = checkboxes.find(el => el.textContent?.includes(target));
            if (match) {
                match.scrollIntoView({ block: 'center' }); // V10 Scroll Logic
                match.click();
                console.log(`✅ Playlist Selected: ${target}`);
            }
        }
        // Click Done
        const doneBtn = await this.findDeep('.done-button');
        doneBtn.click();
    }

    async enterTags(tags: string[]): Promise<void> {
        const tagStr = tags.join(', ');
        console.log(`🏷️ [Capability] Filling Tags: ${tagStr}`);
        // Expand "Show more" first
        const showMore = (await this.deepQueryAll(document.body, '#toggle-button')).find(el => el.textContent?.includes('Show more'));
        if (showMore) showMore.click();

        // Find Tag Input (Placeholder strategy)
        const tagInput = await this.findDeep('input[placeholder="Add tag"]');
        await this.robustInput(tagInput, tagStr);
        tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }

    private async handleAlteredContent() {
        // Retry logic for "Altered content" section rendering
        for (let i = 0; i < 5; i++) {
            const radios = this.deepQueryAll(document.body, 'tp-yt-paper-radio-button');
            const yesRadio = radios.find(r => r.getAttribute('name') === 'VIDEO_HAS_ALTERED_CONTENT_YES');
            if (yesRadio) {
                yesRadio.click();
                console.log("✅ Altered Content: YES selected.");
                return;
            }
            await new Promise(r => setTimeout(r, 1000));
        }
        console.warn("⚠️ Altered Content radio not found (Skipping).");
    }

    // =========================================================================
    // 📅 Scheduling Capability (The V10 Engine)
    // =========================================================================

    async selectScheduleDate(dateStr: string): Promise<void> {
        console.log(`🖐️ [Capability] Setting Date: ${dateStr}`);
        const dateTrigger = await this.findDeep('ytcp-text-dropdown-trigger[id="start-date"]');
        dateTrigger.click();
        await new Promise(r => setTimeout(r, 1000));

        const dayNumber = dateStr.split('/')[1].replace(/^0/, '');
        const allDays = this.deepQueryAll(document.body, '.calendar-day');

        const targetDay = allDays.find(el =>
            el.textContent?.trim() === dayNumber &&
            !el.classList.contains('disabled') &&
            el.offsetParent !== null
        );

        if (targetDay) {
            targetDay.click();
            console.log(`✅ Date ${dayNumber} clicked.`);
        } else {
            console.warn("⚠️ Date cell not found (possibly different month).");
        }
    }

    async selectScheduleTime(timeStr: string): Promise<void> {
        console.log(`🖐️ [Capability] Setting Time: ${timeStr}`);

        try {
            console.log("👉 Step 1: Activating Schedule Mode...");
            const scheduleContainer = await this.findDeep('#second-container', 3000, "Schedule Container");
            scheduleContainer.click();
            console.log("✅ Clicked #second-container");
        } catch (e) {
            console.warn("⚠️ #second-container not found, trying fallback to 'Schedule' text...");
            const allDivs = this.deepQueryAll(document.body, 'div');
            const scheduleText = allDivs.find(el => el.textContent?.trim() === 'Schedule' && el.offsetParent !== null);
            if (scheduleText) {
                scheduleText.click();
                console.log("✅ Clicked via Text Search");
            }
        }

        await new Promise(r => setTimeout(r, 2000));

        console.log("👉 Step 2: Hunting for Time Input...");
        const allInputs = this.deepQueryAll(document.body, 'input');
        const timeInput = allInputs.find(el => {
            const isVisible = el.offsetParent !== null;
            const hasTimeFormat = (el as HTMLInputElement).value &&
                ((el as HTMLInputElement).value.includes('AM') ||
                    (el as HTMLInputElement).value.includes('PM') ||
                    (el as HTMLInputElement).value.includes(':'));
            const isInsidePaperInput = el.className.includes('input-element');

            return isVisible && (hasTimeFormat || isInsidePaperInput);
        });

        if (!timeInput) {
            throw new Error("🛑 [Scheduling] Critical: Time Input NOT found after Schedule click.");
        }

        console.log("✅ Time Input Found. Clicking to open dropdown...");
        timeInput.click();
        await new Promise(r => setTimeout(r, 1000));

        const allOptions = this.deepQueryAll(document.body, 'tp-yt-paper-item');
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const target = normalize(timeStr);

        const match = allOptions.find(opt => normalize(opt.textContent || '') === target);

        if (match) {
            console.log(`🎯 Match found for "${timeStr}". Scrolling...`);
            match.scrollIntoView({ block: 'center', behavior: 'instant' });
            await new Promise(r => setTimeout(r, 500));
            match.click();
            console.log("✅ Time Selected via Dropdown.");
        } else {
            console.warn("⚠️ Dropdown match failed. Establishing Fallback: Direct Input.");
            await this.robustInput(timeInput, timeStr);
        }
    }

    async publishVideo(): Promise<string> {
        console.log("🖐️ [Capability] Finalizing Publish...");
        const doneBtn = await this.findDeep('#done-button');
        if (doneBtn.getAttribute('aria-disabled') === 'true') {
            throw new Error("PUBLISH_BLOCKED: Button is disabled.");
        }
        doneBtn.click();
        console.log("🚀 [LAUNCH] 'Schedule' button clicked!");
        return await this.scrapeVideoLink();
    }

    // =========================================================================
    // 📊 Sense Layer (Analytics)
    // =========================================================================

    async scrapeRealtimeVelocity(): Promise<number> {
        // Implementation of Channel B (Direct DOM)
        // Source: data_collection_capabilities.md
        try {
            const realtimeCard = await this.findDeep('ytcp-analytics-realtime-card');
            const viewCountEl = this.deepQueryAll(realtimeCard, '.metric-value')[0]; // Usually first metric is views
            const text = viewCountEl?.textContent || "0";
            return parseInt(text.replace(/,/g, ''), 10);
        } catch (e) {
            console.warn("⚠️ Failed to scrape velocity", e);
            return 0; // Safe fallback
        }
    }

    // =========================================================================
    // 🛡️ Missing Capabilities (Restored for Compliance)
    // =========================================================================

    async isStudioAnalyticsActive(): Promise<boolean> {
        return window.location.href.includes('analytics');
    }

    async isUploadDialogVisible(): Promise<boolean> {
        return this.deepQueryAll(document.body, 'ytcp-uploads-dialog').length > 0;
    }

    async scrapeChartData(category: string): Promise<any> {
        console.log(`💹 [Capability] Scraping Chart: ${category}`);
        const paths = this.deepQueryAll(document.body, 'svg path[d]');

        const bestPath = paths.map(p => {
            const d = p.getAttribute('d') || "";
            let score = d.length;
            score += (d.match(/[Cc]/g) || []).length * 100;
            score -= (d.match(/[Aa]/g) || []).length * 200;
            return { p, score };
        }).sort((a, b) => b.score - a.score)[0]?.p;

        if (!bestPath) throw new Error("Chart path not found");

        return {
            path: bestPath.getAttribute('d'),
            viewBox: bestPath.closest('svg')?.getAttribute('viewBox') || "0 0 100 100",
            category
        };
    }

    async setVisibility(visibility: 'public' | 'private' | 'unlisted'): Promise<void> {
        console.log(`👁️ [Capability] Setting Visibility: ${visibility}`);
        const radio = await this.findDeep(`tp-yt-paper-radio-button[name="${visibility.toUpperCase()}"]`);
        radio.click();
    }

    async setMadeForKids(isMadeForKids: boolean): Promise<void> {
        console.log(`👶 [Capability] Setting Made for Kids: ${isMadeForKids}`);
        const selector = isMadeForKids
            ? 'tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_MFK"]'
            : 'tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]';
        const radio = await this.findDeep(selector);
        radio.click();
    }

    async scrapeVideoLink(): Promise<string> {
        console.log("🔗 [Capability] Scraping Video Link...");
        const links = this.deepQueryAll(document.body, 'a[href*="youtu.be"]');
        return (links[0] as HTMLAnchorElement)?.href || "";
    }

    async getUploadProgress(): Promise<number> {
        const progressEl = this.deepQueryAll(document.body, 'ytcp-video-upload-progress')[0];
        const text = progressEl?.textContent || "0";
        const match = text.match(/(\d+)%/);
        return match ? parseInt(match[1]) : 0;
    }
}

export const youtubeDomAdapter = YouTubeDomAdapter.getInstance();
