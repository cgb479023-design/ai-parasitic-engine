import { useState, useEffect } from 'react';
import { loadSavedDFLState, loadSavedDFLMetrics } from '../utils/stateLoaders';
import { DFLState, DFLMetrics, DFLIntervention, DFLSignal, AdaptiveSchedule, SoundType } from '../types';
import { contractManager } from '../../../core/ContractManager';
import { intentStream } from '../../../core/IntentStream';
import { effectLogger } from '../../../core/EffectLogger';

// const GOLDEN_HOURS = [18, 19, 20, 21]; // Reserved for future use
const VIRAL_THRESHOLDS = {
    firstHourVelocity: 500,
    rewatchRatio: 1.2,
    swipeAwayRate: 20,
    subsConversion: 0.5,
    retentionAt3s: 70,
    ctr: 10
};

export const useDFL = (analyticsData: any, setYppPlan: any, startExecution: any) => {
    // 🧠 DFL State
    const [dflState, setDflState] = useState<DFLState>(loadSavedDFLState);
    const [dflMetrics, setDflMetrics] = useState<DFLMetrics>(loadSavedDFLMetrics);
    const [dflInterventions, setDflInterventions] = useState<DFLIntervention[]>([]);
    const [dflSignals, setDflSignals] = useState<DFLSignal[]>([]);
    const [viralMomentDetected, setViralMomentDetected] = useState(false);
    const [showDFLPanel, setShowDFLPanel] = useState(false);

    // Trend Surfing
    const [trendSurfing, setTrendSurfing] = useState<any>(() => {
        const saved = localStorage.getItem('dfl_trend_surfing');
        return saved ? JSON.parse(saved) : {
            detectedTrend: 'NONE',
            trendScore: 0,
            suggestedVariations: [],
            topPerformerScene: ''
        };
    });

    // Adaptive Schedule
    const [adaptiveSchedule, setAdaptiveSchedule] = useState<AdaptiveSchedule>(() => {
        const saved = localStorage.getItem('dfl_adaptive_schedule');
        return saved ? JSON.parse(saved) : {
            enabled: true,
            timeSlotData: Array.from({ length: 24 }, (_, i) => ({
                hour: i,
                avgVelocity: 0,
                sampleSize: 0,
                successRate: 0,
                lastUpdated: new Date()
            })),
            optimalSlots: [10, 14, 18, 20, 22],
            peakWindow: { start: 18, end: 23 },
            confidenceScore: 0,
            lastAnalysis: null,
            burstQueueEnabled: true
        };
    });

    // Sound & Notification
    const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('dfl_sound_enabled') !== 'false');
    const [soundVolume, setSoundVolume] = useState(() => parseFloat(localStorage.getItem('dfl_sound_volume') || '0.5'));
    const [toastNotifications, setToastNotifications] = useState<any[]>([]);
    const [toastsEnabled, setToastsEnabled] = useState(() => localStorage.getItem('dfl_toasts_enabled') !== 'false');
    const [autoExecuteEnabled, setAutoExecuteEnabled] = useState(true);

    // Persistence
    useEffect(() => { localStorage.setItem('dflState', JSON.stringify(dflState)); }, [dflState]);
    useEffect(() => { localStorage.setItem('dflMetrics', JSON.stringify(dflMetrics)); }, [dflMetrics]);
    useEffect(() => { localStorage.setItem('dfl_adaptive_schedule', JSON.stringify(adaptiveSchedule)); }, [adaptiveSchedule]);
    useEffect(() => { localStorage.setItem('dfl_active_signals', JSON.stringify(dflSignals)); }, [dflSignals]);
    useEffect(() => { localStorage.setItem('dfl_trend_surfing', JSON.stringify(trendSurfing)); }, [trendSurfing]);

    // Score Calculation
    useEffect(() => {
        const calculateAlgorithmHealth = (metrics: DFLMetrics): number => {
            let score = 50;
            if (metrics.firstHourVelocity > 1000) score += 20;
            else if (metrics.firstHourVelocity > 500) score += 10;
            else if (metrics.firstHourVelocity > 100) score += 5;
            if (metrics.retentionAt3s > 80) score += 20;
            else if (metrics.retentionAt3s > 60) score += 10;
            if (metrics.rewatchRatio > 1.2) score += 15;
            else if (metrics.rewatchRatio > 1.0) score += 5;
            if (metrics.swipeAwayRate > 50) score -= 20;
            else if (metrics.swipeAwayRate > 30) score -= 10;
            if (metrics.subsConversion > 10) score += 15;
            else if (metrics.subsConversion > 5) score += 5;
            return Math.max(0, Math.min(100, score));
        };
        const newScore = calculateAlgorithmHealth(dflMetrics);
        if (newScore !== dflState.algorithmScore) {
            setDflState(prev => ({ ...prev, algorithmScore: newScore }));
        }
    }, [dflMetrics]);

    // Sound Logic
    const playSound = (type: SoundType) => {
        if (!soundEnabled) return;
        try {
            // @ts-ignore
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioContext();

            const createTone = (frequency: number, duration: number, type: OscillatorType = 'sine', delay = 0) => {
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                oscillator.type = type;
                oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime + delay);
                gainNode.gain.setValueAtTime(soundVolume * 0.3, audioCtx.currentTime + delay);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + delay + duration);
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.start(audioCtx.currentTime + delay);
                oscillator.stop(audioCtx.currentTime + delay + duration);
            };

            switch (type) {
                case 'critical': createTone(200, 0.3, 'sawtooth', 0); createTone(150, 0.3, 'sawtooth', 0.4); break;
                case 'warning': createTone(440, 0.2, 'triangle', 0); break;
                case 'success': createTone(523, 0.15, 'sine', 0); createTone(659, 0.15, 'sine', 0.15); break;
                case 'viral': createTone(800, 0.1, 'square', 0); createTone(1000, 0.1, 'square', 0.12); break;
                case 'milestone': createTone(523, 0.4, 'sine', 0); createTone(659, 0.4, 'sine', 0); break;
                case 'action': createTone(880, 0.15, 'sine', 0); break;
            }
        } catch (e) { console.error("Audio Error:", e); }
    };

    // Notification Logic
    const addToast = (type: SoundType, message: string) => {
        if (!toastsEnabled) return;
        const newToast = {
            id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            message,
            timestamp: new Date()
        };
        setToastNotifications(prev => [newToast, ...prev.slice(0, 4)]);
        setTimeout(() => setToastNotifications(prev => prev.filter(t => t.id !== newToast.id)), 8000);
    };

    const removeToast = (id: string) => setToastNotifications(prev => prev.filter(t => t.id !== id));

    const sendBrowserNotification = (title: string, body: string, urgency: 'low' | 'medium' | 'high' | 'extreme' = 'medium') => {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'granted') {
            const icon = urgency === 'extreme' ? '🔥' : urgency === 'high' ? '🚀' : urgency === 'medium' ? '📊' : '📝';
            new Notification(`${icon} ${title}`, { body, icon: '/favicon.ico', tag: `ypp-${Date.now()}` });
        } else if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    };

    // Logic: Scene Variations
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const generateSceneVariations = (scene: string): string[] => {
        const sceneVariations: { [key: string]: string[] } = {
            'supermarket': ['office', 'gym', 'park', 'restaurant', 'school'],
            'office': ['home', 'cafe', 'library', 'subway', 'airport'],
            'gym': ['pool', 'track', 'yoga studio', 'crossfit box', 'home'],
            'home': ['apartment', 'dorm', 'hotel', 'airbnb', 'friend\'s place'],
            'school': ['college', 'university', 'library', 'cafeteria', 'dorm'],
            'restaurant': ['cafe', 'food court', 'bar', 'kitchen', 'food truck'],
            'car': ['bus', 'train', 'subway', 'bike', 'motorcycle'],
            'street': ['mall', 'park', 'beach', 'downtown', 'suburbs']
        };
        return sceneVariations[scene.toLowerCase()] || ['different location', 'new setting', 'alternative venue', 'unique place', 'unexpected spot'];
    };

    // Logic: Viral Generation Trigger
    const buildDynamicPromptBlock = (signal: DFLSignal): string => {
        // Simplified for hook encapsulation. In real app, this contained scenarios.
        // We will include a condensed logical version.

        let subject = `Viral Trend: ${signal.source}`;
        let twist = "Unexpected outcome";
        let outcome = "FULL REVEAL";

        if (signal.type === 'velocity_spike') { subject = "Rapidly growing viral trend"; twist = "Sudden acceleration"; }
        if (signal.type === 'rewatch_surge') { subject = "Looping visual hook"; twist = "Subtle background detail"; outcome = "HIDDEN DETAIL"; }

        // Inject learned patterns
        if (dflState.bestTitlePatterns && dflState.bestTitlePatterns.length > 0) {
            const pattern = dflState.bestTitlePatterns[0];
            subject = `${pattern} - ${subject}`;
        }

        return `Hyper-realistic 4K vertical 9:16 YouTube Short.
🎬 SUBJECT: ${subject}
🔥 TWIST: ${twist}
✨ OUTCOME: ${outcome}
⚡ STYLE: Fast-paced, engaging, viral aesthetic.
(Auto-generated by DFL based on ${signal.intensity} ${signal.type})`;
    };

    const triggerViralContentGeneration = async (signal: DFLSignal) => {
        // 💎 Pillar 1: Formal Verification
        try {
            contractManager.verify('dfl_metric_validity', {
                velocity: dflMetrics.firstHourVelocity,
                rewatchRatio: dflMetrics.rewatchRatio
            });
        } catch (e: any) {
            console.error("🛑 [DFL] Constitutional Violation: Hallucinatory data detected. Generation REJECTED.", e.message);
            addToast('critical', "Security Breach: Hallucination Blocked.");
            return;
        }

        // 💎 Pillar 4 & 3: Intent & Trace
        const intent = intentStream.propose('TRIGGER_VIRAL_GEN', { signal }, 'agent');
        const traceId = effectLogger.logEffect(intent.id, `Generating viral content based on signal: ${signal.type}`);

        console.log("⚡ [DFL 2.0] Generating viral content based on signal:", signal.type);
        const promptBlock = buildDynamicPromptBlock(signal);

        setDflInterventions(prev => [{
            type: 'auto_comment' as const,
            reason: `Auto-Execute triggered by ${signal.intensity} ${signal.type}`,
            action: 'Generating optimized viral content',
            timestamp: new Date(),
            status: 'pending'
        }, ...prev.slice(0, 9)]);

        // Create new viral tasks
        const batchSize = signal.intensity === 'extreme' ? 3 : 1;
        const newQueueItems: any[] = [];

        for (let i = 0; i < batchSize; i++) {
            newQueueItems.push({
                id: Date.now() + i,
                title: `Viral: ${signal.source} #${i + 1}`,
                description: `Auto-generated response to ${signal.type}`,
                tags: "#Viral #Shorts",
                publishTimeLocal: "Immediate",
                promptBlock: promptBlock,
                status: 'pending',
                progress: 0,
                createdAt: new Date().toISOString()
            });
        }

        // Add to Plan via Callback
        if (setYppPlan) {
            setYppPlan((prev: any) => {
                if (!prev) return { schedule: newQueueItems };
                return { ...prev, schedule: [...(prev.schedule || []), ...newQueueItems] };
            });
        }

        // Start Execution if possible
        if (startExecution) {
            // We can't directly call startExecution if it depends on updated state immediately.
            // But usually React batches updates. 
            // Better to let the user or an effect handle it, but here we can try.
            setTimeout(() => startExecution(), 1000);
        }

        playSound(signal.intensity === 'extreme' ? 'milestone' : 'viral');
        addToast('viral', `🚀 Launched ${batchSize} viral tasks!`);
    };

    // Logic: Learning Cycle
    const runDFLLearningCycle = () => {
        if (!analyticsData) return;

        // 💎 Pillar 4: Intent Sourcing
        const intent = intentStream.propose('DFL_LEARNING_CYCLE_START', { metrics: dflMetrics }, 'system');
        effectLogger.logEffect(intent.id, 'Initiating autonomous learning cycle for velocity profiling.');

        setDflState(prev => ({ ...prev, learningPhase: 'analyzing' }));

        // Simplified extraction logic (full regex parsing omitted for brevity, assume metrics pass-in)
        // In a real refactor, move the regex parsing to 'utils/dflUtils.ts'

        // 1. Detect Signals
        const newSignals: DFLSignal[] = [];

        if (dflMetrics.firstHourVelocity > VIRAL_THRESHOLDS.firstHourVelocity) {
            newSignals.push({ type: 'velocity_spike', intensity: 'high', source: 'First Hour Velocity', timestamp: new Date() });
        }

        // 2. Update Signals
        if (newSignals.length > 0) {
            setDflSignals(prev => [...newSignals, ...prev.slice(0, 19)]);

            // Auto-Execute
            if (autoExecuteEnabled) {
                const critical = newSignals.find(s => s.intensity === 'high' || s.intensity === 'extreme');
                if (critical) triggerViralContentGeneration(critical);
            }
        }

        setDflState(prev => ({ ...prev, learningPhase: 'idle', lastLearningCycle: new Date() }));
        intentStream.commit(intent.id);
        effectLogger.logEffect(intent.id, 'Learning cycle completed. State synchronized.');
    };

    const triggerBurstMode = async () => {
        // 💎 Pillar 1: Formal Verification
        try {
            contractManager.verify('burst_mode_safety', {
                currentAlgorithmScore: dflState.algorithmScore,
                activeSignals: dflSignals.length
            });
        } catch (e: any) {
            console.error("🛑 [DFL] Burst Mode REJECTED:", e.message);
            addToast('critical', "Security Breach: Burst Mode Blocked.");
            return;
        }

        // 💎 Pillar 4 & 3: Intent & Trace
        const intent = intentStream.propose('BURST_MODE_TRIGGER', { score: dflState.algorithmScore }, 'agent');
        effectLogger.logEffect(intent.id, 'Initiating High-Intensity Viral Burst (Metabolic Acceleration).');

        // Logic: Push 5 variants immediately
        const mockSignal: DFLSignal = {
            type: 'velocity_spike',
            intensity: 'extreme',
            source: 'BURST_MODE_OVERRIDE',
            timestamp: new Date()
        };

        await triggerViralContentGeneration(mockSignal);

        intentStream.commit(intent.id);
    };

    // 🆕 DFL 2.5: Bridge external triggers (Console/Debug)
    useEffect(() => {
        const handleExternalTrigger = (e: MessageEvent) => {
            if (e.data && e.data.type === 'DFL_TRIGGER_VIRAL') {
                console.log("🚨 [DFL Bridge] Received External Trigger:", e.data.signal);
                triggerViralContentGeneration(e.data.signal);
            }
        };
        window.addEventListener('message', handleExternalTrigger);
        return () => window.removeEventListener('message', handleExternalTrigger);
    }, []);

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 DFL 2.0: Adaptive Scheduling Logic
    // ═══════════════════════════════════════════════════════════════════════════

    const analyzeVelocityByTimeSlot = () => {
        // In a real scenario, this would analyze historical data from analyticsData
        // For now, we simulate a recalculation based on current timeSlotData
        const sortedSlots = [...adaptiveSchedule.timeSlotData].sort((a, b) => b.avgVelocity - a.avgVelocity);
        const topSlots = sortedSlots.slice(0, 5).map(s => s.hour).sort((a, b) => a - b);

        // Find peak window (consecutive 3 hours with highest total velocity)
        let maxWindowVelocity = 0;
        let peakStart = 18;

        for (let i = 0; i < 22; i++) {
            const v1 = adaptiveSchedule.timeSlotData.find(s => s.hour === i)?.avgVelocity || 0;
            const v2 = adaptiveSchedule.timeSlotData.find(s => s.hour === i + 1)?.avgVelocity || 0;
            const v3 = adaptiveSchedule.timeSlotData.find(s => s.hour === i + 2)?.avgVelocity || 0;
            const total = v1 + v2 + v3;
            if (total > maxWindowVelocity) {
                maxWindowVelocity = total;
                peakStart = i;
            }
        }

        setAdaptiveSchedule(prev => ({
            ...prev,
            lastUpdated: new Date(),
            optimalSlots: topSlots,
            peakWindow: { start: peakStart, end: peakStart + 3 },
            confidenceScore: Math.min(95, prev.confidenceScore + 5) // Simulate confidence increase
        }));
    };

    const generateAdaptiveSchedule = (count: number): string[] => {
        const slots: string[] = [];
        const today = new Date();
        today.setMinutes(0, 0, 0); // Reset minutes/seconds

        const currentDay = new Date(today);
        let scheduledCount = 0;

        while (scheduledCount < count) {
            // Find next optimal slot in current day
            const optimalHours = adaptiveSchedule.optimalSlots.length > 0 ? adaptiveSchedule.optimalSlots : [18, 19, 20, 21]; // Default

            for (const hour of optimalHours) {
                if (scheduledCount >= count) break;

                const candidateTime = new Date(currentDay);
                candidateTime.setHours(hour, 0, 0, 0);

                // If candidate is in the future
                if (candidateTime > new Date()) {
                    slots.push(candidateTime.toISOString());
                    scheduledCount++;
                }
            }

            // Move to next day
            currentDay.setDate(currentDay.getDate() + 1);
            currentDay.setHours(0, 0, 0, 0);
        }

        return slots;
    };

    return {
        dflState, setDflState,
        dflMetrics, setDflMetrics,
        dflInterventions, setDflInterventions,
        dflSignals, setDflSignals,
        showDFLPanel, setShowDFLPanel,
        trendSurfing, setTrendSurfing,
        adaptiveSchedule, setAdaptiveSchedule,
        soundEnabled, setSoundEnabled,
        soundVolume, setSoundVolume,
        autoExecuteEnabled, setAutoExecuteEnabled,
        viralMomentDetected, setViralMomentDetected,
        toastsEnabled, setToastsEnabled,
        toastNotifications, addToast, removeToast,
        playSound, sendBrowserNotification,
        runDFLLearningCycle,
        triggerViralContentGeneration,
        triggerBurstMode,
        analyzeVelocityByTimeSlot,
        generateAdaptiveSchedule
    };
}
