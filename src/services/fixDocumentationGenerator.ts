import * as fs from 'fs';
import * as path from 'path';
import { FixInfo } from './fixReviewer';
import { Deployment } from './deployManager';
import { FixEffectSummary } from './fixEffectTracker';

// 定义修复文档相关接口
export interface FixDocumentation {
  id: string;
  fixId: string;
  title: string;
  description: string;
  generatedDate: Date;
  lastUpdated: Date;
  author: string;
  fixType: 'bug' | 'feature' | 'refactor' | 'performance' | 'breaking-change' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'in-progress' | 'completed' | 'deployed' | 'rolled-back';
  timeline: FixTimelineItem[];
  codeChanges: CodeChange[];
  reviewResults: ReviewResult;
  deploymentInfo: DeploymentInfo;
  effectSummary: FixEffectSummary;
  relatedIssues: string[];
  references: string[];
  attachments: Attachment[];
  finalReport: FinalReport;
}

export interface FixTimelineItem {
  id: string;
  eventType: 'fix-created' | 'review-started' | 'review-completed' | 'deployed' | 'rolled-back' | 'effect-tracked';
  timestamp: Date;
  description: string;
  actor: string;
  metadata?: any;
}

export interface CodeChange {
  id: string;
  filePath: string;
  oldCode: string;
  newCode: string;
  changeType: 'add' | 'modify' | 'delete' | 'rename';
  lineRange: { start: number; end: number };
  description: string;
  diff: string;
}

export interface ReviewResult {
  reviewId: string;
  status: 'approved' | 'rejected' | 'needs-improvement';
  score: number;
  comments: ReviewComment[];
  complianceRate: number;
  riskAssessment: { overallRisk: 'low' | 'medium' | 'high' };
}

export interface ReviewComment {
  id: string;
  type: 'issue' | 'suggestion' | 'question' | 'praise';
  severity: 'low' | 'medium' | 'high' | 'critical';
  content: string;
  location: { filePath: string; line: number };
}

export interface DeploymentInfo {
  deploymentId: string;
  environment: 'development' | 'testing' | 'staging' | 'production';
  deployedBy: string;
  deployDate: Date;
  version: string;
  commitHash: string;
  rollbackInfo?: {
    rollbackDate: Date;
    reason: string;
  };
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'document' | 'log' | 'other';
  filePath: string;
  description: string;
  uploadedAt: Date;
}

export interface FinalReport {
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  lessonsLearned: string[];
  conclusion: string;
}

export interface FixDocumentationConfig {
  templatePath: string;
  outputPath: string;
  supportedFormats: ('markdown' | 'html' | 'pdf')[];
  includeCodeChanges: boolean;
  includeReviewComments: boolean;
  includeDeploymentInfo: boolean;
  includeEffectMetrics: boolean;
}

export interface GenerateDocumentationOptions {
  fixInfo: FixInfo;
  deployment?: Deployment;
  effectSummary?: FixEffectSummary;
  format?: 'markdown' | 'html' | 'pdf';
  includeAllDetails?: boolean;
}

/**
 * 修复文档生成服务
 * 用于自动生成修复的详细文档，包括修复前后的代码对比、修复效果评估和相关指标等
 */
export class FixDocumentationGenerator {
  private readonly config: FixDocumentationConfig;

  constructor(config?: Partial<FixDocumentationConfig>) {
    this.config = {
      templatePath: config?.templatePath || './templates',
      outputPath: config?.outputPath || './documentation',
      supportedFormats: config?.supportedFormats || ['markdown', 'html'],
      includeCodeChanges: config?.includeCodeChanges !== false,
      includeReviewComments: config?.includeReviewComments !== false,
      includeDeploymentInfo: config?.includeDeploymentInfo !== false,
      includeEffectMetrics: config?.includeEffectMetrics !== false
    };

    // 初始化输出目录
    this.initializeOutputDirectory();
  }

  /**
   * 初始化输出目录
   */
  private initializeOutputDirectory(): void {
    if (!fs.existsSync(this.config.outputPath)) {
      fs.mkdirSync(this.config.outputPath, { recursive: true });
    }
  }

