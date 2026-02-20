import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// 定义修复方案评审相关接口
export interface FixReview {
  id: string;
  fixId: string;
  reviewer: 'auto' | 'manual';
  reviewDate: Date;
  status: 'approved' | 'rejected' | 'needs-improvement';
  score: number;
  comments: ReviewComment[];
  complianceReport: ComplianceReport;
  bestPracticeReport: BestPracticeReport;
  riskAssessment: RiskAssessment;
}

export interface ReviewComment {
  id: string;
  type: 'issue' | 'suggestion' | 'question' | 'praise';
  severity: 'low' | 'medium' | 'high' | 'critical';
  content: string;
  location: CodeLocation;
  lineNumber?: number;
  columnNumber?: number;
}

export interface CodeLocation {
  filePath: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export interface ComplianceReport {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  complianceRate: number;
  failedRules: string[];
}

export interface BestPracticeReport {
  codeQuality: QualityMetric;
  performance: QualityMetric;
  maintainability: QualityMetric;
  security: QualityMetric;
  readability: QualityMetric;
}

export interface QualityMetric {
  score: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[];
  suggestions: string[];
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  riskFactors: RiskFactor[];
  mitigationSuggestions: string[];
}

export interface RiskFactor {
  id: string;
  type: 'breaking-change' | 'performance' | 'security' | 'compatibility' | 'maintenance';
  description: string;
  severity: 'low' | 'medium' | 'high';
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
}

export interface FixInfo {
  id: string;
  filePath: string;
  line: number;
  column: number;
  oldCode: string;
  newCode: string;
  fixType: 'bug' | 'feature' | 'refactor' | 'performance' | 'breaking-change' | 'security';
  description: string;
  author: string;
  fixDate: Date;
}

export interface FixReviewConfig {
  enableCodeQualityChecks: boolean;
  enablePerformanceChecks: boolean;
  enableSecurityChecks: boolean;
  enableMaintainabilityChecks: boolean;
  enableReadabilityChecks: boolean;
  approvalThreshold: number;
  autoApprove: boolean;
}

export interface FixReviewResult {
  review: FixReview;
  success: boolean;
  canAutoApprove: boolean;
}

/**
 * 修复方案评审服务
 * 对修复方案进行自动评审，检查修复方案是否符合最佳实践
 */
export class FixReviewer {
  private readonly config: FixReviewConfig;

  constructor(config?: Partial<FixReviewConfig>) {
    this.config = {
      enableCodeQualityChecks: config?.enableCodeQualityChecks || true,
      enablePerformanceChecks: config?.enablePerformanceChecks || true,
      enableSecurityChecks: config?.enableSecurityChecks || true,
      enableMaintainabilityChecks: config?.enableMaintainabilityChecks || true,
      enableReadabilityChecks: config?.enableReadabilityChecks || true,
      approvalThreshold: config?.approvalThreshold || 80,
      autoApprove: config?.autoApprove || false
    };
  }

