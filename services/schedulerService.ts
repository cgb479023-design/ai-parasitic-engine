/**
 * Scheduler Service (Enhanced with Closed-Loop Integration)
 *
 * 定时检查预约视频并触发自动发布
 * 集成消息总线、审计跟踪和自动恢复
 *
 * @module services/schedulerService
 * @version 2.0.0
 * @date 2026-01-12
 */

import { getMessageBusService } from './index';

declare const chrome: any;

import { YppPlanType, PlanItemType } from '../components/YouTubeAnalytics/types';

// ─────────────────────────────────────────────────────────────────────────────────────
// CONSTANTS & CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────────

const SCHEDULER_CONFIG = {
    CHECK_FREQUENCY_MS: 60000, // 1 minute
    VIDEO_DATA_TTL_MS: 86400000, // 24 hours
    MAX_RETRY_ATTEMPTS: 3,
    AUTO_PUBLISH_TIMEOUT_MS: 30000, // 30 seconds
} as const;

const MESSAGE_TYPES = {
    // State updates
    STATE_SET: 'SCHEDULER_STATE_SET',
    STATE_UPDATE: 'SCHEDULER_STATE_UPDATE',

    // Scheduler events
    SCHEDULER_START: 'SCHEDULER_START',
    SCHEDULER_STOP: 'SCHEDULER_STOP',
    SCHEDULER_CHECK: 'SCHEDULER_CHECK',

    // Publish events
    PUBLISH_TRIGGER: 'SCHEDULER_PUBLISH_TRIGGER',
    PUBLISH_PROGRESS: 'SCHEDULER_PUBLISH_PROGRESS',
    PUBLISH_SUCCESS: 'SCHEDULER_PUBLISH_SUCCESS',
    PUBLISH_ERROR: 'SCHEDULER_PUBLISH_ERROR',

    // Plan updates
    PLAN_STATUS_UPDATE: 'SCHEDULER_PLAN_STATUS_UPDATE',
} as const;

// ─────────────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────────────

export interface SchedulerState {
    isRunning: boolean;
    checkFrequency: number;
    lastCheckAt: number | null;
    triggeredVideos: Map<string, { triggeredAt: number; status: string }>;
}

export interface PublishProgress {
    itemId: string;
    status: 'queued' | 'publishing' | 'uploading' | 'completed' | 'failed';
    progress: number; // 0-100
    error?: string;
}

export interface SchedulerStats {
    totalChecks: number;
    triggeredVideos: number;
    successfulPublishes: number;
    failedPublishes: number;
    avgPublishDuration: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// SCHEDULER SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────────────

export class SchedulerService {
    private checkInterval: NodeJS.Timeout | null = null;
    private state: SchedulerState;
    private publishAttempts: Map<string, number> = new Map();
    private stats: SchedulerStats = {
        totalChecks: 0,
        triggeredVideos: 0,
        successfulPublishes: 0,
        failedPublishes: 0,
        avgPublishDuration: null
    };

    constructor() {
        this.state = {
            isRunning: false,
            checkFrequency: SCHEDULER_CONFIG.CHECK_FREQUENCY_MS,
            lastCheckAt: null,
            triggeredVideos: new Map()
        };

        console.log('⏰ [Scheduler] Initialized');
    }

    /**
     * 启动调度器
     */
    start(): void {
        if (this.state.isRunning) {
            console.warn('⚠️ [Scheduler] Already running');
            return;
        }

        const messageBus = getMessageBusService();
        if (!messageBus) {
            console.warn('⚠️ [Scheduler] Message bus not available');
        }

        this.state.isRunning = true;
        this.updateState('isRunning', true);

        // 启动定时检查
        this.checkInterval = setInterval(() => {
            this.checkScheduledVideos();
        }, this.state.checkFrequency);

        // Notify via message bus
        if (messageBus) {
            messageBus.broadcast(MESSAGE_TYPES.SCHEDULER_START, {
                checkFrequency: this.state.checkFrequency
            });
        }

        console.log(`⏰ [Scheduler] Started - checking every ${this.state.checkFrequency / 1000}s`);

        // 立即执行一次检查
        this.checkScheduledVideos();
    }