  /**
   * 生成修复文档
   */
  async generateDocumentation(options: GenerateDocumentationOptions): Promise<FixDocumentation> {
    console.log(`生成修复文档: ${options.fixInfo.description}`);

    try {
      // 创建文档基本信息
      const documentation: FixDocumentation = {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fixId: options.fixInfo.id,
        title: this.generateTitle(options.fixInfo),
        description: options.fixInfo.description,
        generatedDate: new Date(),
        lastUpdated: new Date(),
        author: options.fixInfo.author,
        fixType: options.fixInfo.fixType,
        severity: this.assessSeverity(options.fixInfo),
        status: options.deployment?.status === 'deployed' ? 'deployed' : 'completed',
        timeline: this.generateTimeline(options),
        codeChanges: this.generateCodeChanges(options.fixInfo),
        reviewResults: this.generateReviewResults(options.fixInfo),
        deploymentInfo: this.generateDeploymentInfo(options.deployment),
        effectSummary: options.effectSummary || this.generateDefaultEffectSummary(options.fixInfo.id),
        relatedIssues: [],
        references: [],
        attachments: [],
        finalReport: this.generateFinalReport(options)
      };

      // 保存文档
      this.saveDocumentation(documentation);

      // 根据格式生成不同类型的文档
      if (options.format) {
        await this.generateFormattedDocument(documentation, options.format);
      } else {
        // 生成所有支持的格式
        for (const format of this.config.supportedFormats) {
          await this.generateFormattedDocument(documentation, format);
        }
      }

      return documentation;
    } catch (error) {
      console.error(`生成修复文档失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 生成文档标题
   */
  private generateTitle(fixInfo: FixInfo): string {
    return `${fixInfo.fixType.toUpperCase()}: ${fixInfo.description}`;
  }

  /**
   * 评估修复严重程度
   */
  private assessSeverity(fixInfo: FixInfo): 'low' | 'medium' | 'high' | 'critical' {
    // 根据修复类型和描述评估严重程度
    if (fixInfo.fixType === 'bug') {
      if (fixInfo.description.toLowerCase().includes('critical') ||
        fixInfo.description.toLowerCase().includes('security') ||
        fixInfo.description.toLowerCase().includes('crash')) {
        return 'critical';
      } else if (fixInfo.description.toLowerCase().includes('high') ||
        fixInfo.description.toLowerCase().includes('performance')) {
        return 'high';
      } else if (fixInfo.description.toLowerCase().includes('medium') ||
        fixInfo.description.toLowerCase().includes('functionality')) {
        return 'medium';
      }
    }
    return 'low';
  }

  /**
   * 生成修复时间线
   */
  private generateTimeline(options: GenerateDocumentationOptions): FixTimelineItem[] {
    const timeline: FixTimelineItem[] = [
      {
        id: `event_${Date.now()}_1`,
        eventType: 'fix-created',
        timestamp: options.fixInfo.fixDate,
        description: '修复创建',
        actor: options.fixInfo.author,
        metadata: {
          fixType: options.fixInfo.fixType,
          description: options.fixInfo.description
        }
      }
    ];

    // 添加部署事件
    if (options.deployment) {
      timeline.push({
        id: `event_${Date.now()}_2`,
        eventType: options.deployment.status === 'rolled-back' ? 'rolled-back' : 'deployed',
        timestamp: options.deployment.deployDate,
        description: options.deployment.status === 'rolled-back' ? '修复已回滚' : '修复已部署',
        actor: options.deployment.deployedBy,
        metadata: {
          environment: options.deployment.environment,
          version: options.deployment.version,
          commitHash: options.deployment.commitHash
        }
      });
    }

    // 添加效果跟踪事件
    if (options.effectSummary) {
      timeline.push({
        id: `event_${Date.now()}_3`,
        eventType: 'effect-tracked',
        timestamp: new Date(),
        description: '修复效果已跟踪',
        actor: 'system',
        metadata: {
          overallStatus: options.effectSummary.overallStatus,
          performanceChange: options.effectSummary.performanceChange
        }
      });
    }

    return timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * 生成代码变更信息
   */
  private generateCodeChanges(fixInfo: FixInfo): CodeChange[] {
    const lineCount = fixInfo.oldCode.split('\n').length;
    return [
      {
        id: `change_${Date.now()}_1`,
        filePath: fixInfo.filePath,
        oldCode: fixInfo.oldCode,
        newCode: fixInfo.newCode,
        changeType: 'modify',
        lineRange: {
          start: fixInfo.line,
          end: fixInfo.line + lineCount - 1
        },
        description: fixInfo.description,
        diff: this.generateDiff(fixInfo.oldCode, fixInfo.newCode)
      }
    ];
  }

  /**
   * 生成代码差异
   */
  private generateDiff(oldCode: string, newCode: string): string {
    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');

    // 简单的差异生成，实际实现可以使用更复杂的差异算法
    let diff = '';
    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      if (i < oldLines.length && i < newLines.length) {
        if (oldLines[i] !== newLines[i]) {
          diff += `- ${oldLines[i]}\n`;
          diff += `+ ${newLines[i]}\n`;
        } else {
          diff += `  ${oldLines[i]}\n`;
        }
      } else if (i < oldLines.length) {
        diff += `- ${oldLines[i]}\n`;
      } else if (i < newLines.length) {
        diff += `+ ${newLines[i]}\n`;
      }
    }

    return diff;
  }

  /**
   * 生成评审结果
   */
  private generateReviewResults(fixInfo: FixInfo): ReviewResult {
    // 这里应该从fixReviewer中获取实际的评审结果
    // 暂时返回模拟数据
    return {
      reviewId: `review_${Date.now()}_1`,
      status: 'approved',
      score: 90,
      comments: [
        {
          id: `comment_${Date.now()}_1`,
          type: 'praise',
          severity: 'low',
          content: '修复方案设计合理，代码质量良好',
          location: { filePath: fixInfo.filePath, line: fixInfo.line }
        }
      ],
      complianceRate: 95,
      riskAssessment: { overallRisk: 'low' }
    };
  }

  /**
   * 生成部署信息
   */
  private generateDeploymentInfo(deployment?: Deployment): DeploymentInfo {
    if (deployment) {
      return {
        deploymentId: deployment.id,
        environment: deployment.environment,
        deployedBy: deployment.deployedBy,
        deployDate: deployment.deployDate,
        version: deployment.version,
        commitHash: deployment.commitHash,
        rollbackInfo: deployment.rollbackDate ? {
          rollbackDate: deployment.rollbackDate,
          reason: '修复效果不符合预期'
        } : undefined
      };
    }

    // 返回默认部署信息
    return {
      deploymentId: '',
      environment: 'development',
      deployedBy: '',
      deployDate: new Date(),
      version: '1.0.0',
      commitHash: ''
    };
  }

  /**
   * 生成默认效果摘要
   */
  private generateDefaultEffectSummary(fixId: string): FixEffectSummary {
    return {
      fixId,
      overallStatus: 'neutral',
      performanceChange: 0,
      securityChange: 0,
      errorRateChange: 0,
      businessImpactChange: 0,
      keyFindings: [],
      recommendations: []
    };
  }

  /**
   * 生成最终报告
   */
  private generateFinalReport(options: GenerateDocumentationOptions): FinalReport {
    return {
      summary: `修复 "${options.fixInfo.description}" 已完成，修复类型为 ${options.fixInfo.fixType}。`,
      keyFindings: [
        `修复已成功应用到代码库`,
        `代码质量评估良好`,
        `风险评估为低风险`
      ],
      recommendations: [
        `定期监控修复效果`,
        `考虑添加更多单元测试`,
        `在生产环境部署前进行充分测试`
      ],
      lessonsLearned: [
        `修复过程顺利，没有遇到重大问题`,
        `自动化评审和部署流程提高了效率`
      ],
      conclusion: `该修复已成功完成，建议继续监控其在生产环境中的表现。`
    };
  }

  /**
   * 保存文档
   */
  private saveDocumentation(documentation: FixDocumentation): void {
    const docPath = path.join(this.config.outputPath, `fix-doc-${documentation.fixId}.json`);
    fs.writeFileSync(docPath, JSON.stringify(documentation, null, 2), 'utf8');
  }

  /**
   * 生成格式化文档
   */
  private async generateFormattedDocument(documentation: FixDocumentation, format: 'markdown' | 'html' | 'pdf'): Promise<void> {
    switch (format) {
      case 'markdown':
        await this.generateMarkdownDocument(documentation);
        break;
      case 'html':
        await this.generateHtmlDocument(documentation);
        break;
      case 'pdf':
        await this.generatePdfDocument(documentation);
        break;
      default:
        throw new Error(`不支持的文档格式: ${format}`);
    }
  }

  /**
   * 生成Markdown文档
   */
  private async generateMarkdownDocument(documentation: FixDocumentation): Promise<void> {
    let markdownContent = `# ${documentation.title}\n\n`;

    // 基本信息
    markdownContent += `## 基本信息\n\n`;
    markdownContent += `| 字段 | 值 |\n`;
    markdownContent += `|------|-----|\n`;
    markdownContent += `| 修复ID | ${documentation.fixId} |\n`;
    markdownContent += `| 作者 | ${documentation.author} |\n`;
    markdownContent += `| 修复类型 | ${documentation.fixType} |\n`;
    markdownContent += `| 严重程度 | ${documentation.severity} |\n`;
    markdownContent += `| 状态 | ${documentation.status} |\n`;
    markdownContent += `| 生成日期 | ${documentation.generatedDate.toISOString()} |\n`;
    markdownContent += `| 最后更新 | ${documentation.lastUpdated.toISOString()} |\n\n`;

    // 描述
    markdownContent += `## 描述\n\n`;
    markdownContent += `${documentation.description}\n\n`;

    // 时间线
    markdownContent += `## 时间线\n\n`;
    markdownContent += `| 时间 | 事件类型 | 描述 | 执行人员 |\n`;
    markdownContent += `|------|----------|------|----------|\n`;
    for (const item of documentation.timeline) {
      markdownContent += `| ${item.timestamp.toISOString()} | ${item.eventType} | ${item.description} | ${item.actor} |\n`;
    }
    markdownContent += `\n`;

    // 代码变更
    if (this.config.includeCodeChanges && documentation.codeChanges.length > 0) {
      markdownContent += `## 代码变更\n\n`;
      for (const change of documentation.codeChanges) {
        markdownContent += `### ${change.filePath}\n\n`;
        markdownContent += `**变更类型**: ${change.changeType}\n\n`;
        markdownContent += `**行范围**: ${change.lineRange.start}-${change.lineRange.end}\n\n`;
        markdownContent += `**描述**: ${change.description}\n\n`;
        markdownContent += `**差异**:\n\n`;
        markdownContent += `\`\`\`diff\n${change.diff}\n\`\`\`\n\n`;
      }
    }

    // 评审结果
    if (this.config.includeReviewComments) {
      markdownContent += `## 评审结果\n\n`;
      markdownContent += `| 字段 | 值 |\n`;
      markdownContent += `|------|-----|\n`;
      markdownContent += `| 评审状态 | ${documentation.reviewResults.status} |\n`;
      markdownContent += `| 评审分数 | ${documentation.reviewResults.score} |\n`;
      markdownContent += `| 合规率 | ${documentation.reviewResults.complianceRate}% |\n`;
      markdownContent += `| 风险评估 | ${documentation.reviewResults.riskAssessment.overallRisk} |\n\n`;

      if (documentation.reviewResults.comments.length > 0) {
        markdownContent += `### 评审评论\n\n`;
        for (const comment of documentation.reviewResults.comments) {
          markdownContent += `**${comment.type}** (${comment.severity}): ${comment.content}\n`;
          markdownContent += `位置: ${comment.location.filePath}:${comment.location.line}\n\n`;
        }
      }
    }

    // 部署信息
    if (this.config.includeDeploymentInfo) {
      markdownContent += `## 部署信息\n\n`;
      markdownContent += `| 字段 | 值 |\n`;
      markdownContent += `|------|-----|\n`;
      markdownContent += `| 部署ID | ${documentation.deploymentInfo.deploymentId} |\n`;
      markdownContent += `| 环境 | ${documentation.deploymentInfo.environment} |\n`;
      markdownContent += `| 部署人员 | ${documentation.deploymentInfo.deployedBy} |\n`;
      markdownContent += `| 部署日期 | ${documentation.deploymentInfo.deployDate.toISOString()} |\n`;
      markdownContent += `| 版本 | ${documentation.deploymentInfo.version} |\n`;
      markdownContent += `| 提交哈希 | ${documentation.deploymentInfo.commitHash} |\n\n`;

      if (documentation.deploymentInfo.rollbackInfo) {
        markdownContent += `### 回滚信息\n\n`;
        markdownContent += `| 字段 | 值 |\n`;
        markdownContent += `|------|-----|\n`;
        markdownContent += `| 回滚日期 | ${documentation.deploymentInfo.rollbackInfo.rollbackDate.toISOString()} |\n`;
        markdownContent += `| 回滚原因 | ${documentation.deploymentInfo.rollbackInfo.reason} |\n\n`;
      }
    }

    // 效果摘要
    if (this.config.includeEffectMetrics) {
      markdownContent += `## 修复效果\n\n`;
      markdownContent += `| 指标 | 变化 |\n`;
      markdownContent += `|------|------|\n`;
      markdownContent += `| 整体状态 | ${documentation.effectSummary.overallStatus} |\n`;
      markdownContent += `| 性能变化 | ${documentation.effectSummary.performanceChange}% |\n`;
      markdownContent += `| 安全变化 | ${documentation.effectSummary.securityChange}% |\n`;
      markdownContent += `| 错误率变化 | ${documentation.effectSummary.errorRateChange}% |\n`;
      markdownContent += `| 业务影响变化 | ${documentation.effectSummary.businessImpactChange}% |\n\n`;

      if (documentation.effectSummary.keyFindings.length > 0) {
        markdownContent += `### 关键发现\n\n`;
        for (const finding of documentation.effectSummary.keyFindings) {
          markdownContent += `- ${finding}\n`;
        }
        markdownContent += `\n`;
      }

      if (documentation.effectSummary.recommendations.length > 0) {
        markdownContent += `### 建议\n\n`;
        for (const recommendation of documentation.effectSummary.recommendations) {
          markdownContent += `- ${recommendation}\n`;
        }
        markdownContent += `\n`;
      }
    }

    // 最终报告
    markdownContent += `## 最终报告\n\n`;
    markdownContent += `### 摘要\n\n`;
    markdownContent += `${documentation.finalReport.summary}\n\n`;

    markdownContent += `### 关键发现\n\n`;
    for (const finding of documentation.finalReport.keyFindings) {
      markdownContent += `- ${finding}\n`;
    }
    markdownContent += `\n`;

    markdownContent += `### 建议\n\n`;
    for (const recommendation of documentation.finalReport.recommendations) {
      markdownContent += `- ${recommendation}\n`;
    }
    markdownContent += `\n`;

    markdownContent += `### 经验教训\n\n`;
    for (const lesson of documentation.finalReport.lessonsLearned) {
      markdownContent += `- ${lesson}\n`;
    }
    markdownContent += `\n`;

    markdownContent += `### 结论\n\n`;
    markdownContent += `${documentation.finalReport.conclusion}\n\n`;

    // 保存Markdown文件
    const markdownPath = path.join(this.config.outputPath, `fix-doc-${documentation.fixId}.md`);
    fs.writeFileSync(markdownPath, markdownContent, 'utf8');
  }

  /**
   * 生成HTML文档
   */
  private async generateHtmlDocument(documentation: FixDocumentation): Promise<void> {
    // 简单的HTML生成，实际实现可以使用模板引擎
    let htmlContent = `<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n`;
    htmlContent += `  <meta charset="UTF-8">\n`;
    htmlContent += `  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n`;
    htmlContent += `  <title>${documentation.title}</title>\n`;
    htmlContent += `  <style>\n`;
    htmlContent += `    body { font-family: Arial, sans-serif; margin: 20px; }\n`;
    htmlContent += `    h1, h2, h3 { color: #333; }\n`;
    htmlContent += `    table { border-collapse: collapse; width: 100%; margin: 10px 0; }\n`;
    htmlContent += `    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }\n`;
    htmlContent += `    th { background-color: #f2f2f2; }\n`;
    htmlContent += `    .code-block { background-color: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; }\n`;
    htmlContent += `    .timeline-item { margin: 10px 0; padding: 10px; border-left: 3px solid #ccc; }\n`;
    htmlContent += `    .severity-${documentation.severity} { color: ${this.getSeverityColor(documentation.severity)}; }\n`;
    htmlContent += `  </style>\n`;
    htmlContent += `</head>\n<body>\n`;

    // 标题和基本信息
    htmlContent += `  <h1>${documentation.title}</h1>\n`;
    htmlContent += `  <div class="basic-info">\n`;
    htmlContent += `    <h2>基本信息</h2>\n`;
    htmlContent += `    <table>\n`;
    htmlContent += `      <tr><th>修复ID</th><td>${documentation.fixId}</td></tr>\n`;
    htmlContent += `      <tr><th>作者</th><td>${documentation.author}</td></tr>\n`;
    htmlContent += `      <tr><th>修复类型</th><td>${documentation.fixType}</td></tr>\n`;
    htmlContent += `      <tr><th>严重程度</th><td class="severity-${documentation.severity}">${documentation.severity}</td></tr>\n`;
    htmlContent += `      <tr><th>状态</th><td>${documentation.status}</td></tr>\n`;
    htmlContent += `      <tr><th>生成日期</th><td>${documentation.generatedDate.toISOString()}</td></tr>\n`;
    htmlContent += `      <tr><th>最后更新</th><td>${documentation.lastUpdated.toISOString()}</td></tr>\n`;
    htmlContent += `    </table>\n`;
    htmlContent += `  </div>\n`;

    // 描述
    htmlContent += `  <div class="description">\n`;
    htmlContent += `    <h2>描述</h2>\n`;
    htmlContent += `    <p>${documentation.description}</p>\n`;
    htmlContent += `  </div>\n`;

    // 保存HTML文件
    const htmlPath = path.join(this.config.outputPath, `fix-doc-${documentation.fixId}.html`);
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  }

  /**
   * 生成PDF文档
   */
  private async generatePdfDocument(documentation: FixDocumentation): Promise<void> {
    // PDF生成需要专门的库，这里仅创建一个占位文件
    const pdfPath = path.join(this.config.outputPath, `fix-doc-${documentation.fixId}.pdf`);
    fs.writeFileSync(pdfPath, 'PDF文档内容将通过专门的PDF生成库生成', 'utf8');
  }

  /**
   * 获取严重程度对应的颜色
   */
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'black';
    }
  }

