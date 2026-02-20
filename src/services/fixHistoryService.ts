import * as fs from 'fs';
import * as path from 'path';
import { FixInfo } from './fixReviewer';
import { Deployment } from './deployManager';
import { FixEffect } from './fixEffectTracker';
import { FixDocumentation } from './fixDocumentationGenerator';

// 定义修复历史相关接口
export interface FixHistory {
  id: string;
  fixId: string;
  historyEvents: HistoryEvent[];
  currentStatus: 'in-progress' | 'completed' | 'deployed' | 'rolled-back';
  createdDate: Date;
  lastUpdated: Date;
  metadata: any;
}

export interface HistoryEvent {
  id: string;
  eventType: 'fix-created' | 'review-started' | 'review-completed' | 'deployed' | 'rolled-back' | 'effect-tracked' | 'documentation-generated';
  timestamp: Date;
  actor: string;
  description: string;
  data?: any;
  relatedIds: {
    reviewId?: string;
    deploymentId?: string;
    effectId?: string;
    documentationId?: string;
  };
}

export interface FixHistoryConfig {
  storagePath: string;
  maxHistoryItems: number;
  enableAuditLogging: boolean;
  auditLogPath: string;
}

export interface AddHistoryEventOptions {
  fixId: string;
  eventType: HistoryEvent['eventType'];
  actor: string;
  description: string;
  data?: any;
  relatedIds?: {
    reviewId?: string;
    deploymentId?: string;
    effectId?: string;
    documentationId?: string;
  };
}

export interface GetHistoryOptions {
  fixId?: string;
  eventType?: HistoryEvent['eventType'];
  startDate?: Date;
  endDate?: Date;
  actor?: string;
  limit?: number;
  offset?: number;
}

/**
 * 修复历史记录服务
 * 用于记录和管理所有修复的历史记录，包括修复的创建、评审、部署和效果跟踪等
 */
export class FixHistoryService {
  private readonly config: FixHistoryConfig;
  private historyCache: Map<string, FixHistory> = new Map();

  constructor(config?: Partial<FixHistoryConfig>) {
    this.config = {
      storagePath: config?.storagePath || './history',
      maxHistoryItems: config?.maxHistoryItems || 1000,
      enableAuditLogging: config?.enableAuditLogging !== false,
      auditLogPath: config?.auditLogPath || './audit-logs'
    };

    // 初始化存储目录
    this.initializeStorage();
    
    // 加载历史记录到缓存
    this.loadHistoryToCache();
  }

  /**
   * 初始化存储目录
   */
  private initializeStorage(): void {
    if (!fs.existsSync(this.config.storagePath)) {
      fs.mkdirSync(this.config.storagePath, { recursive: true });
    }
    
    if (this.config.enableAuditLogging && !fs.existsSync(this.config.auditLogPath)) {
      fs.mkdirSync(this.config.auditLogPath, { recursive: true });
    }
  }

  /**
   * 加载历史记录到缓存
   */
  private loadHistoryToCache(): void {
    const files = fs.readdirSync(this.config.storagePath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(this.config.storagePath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const history = JSON.parse(content) as FixHistory;
        this.historyCache.set(history.fixId, history);
      }
    }
  }

  /**
   * 添加修复历史事件
   */
  async addHistoryEvent(options: AddHistoryEventOptions): Promise<FixHistory> {
    // 检查是否已有该修复的历史记录
    let history = this.historyCache.get(options.fixId);
    
    if (!history) {
      // 创建新的历史记录
      history = {
        id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fixId: options.fixId,
        historyEvents: [],
        currentStatus: this.getInitialStatus(options.eventType),
        createdDate: new Date(),
        lastUpdated: new Date(),
        metadata: {}
      };
    }
    
    // 创建新的历史事件
    const event: HistoryEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType: options.eventType,
      timestamp: new Date(),
      actor: options.actor,
      description: options.description,
      data: options.data,
      relatedIds: options.relatedIds || {}
    };
    
    // 添加事件到历史记录
    history.historyEvents.push(event);
    
    // 更新当前状态
    history.currentStatus = this.updateCurrentStatus(history.currentStatus, options.eventType);
    
    // 更新最后更新时间
    history.lastUpdated = new Date();
    
    // 保存历史记录
    this.saveHistory(history);
    
    // 更新缓存
    this.historyCache.set(options.fixId, history);
    
    // 如果启用审计日志，记录审计日志
    if (this.config.enableAuditLogging) {
      this.logAuditEvent(event);
    }
    
