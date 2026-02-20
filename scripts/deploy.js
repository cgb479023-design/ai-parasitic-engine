#!/usr/bin/env node

/**
 * Automated Deployment Service
 * 一键部署到多个平台，支持多环境
 */

interface DeploymentTarget {
  id: string;
  name: string;
  type: 'production' | 'staging' | 'github-pages';
  url: string;
  deployScript: string;
}

interface DeploymentConfig {
  environments: {
    production: DeploymentTarget;
    staging: DeploymentTarget;
    githubPages: DeploymentTarget;
  };
  preDeployCommands: string[];
  postDeployCommands: string[];
  autoCommit: boolean;
  rollbackOnFailure: boolean;
}

const DEPLOYMENT_TARGETS: DeploymentTarget[] = [
  {
    id: 'production',
    name: 'Production Server',
    type: 'production',
    url: 'https://your-production-server.com',
    deployScript: 'rsync -avz --delete ./dist/ user@production-server:/var/www/app'
  },
  {
    id: 'staging',
    name: 'Staging Environment',
    type: 'staging',
    url: 'https://staging.your-app.com',
    deployScript: 'rsync -avz --delete ./dist/ user@staging:/var/www/app'
  },
  {
    id: 'github-pages',
    name: 'GitHub Pages',
    type: 'github-pages',
    url: 'https://your-org.github.io/your-repo',
    deployScript: 'npm run build && npm run deploy:gh-pages'
  }
];

const DEFAULT_CONFIG: DeploymentConfig = {
  environments: {
    production: DEPLOYMENT_TARGETS[0],
    staging: DEPLOYMENT_TARGETS[1],
    githubPages: DEPLOYMENT_TARGETS[2]
  },
  preDeployCommands: [
    'npm run test',           // 运行所有测试
    'npm run type-check',       // 类型检查
    'npm run lint'            // 代码检查
    'npm run verify:golden full' // 黄金功能验证
  ],
  postDeployCommands: [
    'npm run notify:success', // 部署成功通知
    'npm run health:check'     // 健康检查
  ],
  autoCommit: true,
  rollbackOnFailure: true
};

export class DeploymentService {
  private config: DeploymentConfig = DEFAULT_CONFIG;
  private deploymentHistory: Map<string, any> = new Map();
  private isDeploying: boolean = false;

  /**
   * 加载配置
   */
  loadConfig(): DeploymentConfig {
    try {
      const fs = require('fs');
      const configPath = '.deploy.config.json';
      
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        this.config = JSON.parse(content);
        console.log('📦 Deployment config loaded');
      } else {
        this.config = DEFAULT_CONFIG;
        console.log('📦 Using default deployment config');
      }
      
      return this.config;
    } catch (error) {
      console.error('❌ Failed to load deployment config:', error);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * 保存配置
   */
  saveConfig(): void {
    try {
      const fs = require('fs');
      const configPath = '.deploy.config.json';
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
      console.log('💾 Deployment config saved');
    } catch (error) {
      console.error('❌ Failed to save deployment config:', error);
    }
  }

  /**
   * 部署到指定环境
   */
  async deploy(environment: 'production' | 'staging' | 'github-pages'): Promise<{
    success: boolean;
    message: string;
    target: DeploymentTarget;
  }> {
    if (this.isDeploying) {
      return {
        success: false,
        message: 'Deployment already in progress',
        target: this.config.environments[environment]
      };
    }

    this.isDeploying = true;

    try {
      const target = this.config.environments[environment];
      
      console.log(`\n🚀 Starting deployment to ${environment}...`);
      console.log(`   Target: ${target.name}`);
      console.log(`   URL: ${target.url}`);

      // 1. 部署前命令
      console.log('\n📋 Running pre-deploy commands...');
      for (const cmd of this.config.preDeployCommands) {
        console.log(`   ${cmd}`);
        const result = this.runCommand(cmd);
        if (!result.success) {
          this.isDeploying = false;
          return {
            success: false,
            message: `Pre-deploy command failed: ${cmd}\n${result.message}`,
            target
          };
        }
      }

      // 2. 构建项目
      console.log('\n🔨 Building project...');
      const buildResult = this.runCommand('npm run build');
      if (!buildResult.success) {
        this.isDeploying = false;
        return {
          success: false,
          message: `Build failed: ${buildResult.message}`,
          target
        };
      }

      // 3. 自动提交（如果启用）
      if (this.config.autoCommit) {
        console.log('💾 Committing changes...');
        this.runCommand('git add -A');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const message = `Deploy to ${environment} [${timestamp}]`;
        this.runCommand(`git commit -m "${message}"`);
      }

      // 4. 执行部署脚本
      console.log('\n📤 Deploying...');
      const deployResult = this.runCommand(target.deployScript);
      
      if (!deployResult.success) {
        this.isDeploying = false;
        
        // 部署失败，回滚
        if (this.config.rollbackOnFailure) {
          console.log('🔄 Rolling back deployment...');
          this.runCommand('git reset --hard HEAD~1');
        }

        return {
          success: false,
          message: `Deployment failed: ${deployResult.message}`,
          target
        };
      }

      // 5. 部署后命令
      console.log('\n📋 Running post-deploy commands...');
      for (const cmd of this.config.postDeployCommands) {
        console.log(`   ${cmd}`);
        const result = this.runCommand(cmd);
        if (!result.success) {
          console.warn(`   ⚠️ Post-deploy command warning: ${cmd}`);
        }
      }

      // 记录部署历史
      const deploymentRecord = {
        timestamp: new Date().toISOString(),
        environment,
        target: target.name,
        success: true,
        duration: Date.now()
      };
      
      this.deploymentHistory.set(deploymentRecord.timestamp, deploymentRecord);
      this.saveDeploymentHistory();

      console.log('\n' + '='.repeat(60));
      console.log('✅ Deployment successful!');
      console.log(`   Target: ${target.name}`);
      console.log(`   URL: ${target.url}`);

      this.isDeploying = false;

      return {
        success: true,
        message: `Successfully deployed to ${target.name}`,
        target
      };
      
    } catch (error) {
      this.isDeploying = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        message: `Deployment error: ${errorMessage}`,
        target: this.config.environments[environment]
      };
    }
  }

