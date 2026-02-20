#!/usr/bin/env node

/**
 * 日志轮转脚本
 * 功能：管理日志文件大小、自动轮转、保留指定数量的历史日志
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// 配置文件路径
const CONFIG_PATH = path.join(__dirname, '../logrotate.config.json');

// 默认配置
const DEFAULT_CONFIG = {
  // 日志文件配置
  logs: [
    {
      filePath: path.join(__dirname, '../logs/monitoring.log'),
      maxSize: 10485760,  // 10MB
      maxFiles: 5,        // 保留5个历史日志文件
      compress: true      // 压缩历史日志文件
    },
    {
      filePath: path.join(__dirname, '../logs/app.log'),
      maxSize: 52428800,  // 50MB
      maxFiles: 3,
      compress: true
    }
  ],
  
  // 轮转频率（毫秒）- 用于定时执行
  interval: 3600000  // 1小时
};

class LogRotateService {
  constructor() {
    this.config = this.loadConfig();
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
      console.error('加载日志轮转配置失败，使用默认配置:', error.message);
      return DEFAULT_CONFIG;
    }
  }
  
  // 获取文件大小
  getFileSize(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        return stats.size;
      }
      return 0;
    } catch (error) {
      console.error(`获取文件大小失败: ${filePath}`, error.message);
      return 0;
    }
  }
  
  // 压缩文件
  compressFile(sourcePath, targetPath) {
    return new Promise((resolve, reject) => {
      const source = fs.createReadStream(sourcePath);
      const target = fs.createWriteStream(targetPath);
      const gzip = zlib.createGzip();
      
      source.pipe(gzip).pipe(target)
        .on('finish', () => {
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }
  
  // 删除文件
  deleteFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`删除文件失败: ${filePath}`, error.message);
      return false;
    }
  }
  
  // 轮转单个日志文件
  async rotateLogFile(logConfig) {
    const { filePath, maxSize, maxFiles, compress } = logConfig;
    
    // 检查日志文件是否存在
    if (!fs.existsSync(filePath)) {
      console.log(`日志文件不存在，跳过轮转: ${filePath}`);
      return;
    }
    
    // 检查日志文件大小
    const fileSize = this.getFileSize(filePath);
    if (fileSize < maxSize) {
      console.log(`日志文件大小未超过阈值，跳过轮转: ${filePath} (${fileSize}/${maxSize} bytes)`);
      return;
    }
    
    console.log(`开始轮转日志文件: ${filePath} (${fileSize}/${maxSize} bytes)`);
    
    // 1. 准备历史日志文件列表
    const logDir = path.dirname(filePath);
    const logFileName = path.basename(filePath);
    const logFileExt = path.extname(logFileName);
    const logFileBase = logFileName.replace(logFileExt, '');
    
    // 2. 检查并删除超过保留数量的历史日志
    const oldLogs = [];
    for (let i = maxFiles; i >= 0; i--) {
      const oldLogPath = `${filePath}.${i}${compress ? '.gz' : ''}`;
      if (fs.existsSync(oldLogPath)) {
        oldLogs.push(oldLogPath);
      }
    }
    
    // 删除超过保留数量的日志文件
    if (oldLogs.length > maxFiles) {
      const logsToDelete = oldLogs.slice(maxFiles);
      for (const logToDelete of logsToDelete) {
        console.log(`删除超过保留数量的日志文件: ${logToDelete}`);
        this.deleteFile(logToDelete);
      }
    }
    
    // 3. 重命名现有历史日志文件
    for (let i = maxFiles - 1; i >= 0; i--) {
      const currentLogPath = `${filePath}.${i}${compress ? '.gz' : ''}`;
      const nextLogPath = `${filePath}.${i + 1}${compress ? '.gz' : ''}`;
      
      if (fs.existsSync(currentLogPath)) {
        console.log(`重命名日志文件: ${currentLogPath} -> ${nextLogPath}`);
        fs.renameSync(currentLogPath, nextLogPath);
      }
    }
    
    // 4. 轮转当前日志文件
    const rotatedLogPath = `${filePath}.1`;
    
    // 重命名当前日志文件
    fs.renameSync(filePath, rotatedLogPath);
    console.log(`重命名当前日志文件: ${filePath} -> ${rotatedLogPath}`);
    
    // 创建新的空日志文件
    fs.writeFileSync(filePath, '');
    console.log(`创建新的日志文件: ${filePath}`);
    
    // 5. 压缩历史日志文件（如果配置了压缩）
    if (compress) {
      try {
        const compressedLogPath = `${rotatedLogPath}.gz`;
        await this.compressFile(rotatedLogPath, compressedLogPath);
        console.log(`压缩日志文件: ${rotatedLogPath} -> ${compressedLogPath}`);
        
        // 删除原始未压缩的日志文件
        this.deleteFile(rotatedLogPath);
      } catch (error) {
        console.error(`压缩日志文件失败: ${rotatedLogPath}`, error.message);
      }
    }
    
    console.log(`日志文件轮转完成: ${filePath}`);
  }
  
  // 执行一次日志轮转
  async runLogRotation() {
    console.log('开始执行日志轮转...');
    
    for (const logConfig of this.config.logs) {
      await this.rotateLogFile(logConfig);
    }
    
    console.log('日志轮转执行完成');
  }
  
  // 启动定时日志轮转
  start() {
    console.log(`启动定时日志轮转服务，间隔: ${this.config.interval}ms`);
    
    // 立即执行一次日志轮转
    this.runLogRotation();
    
    // 设置定时执行
    this.intervalId = setInterval(() => {
      this.runLogRotation();
    }, this.config.interval);
  }
  
  // 停止定时日志轮转
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log('停止日志轮转服务');
    }
  }
}

// 创建日志轮转服务实例
const logRotateService = new LogRotateService();

// 执行日志轮转
logRotateService.runLogRotation();

// 导出日志轮转服务（用于其他模块调用）
module.exports = logRotateService;