    /**
     * 停止调度器
     */
    stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        this.state.isRunning = false;
        this.updateState('isRunning', false);

        const messageBus = getMessageBusService();
        if (messageBus) {
            messageBus.broadcast(MESSAGE_TYPES.SCHEDULER_STOP, {});
        }

        console.log('⏰ [Scheduler] Stopped');
    }

    /**
     * 检查所有预约视频
     */
    async checkScheduledVideos(): Promise<void> {
        const messageBus = getMessageBusService();

        try {
            const plan = await this.getYppPlan();
            if (!plan?.schedule || plan.schedule.length === 0) {
                return;
            }

            const now = new Date();
            let triggeredCount = 0;

            // 检查每个计划项目
            for (const item of plan.schedule) {
                // 只处理 scheduled 状态的视频
                if (item.status === 'scheduled' && item.publishTimeLocal) {
                    const publishTime = new Date(item.publishTimeLocal);

                    // 如果预约时间已到，触发发布
                    if (now >= publishTime) {
                        console.log(`🚀 [Scheduler] Triggering publish for ${item.id} (${item.title?.substring(0, 30)}...)`);

                        await this.triggerAutoPublish(item);
                        triggeredCount++;
                    }
                }
            }

            // Update stats
            this.state.lastCheckAt = now.getTime();
            this.stats.totalChecks++;

            if (triggeredCount > 0) {
                console.log(`✅ [Scheduler] Triggered ${triggeredCount} scheduled video(s)`);
            }

            // Notify via message bus
            if (messageBus) {
                messageBus.broadcast(MESSAGE_TYPES.SCHEDULER_CHECK, {
                    checkedAt: now,
                    triggeredCount,
                    totalItems: plan.schedule.length
                });
            }

        } catch (error) {
            console.error('❌ [Scheduler] Error checking scheduled videos:', error);

            if (messageBus) {
                messageBus.publish(MESSAGE_TYPES.PUBLISH_ERROR, {
                    error: 'CHECK_FAILED',
                    message: String(error),
                    timestamp: Date.now()
                });
            }
        }
    }

