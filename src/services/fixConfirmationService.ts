import * as fs from 'fs';
import * as path from 'path';
import { FixInfo } from './fixReviewer';
import { FixRiskAssessment } from './fixRiskAssessmentService';
import { FixVisualization } from './fixVisualizationService';
import { FixEffectSummary } from './fixEffectTracker';

// 定义交互式修复确认相关接口
export interface FixConfirmationRequest {
  id: string;
  fixId: string;
  fixInfo: FixInfo;
  requestedBy: string;
  requestedAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expirationTime: Date;
  confirmationOptions: ConfirmationOption[];
  selectedOption?: string;
  comments?: string;
  riskAssessment?: FixRiskAssessment;
  visualization?: FixVisualization;
  effectSummary?: FixEffectSummary;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface ConfirmationOption {
  id: string;
  name: string;
  description: string;
  type: 'full' | 'partial' | 'rollback' | 'custom';
  riskLevel: 'low' | 'medium' | 'high';
  estimatedImpact: 'low' | 'medium' | 'high';
  isRecommended: boolean;
  details: any;
}

export interface ConfirmationResult {
  success: boolean;
  message: string;
  confirmationId: string;
  fixId: string;
  status: 'approved' | 'rejected' | 'expired';
}

export interface ConfirmationConfig {
  defaultExpirationMinutes: number;
  enableRiskBasedOptions: boolean;
  enableVisualConfirmation: boolean;
  enableEffectPreview: boolean;
  requiredApprovalLevel: 'none' | 'developer' | 'reviewer' | 'manager';
  autoApproveLowRisk: boolean;
}

export interface ConfirmationHistory {
  id: string;
  confirmationId: string;
  fixId: string;
  action: 'requested' | 'approved' | 'rejected' | 'expired' | 'updated';
  actor: string;
  timestamp: Date;
  details: any;
}

/**
 * 交互式修复确认服务
 * 用于管理修复确认请求，生成确认选项，并处理用户确认
 */
export class FixConfirmationService {
  private readonly config: ConfirmationConfig;
  private confirmationRequests: Map<string, FixConfirmationRequest> = new Map();
  private confirmationHistory: Map<string, ConfirmationHistory[]> = new Map();

  constructor(config?: Partial<ConfirmationConfig>) {
    this.config = {
      defaultExpirationMinutes: config?.defaultExpirationMinutes || 60,
      enableRiskBasedOptions: config?.enableRiskBasedOptions !== false,
      enableVisualConfirmation: config?.enableVisualConfirmation !== false,
      enableEffectPreview: config?.enableEffectPreview !== false,
      requiredApprovalLevel: config?.requiredApprovalLevel || 'developer',
      autoApproveLowRisk: config?.autoApproveLowRisk !== false
    };
  }

