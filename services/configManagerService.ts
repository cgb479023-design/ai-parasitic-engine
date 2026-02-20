/**
 * Configuration Management Service
 * 统一管理多环境配置
 */

interface AppConfig {
  environment: 'development' | 'staging' | 'production';
  apiUrl: string;
  apiKey: string;
  debugMode: boolean;
  loggingLevel: 'error' | 'warn' | 'info' | 'debug';
  features: {
    enableAnalytics: boolean;
    enableAutoOptimization: boolean;
    maxVideoDuration: number;
    enableSnapshots: boolean;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  environment: 'development',
  apiUrl: 'http://localhost:4000',
  apiKey: '',
  debugMode: true,
  loggingLevel: 'info',
  features: {
    enableAnalytics: true,
    enableAutoOptimization: true,
    maxVideoDuration: 300,
    enableSnapshots: true
  }
};

const ENVIRONMENT_CONFIGS = {
  development: {
    ...DEFAULT_CONFIG,
    apiUrl: 'http://localhost:4000',
    debugMode: true,
    loggingLevel: 'debug'
  },
  staging: {
    ...DEFAULT_CONFIG,
    apiUrl: 'https://staging-api.example.com',
    debugMode: true,
    loggingLevel: 'info'
  },
  production: {
    ...DEFAULT_CONFIG,
    apiUrl: 'https://api.example.com',
    debugMode: false,
    loggingLevel: 'error'
  }
};

export class ConfigManager {
  private currentConfig: AppConfig = { ...DEFAULT_CONFIG };

  /**
   * 加载配置
   */
  async loadConfig(): Promise<AppConfig> {
    const configPath = '.app-config.json';
    const fs = require('fs').promises;

    try {
      // 1. 检查命令行环境变量
      const env = process.env.NODE_ENV || process.env.ENVIRONMENT || 'development';
      
      // 2. 加载环境特定配置
      const envConfig = ENVIRONMENT_CONFIGS[env] || DEFAULT_CONFIG;
      
      // 3. 加载用户自定义配置（如果有）
      if (fs.existsSync(configPath)) {
        const userConfig = JSON.parse(await fs.readFile(configPath, 'utf8'));
        this.currentConfig = { ...envConfig, ...userConfig };
        console.log(`📦 Loaded config for environment: ${env}`);
      } else {
        this.currentConfig = envConfig;
        console.log(`📦 Loaded default config for environment: ${env}`);
      }

      // 4. 验证配置
      this.validateConfig(this.currentConfig);

      return this.currentConfig;
    } catch (error) {
      console.error('❌ Failed to load config:', error);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * 保存配置
   */
  async saveConfig(config: Partial<AppConfig>): Promise<void> {
    this.currentConfig = { ...this.currentConfig, ...config };
    
    try {
      const fs = require('fs').promises;
      const configPath = '.app-config.json';
      
      await fs.writeFile(configPath, JSON.stringify(this.currentConfig, null, 2));
      console.log('💾 Config saved successfully');
      
      // 同步到 Chrome Storage（如果在扩展环境中）
      this.syncToChromeStorage(this.currentConfig);
    } catch (error) {
      console.error('❌ Failed to save config:', error);
    }
  }

  /**
   * 切换环境
   */
  async switchEnvironment(env: 'development' | 'staging' | 'production'): Promise<void> {
    console.log(`\n🔄 Switching to ${env} environment...`);

    // 1. 保存当前配置
    const envKey = `config_${Date.now()}`;
    localStorage.setItem(envKey, JSON.stringify(this.currentConfig));

    // 2. 切换到新环境
    const newConfig = await this.loadConfig();
    
    // 3. 更新当前环境
    newConfig.environment = env;

    // 4. 保存新配置
    await this.saveConfig(newConfig);

    console.log(`✅ Switched to ${env} environment`);
    console.log(`   API URL: ${newConfig.apiUrl}`);
    console.log(`   Debug Mode: ${newConfig.debugMode}`);
  }

  /**
   * 验证配置
   */
  private validateConfig(config: AppConfig): void {
    // 验证必需字段
    if (!config.apiUrl || !config.apiKey) {
      console.warn('⚠️  Invalid configuration: missing apiUrl or apiKey');
    }

    // 验证 URL 格式
    try {
      new URL(config.apiUrl);
    } catch {
      console.error('❌ Invalid API URL:', config.apiUrl);
    }

    // 验证环境值
    const validEnvs = ['development', 'staging', 'production'];
    if (!validEnvs.includes(config.environment)) {
      console.error('❌ Invalid environment:', config.environment);
    }
  }

  /**
   * 同步到 Chrome Storage
   */
  private syncToChromeStorage(config: AppConfig): void {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.managed) {
      chrome.storage.managed.set({
        environment: config.environment,
        apiUrl: config.apiUrl,
        features: config.features
      }).then(() => {
        console.log('📦 Config synced to Chrome Storage');
      }).catch(error => {
        console.error('❌ Failed to sync config:', error);
      });
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): AppConfig {
    return this.currentConfig;
  }

  /**
   * 获取特定配置项
   */
  get(key: keyof AppConfig): any {
    return this.currentConfig[key];
  }

  /**
   * 更新特定配置项
   */
  async set(key: keyof AppConfig, value: any): Promise<void> {
    this.currentConfig[key] = value;
    await this.saveConfig(this.currentConfig);
    console.log(`✅ Updated ${key}:`, value);
  }

  /**
   * 重置为默认配置
   */
  async resetToDefaults(): Promise<void> {
    this.currentConfig = { ...DEFAULT_CONFIG };
    await this.saveConfig(this.currentConfig);
    console.log('🔄 Config reset to defaults');
  }

  /**
   * 导出配置
   */
  exportConfig(): string {
    const config = this.getConfig();
    
    return JSON.stringify(config, null, 2);
  }

  /**
   * 导入配置
   */
  async importConfig(configJson: string): Promise<void> {
    try {
      const config = JSON.parse(configJson);
      this.currentConfig = config;
      await this.saveConfig(this.currentConfig);
      console.log('✅ Config imported successfully');
    } catch (error) {
      console.error('❌ Failed to import config:', error);
    }
  }

  /**
   * 生成环境特定配置
   */
  generateEnvironmentConfig(env: 'development' | 'staging' | 'production'): Partial<AppConfig> {
    const envConfig = ENVIRONMENT_CONFIGS[env];
    
    return {
      environment: env,
      ...envConfig
    };
  }
}

// 导出单例实例
export const configManager = new ConfigManager();