    /**
     * 触发单个视频的自动发布
     */
    private async triggerAutoPublish(item: PlanItemType): Promise<void> {
        const messageBus = getMessageBusService();

        try {
            // 获取视频数据
            const videoData = await this.getVideoData(item.id);
            if (!videoData) {
                console.error('❌ [Scheduler] Video data not found for:', item.id);

                // 更新状态为失败
                this.updatePlanStatus(item.id, 'failed', 'Video data not found');

                if (messageBus) {
                    messageBus.publish(MESSAGE_TYPES.PUBLISH_ERROR, {
                        itemId: item.id,
                        error: 'Video data not found',
                        timestamp: Date.now()
                    });
                }

                return;
            }

            // Track publish attempt
            this.publishAttempts.set(item.id, (this.publishAttempts.get(item.id) || 0) + 1);
            this.state.triggeredVideos.set(item.id, {
                triggeredAt: Date.now(),
                status: 'publishing'
            });

            // Notify publishing state via message bus
            if (messageBus) {
                messageBus.broadcast(MESSAGE_TYPES.PUBLISH_PROGRESS, {
                    itemId: item.id,
                    status: 'queued',
                    progress: 0
                });
            }

            const startTime = Date.now();

            // 发送消息到 React 组件，更新状态为 publishing
            window.postMessage({
                type: 'SCHEDULED_PUBLISH_TRIGGERED',
                payload: { itemId: item.id, status: 'publishing' }
            }, '*');

            // 发送消息到 background.js 触发上传
            window.postMessage({
                type: 'TRIGGER_SCHEDULED_PUBLISH',
                payload: {
                    itemId: item.id,
                    videoData: videoData,
                    url: `https://studio.youtube.com/channel/UcaV2w-mQc51X9WVs1yjrg/videos/upload?d=ud&gemini_id=${item.id}`
                }
            }, '*');

            console.log(`✅ [Scheduler] Auto-publish triggered for ${item.id}`);

            // Use message bus for reliable confirmation
            if (messageBus) {
                // Request confirmation with timeout
                const result = await messageBus.request(
                    MESSAGE_TYPES.PUBLISH_SUCCESS,
                    {
                        itemId: item.id,
                        status: 'publishing'
                    },
                    SCHEDULER_CONFIG.AUTO_PUBLISH_TIMEOUT_MS
                );

                if (result.response) {
                    const duration = Date.now() - startTime;
                    this.updateStats(true, duration);

                    // Update state
                    this.updatePlanStatus(item.id, 'published', undefined);

                    // Notify completion
                    if (messageBus) {
                        messageBus.broadcast(MESSAGE_TYPES.PUBLISH_PROGRESS, {
                            itemId: item.id,
                            status: 'completed',
                            progress: 100
                        });
                    }

                    console.log(`✅ [Scheduler] Publish completed for ${item.id} in ${duration}ms`);
                } else {
                    // Handle timeout or error
                    const duration = Date.now() - startTime;
                    this.updateStats(false, duration);

                    this.updatePlanStatus(item.id, 'failed', result.error?.message || 'Timeout');

                    if (messageBus) {
                        messageBus.broadcast(MESSAGE_TYPES.PUBLISH_PROGRESS, {
                            itemId: item.id,
                            status: 'failed',
                            progress: 0,
                            error: result.error?.message || 'Timeout'
                        });
                    }

                    console.warn(`⏰ [Scheduler] Publish timeout/error for ${item.id}:`, result.error);
                }
            } else {
                // Fallback to window.postMessage if message bus not available
                setTimeout(async () => {
                    const duration = Date.now() - startTime;

                    // Assume success after timeout (no way to confirm via window.postMessage)
                    this.updateStats(true, duration);
                    this.updatePlanStatus(item.id, 'published', null);

                    if (messageBus) {
                        messageBus.broadcast(MESSAGE_TYPES.PUBLISH_PROGRESS, {
                            itemId: item.id,
                            status: 'completed',
                            progress: 100
                        });
                    }

                    console.log(`✅ [Scheduler] Publish completed (fallback) for ${item.id} in ${duration}ms`);
                }, 10000); // 10 second fallback
            }

        } catch (error) {
            console.error('❌ [Scheduler] Error triggering auto-publish:', error);

            const errorTime = Date.now();
            this.state.triggeredVideos.set(item.id, {
                triggeredAt: errorTime,
                status: 'failed'
            });

            if (messageBus) {
                messageBus.publish(MESSAGE_TYPES.PUBLISH_ERROR, {
                    itemId: item.id,
                    error: String(error),
                    timestamp: errorTime
                });
            }

            // 更新状态为失败
            this.updatePlanStatus(item.id, 'failed', String(error));
        }
    }

    /**
     * 获取 YPP 计划 (从后端 API)
     */
    async getYppPlan(): Promise<YppPlanType | null> {
        try {
            const response = await fetch('/api/schedules');
            if (!response.ok) throw new Error('Failed to fetch schedules');
            const data = await response.json();
            return { schedule: data };
        } catch (e) {
            console.error('❌ [Scheduler] Failed to load YPP plan from API:', e);
            // Fallback to local storage for offline/legacy support
            const saved = localStorage.getItem('yppPlan');
            return saved ? JSON.parse(saved) : null;
        }
    }