  /**
   * 创建修复确认请求
   */
  createConfirmationRequest(
    fixInfo: FixInfo,
    requestedBy: string,
    riskAssessment?: FixRiskAssessment,
    visualization?: FixVisualization,
    effectSummary?: FixEffectSummary
  ): FixConfirmationRequest {
    const confirmationId = `confirm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 生成确认选项
    const confirmationOptions = this.generateConfirmationOptions(fixInfo, riskAssessment);
    
    // 计算过期时间
    const expirationTime = new Date();
    expirationTime.setMinutes(expirationTime.getMinutes() + this.config.defaultExpirationMinutes);
    
    // 检查是否可以自动批准
    const canAutoApprove = this.shouldAutoApprove(fixInfo, riskAssessment);
    
    const confirmationRequest: FixConfirmationRequest = {
      id: confirmationId,
      fixId: fixInfo.id,
      fixInfo,
      requestedBy,
      requestedAt: new Date(),
      status: canAutoApprove ? 'approved' : 'pending',
      expirationTime,
      confirmationOptions,
      riskAssessment,
      visualization,
      effectSummary,
      selectedOption: canAutoApprove ? confirmationOptions[0].id : undefined,
      approvedBy: canAutoApprove ? requestedBy : undefined,
      approvedAt: canAutoApprove ? new Date() : undefined
    };
    
    // 保存确认请求
    this.saveConfirmationRequest(confirmationRequest);
    this.confirmationRequests.set(confirmationId, confirmationRequest);
    
    // 记录历史
    this.recordHistory(confirmationRequest, 'requested', requestedBy, {
      autoApproved: canAutoApprove
    });
    
    return confirmationRequest;
  }

  /**
   * 生成确认选项
   */
  private generateConfirmationOptions(
    fixInfo: FixInfo,
    riskAssessment?: FixRiskAssessment
  ): ConfirmationOption[] {
    const options: ConfirmationOption[] = [];
    
    // 基础选项：完整修复
    options.push({
      id: 'option_full',
      name: '完整修复',
      description: '应用完整的修复方案，解决所有问题',
      type: 'full',
      riskLevel: riskAssessment ? 
        (riskAssessment.overallRisk === 'low' ? 'low' : 
         riskAssessment.overallRisk === 'medium' ? 'medium' : 'high') : 
        'medium',
      estimatedImpact: 'medium',
      isRecommended: true,
      details: {
        appliesAllChanges: true,
        affectedFiles: [fixInfo.filePath],
        estimatedTime: '5m'
      }
    });
    
    // 风险较低时提供部分修复选项
    if (!riskAssessment || riskAssessment.overallRisk === 'low' || riskAssessment.overallRisk === 'medium') {
      options.push({
        id: 'option_partial',
        name: '部分修复',
        description: '只应用风险较低的部分修复，保留高风险部分供进一步评估',
        type: 'partial',
        riskLevel: 'low',
        estimatedImpact: 'low',
        isRecommended: false,
        details: {
          appliesPartialChanges: true,
          affectedFiles: [fixInfo.filePath],
          excludedRiskyParts: riskAssessment ? 
            riskAssessment.riskFactors.filter(f => f.severity === 'high' || f.severity === 'critical').map(f => f.description) :
            [],
          estimatedTime: '3m'
        }
      });
    }
    
    // 提供回滚选项
    options.push({
      id: 'option_rollback',
      name: '取消修复',
      description: '取消当前修复，保持代码不变',
      type: 'rollback',
      riskLevel: 'low',
      estimatedImpact: 'low',
      isRecommended: false,
      details: {
        appliesNoChanges: true,
        affectedFiles: [],
        estimatedTime: '1m'
      }
    });
    
    // 提供自定义选项
    options.push({
      id: 'option_custom',
      name: '自定义修复',
      description: '根据需要调整修复方案，自定义应用范围',
      type: 'custom',
      riskLevel: 'medium',
      estimatedImpact: 'medium',
      isRecommended: false,
      details: {
        customizable: true,
        availableOptions: ['skip-risky-parts', 'add-tests', 'monitor-impact'],
        estimatedTime: '10m'
      }
    });
    
    return options;
  }

  /**
   * 检查是否应该自动批准
   */
  private shouldAutoApprove(
    fixInfo: FixInfo,
    riskAssessment?: FixRiskAssessment
  ): boolean {
    if (!this.config.autoApproveLowRisk) {
      return false;
    }
    
    // 只有低风险修复才自动批准
    if (riskAssessment && riskAssessment.overallRisk !== 'low') {
      return false;
    }
    
    // 检查修复类型
    if (fixInfo.fixType === 'breaking-change' || fixInfo.fixType === 'security') {
      return false;
    }
    
    // 检查修复复杂度
    const linesChanged = Math.abs(
      fixInfo.newCode.split('\n').length - fixInfo.oldCode.split('\n').length
    );
    
    // 只有简单修复才自动批准
    return linesChanged <= 10;
  }

  /**
   * 处理修复确认
   */
  confirmFix(
    confirmationId: string,
    selectedOption: string,
    approvedBy: string,
    comments?: string
  ): ConfirmationResult {
    const confirmationRequest = this.confirmationRequests.get(confirmationId);
    
    if (!confirmationRequest) {
      return {
        success: false,
        message: '确认请求不存在',
        confirmationId,
        fixId: '',
        status: 'rejected'
      };
    }
    
    // 检查是否已过期
    if (confirmationRequest.status === 'expired' || new Date() > confirmationRequest.expirationTime) {
      confirmationRequest.status = 'expired';
      this.saveConfirmationRequest(confirmationRequest);
      this.recordHistory(confirmationRequest, 'expired', approvedBy, {
        attemptedOption: selectedOption
      });
      
      return {
        success: false,
        message: '确认请求已过期',
        confirmationId,
        fixId: confirmationRequest.fixId,
        status: 'expired'
      };
    }
    
    // 检查选项是否有效
    const isValidOption = confirmationRequest.confirmationOptions.some(
      option => option.id === selectedOption
    );
    
    if (!isValidOption) {
      return {
        success: false,
        message: '无效的确认选项',
        confirmationId,
        fixId: confirmationRequest.fixId,
        status: 'rejected'
      };
    }
    
    // 更新确认请求状态
    confirmationRequest.status = 'approved';
    confirmationRequest.selectedOption = selectedOption;
    confirmationRequest.comments = comments;
    confirmationRequest.approvedBy = approvedBy;
    confirmationRequest.approvedAt = new Date();
    
    // 保存更新后的确认请求
    this.saveConfirmationRequest(confirmationRequest);
    this.confirmationRequests.set(confirmationId, confirmationRequest);
    
    // 记录历史
    this.recordHistory(confirmationRequest, 'approved', approvedBy, {
      selectedOption,
      comments
    });
    
    return {
      success: true,
      message: '修复已成功确认',
      confirmationId,
      fixId: confirmationRequest.fixId,
      status: 'approved'
    };
  }

  /**
   * 拒绝修复确认
   */
  rejectFix(
    confirmationId: string,
    rejectedBy: string,
    comments?: string
  ): ConfirmationResult {
    const confirmationRequest = this.confirmationRequests.get(confirmationId);
    
    if (!confirmationRequest) {
      return {
        success: false,
        message: '确认请求不存在',
        confirmationId,
        fixId: '',
        status: 'rejected'
      };
    }
    
    // 更新确认请求状态
    confirmationRequest.status = 'rejected';
    confirmationRequest.comments = comments;
    
    // 保存更新后的确认请求
    this.saveConfirmationRequest(confirmationRequest);
    this.confirmationRequests.set(confirmationId, confirmationRequest);
    
    // 记录历史
    this.recordHistory(confirmationRequest, 'rejected', rejectedBy, {
      comments
    });
    
    return {
      success: true,
      message: '修复已拒绝',
      confirmationId,
      fixId: confirmationRequest.fixId,
      status: 'rejected'
    };
  }

  /**
   * 获取确认请求
   */
  getConfirmationRequest(confirmationId: string): FixConfirmationRequest | undefined {
    return this.confirmationRequests.get(confirmationId);
  }

  /**
   * 获取修复的所有确认请求
   */
  getConfirmationRequestsByFixId(fixId: string): FixConfirmationRequest[] {
    return Array.from(this.confirmationRequests.values())
      .filter(req => req.fixId === fixId)
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }

  /**
   * 获取所有待处理的确认请求
   */
  getPendingConfirmationRequests(): FixConfirmationRequest[] {
    return Array.from(this.confirmationRequests.values())
      .filter(req => req.status === 'pending')
      .sort((a, b) => a.expirationTime.getTime() - b.expirationTime.getTime());
  }

  /**
   * 取消确认请求
   */
  cancelConfirmationRequest(confirmationId: string, cancelledBy: string): boolean {
    const confirmationRequest = this.confirmationRequests.get(confirmationId);
    
    if (!confirmationRequest || confirmationRequest.status !== 'pending') {
      return false;
    }
    
    // 更新状态为已拒绝
    confirmationRequest.status = 'rejected';
    
    // 保存更新后的确认请求
    this.saveConfirmationRequest(confirmationRequest);
    this.confirmationRequests.set(confirmationId, confirmationRequest);
    
    // 记录历史
    this.recordHistory(confirmationRequest, 'rejected', cancelledBy, {
      reason: 'cancelled'
    });
    
    return true;
  }

  /**
   * 更新确认请求
   */
  updateConfirmationRequest(
    confirmationId: string,
    updates: Partial<FixConfirmationRequest>,
    updatedBy: string
  ): FixConfirmationRequest | null {
    const confirmationRequest = this.confirmationRequests.get(confirmationId);
    
    if (!confirmationRequest) {
      return null;
    }
    
    // 更新确认请求
    const updatedRequest = {
      ...confirmationRequest,
      ...updates,
      requestedAt: confirmationRequest.requestedAt // 保持原始请求时间不变
    };
    
    // 保存更新后的确认请求
    this.saveConfirmationRequest(updatedRequest);
    this.confirmationRequests.set(confirmationId, updatedRequest);
    
    // 记录历史
    this.recordHistory(updatedRequest, 'updated', updatedBy, {
      updates
    });
    
    return updatedRequest;
  }

  /**
   * 导出确认请求
   */
  exportConfirmationRequest(confirmationId: string, format: 'json' | 'markdown'): string {
    const confirmationRequest = this.confirmationRequests.get(confirmationId);
    if (!confirmationRequest) {
      throw new Error(`确认请求不存在: ${confirmationId}`);
    }
    
    if (format === 'json') {
      return JSON.stringify(confirmationRequest, null, 2);
    } else {
      return this.generateMarkdownReport(confirmationRequest);
    }
  }

  /**
   * 生成Markdown报告
   */
  private generateMarkdownReport(request: FixConfirmationRequest): string {
    let report = `# 修复确认请求报告\n\n`;
    report += `## 基本信息\n`;
    report += `- 请求ID: ${request.id}\n`;
    report += `- 修复ID: ${request.fixId}\n`;
    report += `- 请求人: ${request.requestedBy}\n`;
    report += `- 请求时间: ${request.requestedAt.toISOString()}\n`;
    report += `- 状态: ${request.status}\n`;
    report += `- 过期时间: ${request.expirationTime.toISOString()}\n\n`;
    
    if (request.status === 'approved') {
      report += `## 确认信息\n`;
      report += `- 确认人: ${request.approvedBy}\n`;
      report += `- 确认时间: ${request.approvedAt?.toISOString()}\n`;
      report += `- 选择的选项: ${request.selectedOption}\n`;
      if (request.comments) {
        report += `- 评论: ${request.comments}\n\n`;
      }
    }
    
    report += `## 修复信息\n`;
    report += `- 修复类型: ${request.fixInfo.fixType}\n`;
    report += `- 描述: ${request.fixInfo.description}\n`;
    report += `- 文件路径: ${request.fixInfo.filePath}\n`;
    report += `- 行号: ${request.fixInfo.line}\n\n`;
    
    report += `## 确认选项\n`;
    for (const option of request.confirmationOptions) {
      const recommendedMark = option.isRecommended ? ' ⭐' : '';
      report += `- **${option.name}**${recommendedMark}\n`;
      report += `  - 类型: ${option.type}\n`;
      report += `  - 风险等级: ${option.riskLevel}\n`;
      report += `  - 估计影响: ${option.estimatedImpact}\n`;
      report += `  - 描述: ${option.description}\n\n`;
    }
    
    return report;
  }

