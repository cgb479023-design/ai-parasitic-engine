/**
 * 服务注册器
 * 负责注册所有服务到依赖注入容器
 */

import { container, Injectable } from './container';
import { BaseService } from '../types/module-interfaces';

// 导入修复增强服务
import { deployManager } from '../../services/deployManager';
import { fixReviewer } from '../../services/fixReviewer';
import { fixEffectTracker } from '../../services/fixEffectTracker';
import { fixDocumentationGenerator } from '../../services/fixDocumentationGenerator';
import { fixHistoryService } from '../../services/fixHistoryService';
import { fixRiskAssessmentService } from '../../services/fixRiskAssessmentService';
import { fixVisualizationService } from '../../services/fixVisualizationService';
import { fixConfirmationService } from '../../services/fixConfirmationService';
import { fixFeedbackService } from '../../services/fixFeedbackService';

// 服务名称常量
export const SERVICE_NAMES = {
  // 核心服务
  CONFIG_MANAGER: 'ConfigManager',
  EVENT_BUS: 'EventBus',
  LOGGER: 'Logger',
  STORAGE: 'Storage',
  AUTH: 'AuthService',
  
  // 功能服务
  CONTENT_CREATION: 'ContentCreationService',
  VIDEO_EDITING: 'VideoEditingService',
  YOUTUBE_ANALYTICS: 'YouTubeAnalyticsService',
  NOTIFICATION: 'NotificationService',
  ANALYTICS: 'AnalyticsService',
  
  // 修复增强服务
  DEPLOY_MANAGER: 'DeployManager',
  FIX_REVIEWER: 'FixReviewer',
  FIX_EFFECT_TRACKER: 'FixEffectTracker',
  FIX_DOCUMENTATION_GENERATOR: 'FixDocumentationGenerator',
  FIX_HISTORY_SERVICE: 'FixHistoryService',
  FIX_RISK_ASSESSMENT_SERVICE: 'FixRiskAssessmentService',
  FIX_VISUALIZATION_SERVICE: 'FixVisualizationService',
  FIX_CONFIRMATION_SERVICE: 'FixConfirmationService',
  FIX_FEEDBACK_SERVICE: 'FixFeedbackService',
  
  // 辅助服务
  CODE_REVIEW: 'CodeReviewService',
  PERFORMANCE_MONITOR: 'PerformanceMonitorService',
  QUALITY_GATE: 'QualityGateService',
  SCHEDULER: 'SchedulerService',
};

/**
 * 服务注册器类
 * 用于注册所有服务到容器
 */
export class ServiceRegistry {
  /**
   * 注册核心服务
   */
  static registerCoreServices(): void {
    // 这里注册核心服务，如配置管理、事件总线等
    // 示例：container.register(SERVICE_NAMES.CONFIG_MANAGER, () => new ConfigManager());
  }
  
  /**
   * 注册功能服务
   */
  static registerFeatureServices(): void {
    // 这里注册功能服务，如内容创建、视频编辑等
    // 示例：container.register(SERVICE_NAMES.CONTENT_CREATION, () => new ContentCreationService());
  }
  
  /**
   * 注册辅助服务
   */
  static registerUtilityServices(): void {
    // 注册修复增强服务
    container.register(SERVICE_NAMES.DEPLOY_MANAGER, () => deployManager);
    container.register(SERVICE_NAMES.FIX_REVIEWER, () => fixReviewer);
    container.register(SERVICE_NAMES.FIX_EFFECT_TRACKER, () => fixEffectTracker);
    container.register(SERVICE_NAMES.FIX_DOCUMENTATION_GENERATOR, () => fixDocumentationGenerator);
    container.register(SERVICE_NAMES.FIX_HISTORY_SERVICE, () => fixHistoryService);
    container.register(SERVICE_NAMES.FIX_RISK_ASSESSMENT_SERVICE, () => fixRiskAssessmentService);
    container.register(SERVICE_NAMES.FIX_VISUALIZATION_SERVICE, () => fixVisualizationService);
    container.register(SERVICE_NAMES.FIX_CONFIRMATION_SERVICE, () => fixConfirmationService);
    container.register(SERVICE_NAMES.FIX_FEEDBACK_SERVICE, () => fixFeedbackService);
    
    // 其他辅助服务
    // 示例：container.register(SERVICE_NAMES.CODE_REVIEW, () => new CodeReviewService());
  }
  
  /**
   * 注册所有服务
   */
  static registerAllServices(): void {
    this.registerCoreServices();
    this.registerFeatureServices();
    this.registerUtilityServices();
    
    console.log('✅ All services registered successfully');
  }
  
  /**
   * 获取服务
   * @param name 服务名称
   */
  static getService<T extends BaseService>(name: string): T {
    return container.resolve(name);
  }
}

/**
 * 服务装饰器
 * 用于标记服务类
 * @param serviceName 服务名称
 */
export function Service(serviceName: string): ClassDecorator {
  return function(constructor: Function) {
    // 注册服务到容器
    container.register(serviceName, () => new (constructor as any)(), true);
    
    // 也应用Injectable装饰器
    Injectable()(constructor);
  };
}