    /**
     * 获取视频数据
     */
    private async getVideoData(itemId: string): Promise<any> {
        try {
            // 尝试从 localStorage 获取
            const videoData = localStorage.getItem(`videoData_${itemId}`);
            if (videoData) {
                return JSON.parse(videoData);
            }

            // 尝试从 chrome.storage 获取
            const result = await new Promise<any>((resolve) => {
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    chrome.storage.local.get([`videoData_${itemId}`], (data: any) => {
                        resolve(data[`videoData_${itemId}`]);
                    });
                } else {
                    resolve(null);
                }
            });

            return result;
        } catch (e) {
            console.error('❌ [Scheduler] Failed to get video data:', e);
            return null;
        }
    }

    /**
     * 更新计划状态 (同步到后端)
     */
    private async updatePlanStatus(itemId: string, status: string, error?: string): Promise<void> {
        try {
            const plan = await this.getYppPlan();
            if (!plan) return;

            const item = plan.schedule.find(i => i.id === itemId);
            if (!item) return;

            const updatedItem = {
                ...item,
                status: status as any,
                error: error
            };

            // 1. Sync to Backend
            await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedItem)
            });

            // 2. Local Fallback (for UI responsiveness)
            const newSchedule = plan.schedule.map(i => i.id === itemId ? updatedItem : i);
            const updatedPlan = { ...plan, schedule: newSchedule };
            localStorage.setItem('yppPlan', JSON.stringify(updatedPlan));

            // 通知 React 组件状态更新
            window.postMessage({
                type: 'YPP_PLAN_STATUS_UPDATE',
                payload: updatedPlan
            }, '*');

            // Notify via message bus
            const messageBus = getMessageBusService();
            if (messageBus) {
                messageBus.broadcast(MESSAGE_TYPES.PLAN_STATUS_UPDATE, {
                    itemId,
                    status,
                    error,
                    timestamp: Date.now()
                });
            }

            console.log(`📝 [Scheduler] Updated ${itemId} status to ${status} (Synced to Backend)`);
        } catch (e) {
            console.error('❌ [Scheduler] Failed to update plan status:', e);
        }
    }

    /**
     * Update scheduler state
     */
    private updateState<K extends keyof SchedulerState>(key: K, value: SchedulerState[K]): void {
        this.state[key] = value;

        const messageBus = getMessageBusService();
        if (messageBus) {
            messageBus.broadcast(MESSAGE_TYPES.STATE_UPDATE, {
                key,
                value,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Update publish statistics
     */
    private updateStats(success: boolean, duration: number): void {
        if (success) {
            this.stats.successfulPublishes++;
        } else {
            this.stats.failedPublishes++;
        }

        // Calculate average duration
        if (duration > 0) {
            const totalDuration = (this.stats.avgPublishDuration || 0) * (this.stats.successfulPublishes + this.stats.failedPublishes - 1) + duration;
            const totalPublishes = this.stats.successfulPublishes + this.stats.failedPublishes;
            this.stats.avgPublishDuration = totalDuration / totalPublishes;
        }
    }

    /**
     * 设置检查频率
     */
    setCheckFrequency(milliseconds: number): void {
        this.state.checkFrequency = milliseconds;
        this.updateState('checkFrequency', milliseconds);

        // 如果正在运行，重启定时器
        if (this.state.isRunning) {
            this.stop();
            this.start();
        }
    }

    /**
     * 获取运行状态
     */
    isActive(): boolean {
        return this.state.isRunning;
    }

    /**
     * 获取调度器状态
     */
    getState(): SchedulerState {
        return { ...this.state };
    }

    /**
     * 获取统计信息
     */
    getStats(): SchedulerStats {
        return { ...this.stats };
    }

    /**
     * 重置统计信息
     */
    resetStats(): void {
        this.stats = {
            totalChecks: 0,
            triggeredVideos: 0,
            successfulPublishes: 0,
            failedPublishes: 0,
            avgPublishDuration: null
        };
        this.state.triggeredVideos.clear();
        this.publishAttempts.clear();
        console.log('🔄 [Scheduler] Stats reset');
    }

    /**
     * Get publish progress for an item
     */
    getPublishProgress(itemId: string): PublishProgress | null {
        const triggered = this.state.triggeredVideos.get(itemId);
        if (triggered) {
            const attempts = this.publishAttempts.get(itemId) || 0;
            return {
                itemId,
                status: triggered.status as PublishProgress['status'],
                progress: attempts >= 3 ? 0 : 100 - (attempts * 33), // Estimate progress
                error: triggered.status === 'failed' ? 'Failed after ' + attempts + ' attempts' : undefined
            };
        }
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────────────────────────────────

let schedulerInstance: SchedulerService | null = null;

/**
 * 获取调度器实例
 */
export function getScheduler(): SchedulerService {
    if (!schedulerInstance) {
        schedulerInstance = new SchedulerService();
    }
    return schedulerInstance;
}

/**
 * 停止并清理调度器
 */
export function destroyScheduler(): void {
    if (schedulerInstance) {
        schedulerInstance.stop();
        schedulerInstance = null;
        console.log('🗑️ [Scheduler] Destroyed');
    }
}