  /**
   * 保存确认请求
   */
  private saveConfirmationRequest(request: FixConfirmationRequest): void {
    const confirmationsDir = './confirmations';
    if (!fs.existsSync(confirmationsDir)) {
      fs.mkdirSync(confirmationsDir, { recursive: true });
    }
    
    const requestPath = path.join(confirmationsDir, `confirmation-${request.id}.json`);
    fs.writeFileSync(requestPath, JSON.stringify(request, null, 2), 'utf8');
  }

  /**
   * 记录历史
   */
  private recordHistory(
    request: FixConfirmationRequest,
    action: ConfirmationHistory['action'],
    actor: string,
    details: any
  ): void {
    const historyEntry: ConfirmationHistory = {
      id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      confirmationId: request.id,
      fixId: request.fixId,
      action,
      actor,
      timestamp: new Date(),
      details
    };
    
    // 获取现有历史记录
    const history = this.confirmationHistory.get(request.id) || [];
    history.push(historyEntry);
    this.confirmationHistory.set(request.id, history);
    
    // 保存历史记录到文件
    this.saveHistory(historyEntry);
  }

  /**
   * 保存历史记录
   */
  private saveHistory(historyEntry: ConfirmationHistory): void {
    const historyDir = './confirmation-history';
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }
    
    const historyPath = path.join(historyDir, `history-${historyEntry.id}.json`);
    fs.writeFileSync(historyPath, JSON.stringify(historyEntry, null, 2), 'utf8');
  }

