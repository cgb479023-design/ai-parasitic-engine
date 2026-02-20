/**
 * Error Tracking Service
 * 自动收集和分类错误，便于调试和分析
 */

interface ErrorLog {
  id: string;
  timestamp: number;
  category: ErrorCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  stack?: string;
  userAgent?: string;
  context?: ErrorContext;
  resolved: boolean;
  resolvedAt?: number;
}

interface ErrorContext {
  videoId?: string;
  apiCall?: string;
  component?: string;
  url?: string;
  userId?: string;
  additionalData?: any;
}

enum ErrorCategory {
  STORAGE = 'STORAGE',           // Chrome storage errors
  AUTH = 'AUTH',               // Authentication errors
  VIDEO_GEN = 'VIDEO_GEN',        // Video generation errors
  EDITOR = 'EDITOR',            // Editor/export errors
  NETWORK = 'NETWORK',          // API/network errors
  UI = 'UI',                  // Component render errors
  PERFORMANCE = 'PERFORMANCE',     // Performance degradation
  ANALYTICS = 'ANALYTICS'        // Analytics service errors
}

interface ErrorPattern {
  regex: RegExp;
  category: ErrorCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  suggestedFix: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // Chrome Storage errors
  {
    regex: /chrome\.storage\.(local|sync)\.(get|set|remove|clear)/i,
    category: ErrorCategory.STORAGE,
    severity: 'high',
    suggestedFix: 'Add try-catch wrapper and validate data before storage operations'
  },
  {
    regex: /chrome\.storage.*undefined|null|cannot.*read/i,
    category: ErrorCategory.STORAGE,
    severity: 'critical',
    suggestedFix: 'Check if chrome.storage is available before accessing, add null checks'
  },

  // Authentication errors
  {
    regex: /api.*key|authentication|auth.*failed|401|403/i,
    category: ErrorCategory.AUTH,
    severity: 'critical',
    suggestedFix: 'Verify API key validity, implement retry logic, show user-friendly error message'
  },
  {
    regex: /apikey.*undefined|null|empty/i,
    category: ErrorCategory.AUTH,
    severity: 'high',
    suggestedFix: 'Add null check before API calls, validate key format'
  },

  // Video generation errors
  {
    regex: /video.*generation.*failed|error|timeout|cancelled/i,
    category: ErrorCategory.VIDEO_GEN,
    severity: 'high',
    suggestedFix: 'Check API quota, implement retry mechanism, validate prompt format'
  },
  {
    regex: /generateVideo|createVideo.*error|exception/i,
    category: ErrorCategory.VIDEO_GEN,
    severity: 'critical',
    suggestedFix: 'Add comprehensive error handling, validate inputs, implement timeout'
  },

  // Network errors
  {
    regex: /fetch.*failed|network|timeout|cors|502|503|504/i,
    category: ErrorCategory.NETWORK,
    severity: 'medium',
    suggestedFix: 'Implement retry logic, add CORS headers, handle timeouts gracefully'
  },
  {
    regex: /ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i,
    category: ErrorCategory.NETWORK,
    severity: 'high',
    suggestedFix: 'Check network connectivity, implement offline mode, show clear error messages'
  },

  // UI/Component errors
  {
    regex: /react.*render.*error|component.*failed|cannot.*render/i,
    category: ErrorCategory.UI,
    severity: 'medium',
    suggestedFix: 'Check props validation, add error boundaries, implement loading states'
  },
  {
    regex: /typeError|undefined.*property|cannot.*read/i,
    category: ErrorCategory.UI,
    severity: 'high',
    suggestedFix: 'Add proper TypeScript typing, use optional chaining, validate data flow'
  },

  // Performance errors
  {
    regex: /performance|slow|timeout|hang|freeze/i,
    category: ErrorCategory.PERFORMANCE,
    severity: 'low',
    suggestedFix: 'Implement lazy loading, add loading indicators, optimize rendering'
  }
];

export class ErrorTracker {
  private errorLogs: Map<string, ErrorLog[]> = new Map();
  private errorCounts: Map<ErrorCategory, number> = new Map();
  private readonly MAX_LOGS_PER_CATEGORY = 100;
  private readonly MAX_TOTAL_LOGS = 500;

