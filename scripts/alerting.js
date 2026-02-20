#!/usr/bin/env node

/**
 * 报警系统
 * 功能：监控指标阈值检查、多种通知方式、报警级别管理
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// 配置文件路径
const CONFIG_PATH = path.join(__dirname, '../alerting.config.json');

// 默认配置
const DEFAULT_CONFIG = {
  // 报警级别配置
  alertLevels: {
    error: {
      name: '错误',
      color: '#FF0000',
      notifyChannels: ['email', 'slack']
    },
    warn: {
      name: '警告',
      color: '#FFA500',
      notifyChannels: ['slack']
    },
    info: {
      name: '信息',
      color: '#0000FF',
      notifyChannels: ['slack']
    }
  },

  // 通知渠道配置
  channels: {
    email: {
      enabled: false,
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.ALERT_EMAIL_USER || 'alert@example.com',
        pass: process.env.ALERT_EMAIL_PASS || ''
      },
      from: process.env.ALERT_EMAIL_FROM || 'alert@example.com',
      to: [process.env.ALERT_EMAIL_TO || 'admin@example.com']
    },
    slack: {
      enabled: false,
      webhookUrl: process.env.SLACK_WEBHOOK_URL || ''
    },
    webhook: {
      enabled: false,
      url: 'https://example.com/webhook'
    }
  },

  // 报警历史配置
  history: {
    enabled: true,
    filePath: path.join(__dirname, '../logs/alerts.log'),
    maxEntries: 1000
  },

  // 报警抑制配置
  suppression: {
    enabled: true,
    cooldownPeriod: 300000  // 5分钟冷却时间，相同报警不会重复发送
  }
};

class AlertingService {
  constructor() {
    this.config = this.loadConfig();
    this.alertHistory = [];
    this.suppressedAlerts = new Map();

    // 加载报警历史
    if (this.config.history.enabled) {
      this.loadAlertHistory();
    }
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
      console.error('加载报警配置失败，使用默认配置:', error.message);
      return DEFAULT_CONFIG;
    }
  }

  // 加载报警历史
  loadAlertHistory() {
    try {
      if (fs.existsSync(this.config.history.filePath)) {
        const content = fs.readFileSync(this.config.history.filePath, 'utf8');
        this.alertHistory = content.split('\n')
          .filter(line => line.trim())
          .map(line => JSON.parse(line))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, this.config.history.maxEntries);
      }
    } catch (error) {
      console.error('加载报警历史失败:', error.message);
      this.alertHistory = [];
    }
  }

  // 保存报警到历史
  saveAlertToHistory(alert) {
    if (!this.config.history.enabled) return;

    try {
      // 添加到内存历史
      this.alertHistory.unshift(alert);

      // 限制历史记录数量
      if (this.alertHistory.length > this.config.history.maxEntries) {
        this.alertHistory = this.alertHistory.slice(0, this.config.history.maxEntries);
      }

      // 写入文件
      const logLine = JSON.stringify(alert) + '\n';
      fs.appendFileSync(this.config.history.filePath, logLine);
    } catch (error) {
      console.error('保存报警历史失败:', error.message);
    }
  }

  // 检查报警是否被抑制
  isAlertSuppressed(alertKey) {
    if (!this.config.suppression.enabled) return false;

    const lastAlertTime = this.suppressedAlerts.get(alertKey);
    if (!lastAlertTime) return false;

    const now = Date.now();
    return (now - lastAlertTime) < this.config.suppression.cooldownPeriod;
  }

  // 设置报警抑制
  suppressAlert(alertKey) {
    if (!this.config.suppression.enabled) return;

    this.suppressedAlerts.set(alertKey, Date.now());
  }

  // 发送HTTP请求
  sendHttpRequest(url, method, headers, data) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = client.request(parsedUrl, options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            body: responseData
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  // 发送Slack通知
  async sendSlackNotification(alert) {
    const channelConfig = this.config.channels.slack;
    if (!channelConfig.enabled) return;

    try {
      const message = {
        text: `[${alert.level.toUpperCase()}] ${alert.title}`,
        attachments: [
          {
            color: this.config.alertLevels[alert.level]?.color || '#000000',
            title: alert.title,
            text: alert.message,
            fields: alert.details ? Object.entries(alert.details).map(([key, value]) => ({
              title: key,
              value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value),
              short: false
            })) : [],
            footer: new Date().toISOString()
          }
        ]
      };

      await this.sendHttpRequest(channelConfig.webhookUrl, 'POST', {}, message);
      console.log('Slack通知发送成功');
    } catch (error) {
      console.error('Slack通知发送失败:', error.message);
    }
  }

  // 发送Webhook通知
  async sendWebhookNotification(alert) {
    const channelConfig = this.config.channels.webhook;
    if (!channelConfig.enabled) return;

    try {
      await this.sendHttpRequest(channelConfig.url, 'POST', {}, alert);
      console.log('Webhook通知发送成功');
    } catch (error) {
      console.error('Webhook通知发送失败:', error.message);
    }
  }

  // 发送报警通知
  async sendAlert(alert) {
    // 验证报警结构
    if (!alert.level || !alert.title || !alert.message) {
      console.error('报警信息不完整:', alert);
      return;
    }

    // 生成报警唯一标识
    const alertKey = `${alert.level}:${alert.title}:${alert.source || 'unknown'}`;

    // 检查报警是否被抑制
    if (this.isAlertSuppressed(alertKey)) {
      console.log(`报警被抑制: ${alertKey}`);
      return;
    }

    // 添加时间戳
    const alertWithTimestamp = {
      ...alert,
      timestamp: new Date().toISOString(),
      source: alert.source || 'system'
    };

    // 保存到历史
    this.saveAlertToHistory(alertWithTimestamp);

    // 设置报警抑制
    this.suppressAlert(alertKey);

    // 获取通知渠道
    const alertLevelConfig = this.config.alertLevels[alert.level] || this.config.alertLevels.info;
    const notifyChannels = alertLevelConfig.notifyChannels;

    // 发送通知
    for (const channel of notifyChannels) {
      switch (channel) {
        case 'slack':
          await this.sendSlackNotification(alertWithTimestamp);
          break;
        case 'webhook':
          await this.sendWebhookNotification(alertWithTimestamp);
          break;
        // 可以扩展其他通知渠道，如email、微信等
        default:
          console.warn(`未知的通知渠道: ${channel}`);
      }
    }

    console.log(`报警发送成功: ${alertWithTimestamp.level} - ${alertWithTimestamp.title}`);
  }

  // 检查监控指标并发送报警
  checkAndAlert(metricName, metricValue, thresholds, tags = {}) {
    let alertLevel = null;
    let alertMessage = '';

    // 检查阈值
    if (metricValue >= thresholds.critical) {
      alertLevel = 'error';
      alertMessage = `${metricName} 达到错误阈值: ${metricValue} >= ${thresholds.critical}`;
    } else if (metricValue >= thresholds.warning) {
      alertLevel = 'warn';
      alertMessage = `${metricName} 达到警告阈值: ${metricValue} >= ${thresholds.warning}`;
    }

    // 如果超过阈值，发送报警
    if (alertLevel) {
      const alert = {
        level: alertLevel,
        title: `${metricName} 报警`,
        message: alertMessage,
        details: {
          metricName,
          metricValue,
          thresholds,
          ...tags
        },
        source: 'monitoring'
      };

      this.sendAlert(alert);
      return alert;
    }

    return null;
  }

  // 测试报警
  testAlert() {
    const testAlert = {
      level: 'info',
      title: '测试报警',
      message: '这是一条测试报警消息',
      details: {
        test: true,
        environment: 'development',
        timestamp: new Date().toISOString()
      },
      source: 'test'
    };

    this.sendAlert(testAlert);
    console.log('测试报警发送完成');
  }
}

// 创建报警服务实例
const alertingService = new AlertingService();

// 导出报警服务（用于其他模块调用）
module.exports = alertingService;

// 如果直接运行脚本，执行测试报警
if (require.main === module) {
  alertingService.testAlert();
}
