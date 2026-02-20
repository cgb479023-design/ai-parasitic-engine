/**
 * Aetheria-Flow Pillar 5: Shadow Execution
 * The ShadowRunner enables parallel logic execution and result comparison,
 * ensuring safety and determinism during system updates.
 */

export interface ShadowResult<T> {
    primary: T;
    shadow?: T;
    match: boolean;
    error?: string;
}

class ShadowRunner {
    /**
     * Execute two versions of the same logic in parallel and compare results.
     * The 'primary' result is always returned, but the comparison is logged.
     */
    async execute<T>(
        id: string,
        primaryFunc: () => Promise<T>,
        shadowFunc?: () => Promise<T>
    ): Promise<ShadowResult<T>> {
        const start = Date.now();
        console.log(`[ShadowRunner] ⚔️ Executing Shadow Grid: ${id}`);

        try {
            const primaryPromise = primaryFunc();

            if (!shadowFunc) {
                const primary = await primaryPromise;
                return { primary, match: true };
            }

            // Run shadow in parallel
            const [primary, shadowResult] = await Promise.allSettled([
                primaryPromise,
                shadowFunc()
            ]);

            const result: ShadowResult<T> = {
                primary: primary.status === 'fulfilled' ? primary.value : undefined as any,
                shadow: shadowResult.status === 'fulfilled' ? shadowResult.value : undefined as any,
                match: false
            };

            if (primary.status === 'rejected') {
                throw primary.reason;
            }

            if (shadowResult.status === 'fulfilled') {
                result.match = JSON.stringify(result.primary) === JSON.stringify(result.shadow);
                if (result.match) {
                    console.log(`[ShadowRunner] ✅ Result Match for ${id} (${Date.now() - start}ms)`);
                } else {
                    console.warn(`[ShadowRunner] ⚠️ Result Mismatch for ${id}! Check behavioral drift.`);
                    console.dir({ primary: result.primary, shadow: result.shadow });
                }
            } else {
                console.error(`[ShadowRunner] ❌ Shadow Execution Failed for ${id}:`, shadowResult.reason);
                result.error = shadowResult.reason.message;
            }

            return result;
        } catch (error: any) {
            console.error(`[ShadowRunner] 💥 Primary Execution Failed for ${id}:`, error);
            throw error;
        }
    }
}

// Singleton instance for global shadow execution control
export const shadowRunner = new ShadowRunner();