  /**
   * 获取确认请求的历史记录
   */
  getConfirmationHistory(confirmationId: string): ConfirmationHistory[] {
    return this.confirmationHistory.get(confirmationId) || [];
  }

  /**
   * 清理过期的确认请求
   */
  cleanupExpiredRequests(): number {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [id, request] of this.confirmationRequests.entries()) {
      if (request.status === 'pending' && now > request.expirationTime) {
        // 更新状态为已过期
        request.status = 'expired';
        
        // 保存更新后的确认请求
        this.saveConfirmationRequest(request);
        this.confirmationRequests.set(id, request);
        
        // 记录历史
        this.recordHistory(request, 'expired', 'system', {
          reason: 'auto-expired'
        });
        
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }

  /**
   * 生成确认摘要
   */
  generateConfirmationSummary(confirmationId: string): any {
    const request = this.confirmationRequests.get(confirmationId);
    if (!request) {
      throw new Error(`确认请求不存在: ${confirmationId}`);
    }
    
    return {
      confirmationId: request.id,
      fixId: request.fixId,
      status: request.status,
      requestedBy: request.requestedBy,
      requestedAt: request.requestedAt,
      riskLevel: request.riskAssessment?.overallRisk || 'medium',
      selectedOption: request.selectedOption,
      approvedBy: request.approvedBy,
      approvedAt: request.approvedAt,
      hasVisualization: !!request.visualization,
      hasRiskAssessment: !!request.riskAssessment,
      hasEffectSummary: !!request.effectSummary
    };
  }
}

// 创建单例实例
export const fixConfirmationService = new FixConfirmationService();
