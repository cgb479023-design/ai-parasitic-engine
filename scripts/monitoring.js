#!/usr/bin/env node

/**
 * 系统监控脚本
 * 功能：进程监控、CPU内存监控、服务健康检查
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const { execSync } = require('child_process');

// 配置文件路径
const CONFIG_PATH = path.join(__dirname, '../monitoring.config.json');

// 默认配置
const DEFAULT_CONFIG = {
  // 监控频率（毫秒）
  interval: 5000,
  
  // 进程监控配置
  processes: [
    {
      name: 'node',
      checkCommand: 'node --version',
      critical: true
    }
  ],
  
  // 服务健康检查配置
  services: [
    {
      name: 'Local Development Server',
      url: 'http://localhost:3000',
      timeout: 5000,
      critical: true
    }
  ],
  
  // CPU和内存阈值配置
  thresholds: {
    cpu: {
      warning: 70,  // 警告阈值（百分比）
      critical: 90  // 严重阈值（百分比）
    },
    memory: {
      warning: 70,  // 警告阈值（百分比）
      critical: 90  // 严重阈值（百分比）
    }
  },
  
  // 日志配置
  logging: {
    enabled: true,
    level: 'info',  // error, warn, info, debug
    filePath: path.join(__dirname, '../logs/monitoring.log'),
    maxSize: 10485760,  // 10MB
    maxFiles: 5
  }
};

// 日志级别
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

class MonitoringService {
  constructor() {
    this.config = this.loadConfig();
    this.logger = this.createLogger();
    this.startTime = Date.now();
    
    // 确保日志目录存在
    this.ensureLogDirectory();
    
    this.logger.info('监控服务启动');
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
      console.error('加载配置失败，使用默认配置:', error.message);
      return DEFAULT_CONFIG;
    }
  }
  
  // 创建日志记录器
  createLogger() {
    const logLevel = LOG_LEVELS[this.config.logging.level] || LOG_LEVELS.info;
    
    const logger = {
      error: (message, data) => this.log('error', message, data),
      warn: (message, data) => this.log('warn', message, data),
      info: (message, data) => this.log('info', message, data),
      debug: (message, data) => this.log('debug', message, data)
    };
    
    return logger;
  }
  
  // 日志记录
  log(level, message, data = {}) {
    if (!this.config.logging.enabled) return;
    
    const logLevel = LOG_LEVELS[level] || LOG_LEVELS.info;
    if (logLevel > LOG_LEVELS[this.config.logging.level]) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...data
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    
    try {
      fs.appendFileSync(this.config.logging.filePath, logLine);
      // 控制台输出
      console.log(`${timestamp} [${level.toUpperCase()}] ${message}`, data);
    } catch (error) {
      console.error('日志写入失败:', error.message);
    }
  }
  
  // 确保日志目录存在
  ensureLogDirectory() {
    const logDir = path.dirname(this.config.logging.filePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }
  
  // 获取系统CPU使用率
  getSystemCpuUsage() {
    try {
      if (os.platform() === 'win32') {
        // Windows系统
        const output = execSync('wmic cpu get LoadPercentage').toString();
        const match = output.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
      } else {
        // Unix/Linux系统
        const output = execSync('top -bn1 | grep "%Cpu(s)"').toString();
        const match = output.match(/\d+\.\d+/);
        return match ? parseFloat(match[0]) : 0;
      }
    } catch (error) {
      this.logger.error('获取CPU使用率失败:', error.message);
      return 0;
    }
  }
  
  // 获取系统内存使用率
  getSystemMemoryUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    return Math.round((usedMemory / totalMemory) * 100);
  }
  
  // 检查进程是否在运行
  checkProcess(processName) {
    try {
      if (os.platform() === 'win32') {
        // Windows系统
        const output = execSync(`tasklist | findstr /i ${processName}`).toString();
        return output.includes(processName);
      } else {
        // Unix/Linux系统
        const output = execSync(`pgrep -l ${processName}`).toString();
        return output.length > 0;
      }
    } catch (error) {
      return false;
    }
  }
  
  // 检查服务健康状态
  checkServiceHealth(service) {
    return new Promise((resolve) => {
      const url = new URL(service.url);
      const client = url.protocol === 'https:' ? https : http;
      
      const options = {
        method: 'GET',
        timeout: service.timeout
      };
      
      const startTime = Date.now();
      
      const request = client.request(url, options, (response) => {
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        const result = {
          name: service.name,
          url: service.url,
          status: 'up',
          statusCode: response.statusCode,
          latency,
          timestamp: new Date().toISOString()
        };
        
        resolve(result);
      });
      
      request.on('error', (error) => {
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        const result = {
          name: service.name,
          url: service.url,
          status: 'down',
          error: error.message,
          latency,
          timestamp: new Date().toISOString()
        };
        
        resolve(result);
      });
      
      request.on('timeout', () => {
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        const result = {
          name: service.name,
          url: service.url,
          status: 'timeout',
          error: 'Request timed out',
          latency,
          timestamp: new Date().toISOString()
        };
        
        request.destroy();
        resolve(result);
      });
      
      request.end();
    });
  }
  
  // 获取系统负载（仅Unix/Linux系统）
  getSystemLoad() {
    if (os.platform() !== 'win32') {
      return os.loadavg();
    }
    return [0, 0, 0];
  }
  
  // 执行一次监控
  async runMonitoring() {
    const timestamp = new Date().toISOString();
    
    // 1. 系统资源监控
    const cpuUsage = this.getSystemCpuUsage();
    const memoryUsage = this.getSystemMemoryUsage();
    const loadAvg = this.getSystemLoad();
    
    // 检查CPU和内存阈值
    if (cpuUsage >= this.config.thresholds.cpu.critical) {
      this.logger.error('CPU使用率超过严重阈值', {
        cpuUsage,
        threshold: this.config.thresholds.cpu.critical
      });
    } else if (cpuUsage >= this.config.thresholds.cpu.warning) {
      this.logger.warn('CPU使用率超过警告阈值', {
        cpuUsage,
        threshold: this.config.thresholds.cpu.warning
      });
    }
    
    if (memoryUsage >= this.config.thresholds.memory.critical) {
      this.logger.error('内存使用率超过严重阈值', {
        memoryUsage,
        threshold: this.config.thresholds.memory.critical
      });
    } else if (memoryUsage >= this.config.thresholds.memory.warning) {
      this.logger.warn('内存使用率超过警告阈值', {
        memoryUsage,
        threshold: this.config.thresholds.memory.warning
      });
    }
    
    // 记录系统资源使用情况
    this.logger.info('系统资源监控', {
      cpuUsage,
      memoryUsage,
      loadAvg,
      timestamp
    });
    
    // 2. 进程监控
    for (const processConfig of this.config.processes) {
      const isRunning = this.checkProcess(processConfig.name);
      
      if (!isRunning) {
        if (processConfig.critical) {
          this.logger.error(`关键进程未运行: ${processConfig.name}`);
        } else {
          this.logger.warn(`进程未运行: ${processConfig.name}`);
        }
      } else {
        this.logger.debug(`进程正常运行: ${processConfig.name}`);
      }
    }
    
    // 3. 服务健康检查
    for (const service of this.config.services) {
      const healthResult = await this.checkServiceHealth(service);
      
      if (healthResult.status !== 'up') {
        if (service.critical) {
          this.logger.error(`关键服务异常: ${service.name}`, healthResult);
        } else {
          this.logger.warn(`服务异常: ${service.name}`, healthResult);
        }
      } else {
        this.logger.debug(`服务正常: ${service.name}`, {
          name: service.name,
          latency: healthResult.latency,
          statusCode: healthResult.statusCode
        });
      }
    }
  }
  
  // 启动监控
  start() {
    this.logger.info('监控服务启动', {
      interval: this.config.interval,
      processes: this.config.processes.length,
      services: this.config.services.length
    });
    
    // 立即执行一次监控
    this.runMonitoring();
    
    // 设置定时执行
    this.intervalId = setInterval(() => {
      this.runMonitoring();
    }, this.config.interval);
  }
  
  // 停止监控
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.logger.info('监控服务停止');
    }
  }
}

// 创建监控服务实例
const monitoringService = new MonitoringService();

// 启动监控
monitoringService.start();

// 处理退出信号
process.on('SIGINT', () => {
  monitoringService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  monitoringService.stop();
  process.exit(0);
});

// 导出监控服务（用于其他模块调用）
module.exports = monitoringService;
