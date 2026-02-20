import { useState, useEffect, useRef } from 'react';
import { ShortsData, ICommentData, INotification } from '../types';
import { intentStream } from '../../../core/IntentStream';
import { effectLogger } from '../../../core/EffectLogger';


export const useYouTubeData = () => {
    // State
    const [shortsList, setShortsList] = useState<ShortsData[]>(() => {
        const saved = localStorage.getItem('youtubeShortsData');
        return saved ? JSON.parse(saved) : [];
    });

    const [commentsData, setCommentsData] = useState<ICommentData[]>(() => {
        const saved = localStorage.getItem('youtubeCommentsData');
        return saved ? JSON.parse(saved) : [];
    });

    const [notifications, setNotifications] = useState<INotification[]>(() => {
        const saved = localStorage.getItem('youtubeNotifications');
        return saved ? JSON.parse(saved) : [];
    });

    const [analyticsLogs, setAnalyticsLogs] = useState<string[]>([]);
    const [extensionStatus, setExtensionStatus] = useState<string>('unknown');
    const [isExtensionInvalidated, setIsExtensionInvalidated] = useState(false);

    // Derived State
    const [commentsQueueStatus, setCommentsQueueStatus] = useState({
        pendingCount: 0,
        processedCount: 0,
        isProcessing: false
    });

    // Refs for safe access in listeners
    const shortsRef = useRef(shortsList);
    const commentsRef = useRef(commentsData);

    useEffect(() => { shortsRef.current = shortsList; }, [shortsList]);
    useEffect(() => { commentsRef.current = commentsData; }, [commentsData]);

    // Persistence
    useEffect(() => {
        localStorage.setItem('youtubeShortsData', JSON.stringify(shortsList));
    }, [shortsList]);

    useEffect(() => {
        localStorage.setItem('youtubeCommentsData', JSON.stringify(commentsData));
    }, [commentsData]);

    useEffect(() => {
        localStorage.setItem('youtubeNotifications', JSON.stringify(notifications));
    }, [notifications]);

    // Listeners
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (!message) return;

            if (message.type === 'YOUTUBE_SHORTS_DATA') {
                if (Array.isArray(message.data)) {
                    setShortsList(message.data);
                }
            }

            if (message.type === 'YOUTUBE_COMMENTS_DATA' || message.action === 'relayComments') {
                if (message.data) setCommentsData(message.data);
                if (message.queueStatus) setCommentsQueueStatus(message.queueStatus);
            }

            if (message.type === 'YOUTUBE_NOTIFICATIONS') {
                setNotifications(message.data);
            }

            if (message.type === 'IGNITION_SUCCESS') {
                setCommentsData(prev => prev.map(c =>
                    c.id === message.commentId ? { ...c, isReplied: true } : c
                ));
            }

            if (message.action === 'relayAnalyticsLog') {
                setAnalyticsLogs(prev => [...prev.slice(-4), message.message]);
            }

            if (message.type === 'EXTENSION_STATUS_RESULT' || message.type === 'EXTENSION_STATUS_RESPONSE') {
                console.log(`🔌 [Hook] Extension Status Received (${message.type}):`, message.status, message.source || 'background');
                setExtensionStatus(message.status === 'active' ? 'connected' : message.status);
                setIsExtensionInvalidated(false);
            }

            if (message.type === 'EXTENSION_INVALIDATED') {
                setIsExtensionInvalidated(true);
            }

            if (message.type === 'YOUTUBE_ANALYTICS_DIRECT_RESULT') {
                console.log("📊 [Hook] Received Direct Analytics Result:", message.data?.category);
                // The actual mapping of this data into a global store or shared state 
                // might be needed if multiple components use it.
                // For now, we can log it or bridge it to useAnalyticsData if they are used together.
            }
        };

        window.addEventListener('message', handleMessage);

        // Initial Check
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ action: 'checkStatus' }, (res) => {
                    if (chrome.runtime.lastError) {
                        window.postMessage({ type: 'CHECK_EXTENSION_STATUS' }, '*');
                    }
                });
            } else {
                window.postMessage({ type: 'CHECK_EXTENSION_STATUS' }, '*');
            }
        } catch {
            window.postMessage({ type: 'CHECK_EXTENSION_STATUS' }, '*');
        }

        // Periodic Check
        const interval = setInterval(() => {
            try {
                if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                    chrome.runtime.sendMessage({ action: 'checkStatus' }, (_response) => {
                        if (chrome.runtime.lastError) {
                            window.postMessage({ type: 'CHECK_EXTENSION_STATUS' }, '*');
                        } else {
                            setIsExtensionInvalidated(false);
                        }
                    });
                } else {
                    window.postMessage({ type: 'CHECK_EXTENSION_STATUS' }, '*');
                }
            } catch {
                window.postMessage({ type: 'CHECK_EXTENSION_STATUS' }, '*');
            }
        }, 5000);

        return () => {
            window.removeEventListener('message', handleMessage);
            clearInterval(interval);
        };
    }, []);

    // Actions
    const checkExtensionStatus = () => {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ action: 'checkStatus' }, (res) => {
                    if (chrome.runtime.lastError) {
                        window.postMessage({ type: 'CHECK_EXTENSION_STATUS' }, '*');
                    }
                });
            } else {
                window.postMessage({ type: 'CHECK_EXTENSION_STATUS' }, '*');
            }
        } catch {
            window.postMessage({ type: 'CHECK_EXTENSION_STATUS' }, '*');
        }
    };

    // Single Category Collection (Pass-through logic)
    const collectSingleCategory = (category: 'overview' | 'content' | 'audience', timeRange: string) => {
        // This logic involves opening windows and posting messages.
        // It might be better adjacent to where it's called or in a util, 
        // but placing it here centralizes "Data Collection" logic.

        const tabMap: Record<string, string> = {
            'overview': 'tab-overview',
            'content': 'tab-content',
            'audience': 'tab-build_audience'
        };

        const intent = intentStream.propose('COLLECT_ANALYTICS', { category, timeRange }, 'user');
        const causeId = effectLogger.logEffect(intent.id, `Triggering ${category} collection`);

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ analyticsTimeRange: timeRange });
            effectLogger.logEffect(causeId, 'Saved timeRange to chrome.storage');
        }

        const getTimeRangePath = (range: string): string => {
            switch (range) {
                case 'week': return 'period-week';
                case 'default': return 'period-default';
                case 'quarter': return 'period-quarter';
                case 'year': return 'period-year';
                case 'lifetime': return 'period-lifetime';
                default: return 'period-default';
            }
        };

        const pathSuffix = getTimeRangePath(timeRange);
        const basePath = `https://studio.youtube.com/channel/mine/analytics/${tabMap[category]}`;
        const url = `${basePath}/${pathSuffix}`;

        const win = window.open(url, JSON.stringify({ timeRange: timeRange, singleCategory: category }));

        const interval = setInterval(() => {
            if (win && !win.closed) {
                win.postMessage({
                    type: 'REQUEST_YOUTUBE_ANALYTICS',
                    payload: {
                        action: 'scrape_analytics_direct',
                        category: category,
                        targetTimeRange: timeRange,
                        intentId: intent.id // Pass intentId for downstream tracing
                    }
                }, '*');
                effectLogger.logEffect(causeId, `Posted scrape request to tab for ${category}`);
            } else {
                clearInterval(interval);
            }
        }, 2000);

        setTimeout(() => {
            clearInterval(interval);
        }, 30000);
    };

    return {
        shortsList, setShortsList,
        commentsData, setCommentsData,
        notifications, setNotifications,
        analyticsLogs, setAnalyticsLogs,
        extensionStatus, isExtensionInvalidated, checkExtensionStatus,
        commentsQueueStatus,
        collectSingleCategory
    };
};
