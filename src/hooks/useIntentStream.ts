// h:\AI_Neural_Engine_Clean_v3.5\src\hooks\useIntentStream.ts
import { useState, useEffect } from 'react';
import { intentStream, Intent } from '../core/IntentStream';

export function useIntentStream() {
    const [intents, setIntents] = useState<Intent[]>([]);

    useEffect(() => {
        // Initial state sync
        setIntents(intentStream.getHistory());

        // Subscribe to stream updates
        const unsubscribe = intentStream.subscribe((updatedIntent) => {
            setIntents(prev => {
                const exists = prev.find(i => i.id === updatedIntent.id);
                if (exists) {
                    return prev.map(i => i.id === updatedIntent.id ? updatedIntent : i);
                }
                return [updatedIntent, ...prev];
            });
        });

        return () => unsubscribe();
    }, []);

    return {
        intents,
        // Helper to push new intents
        propose: (type: string, payload: any, origin: any) => intentStream.propose(type, payload, origin)
    };
}
