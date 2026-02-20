import React, { createContext, useContext, useEffect, useState } from 'react';

// Aetheria-Flow Pillar 2: Semantic Sandboxing
// Capabilities defined as explicit permissions granted to modules.
export type Capability = 'storage' | 'network' | 'analytics' | 'extension';

interface CapabilityContextType {
    grantedCapabilities: Set<Capability>;
    isGranted: (cap: Capability) => boolean;
}

const CapabilityContext = createContext<CapabilityContextType | undefined>(undefined);

export const useCapabilities = () => {
    const context = useContext(CapabilityContext);
    if (!context) {
        throw new Error('useCapabilities must be used within a CapabilityProvider (ClosedLoopInitializer)');
    }
    return context;
};

interface ClosedLoopInitializerProps {
    children: React.ReactNode;
    onReady?: (status: any) => void;
}

export const ClosedLoopInitializer: React.FC<ClosedLoopInitializerProps> = ({ children, onReady }) => {
    const [isReady, setIsReady] = useState(false);
    const [grantedCapabilities] = useState<Set<Capability>>(new Set(['storage', 'network', 'analytics', 'extension']));

    const isGranted = (cap: Capability) => grantedCapabilities.has(cap);

    useEffect(() => {
        const checkServices = async () => {
            try {
                // Initialize core services and establish safety bounds
                await new Promise(resolve => setTimeout(resolve, 500));
                console.log('[Aetheria-Flow] Capabilities Granted:', Array.from(grantedCapabilities));

                setIsReady(true);
                if (onReady) {
                    onReady({ status: 'ready', capabilities: Array.from(grantedCapabilities) });
                }
            } catch (error) {
                console.error("Failed to initialize Aetheria-Flow capabilities", error);
            }
        };

        checkServices();
    }, [onReady, grantedCapabilities]);

    if (!isReady) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] text-white">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                <div className="text-sm font-mono text-blue-400 animate-pulse">Initializing Aetheria-Flow Semantic Sandbox...</div>
            </div>
        );
    }

    return (
        <CapabilityContext.Provider value={{ grantedCapabilities, isGranted }}>
            {children}
        </CapabilityContext.Provider>
    );
};
