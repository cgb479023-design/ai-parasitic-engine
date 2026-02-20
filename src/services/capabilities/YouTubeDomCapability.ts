/**
 * Aetheria-Flow Pillar 2: Semantic Sandboxing
 * 
 * YouTubeDomCapability is the exclusive interface for the React frontend 
 * to interact with the YouTube Studio DOM.
 * 
 * IMPORTANT: This file MUST NOT contain direct DOM manipulation (document.querySelector, etc).
 * It acts as a Capability Adapter that relays structured intents to the 
 * browser extension's execution layer.
 */

export interface IYouTubeDomCapability {
    // Discovery
    isStudioAnalyticsActive(): Promise<boolean>;
    isUploadDialogVisible(): Promise<boolean>;

    // Scraper Actions
    scrapeChartData(category: string): Promise<any>;
    scrapeRealtimeVelocity(): Promise<number>;

    // Upload Actions (Metadata)
    enterMetadata(payload: YouTubeMetadataPayload): Promise<void>;
    setVisibility(visibility: 'public' | 'private' | 'unlisted'): Promise<void>;
    selectScheduleDate(date: string): Promise<void>;
    selectScheduleTime(time: string): Promise<void>;
    enterTags(tags: string[]): Promise<void>;
    selectPlaylist(name: string): Promise<void>;
    setMadeForKids(isMadeForKids: boolean): Promise<void>;
    publishVideo(): Promise<string>; // Returns the final video link
    scrapeVideoLink(): Promise<string>;

    // Status
    getUploadProgress(): Promise<number>;
}

export interface YouTubeMetadataPayload {
    videoId: string | number;
    title: string;
    description: string;
    madeForKids: boolean;
    tags?: string[];
    language?: string;
    playlist?: string;
    playlists?: string[];
    visibility?: 'public' | 'private' | 'unlisted';
    scheduleDate?: string;
    scheduleTime?: string;
}

export class YouTubeDomCapability implements IYouTubeDomCapability {
    private static instance: YouTubeDomCapability;

    private constructor() { }

    public static getInstance(): YouTubeDomCapability {
        if (!YouTubeDomCapability.instance) {
            YouTubeDomCapability.instance = new YouTubeDomCapability();
        }
        return YouTubeDomCapability.instance;
    }

    /**
     * Internal helper to relay messages to the content script.
     * Enforces structured message passing.
     */
    private async relay(action: string, payload?: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const requestId = Math.random().toString(36).substring(7);

            const handler = (event: MessageEvent) => {
                const { type: respType, requestId: respId, result, error } = event.data;
                // Support both legacy CAP_..._RESULT and new SUCCESS/DATA results
                const isMatch = (respType === `${action}_RESULT`) ||
                    (respType === 'METADATA_ENTERED_SUCCESS' && action === 'EXECUTE_UPLOAD_METADATA') ||
                    (respType === 'UPLOAD_COMPLETED_SUCCESS' && action === 'EXECUTE_PUBLISH_CLICK') ||
                    (respType === 'VELOCITY_DATA_RESULT' && action === 'REQUEST_VELOCITY_DATA');

                if (isMatch && respId === requestId) {
                    window.removeEventListener('message', handler);
                    if (error) reject(new Error(error));
                    else resolve(result);
                }
            };

            window.addEventListener('message', handler);

            window.postMessage({
                source: 'brain',
                type: action,
                payload,
                requestId
            }, '*');

            // Timeout after 30 seconds
            setTimeout(() => {
                window.removeEventListener('message', handler);
                reject(new Error(`Capability Request Timeout: ${action}`));
            }, 30000);
        });
    }

    async isStudioAnalyticsActive(): Promise<boolean> {
        return this.relay('CAP_CHECK_STUDIO_ACTIVE');
    }

    async isUploadDialogVisible(): Promise<boolean> {
        return this.relay('CAP_CHECK_UPLOAD_VISIBLE');
    }

    async scrapeChartData(category: string): Promise<any> {
        return this.relay('CAP_SCRAPE_CHART', { category });
    }

    async scrapeRealtimeVelocity(): Promise<number> {
        return this.relay('REQUEST_VELOCITY_DATA');
    }

    async enterMetadata(payload: YouTubeMetadataPayload): Promise<void> {
        return this.relay('EXECUTE_UPLOAD_METADATA', payload);
    }

    async setVisibility(visibility: 'public' | 'private' | 'unlisted'): Promise<void> {
        return this.relay('CAP_SET_VISIBILITY', { visibility });
    }

    async selectScheduleDate(date: string): Promise<void> {
        // Store payload for scheduling
        (window as any).__LAST_SCHEDULE_DATE = date;
    }

    async selectScheduleTime(time: string): Promise<void> {
        const date = (window as any).__LAST_SCHEDULE_DATE || new Date().toISOString().split('T')[0];
        return this.relay('EXECUTE_SCHEDULING', { date, time });
    }

    async enterTags(tags: string[]): Promise<void> {
        return this.relay('CAP_ENTER_TAGS', { tags });
    }

    async selectPlaylist(name: string): Promise<void> {
        return this.relay('CAP_SELECT_PLAYLIST', { name });
    }

    async setMadeForKids(isMadeForKids: boolean): Promise<void> {
        return this.relay('CAP_SET_MADE_FOR_KIDS', { isMadeForKids });
    }

    async publishVideo(): Promise<string> {
        return this.relay('EXECUTE_PUBLISH_CLICK');
    }

    async scrapeVideoLink(): Promise<string> {
        return this.relay('CAP_SCRAPE_VIDEO_LINK');
    }

    async getUploadProgress(): Promise<number> {
        return this.relay('CAP_GET_UPLOAD_PROGRESS');
    }
}

export const youtubeDomCapability = YouTubeDomCapability.getInstance();
