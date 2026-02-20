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
    const [serverStatus, setServerStatus] = useState<'connected' | 'disconnected' | 'error' | 'unknown'>('unknown');

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

    // Actions
    const checkServerStatus = async () => {
        try {
            const response = await fetch('/health');
            if (response.ok) {
                setServerStatus('connected');
            } else {
                setServerStatus('error');
            }
        } catch (e) {
            setServerStatus('disconnected');
        }
    };

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

            // [V2.0 Master-Slave Inversion] Extension logic neutralized
        };

        window.addEventListener('message', handleMessage);

        // Initial Check
        checkServerStatus();

        // Periodic Check (Heartbeat)
        const interval = setInterval(() => {
            checkServerStatus();
        }, 10000);

        return () => {
            window.removeEventListener('message', handleMessage);
            clearInterval(interval);
        };
    }, []);

    // Single Category Collection (V6.0 Headless Transition)
    const collectSingleCategory = async (category: 'overview' | 'content' | 'audience', timeRange: string) => {
        const intent = intentStream.propose('COLLECT_ANALYTICS', { category, timeRange }, 'user');
        const causeId = effectLogger.logEffect(intent.id, `Triggering autonomous ${category} collection mission`);

        try {
            const response = await fetch('/api/analytics/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, timeRange, intentId: intent.id })
            });

            if (response.ok) {
                effectLogger.logEffect(causeId, `Headless scrape mission dispatched for ${category}`);
            } else {
                throw new Error('Backend rejection');
            }
        } catch (e) {
            console.error(`❌ [Headless Scrape] Dispatch failed for ${category}:`, e);
            effectLogger.logEffect(causeId, `Headless scrape mission FAILED to dispatch: ${e.message}`);
        }
    };

    return {
        shortsList, setShortsList,
        commentsData, setCommentsData,
        notifications, setNotifications,
        analyticsLogs, setAnalyticsLogs,
        serverStatus, checkServerStatus,
        commentsQueueStatus,
        collectSingleCategory
    };
};
