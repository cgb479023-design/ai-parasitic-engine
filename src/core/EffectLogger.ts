/**
 * Aetheria-Flow Pillar 3: Causal Tracing
 * The EffectLogger maps actions to their cascading consequences, 
 * providing a high-resolution map of system behavior.
 */

export interface Effect {
    id: string;
    timestamp: number;
    cause: string;       // The triggering action or event ID
    description: string; // Human/Agent readable description
    metadata?: any;      // Additional context (e.g., payload size, latency)
}

class EffectLogger {
    private effects: Effect[] = [];

    /**
     * Log a new effect and link it to its cause
     */
    logEffect(cause: string, description: string, metadata?: any): string {
        const id = `eff_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const effect: Effect = {
            id,
            timestamp: Date.now(),
            cause,
            description,
            metadata
        };

        this.effects.push(effect);

        return id;
    }

    /**
     * Retrieve the causal chain for a specific effect or cause
     */
    getChain(rootCauseId: string): Effect[] {
        return this.effects.filter(e => e.cause === rootCauseId);
    }

    /**
     * Get the most recent effects
     */
    getRecent(count: number = 10): Effect[] {
        return this.effects.slice(-count);
    }
}

// Singleton instance for global causal tracing
export const effectLogger = new EffectLogger();