  /**
   * 记录错误
   */
  capture(error: Error | string, context?: ErrorContext): string {
    const errorObj = typeof error === 'string'
      ? this.parseError(error, context)
      : this.parseErrorObject(error, context);

    const errorLog: ErrorLog = {
      id: this.generateErrorId(errorObj.category),
      timestamp: Date.now(),
      category: errorObj.category,
      severity: errorObj.severity,
      message: errorObj.message,
      stack: errorObj.stack,
      userAgent: errorObj.userAgent || this.getUserAgent(),
      context: errorObj.context,
      resolved: false
    };

    // 存储错误
    if (!this.errorLogs.has(errorObj.category)) {
      this.errorLogs.set(errorObj.category, []);
    }

    const logs = this.errorLogs.get(errorObj.category)!;
    logs.push(errorLog);

    // 限制日志数量
    if (logs.length > this.MAX_LOGS_PER_CATEGORY) {
      logs.shift(); // 移除最旧的日志
    }

    // 更新计数
    const currentCount = (this.errorCounts.get(errorObj.category) || 0) + 1;
    this.errorCounts.set(errorObj.category, currentCount);

    // 分类错误
    this.classifyError(errorObj);

    // 生成修复建议
    this.suggestFix(errorObj);

    console.error(`🚨 [${errorObj.category}] ${errorObj.message}`);

    return errorLog.id;
  }

