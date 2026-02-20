import * as fs from 'fs';
import * as path from 'path';
import { FixInfo } from './fixReviewer';
import { DependencyGraph } from './dependencyAnalysisService';
import { FixEffectSummary } from './fixEffectTracker';

// 定义修复可视化相关接口
export interface FixVisualization {
  id: string;
  fixId: string;
  visualizationType: 'dependency-graph' | 'risk-assessment' | 'timeline' | 'comparison';
  title: string;
  data: VisualizationData;
  createdAt: Date;
  updatedAt: Date;
}

export interface VisualizationData {
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  metrics: VisualizationMetrics;
  riskAssessment?: RiskVisualization;
  timeline?: TimelineEvent[];
  comparison?: FixComparison;
}

export interface VisualizationNode {
  id: string;
  name: string;
  type: 'file' | 'function' | 'class' | 'interface' | 'variable' | 'fix' | 'risk';
  status: 'original' | 'modified' | 'added' | 'removed' | 'affected';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: any;
  x?: number;
  y?: number;
}

export interface VisualizationEdge {
  id: string;
  source: string;
  target: string;
  type: 'dependency' | 'call' | 'inheritance' | 'implementation' | 'risk-factor' | 'timeline';
  strength: number;
  color?: string;
  metadata?: any;
}

export interface VisualizationMetrics {
  totalNodes: number;
  affectedNodes: number;
  criticalNodes: number;
  totalEdges: number;
  affectedEdges: number;
  riskScore: number;
  complexityScore: number;
  confidenceScore: number;
}

export interface RiskVisualization {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactorVisualization[];
  mitigationSuggestions: string[];
  riskScore: number;
}

export interface RiskFactorVisualization {
  id: string;
  type: 'breaking-change' | 'performance' | 'security' | 'compatibility' | 'maintenance';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  color: string;
}

export interface TimelineEvent {
  id: string;
  eventType: 'fix-created' | 'review-started' | 'review-completed' | 'deployed' | 'rolled-back' | 'effect-tracked';
  timestamp: Date;
  description: string;
  actor: string;
  metadata?: any;
}

export interface FixComparison {
  oldCode: string;
  newCode: string;
  diff: string;
  changes: CodeChange[];
  lineRange: { start: number; end: number };
}

export interface CodeChange {
  type: 'add' | 'modify' | 'delete' | 'rename';
  line: number;
  content: string;
}

export interface FixVisualizationConfig {
  outputPath: string;
  defaultVisualizationType: VisualizationData['nodes'][0]['type'];
  enableInteractiveVisualization: boolean;
  enableExport: boolean;
}

/**
 * 修复方案可视化服务
 * 用于可视化展示修复方案、依赖关系和风险评估
 */
export class FixVisualizationService {
  private readonly config: FixVisualizationConfig;
  private visualizations: Map<string, FixVisualization> = new Map();

