import * as fs from 'fs';
import * as path from 'path';
import { FixInfo } from './fixReviewer';
import { FixRiskAssessment } from './fixRiskAssessmentService';
import { FixConfirmationRequest } from './fixConfirmationService';
import { FixEffectSummary } from './fixEffectTracker';

// 定义修复反馈相关接口
export interface FixFeedback {
  id: string;
  fixId: string;
  fixInfo: FixInfo;
  feedbackType: 'bug' | 'feature' | 'improvement' | 'praise' | 'issue' | 'question';
  feedbackSource: 'user' | 'system' | 'monitoring' | 'automated-test';
  submitter: string;
  submitDate: Date;
  status: 'new' | 'analyzed' | 'resolved' | 'closed' | 'ignored';
  priority: 'low' | 'medium' | 'high' | 'critical';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  details: any;
  riskAssessment?: FixRiskAssessment;
  confirmationRequest?: FixConfirmationRequest;
  effectSummary?: FixEffectSummary;
  resolution?: FeedbackResolution;
  relatedFeedbackIds: string[];
  tags: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

export interface FeedbackResolution {
  id: string;
  resolvedBy: string;
  resolvedAt: Date;
  resolutionType: 'fixed' | 'wont-fix' | 'duplicate' | 'out-of-scope' | 'by-design' | 'closed';
  description: string;
  actionsTaken: string[];
  verificationResult: 'passed' | 'failed' | 'pending';
  closureReason?: string;
}

export interface FeedbackStats {
  totalFeedback: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  bySentiment: Record<string, number>;
  avgResolutionTime: number;
  openFeedback: number;
  resolvedFeedback: number;
  closedFeedback: number;
}

export interface FeedbackConfig {
  enableSentimentAnalysis: boolean;
  enableAutoClassification: boolean;
  defaultPriority: 'low' | 'medium' | 'high';
  autoCloseAfterDays: number;
  requireVerification: boolean;
  enableFeedbackAggregation: boolean;
  enableRelatedFeedbackDetection: boolean;
}

export interface FeedbackFilter {
  fixId?: string;
  status?: string;
  priority?: string;
  feedbackType?: string;
  sentiment?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
}

export interface FeedbackTrend {
  date: string;
  count: number;
  byType: Record<string, number>;
  bySentiment: Record<string, number>;
}

/**
 * 修复反馈机制服务
 * 用于收集、分析和管理修复相关的反馈
 */
export class FixFeedbackService {
  private readonly config: FeedbackConfig;
  private feedbacks: Map<string, FixFeedback> = new Map();
  private feedbackStats: FeedbackStats = this.initializeStats();

  constructor(config?: Partial<FeedbackConfig>) {
    this.config = {
      enableSentimentAnalysis: config?.enableSentimentAnalysis !== false,
      enableAutoClassification: config?.enableAutoClassification !== false,
      defaultPriority: config?.defaultPriority || 'medium',
      autoCloseAfterDays: config?.autoCloseAfterDays || 30,
      requireVerification: config?.requireVerification !== false,
      enableFeedbackAggregation: config?.enableFeedbackAggregation !== false,
      enableRelatedFeedbackDetection: config?.enableRelatedFeedbackDetection !== false
    };
  }

  /**
   * 初始化统计信息
   */
  private initializeStats(): FeedbackStats {
    return {
      totalFeedback: 0,
      byType: {
        bug: 0,
        feature: 0,
        improvement: 0,
        praise: 0,
        issue: 0,
        question: 0
      },
      byStatus: {
        new: 0,
        analyzed: 0,
        resolved: 0,
        closed: 0,
        ignored: 0
      },
      byPriority: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      bySentiment: {
        positive: 0,
        neutral: 0,
        negative: 0
      },
      avgResolutionTime: 0,
      openFeedback: 0,
      resolvedFeedback: 0,
      closedFeedback: 0
    };
  }

