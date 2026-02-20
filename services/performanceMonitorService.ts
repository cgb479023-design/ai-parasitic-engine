/**
 * Real-Time Performance Monitoring Service
 * 
 * Monitors video performance in the crucial first hour and triggers
 * automatic adjustments if metrics fall below thresholds.
 * 
 * @module services/performanceMonitorService
 * @version 1.0.0
 * @date 2026-01-08
 */

import { abTestingService } from './abTestingService';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface PerformanceAlert {
    id: string;
    videoId: string;
    videoTitle: string;
    type: 'critical' | 'warning' | 'info' | 'success';
    message: string;
    recommendation: string;
    timestamp: Date;
    metrics: {
        views: number;
        targetViews: number;
        velocity: number; // views per minute
    };
    dismissed: boolean;
}

export interface MonitoredVideo {
    videoId: string;
    title: string;
    publishTime: Date;
    snapshots: PerformanceSnapshot[];
    alerts: string[]; // Alert IDs
    status: 'watching' | 'on_track' | 'underperforming' | 'viral';
    abTestStarted: boolean;
}

export interface PerformanceSnapshot {
    timestamp: Date;
    views: number;
    likes: number;
    comments: number;
    velocity: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
    // Monitoring intervals
    CHECK_INTERVAL_MS: 5 * 60 * 1000, // Check every 5 minutes
    FIRST_HOUR_DURATION: 60 * 60 * 1000,

    // Performance thresholds (views at minute marks)
    THRESHOLDS: {
        10: { critical: 5, warning: 15, good: 50 },
        20: { critical: 20, warning: 50, good: 150 },
        30: { critical: 50, warning: 100, good: 300 },
        45: { critical: 100, warning: 200, good: 500 },
        60: { critical: 200, warning: 400, good: 1000 }
    },

    // Velocity thresholds (views per minute)
    VELOCITY: {
        CRITICAL: 0.5,   // Less than 0.5 views/min = critical
        WARNING: 2,      // Less than 2 views/min = warning
        GOOD: 5,         // 5+ views/min = good
        VIRAL: 20        // 20+ views/min = potential viral
    },