  /**
   * 评审修复方案
   */
  async reviewFix(fixInfo: FixInfo): Promise<FixReviewResult> {
    console.log(`评审修复方案: ${fixInfo.description}`);

    try {
      // 分析修复内容
      const fixAnalysis = this.analyzeFix(fixInfo);

      // 执行各种检查
      const comments: ReviewComment[] = [];
      const complianceReport = this.generateComplianceReport(fixInfo, fixAnalysis);
      const bestPracticeReport = this.generateBestPracticeReport(fixInfo, fixAnalysis);
      const riskAssessment = this.generateRiskAssessment(fixInfo, fixAnalysis);

      // 收集所有评论
      comments.push(...this.checkCodeQuality(fixInfo, fixAnalysis));
      if (this.config.enablePerformanceChecks) {
        comments.push(...this.checkPerformance(fixInfo, fixAnalysis));
      }
      if (this.config.enableSecurityChecks) {
        comments.push(...this.checkSecurity(fixInfo, fixAnalysis));
      }
      if (this.config.enableMaintainabilityChecks) {
        comments.push(...this.checkMaintainability(fixInfo, fixAnalysis));
      }
      if (this.config.enableReadabilityChecks) {
        comments.push(...this.checkReadability(fixInfo, fixAnalysis));
      }

      // 计算评审分数
      const score = this.calculateReviewScore(complianceReport, bestPracticeReport, riskAssessment, comments);

      // 确定评审状态
      let status: 'approved' | 'rejected' | 'needs-improvement' = 'approved';
      if (score < this.config.approvalThreshold) {
        status = score < this.config.approvalThreshold * 0.7 ? 'rejected' : 'needs-improvement';
      }

      // 创建评审报告
      const review: FixReview = {
        id: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fixId: fixInfo.id,
        reviewer: 'auto',
        reviewDate: new Date(),
        status,
        score,
        comments,
        complianceReport,
        bestPracticeReport,
        riskAssessment
      };

      // 检查是否可以自动批准
      const canAutoApprove = this.config.autoApprove && status === 'approved' &&
        riskAssessment.overallRisk === 'low' &&
        comments.filter(c => c.severity === 'high' || c.severity === 'critical').length === 0;

      return {
        review,
        success: true,
        canAutoApprove
      };
    } catch (error) {
      console.error(`评审修复方案失败: ${error.message}`);

      // 创建失败的评审报告
      const review: FixReview = {
        id: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fixId: fixInfo.id,
        reviewer: 'auto',
        reviewDate: new Date(),
        status: 'needs-improvement',
        score: 0,
        comments: [{
          id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'issue',
          severity: 'critical',
          content: `评审过程中发生错误: ${error.message}`,
          location: {
            filePath: fixInfo.filePath,
            line: fixInfo.line,
            column: fixInfo.column,
            endLine: fixInfo.line + fixInfo.newCode.split('\n').length - 1,
            endColumn: fixInfo.column + fixInfo.newCode.length - 1
          }
        }],
        complianceReport: {
          totalChecks: 0,
          passedChecks: 0,
          failedChecks: 0,
          complianceRate: 0,
          failedRules: ['评审过程失败']
        },
        bestPracticeReport: {
          codeQuality: {
            score: 0,
            status: 'poor',
            issues: ['评审过程失败'],
            suggestions: []
          },
          performance: {
            score: 0,
            status: 'poor',
            issues: ['评审过程失败'],
            suggestions: []
          },
          maintainability: {
            score: 0,
            status: 'poor',
            issues: ['评审过程失败'],
            suggestions: []
          },
          security: {
            score: 0,
            status: 'poor',
            issues: ['评审过程失败'],
            suggestions: []
          },
          readability: {
            score: 0,
            status: 'poor',
            issues: ['评审过程失败'],
            suggestions: []
          }
        },
        riskAssessment: {
          overallRisk: 'high',
          riskFactors: [{
            id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'maintenance',
            description: '评审过程失败，无法评估风险',
            severity: 'high',
            likelihood: 'high',
            impact: 'high'
          }],
          mitigationSuggestions: ['修复评审服务故障']
        }
      };

      return {
        review,
        success: false,
        canAutoApprove: false
      };
    }
  }

  /**
   * 分析修复内容
   */
  private analyzeFix(fixInfo: FixInfo) {
    const sourceFile = this.getSourceFile(fixInfo.filePath);
    if (!sourceFile) {
      throw new Error(`无法读取文件: ${fixInfo.filePath}`);
    }

    // 查找修复位置的父节点
    const fixPosition = sourceFile.getPositionOfLineAndCharacter(fixInfo.line - 1, fixInfo.column - 1);
    const fixNode = this.findEnclosingNode(sourceFile, fixPosition);

    // 提取修复前后的代码
    const oldLines = fixInfo.oldCode.split('\n');
    const newLines = fixInfo.newCode.split('\n');

    // 分析修复类型
    let fixTypeAnalysis: any = null;
    if (fixInfo.fixType === 'bug') {
      fixTypeAnalysis = this.analyzeBugFix(fixInfo, fixNode);
    } else if (fixInfo.fixType === 'feature') {
      fixTypeAnalysis = this.analyzeFeatureFix(fixInfo, fixNode);
    } else if (fixInfo.fixType === 'refactor') {
      fixTypeAnalysis = this.analyzeRefactorFix(fixInfo, fixNode);
    } else if (fixInfo.fixType === 'performance') {
      fixTypeAnalysis = this.analyzePerformanceFix(fixInfo, fixNode);
    }

    return {
      sourceFile,
      fixNode,
      oldLines,
      newLines,
      fixTypeAnalysis,
      affectedLines: this.getAffectedLines(fixInfo)
    };
  }