    return history;
  }

  /**
   * 获取初始状态
   */
  private getInitialStatus(eventType: HistoryEvent['eventType']): FixHistory['currentStatus'] {
    switch (eventType) {
      case 'fix-created':
        return 'in-progress';
      case 'deployed':
        return 'deployed';
      case 'rolled-back':
        return 'rolled-back';
      default:
        return 'in-progress';
    }
  }

  /**
   * 更新当前状态
   */
  private updateCurrentStatus(currentStatus: FixHistory['currentStatus'], eventType: HistoryEvent['eventType']): FixHistory['currentStatus'] {
    switch (eventType) {
      case 'fix-created':
        return 'in-progress';
      case 'review-completed':
        return 'completed';
      case 'deployed':
        return 'deployed';
      case 'rolled-back':
        return 'rolled-back';
      default:
        return currentStatus;
    }
  }

  /**
   * 保存历史记录
   */
  private saveHistory(history: FixHistory): void {
    const historyPath = path.join(this.config.storagePath, `fix-history-${history.fixId}.json`);
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
  }

  /**
   * 记录审计日志
   */
  private logAuditEvent(event: HistoryEvent): void {
    const auditLog = {
      eventId: event.id,
      eventType: event.eventType,
      timestamp: event.timestamp,
      actor: event.actor,
      description: event.description,
      relatedIds: event.relatedIds,
      data: event.data
    };
    
    const logFileName = `audit-log-${new Date().toISOString().split('T')[0]}.json`;
    const logPath = path.join(this.config.auditLogPath, logFileName);
    
    // 读取现有日志
    let logs: any[] = [];
    if (fs.existsSync(logPath)) {
      const content = fs.readFileSync(logPath, 'utf8');
      logs = JSON.parse(content);
    }
    
    // 添加新日志
    logs.push(auditLog);
    
    // 保存日志
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2), 'utf8');
  }

  /**
   * 获取修复历史记录
   */
  getFixHistory(fixId: string): FixHistory | undefined {
    return this.historyCache.get(fixId);
  }

  /**
   * 获取所有修复历史记录
   */
  getAllFixHistories(): FixHistory[] {
    return Array.from(this.historyCache.values()).sort((a, b) => 
      b.lastUpdated.getTime() - a.lastUpdated.getTime()
    );
  }

  /**
   * 根据条件查询修复历史记录
   */
  getHistoriesByFilter(options: GetHistoryOptions): FixHistory[] {
    let histories = Array.from(this.historyCache.values());
    
    // 根据修复ID过滤
    if (options.fixId) {
      histories = histories.filter(history => history.fixId === options.fixId);
    }
    
    // 根据日期范围过滤
    if (options.startDate) {
      histories = histories.filter(history => 
        history.createdDate >= options.startDate
      );
    }
    
    if (options.endDate) {
      histories = histories.filter(history => 
        history.createdDate <= options.endDate
      );
    }
    
    // 根据当前状态过滤
    // 注意：这里可以根据需要添加状态过滤
    
    // 排序（默认按最后更新时间降序）
    histories.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
    
    // 分页
    if (options.limit) {
      const offset = options.offset || 0;
      histories = histories.slice(offset, offset + options.limit);
    }
    
    return histories;
  }

  /**
   * 获取修复的历史事件
   */
  getHistoryEvents(fixId: string, options?: {
    eventType?: HistoryEvent['eventType'];
    startDate?: Date;
    endDate?: Date;
    actor?: string;
  }): HistoryEvent[] {
    const history = this.historyCache.get(fixId);
    if (!history) {
      return [];
    }
    
    let events = [...history.historyEvents];
    
    // 根据事件类型过滤
    if (options?.eventType) {
      events = events.filter(event => event.eventType === options.eventType);
    }
    
    // 根据日期范围过滤
    if (options?.startDate) {
      events = events.filter(event => event.timestamp >= options.startDate);
    }
    
    if (options?.endDate) {
      events = events.filter(event => event.timestamp <= options.endDate);
    }
    
    // 根据执行人员过滤
    if (options?.actor) {
      events = events.filter(event => event.actor === options.actor);
    }
    
    // 按时间降序排序
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return events;
  }

  /**
   * 更新修复历史记录的元数据
   */
  updateHistoryMetadata(fixId: string, metadata: any): void {
    const history = this.historyCache.get(fixId);
    if (history) {
      history.metadata = { ...history.metadata, ...metadata };
      history.lastUpdated = new Date();
      this.saveHistory(history);
      this.historyCache.set(fixId, history);
    }
  }

  /**
   * 删除修复历史记录
   */
  deleteFixHistory(fixId: string): void {
    // 删除文件
    const historyPath = path.join(this.config.storagePath, `fix-history-${fixId}.json`);
    if (fs.existsSync(historyPath)) {
      fs.unlinkSync(historyPath);
    }
    
    // 从缓存中删除
    this.historyCache.delete(fixId);
  }

  /**
   * 清理旧的历史记录
   */
  cleanupOldHistory(): void {
    const histories = this.getAllFixHistories();
    if (histories.length > this.config.maxHistoryItems) {
      // 按创建日期排序，保留最新的
      const sortedHistories = histories.sort((a, b) => 
        a.createdDate.getTime() - b.createdDate.getTime()
      );
      
      // 计算需要删除的数量
      const deleteCount = histories.length - this.config.maxHistoryItems;
      
      // 删除旧的历史记录
      for (let i = 0; i < deleteCount; i++) {
        this.deleteFixHistory(sortedHistories[i].fixId);
      }
    }
  }

  /**
   * 导出修复历史记录
   */
  exportHistory(fixId: string, format: 'json' | 'csv'): string {
    const history = this.historyCache.get(fixId);
    if (!history) {
      throw new Error(`修复历史记录不存在: ${fixId}`);
    }
    
    if (format === 'json') {
      return JSON.stringify(history, null, 2);
    } else if (format === 'csv') {
      // 生成CSV格式
      let csv = 'Event ID,Event Type,Timestamp,Actor,Description\n';
      for (const event of history.historyEvents) {
        csv += `${event.id},${event.eventType},${event.timestamp.toISOString()},${event.actor},"${event.description}"\n`;
      }
      return csv;
    }
    
    throw new Error(`不支持的导出格式: ${format}`);
  }

  /**
   * 导入修复历史记录
   */
  importHistory(historyData: string, format: 'json'): FixHistory {
    if (format === 'json') {
      const history = JSON.parse(historyData) as FixHistory;
      
      // 验证历史记录格式
      if (!history.fixId || !history.historyEvents) {
        throw new Error('无效的修复历史记录格式');
      }
      
      // 保存历史记录
      this.saveHistory(history);
      
      // 更新缓存
      this.historyCache.set(history.fixId, history);
      
      return history;
    }
    
    throw new Error(`不支持的导入格式: ${format}`);
  }

  /**
   * 获取修复历史统计信息
   */
  getHistoryStatistics(): HistoryStatistics {
    const histories = this.getAllFixHistories();
    const allEvents = histories.flatMap(history => history.historyEvents);
    
    // 按状态统计
    const statusCount = {
      'in-progress': 0,
      'completed': 0,
      'deployed': 0,
      'rolled-back': 0
    };
    
    for (const history of histories) {
      statusCount[history.currentStatus]++;
    }
    
    // 按事件类型统计
    const eventTypeCount: Record<HistoryEvent['eventType'], number> = {
      'fix-created': 0,
      'review-started': 0,
      'review-completed': 0,
      'deployed': 0,
      'rolled-back': 0,
      'effect-tracked': 0,
      'documentation-generated': 0
    };
    
    for (const event of allEvents) {
      eventTypeCount[event.eventType]++;
    }
    
    // 计算平均修复时间
    const completedHistories = histories.filter(history => 
      history.currentStatus === 'completed' || history.currentStatus === 'deployed' || history.currentStatus === 'rolled-back'
    );
    
    let avgFixTime = 0;
    if (completedHistories.length > 0) {
      const totalFixTime = completedHistories.reduce((sum, history) => {
        const createdEvent = history.historyEvents.find(event => event.eventType === 'fix-created');
        if (createdEvent) {
          const timeDiff = history.lastUpdated.getTime() - createdEvent.timestamp.getTime();
          return sum + timeDiff;
        }
        return sum;
      }, 0);
      
      avgFixTime = totalFixTime / completedHistories.length;
    }
    
    return {
      totalFixes: histories.length,
      statusCount,
      eventTypeCount,
      totalEvents: allEvents.length,
      avgFixTime,
      oldestFixDate: histories.length > 0 ? Math.min(...histories.map(h => h.createdDate.getTime())) : 0,
      newestFixDate: histories.length > 0 ? Math.max(...histories.map(h => h.createdDate.getTime())) : 0
    };
  }
}

export interface HistoryStatistics {
  totalFixes: number;
  statusCount: {
    'in-progress': number;
    'completed': number;
    'deployed': number;
    'rolled-back': number;
  };
  eventTypeCount: Record<HistoryEvent['eventType'], number>;
  totalEvents: number;
  avgFixTime: number;
  oldestFixDate: number;
  newestFixDate: number;
}

// 创建单例实例
export const fixHistoryService = new FixHistoryService();
