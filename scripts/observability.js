#!/usr/bin/env node

/**
 * 可观测性工具
 * 功能：统一日志记录、指标收集、分布式追踪
 */

const fs = require('fs');
const path = require('path');

// 配置文件路径
const CONFIG_PATH = path.join(__dirname, '../observability.config.json');

// 默认配置
const DEFAULT_CONFIG = {
  // 日志配置
  logging: {
    enabled: true,
    level: 'info',  // error, warn, info, debug, trace
    format: 'json', // json, text
    filePath: path.join(__dirname, '../logs/app.log'),
    consoleOutput: true
  },
  
  // 指标配置
  metrics: {
    enabled: true,
    defaultLabels: {
      service: 'my-app',
      environment: 'development'
    },
    histogramBuckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  },
  
  // 追踪配置
  tracing: {
    enabled: false,
    samplerRate: 1.0
  }
};

class Observability {
  constructor() {
    this.config = this.loadConfig();
    this.metricsStore = new Map();
    this.tracesStore = new Map();
    
    // 确保日志目录存在
    this.ensureLogDirectory();
  }
  
  // 加载配置
  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
        const userConfig = JSON.parse(configContent);
        return { ...DEFAULT_CONFIG, ...userConfig };
      }
      return DEFAULT_CONFIG;
    } catch (error) {
      console.error('加载可观测性配置失败，使用默认配置:', error.message);
      return DEFAULT_CONFIG;
    }
  }
  
  // 确保日志目录存在
  ensureLogDirectory() {
    if (this.config.logging.enabled) {
      const logDir = path.dirname(this.config.logging.filePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    }
  }
  
  // 日志级别
  getLogLevelPriority(level) {
    const levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };
    return levels[level] || levels.info;
  }
  
  // 日志记录
  log(level, message, data = {}) {
    if (!this.config.logging.enabled) return;
    
    const logLevel = this.getLogLevelPriority(level);
    const configLevel = this.getLogLevelPriority(this.config.logging.level);
    
    if (logLevel > configLevel) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...data
    };
    
    // 控制台输出
    if (this.config.logging.consoleOutput) {
      if (this.config.logging.format === 'json') {
        console.log(JSON.stringify(logEntry));
      } else {
        console.log(`${timestamp} [${level.toUpperCase()}] ${message}`, data);
      }
    }
    
    // 文件输出
    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(this.config.logging.filePath, logLine);
    } catch (error) {
      console.error('日志写入失败:', error.message);
    }
  }
  
  // 错误日志
  error(message, data = {}) {
    this.log('error', message, data);
  }
  
  // 警告日志
  warn(message, data = {}) {
    this.log('warn', message, data);
  }
  
  // 信息日志
  info(message, data = {}) {
    this.log('info', message, data);
  }
  
  // 调试日志
  debug(message, data = {}) {
    this.log('debug', message, data);
  }
  
  // 跟踪日志
  trace(message, data = {}) {
    this.log('trace', message, data);
  }
  
  // 初始化计数器指标
  counter(name, help, labels = {}) {
    if (!this.config.metrics.enabled) return null;
    
    const metricKey = `${name}_counter`;
    if (!this.metricsStore.has(metricKey)) {
      this.metricsStore.set(metricKey, {
        type: 'counter',
        name,
        help,
        value: 0,
        labels: { ...this.config.metrics.defaultLabels, ...labels },
        data: new Map()
      });
    }
    
    return {
      inc: (value = 1, extraLabels = {}) => {
        const metric = this.metricsStore.get(metricKey);
        const labelKey = JSON.stringify({ ...metric.labels, ...extraLabels });
        
        if (!metric.data.has(labelKey)) {
          metric.data.set(labelKey, 0);
        }
        
        const currentValue = metric.data.get(labelKey);
        metric.data.set(labelKey, currentValue + value);
        metric.value += value;
      }
    };
  }
  
  // 初始化 gauge 指标
  gauge(name, help, labels = {}) {
    if (!this.config.metrics.enabled) return null;
    
    const metricKey = `${name}_gauge`;
    if (!this.metricsStore.has(metricKey)) {
      this.metricsStore.set(metricKey, {
        type: 'gauge',
        name,
        help,
        value: 0,
        labels: { ...this.config.metrics.defaultLabels, ...labels },
        data: new Map()
      });
    }
    
    return {
      set: (value, extraLabels = {}) => {
        const metric = this.metricsStore.get(metricKey);
        const labelKey = JSON.stringify({ ...metric.labels, ...extraLabels });
        
        metric.data.set(labelKey, value);
        metric.value = value;
      },
      inc: (value = 1, extraLabels = {}) => {
        const metric = this.metricsStore.get(metricKey);
        const labelKey = JSON.stringify({ ...metric.labels, ...extraLabels });
        
        const currentValue = metric.data.get(labelKey) || 0;
        metric.data.set(labelKey, currentValue + value);
        metric.value += value;
      },
      dec: (value = 1, extraLabels = {}) => {
        const metric = this.metricsStore.get(metricKey);
        const labelKey = JSON.stringify({ ...metric.labels, ...extraLabels });
        
        const currentValue = metric.data.get(labelKey) || 0;
        metric.data.set(labelKey, currentValue - value);
        metric.value -= value;
      }
    };
  }
  
  // 初始化 histogram 指标
  histogram(name, help, buckets = null, labels = {}) {
    if (!this.config.metrics.enabled) return null;
    
    const metricKey = `${name}_histogram`;
    const finalBuckets = buckets || this.config.metrics.histogramBuckets;
    
    if (!this.metricsStore.has(metricKey)) {
      this.metricsStore.set(metricKey, {
        type: 'histogram',
        name,
        help,
        buckets: finalBuckets,
        sum: 0,
        count: 0,
        labels: { ...this.config.metrics.defaultLabels, ...labels },
        data: new Map()
      });
    }
    
    return {
      observe: (value, extraLabels = {}) => {
        const metric = this.metricsStore.get(metricKey);
        const labelKey = JSON.stringify({ ...metric.labels, ...extraLabels });
        
        if (!metric.data.has(labelKey)) {
          metric.data.set(labelKey, {
            buckets: Object.fromEntries(metric.buckets.map(bucket => [bucket, 0])),
            sum: 0,
            count: 0
          });
        }
        
        const histogramData = metric.data.get(labelKey);
        histogramData.sum += value;
        histogramData.count += 1;
        
        // 更新桶计数
        for (const bucket of metric.buckets) {
          if (value <= bucket) {
            histogramData.buckets[bucket] += 1;
          }
        }
        
        metric.sum += value;
        metric.count += 1;
      }
    };
  }
  
  // 记录函数执行时间
  timing(name, labels = {}) {
    if (!this.config.metrics.enabled) {
      return (target, propertyKey, descriptor) => descriptor;
    }
    
    const originalMethod = descriptor.value;
    const histogram = this.histogram(`${name}_duration`, `${name} execution duration in milliseconds`, null, labels);
    
    descriptor.value = async function(...args) {
      const start = Date.now();
      
      try {
        const result = await originalMethod.apply(this, args);
        const end = Date.now();
        const duration = end - start;
        histogram.observe(duration);
        return result;
      } catch (error) {
        const end = Date.now();
        const duration = end - start;
        histogram.observe(duration);
        throw error;
      }
    };
    
    return descriptor;
  }
  
  // 获取所有指标
  getMetrics() {
    return Array.from(this.metricsStore.values());
  }
  
  // 导出指标为Prometheus格式
  exportMetrics() {
    if (!this.config.metrics.enabled) return '';
    
    let output = '';
    
    for (const metric of this.metricsStore.values()) {
      output += `# HELP ${metric.name} ${metric.help}\n`;
      output += `# TYPE ${metric.name} ${metric.type}\n`;
      
      for (const [labelKey, data] of metric.data.entries()) {
        const labels = JSON.parse(labelKey);
        const labelStr = Object.entries(labels)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',');
        const labelPart = labelStr ? `{${labelStr}}` : '';
        
        if (metric.type === 'counter' || metric.type === 'gauge') {
          output += `${metric.name}${labelPart} ${data}\n`;
        } else if (metric.type === 'histogram') {
          // 输出总和
          output += `${metric.name}_sum${labelPart} ${data.sum}\n`;
          // 输出计数
          output += `${metric.name}_count${labelPart} ${data.count}\n`;
          // 输出桶
          for (const [bucket, count] of Object.entries(data.buckets)) {
            output += `${metric.name}_bucket${labelPart}{le="${bucket}"} ${count}\n`;
          }
        }
      }
      
      output += '\n';
    }
    
    return output;
  }
  
  // 启动指标HTTP服务器
  startMetricsServer(port = 9090) {
    if (!this.config.metrics.enabled) return;
    
    const http = require('http');
    
    const server = http.createServer((req, res) => {
      if (req.url === '/metrics') {
        res.setHeader('Content-Type', 'text/plain');
        res.end(this.exportMetrics());
      } else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    });
    
    server.listen(port, () => {
      this.info(`Metrics server started on port ${port}`);
    });
    
    return server;
  }
  
  // 创建追踪上下文
  createTraceContext(name, parentContext = null) {
    if (!this.config.tracing.enabled) return null;
    
    const traceId = parentContext ? parentContext.traceId : this.generateTraceId();
    const spanId = this.generateSpanId();
    
    const context = {
      traceId,
      spanId,
      parentSpanId: parentContext ? parentContext.spanId : null,
      name,
      startTime: Date.now(),
      endTime: null,
      attributes: {},
      events: [],
      children: []
    };
    
    if (parentContext) {
      parentContext.children.push(context);
    } else {
      this.tracesStore.set(traceId, context);
    }
    
    return context;
  }
  
  // 生成Trace ID
  generateTraceId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  
  // 生成Span ID
  generateSpanId() {
    return Math.random().toString(36).substring(2, 15);
  }
  
  // 结束追踪
  endTrace(context) {
    if (!this.config.tracing.enabled || !context) return;
    
    context.endTime = Date.now();
    
    // 如果是根追踪，保存到存储
    if (!context.parentSpanId) {
      this.tracesStore.set(context.traceId, context);
      
      // 限制追踪存储大小
      if (this.tracesStore.size > 1000) {
        const firstTrace = this.tracesStore.keys().next().value;
        this.tracesStore.delete(firstTrace);
      }
    }
  }
  
  // 添加追踪事件
  addTraceEvent(context, name, attributes = {}) {
    if (!this.config.tracing.enabled || !context) return;
    
    context.events.push({
      name,
      timestamp: Date.now(),
      attributes
    });
  }
  
  // 添加追踪属性
  setTraceAttribute(context, key, value) {
    if (!this.config.tracing.enabled || !context) return;
    
    context.attributes[key] = value;
  }
  
  // 获取所有追踪
  getTraces() {
    return Array.from(this.tracesStore.values());
  }
}

// 创建全局可观测性实例
const observability = new Observability();

// 导出可观测性工具
module.exports = {
  observability,
  // 便捷导出日志方法
  error: (message, data) => observability.error(message, data),
  warn: (message, data) => observability.warn(message, data),
  info: (message, data) => observability.info(message, data),
  debug: (message, data) => observability.debug(message, data),
  trace: (message, data) => observability.trace(message, data),
  
  // 便捷导出指标方法
  counter: (name, help, labels) => observability.counter(name, help, labels),
  gauge: (name, help, labels) => observability.gauge(name, help, labels),
  histogram: (name, help, buckets, labels) => observability.histogram(name, help, buckets, labels),
  timing: (name, labels) => observability.timing(name, labels),
  
  // 便捷导出追踪方法
  createTraceContext: (name, parentContext) => observability.createTraceContext(name, parentContext),
  endTrace: (context) => observability.endTrace(context),
  addTraceEvent: (context, name, attributes) => observability.addTraceEvent(context, name, attributes),
  setTraceAttribute: (context, key, value) => observability.setTraceAttribute(context, key, value),
  
  // 服务器方法
  startMetricsServer: (port) => observability.startMetricsServer(port)
};
