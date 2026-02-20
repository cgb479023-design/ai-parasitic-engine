/**
 * 依赖注入容器
 * 提供基本的服务注册和解析功能
 */

// 服务定义接口
interface ServiceDefinition<T = any> {
  /**
   * 服务工厂函数
   */
  factory: () => T;
  /**
   * 是否是单例
   */
  isSingleton: boolean;
  /**
   * 单例实例
   */
  instance?: T;
}

/**
 * 依赖注入容器
 */
export class Container {
  private services: Map<string, ServiceDefinition> = new Map();

  /**
   * 注册服务
   * @param name 服务名称
   * @param factory 服务工厂函数
   * @param isSingleton 是否是单例，默认为true
   */
  register<T>(name: string, factory: () => T, isSingleton: boolean = true): void {
    this.services.set(name, {
      factory,
      isSingleton,
    });
  }

  /**
   * 解析服务
   * @param name 服务名称
   * @returns 服务实例
   */
  resolve<T>(name: string): T {
    const service = this.services.get(name);
    
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }

    if (service.isSingleton) {
      if (!service.instance) {
        service.instance = service.factory();
      }
      return service.instance as T;
    }

    return service.factory() as T;
  }

  /**
   * 检查服务是否已注册
   * @param name 服务名称
   * @returns 是否已注册
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * 移除服务
   * @param name 服务名称
   */
  remove(name: string): void {
    this.services.delete(name);
  }

  /**
   * 清空所有服务
   */
  clear(): void {
    this.services.clear();
  }
}

/**
 * 全局容器实例
 */
export const container = new Container();

/**
 * Injectable装饰器
 * 标记类为可注入的
 */
export function Injectable(): ClassDecorator {
  return function(constructor: Function) {
    // 这里可以添加一些元数据
    // 例如：Reflect.defineMetadata('injectable', true, constructor);
  };
}
