// Global Logger Service for DFL System
// Handles logging, monitoring, and alerting for all modules

interface LogEntry {
  timestamp: string;
  module: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata?: any;
}

class GlobalLogger {
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;
  private flushInterval = 5000; // Flush logs every 5 seconds
  private flushTimer: NodeJS.Timeout | null = null;
  private alertThresholds = {
    error: 5, // Alert if 5 errors in 60 seconds
    warning: 10, // Alert if 10 warnings in 60 seconds
    responseTime: 5000, // Alert if response time > 5 seconds
  };
  private recentErrors: number[] = [];
  private recentWarnings: number[] = [];

  constructor() {
    this.startFlushTimer();
    this.startAlertMonitor();
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flushLogs();
    }, this.flushInterval);
  }

  private startAlertMonitor() {
    setInterval(() => {
      this.checkAlerts();
    }, 60000); // Check alerts every minute
  }

  private checkAlerts() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old entries
    this.recentErrors = this.recentErrors.filter(timestamp => timestamp > oneMinuteAgo);
    this.recentWarnings = this.recentWarnings.filter(timestamp => timestamp > oneMinuteAgo);

    // Check thresholds
    if (this.recentErrors.length >= this.alertThresholds.error) {
      this.sendAlert('High error rate detected', {
        errorCount: this.recentErrors.length,
        threshold: this.alertThresholds.error,
      });
    }

    if (this.recentWarnings.length >= this.alertThresholds.warning) {
      this.sendAlert('High warning rate detected', {
        warningCount: this.recentWarnings.length,
        threshold: this.alertThresholds.warning,
      });
    }
  }

  private sendAlert(message: string, metadata: any) {
    // In production, this would send an alert via email, Slack, or other channels
    console.error(`🚨 ALERT: ${message}`, metadata);
    
    // Store alert in localStorage for UI display
    const alerts = JSON.parse(localStorage.getItem('systemAlerts') || '[]');
    alerts.push({
      timestamp: new Date().toISOString(),
      message,
      metadata,
      resolved: false,
    });
    localStorage.setItem('systemAlerts', JSON.stringify(alerts));
  }

  private flushLogs() {
    if (this.logBuffer.length === 0) return;

    // In production, this would send logs to a centralized logging service
    console.log('📊 Flushing logs:', this.logBuffer.length);
    
    // Store logs in localStorage for debugging
    const logs = JSON.parse(localStorage.getItem('systemLogs') || '[]');
    logs.push(...this.logBuffer);
    // Keep only last 1000 logs
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }
    localStorage.setItem('systemLogs', JSON.stringify(logs));

    this.logBuffer = [];
  }

  private addLogEntry(entry: LogEntry) {
    this.logBuffer.push(entry);
    
    // Log to console with appropriate styling
    const timestamp = entry.timestamp;
    const module = `[${entry.module}]`;
    const level = `[${entry.level.toUpperCase()}]`;
    
    switch (entry.level) {
      case 'error':
        console.error(`🔴 ${timestamp} ${module} ${level} ${entry.message}`, entry.metadata || '');
        this.recentErrors.push(Date.now());
        break;
      case 'warn':
        console.warn(`🟡 ${timestamp} ${module} ${level} ${entry.message}`, entry.metadata || '');
        this.recentWarnings.push(Date.now());
        break;
      case 'info':
        console.info(`🟢 ${timestamp} ${module} ${level} ${entry.message}`, entry.metadata || '');
        break;
      case 'debug':
        console.debug(`🔵 ${timestamp} ${module} ${level} ${entry.message}`, entry.metadata || '');
        break;
    }

    // Flush if buffer is full
    if (this.logBuffer.length >= this.maxBufferSize) {
      this.flushLogs();
    }
  }

  // Public logging methods
  debug(module: string, message: string, metadata?: any) {
    this.addLogEntry({
      timestamp: new Date().toISOString(),
      module,
      level: 'debug',
      message,
      metadata,
    });
  }

  info(module: string, message: string, metadata?: any) {
    this.addLogEntry({
      timestamp: new Date().toISOString(),
      module,
      level: 'info',
      message,
      metadata,
    });
  }

  warn(module: string, message: string, metadata?: any) {
    this.addLogEntry({
      timestamp: new Date().toISOString(),
      module,
      level: 'warn',
      message,
      metadata,
    });
  }

  error(module: string, message: string, metadata?: any) {
    this.addLogEntry({
      timestamp: new Date().toISOString(),
      module,
      level: 'error',
      message,
      metadata,
    });
  }

  // Performance monitoring
  trackPerformance(module: string, operation: string, duration: number, metadata?: any) {
    this.addLogEntry({
      timestamp: new Date().toISOString(),
      module,
      level: duration > this.alertThresholds.responseTime ? 'warn' : 'debug',
      message: `${operation} completed in ${duration}ms`,
      metadata: { ...metadata, duration },
    });

    // Alert if response time exceeds threshold
    if (duration > this.alertThresholds.responseTime) {
      this.sendAlert(`Slow operation detected: ${operation}`, {
        module,
        operation,
        duration,
        threshold: this.alertThresholds.responseTime,
      });
    }
  }

  // Cleanup method
  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushLogs();
  }
}

// Export singleton instance
export const globalLogger = new GlobalLogger();
