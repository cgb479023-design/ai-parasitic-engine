import * as fs from 'fs';
import * as path from 'path';
import { FixInfo } from './fixReviewer';
import { DependencyGraph } from './dependencyAnalysisService';
import { FixEffectSummary } from './fixEffectTracker';

// 定义修复风险评估相关接口
export interface FixRiskAssessment {
  id: string;
  fixId: string;
  assessmentDate: Date;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  riskFactors: RiskFactor[];
  dependencyRisks: DependencyRisk[];
  performanceRisks: PerformanceRisk[];
  securityRisks: SecurityRisk[];
  compatibilityRisks: CompatibilityRisk[];
  mitigationStrategies: MitigationStrategy[];
  confidenceLevel: 'low' | 'medium' | 'high';
  assessmentMethod: 'static' | 'dynamic' | 'hybrid';
}

export interface RiskFactor {
  id: string;
  type: 'breaking-change' | 'performance' | 'security' | 'compatibility' | 'maintenance' | 'reliability';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  likelihood: 'low' | 'medium' | 'high' | 'certain';
  impact: 'low' | 'medium' | 'high' | 'critical';
  affectedComponents: string[];
  detectionMethod: 'static-analysis' | 'dynamic-analysis' | 'pattern-matching';
}

export interface DependencyRisk {
  id: string;
  dependencyId: string;
  dependencyName: string;
  riskType: 'version-conflict' | 'deprecated-api' | 'breaking-change' | 'security-vulnerability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation: string;
}

export interface PerformanceRisk {
  id: string;
  metric: 'latency' | 'memory' | 'cpu' | 'throughput' | 'scalability';
  expectedImpact: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  potentialCauses: string[];
  mitigation: string;
}

export interface SecurityRisk {
  id: string;
  vulnerabilityType: 'injection' | 'xss' | 'csrf' | 'broken-auth' | 'sensitive-data-exposure' | 'insecure-config';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedCode: string;
  mitigation: string;
  cvssScore?: number;
}

export interface CompatibilityRisk {
  id: string;
  platform: 'browser' | 'node' | 'database' | 'api' | 'library';
  affectedVersion: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation: string;
}

export interface MitigationStrategy {
  id: string;
  riskId: string;
  strategy: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  implementationEffort: 'low' | 'medium' | 'high';
  expectedEffectiveness: 'low' | 'medium' | 'high';
}

export interface RiskAssessmentConfig {
  enableStaticAnalysis: boolean;
  enableDynamicAnalysis: boolean;
  enableDependencyAnalysis: boolean;
  enableSecurityScanning: boolean;
  riskThresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  confidenceThresholds: {
    low: number;
    medium: number;
    high: number;
  };
}

/**
 * 修复风险评估服务
 * 用于评估修复对系统的潜在风险，生成风险评分和缓解建议
 */
export class FixRiskAssessmentService {
  private readonly config: RiskAssessmentConfig;
  private assessments: Map<string, FixRiskAssessment> = new Map();

  constructor(config?: Partial<RiskAssessmentConfig>) {
    this.config = {
      enableStaticAnalysis: config?.enableStaticAnalysis !== false,
      enableDynamicAnalysis: config?.enableDynamicAnalysis !== false,
      enableDependencyAnalysis: config?.enableDependencyAnalysis !== false,
      enableSecurityScanning: config?.enableSecurityScanning !== false,
      riskThresholds: config?.riskThresholds || {
        low: 0,
        medium: 30,
        high: 60,
        critical: 80
      },
      confidenceThresholds: config?.confidenceThresholds || {
        low: 0,
        medium: 40,
        high: 70
      }
    };
  }

