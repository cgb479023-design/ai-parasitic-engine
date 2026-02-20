import * as fs from 'fs';
import * as path from 'path';

// 定义修复效果跟踪相关接口
export interface FixEffect {
  id: string;
  fixId: string;
  deploymentId: string;
  trackingDate: Date;
  performanceMetrics: PerformanceMetrics;
  securityMetrics: SecurityMetrics;
  userFeedback: UserFeedback[];
  errorMetrics: ErrorMetrics;
  businessImpact: BusinessImpact;
  status: 'positive' | 'neutral' | 'negative';
  summary: string;
}

export interface PerformanceMetrics {
  responseTime: MetricValue;
  throughput: MetricValue;
  resourceUtilization: ResourceUtilization;
  latency: MetricValue;
  loadTime: MetricValue;
}

export interface MetricValue {
  current: number;
  baseline: number;
  change: number;
  changePercentage: number;
  unit: string;
}

export interface ResourceUtilization {
  cpu: MetricValue;
  memory: MetricValue;
  disk: MetricValue;
  network: MetricValue;
}

export interface SecurityMetrics {
  vulnerabilityCount: MetricValue;
  securityScore: MetricValue;
  complianceRate: MetricValue;
  incidentCount: MetricValue;
}

export interface UserFeedback {
  id: string;
  userId: string;
  feedbackType: 'bug' | 'feature' | 'suggestion' | 'praise';
  content: string;
  rating: number;
  timestamp: Date;
  relatedToFix: boolean;
}

export interface ErrorMetrics {
  errorRate: MetricValue;
  criticalErrorCount: MetricValue;
  errorTypes: ErrorTypeCount[];
  crashRate: MetricValue;
}

export interface ErrorTypeCount {
  type: string;
  count: number;
  change: number;
}

export interface BusinessImpact {
  conversionRate: MetricValue;
  userRetention: MetricValue;
  revenue: MetricValue;
  engagement: MetricValue;
}

export interface FixEffectTrackerConfig {
  metricsCollectionInterval: number;
  baselinePeriod: number;
  trackingDuration: number;
  dataStoragePath: string;
  alertThresholds: AlertThresholds;
}

export interface AlertThresholds {
  performanceDegradation: number;
  securityVulnerabilityIncrease: number;
  errorRateIncrease: number;
  businessImpactDecrease: number;
}

export interface FixEffectSummary {
  fixId: string;
  overallStatus: 'positive' | 'neutral' | 'negative';
  performanceChange: number;
  securityChange: number;
  errorRateChange: number;
  businessImpactChange: number;
  keyFindings: string[];
  recommendations: string[];
  performanceMetrics?: PerformanceMetrics;
}

/**
 * 修复效果跟踪服务
 * 用于跟踪修复后的效果，包括性能、安全性、用户反馈等
 */
export class FixEffectTracker {
  private readonly config: FixEffectTrackerConfig;
  private trackedEffects: Map<string, FixEffect> = new Map();

  constructor(config?: Partial<FixEffectTrackerConfig>) {
    this.config = {
      metricsCollectionInterval: config?.metricsCollectionInterval || 3600000, // 默认1小时
      baselinePeriod: config?.baselinePeriod || 86400000, // 默认24小时
      trackingDuration: config?.trackingDuration || 604800000, // 默认7天
      dataStoragePath: config?.dataStoragePath || './fix-effects',
      alertThresholds: {
        performanceDegradation: config?.alertThresholds?.performanceDegradation || 20, // 20%
        securityVulnerabilityIncrease: config?.alertThresholds?.securityVulnerabilityIncrease || 50, // 50%
        errorRateIncrease: config?.alertThresholds?.errorRateIncrease || 100, // 100%
        businessImpactDecrease: config?.alertThresholds?.businessImpactDecrease || 10 // 10%
      }
    };

    // 初始化数据存储目录
    this.initializeDataStorage();
  }