  /**
   * 查找包含指定位置的节点
   */
  private findEnclosingNode(sourceFile: ts.SourceFile, position: number): ts.Node | undefined {
    const currentNode: ts.Node | undefined = sourceFile;
    let enclosingNode: ts.Node | undefined;

    const visitor = (node: ts.Node) => {
      if (ts.isSourceFile(node)) {
        // 跳过源文件节点，直接处理其子节点
        ts.forEachChild(node, visitor);
        return;
      }

      if (position >= node.getStart() && position <= node.getEnd()) {
        enclosingNode = node;
        ts.forEachChild(node, visitor);
      }
    };

    visitor(sourceFile);
    return enclosingNode;
  }

  /**
   * 分析Bug修复
   */
  private analyzeBugFix(fixInfo: FixInfo, fixNode: ts.Node | undefined) {
    // 简单的Bug修复分析，实际实现需要更复杂的逻辑
    return {
      bugType: this.detectBugType(fixInfo.oldCode, fixInfo.newCode),
      fixComplexity: this.calculateFixComplexity(fixInfo.newCode),
      hasRegressionRisk: this.checkRegressionRisk(fixInfo.oldCode, fixInfo.newCode)
    };
  }

  /**
   * 分析功能修复
   */
  private analyzeFeatureFix(fixInfo: FixInfo, fixNode: ts.Node | undefined) {
    // 简单的功能修复分析，实际实现需要更复杂的逻辑
    return {
      featureScope: this.detectFeatureScope(fixInfo.newCode),
      hasBreakingChanges: this.checkBreakingChanges(fixInfo.oldCode, fixInfo.newCode),
      apiCompatibility: this.checkApiCompatibility(fixInfo.oldCode, fixInfo.newCode)
    };
  }

  /**
   * 分析重构修复
   */
  private analyzeRefactorFix(fixInfo: FixInfo, fixNode: ts.Node | undefined) {
    // 简单的重构分析，实际实现需要更复杂的逻辑
    return {
      refactorType: this.detectRefactorType(fixInfo.oldCode, fixInfo.newCode),
      codeSimplification: this.checkCodeSimplification(fixInfo.oldCode, fixInfo.newCode),
      maintainabilityImprovement: this.checkMaintainabilityImprovement(fixInfo.oldCode, fixInfo.newCode)
    };
  }

  /**
   * 分析性能修复
   */
  private analyzePerformanceFix(fixInfo: FixInfo, fixNode: ts.Node | undefined) {
    // 简单的性能修复分析，实际实现需要更复杂的逻辑
    return {
      performanceImprovement: this.estimatePerformanceImprovement(fixInfo.oldCode, fixInfo.newCode),
      hasSideEffects: this.checkSideEffects(fixInfo.oldCode, fixInfo.newCode),
      scalabilityImpact: this.checkScalabilityImpact(fixInfo.newCode)
    };
  }

  /**
   * 检测Bug类型
   */
  private detectBugType(oldCode: string, newCode: string): string {
    // 简单的Bug类型检测，实际实现需要更复杂的逻辑
    if (oldCode.includes('==') && newCode.includes('===')) {
      return 'type-coercion-bug';
    } else if (oldCode.includes('null') && newCode.includes('undefined') ||
      oldCode.includes('undefined') && newCode.includes('null')) {
      return 'null-undefined-confusion';
    } else if (oldCode.includes('!==') && newCode.includes('!==') ||
      oldCode.includes('===') && newCode.includes('===')) {
      return 'logical-condition-bug';
    } else {
      return 'general-bug';
    }
  }