  /**
   * 提交修复反馈
   */
  submitFeedback(
    fixInfo: FixInfo,
    feedbackType: FixFeedback['feedbackType'],
    title: string,
    description: string,
    submitter: string,
    options?: {
      feedbackSource?: FixFeedback['feedbackSource'];
      priority?: FixFeedback['priority'];
      severity?: FixFeedback['severity'];
      details?: any;
      riskAssessment?: FixRiskAssessment;
      confirmationRequest?: FixConfirmationRequest;
      effectSummary?: FixEffectSummary;
      tags?: string[];
    }
  ): FixFeedback {
    const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 自动分析情感
    const sentimentAnalysis = this.analyzeSentiment(title + ' ' + description);

    // 检测相关反馈
    const relatedFeedbackIds = this.detectRelatedFeedback(fixInfo, title, description);

    const feedback: FixFeedback = {
      id: feedbackId,
      fixId: fixInfo.id,
      fixInfo,
      feedbackType,
      feedbackSource: options?.feedbackSource || 'user',
      submitter,
      submitDate: new Date(),
      status: 'new',
      priority: options?.priority || this.config.defaultPriority,
      severity: options?.severity || 'medium',
      title,
      description,
      details: options?.details || {},
      riskAssessment: options?.riskAssessment,
      confirmationRequest: options?.confirmationRequest,
      effectSummary: options?.effectSummary,
      resolution: undefined,
      relatedFeedbackIds,
      tags: options?.tags || [],
      sentiment: sentimentAnalysis.sentiment,
      confidence: sentimentAnalysis.confidence
    };

    // 保存反馈
    this.saveFeedback(feedback);
    this.feedbacks.set(feedbackId, feedback);

    // 更新统计信息
    this.updateStats(feedback, 'add');

    return feedback;
  }

  /**
   * 分析反馈情感
   */
  private analyzeSentiment(text: string): { sentiment: FixFeedback['sentiment']; confidence: number } {
    if (!this.config.enableSentimentAnalysis) {
      return { sentiment: 'neutral', confidence: 0.5 };
    }

    // 简单的情感分析实现，实际可替换为更复杂的NLP模型
    const positiveWords = ['good', 'great', 'excellent', 'perfect', 'amazing', 'awesome', 'working', 'fixed', 'resolved', 'thanks', 'thank you'];
    const negativeWords = ['bad', 'broken', 'failed', 'error', 'issue', 'problem', 'bug', 'crash', 'slow', 'horrible', 'terrible', 'not working', 'doesn\'t work'];

    let positiveScore = 0;
    let negativeScore = 0;

    const lowerText = text.toLowerCase();

    for (const word of positiveWords) {
      if (lowerText.includes(word)) {
        positiveScore++;
      }
    }

    for (const word of negativeWords) {
      if (lowerText.includes(word)) {
        negativeScore++;
      }
    }

    let sentiment: FixFeedback['sentiment'] = 'neutral';
    let confidence = 0.5;

    if (positiveScore > negativeScore) {
      sentiment = 'positive';
      confidence = Math.min(1.0, positiveScore / (positiveScore + negativeScore + 1) * 1.5);
    } else if (negativeScore > positiveScore) {
      sentiment = 'negative';
      confidence = Math.min(1.0, negativeScore / (positiveScore + negativeScore + 1) * 1.5);
    }

    return { sentiment, confidence };
  }

  /**
   * 检测相关反馈
   */
  private detectRelatedFeedback(fixInfo: FixInfo, title: string, description: string): string[] {
    if (!this.config.enableRelatedFeedbackDetection) {
      return [];
    }

    const relatedIds: string[] = [];
    const text = (title + ' ' + description).toLowerCase();

    for (const [id, feedback] of this.feedbacks.entries()) {
      if (feedback.fixId === fixInfo.id && feedback.id !== `feedback_${Date.now()}`) {
        const feedbackText = (feedback.title + ' ' + feedback.description).toLowerCase();

        // 简单的相关度检测：检查是否有共同关键词
        const commonWords = this.findCommonWords(text, feedbackText);
        if (commonWords.length > 2) {
          relatedIds.push(id);
        }
      }
    }

    return relatedIds;
  }