  /**
   * 初始化数据存储目录
   */
  private initializeDataStorage(): void {
    if (!fs.existsSync(this.config.dataStoragePath)) {
      fs.mkdirSync(this.config.dataStoragePath, { recursive: true });
    }
  }

  /**
   * 开始跟踪修复效果
   */
  async startTracking(fixId: string, deploymentId: string): Promise<FixEffect> {
    console.log(`开始跟踪修复效果: ${fixId}`);

    try {
      // 获取基线指标
      const baselineMetrics = await this.collectBaselineMetrics();

      // 创建初始跟踪记录
      const fixEffect: FixEffect = {
        id: `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fixId,
        deploymentId,
        trackingDate: new Date(),
        performanceMetrics: {
          responseTime: {
            current: 0,
            baseline: baselineMetrics.responseTime,
            change: 0,
            changePercentage: 0,
            unit: 'ms'
          },
          throughput: {
            current: 0,
            baseline: baselineMetrics.throughput,
            change: 0,
            changePercentage: 0,
            unit: 'req/s'
          },
          resourceUtilization: {
            cpu: {
              current: 0,
              baseline: baselineMetrics.cpuUsage,
              change: 0,
              changePercentage: 0,
              unit: '%'
            },
            memory: {
              current: 0,
              baseline: baselineMetrics.memoryUsage,
              change: 0,
              changePercentage: 0,
              unit: '%'
            },
            disk: {
              current: 0,
              baseline: baselineMetrics.diskUsage,
              change: 0,
              changePercentage: 0,
              unit: '%'
            },
            network: {
              current: 0,
              baseline: baselineMetrics.networkUsage,
              change: 0,
              changePercentage: 0,
              unit: 'MB/s'
            }
          },
          latency: {
            current: 0,
            baseline: baselineMetrics.latency,
            change: 0,
            changePercentage: 0,
            unit: 'ms'
          },
          loadTime: {
            current: 0,
            baseline: baselineMetrics.loadTime,
            change: 0,
            changePercentage: 0,
            unit: 'ms'
          }
        },
        securityMetrics: {
          vulnerabilityCount: {
            current: 0,
            baseline: baselineMetrics.vulnerabilityCount,
            change: 0,
            changePercentage: 0,
            unit: 'count'
          },
          securityScore: {
            current: 100,
            baseline: baselineMetrics.securityScore,
            change: 0,
            changePercentage: 0,
            unit: 'points'
          },
          complianceRate: {
            current: 100,
            baseline: baselineMetrics.complianceRate,
            change: 0,
            changePercentage: 0,
            unit: '%'
          },
          incidentCount: {
            current: 0,
            baseline: baselineMetrics.incidentCount,
            change: 0,
            changePercentage: 0,
            unit: 'count'
          }
        },
        userFeedback: [],
        errorMetrics: {
          errorRate: {
            current: 0,
            baseline: baselineMetrics.errorRate,
            change: 0,
            changePercentage: 0,
            unit: '%'
          },
          criticalErrorCount: {
            current: 0,
            baseline: baselineMetrics.criticalErrorCount,
            change: 0,
            changePercentage: 0,
            unit: 'count'
          },
          errorTypes: [],
          crashRate: {
            current: 0,
            baseline: baselineMetrics.crashRate,
            change: 0,
            changePercentage: 0,
            unit: '%'
          }
        },
        businessImpact: {
          conversionRate: {
            current: 0,
            baseline: baselineMetrics.conversionRate,
            change: 0,
            changePercentage: 0,
            unit: '%'
          },
          userRetention: {
            current: 0,
            baseline: baselineMetrics.userRetention,
            change: 0,
            changePercentage: 0,
            unit: '%'
          },
          revenue: {
            current: 0,
            baseline: baselineMetrics.revenue,
            change: 0,
            changePercentage: 0,
            unit: 'USD'
          },
          engagement: {
            current: 0,
            baseline: baselineMetrics.engagement,
            change: 0,
            changePercentage: 0,
            unit: 'minutes'
          }
        },
        status: 'neutral',
        summary: '初始跟踪记录'
      };

      // 保存跟踪记录
      this.trackedEffects.set(fixEffect.id, fixEffect);
      this.saveFixEffect(fixEffect);

      // 启动定期指标收集
      this.startMetricsCollection(fixEffect.id);

      return fixEffect;
    } catch (error) {
      console.error(`开始跟踪修复效果失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 收集基线指标
   */
  private async collectBaselineMetrics(): Promise<any> {
    // 这里应该从监控系统或历史数据中获取基线指标
    // 暂时返回模拟数据
    return {
      responseTime: 200,
      throughput: 1000,
      cpuUsage: 40,
      memoryUsage: 60,
      diskUsage: 70,
      networkUsage: 50,
      latency: 50,
      loadTime: 1000,
      vulnerabilityCount: 5,
      securityScore: 90,
      complianceRate: 95,
      incidentCount: 2,
      errorRate: 1.5,
      criticalErrorCount: 1,
      crashRate: 0.1,
      conversionRate: 3.5,
      userRetention: 80,
      revenue: 10000,
      engagement: 15
    };
  }

  /**
   * 启动定期指标收集
   */
  private startMetricsCollection(effectId: string): void {
    const interval = setInterval(async () => {
      const effect = this.trackedEffects.get(effectId);
      if (effect) {
        await this.updateMetrics(effect);

        // 检查是否达到跟踪时长
        const trackingDuration = Date.now() - effect.trackingDate.getTime();
        if (trackingDuration >= this.config.trackingDuration) {
          clearInterval(interval);
          this.completeTracking(effectId);
        }
      } else {
        clearInterval(interval);
      }
    }, this.config.metricsCollectionInterval);
  }

  /**
   * 更新指标
   */
  private async updateMetrics(effect: FixEffect): Promise<void> {
    // 模拟收集当前指标
    const currentMetrics = await this.collectCurrentMetrics();

    // 更新性能指标
    effect.performanceMetrics.responseTime.current = currentMetrics.responseTime;
    effect.performanceMetrics.responseTime.change = currentMetrics.responseTime - effect.performanceMetrics.responseTime.baseline;
    effect.performanceMetrics.responseTime.changePercentage = Math.round((effect.performanceMetrics.responseTime.change / effect.performanceMetrics.responseTime.baseline) * 100);

    effect.performanceMetrics.throughput.current = currentMetrics.throughput;
    effect.performanceMetrics.throughput.change = currentMetrics.throughput - effect.performanceMetrics.throughput.baseline;
    effect.performanceMetrics.throughput.changePercentage = Math.round((effect.performanceMetrics.throughput.change / effect.performanceMetrics.throughput.baseline) * 100);

    effect.performanceMetrics.resourceUtilization.cpu.current = currentMetrics.cpuUsage;
    effect.performanceMetrics.resourceUtilization.cpu.change = currentMetrics.cpuUsage - effect.performanceMetrics.resourceUtilization.cpu.baseline;
    effect.performanceMetrics.resourceUtilization.cpu.changePercentage = Math.round((effect.performanceMetrics.resourceUtilization.cpu.change / effect.performanceMetrics.resourceUtilization.cpu.baseline) * 100);

    effect.performanceMetrics.resourceUtilization.memory.current = currentMetrics.memoryUsage;
    effect.performanceMetrics.resourceUtilization.memory.change = currentMetrics.memoryUsage - effect.performanceMetrics.resourceUtilization.memory.baseline;
    effect.performanceMetrics.resourceUtilization.memory.changePercentage = Math.round((effect.performanceMetrics.resourceUtilization.memory.change / effect.performanceMetrics.resourceUtilization.memory.baseline) * 100);

    effect.performanceMetrics.resourceUtilization.disk.current = currentMetrics.diskUsage;
    effect.performanceMetrics.resourceUtilization.disk.change = currentMetrics.diskUsage - effect.performanceMetrics.resourceUtilization.disk.baseline;
    effect.performanceMetrics.resourceUtilization.disk.changePercentage = Math.round((effect.performanceMetrics.resourceUtilization.disk.change / effect.performanceMetrics.resourceUtilization.disk.baseline) * 100);

    effect.performanceMetrics.resourceUtilization.network.current = currentMetrics.networkUsage;
    effect.performanceMetrics.resourceUtilization.network.change = currentMetrics.networkUsage - effect.performanceMetrics.resourceUtilization.network.baseline;
    effect.performanceMetrics.resourceUtilization.network.changePercentage = Math.round((effect.performanceMetrics.resourceUtilization.network.change / effect.performanceMetrics.resourceUtilization.network.baseline) * 100);

    effect.performanceMetrics.latency.current = currentMetrics.latency;
    effect.performanceMetrics.latency.change = currentMetrics.latency - effect.performanceMetrics.latency.baseline;
    effect.performanceMetrics.latency.changePercentage = Math.round((effect.performanceMetrics.latency.change / effect.performanceMetrics.latency.baseline) * 100);

    effect.performanceMetrics.loadTime.current = currentMetrics.loadTime;
    effect.performanceMetrics.loadTime.change = currentMetrics.loadTime - effect.performanceMetrics.loadTime.baseline;
    effect.performanceMetrics.loadTime.changePercentage = Math.round((effect.performanceMetrics.loadTime.change / effect.performanceMetrics.loadTime.baseline) * 100);

    // 更新安全指标
    effect.securityMetrics.vulnerabilityCount.current = currentMetrics.vulnerabilityCount;
    effect.securityMetrics.vulnerabilityCount.change = currentMetrics.vulnerabilityCount - effect.securityMetrics.vulnerabilityCount.baseline;
    effect.securityMetrics.vulnerabilityCount.changePercentage = Math.round((effect.securityMetrics.vulnerabilityCount.change / effect.securityMetrics.vulnerabilityCount.baseline) * 100);

    effect.securityMetrics.securityScore.current = currentMetrics.securityScore;
    effect.securityMetrics.securityScore.change = currentMetrics.securityScore - effect.securityMetrics.securityScore.baseline;
    effect.securityMetrics.securityScore.changePercentage = Math.round((effect.securityMetrics.securityScore.change / effect.securityMetrics.securityScore.baseline) * 100);

    effect.securityMetrics.complianceRate.current = currentMetrics.complianceRate;
    effect.securityMetrics.complianceRate.change = currentMetrics.complianceRate - effect.securityMetrics.complianceRate.baseline;
    effect.securityMetrics.complianceRate.changePercentage = Math.round((effect.securityMetrics.complianceRate.change / effect.securityMetrics.complianceRate.baseline) * 100);

    effect.securityMetrics.incidentCount.current = currentMetrics.incidentCount;
    effect.securityMetrics.incidentCount.change = currentMetrics.incidentCount - effect.securityMetrics.incidentCount.baseline;
    effect.securityMetrics.incidentCount.changePercentage = Math.round((effect.securityMetrics.incidentCount.change / effect.securityMetrics.incidentCount.baseline) * 100);

    // 更新错误指标
    effect.errorMetrics.errorRate.current = currentMetrics.errorRate;
    effect.errorMetrics.errorRate.change = currentMetrics.errorRate - effect.errorMetrics.errorRate.baseline;
    effect.errorMetrics.errorRate.changePercentage = Math.round((effect.errorMetrics.errorRate.change / effect.errorMetrics.errorRate.baseline) * 100);

    effect.errorMetrics.criticalErrorCount.current = currentMetrics.criticalErrorCount;
    effect.errorMetrics.criticalErrorCount.change = currentMetrics.criticalErrorCount - effect.errorMetrics.criticalErrorCount.baseline;
    effect.errorMetrics.criticalErrorCount.changePercentage = Math.round((effect.errorMetrics.criticalErrorCount.change / effect.errorMetrics.criticalErrorCount.baseline) * 100);

    effect.errorMetrics.crashRate.current = currentMetrics.crashRate;
    effect.errorMetrics.crashRate.change = currentMetrics.crashRate - effect.errorMetrics.crashRate.baseline;
    effect.errorMetrics.crashRate.changePercentage = Math.round((effect.errorMetrics.crashRate.change / effect.errorMetrics.crashRate.baseline) * 100);

    // 更新业务影响指标
    effect.businessImpact.conversionRate.current = currentMetrics.conversionRate;
    effect.businessImpact.conversionRate.change = currentMetrics.conversionRate - effect.businessImpact.conversionRate.baseline;
    effect.businessImpact.conversionRate.changePercentage = Math.round((effect.businessImpact.conversionRate.change / effect.businessImpact.conversionRate.baseline) * 100);

    effect.businessImpact.userRetention.current = currentMetrics.userRetention;
    effect.businessImpact.userRetention.change = currentMetrics.userRetention - effect.businessImpact.userRetention.baseline;
    effect.businessImpact.userRetention.changePercentage = Math.round((effect.businessImpact.userRetention.change / effect.businessImpact.userRetention.baseline) * 100);

    effect.businessImpact.revenue.current = currentMetrics.revenue;
    effect.businessImpact.revenue.change = currentMetrics.revenue - effect.businessImpact.revenue.baseline;
    effect.businessImpact.revenue.changePercentage = Math.round((effect.businessImpact.revenue.change / effect.businessImpact.revenue.baseline) * 100);

    effect.businessImpact.engagement.current = currentMetrics.engagement;
    effect.businessImpact.engagement.change = currentMetrics.engagement - effect.businessImpact.engagement.baseline;
    effect.businessImpact.engagement.changePercentage = Math.round((effect.businessImpact.engagement.change / effect.businessImpact.engagement.baseline) * 100);

    // 更新状态
    effect.status = this.evaluateEffectStatus(effect);
    effect.summary = this.generateSummary(effect);

    // 保存更新后的效果记录
    this.saveFixEffect(effect);
  }

  /**
   * 收集当前指标
   */
  private async collectCurrentMetrics(): Promise<any> {
    // 这里应该从监控系统或实时数据中获取当前指标
    // 暂时返回模拟数据
    return {
      responseTime: 180,
      throughput: 1100,
      cpuUsage: 38,
      memoryUsage: 58,
      diskUsage: 68,
      networkUsage: 55,
      latency: 45,
      loadTime: 950,
      vulnerabilityCount: 3,
      securityScore: 93,
      complianceRate: 97,
      incidentCount: 0,
      errorRate: 1.2,
      criticalErrorCount: 0,
      crashRate: 0.05,
      conversionRate: 3.8,
      userRetention: 82,
      revenue: 10500,
      engagement: 16
    };
  }

  /**
   * 评估修复效果状态
   */
  private evaluateEffectStatus(effect: FixEffect): 'positive' | 'neutral' | 'negative' {
    // 综合评估各项指标
    let positiveCount = 0;
    let negativeCount = 0;

    // 性能指标评估
    if (effect.performanceMetrics.responseTime.changePercentage < 0) positiveCount++;
    else if (effect.performanceMetrics.responseTime.changePercentage > this.config.alertThresholds.performanceDegradation) negativeCount++;

    if (effect.performanceMetrics.throughput.changePercentage > 0) positiveCount++;
    else if (effect.performanceMetrics.throughput.changePercentage < -this.config.alertThresholds.performanceDegradation) negativeCount++;

    // 安全指标评估
    if (effect.securityMetrics.vulnerabilityCount.changePercentage < 0) positiveCount++;
    else if (effect.securityMetrics.vulnerabilityCount.changePercentage > this.config.alertThresholds.securityVulnerabilityIncrease) negativeCount++;

    if (effect.securityMetrics.securityScore.changePercentage > 0) positiveCount++;
    else if (effect.securityMetrics.securityScore.changePercentage < 0) negativeCount++;

    // 错误指标评估
    if (effect.errorMetrics.errorRate.changePercentage < 0) positiveCount++;
    else if (effect.errorMetrics.errorRate.changePercentage > this.config.alertThresholds.errorRateIncrease) negativeCount++;

    if (effect.errorMetrics.criticalErrorCount.changePercentage < 0) positiveCount++;
    else if (effect.errorMetrics.criticalErrorCount.changePercentage > 0) negativeCount++;

    // 业务指标评估
    if (effect.businessImpact.conversionRate.changePercentage > 0) positiveCount++;
    else if (effect.businessImpact.conversionRate.changePercentage < -this.config.alertThresholds.businessImpactDecrease) negativeCount++;

    if (effect.businessImpact.revenue.changePercentage > 0) positiveCount++;
    else if (effect.businessImpact.revenue.changePercentage < -this.config.alertThresholds.businessImpactDecrease) negativeCount++;

    // 确定最终状态
    if (positiveCount > negativeCount + 2) return 'positive';
    if (negativeCount > positiveCount + 2) return 'negative';
    return 'neutral';
  }

  /**
   * 生成修复效果摘要
   */
  private generateSummary(effect: FixEffect): string {
    const summary = [];

    // 性能摘要
    if (effect.performanceMetrics.responseTime.changePercentage < 0) {
      summary.push(`响应时间改善了 ${Math.abs(effect.performanceMetrics.responseTime.changePercentage)}%`);
    } else if (effect.performanceMetrics.responseTime.changePercentage > 0) {
      summary.push(`响应时间增加了 ${effect.performanceMetrics.responseTime.changePercentage}%`);
    }

    // 安全摘要
    if (effect.securityMetrics.vulnerabilityCount.change < 0) {
      summary.push(`安全漏洞减少了 ${Math.abs(effect.securityMetrics.vulnerabilityCount.change)} 个`);
    } else if (effect.securityMetrics.vulnerabilityCount.change > 0) {
      summary.push(`安全漏洞增加了 ${effect.securityMetrics.vulnerabilityCount.change} 个`);
    }

    // 错误摘要
    if (effect.errorMetrics.errorRate.changePercentage < 0) {
      summary.push(`错误率降低了 ${Math.abs(effect.errorMetrics.errorRate.changePercentage)}%`);
    } else if (effect.errorMetrics.errorRate.changePercentage > 0) {
      summary.push(`错误率增加了 ${effect.errorMetrics.errorRate.changePercentage}%`);
    }

    // 业务摘要
    if (effect.businessImpact.revenue.changePercentage > 0) {
      summary.push(`收入增加了 ${effect.businessImpact.revenue.changePercentage}%`);
    } else if (effect.businessImpact.revenue.changePercentage < 0) {
      summary.push(`收入减少了 ${Math.abs(effect.businessImpact.revenue.changePercentage)}%`);
    }

    return summary.join('，');
  }

  /**
   * 完成跟踪
   */
  private completeTracking(effectId: string): void {
    const effect = this.trackedEffects.get(effectId);
    if (effect) {
      console.log(`修复效果跟踪完成: ${effect.fixId}`);
      this.saveFixEffect(effect);
      this.generateEffectReport(effect);
    }
  }

  /**
   * 生成效果报告
   */
  private generateEffectReport(effect: FixEffect): void {
    const report = {
      fixId: effect.fixId,
      deploymentId: effect.deploymentId,
      trackingPeriod: {
        start: effect.trackingDate,
        end: new Date()
      },
      overallStatus: effect.status,
      keyMetrics: {
        performance: {
          responseTime: effect.performanceMetrics.responseTime,
          throughput: effect.performanceMetrics.throughput,
          latency: effect.performanceMetrics.latency
        },
        security: {
          vulnerabilityCount: effect.securityMetrics.vulnerabilityCount,
          securityScore: effect.securityMetrics.securityScore
        },
        errors: {
          errorRate: effect.errorMetrics.errorRate,
          criticalErrorCount: effect.errorMetrics.criticalErrorCount
        },
        business: {
          revenue: effect.businessImpact.revenue,
          conversionRate: effect.businessImpact.conversionRate
        }
      },
      summary: effect.summary,
      recommendations: this.generateRecommendations(effect)
    };

    // 保存报告
    const reportPath = path.join(this.config.dataStoragePath, `effect-report-${effect.fixId}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  }

  /**
   * 生成建议
   */
  private generateRecommendations(effect: FixEffect): string[] {
    const recommendations: string[] = [];

    if (effect.performanceMetrics.responseTime.changePercentage > this.config.alertThresholds.performanceDegradation) {
      recommendations.push('考虑进一步优化系统性能，特别是响应时间方面');
    }

    if (effect.securityMetrics.vulnerabilityCount.changePercentage > this.config.alertThresholds.securityVulnerabilityIncrease) {
      recommendations.push('加强安全审查，修复新发现的安全漏洞');
    }

    if (effect.errorMetrics.errorRate.changePercentage > this.config.alertThresholds.errorRateIncrease) {
      recommendations.push('调查错误率增加的原因，及时修复相关问题');
    }

    if (effect.businessImpact.revenue.changePercentage < -this.config.alertThresholds.businessImpactDecrease) {
      recommendations.push('分析收入下降的原因，评估修复对业务的影响');
    }

    if (recommendations.length === 0) {
      recommendations.push('修复效果良好，建议继续监控系统运行状态');
    }

    return recommendations;
  }

  /**
   * 添加用户反馈
   */
  addUserFeedback(effectId: string, feedback: UserFeedback): void {
    const effect = this.trackedEffects.get(effectId);
    if (effect) {
      effect.userFeedback.push(feedback);
      this.saveFixEffect(effect);
    }
  }

  /**
   * 获取修复效果
   */
  getFixEffect(effectId: string): FixEffect | undefined {
    return this.trackedEffects.get(effectId);
  }

  /**
   * 获取修复的所有效果记录
   */
  getFixEffectsByFixId(fixId: string): FixEffect[] {
    const effects: FixEffect[] = [];

    // 从文件系统中加载所有相关效果记录
    const files = fs.readdirSync(this.config.dataStoragePath);
    for (const file of files) {
      if (file.startsWith('effect-') && file.endsWith('.json')) {
        const filePath = path.join(this.config.dataStoragePath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const effect = JSON.parse(content) as FixEffect;
        if (effect.fixId === fixId) {
          effects.push(effect);
        }
      }
    }

    return effects;
  }

  /**
   * 保存修复效果
   */
  private saveFixEffect(effect: FixEffect): void {
    const filePath = path.join(this.config.dataStoragePath, `effect-${effect.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(effect, null, 2), 'utf8');
  }

  /**
   * 生成修复效果摘要
   */
  generateFixEffectSummary(fixId: string): FixEffectSummary {
    const effects = this.getFixEffectsByFixId(fixId);
    if (effects.length === 0) {
      throw new Error(`未找到修复效果记录: ${fixId}`);
    }

    // 获取最新的效果记录
    const latestEffect = effects.sort((a, b) => b.trackingDate.getTime() - a.trackingDate.getTime())[0];

    return {
      fixId: latestEffect.fixId,
      overallStatus: latestEffect.status,
      performanceChange: latestEffect.performanceMetrics.responseTime.changePercentage,
      securityChange: latestEffect.securityMetrics.securityScore.changePercentage,
      errorRateChange: latestEffect.errorMetrics.errorRate.changePercentage,
      businessImpactChange: latestEffect.businessImpact.revenue.changePercentage,
      keyFindings: [
        `性能响应时间变化: ${latestEffect.performanceMetrics.responseTime.changePercentage}%`,
        `安全漏洞数量变化: ${latestEffect.securityMetrics.vulnerabilityCount.changePercentage}%`,
        `错误率变化: ${latestEffect.errorMetrics.errorRate.changePercentage}%`,
        `收入变化: ${latestEffect.businessImpact.revenue.changePercentage}%`
      ],
      recommendations: this.generateRecommendations(latestEffect)
    };
  }
}

// 创建单例实例
export const fixEffectTracker = new FixEffectTracker();
