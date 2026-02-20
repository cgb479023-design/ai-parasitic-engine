import { intentStream } from './IntentStream';
import { effectLogger } from './EffectLogger';

/**
 * Pillar 6: The Debug Bridge
 * Integrates application logs, intents, and effects into a unified observable stream.
 */
class DebugBridge {
    private static instance: DebugBridge;
    private isReporting: boolean = false;
    private isIntegrated: boolean = false;
    private originalConsole: any = {};

    private constructor() {
        this.originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info
        };
    }

    public static getInstance(): DebugBridge {
        if (!DebugBridge.instance) {
            DebugBridge.instance = new DebugBridge();
        }
        return DebugBridge.instance;
    }

    /**
     * Integrates with global console and Aetheria-Flow streams
     */
    public integrate() {
        if (this.isIntegrated) return;

        const self = this;

        // 🛡️ [Security Pillar: Memory Safety]
        // Sanitizes objects to prevent OOM when logging large Base64 strings (videos)
        const sanitize = (obj: any, depth = 0): any => {
            if (depth > 3) return '[Max Depth]';
            if (obj === null || typeof obj !== 'object') {
                if (typeof obj === 'string' && obj.length > 2000) {
                    return obj.substring(0, 2000) + '... [TRUNCATED]';
                }
                return obj;
            }
            if (Array.isArray(obj)) return obj.map(item => sanitize(item, depth + 1));

            const sanitized: any = {};
            for (const key in obj) {
                // Strip known large fields
                if (['videoData', 'payload', 'base64', 'image', 'dataUrl'].includes(key.toLowerCase())) {
                    sanitized[key] = `[Large Data Stripped: ${typeof obj[key] === 'string' ? obj[key].length : 'Object'}]`;
                    continue;
                }
                sanitized[key] = sanitize(obj[key], depth + 1);
            }
            return sanitized;
        };

        // 1. Intercept Console
        (['log', 'error', 'warn', 'info'] as const).forEach(method => {
            console[method] = (...args: any[]) => {
                // Call original console regardless
                this.originalConsole[method].apply(console, args);

                // Reentrancy Guard: Prevent infinite loop if intentStream/effectLogger log something
                if (this.isReporting) return;

                // 🛡️ [Security Pillar: Loop Protection]
                // Immediately ignore logs that originate from our own core streams
                const firstArg = String(args[0] || '');
                if (firstArg.startsWith('[IntentStream]') || firstArg.startsWith('[EffectLogger]') || firstArg.startsWith('[IntentTrace]')) {
                    return;
                }

                this.isReporting = true;
                try {
                    // 🛡️ [Fix] Defer proposal to avoid React state-update-during-render error
                    setTimeout(() => {
                        try {
                            const sanitizedContent = args.map(a => {
                                const clean = sanitize(a);
                                return typeof clean === 'object' ? JSON.stringify(clean) : String(clean);
                            }).join(' ');

                            intentStream.propose('DEBUG_LOG', {
                                method,
                                content: sanitizedContent
                            }, 'system');
                        } finally {
                            this.isReporting = false; // 🛡️ Reset flag AFTER the async task completes
                        }
                    }, 0);
                } catch (e) {
                    this.isReporting = false;
                    throw e;
                }
            };
        });

        // 2. Subscribe to IntentStream for side-channel reporting
        intentStream.subscribe((intent) => {
            if (intent.type !== 'DEBUG_LOG') {
                this.originalConsole.info(`[IntentTrace] ${intent.type}`, intent.payload);
            }
        });

        this.originalConsole.info(`[DebugBridge] 🔍 Integration Complete. DevTools active.`);
        this.isIntegrated = true;
    }
}

export const debugBridge = DebugBridge.getInstance();
export default debugBridge;
