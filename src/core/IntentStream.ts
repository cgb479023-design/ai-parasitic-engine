/**
 * Aetheria-Flow Pillar 4: Event Sourcing
 * The IntentStream records all high-level system intents, 
 * treating them as the primary source of truth for the system state.
 */

export interface Intent {
    id: string;
    timestamp: number;
    type: string;        // e.g., 'COLLECT_ANALYTICS', 'GENERATE_PLAN', 'START_EXECUTION'
    payload: any;
    origin: 'user' | 'agent' | 'system';
    status: 'proposed' | 'committed' | 'failed' | 'scraping' | 'mutating' | 'muxing' | 'uploading' | 'completed';
    error?: string;
}

class IntentStream {
    private intents: Intent[] = [];
    private subscribers: ((intent: Intent) => void)[] = [];

    /**
     * Propose a new intent to the system
     */
    propose(type: string, payload: any, origin: 'user' | 'agent' | 'system' = 'user'): Intent {
        const intent: Intent = {
            id: `int_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timestamp: Date.now(),
            type,
            payload,
            origin,
            status: 'proposed'
        };

        this.intents.push(intent);

        // 🛡️ [Security Pillar: Loop Protection] 
        // Do not log DEBUG_LOG intents back to console, otherwise it creates an infinite feedback loop with DebugBridge
        if (type !== 'DEBUG_LOG') {
            console.log(`[IntentStream] 🔮 Proposed Intent: ${type}`, payload);
        }

        this.notify(intent);
        this.syncToBackend(intent);
        return intent;
    }

    /**
     * Mark an intent as committed (successfully processed)
     */
    commit(id: string) {
        const intent = this.intents.find(i => i.id === id);
        if (intent) {
            intent.status = 'committed';
            if (intent.type !== 'DEBUG_LOG') {
                console.log(`[IntentStream] ✅ Committed Intent: ${intent.type} (${id})`);
            }
            this.notify(intent);
            this.syncToBackend(intent);
        }
    }

    /**
     * Mark an intent as failed
     */
    fail(id: string, error: string) {
        const intent = this.intents.find(i => i.id === id);
        if (intent) {
            intent.status = 'failed';
            intent.error = error;
            if (intent.type !== 'DEBUG_LOG') {
                console.error(`[IntentStream] ❌ Failed Intent: ${intent.type} (${id}) - Error: ${error}`);
            }
            this.notify(intent);
            this.syncToBackend(intent);
        }
    }

    /**
     * Subscribe to new intents in the stream
     */
    subscribe(callback: (intent: Intent) => void) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(s => s !== callback);
        };
    }

    private notify(intent: Intent) {
        // 🛡️ [Security Pillar: Asynchronous Enforcement]
        // We defer notification to the next event loop tick to ensure that state updates
        // triggered by subscribers never happen during a React render cycle.
        setTimeout(() => {
            this.subscribers.forEach(s => s(intent));
        }, 0);
    }

    /**
     * Get the full history of intents for state reconstruction
     */
    getHistory(): Intent[] {
        return [...this.intents];
    }

    /**
     * 🧟 [Master-Slave Inversion] Poll backend for autonomous status
     */
    startPolling() {
        console.log("🧟 [IntentStream] Dashboard Polling Active. Listening to the industrial engine...");
        setInterval(async () => {
            try {
                const response = await fetch('http://localhost:51122/api/intents');
                if (response.ok) {
                    const latestIntents: Intent[] = await response.json();
                    this.mergeIntents(latestIntents);
                }
            } catch (err) {
                // Silently handle polling errors if backend is cycling
            }
        }, 5000);
    }

    private mergeIntents(externalIntents: Intent[]) {
        let changed = false;
        externalIntents.forEach(ext => {
            const local = this.intents.find(i => i.id === ext.id);
            if (!local) {
                this.intents.push(ext);
                this.notify(ext);
                changed = true;
            } else if (local.status !== ext.status) {
                local.status = ext.status;
                local.error = ext.error;
                this.notify(local);
                changed = true;
            }
        });
        if (changed) {
            console.log(`📡 [IntentStream] Merged ${externalIntents.length} intents from backend.`);
        }
    }

    private syncToBackend(intent: Intent) {
        // Use window.postMessage to relay through reactBridge to background -> backend
        window.postMessage({
            type: 'SYNC_INTENT_STATE',
            payload: intent
        }, '*');
    }
}

// Singleton instance for global intent streaming
export const intentStream = new IntentStream();

// Automatically start polling if in browser environment
if (typeof window !== 'undefined') {
    intentStream.startPolling();
}
