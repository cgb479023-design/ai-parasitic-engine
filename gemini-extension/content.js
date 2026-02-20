/**
 * Content Script - Neural Link Standardized Bridge
 * 
 * This script serves as the "Nerve" of the system, connecting the React Frontend
 * to the Chrome Extension Background and the YouTube DOM.
 * 
 * Part of Golden Function #30.
 */

class YouTubeDomAdapter {
    constructor() {
        console.log("🖐️ [YouTubeDomAdapter] Initialized. Ready to interact with DOM.");
    }

    static getInstance() {
        if (!YouTubeDomAdapter.instance) {
            YouTubeDomAdapter.instance = new YouTubeDomAdapter();
        }
        return YouTubeDomAdapter.instance;
    }

    // Helper: Deep Query Selector (handles Shadow DOM)
    deepQueryAll(root, selector) {
        const nodes = [];
        root.querySelectorAll(selector).forEach(node => nodes.push(node));
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
        while (walker.nextNode()) {
            const el = walker.currentNode;
            if (el.shadowRoot) {
                nodes.push(...this.deepQueryAll(el.shadowRoot, selector));
            }
        }
        return nodes;
    }

    async findDeep(selector, timeout = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const els = this.deepQueryAll(document.body, selector);
            const visible = els.find(el => el.offsetParent !== null);
            if (visible) return visible;
            await new Promise(r => setTimeout(r, 500));
        }
        throw new Error(`🛑 [DOM Failure] Element not found: ${selector}`);
    }

    async robustInput(element, value) {
        element.focus();
        element.value = value;
        if (element.getAttribute('contenteditable')) {
            element.textContent = value;
        }
        const events = ['input', 'change', 'blur'];
        for (const evName of events) {
            element.dispatchEvent(new Event(evName, { bubbles: true }));
            await new Promise(r => setTimeout(r, 50));
        }
    }

    // Core Actions used by automated flows
    async enterMetadata(data) {
        console.log("🖐️ [Capability] Entering Metadata...");
        const titleBox = await this.findDeep('#textbox[aria-label*="Add a title"]');
        const truncatedTitle = data.title.substring(0, 80);
        await this.robustInput(titleBox, truncatedTitle);

        const descBox = await this.findDeep('#textbox[aria-label*="Tell viewers"]');
        await this.robustInput(descBox, data.description);

        if (data.playlists && data.playlists.length > 0) {
            await this.selectPlaylists(data.playlists);
        }

        const kidsRadio = await this.findDeep('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]');
        kidsRadio.click();

        await this.handleAlteredContent();

        if (data.tags) {
            await this.enterTags(data.tags);
        }
    }

    async selectPlaylists(names) {
        const trigger = await this.findDeep('ytcp-text-dropdown-trigger[label="Select"]');
        trigger.click();
        await new Promise(r => setTimeout(r, 2000));

        const items = this.deepQueryAll(document.body, 'ytcp-ve li');
        for (const name of names) {
            const item = items.find(el => el.textContent?.includes(name));
            if (item) {
                item.scrollIntoView({ block: 'center' });
                item.click();
                console.log(`✅ Playlist Selected: ${name}`);
            }
        }
        (await this.findDeep('.done-button')).click();
    }

    async enterTags(tags) {
        const tagString = tags.join(', ');
        const showMore = this.deepQueryAll(document.body, '#toggle-button').find(el => el.textContent?.includes('Show more'));
        if (showMore) showMore.click();

        const tagInput = await this.findDeep('input[placeholder="Add tag"]');
        await this.robustInput(tagInput, tagString);
        tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }

    async handleAlteredContent() {
        for (let i = 0; i < 5; i++) {
            const radio = this.deepQueryAll(document.body, 'tp-yt-paper-radio-button').find(el => el.getAttribute('name') === 'VIDEO_HAS_ALTERED_CONTENT_YES');
            if (radio) {
                radio.click();
                return;
            }
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    async publishVideo() {
        console.log("🖐️ [Capability] Waiting for upload completion...");
        for (let i = 0; i < 60; i++) {
            const labels = this.deepQueryAll(document.body, '.progress-label').map(el => el.textContent).join('');
            if (labels.includes('Checks complete') || labels.includes('100%')) break;
            await new Promise(r => setTimeout(r, 2000));
        }
        const doneBtn = await this.findDeep('#done-button');
        if (doneBtn.getAttribute('disabled') === 'true') throw new Error("PUBLISH_BLOCKED");
        doneBtn.click();
        return await this.scrapeVideoLink();
    }

    async scrapeVideoLink() {
        const link = this.deepQueryAll(document.body, 'a[href*="youtu.be"]')[0];
        return link?.href || "";
    }
}

const adapter = YouTubeDomAdapter.getInstance();

// ═══════════════════════════════════════════════════════════════
// 🌉 Bidirectional Message Bridge (#30 - CRITICAL)
// ═══════════════════════════════════════════════════════════════

// Direction A (Background -> React/Page)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 🛡️ [Security Pillar: Memory Safety] Avoid logging massive payloads to console
    const logTrace = { ...message };
    if (logTrace.payload && typeof logTrace.payload === 'string' && logTrace.payload.length > 500) {
        logTrace.payload = `[Large Payload: ${logTrace.payload.length} chars]`;
    }
    console.log("📡 [Bridge] Message from Background:", logTrace.type || logTrace.action || 'unknown', logTrace);

    window.postMessage({
        ...message,
        source: 'extension'
    }, "*");
    sendResponse({ ack: true });
});