  /**
   * 查找共同关键词
   */
  private findCommonWords(text1: string, text2: string): string[] {
    const words1 = text1.split(/\s+/).filter(word => word.length > 3);
    const words2 = text2.split(/\s+/).filter(word => word.length > 3);

    const set1 = new Set(words1);
    const common: string[] = [];

    for (const word of words2) {
      if (set1.has(word)) {
        common.push(word);
      }
    }

    return common;
  }

  /**
   * 分析反馈
   */
  analyzeFeedback(feedbackId: string, analyzedBy: string, analysis: any): FixFeedback | null {
    const feedback = this.feedbacks.get(feedbackId);

    if (!feedback) {
      return null;
    }

    // 更新反馈状态为已分析
    feedback.status = 'analyzed';
    feedback.details = {
      ...feedback.details,
      analysis
    };

    // 保存更新后的反馈
    this.saveFeedback(feedback);
    this.feedbacks.set(feedbackId, feedback);

    // 更新统计信息
    this.updateStats(feedback, 'update');

    return feedback;
  }

  /**
   * 解决反馈
   */
  resolveFeedback(
    feedbackId: string,
    resolvedBy: string,
    resolutionType: FeedbackResolution['resolutionType'],
    description: string,
    actionsTaken: string[],
    verificationResult: FeedbackResolution['verificationResult'] = 'pending',
    closureReason?: string
  ): FixFeedback | null {
    const feedback = this.feedbacks.get(feedbackId);

    if (!feedback) {
      return null;
    }

    // 创建解决方案
    const resolution: FeedbackResolution = {
      id: `resolution_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      resolvedBy,
      resolvedAt: new Date(),
      resolutionType,
      description,
      actionsTaken,
      verificationResult,
      closureReason
    };

    // 更新反馈状态
    feedback.resolution = resolution;
    feedback.status = resolutionType === 'fixed' ? 'resolved' : 'closed';

    // 保存更新后的反馈
    this.saveFeedback(feedback);
    this.feedbacks.set(feedbackId, feedback);

    // 更新统计信息
    this.updateStats(feedback, 'update');

    return feedback;
  }

  /**
   * 关闭反馈
   */
  closeFeedback(feedbackId: string, closedBy: string, reason: string): FixFeedback | null {
    const feedback = this.feedbacks.get(feedbackId);

    if (!feedback) {
      return null;
    }

    // 更新反馈状态为已关闭
    feedback.status = 'closed';

    if (!feedback.resolution) {
      // 创建默认解决方案
      feedback.resolution = {
        id: `resolution_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        resolvedBy: closedBy,
        resolvedAt: new Date(),
        resolutionType: 'closed',
        description: 'Feedback closed manually',
        actionsTaken: [],
        verificationResult: 'pending',
        closureReason: reason
      };
    } else {
      // 更新现有解决方案
      feedback.resolution.closureReason = reason;
    }

    // 保存更新后的反馈
    this.saveFeedback(feedback);
    this.feedbacks.set(feedbackId, feedback);

    // 更新统计信息
    this.updateStats(feedback, 'update');

    return feedback;
  }

  /**
   * 忽略反馈
   */
  ignoreFeedback(feedbackId: string, ignoredBy: string, reason: string): FixFeedback | null {
    const feedback = this.feedbacks.get(feedbackId);

    if (!feedback) {
      return null;
    }

    // 更新反馈状态为已忽略
    feedback.status = 'ignored';
    feedback.details = {
      ...feedback.details,
      ignoredReason: reason
    };

    // 保存更新后的反馈
    this.saveFeedback(feedback);
    this.feedbacks.set(feedbackId, feedback);

    // 更新统计信息
    this.updateStats(feedback, 'update');

    return feedback;
  }

  /**
   * 获取反馈
   */
  getFeedback(feedbackId: string): FixFeedback | undefined {
    return this.feedbacks.get(feedbackId);
  }

  /**
   * 获取修复的所有反馈
   */
  getFeedbackByFixId(fixId: string): FixFeedback[] {
    return Array.from(this.feedbacks.values())
      .filter(feedback => feedback.fixId === fixId)
      .sort((a, b) => b.submitDate.getTime() - a.submitDate.getTime());
  }

