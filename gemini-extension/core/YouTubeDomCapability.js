/**
 * Aetheria-Flow Pillar 2: Semantic Sandboxing
 * YouTubeDomCapability implementation for the Chrome Extension.
 * This is the ONLY module allowed to perform direct DOM manipulation.
 */
window.YouTubeDomCapability = (function () {
    'use strict';

    // Internal Helpers
    const deepQuery = (root, selector) => {
        if (!root) return null;
        if (root.querySelector && root.querySelector(selector)) return root.querySelector(selector);
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
        let node;
        while (node = walker.nextNode()) {
            if (node.shadowRoot) {
                const found = deepQuery(node.shadowRoot, selector);
                if (found) return found;
            }
        }
        return null;
    };

    const waitFor = (selector, timeout = 30000) => {
        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                const el = deepQuery(document.body, selector);
                if (el) { clearInterval(interval); resolve(el); }
            }, 500);
            setTimeout(() => { clearInterval(interval); reject(`Timeout waiting for ${selector}`); }, timeout);
        });
    };

    return {
        async isUploadDialogVisible() {
            return !!deepQuery(document.body, 'ytcp-uploads-dialog');
        },

        async selectFile(file) {
            const input = await waitFor('input[type="file"]');
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            input.files = dataTransfer.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        },

        async enterTitle(title) {
            const box = await waitFor('#title-textarea #textbox');
            box.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            document.execCommand('insertText', false, title.substring(0, 100));
            box.dispatchEvent(new Event('input', { bubbles: true }));
        },

        async enterDescription(description) {
            const box = await waitFor('#description-textarea #textbox');
            box.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            document.execCommand('insertText', false, description);
            box.dispatchEvent(new Event('input', { bubbles: true }));
        },

        async setAudienceNotForKids() {
            const radio = await waitFor('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]');
            radio.click();
        },

        async clickNext() {
            const btn = await waitFor('#next-button');
            btn.click();
        },

        async clickPublish() {
            const btn = await waitFor('#done-button');
            btn.click();
        },

        async setVisibility(visibility) {
            const radio = await waitFor(`tp-yt-paper-radio-button[name="${visibility.toUpperCase()}"]`);
            radio.click();
        },

        async selectScheduleDate(date) {
            // This usually requires opening the schedule section first
            const scheduleRadio = await waitFor('tp-yt-paper-radio-button[name="SCHEDULE"]');
            scheduleRadio.click();
            await new Promise(r => setTimeout(r, 1000));
            const dateInput = await waitFor('#datepicker-trigger');
            dateInput.click();
            // Complex date selection logic would go here, simplified for now
            console.log("📅 [Capability] Date Selection Intent:", date);
        },

        async selectScheduleTime(time) {
            const timeInput = await waitFor('#time-of-day-trigger');
            timeInput.click();
            // Complex time selection logic would go here
            console.log("🕒 [Capability] Time Selection Intent:", time);
        },

        async getUploadProgress() {
            const progress = document.querySelector('ytcp-video-upload-progress');
            if (!progress) return 100; // Assume done if not found
            const text = progress.textContent || "";
            const match = text.match(/(\d+)%/);
            return match ? parseInt(match[1]) : 0;
        },

        async isStudioAnalyticsActive() {
            return window.location.href.includes('analytics');
        },

        async scrapeRealtimeVelocity() {
            const velocityEl = deepQuery(document.body, '#velocity-value'); // Hypothetical selector
            return velocityEl ? parseInt(velocityEl.textContent.replace(/,/g, '')) : 0;
        },

        async scrapeChartData(category) {
            console.log("📊 [Capability] Scraping Chart Data:", category);
            // Simulated return for now
            return { category, timestamp: new Date(), data: {} };
        }
    };
})();