  /**
   * 评估修复风险
   */
  assessFixRisk(
    fixInfo: FixInfo,
    dependencyGraph?: DependencyGraph,
    effectSummary?: FixEffectSummary
  ): FixRiskAssessment {
    const assessmentId = `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 分析风险因素
    const riskFactors = this.analyzeRiskFactors(fixInfo, dependencyGraph);

    // 分析依赖风险
    const dependencyRisks = this.analyzeDependencyRisks(fixInfo, dependencyGraph);

    // 分析性能风险
    const performanceRisks = this.analyzePerformanceRisks(fixInfo, effectSummary);

    // 分析安全风险
    const securityRisks = this.analyzeSecurityRisks(fixInfo);

    // 分析兼容性风险
    const compatibilityRisks = this.analyzeCompatibilityRisks(fixInfo);

    // 计算总体风险评分
    const riskScore = this.calculateRiskScore(riskFactors);

    // 确定总体风险等级
    const overallRisk = this.determineOverallRisk(riskScore);

    // 生成缓解策略
    const mitigationStrategies = this.generateMitigationStrategies(riskFactors);

    // 计算置信度
    const confidenceLevel = this.calculateConfidenceLevel(fixInfo, dependencyGraph);

    // 创建风险评估
    const assessment: FixRiskAssessment = {
      id: assessmentId,
      fixId: fixInfo.id,
      assessmentDate: new Date(),
      overallRisk,
      riskScore,
      riskFactors,
      dependencyRisks,
      performanceRisks,
      securityRisks,
      compatibilityRisks,
      mitigationStrategies,
      confidenceLevel,
      assessmentMethod: this.determineAssessmentMethod()
    };

    // 保存评估
    this.saveAssessment(assessment);
    this.assessments.set(assessmentId, assessment);

    return assessment;
  }

  /**
   * 分析风险因素
   */
  private analyzeRiskFactors(
    fixInfo: FixInfo,
    dependencyGraph?: DependencyGraph
  ): RiskFactor[] {
    const riskFactors: RiskFactor[] = [];

    // 检查修复复杂度
    const fixComplexity = this.calculateFixComplexity(fixInfo.newCode);
    if (fixComplexity === 'high' || fixComplexity === 'critical') {
      riskFactors.push({
        id: `rf_${Date.now()}_complexity`,
        type: 'maintenance',
        description: '修复复杂度高，可能引入新的问题',
        severity: fixComplexity === 'critical' ? 'high' : 'medium',
        likelihood: 'medium',
        impact: 'high',
        affectedComponents: dependencyGraph ?
          dependencyGraph.nodes.map(node => node.name) :
          [fixInfo.filePath],
        detectionMethod: 'static-analysis'
      });
    }

    // 检查破坏性变更
    const hasBreakingChanges = this.detectBreakingChanges(fixInfo.oldCode, fixInfo.newCode);
    if (hasBreakingChanges) {
      riskFactors.push({
        id: `rf_${Date.now()}_breaking`,
        type: 'breaking-change',
        description: '修复包含破坏性变更，可能影响现有功能',
        severity: 'high',
        likelihood: 'high',
        impact: 'high',
        affectedComponents: dependencyGraph ?
          dependencyGraph.nodes.filter(node => node.type === 'function' || node.type === 'class').map(node => node.name) :
          [fixInfo.filePath],
        detectionMethod: 'pattern-matching'
      });
    }

    // 检查性能影响
    const hasPerformanceImpact = this.detectPerformanceImpact(fixInfo.oldCode, fixInfo.newCode);
    if (hasPerformanceImpact) {
      riskFactors.push({
        id: `rf_${Date.now()}_performance`,
        type: 'performance',
        description: '修复可能导致性能下降',
        severity: 'medium',
        likelihood: 'medium',
        impact: 'medium',
        affectedComponents: [fixInfo.filePath],
        detectionMethod: 'static-analysis'
      });
    }

    // 检查安全风险
    const hasSecurityIssues = this.detectSecurityIssues(fixInfo.newCode);
    if (hasSecurityIssues) {
      riskFactors.push({
        id: `rf_${Date.now()}_security`,
        type: 'security',
        description: '修复可能引入安全漏洞',
        severity: 'high',
        likelihood: 'medium',
        impact: 'critical',
        affectedComponents: [fixInfo.filePath],
        detectionMethod: 'pattern-matching'
      });
    }

    // 检查兼容性风险
    const hasCompatibilityIssues = this.detectCompatibilityIssues(fixInfo.newCode);
    if (hasCompatibilityIssues) {
      riskFactors.push({
        id: `rf_${Date.now()}_compatibility`,
        type: 'compatibility',
        description: '修复可能导致兼容性问题',
        severity: 'medium',
        likelihood: 'medium',
        impact: 'medium',
        affectedComponents: [fixInfo.filePath],
        detectionMethod: 'static-analysis'
      });
    }

    return riskFactors;
  }

  /**
   * 分析依赖风险
   */
  private analyzeDependencyRisks(
    fixInfo: FixInfo,
    dependencyGraph?: DependencyGraph
  ): DependencyRisk[] {
    const dependencyRisks: DependencyRisk[] = [];

    if (!dependencyGraph || !this.config.enableDependencyAnalysis) {
      return dependencyRisks;
    }

    // 检查依赖版本冲突
    for (const node of dependencyGraph.nodes) {
      if (node.type === 'file') {
        const versionConflict = this.detectVersionConflict(node.name, fixInfo);
        if (versionConflict) {
          dependencyRisks.push({
            id: `dr_${Date.now()}_${node.id}`,
            dependencyId: node.id,
            dependencyName: node.name,
            riskType: 'version-conflict',
            severity: 'medium',
            description: `依赖版本冲突: ${node.name}`,
            mitigation: '检查并更新依赖版本'
          });
        }
      }
    }

    return dependencyRisks;
  }

  /**
   * 分析性能风险
   */
  private analyzePerformanceRisks(
    fixInfo: FixInfo,
    effectSummary?: FixEffectSummary
  ): PerformanceRisk[] {
    const performanceRisks: PerformanceRisk[] = [];

    // 从修复效果摘要中获取性能数据
    if (effectSummary) {
      // 检查性能指标
      if (effectSummary.performanceMetrics?.latency.current > 1000) {
        performanceRisks.push({
          id: `pr_${Date.now()}_latency`,
          metric: 'latency',
          expectedImpact: 'high',
          description: `修复后延迟增加到 ${effectSummary.performanceMetrics?.latency.current}ms`,
          potentialCauses: ['代码复杂度增加', '新的依赖调用', '低效算法'],
          mitigation: '优化算法或考虑异步处理'
        });
      }

      if (effectSummary.performanceMetrics?.resourceUtilization.memory.current > 100) { // Assuming % or fix unit check
        performanceRisks.push({
          id: `pr_${Date.now()}_memory`,
          metric: 'memory',
          expectedImpact: 'medium',
          description: `修复后内存使用增加到 ${effectSummary.performanceMetrics?.resourceUtilization.memory.current}%`,
          potentialCauses: ['内存泄漏', '对象创建过多', '缓存增加'],
          mitigation: '检查内存使用模式，优化对象生命周期'
        });
      }
    } else {
      // 静态分析性能风险
      const complexity = this.calculateCyclomaticComplexity(fixInfo.newCode);
      if (complexity > 10) {
        performanceRisks.push({
          id: `pr_${Date.now()}_complexity`,
          metric: 'cpu',
          expectedImpact: 'medium',
          description: `修复后圈复杂度为 ${complexity}，可能导致CPU使用率增加`,
          potentialCauses: ['复杂的条件判断', '多层嵌套循环'],
          mitigation: '简化条件判断，拆分复杂函数'
        });
      }
    }

    return performanceRisks;
  }

  /**
   * 分析安全风险
   */
  private analyzeSecurityRisks(fixInfo: FixInfo): SecurityRisk[] {
    const securityRisks: SecurityRisk[] = [];

    if (!this.config.enableSecurityScanning) {
      return securityRisks;
    }

    // 检查常见安全漏洞模式
    const newCode = fixInfo.newCode;

    // 检查XSS风险
    if (newCode.includes('innerHTML =') || newCode.includes('document.write(')) {
      securityRisks.push({
        id: `sr_${Date.now()}_xss`,
        vulnerabilityType: 'xss',
        severity: 'high',
        description: '修复代码中包含XSS风险，直接使用innerHTML或document.write',
        affectedCode: newCode,
        mitigation: '使用textContent或安全的DOM操作方法，对用户输入进行转义',
        cvssScore: 7.2
      });
    }

    // 检查SQL注入风险
    if (newCode.includes('SELECT') && newCode.includes('WHERE') && newCode.includes('+')) {
      securityRisks.push({
        id: `sr_${Date.now()}_sql`,
        vulnerabilityType: 'injection',
        severity: 'critical',
        description: '修复代码中包含SQL注入风险，直接拼接SQL查询',
        affectedCode: newCode,
        mitigation: '使用参数化查询或ORM框架',
        cvssScore: 9.8
      });
    }

    // 检查不安全的eval使用
    if (newCode.includes('eval(') || newCode.includes('Function(')) {
      securityRisks.push({
        id: `sr_${Date.now()}_eval`,
        vulnerabilityType: 'injection',
        severity: 'high',
        description: '修复代码中使用了不安全的eval或Function构造函数',
        affectedCode: newCode,
        mitigation: '避免使用eval，改用其他安全的实现方式',
        cvssScore: 7.5
      });
    }

    return securityRisks;
  }

  /**
   * 分析兼容性风险
   */
  private analyzeCompatibilityRisks(fixInfo: FixInfo): CompatibilityRisk[] {
    const compatibilityRisks: CompatibilityRisk[] = [];

    const newCode = fixInfo.newCode;

    // 检查浏览器兼容性
    if (newCode.includes('??') || newCode.includes('?.') || newCode.includes('=>')) {
      compatibilityRisks.push({
        id: `cr_${Date.now()}_browser`,
        platform: 'browser',
        affectedVersion: 'IE11',
        severity: 'medium',
        description: '修复代码使用了现代JavaScript特性，可能不兼容旧版浏览器',
        mitigation: '使用Babel转译或提供降级方案'
      });
    }

    return compatibilityRisks;
  }

  /**
   * 计算风险评分
   */
  private calculateRiskScore(riskFactors: RiskFactor[]): number {
    if (riskFactors.length === 0) {
      return 0;
    }

    // 计算加权风险分数
    const totalScore = riskFactors.reduce((sum, factor) => {
      const severityWeight = this.getSeverityWeight(factor.severity);
      const likelihoodWeight = this.getLikelihoodWeight(factor.likelihood);
      const impactWeight = this.getImpactWeight(factor.impact);

      // 风险分数 = 严重性 × 可能性 × 影响
      const factorScore = severityWeight * likelihoodWeight * impactWeight;
      return sum + factorScore;
    }, 0);

    // 归一化到0-100分
    const maxPossibleScore = riskFactors.length * 4 * 4 * 4; // 每个因子最高分数：4×4×4=64
    const normalizedScore = Math.round((totalScore / maxPossibleScore) * 100);

    return Math.min(100, normalizedScore);
  }

  /**
   * 确定总体风险等级
   */
  private determineOverallRisk(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= this.config.riskThresholds.critical) {
      return 'critical';
    } else if (score >= this.config.riskThresholds.high) {
      return 'high';
    } else if (score >= this.config.riskThresholds.medium) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * 生成缓解策略
   */
  private generateMitigationStrategies(riskFactors: RiskFactor[]): MitigationStrategy[] {
    const strategies: MitigationStrategy[] = [];

    for (const factor of riskFactors) {
      let strategy = '';

      switch (factor.type) {
        case 'breaking-change':
          strategy = '添加向后兼容层，或在主要版本更新中包含此变更';
          break;
        case 'performance':
          strategy = '进行性能测试，优化算法，考虑异步处理';
          break;
        case 'security':
          strategy = '进行安全审查，修复发现的漏洞，添加安全测试';
          break;
        case 'compatibility':
          strategy = '测试不同环境，添加polyfill或降级方案';
          break;
        case 'maintenance':
          strategy = '简化代码，添加注释，进行代码审查';
          break;
        case 'reliability':
          strategy = '添加单元测试，进行容错设计，考虑降级机制';
          break;
      }

      strategies.push({
        id: `ms_${Date.now()}_${factor.id}`,
        riskId: factor.id,
        strategy,
        priority: factor.severity,
        implementationEffort: this.estimateImplementationEffort(factor),
        expectedEffectiveness: 'high'
      });
    }

    return strategies;
  }

  /**
   * 计算置信度
   */
  private calculateConfidenceLevel(
    fixInfo: FixInfo,
    dependencyGraph?: DependencyGraph
  ): 'low' | 'medium' | 'high' {
    let confidenceScore = 0;

    // 基于分析方法计算置信度
    if (this.config.enableStaticAnalysis) confidenceScore += 30;
    if (this.config.enableDynamicAnalysis) confidenceScore += 30;
    if (this.config.enableDependencyAnalysis) confidenceScore += 20;
    if (this.config.enableSecurityScanning) confidenceScore += 20;

    // 基于依赖图完整性调整置信度
    if (dependencyGraph && dependencyGraph.nodes.length > 0) {
      confidenceScore += 10;
    }

    // 确定置信度等级
    if (confidenceScore >= this.config.confidenceThresholds.high) {
      return 'high';
    } else if (confidenceScore >= this.config.confidenceThresholds.medium) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * 确定评估方法
   */
  private determineAssessmentMethod(): 'static' | 'dynamic' | 'hybrid' {
    if (this.config.enableStaticAnalysis && this.config.enableDynamicAnalysis) {
      return 'hybrid';
    } else if (this.config.enableDynamicAnalysis) {
      return 'dynamic';
    } else {
      return 'static';
    }
  }

  /**
   * 检测破坏性变更
   */
  private detectBreakingChanges(oldCode: string, newCode: string): boolean {
    // 检查函数签名变更
    const oldFunctionRegex = /function\s+\w+\s*\(([^)]*)\)/g;
    const newFunctionRegex = /function\s+\w+\s*\(([^)]*)\)/g;

    const oldFunctions = Array.from(oldCode.matchAll(oldFunctionRegex));
    const newFunctions = Array.from(newCode.matchAll(newFunctionRegex));

    if (oldFunctions.length !== newFunctions.length) {
      return true;
    }

    // 检查返回值类型变更
    if (oldCode.includes('return') && newCode.includes('return')) {
      const oldReturns = oldCode.match(/return\s+[^;]+;/g) || [];
      const newReturns = newCode.match(/return\s+[^;]+;/g) || [];

      // 检查返回值类型是否有显著变化
      for (let i = 0; i < Math.min(oldReturns.length, newReturns.length); i++) {
        const oldReturn = oldReturns[i];
        const newReturn = newReturns[i];

        if (oldReturn.includes('null') && !newReturn.includes('null') ||
          oldReturn.includes('undefined') && !newReturn.includes('undefined') ||
          oldReturn.includes('true') && !newReturn.includes('true') ||
          oldReturn.includes('false') && !newReturn.includes('false')) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 检测性能影响
   */
  private detectPerformanceImpact(oldCode: string, newCode: string): boolean {
    // 检查循环复杂度变化
    const oldComplexity = this.calculateCyclomaticComplexity(oldCode);
    const newComplexity = this.calculateCyclomaticComplexity(newCode);

    // 如果复杂度增加超过50%，则认为有性能影响
    if (newComplexity > oldComplexity * 1.5) {
      return true;
    }

    // 检查是否添加了新的依赖调用
    const oldDependencyCalls = (oldCode.match(/\w+\(/) || []).length;
    const newDependencyCalls = (newCode.match(/\w+\(/) || []).length;

    if (newDependencyCalls > oldDependencyCalls * 2) {
      return true;
    }

    return false;
  }

  /**
   * 检测安全问题
   */
  private detectSecurityIssues(code: string): boolean {
    // 检查常见安全问题模式
    const securityPatterns = [
      /eval\s*\(/, // eval使用
      /Function\s*\(/, // Function构造函数
      /innerHTML\s*=/, // 直接设置innerHTML
      /document\.write\s*\(/, // document.write
      /location\.href\s*=\s*[^'"].*[^'"\s;]/, // 直接设置location.href
      /password|secret|key\s*=\s*[^'"].*[^'"\s;]/ // 硬编码密码
    ];

    return securityPatterns.some(pattern => pattern.test(code));
  }

  /**
   * 检测兼容性问题
   */
  private detectCompatibilityIssues(code: string): boolean {
    // 检查现代JavaScript特性
    const modernFeatures = [
      /\?\?/, // 空值合并运算符
      /\?\./, // 可选链操作符
      /=>/, // 箭头函数
      /async\s+function/, // async函数
      /await\s+/, // await关键字
      /class\s+/, // class语法
      /import\s+|export\s+/ // ES模块
    ];

    return modernFeatures.some(feature => feature.test(code));
  }

  /**
   * 检测版本冲突
   */
  private detectVersionConflict(dependencyName: string, fixInfo: FixInfo): boolean {
    // 简化的版本冲突检测，实际实现需要更复杂的逻辑
    // 这里只是检查依赖名称是否包含版本号
    return dependencyName.includes('@') && dependencyName.includes('.');
  }

  /**
   * 计算修复复杂度
   */
  private calculateFixComplexity(code: string): 'low' | 'medium' | 'high' | 'critical' {
    const lines = code.split('\n').length;
    const complexity = this.calculateCyclomaticComplexity(code);

    if (lines > 100 || complexity > 15) {
      return 'critical';
    } else if (lines > 50 || complexity > 10) {
      return 'high';
    } else if (lines > 20 || complexity > 5) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * 计算圈复杂度
   */
  private calculateCyclomaticComplexity(code: string): number {
    // 简单的圈复杂度计算，基于控制流语句数量
    let complexity = 1; // 基础复杂度

    // 增加条件分支的复杂度
    complexity += (code.match(/if\s*\(/g) || []).length;
    complexity += (code.match(/for\s*\(/g) || []).length;
    complexity += (code.match(/while\s*\(/g) || []).length;
    complexity += (code.match(/do\s*{/g) || []).length;
    complexity += (code.match(/case\s+/g) || []).length;
    complexity += (code.match(/&&/g) || []).length;
    complexity += (code.match(/\|\|/g) || []).length;
    complexity += (code.match(/\?/g) || []).length;
    complexity += (code.match(/catch\s*\(/g) || []).length;

    return complexity;
  }

  /**
   * 获取严重性权重
   */
  private getSeverityWeight(severity: string): number {
    switch (severity) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 1;
    }
  }

  /**
   * 获取可能性权重
   */
  private getLikelihoodWeight(likelihood: string): number {
    switch (likelihood) {
      case 'certain': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 1;
    }
  }

  /**
   * 获取影响权重
   */
  private getImpactWeight(impact: string): number {
    switch (impact) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 1;
    }
  }

  /**
   * 估计实现努力
   */
  private estimateImplementationEffort(factor: RiskFactor): 'low' | 'medium' | 'high' {
    switch (factor.severity) {
      case 'critical': return 'high';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      default: return 'medium';
    }
  }

  /**
   * 保存评估结果
   */
  private saveAssessment(assessment: FixRiskAssessment): void {
    const assessmentsDir = './assessments';
    if (!fs.existsSync(assessmentsDir)) {
      fs.mkdirSync(assessmentsDir, { recursive: true });
    }

    const assessmentPath = path.join(assessmentsDir, `assessment-${assessment.id}.json`);
    fs.writeFileSync(assessmentPath, JSON.stringify(assessment, null, 2), 'utf8');
  }

  /**
   * 获取评估结果
   */
  getAssessment(assessmentId: string): FixRiskAssessment | undefined {
    return this.assessments.get(assessmentId);
  }

  /**
   * 获取修复的所有评估
   */
  getAssessmentsByFixId(fixId: string): FixRiskAssessment[] {
    return Array.from(this.assessments.values())
      .filter(assessment => assessment.fixId === fixId)
      .sort((a, b) => b.assessmentDate.getTime() - a.assessmentDate.getTime());
  }

  /**
   * 删除评估结果
   */
  deleteAssessment(assessmentId: string): void {
    // 删除文件
    const assessmentPath = path.join('./assessments', `assessment-${assessmentId}.json`);
    if (fs.existsSync(assessmentPath)) {
      fs.unlinkSync(assessmentPath);
    }

    // 从缓存中删除
    this.assessments.delete(assessmentId);
  }

  /**
   * 导出评估结果
   */
  exportAssessment(assessmentId: string, format: 'json' | 'markdown' | 'html'): string {
    const assessment = this.assessments.get(assessmentId);
    if (!assessment) {
      throw new Error(`评估结果不存在: ${assessmentId}`);
    }

    if (format === 'json') {
      return JSON.stringify(assessment, null, 2);
    } else if (format === 'markdown') {
      return this.generateMarkdownReport(assessment);
    } else {
      return this.generateHtmlReport(assessment);
    }
  }

  /**
   * 生成Markdown报告
   */
  private generateMarkdownReport(assessment: FixRiskAssessment): string {
    let report = `# 修复风险评估报告\n\n`;
    report += `## 基本信息\n`;
    report += `- 评估ID: ${assessment.id}\n`;
    report += `- 修复ID: ${assessment.fixId}\n`;
    report += `- 评估日期: ${assessment.assessmentDate.toISOString()}\n`;
    report += `- 总体风险: **${assessment.overallRisk.toUpperCase()}**\n`;
    report += `- 风险评分: **${assessment.riskScore}/100**\n`;
    report += `- 置信度: ${assessment.confidenceLevel.toUpperCase()}\n`;
    report += `- 评估方法: ${assessment.assessmentMethod.toUpperCase()}\n\n`;

    // 添加风险因素
    if (assessment.riskFactors.length > 0) {
      report += `## 风险因素\n`;
      report += `| 类型 | 描述 | 严重性 | 可能性 | 影响 |\n`;
      report += `|------|------|--------|--------|------|\n`;
      for (const factor of assessment.riskFactors) {
        report += `| ${factor.type} | ${factor.description} | ${factor.severity} | ${factor.likelihood} | ${factor.impact} |\n`;
      }
      report += `\n`;
    }

    // 添加缓解策略
    if (assessment.mitigationStrategies.length > 0) {
      report += `## 缓解策略\n`;
      for (const strategy of assessment.mitigationStrategies) {
        report += `- **${strategy.strategy}** (优先级: ${strategy.priority}, 实现努力: ${strategy.implementationEffort})\n`;
      }
      report += `\n`;
    }

    return report;
  }

  /**
   * 生成HTML报告
   */
  private generateHtmlReport(assessment: FixRiskAssessment): string {
    // 简化的HTML报告生成
    return `<html><body><h1>修复风险评估报告</h1><p>总体风险: ${assessment.overallRisk}</p><p>风险评分: ${assessment.riskScore}/100</p></body></html>`;
  }
}

// 创建单例实例
export const fixRiskAssessmentService = new FixRiskAssessmentService();