  /**
   * 获取所有反馈
   */
  getAllFeedback(filter?: FeedbackFilter): FixFeedback[] {
    let filteredFeedback = Array.from(this.feedbacks.values());

    // 应用过滤条件
    if (filter) {
      if (filter.fixId) {
        filteredFeedback = filteredFeedback.filter(f => f.fixId === filter.fixId);
      }

      if (filter.status) {
        filteredFeedback = filteredFeedback.filter(f => f.status === filter.status);
      }

      if (filter.priority) {
        filteredFeedback = filteredFeedback.filter(f => f.priority === filter.priority);
      }

      if (filter.feedbackType) {
        filteredFeedback = filteredFeedback.filter(f => f.feedbackType === filter.feedbackType);
      }

      if (filter.sentiment) {
        filteredFeedback = filteredFeedback.filter(f => f.sentiment === filter.sentiment);
      }

      if (filter.dateRange) {
        filteredFeedback = filteredFeedback.filter(f =>
          f.submitDate >= filter.dateRange.start && f.submitDate <= filter.dateRange.end
        );
      }

      if (filter.tags && filter.tags.length > 0) {
        filteredFeedback = filteredFeedback.filter(f =>
          filter.tags.some(tag => f.tags.includes(tag))
        );
      }
    }

    return filteredFeedback.sort((a, b) => b.submitDate.getTime() - a.submitDate.getTime());
  }

  /**
   * 获取统计信息
   */
  getFeedbackStats(): FeedbackStats {
    return { ...this.feedbackStats };
  }

  /**
   * 生成反馈趋势
   */
  generateFeedbackTrend(days: number = 30): FeedbackTrend[] {
    const trends: FeedbackTrend[] = [];
    const now = new Date();

    // 生成过去N天的日期
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // 初始化趋势数据
      const trend: FeedbackTrend = {
        date: dateStr,
        count: 0,
        byType: {
          bug: 0,
          feature: 0,
          improvement: 0,
          praise: 0,
          issue: 0,
          question: 0
        },
        bySentiment: {
          positive: 0,
          neutral: 0,
          negative: 0
        }
      };

      // 统计当天的反馈
      for (const feedback of this.feedbacks.values()) {
        const feedbackDateStr = feedback.submitDate.toISOString().split('T')[0];
        if (feedbackDateStr === dateStr) {
          trend.count++;
          trend.byType[feedback.feedbackType]++;
          trend.bySentiment[feedback.sentiment]++;
        }
      }

      trends.push(trend);
    }

