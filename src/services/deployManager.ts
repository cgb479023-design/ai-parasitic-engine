import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

// 定义分阶段部署相关接口
export interface DeploymentConfig {
  environments: EnvironmentConfig[];
  deploymentSteps: DeploymentStep[];
  rollbackStrategy: RollbackStrategy;
  notificationSettings: NotificationSettings;
  approvalSettings: ApprovalSettings;
}

export interface EnvironmentConfig {
  name: 'development' | 'testing' | 'staging' | 'production';
  url: string;
  apiKey?: string;
  deployPath: string;
  branch: string;
  isProtected: boolean;
  autoDeploy: boolean;
}

export interface DeploymentStep {
  id: string;
  name: string;
  description: string;
  command: string;
  required: boolean;
  timeout: number;
  onSuccess?: string;
  onFailure?: string;
  environment?: 'development' | 'testing' | 'staging' | 'production';
}

export interface RollbackStrategy {
  type: 'auto' | 'manual';
  backupEnabled: boolean;
  backupPath: string;
  maxBackups: number;
  rollbackSteps: DeploymentStep[];
}

export interface NotificationSettings {
  enabled: boolean;
  channels: NotificationChannel[];
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  notifyOnRollback: boolean;
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook';
  config: any;
}

export interface ApprovalSettings {
  enabled: boolean;
  requiredEnvironments: ('development' | 'testing' | 'staging' | 'production')[];
  approvers: string[];
  autoApproveAfterHours?: number;
}

export interface Deployment {
  id: string;
  fixId: string;
  status: 'pending' | 'in-progress' | 'deployed' | 'failed' | 'rolled-back';
  environment: 'development' | 'testing' | 'staging' | 'production';
  version: string;
  deployedBy: string;
  deployDate: Date;
  rollbackDate?: Date;
  commitHash: string;
  steps: DeploymentStepResult[];
  logs: string[];
  metrics: DeploymentMetrics;
}

export interface DeploymentStepResult {
  stepId: string;
  name: string;
  status: 'success' | 'failure' | 'skipped';
  startTime: Date;
  endTime: Date;
  duration: number;
  output: string;
  error?: string;
}

export interface DeploymentMetrics {
  deploymentTime: number;
  rollbackTime?: number;
  errorRate: number;
  successRate: number;
  performanceImpact: number;
  userImpact: number;
}

export interface DeployManagerConfig {
  configPath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  dryRun: boolean;
}

/**
 * 分阶段部署管理服务
 * 支持分阶段部署修复，先在测试环境验证，再应用到生产环境
 */
export class DeployManager {
  private readonly config: DeployManagerConfig;
  private deploymentConfig: DeploymentConfig;

  constructor(config?: Partial<DeployManagerConfig>) {
    this.config = {
      configPath: config?.configPath || 'deploy-config.json',
      logLevel: config?.logLevel || 'info',
      dryRun: config?.dryRun || false
    };

    this.deploymentConfig = this.loadDeploymentConfig();
  }

  /**
   * 加载部署配置
   */
  private loadDeploymentConfig(): DeploymentConfig {
    try {
      if (fs.existsSync(this.config.configPath)) {
        const configContent = fs.readFileSync(this.config.configPath, 'utf8');
        return JSON.parse(configContent);
      }
      return this.getDefaultDeploymentConfig();
    } catch (error) {
      console.error('Failed to load deployment config:', error);
      return this.getDefaultDeploymentConfig();
    }
  }