    // Auto-actions
    AUTO_AB_TEST_THRESHOLD: 15, // Start A/B test if under threshold at 15 min
    AUTO_BOOST_THRESHOLD: 30    // Trigger boost action at 30 min if underperforming
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

const monitoredVideos: Map<string, MonitoredVideo> = new Map();
const alerts: Map<string, PerformanceAlert> = new Map();
let monitoringInterval: NodeJS.Timeout | null = null;

// ═══════════════════════════════════════════════════════════════════════════════
// MONITORING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Start monitoring a newly published video.
 */
export function startMonitoring(videoId: string, title: string): MonitoredVideo {
    console.log(`👁️ [Monitor] Starting to monitor: ${title}`);

    const video: MonitoredVideo = {
        videoId,
        title,
        publishTime: new Date(),
        snapshots: [],
        alerts: [],
        status: 'watching',
        abTestStarted: false
    };

    monitoredVideos.set(videoId, video);

    // Start the global monitoring loop if not running
    if (!monitoringInterval) {
        monitoringInterval = setInterval(checkAllVideos, CONFIG.CHECK_INTERVAL_MS);
    }

    // First check after 5 minutes
    setTimeout(() => checkVideo(videoId), 5 * 60 * 1000);

    return video;
}

/**
 * Stop monitoring a video.
 */
export function stopMonitoring(videoId: string): void {
    monitoredVideos.delete(videoId);
    console.log(`👁️ [Monitor] Stopped monitoring: ${videoId}`);

    // Stop global loop if no videos being monitored
    if (monitoredVideos.size === 0 && monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
}

/**
 * Check all monitored videos.
 */
async function checkAllVideos(): Promise<void> {
    for (const [videoId, video] of monitoredVideos) {
        const elapsed = Date.now() - video.publishTime.getTime();

        // Stop monitoring after first hour
        if (elapsed > CONFIG.FIRST_HOUR_DURATION) {
            console.log(`👁️ [Monitor] First hour complete for: ${video.title}`);
            stopMonitoring(videoId);
            continue;
        }

        await checkVideo(videoId);
    }
}

/**
 * Check a single video's performance.
 */
async function checkVideo(videoId: string): Promise<void> {
    const video = monitoredVideos.get(videoId);
    if (!video) return;

    const performance = await fetchVideoPerformance(videoId);
    if (!performance) return;

    const elapsedMinutes = Math.floor((Date.now() - video.publishTime.getTime()) / 60000);

    // Calculate velocity
    const prevSnapshot = video.snapshots[video.snapshots.length - 1];
    const velocity = prevSnapshot
        ? (performance.views - prevSnapshot.views) / 5 // Assuming 5-min interval
        : performance.views / Math.max(elapsedMinutes, 1);

    // Record snapshot
    const snapshot: PerformanceSnapshot = {
        timestamp: new Date(),
        views: performance.views,
        likes: performance.likes,
        comments: performance.comments,
        velocity
    };
    video.snapshots.push(snapshot);

    console.log(`👁️ [Monitor] ${video.title} @ ${elapsedMinutes}min: ${performance.views} views (${velocity.toFixed(1)} v/min)`);

    // Evaluate performance
    const evaluation = evaluatePerformance(elapsedMinutes, performance.views, velocity);
    video.status = evaluation.status;

    // Generate alerts if needed
    if (evaluation.alert) {
        const alert = createAlert(videoId, video.title, evaluation.alert as { type: PerformanceAlert['type']; message: string; recommendation: string });
        video.alerts.push(alert.id);

        // Notify UI
        notifyUI(alert);
    }

    // Auto-actions
    if (evaluation.status === 'underperforming' && !video.abTestStarted) {
        // Start A/B test if underperforming after 15 minutes
        if (elapsedMinutes >= CONFIG.AUTO_AB_TEST_THRESHOLD) {
            console.log(`👁️ [Monitor] Auto-starting A/B test for: ${video.title}`);
            abTestingService.startABTest(videoId, video.title);
            video.abTestStarted = true;
        }
    }

    // Trigger cross-platform boost if still underperforming at 30 min
    if (evaluation.status === 'underperforming' && elapsedMinutes >= CONFIG.AUTO_BOOST_THRESHOLD) {
        triggerCrossPlatformBoost(videoId, video.title);
    }
}

/**
 * Evaluate performance against thresholds.
 */
function evaluatePerformance(
    elapsedMinutes: number,
    views: number,
    velocity: number
): { status: MonitoredVideo['status']; alert?: { type: PerformanceAlert['type']; message: string; recommendation: string } } {

    // Find the appropriate threshold bracket
    const thresholdMinutes = [10, 20, 30, 45, 60].filter(m => m <= elapsedMinutes).pop() || 10;
    const threshold = CONFIG.THRESHOLDS[thresholdMinutes as keyof typeof CONFIG.THRESHOLDS];

    // Check velocity for viral potential
    if (velocity >= CONFIG.VELOCITY.VIRAL) {
        return {
            status: 'viral',
            alert: {
                type: 'success',
                message: `🚀 VIRAL POTENTIAL! ${views} views at ${velocity.toFixed(1)} views/min`,
                recommendation: 'Consider pinning a comment to maximize engagement'
            }
        };
    }

    // Check against thresholds
    if (views < threshold.critical) {
        return {
            status: 'underperforming',
            alert: {
                type: 'critical',
                message: `🚨 CRITICAL: Only ${views} views at ${elapsedMinutes}min (target: ${threshold.warning}+)`,
                recommendation: 'A/B test starting. Consider boosting via X/TikTok.'
            }
        };
    }

    if (views < threshold.warning) {
        return {
            status: 'underperforming',
            alert: {
                type: 'warning',
                message: `⚠️ Below target: ${views} views at ${elapsedMinutes}min (target: ${threshold.warning}+)`,
                recommendation: 'Consider changing title or thumbnail'
            }
        };
    }

    if (views >= threshold.good) {
        return {
            status: 'on_track',
            alert: {
                type: 'info',
                message: `✅ On track: ${views} views at ${elapsedMinutes}min`,
                recommendation: 'Keep monitoring'
            }
        };
    }

    return { status: 'on_track' };
}

/**
 * Create a performance alert.
 */
function createAlert(
    videoId: string,
    videoTitle: string,
    evaluation: { type: PerformanceAlert['type']; message: string; recommendation: string }
): PerformanceAlert {
    const video = monitoredVideos.get(videoId);
    const latestSnapshot = video?.snapshots[video.snapshots.length - 1];

    const alert: PerformanceAlert = {
        id: `alert_${Date.now()}`,
        videoId,
        videoTitle,
        type: evaluation.type,
        message: evaluation.message,
        recommendation: evaluation.recommendation,
        timestamp: new Date(),
        metrics: {
            views: latestSnapshot?.views || 0,
            targetViews: 100, // Default target
            velocity: latestSnapshot?.velocity || 0
        },
        dismissed: false
    };

    alerts.set(alert.id, alert);
    return alert;
}

/**
 * Notify UI of new alert.
 */
function notifyUI(alert: PerformanceAlert): void {
    window.postMessage({
        type: 'PERFORMANCE_ALERT',
        alert: alert
    }, '*');
}

/**
 * Fetch video performance from extension.
 */
async function fetchVideoPerformance(videoId: string): Promise<{ views: number; likes: number; comments: number } | null> {
    return new Promise((resolve) => {
        const handler = (event: MessageEvent) => {
            if (event.data?.type === 'VIDEO_PERFORMANCE_RESULT' &&
                event.data?.videoId === videoId) {
                window.removeEventListener('message', handler);
                resolve(event.data.performance);
            }
        };

        window.addEventListener('message', handler);

        window.postMessage({
            type: 'GET_VIDEO_PERFORMANCE',
            videoId: videoId
        }, '*');

        setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve(null);
        }, 10000);
    });
}

/**
 * Trigger cross-platform boost for underperforming video.
 */
function triggerCrossPlatformBoost(videoId: string, title: string): void {
    console.log(`👁️ [Monitor] Triggering cross-platform boost for: ${title}`);

    window.postMessage({
        type: 'CROSS_PLATFORM_BOOST',
        videoId: videoId,
        title: title,
        urgent: true
    }, '*');
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export function getMonitoredVideos(): MonitoredVideo[] {
    return Array.from(monitoredVideos.values());
}

export function getAlerts(includeDissmised = false): PerformanceAlert[] {
    const allAlerts = Array.from(alerts.values());
    return includeDissmised ? allAlerts : allAlerts.filter(a => !a.dismissed);
}

export function dismissAlert(alertId: string): void {
    const alert = alerts.get(alertId);
    if (alert) alert.dismissed = true;
}

export const performanceMonitorService = {
    startMonitoring,
    stopMonitoring,
    getMonitoredVideos,
    getAlerts,
    dismissAlert
};

console.log('👁️ [Service] performanceMonitorService loaded');