// Direction B (React/Page -> Background)
window.addEventListener("message", async (event) => {
    // Security check: Only handle messages from current window and not from ourselves
    if (event.source !== window || !event.data.type || event.data.source === 'extension') return;

    const { type, payload, requestId } = event.data;

    // Check for audit-required message types (Golden Rule)
    const auditMessages = [
        'PREPARE_YOUTUBE_UPLOAD',
        'GOOGLE_VIDS_GENERATE',
        'GOOGLE_FLOW_GENERATE',
        'REQUEST_YOUTUBE_ANALYTICS',
        'REGISTER_SCHEDULED_COMMENT',
        'DFL_SCHEDULE_ADJUST_REQUEST',
        'IGNITE_SCRIPT',
        'ASK_STUDIO_GENERATE_PLAN',
        'CROSS_PLATFORM_DISTRIBUTE',
        'CHECK_EXTENSION_STATUS'
    ];

    if (auditMessages.includes(type)) {
        console.log(`🔌 [Bridge] Relaying intent to Background: ${type}`);
        chrome.runtime.sendMessage({ action: type, payload, requestId });
    }

    // Direct fulfillment for domestic Nerve signals
    try {
        switch (type) {
            case "EXECUTE_UPLOAD_METADATA":
                await adapter.enterMetadata(payload);
                window.postMessage({ type: "METADATA_ENTERED_SUCCESS", requestId, source: "extension" }, "*");
                break;
            case "EXECUTE_PUBLISH_CLICK":
                const url = await adapter.publishVideo();
                window.postMessage({ type: "UPLOAD_COMPLETED_SUCCESS", payload: { videoUrl: url }, requestId, source: "extension" }, "*");
                break;
            case "CHECK_EXTENSION_STATUS":
                // Send immediate pong back to React
                window.postMessage({ type: "EXTENSION_STATUS_RESPONSE", payload: { status: "Connected" }, requestId, source: "extension" }, "*");
                break;
        }
    } catch (err) {
        console.error(`💥 [Nerve Failure] ${type}:`, err);
        window.postMessage({ type: "ERROR_LOG", payload: { message: err.message }, requestId, source: "extension" }, "*");
    }
});

console.log("🔌 [Content Script] DeadStar V8.5 Neural Link Established.");