  /**
   * 执行命令
   */
  private runCommand(command: string): {
    success: boolean;
    message: string;
  } {
    try {
      const execSync = require('child_process').execSync;
      const result = execSync(command, { 
        cwd: process.cwd(),
        stdio: ['inherit', 'inherit']
      });
      
      return {
        success: true,
        message: 'Command executed successfully'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Command failed: ${command}`);
      console.error(`   Error: ${errorMessage}`);
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * 快速部署（跳过测试）
   */
  async quickDeploy(environment: 'production' | 'staging' | 'github-pages'): Promise<{
    success: boolean;
    message: string;
    target: DeploymentTarget;
  }> {
    const originalPreCommands = [...this.config.preDeployCommands];
    const originalAutoCommit = this.config.autoCommit;

    // 临时跳过测试
    this.config.preDeployCommands = [];
    this.config.autoCommit = false;

    const result = await this.deploy(environment);

    // 恢复配置
    this.config.preDeployCommands = originalPreCommands;
    this.config.autoCommit = originalAutoCommit;

    return result;
  }

  /**
   * 获取部署历史
   */
  getDeploymentHistory(limit: number = 10): any[] {
    const history = Array.from(this.deploymentHistory.values());
    
    // 按时间倒序
    history.sort((a, b) => b.timestamp - a.timestamp);

    // 限制数量
    if (limit > 0 && history.length > limit) {
      return history.slice(0, limit);
    }

    return history;
  }

  /**
   * 保存部署历史
   */
  private saveDeploymentHistory(): void {
    try {
      const fs = require('fs');
      const historyPath = '.deployment-history.json';
      const history = this.getDeploymentHistory(0);
      
      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
      console.log('💾 Deployment history saved');
    } catch (error) {
      console.error('❌ Failed to save deployment history:', error);
    }
  }

  /**
   * 获取部署配置
   */
  getConfig(): DeploymentConfig {
    return this.config;
  }

  /**
   * 获取可用的部署目标
   */
  getAvailableTargets(): DeploymentTarget[] {
    return DEPLOYMENT_TARGETS;
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<DeploymentConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  /**
   * 清除部署历史
   */
  clearDeploymentHistory(): void {
    this.deploymentHistory.clear();
    this.saveDeploymentHistory();
    console.log('🧹 Deployment history cleared');
  }
}

// 导出单例实例
export const deploymentService = new DeploymentService();