  /**
   * 获取默认部署配置
   */
  private getDefaultDeploymentConfig(): DeploymentConfig {
    return {
      environments: [
        {
          name: 'development',
          url: 'http://localhost:4000',
          deployPath: './dist',
          branch: 'main',
          isProtected: false,
          autoDeploy: true
        },
        {
          name: 'testing',
          url: 'https://test.example.com',
          deployPath: '/opt/app/test',
          branch: 'main',
          isProtected: false,
          autoDeploy: true
        },
        {
          name: 'staging',
          url: 'https://staging.example.com',
          deployPath: '/opt/app/staging',
          branch: 'staging',
          isProtected: true,
          autoDeploy: false
        },
        {
          name: 'production',
          url: 'https://example.com',
          deployPath: '/opt/app/production',
          branch: 'production',
          isProtected: true,
          autoDeploy: false
        }
      ],
      deploymentSteps: [
        {
          id: 'step_1',
          name: 'Build Project',
          description: 'Build the project for deployment',
          command: 'npm run build',
          required: true,
          timeout: 300
        },
        {
          id: 'step_2',
          name: 'Run Tests',
          description: 'Run tests to verify the build',
          command: 'npm run test',
          required: true,
          timeout: 300
        },
        {
          id: 'step_3',
          name: 'Deploy to Server',
          description: 'Deploy the build to the server',
          command: 'npm run deploy',
          required: true,
          timeout: 600
        },
        {
          id: 'step_4',
          name: 'Verify Deployment',
          description: 'Verify the deployment is working',
          command: 'npm run verify',
          required: true,
          timeout: 300
        }
      ],
      rollbackStrategy: {
        type: 'auto',
        backupEnabled: true,
        backupPath: './backups',
        maxBackups: 10,
        rollbackSteps: [
          {
            id: 'rollback_1',
            name: 'Stop Application',
            description: 'Stop the application before rollback',
            command: 'npm run stop',
            required: true,
            timeout: 120
          },
          {
            id: 'rollback_2',
            name: 'Restore Backup',
            description: 'Restore from backup',
            command: 'npm run restore',
            required: true,
            timeout: 600
          },
          {
            id: 'rollback_3',
            name: 'Start Application',
            description: 'Start the application after rollback',
            command: 'npm run start',
            required: true,
            timeout: 120
          },
          {
            id: 'rollback_4',
            name: 'Verify Rollback',
            description: 'Verify the rollback is working',
            command: 'npm run verify',
            required: true,
            timeout: 300
          }
        ]
      },
      notificationSettings: {
        enabled: true,
        channels: [
          {
            type: 'email',
            config: {
              recipients: ['team@example.com'],
              subject: 'Deployment Notification'
            }
          }
        ],
        notifyOnSuccess: true,
        notifyOnFailure: true,
        notifyOnRollback: true
      },
      approvalSettings: {
        enabled: true,
        requiredEnvironments: ['staging', 'production'],
        approvers: ['admin@example.com', 'lead@example.com'],
        autoApproveAfterHours: 24
      }
    };
  }

  /**
   * 保存部署配置
   */
  saveDeploymentConfig(config: DeploymentConfig): void {
    try {
      fs.writeFileSync(this.config.configPath, JSON.stringify(config, null, 2), 'utf8');
      this.deploymentConfig = config;
      console.log('Deployment config saved successfully');
    } catch (error) {
      console.error('Failed to save deployment config:', error);
      throw error;
    }
  }