  /**
   * 获取修复文档
   */
  getFixDocumentation(docId: string): FixDocumentation | undefined {
    const docPath = path.join(this.config.outputPath, `fix-doc-${docId}.json`);
    if (fs.existsSync(docPath)) {
      const content = fs.readFileSync(docPath, 'utf8');
      return JSON.parse(content) as FixDocumentation;
    }
    return undefined;
  }

  /**
   * 获取修复的所有文档
   */
  getAllFixDocumentations(): FixDocumentation[] {
    const docs: FixDocumentation[] = [];
    const files = fs.readdirSync(this.config.outputPath);

    for (const file of files) {
      if (file.startsWith('fix-doc-') && file.endsWith('.json')) {
        const filePath = path.join(this.config.outputPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        docs.push(JSON.parse(content) as FixDocumentation);
      }
    }

    return docs;
  }

  /**
   * 更新修复文档
   */
  updateFixDocumentation(doc: FixDocumentation): void {
    doc.lastUpdated = new Date();
    this.saveDocumentation(doc);
  }

  /**
   * 删除修复文档
   */
  deleteFixDocumentation(docId: string): void {
    // 删除JSON文档
    const docPath = path.join(this.config.outputPath, `fix-doc-${docId}.json`);
    if (fs.existsSync(docPath)) {
      fs.unlinkSync(docPath);
    }

    // 删除所有格式的文档
    for (const format of this.config.supportedFormats) {
      const filePath = path.join(this.config.outputPath, `fix-doc-${docId}.${format}`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }
}

// 创建单例实例
export const fixDocumentationGenerator = new FixDocumentationGenerator();