    return trends;
  }

  /**
   * 导出反馈
   */
  exportFeedback(feedbackId: string, format: 'json' | 'markdown' | 'csv'): string {
    const feedback = this.feedbacks.get(feedbackId);
    if (!feedback) {
      throw new Error(`反馈不存在: ${feedbackId}`);
    }

    if (format === 'json') {
      return JSON.stringify(feedback, null, 2);
    } else if (format === 'markdown') {
      return this.generateMarkdownReport(feedback);
    } else {
      return this.generateCsvReport(feedback);
    }
  }

  /**
   * 生成Markdown报告
   */
  private generateMarkdownReport(feedback: FixFeedback): string {
    let report = `# 修复反馈报告\n\n`;
    report += `## 基本信息\n`;
    report += `- 反馈ID: ${feedback.id}\n`;
    report += `- 修复ID: ${feedback.fixId}\n`;
    report += `- 类型: ${feedback.feedbackType}\n`;
    report += `- 来源: ${feedback.feedbackSource}\n`;
    report += `- 提交人: ${feedback.submitter}\n`;
    report += `- 提交时间: ${feedback.submitDate.toISOString()}\n`;
    report += `- 状态: ${feedback.status}\n`;
    report += `- 优先级: ${feedback.priority}\n`;
    report += `- 严重性: ${feedback.severity}\n`;
    report += `- 情感: ${feedback.sentiment} (${Math.round(feedback.confidence * 100)}% confidence)\n`;
    report += `- 标签: ${feedback.tags.join(', ')}\n\n`;

    report += `## 反馈内容\n`;
    report += `### 标题\n`;
    report += `${feedback.title}\n\n`;
    report += `### 描述\n`;
    report += `${feedback.description}\n\n`;

    if (feedback.resolution) {
      report += `## 解决方案\n`;
      report += `- 解决人: ${feedback.resolution.resolvedBy}\n`;
      report += `- 解决时间: ${feedback.resolution.resolvedAt.toISOString()}\n`;
      report += `- 解决类型: ${feedback.resolution.resolutionType}\n`;
      report += `- 验证结果: ${feedback.resolution.verificationResult}\n`;
      report += `- 描述: ${feedback.resolution.description}\n\n`;

      if (feedback.resolution.actionsTaken.length > 0) {
        report += `### 采取的行动\n`;
        for (const action of feedback.resolution.actionsTaken) {
          report += `- ${action}\n`;
        }
        report += `\n`;
      }
    }

    if (feedback.relatedFeedbackIds.length > 0) {
      report += `## 相关反馈\n`;
      for (const id of feedback.relatedFeedbackIds) {
        report += `- ${id}\n`;
      }
      report += `\n`;
    }

    return report;
  }

  /**
   * 生成CSV报告
   */
  private generateCsvReport(feedback: FixFeedback): string {
    // CSV格式的反馈报告
    let csv = `反馈ID,修复ID,类型,来源,提交人,提交时间,状态,优先级,严重性,标题,描述,情感,置信度,标签\n`;
    csv += `${feedback.id},${feedback.fixId},${feedback.feedbackType},${feedback.feedbackSource},${feedback.submitter},${feedback.submitDate.toISOString()},${feedback.status},${feedback.priority},${feedback.severity},"${feedback.title}","${feedback.description}",${feedback.sentiment},${feedback.confidence},"${feedback.tags.join(';')}"\n`;

    return csv;
  }

  /**
   * 保存反馈
   */
  private saveFeedback(feedback: FixFeedback): void {
    const feedbacksDir = './feedbacks';
    if (!fs.existsSync(feedbacksDir)) {
      fs.mkdirSync(feedbacksDir, { recursive: true });
    }

    const feedbackPath = path.join(feedbacksDir, `feedback-${feedback.id}.json`);
    fs.writeFileSync(feedbackPath, JSON.stringify(feedback, null, 2), 'utf8');
  }

  /**
   * 更新统计信息
   */
  private updateStats(feedback: FixFeedback, action: 'add' | 'update' | 'delete'): void {
    if (action === 'delete') {
      // 减少统计
      this.feedbackStats.totalFeedback--;
      this.feedbackStats.byType[feedback.feedbackType]--;
      this.feedbackStats.byStatus[feedback.status]--;
      this.feedbackStats.byPriority[feedback.priority]--;
      this.feedbackStats.bySentiment[feedback.sentiment]--;

      if (feedback.status === 'new' || feedback.status === 'analyzed') {
        this.feedbackStats.openFeedback--;
      } else if (feedback.status === 'resolved') {
        this.feedbackStats.resolvedFeedback--;
      } else if (feedback.status === 'closed' || feedback.status === 'ignored') {
        this.feedbackStats.closedFeedback--;
      }
    } else {
      if (action === 'add') {
        // 增加统计
        this.feedbackStats.totalFeedback++;
      } else {
        // 更新统计：先减少旧状态的统计
        const oldFeedback = this.feedbacks.get(feedback.id);
        if (oldFeedback) {
          this.feedbackStats.byStatus[oldFeedback.status]--;
          this.feedbackStats.byPriority[oldFeedback.priority]--;

          if (oldFeedback.status === 'new' || oldFeedback.status === 'analyzed') {
            this.feedbackStats.openFeedback--;
          } else if (oldFeedback.status === 'resolved') {
            this.feedbackStats.resolvedFeedback--;
          } else if (oldFeedback.status === 'closed' || oldFeedback.status === 'ignored') {
            this.feedbackStats.closedFeedback--;
          }
        }
      }

      // 增加新状态的统计
      this.feedbackStats.byType[feedback.feedbackType]++;
      this.feedbackStats.byStatus[feedback.status]++;
      this.feedbackStats.byPriority[feedback.priority]++;
      this.feedbackStats.bySentiment[feedback.sentiment]++;

      if (feedback.status === 'new' || feedback.status === 'analyzed') {
        this.feedbackStats.openFeedback++;
      } else if (feedback.status === 'resolved') {
        this.feedbackStats.resolvedFeedback++;
      } else if (feedback.status === 'closed' || feedback.status === 'ignored') {
        this.feedbackStats.closedFeedback++;
      }
    }
  }

  /**
   * 删除反馈
   */
  deleteFeedback(feedbackId: string): boolean {
    const feedback = this.feedbacks.get(feedbackId);

    if (!feedback) {
      return false;
    }

    // 删除反馈文件
    const feedbackPath = path.join('./feedbacks', `feedback-${feedbackId}.json`);
    if (fs.existsSync(feedbackPath)) {
      fs.unlinkSync(feedbackPath);
    }

    // 更新统计信息
    this.updateStats(feedback, 'delete');

    // 从缓存中删除
    return this.feedbacks.delete(feedbackId);
  }

  /**
   * 获取待处理的反馈
   */
  getPendingFeedback(): FixFeedback[] {
    return Array.from(this.feedbacks.values())
      .filter(feedback => feedback.status === 'new' || feedback.status === 'analyzed')
      .sort((a, b) => {
        // 按优先级排序，然后按提交时间
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.submitDate.getTime() - b.submitDate.getTime();
      });
  }

  /**
   * 自动关闭过期反馈
   */
  autoCloseExpiredFeedback(): number {
    const now = new Date();
    let closedCount = 0;

    for (const [id, feedback] of this.feedbacks.entries()) {
      if (feedback.status === 'resolved' || feedback.status === 'closed') {
        const daysSinceResolution = Math.floor((now.getTime() - feedback.resolution!.resolvedAt.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceResolution >= this.config.autoCloseAfterDays) {
          // 自动关闭反馈
          feedback.status = 'closed';

          // 保存更新后的反馈
          this.saveFeedback(feedback);
          this.feedbacks.set(id, feedback);

          // 更新统计信息
          this.updateStats(feedback, 'update');

          closedCount++;
        }
      }
    }

    return closedCount;
  }

  /**
   * 生成反馈摘要
   */
  generateFeedbackSummary(fixId: string): any {
    const feedbacks = this.getFeedbackByFixId(fixId);

    return {
      fixId,
      totalFeedback: feedbacks.length,
      byType: {
        bug: feedbacks.filter(f => f.feedbackType === 'bug').length,
        feature: feedbacks.filter(f => f.feedbackType === 'feature').length,
        improvement: feedbacks.filter(f => f.feedbackType === 'improvement').length,
        praise: feedbacks.filter(f => f.feedbackType === 'praise').length,
        issue: feedbacks.filter(f => f.feedbackType === 'issue').length,
        question: feedbacks.filter(f => f.feedbackType === 'question').length
      },
      byStatus: {
        new: feedbacks.filter(f => f.status === 'new').length,
        analyzed: feedbacks.filter(f => f.status === 'analyzed').length,
        resolved: feedbacks.filter(f => f.status === 'resolved').length,
        closed: feedbacks.filter(f => f.status === 'closed').length,
        ignored: feedbacks.filter(f => f.status === 'ignored').length
      },
      bySentiment: {
        positive: feedbacks.filter(f => f.sentiment === 'positive').length,
        neutral: feedbacks.filter(f => f.sentiment === 'neutral').length,
        negative: feedbacks.filter(f => f.sentiment === 'negative').length
      },
      averageSentiment: feedbacks.length > 0 ?
        feedbacks.reduce((sum, f) => {
          const sentimentScore = f.sentiment === 'positive' ? 1 : f.sentiment === 'negative' ? -1 : 0;
          return sum + sentimentScore;
        }, 0) / feedbacks.length : 0,
      latestFeedback: feedbacks[0]?.id
    };
  }
}

// 创建单例实例
export const fixFeedbackService = new FixFeedbackService();
