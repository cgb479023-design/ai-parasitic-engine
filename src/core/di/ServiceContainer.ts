/**
 * 服务容器实现
 * 依赖注入机制的核心组件
 */

import { BaseService, ServiceStatus } from '../types/module-interfaces';

// 服务类型映射
interface ServiceMap {
  [key: string]: {
    instance: BaseService | null;
    factory: () => Promise<BaseService>;
    isSingleton: boolean;
  };
}

// 服务容器类
export class ServiceContainer {
  private services: ServiceMap = {};
  private initializedServices: Set<string> = new Set();
  private static instance: ServiceContainer;

  // 单例模式
  private constructor() {}

  /**
   * 获取服务容器实例
   */
  public static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  /**
   * 注册服务
   * @param name 服务名称
   * @param factory 服务工厂函数
   * @param isSingleton 是否为单例
   */
  public register<T extends BaseService>(
    name: string,
    factory: () => Promise<T>,
    isSingleton: boolean = true
  ): void {
    this.services[name] = {
      instance: null,
      factory: factory as () => Promise<BaseService>,
      isSingleton
    };
  }

  /**
   * 解析服务
   * @param name 服务名称
   * @returns 服务实例
   */
  public async resolve<T extends BaseService>(name: string): Promise<T> {
    const serviceDef = this.services[name];
    if (!serviceDef) {
      throw new Error(`Service '${name}' not registered`);
    }

    if (serviceDef.isSingleton) {
      if (!serviceDef.instance) {
        serviceDef.instance = await serviceDef.factory();
        await this.initializeService(name, serviceDef.instance);
      }
      return serviceDef.instance as T;
    } else {
      const instance = await serviceDef.factory();
      await this.initializeService(name, instance);
      return instance as T;
    }
  }

  /**
   * 初始化服务
   * @param name 服务名称
   * @param instance 服务实例
   */
  private async initializeService(name: string, instance: BaseService): Promise<void> {
    if (!this.initializedServices.has(name)) {
      await instance.initialize();
      this.initializedServices.add(name);
    }
  }

  /**
   * 检查服务是否已注册
   * @param name 服务名称
   * @returns 是否已注册
   */
  public hasService(name: string): boolean {
    return !!this.services[name];
  }

  /**
   * 获取所有已注册服务名称
   * @returns 服务名称列表
   */
  public getRegisteredServices(): string[] {
    return Object.keys(this.services);
  }

  /**
   * 获取服务状态
   * @param name 服务名称
   * @returns 服务状态
   */
  public async getServiceStatus(name: string): Promise<ServiceStatus | null> {
    try {
      const service = await this.resolve(name);
      return service.getStatus();
    } catch (error) {
      return null;
    }
  }

  /**
   * 获取所有服务状态
   * @returns 所有服务状态列表
   */
  public async getAllServiceStatuses(): Promise<Array<{
    name: string;
    status: ServiceStatus | null;
  }>> {
    const serviceNames = this.getRegisteredServices();
    const statuses = await Promise.all(
      serviceNames.map(async name => ({
        name,
        status: await this.getServiceStatus(name)
      }))
    );
    return statuses;
  }

  /**
   * 清除服务实例（主要用于测试）
   * @param name 服务名称
   */
  public clearService(name: string): void {
    if (this.services[name]) {
      this.services[name].instance = null;
      this.initializedServices.delete(name);
    }
  }

  /**
   * 清除所有服务实例（主要用于测试）
   */
  public clearAllServices(): void {
    this.services = {};
    this.initializedServices.clear();
  }
}

// 导出服务容器实例
export const serviceContainer = ServiceContainer.getInstance();