  /**
   * 计算修复复杂度
   */
  private calculateFixComplexity(code: string): 'low' | 'medium' | 'high' {
    const lines = code.split('\n').length;
    const complexity = this.calculateCyclomaticComplexity(code);

    if (lines > 50 || complexity > 10) {
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
    // 简单的圈复杂度计算，实际实现需要更复杂的逻辑
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

    return complexity;
  }

  /**
   * 检查回归风险
   */
  private checkRegressionRisk(oldCode: string, newCode: string): boolean {
    // 简单的回归风险检查，实际实现需要更复杂的逻辑
    return newCode.length > oldCode.length * 2 ||
      newCode.includes('eval(') ||
      newCode.includes('with(') ||
      newCode.includes('Function(');
  }

  /**
   * 检测功能范围
   */
  private detectFeatureScope(code: string): 'small' | 'medium' | 'large' {
    const lines = code.split('\n').length;

    if (lines > 100) {
      return 'large';
    } else if (lines > 50) {
      return 'medium';
    } else {
      return 'small';
    }
  }

  /**
   * 检查破坏性变更
   */
  private checkBreakingChanges(oldCode: string, newCode: string): boolean {
    // 简单的破坏性变更检查，实际实现需要更复杂的逻辑
    return newCode.includes('throw new Error') ||
      newCode.includes('return undefined') ||
      newCode.includes('return null') ||
      newCode.includes('void 0');
  }

  /**
   * 检查API兼容性
   */
  private checkApiCompatibility(oldCode: string, newCode: string): 'compatible' | 'partially-compatible' | 'incompatible' {
    // 简单的API兼容性检查，实际实现需要更复杂的逻辑
    if (oldCode.includes('function') && !newCode.includes('function')) {
      return 'incompatible';
    } else if (oldCode.includes('export') !== newCode.includes('export')) {
      return 'incompatible';
    } else {
      return 'compatible';
    }
  }

  /**
   * 检测重构类型
   */
  private detectRefactorType(oldCode: string, newCode: string): string {
    // 简单的重构类型检测，实际实现需要更复杂的逻辑
    if (oldCode.length > newCode.length * 1.5) {
      return 'code-simplification';
    } else if (newCode.includes('class') && !oldCode.includes('class')) {
      return 'object-oriented-refactor';
    } else if (newCode.includes('const') || newCode.includes('let')) {
      return 'variable-declaration-refactor';
    } else {
      return 'general-refactor';
    }
  }

  /**
   * 检查代码简化
   */
  private checkCodeSimplification(oldCode: string, newCode: string): boolean {
    return newCode.length < oldCode.length * 0.8;
  }

  /**
   * 检查可维护性改进
   */
  private checkMaintainabilityImprovement(oldCode: string, newCode: string): boolean {
    // 简单的可维护性检查，实际实现需要更复杂的逻辑
    return newCode.includes('const') || newCode.includes('let') ||
      newCode.includes('=>') || newCode.includes('async') ||
      newCode.includes('await');
  }

  /**
   * 估计性能改进
   */
  private estimatePerformanceImprovement(oldCode: string, newCode: string): 'low' | 'medium' | 'high' {
    // 简单的性能改进估计，实际实现需要更复杂的逻辑
    if (oldCode.includes('for ') && newCode.includes('map(') ||
      oldCode.includes('forEach(') && newCode.includes('map(')) {
      return 'medium';
    } else if (oldCode.includes('filter(') && newCode.includes('reduce(') ||
      oldCode.includes('map(') && newCode.includes('reduce(')) {
      return 'high';
    } else {
      return 'low';
    }
  }

  /**
   * 检查副作用
   */
  private checkSideEffects(oldCode: string, newCode: string): boolean {
    // 简单的副作用检查，实际实现需要更复杂的逻辑
    return newCode.includes('global.') || newCode.includes('window.') ||
      newCode.includes('document.') || newCode.includes('localStorage.') ||
      newCode.includes('sessionStorage.');
  }

  /**
   * 检查可扩展性影响
   */
  private checkScalabilityImpact(code: string): 'low' | 'medium' | 'high' {
    // 简单的可扩展性检查，实际实现需要更复杂的逻辑
    if (code.includes('for (let i = 0') || code.includes('while (') ||
      code.includes('do {')) {
      return 'medium';
    } else if (code.includes('map(') || code.includes('filter(') ||
      code.includes('reduce(')) {
      return 'low';
    } else {
      return 'high';
    }
  }

  /**
   * 获取受影响的行号
   */
  private getAffectedLines(fixInfo: FixInfo): number[] {
    const affectedLines = new Set<number>();
    const oldLines = fixInfo.oldCode.split('\n');

    for (let i = 0; i < oldLines.length; i++) {
      affectedLines.add(fixInfo.line + i);
    }

    return Array.from(affectedLines).sort((a, b) => a - b);
  }

  /**
   * 生成合规性报告
   */
  private generateComplianceReport(fixInfo: FixInfo, fixAnalysis: any): ComplianceReport {
    const checks = this.runComplianceChecks(fixInfo, fixAnalysis);
    const totalChecks = checks.length;
    const passedChecks = checks.filter(check => check.passed).length;
    const failedChecks = totalChecks - passedChecks;
    const complianceRate = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;
    const failedRules = checks.filter(check => !check.passed).map(check => check.ruleId);

    return {
      totalChecks,
      passedChecks,
      failedChecks,
      complianceRate,
      failedRules
    };
  }

  /**
   * 运行合规性检查
   */
  private runComplianceChecks(fixInfo: FixInfo, fixAnalysis: any): any[] {
    const checks = [];

    // 基本语法检查
    checks.push({
      ruleId: 'syntax-check',
      ruleName: '语法检查',
      passed: this.checkSyntax(fixInfo.newCode),
      description: '检查修复后的代码是否符合语法规则'
    });

    // 类型安全检查
    checks.push({
      ruleId: 'type-safety-check',
      ruleName: '类型安全检查',
      passed: this.checkTypeSafety(fixInfo.newCode),
      description: '检查修复后的代码是否使用了严格的类型检查'
    });

    // 最佳实践检查
    checks.push({
      ruleId: 'best-practice-check',
      ruleName: '最佳实践检查',
      passed: this.checkBestPractices(fixInfo.newCode),
      description: '检查修复后的代码是否符合最佳实践'
    });

    // 性能最佳实践检查
    if (this.config.enablePerformanceChecks) {
      checks.push({
        ruleId: 'performance-check',
        ruleName: '性能检查',
        passed: this.checkPerformanceBestPractices(fixInfo.newCode),
        description: '检查修复后的代码是否符合性能最佳实践'
      });
    }

    // 安全性检查
    if (this.config.enableSecurityChecks) {
      checks.push({
        ruleId: 'security-check',
        ruleName: '安全性检查',
        passed: this.checkSecurityBestPractices(fixInfo.newCode),
        description: '检查修复后的代码是否符合安全最佳实践'
      });
    }

    return checks;
  }

  /**
   * 检查语法
   */
  private checkSyntax(code: string): boolean {
    try {
      // 简单的语法检查，实际实现需要更复杂的逻辑
      new Function(code);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查类型安全
   */
  private checkTypeSafety(code: string): boolean {
    // 简单的类型安全检查，实际实现需要更复杂的逻辑
    return code.includes('===') || code.includes('!==') ||
      code.includes('const') || code.includes('let');
  }

  /**
   * 检查最佳实践
   */
  private checkBestPractices(code: string): boolean {
    // 简单的最佳实践检查，实际实现需要更复杂的逻辑
    return !code.includes('var') && !code.includes('with(') &&
      !code.includes('eval(') && !code.includes('Function(');
  }

  /**
   * 检查性能最佳实践
   */
  private checkPerformanceBestPractices(code: string): boolean {
    // 简单的性能最佳实践检查，实际实现需要更复杂的逻辑
    return !code.includes('for in') ||
      code.includes('hasOwnProperty') ||
      !code.includes('delete') ||
      !code.includes('typeof ');
  }

  /**
   * 检查安全最佳实践
   */
  private checkSecurityBestPractices(code: string): boolean {
    // 简单的安全最佳实践检查，实际实现需要更复杂的逻辑
    return !code.includes('innerHTML =') ||
      !code.includes('document.write(') ||
      !code.includes('location.href =') ||
      !code.includes('eval(');
  }

  /**
   * 生成最佳实践报告
   */
  private generateBestPracticeReport(fixInfo: FixInfo, fixAnalysis: any): BestPracticeReport {
    const codeQuality = this.assessCodeQuality(fixInfo.newCode);
    const performance = this.assessPerformance(fixInfo.newCode);
    const maintainability = this.assessMaintainability(fixInfo.newCode);
    const security = this.assessSecurity(fixInfo.newCode);
    const readability = this.assessReadability(fixInfo.newCode);

    return {
      codeQuality,
      performance,
      maintainability,
      security,
      readability
    };
  }

  /**
   * 评估代码质量
   */
  private assessCodeQuality(code: string): QualityMetric {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (code.includes('var')) {
      issues.push('应使用const或let代替var');
    }

    if (code.includes('==') || code.includes('!=')) {
      issues.push('应使用===或!==进行严格比较');
    }

    if (code.length > 500) {
      suggestions.push('代码长度较长，考虑拆分为多个函数或模块');
    }

    const score = this.calculateQualityScore(issues, suggestions);
    const status = this.getQualityStatus(score);

    return {
      score,
      status,
      issues,
      suggestions
    };
  }

  /**
   * 评估性能
   */
  private assessPerformance(code: string): QualityMetric {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (code.includes('for in') && !code.includes('hasOwnProperty')) {
      issues.push('for...in循环应配合hasOwnProperty检查');
    }

    if (code.includes('delete')) {
      suggestions.push('避免使用delete操作符，考虑使用其他方式移除属性');
    }

    const score = this.calculateQualityScore(issues, suggestions);
    const status = this.getQualityStatus(score);

    return {
      score,
      status,
      issues,
      suggestions
    };
  }

  /**
   * 评估可维护性
   */
  private assessMaintainability(code: string): QualityMetric {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (!code.includes('//') && !code.includes('/*')) {
      suggestions.push('考虑添加适当的注释以提高代码可维护性');
    }

    const cyclomaticComplexity = this.calculateCyclomaticComplexity(code);
    if (cyclomaticComplexity > 10) {
      issues.push(`圈复杂度较高(${cyclomaticComplexity})，考虑重构为多个函数`);
    }

    const score = this.calculateQualityScore(issues, suggestions);
    const status = this.getQualityStatus(score);

    return {
      score,
      status,
      issues,
      suggestions
    };
  }

  /**
   * 评估安全性
   */
  private assessSecurity(code: string): QualityMetric {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (code.includes('eval(') || code.includes('Function(')) {
      issues.push('避免使用eval或Function构造函数，存在安全风险');
    }

    if (code.includes('innerHTML =')) {
      issues.push('直接赋值innerHTML存在XSS风险，考虑使用textContent或安全的DOM操作方法');
    }

    const score = this.calculateQualityScore(issues, suggestions);
    const status = this.getQualityStatus(score);

    return {
      score,
      status,
      issues,
      suggestions
    };
  }

  /**
   * 评估可读性
   */
  private assessReadability(code: string): QualityMetric {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // 检查缩进
    const lines = code.split('\n');
    const indentationIssues = this.checkIndentation(lines);
    if (indentationIssues > 0) {
      issues.push(`存在${indentationIssues}行缩进问题`);
    }

    // 检查行长
    const longLines = lines.filter(line => line.length > 120).length;
    if (longLines > 0) {
      suggestions.push(`存在${longLines}行代码超过120字符，考虑换行以提高可读性`);
    }

    const score = this.calculateQualityScore(issues, suggestions);
    const status = this.getQualityStatus(score);

    return {
      score,
      status,
      issues,
      suggestions
    };
  }

  /**
   * 检查缩进
   */
  private checkIndentation(lines: string[]): number {
    let indentationIssues = 0;
    const expectedIndentation = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine === '') continue;

      // 简单的缩进检查，实际实现需要更复杂的逻辑
      const actualIndentation = line.length - trimmedLine.length;
      if (actualIndentation % 2 !== 0) {
        indentationIssues++;
      }
    }

    return indentationIssues;
  }

  /**
   * 计算质量分数
   */
  private calculateQualityScore(issues: string[], suggestions: string[]): number {
    // 初始分数100分
    let score = 100;

    // 每个问题扣10分
    score -= issues.length * 10;

    // 每个建议扣5分
    score -= suggestions.length * 5;

    // 确保分数在0-100之间
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 获取质量状态
   */
  private getQualityStatus(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score >= 90) {
      return 'excellent';
    } else if (score >= 70) {
      return 'good';
    } else if (score >= 50) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  /**
   * 生成风险评估
   */
  private generateRiskAssessment(fixInfo: FixInfo, fixAnalysis: any): RiskAssessment {
    const riskFactors = this.identifyRiskFactors(fixInfo, fixAnalysis);
    const overallRisk = this.calculateOverallRisk(riskFactors);
    const mitigationSuggestions = this.generateMitigationSuggestions(riskFactors);

    return {
      overallRisk,
      riskFactors,
      mitigationSuggestions
    };
  }

  /**
   * 识别风险因素
   */
  private identifyRiskFactors(fixInfo: FixInfo, fixAnalysis: any): RiskFactor[] {
    const riskFactors: RiskFactor[] = [];

    // 检查修复复杂度
    const fixComplexity = this.calculateFixComplexity(fixInfo.newCode);
    if (fixComplexity === 'high') {
      riskFactors.push({
        id: `risk_${Date.now()}_complexity`,
        type: 'maintenance',
        description: '修复复杂度高，可能引入新的问题',
        severity: 'medium',
        likelihood: 'medium',
        impact: 'high'
      });
    }

    // 检查是否有破坏性变更
    const hasBreakingChanges = this.checkBreakingChanges(fixInfo.oldCode, fixInfo.newCode);
    if (hasBreakingChanges) {
      riskFactors.push({
        id: `risk_${Date.now()}_breaking`,
        type: 'breaking-change',
        description: '修复包含破坏性变更，可能影响现有功能',
        severity: 'high',
        likelihood: 'high',
        impact: 'high'
      });
    }

    // 检查安全性风险
    const securityScore = this.assessSecurity(fixInfo.newCode).score;
    if (securityScore < 70) {
      riskFactors.push({
        id: `risk_${Date.now()}_security`,
        type: 'security',
        description: '修复后的代码存在安全风险',
        severity: 'high',
        likelihood: 'medium',
        impact: 'high'
      });
    }

    // 检查性能风险
    const performanceScore = this.assessPerformance(fixInfo.newCode).score;
    if (performanceScore < 70) {
      riskFactors.push({
        id: `risk_${Date.now()}_performance`,
        type: 'performance',
        description: '修复后的代码可能存在性能问题',
        severity: 'medium',
        likelihood: 'medium',
        impact: 'medium'
      });
    }

    return riskFactors;
  }

  /**
   * 计算总体风险
   */
  private calculateOverallRisk(riskFactors: RiskFactor[]): 'low' | 'medium' | 'high' {
    if (riskFactors.length === 0) {
      return 'low';
    }

    // 计算风险分数
    const riskScore = riskFactors.reduce((score, factor) => {
      let severityScore = 0;
      let likelihoodScore = 0;
      let impactScore = 0;

      //  severity分数
      switch (factor.severity) {
        case 'low': severityScore = 1;
        case 'medium': severityScore = 2;
        case 'high': severityScore = 3;
      }

      //  likelihood分数
      switch (factor.likelihood) {
        case 'low': likelihoodScore = 1;
        case 'medium': likelihoodScore = 2;
        case 'high': likelihoodScore = 3;
      }

      //  impact分数
      switch (factor.impact) {
        case 'low': impactScore = 1;
        case 'medium': impactScore = 2;
        case 'high': impactScore = 3;
      }

      return score + (severityScore * likelihoodScore * impactScore);
    }, 0);

    // 根据风险分数确定总体风险
    if (riskScore >= 18) {
      return 'high';
    } else if (riskScore >= 9) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * 生成缓解建议
   */
  private generateMitigationSuggestions(riskFactors: RiskFactor[]): string[] {
    const suggestions: string[] = [];

    for (const riskFactor of riskFactors) {
      switch (riskFactor.type) {
        case 'breaking-change':
          suggestions.push('考虑添加向后兼容层，或在主要版本更新中包含此变更');
          break;
        case 'performance':
          suggestions.push('进行性能测试，确保修复不会引入性能问题');
          break;
        case 'security':
          suggestions.push('进行安全审查，修复发现的安全问题');
          break;
        case 'compatibility':
          suggestions.push('测试修复在不同浏览器和环境中的兼容性');
          break;
        case 'maintenance':
          suggestions.push('添加详细注释，考虑将复杂代码拆分为更小的函数');
          break;
      }
    }

    // 添加通用建议
    suggestions.push('添加单元测试以验证修复的正确性');
    suggestions.push('进行集成测试以确保修复不会破坏现有功能');
    suggestions.push('考虑进行代码审查以获取更多反馈');

    return suggestions;
  }

  /**
   * 检查代码质量
   */
  private checkCodeQuality(fixInfo: FixInfo, fixAnalysis: any): ReviewComment[] {
    const comments: ReviewComment[] = [];

    // 检查变量命名
    const variableNamingIssues = this.checkVariableNaming(fixInfo.newCode);
    if (variableNamingIssues.length > 0) {
      comments.push(...variableNamingIssues);
    }

    // 检查函数长度
    const functionLengthIssues = this.checkFunctionLength(fixInfo.newCode);
    if (functionLengthIssues.length > 0) {
      comments.push(...functionLengthIssues);
    }

    // 检查代码重复
    const codeDuplicationIssues = this.checkCodeDuplication(fixInfo.newCode);
    if (codeDuplicationIssues.length > 0) {
      comments.push(...codeDuplicationIssues);
    }

    return comments;
  }

  /**
   * 检查性能
   */
  private checkPerformance(fixInfo: FixInfo, fixAnalysis: any): ReviewComment[] {
    return []; // 暂时返回空数组，实际实现需要更复杂的逻辑
  }

  /**
   * 检查安全性
   */
  private checkSecurity(fixInfo: FixInfo, fixAnalysis: any): ReviewComment[] {
    return []; // 暂时返回空数组，实际实现需要更复杂的逻辑
  }

  /**
   * 检查可维护性
   */
  private checkMaintainability(fixInfo: FixInfo, fixAnalysis: any): ReviewComment[] {
    return []; // 暂时返回空数组，实际实现需要更复杂的逻辑
  }

  /**
   * 检查可读性
   */
  private checkReadability(fixInfo: FixInfo, fixAnalysis: any): ReviewComment[] {
    return []; // 暂时返回空数组，实际实现需要更复杂的逻辑
  }

  /**
   * 计算评审分数
   */
  private calculateReviewScore(
    complianceReport: ComplianceReport,
    bestPracticeReport: BestPracticeReport,
    riskAssessment: RiskAssessment,
    comments: ReviewComment[]
  ): number {
    // 计算综合评分
    const score = complianceReport.complianceRate;

    // 根据最佳实践报告调整分数
    const qualityAverage = (bestPracticeReport.codeQuality.score +
      bestPracticeReport.performance.score +
      bestPracticeReport.maintainability.score +
      bestPracticeReport.security.score +
      bestPracticeReport.readability.score) / 5;

    // 根据风险评估调整分数
    let riskFactor = 0;
    if (riskAssessment.overallRisk === 'high') {
      riskFactor = -20;
    } else if (riskAssessment.overallRisk === 'medium') {
      riskFactor = -10;
    } else {
      riskFactor = 5;
    }

    // 根据评论调整分数
    const criticalComments = comments.filter(c => c.severity === 'critical').length;
    const highComments = comments.filter(c => c.severity === 'high').length;
    const commentPenalty = criticalComments * 15 + highComments * 10;

    // 计算最终分数
    const finalScore = Math.round(score * 0.5 + qualityAverage * 0.4 + riskFactor + commentPenalty);

    // 确保分数在0-100之间
    return Math.max(0, Math.min(100, finalScore));
  }

  /**
   * 检查变量命名
   */
  private checkVariableNaming(code: string): ReviewComment[] {
    const comments: ReviewComment[] = [];

    // 简单的变量命名检查，实际实现需要更复杂的逻辑
    const badVariableNames = ['temp', 'tmp', 'var1', 'var2', 'x', 'y', 'z'];

    for (const badName of badVariableNames) {
      if (code.includes(`const ${badName}`) ||
        code.includes(`let ${badName}`) ||
        code.includes(`var ${badName}`)) {
        comments.push({
          id: `comment_${Date.now()}_${badName}`,
          type: 'suggestion',
          severity: 'low',
          content: `变量名 "${badName}" 不够描述性，建议使用更有意义的名称`,
          location: {
            filePath: '',
            line: 0,
            column: 0,
            endLine: 0,
            endColumn: 0
          }
        });
      }
    }

    return comments;
  }

  /**
   * 检查函数长度
   */
  private checkFunctionLength(code: string): ReviewComment[] {
    const comments: ReviewComment[] = [];
    const lines = code.split('\n');

    if (lines.length > 50) {
      comments.push({
        id: `comment_${Date.now()}_function_length`,
        type: 'suggestion',
        severity: 'medium',
        content: '函数长度较长，建议拆分为多个更小的函数以提高可维护性',
        location: {
          filePath: '',
          line: 0,
          column: 0,
          endLine: 0,
          endColumn: 0
        }
      });
    }

    return comments;
  }

  /**
   * 检查代码重复
   */
  private checkCodeDuplication(code: string): ReviewComment[] {
    const comments: ReviewComment[] = [];

    // 简单的代码重复检查，实际实现需要更复杂的逻辑
    const lines = code.split('\n');
    const seenLines = new Set<string>();
    const duplicateLines = new Set<string>();

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine === '' || trimmedLine.startsWith('//')) continue;

      if (seenLines.has(trimmedLine)) {
        duplicateLines.add(trimmedLine);
      } else {
        seenLines.add(trimmedLine);
      }
    }

    if (duplicateLines.size > 3) {
      comments.push({
        id: `comment_${Date.now()}_duplication`,
        type: 'suggestion',
        severity: 'medium',
        content: `发现 ${duplicateLines.size} 行重复代码，建议提取为共享函数或变量`,
        location: {
          filePath: '',
          line: 0,
          column: 0,
          endLine: 0,
          endColumn: 0
        }
      });
    }

    return comments;
  }

  /**
   * 获取源文件
   */
  private getSourceFile(filePath: string): ts.SourceFile | undefined {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return undefined;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      return ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.ES2020,
        true
      );
    } catch (error) {
      console.error(`Failed to get source file ${filePath}:`, error);
      return undefined;
    }
  }
}

// 创建单例实例
export const fixReviewer = new FixReviewer();
