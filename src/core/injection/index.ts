/**
 * 依赖注入系统入口
 */

// 导出容器和装饰器
export * from './container';

// 导出服务注册器和服务名称
export * from './service-registry';

/**
 * 初始化依赖注入系统
 */
export function initializeInjectionSystem(): void {
  // 初始化容器
  // 这里可以添加一些初始化逻辑
  
  // 注册所有服务
  const { ServiceRegistry } = require('./service-registry');
  ServiceRegistry.registerAllServices();
  
  console.log('✅ Dependency injection system initialized');
}