  /**
   * 部署到指定环境
   */
  async deployToEnvironment(
    environment: 'development' | 'testing' | 'staging' | 'production',
    fixId: string,
    commitHash: string,
    deployedBy: string
  ): Promise<Deployment> {
    console.log(`Deploying to ${environment} environment...`);

    // 检查环境是否存在
    const envConfig = this.deploymentConfig.environments.find(env => env.name === environment);
    if (!envConfig) {
      throw new Error(`Environment ${environment} not found in deployment config`);
    }

    // 检查是否需要人工审批
    if (envConfig.isProtected && this.deploymentConfig.approvalSettings.enabled) {
      const approvalRequired = this.deploymentConfig.approvalSettings.requiredEnvironments.includes(environment);
      if (approvalRequired) {
        console.log(`Manual approval required for deployment to ${environment}`);
        // 这里应该实现审批逻辑，暂时跳过
      }
    }

    // 创建部署记录
    const deployment: Deployment = {
      id: `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fixId,
      status: 'in-progress',
      environment,
      version: this.generateVersion(),
      deployedBy,
      deployDate: new Date(),
      commitHash,
      steps: [],
      logs: [`Deployment started at ${new Date().toISOString()}`],
      metrics: {
        deploymentTime: 0,
        errorRate: 0,
        successRate: 0,
        performanceImpact: 0,
        userImpact: 0
      }
    };

    try {
      // 执行部署步骤
      for (const step of this.deploymentConfig.deploymentSteps) {
        // 检查步骤是否适用于当前环境
        if (step.environment && step.environment !== environment) {
          continue;
        }

        const stepResult = await this.executeDeploymentStep(step, environment);
        deployment.steps.push(stepResult);
        deployment.logs.push(`Step ${step.name}: ${stepResult.status}`);

        if (stepResult.status === 'failure' && step.required) {
          deployment.status = 'failed';
          deployment.logs.push(`Deployment failed at step ${step.name}`);
          await this.notifyDeploymentStatus(deployment);
          return deployment;
        }
      }

      // 部署成功
      deployment.status = 'deployed';
      deployment.logs.push(`Deployment completed successfully at ${new Date().toISOString()}`);
      deployment.metrics.deploymentTime = this.calculateDeploymentTime(deployment);

      // 发送成功通知
      await this.notifyDeploymentStatus(deployment);

      return deployment;
    } catch (error) {
      deployment.status = 'failed';
      deployment.logs.push(`Deployment failed with error: ${error.message}`);
      await this.notifyDeploymentStatus(deployment);
      return deployment;
    }
  }

  /**
   * 执行单个部署步骤
   */
  private async executeDeploymentStep(step: DeploymentStep, environment: string): Promise<DeploymentStepResult> {
    const startTime = new Date();

    console.log(`Executing step: ${step.name} for ${environment} environment`);

    try {
      // 执行命令
      const result = await this.executeCommand(step.command, step.timeout);

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        stepId: step.id,
        name: step.name,
        status: 'success',
        startTime,
        endTime,
        duration,
        output: result.stdout
      };
    } catch (error: any) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        stepId: step.id,
        name: step.name,
        status: 'failure',
        startTime,
        endTime,
        duration,
        output: error.stdout || '',
        error: error.stderr || error.message
      };
    }
  }

  /**
   * 执行命令
   */
  private executeCommand(command: string, timeout: number): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const child = child_process.exec(command, {
        timeout: timeout * 1000,
        cwd: process.cwd()
      });

      child.stdout?.on('data', (data) => {
        stdout += data;
      });

      child.stderr?.on('data', (data) => {
        stderr += data;
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 回滚部署
   */
  async rollbackDeployment(deploymentId: string): Promise<Deployment> {
    console.log(`Rolling back deployment ${deploymentId}...`);

    // 这里应该从数据库或文件中获取部署记录
    // 暂时创建一个模拟的部署记录
    const deployment: Deployment = {
      id: deploymentId,
      fixId: 'fix_123',
      status: 'in-progress',
      environment: 'production',
      version: '1.0.0',
      deployedBy: 'admin',
      deployDate: new Date(Date.now() - 3600000), // 1小时前
      rollbackDate: new Date(),
      commitHash: 'abc123',
      steps: [],
      logs: [`Rollback started at ${new Date().toISOString()}`],
      metrics: {
        deploymentTime: 300000,
        rollbackTime: 0,
        errorRate: 0,
        successRate: 0,
        performanceImpact: 0,
        userImpact: 0
      }
    };

    try {
      // 执行回滚步骤
      for (const step of this.deploymentConfig.rollbackStrategy.rollbackSteps) {
        const stepResult = await this.executeDeploymentStep(step, deployment.environment);
        deployment.steps.push(stepResult);
        deployment.logs.push(`Rollback step ${step.name}: ${stepResult.status}`);

        if (stepResult.status === 'failure' && step.required) {
          deployment.status = 'failed';
          deployment.logs.push(`Rollback failed at step ${step.name}`);
          await this.notifyDeploymentStatus(deployment);
          return deployment;
        }
      }

      // 回滚成功
      deployment.status = 'rolled-back';
      deployment.rollbackDate = new Date();
      deployment.logs.push(`Rollback completed successfully at ${new Date().toISOString()}`);
      deployment.metrics.rollbackTime = this.calculateDeploymentTime(deployment);

      // 发送回滚通知
      await this.notifyDeploymentStatus(deployment);

      return deployment;
    } catch (error) {
      deployment.status = 'failed';
      deployment.logs.push(`Rollback failed with error: ${error.message}`);
      await this.notifyDeploymentStatus(deployment);
      return deployment;
    }
  }

  /**
   * 生成版本号
   */
  private generateVersion(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    return `${year}.${month}.${day}.${hour}${minute}`;
  }

  /**
   * 计算部署时间
   */
  private calculateDeploymentTime(deployment: Deployment): number {
    if (deployment.steps.length === 0) return 0;

    const firstStep = deployment.steps[0];
    const lastStep = deployment.steps[deployment.steps.length - 1];
    return lastStep.endTime.getTime() - firstStep.startTime.getTime();
  }

  /**
   * 发送部署状态通知
   */
  private async notifyDeploymentStatus(deployment: Deployment): Promise<void> {
    if (!this.deploymentConfig.notificationSettings.enabled) {
      return;
    }

    // 根据部署状态决定是否发送通知
    const shouldNotify =
      (deployment.status === 'deployed' && this.deploymentConfig.notificationSettings.notifyOnSuccess) ||
      (deployment.status === 'failed' && this.deploymentConfig.notificationSettings.notifyOnFailure) ||
      (deployment.status === 'rolled-back' && this.deploymentConfig.notificationSettings.notifyOnRollback);

    if (!shouldNotify) {
      return;
    }

    // 发送通知到所有配置的渠道
    for (const channel of this.deploymentConfig.notificationSettings.channels) {
      try {
        await this.sendNotification(channel, deployment);
      } catch (error) {
        console.error(`Failed to send notification via ${channel.type}:`, error);
      }
    }
  }

  /**
   * 发送通知
   */
  private async sendNotification(channel: NotificationChannel, deployment: Deployment): Promise<void> {
    switch (channel.type) {
      case 'email':
        // 实现邮件通知逻辑
        console.log(`Sending email notification for deployment ${deployment.id}`);
        break;
      case 'slack':
        // 实现Slack通知逻辑
        console.log(`Sending Slack notification for deployment ${deployment.id}`);
        break;
      case 'webhook':
        // 实现Webhook通知逻辑
        console.log(`Sending webhook notification for deployment ${deployment.id}`);
        break;
      default:
        console.log(`Unknown notification channel type: ${channel.type}`);
    }
  }

  /**
   * 获取部署历史
   */
  getDeploymentHistory(environment?: 'development' | 'testing' | 'staging' | 'production'): Deployment[] {
    // 这里应该从数据库或文件中获取部署历史
    // 暂时返回空数组
    return [];
  }

  /**
   * 获取环境状态
   */
  async getEnvironmentStatus(environment: 'development' | 'testing' | 'staging' | 'production'): Promise<any> {
    // 检查环境是否存在
    const envConfig = this.deploymentConfig.environments.find(env => env.name === environment);
    if (!envConfig) {
      throw new Error(`Environment ${environment} not found`);
    }

    try {
      // 这里应该实现环境状态检查逻辑
      // 暂时返回模拟数据
      return {
        environment,
        status: 'healthy',
        url: envConfig.url,
        lastDeployment: new Date().toISOString(),
        version: this.generateVersion(),
        uptime: '1d 5h 30m',
        errorRate: 0.1,
        responseTime: 120
      };
    } catch (error) {
      console.error(`Failed to get status for environment ${environment}:`, error);
      throw error;
    }
  }

  /**
   * 创建部署备份
   */
  createDeploymentBackup(environment: 'development' | 'testing' | 'staging' | 'production'): string {
    if (!this.deploymentConfig.rollbackStrategy.backupEnabled) {
      throw new Error('Backup is not enabled in rollback strategy');
    }

    try {
      // 检查备份目录是否存在
      if (!fs.existsSync(this.deploymentConfig.rollbackStrategy.backupPath)) {
        fs.mkdirSync(this.deploymentConfig.rollbackStrategy.backupPath, { recursive: true });
      }

      // 创建备份文件名
      const backupFileName = `${environment}_${Date.now()}.tar.gz`;
      const backupFilePath = path.join(this.deploymentConfig.rollbackStrategy.backupPath, backupFileName);

      // 这里应该实现实际的备份逻辑
      console.log(`Creating backup for ${environment} at ${backupFilePath}`);

      // 清理旧备份
      this.cleanupOldBackups();

      return backupFilePath;
    } catch (error) {
      console.error(`Failed to create backup for environment ${environment}:`, error);
      throw error;
    }
  }

  /**
   * 清理旧备份
   */
  private cleanupOldBackups(): void {
    try {
      if (!fs.existsSync(this.deploymentConfig.rollbackStrategy.backupPath)) {
        return;
      }

      const files = fs.readdirSync(this.deploymentConfig.rollbackStrategy.backupPath);
      if (files.length <= this.deploymentConfig.rollbackStrategy.maxBackups) {
        return;
      }

      // 按创建时间排序，删除最旧的备份
      const fileStats = files
        .map(file => {
          const filePath = path.join(this.deploymentConfig.rollbackStrategy.backupPath, file);
          const stats = fs.statSync(filePath);
          return { file, filePath, mtime: stats.mtime };
        })
        .sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

      const filesToDelete = fileStats.slice(0, fileStats.length - this.deploymentConfig.rollbackStrategy.maxBackups);
      for (const fileToDelete of filesToDelete) {
        fs.unlinkSync(fileToDelete.filePath);
        console.log(`Deleted old backup: ${fileToDelete.file}`);
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }
}

// 创建单例实例
export const deployManager = new DeployManager();
