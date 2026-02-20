import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { contractManager } from '../../../core/ContractManager';
import { intentStream } from '../../../core/IntentStream';
import { effectLogger } from '../../../core/EffectLogger';
import { YouTubeAnalyticsData } from '../types';

export const useAnalyticsData = () => {
    // 💾 Load saved analytics data
    const [analyticsData, setAnalyticsData] = useState<YouTubeAnalyticsData | null>(() => {
        try {
            const saved = localStorage.getItem('youtubeAnalyticsData');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.warn("Failed to load analytics data:", e);
        }
        return null;
    });

    const [isCollecting, setIsCollecting] = useState(false);
    const [isDirectCollecting, setIsDirectCollecting] = useState(false);
    const [collectionQueue, setCollectionQueue] = useState<string[]>([]);
    const [currentCollectionCategory, setCurrentCollectionCategory] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [progress, setProgress] = useState<string>('');

    // Time Ranges
    const [timeRange, setTimeRange] = useState<string>(() => localStorage.getItem('youtubeAnalyticsTimeRange') || 'default');
    const [overviewTimeRange, setOverviewTimeRange] = useState<string>(() => localStorage.getItem('analyticsOverviewTimeRange') || 'default');
    const [contentTimeRange, setContentTimeRange] = useState<string>(() => localStorage.getItem('analyticsContentTimeRange') || 'default');
    const [audienceTimeRange, setAudienceTimeRange] = useState<string>(() => localStorage.getItem('analyticsAudienceTimeRange') || 'default');

    // Session completion tracking
    const [sessionCompletedCategories, setSessionCompletedCategories] = useState<Set<string>>(new Set());
    const sessionCompletedCategoriesRef = useRef<Set<string>>(new Set());

    // Auto-Refresh
    const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(() => {
        try {
            const saved = localStorage.getItem('analyticsLastRefreshTime');
            return saved ? new Date(saved) : null;
        } catch (e) { return null; }
    });

    // Custom Query Result (part of Analytics)
    const [customResult, setCustomResult] = useState<any>(null);
    const [isCustomCollecting, setIsCustomCollecting] = useState(false);

    // Persistence Effects
    useEffect(() => { localStorage.setItem('analyticsTimeRange', timeRange); }, [timeRange]);
    useEffect(() => { localStorage.setItem('analyticsOverviewTimeRange', overviewTimeRange); }, [overviewTimeRange]);
    useEffect(() => { localStorage.setItem('analyticsContentTimeRange', contentTimeRange); }, [contentTimeRange]);
    useEffect(() => { localStorage.setItem('analyticsAudienceTimeRange', audienceTimeRange); }, [audienceTimeRange]);

    useEffect(() => {
        if (analyticsData) {
            localStorage.setItem('youtubeAnalyticsData', JSON.stringify(analyticsData));
        }
    }, [analyticsData]);

    useEffect(() => {
        if (lastRefreshTime) {
            localStorage.setItem('analyticsLastRefreshTime', lastRefreshTime.toISOString());
        }
    }, [lastRefreshTime]);

    // Clear session on new collection
    useEffect(() => {
        if (isDirectCollecting) {
            sessionCompletedCategoriesRef.current.clear();
            setSessionCompletedCategories(new Set());
        }
    }, [isDirectCollecting]);

    // Analytics Message Listener
    useEffect(() => {
        const messageListener = (event: MessageEvent) => {
            if (event.source !== window || !event.data || event.data.source !== 'extension') return;

            const { type, data } = event.data;

            if (type === 'YOUTUBE_ANALYTICS_RESULT' || type === 'YOUTUBE_ANALYTICS_DIRECT_RESULT') {
                const resultData = type === 'YOUTUBE_ANALYTICS_DIRECT_RESULT' ? data : event.data;
                let { category, data: payload } = resultData;

                // 🔄 Standardize Category Names (Legacy -> Full)
                const categoryMap: Record<string, string> = {
                    'over': 'overview',
                    'perf': 'content',
                    'aud': 'audience',
                    'traf': 'traffic',
                    'eng': 'engagement',
                    'com': 'comments'
                };
                if (categoryMap[category]) {
                    console.log(`🔄 [Hook] Mapping legacy category "${category}" to "${categoryMap[category]}"`);
                    category = categoryMap[category];
                }

                if (category && payload) {
                    console.log(`📊 [Hook] Received ${type}:`, category);

                    // 🔗 Normalization: If it's a DIRECT result, wrap it to match legacy structure expected by panels
                    if (type === 'YOUTUBE_ANALYTICS_DIRECT_RESULT') {
                        payload = {
                            results: [{
                                data: payload,
                                category: category,
                                timestamp: new Date().toISOString()
                            }]
                        };
                    }

                    const intentId = payload.intentId || event.data.intentId;
                    if (intentId) {
                        effectLogger.logEffect(intentId, `Data received for category: ${category}`);
                    }

                    setSessionCompletedCategories(prev => new Set(prev).add(category));

                    // Advance Queue
                    setCollectionQueue(prev => {
                        if (prev.length > 0 && prev[0] === category) {
                            return prev.slice(1);
                        }
                        return prev;
                    });

                    setCurrentCollectionCategory(null);

                    if (category === 'overview' || category === 'content' || category === 'audience') {
                        try {
                            payload = contractManager.verify('analytics_payload', payload);
                            if (intentId) {
                                intentStream.commit(intentId);
                                effectLogger.logEffect(intentId, `Formal Verification Passed & Intent Committed for ${category}`);
                            }
                        } catch (e) {
                            console.error(`🛑 [Hook] Formal Verification Failed for ${category}:`, e);
                            return; // Drop invalid payload
                        }
                    }

                    setAnalyticsData((prev: any) => ({
                        ...(prev || {}),
                        [category]: payload
                    }));

                    setLastRefreshTime(new Date());

                    if (category === 'custom') {
                        setCustomResult(payload.results?.[0] || null);
                        setIsCustomCollecting(false);
                        setProgress('✅ Custom Query Answered!');
                    }
                }
            }

            if (type === 'COLLECTION_COMPLETE') {
                setIsCollecting(false);
                setProgress('Collection completed!');
            }
        };

        window.addEventListener('message', messageListener);
        return () => window.removeEventListener('message', messageListener);
    }, []);

    // V6.0 MONITOR CLUSTER: Queue Driver & Polling
    useEffect(() => {
        if (collectionQueue.length > 0 && !currentCollectionCategory && isCollecting) {
            const nextCategory = collectionQueue[0];
            setCurrentCollectionCategory(nextCategory);
            setRetryCount(0);
            setProgress(`Initiating headless scrape for ${nextCategory}...`);

            // Trigger backend scrape mission
            fetch('/api/analytics/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: nextCategory, timeRange: timeRange })
            }).catch(e => console.error("❌ [Polling] Failed to trigger scrape:", e));

        } else if (collectionQueue.length === 0 && isCollecting && !currentCollectionCategory && analyticsData) {
            setIsCollecting(false);
            setProgress('🎉 Full Report Synchronized!');
        }
    }, [collectionQueue, currentCollectionCategory, isCollecting, analyticsData, timeRange]);

    // V6.0 MONITOR CLUSTER: Results Polling Logic
    useEffect(() => {
        if (!isCollecting || !currentCollectionCategory) return;

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/analytics/data?category=${currentCollectionCategory}&timeRange=${timeRange}`);
                if (response.ok) {
                    const data = await response.json();

                    // Dispatch success to existing message listener or handle directly
                    window.postMessage({
                        source: 'extension',
                        type: 'YOUTUBE_ANALYTICS_RESULT',
                        category: currentCollectionCategory,
                        data: data
                    }, '*');
                }
            } catch (e) {
                console.warn(`⏳ [Polling] ${currentCollectionCategory} data not yet available in cache...`);
            }
        }, 5000);

        return () => clearInterval(pollInterval);
    }, [isCollecting, currentCollectionCategory, timeRange]);

    // Custom Query State
    const [customQuery, setCustomQuery] = useState('');
    const [askAsJson, setAskAsJson] = useState(false);

    // Actions
    const handleRetry = () => {
        setRetryCount(prev => prev + 1);
        if (currentCollectionCategory) {
            fetch('/api/analytics/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: currentCollectionCategory, timeRange: timeRange })
            });
        }
    };

    const handleCustomQuerySubmit = async () => {
        if (!customQuery.trim()) return;

        const intent = intentStream.propose('CUSTOM_QUERY_SUBMIT', { query: customQuery, jsonMode: askAsJson }, 'user');
        effectLogger.logEffect(intent.id, `User submitted custom query: ${customQuery.substring(0, 50)}...`);

        setIsCustomCollecting(true);
        setCustomResult(null);

        // Custom queries currently mapped to research/overview for headless
        await fetch('/api/analytics/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category: 'research',
                question: customQuery,
                jsonMode: askAsJson,
                intentId: intent.id
            })
        });
    };

    const handleManualCollect = () => {
        const queue = ['overview', 'content', 'audience', 'traffic', 'engagement'];
        const intent = intentStream.propose('MANUAL_COLLECT_START', { queue }, 'user');
        effectLogger.logEffect(intent.id, 'User initiated autonomous collection sweep.');

        setIsCollecting(true);
        setCollectionQueue(queue);
        setCurrentCollectionCategory(null);
        setRetryCount(0);
        setProgress('Dispatched autonomous sweep...');
    };

    return {
        analyticsData,
        setAnalyticsData,
        isCollecting,
        setIsCollecting,
        isDirectCollecting,
        setIsDirectCollecting,
        collectionQueue,
        setCollectionQueue,
        currentCollectionCategory,
        retryCount,
        handleRetry,
        progress,
        setProgress,
        timeRange,
        setTimeRange,
        overviewTimeRange,
        setOverviewTimeRange,
        contentTimeRange,
        setContentTimeRange,
        audienceTimeRange,
        setAudienceTimeRange,
        lastRefreshTime,
        customResult,
        setCustomResult,
        isCustomCollecting,
        setIsCustomCollecting,
        customQuery,
        setCustomQuery,
        askAsJson,
        setAskAsJson,
        handleCustomQuerySubmit,
        handleManualCollect
    };
};