  /**
   * 解析字符串错误
   */
  private parseError(error: string, context?: ErrorContext): any {
    let category = ErrorCategory.NETWORK;
    let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';
    let suggestedFix = 'Review error details';

    // 检查错误模式
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.regex.test(error)) {
        category = pattern.category;
        severity = pattern.severity;
        suggestedFix = pattern.suggestedFix;
        break;
      }
    }

    return {
      category,
      severity,
      suggestedFix,
      message: error,
      stack: new Error().stack,
      context
    };
  }

  /**
   * 解析 Error 对象
   */
  private parseErrorObject(error: Error, context?: ErrorContext): any {
    let category = ErrorCategory.NETWORK;
    let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';
    let suggestedFix = 'Review error details';

    // 检查错误模式
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.regex.test(error.message)) {
        category = pattern.category;
        severity = pattern.severity;
        suggestedFix = pattern.suggestedFix;
        break;
      }
    }

    return {
      category,
      severity,
      suggestedFix,
      message: error.message,
      stack: error.stack,
      userAgent: this.getUserAgent(),
      context: {
        ...context,
        // 自动提取堆栈中的关键信息
        componentName: this.extractComponentName(error.stack)
      }
    };
  }

  /**
   * 分类错误
   */
  private classifyError(errorObj: any): void {
    const { category, severity } = errorObj;

    // 严重程度映射
    const severityMap = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢'
    };

    const emoji = severityMap[severity] || '⚠️';
    console.log(`${emoji} [${category}] Severity: ${severity}`);
  }

  /**
   * 生成错误ID
   */
  private generateErrorId(category: string): string {
    const timestamp = Date.now().toString(36);
    const categoryPrefix = category.substring(0, 3).toUpperCase();
    return `${categoryPrefix}_${timestamp}`;
  }

  /**
   * 获取用户代理
   */
  private getUserAgent(): string {
    return typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
  }

  /**
   * 从堆栈中提取组件名
   */
  private extractComponentName(stack?: string): string | undefined {
    if (!stack) return undefined;

    // 查找类似 "at ComponentName (xxx:xx)" 的模式
    const componentMatch = stack.match(/at\s+(\w+)\s*\(/);
    return componentMatch ? componentMatch[1] : undefined;
  }

  /**
   * 生成智能修复建议
   */
  private suggestFix(errorObj: any): void {
    const { suggestedFix, context } = errorObj;

    // 根据上下文增强建议
    if (context?.componentName) {
      console.log(`💡 Suggested fix for ${context.componentName}:`);
      console.log(`   ${suggestedFix}`);
    }

    if (context?.apiCall) {
      console.log(`💡 API Call details: ${context.apiCall}`);
      console.log(`   Verify: ${suggestedFix}`);
    }

    if (errorObj.category === ErrorCategory.STORAGE && context?.videoId) {
      console.log(`💡 Affected video: ${context.videoId}`);
      console.log(`   Consider: Check video data integrity in storage`);
    }
  }

  /**
   * 标记错误为已解决
   */
  markAsResolved(errorId: string): void {
    for (const [category, logs] of Array.from(this.errorLogs.entries())) {
      const log = logs.find(l => l.id === errorId);
      if (log) {
        log.resolved = true;
        log.resolvedAt = Date.now();
        console.log(`✅ Error ${errorId} marked as resolved`);
      }
    }
  }

  /**
   * 获取错误统计
   */
  getStats(): {
    total: number;
    byCategory: Map<ErrorCategory, number>;
    bySeverity: Map<string, number>;
    unresolved: number;
    recentErrors: ErrorLog[];
  } {
    const total = Array.from(this.errorLogs.values())
      .reduce((sum, logs) => sum + logs.length, 0);

    const byCategory = new Map();
    for (const [category, logs] of Array.from(this.errorLogs.entries())) {
      byCategory.set(category, logs.length);
    }

    const bySeverity = new Map();
    let unresolved = 0;
    const recentErrors: ErrorLog[] = [];
    const oneHourAgo = Date.now() - 3600000; // 1 hour ago

    for (const [category, logs] of Array.from(this.errorLogs.entries())) {
      for (const log of logs) {
        // 按严重程度统计
        const key = log.severity;
        bySeverity.set(key, (bySeverity.get(key) || 0) + 1);

        // 统计未解决的错误
        if (!log.resolved) {
          unresolved++;
        }

        // 最近1小时的错误
        if (log.timestamp > oneHourAgo && !log.resolved) {
          recentErrors.push(log);
        }
      }
    }

    return {
      total,
      byCategory,
      bySeverity,
      unresolved,
      recentErrors
    };
  }

  /**
   * 获取错误列表
   */
  getErrors(category?: ErrorCategory, severity?: 'critical' | 'high' | 'medium' | 'low', limit?: number): ErrorLog[] {
    let errors: ErrorLog[] = [];

    if (category) {
      const logs = this.errorLogs.get(category) || [];
      errors = logs.filter(log => !severity || log.severity === severity);
    } else {
      // 获取所有错误
      errors = Array.from(this.errorLogs.values())
        .flat()
        .filter(log => !severity || log.severity === severity);
    }

    // 限制数量
    if (limit && errors.length > limit) {
      errors = errors.slice(0, limit);
    }

    // 按时间倒序
    errors.sort((a, b) => b.timestamp - a.timestamp);

    return errors;
  }

  /**
   * 清除旧错误
   */
  clearOldErrors(maxAge: number = 86400000): void { // 默认24小时
    const cutoff = Date.now() - maxAge;
    let cleared = 0;

    for (const [category, logs] of Array.from(this.errorLogs.entries())) {
      const beforeLength = logs.length;
      const filtered = logs.filter(log => log.timestamp < cutoff);

      if (filtered.length > 0) {
        // 保留最新的100个
        const keep = logs.slice(-100);
        this.errorLogs.set(category, keep);
        cleared += logs.length - keep.length;
      }
    }

    if (cleared > 0) {
      console.log(`🧹 Cleared ${cleared} old error logs`);
    }
  }

  /**
   * 导出错误报告
   */
  exportReport(): string {
    const stats = this.getStats();

    let report = '\n' + '='.repeat(60);
    report += '\n🚨 ERROR TRACKING REPORT';
    report += '\n' + '='.repeat(60) + '\n';

    report += '\n📊 Statistics:\n';
    report += `   Total Errors: ${stats.total}\n`;
    report += `   Unresolved: ${stats.unresolved}\n`;
    report += `   Recent (1h): ${stats.recentErrors.length}\n`;

    report += '\n📋 By Category:\n';
    stats.byCategory.forEach((count, category) => {
      const countStr = count.toString().padStart(3);
      report += `   ${category}: ${countStr}\n`;
    });

    report += '\n🎯 By Severity:\n';
    stats.bySeverity.forEach((count, severity) => {
      const emoji = severity === 'critical' ? '🔴' : severity === 'high' ? '🟠' : severity === 'medium' ? '🟡' : '🟢';
      const countStr = count.toString().padStart(3);
      report += `   ${emoji} ${severity}: ${countStr}\n`;
    });

    if (stats.recentErrors.length > 0) {
      report += '\n⚠️ Recent Errors (Last Hour):\n';
      stats.recentErrors.forEach((err, i) => {
        const timestamp = new Date(err.timestamp).toLocaleString();
        report += `\n   [${i + 1}] ${timestamp}\n`;
        report += `       Category: ${err.category}\n`;
        report += `       Severity: ${err.severity}\n`;
        report += `       Message: ${err.message}\n`;

        if (err.context) {
          report += `       Context: ${JSON.stringify(err.context)}\n`;
        }

        if (err.stack) {
          report += `       Stack: ${err.stack.substring(0, 100)}...\n`;
        }
      });
    }

    report += '\n' + '='.repeat(60);

    return report;
  }
}

// 导出单例实例
export const errorTracker = new ErrorTracker();