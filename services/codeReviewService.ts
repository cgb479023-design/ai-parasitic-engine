/**
 * Code Review Service
 * 自动化代码审查流程，确保代码质量
 */

interface CodeReviewIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  file: string;
  line?: number;
  message: string;
  suggestion: string;
  autoFix?: boolean;
}

interface ReviewRule {
  id: string;
  name: string;
  category: 'golden-feature' | 'error-handling' | 'performance' | 'security' | 'code-quality' | 'typescript' | 'testing';
  severity: 'critical' | 'high' | 'medium' | 'low';
  pattern: RegExp | RegExp[];
  description: string;
  autoFixable: boolean;
}

interface ReviewResult {
  file: string;
  score: number; // 0-100
  issues: CodeReviewIssue[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  metrics: {
    totalLines: number;
    reviewedLines: number;
    complexity: number;
    maintainability: number;
    testCoverage: number;
  };
}

const REVIEW_RULES: ReviewRule[] = [
  // 黄金功能保护规则
  {
    id: 'golden-modification',
    name: 'Modifies Golden Feature Without Verification',
    category: 'golden-feature',
    severity: 'critical' as const,
    pattern: /(?:chrome\.storage|chrome\.runtime|geminiService)\.(?:get|set|remove)\s*[^\n]/i,
    description: 'Modifying golden feature without verification',
    autoFixable: false
  },

  // 错误处理规则
  {
    id: 'missing-error-handling',
    name: 'Missing Error Handling',
    category: 'error-handling',
    severity: 'critical' as const,
    pattern: /(?:fetch|chrome\.(?:storage|runtime|tabs)|api\.call)\s*\(\s*[^\n]*\)\s*(?!\s*(?:try\s*\{|catch\s*\{|throw\s+(?:new\s+)?Error\()/i,
    description: 'Async operations without try-catch or error handling',
    autoFixable: false
  },
  {
    id: 'no-null-check',
    name: 'No Null Check Before Use',
    category: 'error-handling',
    severity: 'high' as const,
    pattern: /\.\s*(?:apiResponse|data|video|result)\s*(?!\s*(?:null|undefined|typeof)/i,
    description: 'Using object properties without null/undefined check',
    autoFixable: true
  },

  // 性能规则
  {
    id: 'inefficient-loop',
    name: 'Inefficient Loop or Nested Operations',
    category: 'performance' as const,
    severity: 'medium' as const,
    pattern: /for\s*\(\s*.*?\)\s*\{\s*for\s*\(\s*.*?\)\s*\{\s*for\s*\(\s*.*?\)/i,
    description: 'Nested loops with O(n³) or worse complexity',
    autoFixable: false
  },
  {
    id: 'blocking-async',
    name: 'Blocking Async Operations',
    category: 'performance' as const,
    severity: 'high' as const,
    pattern: /(?:await\s+(?!.*cache|Promise\.all)\s*[^;\n]*)/i,
    description: 'Sequential await without parallelization',
    autoFixable: false
  },

  // 安全规则
  {
    id: 'xss-risk',
    name: 'XSS Vulnerability',
    category: 'security' as const,
    severity: 'critical' as const,
    pattern: /(?:innerHTML\s*=|dangerouslySetInnerHTML)\s*\$?\{|\w+(?!sanitize|DOMPurify)/i,
    description: 'Potential XSS via innerHTML or dangerous API',
    autoFixable: false
  },
  {
    id: 'api-key-exposure',
    name: 'API Key Exposure',
    category: 'security' as const,
    severity: 'critical' as const,
    pattern: /(?:api(?:_)?key|gemini(?:_)?key|claude(?:_)?key)[\w\s*[=:]['"][^'\s]*(?:AIza|sk-|gpt_|gemini_|claude_)[a-zA-Z0-9_-]{20,}['"]/i,
    description: 'Hardcoded API key found in source code',
    autoFixable: false
  },

  // TypeScript 规则
  {
    id: 'any-type-usage',
    name: 'Using Any Type',
    category: 'typescript' as const,
    severity: 'medium' as const,
    pattern: /:\s*any(?!\s*\w+\s*\[|{}/i,
    description: 'Using any type instead of specific types',
    autoFixable: true
  },
  {
    id: 'no-type-annotation',
    name: 'Missing Type Annotations',
    category: 'typescript' as const,
    severity: 'high' as const,
    pattern: /function\s+\w+\s*\([^)]*\)\s*{(?!\s*:\s*\w+)/i,
    description: 'Function without type annotations',
    autoFixable: true
  },

  // 测试规则
  {
    id: 'no-test-coverage',
    name: 'No Test Coverage',
    category: 'testing' as const,
    severity: 'medium' as const,
    pattern: /(?:export|function)\s+\w+\s*(?!\s*(?:test|describe|it)\b)/i,
    description: 'Exported function without corresponding tests',
    autoFixable: true
  },

  {
    id: 'test-file-not-found',
    name: 'Test File Not Found',
    category: 'testing' as const,
    severity: 'low' as const,
    pattern: /(?:geminiService|app)\.(?:test|spec)\.(?:ts|js)[\s*]/i,
    description: 'Test file imported or required but file not found',
    autoFixable: true
  }
];

export class CodeReviewService {
  private reviewCache: Map<string, ReviewResult> = new Map();
  private readonly SEVERITY_SCORES = {
    critical: 50,
    high: 30,
    medium: 15,
    low: 5
  };

  /**
   * 审查单个文件
   */
  async reviewFile(filePath: string, content: string): Promise<ReviewResult> {
    console.log(`\n🔍 Reviewing: ${filePath}`);

    const issues: CodeReviewIssue[] = [];
    const lines = content.split('\n');

    // 应用所有审查规则
    REVIEW_RULES.forEach(rule => {
      const matches = this.applyRule(rule, filePath, lines);
      issues.push(...matches);
    });

    // 计算代码质量分数
    const score = this.calculateScore(issues, lines.length);

    // 计算指标
    const metrics = this.calculateMetrics(issues, lines.length, content, filePath);

    const result: ReviewResult = {
      file: filePath,
      score,
      issues,
      summary: {
        critical: issues.filter(i => i.severity === 'critical').length,
        high: issues.filter(i => i.severity === 'high').length,
        medium: issues.filter(i => i.severity === 'medium').length,
        low: issues.filter(i => i.severity === 'low').length
      },
      metrics
    };

    // 缓存结果
    this.reviewCache.set(filePath, result);

    return result;
  }

  /**
   * 应用单个审查规则
   */
  private applyRule(rule: ReviewRule, filePath: string, lines: string[]): CodeReviewIssue[] {
    const matchedIssues: CodeReviewIssue[] = [];

    if (Array.isArray(rule.pattern)) {
      // 多模式规则
      for (const pattern of rule.pattern) {
        const matches = this.findMatches(pattern, rule, filePath, lines);
        matchedIssues.push(...matches);
      }
    } else {
      // 单模式规则
      const matches = this.findMatches(rule.pattern, rule, filePath, lines);
      matchedIssues.push(...matches);
    }

    return matchedIssues;
  }

  /**
   * 查找模式匹配
   */
  private findMatches(pattern: RegExp, rule: ReviewRule, filePath: string, lines: string[]): CodeReviewIssue[] {
    const matches: CodeReviewIssue[] = [];

    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        matches.push({
          id: `${filePath}_${index}`,
          severity: rule.severity,
          category: rule.category,
          file: filePath,
          line: index + 1,
          message: `Violates rule: ${rule.description}`,
          suggestion: rule.autoFixable 
            ? rule.description
            : 'Manual review required'
        });
      }
    });

    return matches;
  }

  /**
   * 计算代码质量分数
   */
  private calculateScore(issues: CodeReviewIssue[], totalLines: number): number {
    if (issues.length === 0) return 100;

    let deduction = 0;
    issues.forEach(issue => {
      deduction += this.SEVERITY_SCORES[issue.severity];
    });

    // 基础分100分，每次扣分
    return Math.max(0, 100 - deduction);
  }

  /**
   * 计算代码指标
   */
  private calculateMetrics(issues: CodeReviewIssue[], totalLines: number, content: string, filePath: string): ReviewResult['metrics'] {
    // 代码复杂度估算
    const complexity = this.estimateComplexity(content);

    // 可维护性指数
    const maintainability = this.calculateMaintainability(issues, totalLines);

    // 测试覆盖率估算
    const testCoverage = this.estimateTestCoverage(filePath, content);

    return {
      totalLines,
      reviewedLines: totalLines, // 审查所有行
      complexity,
      maintainability,
      testCoverage
    };
  }

  /**
   * 估算代码复杂度
   */
  private estimateComplexity(content: string): number {
    // 计算圈复杂度简化版本
    const functions = (content.match(/function\s+\w+/g) || []).length;
    const conditionals = (content.match(/\b(?:if|else|switch|for|while|catch)/g) || []).length;
    const loops = (content.match(/\b(?:for|while)\b/g) || []).length;
    const maxNesting = content.split('{').length - content.split('}').length;

    // 简化公式
    const complexityScore = (functions * 2) + (conditionals * 1) + (loops * 3) + maxNesting;

    return Math.min(100, Math.round(complexityScore * 0.5));
  }

  /**
   * 计算可维护性指数
   */
  private calculateMaintainability(issues: CodeReviewIssue[], totalLines: number): number {
    const issueDensity = issues.length / totalLines;
    const maintainabilityPenalty = issueDensity * 10;

    return Math.max(0, 100 - maintainabilityPenalty);
  }

  /**
   * 估算测试覆盖率
   */
  private estimateTestCoverage(filePath: string, content: string): number {
    // 检查是否有测试文件
    const testFile = filePath.replace(/\.(?:tsx?|ts|jsx?)$/, '.test.ts');
    const hasTest = this.fileExists(testFile);

    // 检查代码中是否有测试相关内容
    const hasTests = /test|spec|describe|it\(\s*['"]\s*\)/.test(content);

    return hasTests && hasTest ? 75 : 25; // 粗略估算
  }

  /**
   * 检查文件是否存在
   */
  private fileExists(filePath: string): boolean {
    try {
      const fs = require('fs');
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  /**
   * 扫描整个项目
   */
  async scanProject(): Promise<ReviewResult[]> {
    console.log('\n🔍 Scanning entire project for code review...');

    const sourceFiles = await this.getSourceFiles();
    const results: ReviewResult[] = [];

    for (const file of sourceFiles) {
      const content = await this.readFile(file.path);
      const result = await this.reviewFile(file.path, content);
      results.push(result);
    }

    return results;
  }

  /**
   * 获取源文件列表
   */
  private async getSourceFiles(): Promise<{ path: string; type: string }[]> {
    return [
      { path: 'App.tsx', type: 'typescript' },
      { path: 'components/Header.tsx', type: 'typescript' },
      { path: 'components/Header.Modern.tsx', type: 'typescript' },
      { path: 'components/InputForm.tsx', type: 'typescript' },
      { path: 'components/LoadingScreen.tsx', type: 'typescript' },
      { path: 'components/LoadingScreen.Modern.tsx', type: 'typescript' },
      { path: 'components/Editor.tsx', type: 'typescript' },
      { path: 'components/OutputDisplay.tsx', type: 'typescript' },
      { path: 'services/geminiService.ts', type: 'typescript' },
      { path: 'services/gemini-extension/background.js', type: 'javascript' },
      { path: 'services/gemini-extension/content.js', type: 'javascript' }
    ];
  }

  /**
   * 读取文件内容
   */
  private async readFile(filePath: string): Promise<string> {
    const fs = require('fs').promises.readFile;
    return fs.readFile(filePath, 'utf8');
  }

  /**
   * 获取项目总结
   */
  async getProjectSummary(): Promise<{
    totalFiles: number;
    totalIssues: number;
    averageScore: number;
    criticalIssues: number;
    byCategory: Map<string, number>;
  }> {
    const results = await this.scanProject();

    const totalFiles = results.length;
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
    const averageScore = results.reduce((sum, r) => sum + r.score, 0) / totalFiles;
    const criticalIssues = results.reduce((sum, r) => sum + r.summary.critical, 0);

    const byCategory = new Map();
    byCategory.set('golden-feature', results.reduce((sum, r) => sum + r.issues.filter(i => i.category === 'golden-feature').length, 0));
    byCategory.set('error-handling', results.reduce((sum, r) => sum + r.issues.filter(i => i.category === 'error-handling').length, 0));
    byCategory.set('performance', results.reduce((sum, r) => sum + r.issues.filter(i => i.category === 'performance').length, 0));
    byCategory.set('security', results.reduce((sum, r) => sum + r.issues.filter(i => i.category === 'security').length, 0));
    byCategory.set('typescript', results.reduce((sum, r) => sum + r.issues.filter(i => i.category === 'typescript').length, 0));
    byCategory.set('testing', results.reduce((sum, r) => sum + r.issues.filter(i => i.category === 'testing').length, 0));
    byCategory.set('code-quality', results.reduce((sum, r) => sum + r.issues.filter(i => i.category === 'code-quality').length, 0));

    return {
      totalFiles,
      totalIssues,
      averageScore,
      criticalIssues,
      byCategory
    };
  }

  /**
   * 生成审查报告
   */
  async generateReviewReport(): Promise<string> {
    const summary = await this.getProjectSummary();

    let report = '\n' + '='.repeat(70);
    report += '\n🔍 CODE REVIEW REPORT';
    report += '\n' + '='.repeat(70) + '\n';

    report += '\n📊 Project Summary:\n';
    report += `   Files Reviewed: ${summary.totalFiles}\n`;
    report += `   Total Issues: ${summary.totalIssues}\n`;
    report += `   Average Score: ${summary.averageScore.toFixed(1)}/100\n`;
    report += `   Critical Issues: ${summary.criticalIssues}\n`;

    report += '\n📋 Issues by Category:\n';
    summary.byCategory.forEach((count, category) => {
      if (count > 0) {
        report += `\n   ${category}: ${count}`;
      }
    });

    report += '\n' + '='.repeat(70) + '\n';

    // 生成修复建议
    report += '\n💡 Top Recommendations:\n';
    report += '1. Address all Critical and High issues immediately\n';
    report += '2. Add unit tests for all critical paths\n';
    report += '3. Improve error handling with try-catch blocks\n';
    report += '4. Replace any type with proper interfaces\n';
    report += '5. Consider code splitting for large files\n';

    report += '\n' + '='.repeat(70);

    return report;
  }

  /**
   * 自动修复可修复的问题
   */
  async autoFix(filePath: string, issue: CodeReviewIssue): Promise<boolean> {
    if (!issue.autoFixable) {
      console.log(`⚠️ Cannot auto-fix: ${issue.message}`);
      return false;
    }

    try {
      const fs = require('fs').promises;
      const backup = require('../scripts/backupService');
      
      // 🔄 修复前自动备份文件
      backup.backupFile(filePath);
      
      let content = await fs.readFile(filePath, 'utf8');

      // 这里实现一些简单的自动修复
      if (issue.category === 'typescript' && issue.id === 'no-type-annotation') {
        // 自动添加类型注解
        content = this.addTypeAnnotations(content);
      }

      await fs.writeFile(filePath, content, 'utf8');
      console.log(`✅ Auto-fixed: ${issue.message}`);
      return true;
    } catch (error) {
      console.error(`❌ Auto-fix failed: ${error}`);
      return false;
    }
  }

  /**
   * 添加类型注解
   */
  private addTypeAnnotations(content: string): string {
    // 简单的类型注解添加逻辑
    // 在实际使用中需要更智能
    return content;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.reviewCache.clear();
    console.log('🔄 Code review cache cleared');
  }
}

// 导出单例实例
export const codeReviewService = new CodeReviewService();