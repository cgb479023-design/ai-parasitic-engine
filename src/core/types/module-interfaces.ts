/**
 * 核心模块接口定义
 * 统一的模块接口规范
 */

// 基础响应类型
export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  error?: ApiError;
}

// 错误类型
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

// 分页响应类型
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 基础服务接口
export interface BaseService {
  /**
   * 初始化服务
   */
  initialize(): Promise<void>;
  
  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean;
  
  /**
   * 获取服务状态
   */
  getStatus(): ServiceStatus;
}

// 服务状态类型
export interface ServiceStatus {
  name: string;
  version: string;
  status: 'running' | 'stopped' | 'error';
  lastChecked: number;
  details?: any;
}

// 事件类型
export interface Event {
  type: string;
  payload: any;
  timestamp: number;
  source: string;
}

// 事件监听器类型
export type EventListener = (event: Event) => void;

// 事件总线接口
export interface EventBus {
  /**
   * 订阅事件
   */
  subscribe(eventType: string, listener: EventListener): string;
  
  /**
   * 取消订阅事件
   */
  unsubscribe(subscriptionId: string): void;
  
  /**
   * 发布事件
   */
  publish(event: Event): void;
  
  /**
   * 发布事件（简化版）
   */
  emit(eventType: string, payload: any, source: string): void;
}

// 配置管理接口
export interface ConfigManager {
  /**
   * 获取配置
   */
  get<T>(key: string, defaultValue?: T): T;
  
  /**
   * 设置配置
   */
  set<T>(key: string, value: T): Promise<void>;
  
  /**
   * 加载配置
   */
  load(): Promise<void>;
  
  /**
   * 保存配置
   */
  save(): Promise<void>;
  
  /**
   * 重置配置
   */
  reset(): Promise<void>;
}

// 日志服务接口
export interface Logger {
  /**
   * 调试日志
   */
  debug(message: string, ...args: any[]): void;
  
  /**
   * 信息日志
   */
  info(message: string, ...args: any[]): void;
  
  /**
   * 警告日志
   */
  warn(message: string, ...args: any[]): void;
  
  /**
   * 错误日志
   */
  error(message: string, ...args: any[]): void;
  
  /**
   * 致命错误日志
   */
  fatal(message: string, ...args: any[]): void;
}

// 存储服务接口
export interface StorageService {
  /**
   * 获取存储值
   */
  get<T>(key: string): Promise<T | null>;
  
  /**
   * 设置存储值
   */
  set<T>(key: string, value: T): Promise<void>;
  
  /**
   * 删除存储值
   */
  remove(key: string): Promise<void>;
  
  /**
   * 清除所有存储值
   */
  clear(): Promise<void>;
  
  /**
   * 获取所有存储键
   */
  keys(): Promise<string[]>;
}

// 认证服务接口
export interface AuthService {
  /**
   * 登录
   */
  login(credentials: LoginCredentials): Promise<AuthResult>;
  
  /**
   * 登出
   */
  logout(): Promise<void>;
  
  /**
   * 检查用户是否已认证
   */
  isAuthenticated(): boolean;
  
  /**
   * 获取访问令牌
   */
  getAccessToken(): string | null;
  
  /**
   * 获取当前用户信息
   */
  getCurrentUser(): User | null;
  
  /**
   * 刷新令牌
   */
  refreshToken(): Promise<TokenInfo>;
}

// 登录凭证类型
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// 认证结果类型
export interface AuthResult {
  user: User;
  token: TokenInfo;
}

// 用户类型
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 用户角色类型
export type UserRole = 'admin' | 'user' | 'guest';

// 令牌信息类型
export interface TokenInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
}
