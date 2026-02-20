/**
 * 内容创建模块接口定义
 */

import { BaseService } from '../../../core/types/module-interfaces';
import { FormInput, OutputData, ViralityAnalysis } from '../../../types';

// 内容创建服务接口
export interface ContentCreationService extends BaseService {
  /**
   * 生成内容
   */
  generateContent(input: ContentGenerationInput): Promise<ContentGenerationResult>;
  
  /**
   * 编辑内容
   */
  editContent(contentId: string, edits: ContentEditInput): Promise<ContentGenerationResult>;
  
  /**
   * 获取内容详情
   */
  getContent(contentId: string): Promise<ContentDetail>;
  
  /**
   * 列出内容
   */
  listContent(filter?: ContentFilter): Promise<ContentList>;
  
  /**
   * 删除内容
   */
  deleteContent(contentId: string): Promise<void>;
  
  /**
   * 分析内容的病毒式传播潜力
   */
  analyzeVirality(contentId: string): Promise<ViralityAnalysis>;
  
  /**
   * 生成营销文案
   */
  generateMarketingCopy(contentId: string): Promise<MarketingCopy>;
}

// 内容生成输入类型
export interface ContentGenerationInput {
  /**
   * 提示词
   */
  prompt: string;
  
  /**
   * 持续时间
   */
  duration: number;
  
  /**
   * 视觉风格
   */
  style: string[];
  
  /**
   * 宽高比
   */
  aspectRatio: string;
  
  /**
   * 生成模式
   */
  generationMode: string;
  
  /**
   * 引擎类型
   */
  engine: string;
  
  /**
   * 额外的钩子文本
   */
  externalHookText: string;
  
  /**
   * 缩略图标题
   */
  thumbnailTitle: string;
  
  /**
   * 嵌入的钩子文本
   */
  embeddedHookText: string;
  
  /**
   * 编辑说明
   */
  editingInstructions: string;
  
  /**
   * 钩子类型
   */
  hookType: string;
  
  /**
   * 处理音频
   */
  processAudio: boolean;
  
  /**
   * GMICloud模型
   */
  gmicloudModel?: string;
  
  /**
   * GMICloud API密钥
   */
  gmicloudApiKey?: string;
  
  /**
   * GMICloud基础URL
   */
  gmicloudBaseUrl?: string;
  
  /**
   * GeminiGen API密钥
   */
  geminigenApiKey?: string;
  
  /**
   * GeminiGen基础URL
   */
  geminigenBaseUrl?: string;
  
  /**
   * GeminiGen模型
   */
  geminigenModel?: string;
}

// 内容生成结果类型
export interface ContentGenerationResult {
  /**
   * 内容ID
   */
  id: string;
  
  /**
   * 生成状态
   */
  status: 'pending' | 'generating' | 'completed' | 'failed';
  
  /**
   * 生成的内容
   */
  content?: OutputData;
  
  /**
   * 错误信息
   */
  error?: string;
  
  /**
   * 进度百分比
   */
  progress: number;
  
  /**
   * 生成时间
   */
  createdAt: Date;
  
  /**
   * 更新时间
   */
  updatedAt: Date;
}

// 内容详情类型
export interface ContentDetail {
  /**
   * 内容ID
   */
  id: string;
  
  /**
   * 输入参数
   */
  input: ContentGenerationInput;
  
  /**
   * 输出数据
   */
  output: OutputData;
  
  /**
   * 状态
   */
  status: 'draft' | 'published' | 'archived';
  
  /**
   * 病毒式传播分析
   */
  viralityAnalysis: ViralityAnalysis;
  
  /**
   * 营销文案
   */
  marketingCopy?: MarketingCopy;
  
  /**
   * 生成时间
   */
  createdAt: Date;
  
  /**
   * 更新时间
   */
  updatedAt: Date;
  
  /**
   * 发布时间
   */
  publishedAt?: Date;
}

// 内容编辑输入类型
export interface ContentEditInput {
  /**
   * 编辑指令
   */
  editingInstructions: string;
  
  /**
   * 新的样式
   */
  style?: string[];
  
  /**
   * 新的宽高比
   */
  aspectRatio?: string;
  
  /**
   * 新的持续时间
   */
  duration?: number;
}

// 内容列表类型
export interface ContentList {
  /**
   * 内容列表
   */
  items: ContentDetail[];
  
  /**
   * 总数
   */
  total: number;
  
  /**
   * 页码
   */
  page: number;
  
  /**
   * 每页数量
   */
  limit: number;
  
  /**
   * 总页数
   */
  totalPages: number;
}

// 内容筛选类型
export interface ContentFilter {
  /**
   * 状态
   */
  status?: string;
  
  /**
   * 生成模式
   */
  generationMode?: string;
  
  /**
   * 引擎类型
   */
  engine?: string;
  
  /**
   * 开始时间
   */
  startDate?: Date;
  
  /**
   * 结束时间
   */
  endDate?: Date;
  
  /**
   * 页码
   */
  page?: number;
  
  /**
   * 每页数量
   */
  limit?: number;
}

// 营销文案类型
export interface MarketingCopy {
  /**
   * 标题
   */
  title: string;
  
  /**
   * 描述
   */
  description: string;
  
  /**
   * 标签
   */
  tags: string[];
  
  /**
   * 评论1
   */
  comment1: CommentPrompt;
  
  /**
   * 评论2
   */
  comment2: CommentPrompt;
}

// 评论提示类型
export interface CommentPrompt {
  /**
   * 类型
   */
  type: string;
  
  /**
   * 内容
   */
  content: string;
}