  constructor(config?: Partial<FixVisualizationConfig>) {
    this.config = {
      outputPath: config?.outputPath || './visualizations',
      defaultVisualizationType: config?.defaultVisualizationType || 'file',
      enableInteractiveVisualization: config?.enableInteractiveVisualization !== false,
      enableExport: config?.enableExport !== false
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
   * 生成修复方案可视化
   */
  generateFixVisualization(
    fixInfo: FixInfo,
    dependencyGraph: DependencyGraph,
    riskAssessment: any,
    effectSummary?: FixEffectSummary
  ): FixVisualization {
    const visualizationId = `vis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 生成依赖图可视化数据
    const nodes: VisualizationNode[] = [];
    const edges: VisualizationEdge[] = [];
    
    // 添加文件节点
    for (const node of dependencyGraph.nodes) {
      nodes.push({
        id: node.id,
        name: node.name,
        type: node.type as any,
        status: node.filePath === fixInfo.filePath ? 'modified' : 'original',
        metadata: {
          filePath: node.filePath,
          line: node.line,
          column: node.column,
          sourceCode: node.sourceCode
        }
      });
    }
    
    // 添加边
    for (const edge of dependencyGraph.edges) {
      edges.push({
        id: `${edge.from}->${edge.to}->${edge.type}`,
        source: edge.from,
        target: edge.to,
        type: edge.type as any,
        strength: 1.0,
        color: this.getEdgeColor(edge.type)
      });
    }
    
    // 生成风险可视化
    const riskVisualization: RiskVisualization = {
      overallRisk: riskAssessment.overallRisk,
      riskFactors: riskAssessment.riskFactors.map((factor: any) => ({
        id: factor.id,
        type: factor.type,
        description: factor.description,
        severity: factor.severity,
        likelihood: factor.likelihood,
        impact: factor.impact,
        color: this.getRiskColor(factor.severity)
      })),
      mitigationSuggestions: riskAssessment.mitigationSuggestions,
      riskScore: this.calculateRiskScore(riskAssessment)
    };
    
    // 生成指标
    const metrics: VisualizationMetrics = {
      totalNodes: nodes.length,
      affectedNodes: nodes.filter(node => node.status === 'modified' || node.status === 'added' || node.status === 'removed').length,
      criticalNodes: riskVisualization.riskFactors.filter(factor => factor.severity === 'critical').length,
      totalEdges: edges.length,
      affectedEdges: edges.filter(edge => edge.source === fixInfo.filePath || edge.target === fixInfo.filePath).length,
      riskScore: riskVisualization.riskScore,
      complexityScore: this.calculateComplexityScore(fixInfo),
      confidenceScore: this.calculateConfidenceScore(riskVisualization)
    };
    
    // 生成可视化数据
    const visualizationData: VisualizationData = {
      nodes,
      edges,
      metrics,
      riskAssessment: riskVisualization
    };
    
    // 创建可视化对象
    const visualization: FixVisualization = {
      id: visualizationId,
      fixId: fixInfo.id,
      visualizationType: 'dependency-graph',
      title: `修复方案可视化 - ${fixInfo.description}`,
      data: visualizationData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // 保存可视化
    this.saveVisualization(visualization);
    this.visualizations.set(visualizationId, visualization);
    
    return visualization;
  }

  /**
   * 生成修复风险评估可视化
   */
  generateRiskAssessmentVisualization(
    fixInfo: FixInfo,
    riskAssessment: any
  ): FixVisualization {
    const visualizationId = `vis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 生成风险可视化数据
    const riskVisualization: RiskVisualization = {
      overallRisk: riskAssessment.overallRisk,
      riskFactors: riskAssessment.riskFactors.map((factor: any) => ({
        id: factor.id,
        type: factor.type,
        description: factor.description,
        severity: factor.severity,
        likelihood: factor.likelihood,
        impact: factor.impact,
        color: this.getRiskColor(factor.severity)
      })),
      mitigationSuggestions: riskAssessment.mitigationSuggestions,
      riskScore: this.calculateRiskScore(riskAssessment)
    };
    
    // 生成风险节点
    const nodes: VisualizationNode[] = [
      {
        id: 'fix-node',
        name: fixInfo.description,
        type: 'fix',
        status: 'modified'
      }
    ];
    
    // 添加风险因素节点
    for (const factor of riskVisualization.riskFactors) {
      nodes.push({
        id: factor.id,
        name: factor.description,
        type: 'risk',
        status: 'affected',
        severity: factor.severity
      });
    }
    
    // 添加边
    const edges: VisualizationEdge[] = [];
    for (const factor of riskVisualization.riskFactors) {
      edges.push({
        id: `fix->${factor.id}`,
        source: 'fix-node',
        target: factor.id,
        type: 'risk-factor',
        strength: this.getRiskStrength(factor.severity),
        color: factor.color
      });
    }
    
    // 生成指标
    const metrics: VisualizationMetrics = {
      totalNodes: nodes.length,
      affectedNodes: nodes.length - 1,
      criticalNodes: riskVisualization.riskFactors.filter(factor => factor.severity === 'critical').length,
      totalEdges: edges.length,
      affectedEdges: edges.length,
      riskScore: riskVisualization.riskScore,
      complexityScore: this.calculateComplexityScore(fixInfo),
      confidenceScore: this.calculateConfidenceScore(riskVisualization)
    };
    
    // 生成可视化数据
    const visualizationData: VisualizationData = {
      nodes,
      edges,
      metrics,
      riskAssessment: riskVisualization
    };
    
    // 创建可视化对象
    const visualization: FixVisualization = {
      id: visualizationId,
      fixId: fixInfo.id,
      visualizationType: 'risk-assessment',
      title: `修复风险评估 - ${fixInfo.description}`,
      data: visualizationData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // 保存可视化
    this.saveVisualization(visualization);
    this.visualizations.set(visualizationId, visualization);
    
    return visualization;
  }

  /**
   * 生成修复时间线可视化
   */
  generateTimelineVisualization(
    fixId: string,
    timelineEvents: any[]
  ): FixVisualization {
    const visualizationId = `vis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 生成时间线节点
    const nodes: VisualizationNode[] = timelineEvents.map((event, index) => ({
      id: event.id,
      name: event.description,
      type: 'file', // 使用file作为通用类型
      status: 'original'
    }));
    
    // 生成时间线边
    const edges: VisualizationEdge[] = [];
    for (let i = 0; i < timelineEvents.length - 1; i++) {
      edges.push({
        id: `${timelineEvents[i].id}->${timelineEvents[i + 1].id}`,
        source: timelineEvents[i].id,
        target: timelineEvents[i + 1].id,
        type: 'timeline',
        strength: 1.0,
        color: '#4F46E5'
      });
    }
    
    // 生成指标
    const metrics: VisualizationMetrics = {
      totalNodes: nodes.length,
      affectedNodes: 0,
      criticalNodes: 0,
      totalEdges: edges.length,
      affectedEdges: 0,
      riskScore: 0,
      complexityScore: 0,
      confidenceScore: 100
    };
    
    // 生成可视化数据
    const visualizationData: VisualizationData = {
      nodes,
      edges,
      metrics,
      timeline: timelineEvents
    };
    
    // 创建可视化对象
    const visualization: FixVisualization = {
      id: visualizationId,
      fixId: fixId,
      visualizationType: 'timeline',
      title: `修复时间线 - ${fixId}`,
      data: visualizationData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // 保存可视化
    this.saveVisualization(visualization);
    this.visualizations.set(visualizationId, visualization);
    
    return visualization;
  }

  /**
   * 生成修复比较可视化
   */
  generateComparisonVisualization(
    fixInfo: FixInfo
  ): FixVisualization {
    const visualizationId = `vis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 生成比较数据
    const comparison: FixComparison = {
      oldCode: fixInfo.oldCode,
      newCode: fixInfo.newCode,
      diff: this.generateDiff(fixInfo.oldCode, fixInfo.newCode),
      changes: this.analyzeChanges(fixInfo.oldCode, fixInfo.newCode),
      lineRange: { 
        start: fixInfo.line, 
        end: fixInfo.line + fixInfo.newCode.split('\n').length - 1 
      }
    };
    
    // 生成指标
    const metrics: VisualizationMetrics = {
      totalNodes: 2, // 旧代码和新代码
      affectedNodes: 1, // 新代码
      criticalNodes: 0,
      totalEdges: 1, // 比较关系
      affectedEdges: 1,
      riskScore: 0,
      complexityScore: this.calculateComplexityScore(fixInfo),
      confidenceScore: 100
    };
    
    // 生成可视化数据
    const visualizationData: VisualizationData = {
      nodes: [],
      edges: [],
      metrics,
      comparison
    };
    
    // 创建可视化对象
    const visualization: FixVisualization = {
      id: visualizationId,
      fixId: fixInfo.id,
      visualizationType: 'comparison',
      title: `修复比较 - ${fixInfo.description}`,
      data: visualizationData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // 保存可视化
    this.saveVisualization(visualization);
    this.visualizations.set(visualizationId, visualization);
    
    return visualization;
  }

  /**
   * 获取边的颜色
   */
  private getEdgeColor(type: string): string {
    switch (type) {
      case 'dependency': return '#4F46E5';
      case 'call': return '#10B981';
      case 'inheritance': return '#F59E0B';
      case 'implementation': return '#EF4444';
      case 'risk-factor': return '#EC4899';
      case 'timeline': return '#6366F1';
      default: return '#6B7280';
    }
  }

  /**
   * 获取风险颜色
   */
  private getRiskColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#EF4444';
      case 'high': return '#F59E0B';
      case 'medium': return '#FBBF24';
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  }

  /**
   * 获取风险强度
   */
  private getRiskStrength(severity: string): number {
    switch (severity) {
      case 'critical': return 1.0;
      case 'high': return 0.8;
      case 'medium': return 0.6;
      case 'low': return 0.4;
      default: return 0.2;
    }
  }

  /**
   * 计算风险分数
   */
  private calculateRiskScore(riskAssessment: any): number {
    const score = riskAssessment.riskFactors.reduce((sum: number, factor: any) => {
      let severityScore = 0;
      switch (factor.severity) {
        case 'critical': severityScore = 100; break;
        case 'high': severityScore = 75; break;
        case 'medium': severityScore = 50; break;
        case 'low': severityScore = 25; break;
        default: severityScore = 0;
      }
      return sum + severityScore;
    }, 0);
    
    return Math.min(100, Math.round(score / riskAssessment.riskFactors.length));
  }

  /**
   * 计算复杂度分数
   */
  private calculateComplexityScore(fixInfo: FixInfo): number {
    const oldLines = fixInfo.oldCode.split('\n').length;
    const newLines = fixInfo.newCode.split('\n').length;
    const linesChanged = Math.abs(newLines - oldLines);
    
    // 简单的复杂度计算：基于代码行数和变化行数
    const complexity = Math.min(100, Math.round((linesChanged / Math.max(oldLines, newLines)) * 100));
    return complexity;
  }

  /**
   * 计算置信度分数
   */
  private calculateConfidenceScore(riskVisualization: RiskVisualization): number {
    // 基于风险分数计算置信度：风险越高，置信度越低
    const confidence = Math.max(0, 100 - riskVisualization.riskScore);
    return Math.round(confidence);
  }

  /**
   * 生成差异
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
   * 分析变化
   */
  private analyzeChanges(oldCode: string, newCode: string): CodeChange[] {
    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');
    const changes: CodeChange[] = [];
    
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      if (i >= oldLines.length) {
        // 添加新行
        changes.push({
          type: 'add',
          line: i + 1,
          content: newLines[i]
        });
      } else if (i >= newLines.length) {
        // 删除行
        changes.push({
          type: 'delete',
          line: i + 1,
          content: oldLines[i]
        });
      } else if (oldLines[i] !== newLines[i]) {
        // 修改行
        changes.push({
          type: 'modify',
          line: i + 1,
          content: newLines[i]
        });
      }
    }
    
    return changes;
  }

  /**
   * 保存可视化
   */
  private saveVisualization(visualization: FixVisualization): void {
    const visPath = path.join(this.config.outputPath, `visualization-${visualization.id}.json`);
    fs.writeFileSync(visPath, JSON.stringify(visualization, null, 2), 'utf8');
  }

  /**
   * 获取可视化
   */
  getVisualization(visId: string): FixVisualization | undefined {
    return this.visualizations.get(visId);
  }

  /**
   * 获取修复的所有可视化
   */
  getVisualizationsByFixId(fixId: string): FixVisualization[] {
    return Array.from(this.visualizations.values())
      .filter(vis => vis.fixId === fixId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * 删除可视化
   */
  deleteVisualization(visId: string): void {
    // 删除文件
    const visPath = path.join(this.config.outputPath, `visualization-${visId}.json`);
    if (fs.existsSync(visPath)) {
      fs.unlinkSync(visPath);
    }
    
    // 从缓存中删除
    this.visualizations.delete(visId);
  }

  /**
   * 导出可视化
   */
  exportVisualization(visId: string, format: 'json' | 'svg' | 'png'): string {
    const visualization = this.visualizations.get(visId);
    if (!visualization) {
      throw new Error(`可视化不存在: ${visId}`);
    }
    
    if (format === 'json') {
      return JSON.stringify(visualization, null, 2);
    } else {
      // SVG和PNG导出需要专门的库，这里仅返回占位内容
      return `可视化导出功能需要专门的库支持，格式: ${format}`;
    }
  }
}

// 创建单例实例
export const fixVisualizationService = new FixVisualizationService();
