/**
 * 视频编辑模块接口定义
 */

import { BaseService } from '../../../core/types/module-interfaces';
import { OutputData } from '../../../types';

// 视频编辑服务接口
export interface VideoEditingService extends BaseService {
  /**
   * 编辑视频
   */
  editVideo(
    videoId: string,
    edits: VideoEditInput
  ): Promise<VideoEditingResult>;
  
  /**
   * 合并视频
   */
  mergeVideos(
    videoIds: string[],
    options?: MergeOptions
  ): Promise<VideoEditingResult>;
  
  /**
   * 裁剪视频
   */
  trimVideo(
    videoId: string,
    startTime: number,
    endTime: number
  ): Promise<VideoEditingResult>;
  
  /**
   * 添加字幕
   */
  addSubtitles(
    videoId: string,
    subtitles: Subtitle[]
  ): Promise<VideoEditingResult>;
  
  /**
   * 添加背景音乐
   */
  addBackgroundMusic(
    videoId: string,
    musicId: string,
    volume: number
  ): Promise<VideoEditingResult>;
  
  /**
   * 应用滤镜
   */
  applyFilter(
    videoId: string,
    filter: string,
    intensity: number
  ): Promise<VideoEditingResult>;
  
  /**
   * 获取视频预览
   */
  getVideoPreview(
    videoId: string,
    time: number
  ): Promise<PreviewResult>;
  
  /**
   * 导出视频
   */
  exportVideo(
    videoId: string,
    format: string,
    quality: 'low' | 'medium' | 'high'
  ): Promise<ExportResult>;
}

// 视频编辑输入类型
export interface VideoEditInput {
  /**
   * 编辑指令
   */
  editingInstructions: string;
  
  /**
   * 裁剪选项
   */
  trimOptions?: TrimOptions;
  
  /**
   * 转场效果
   */
  transitions?: Transition[];
  
  /**
   * 文本叠加
   */
  textOverlays?: TextOverlay[];
  
  /**
   * 音频调整
   */
  audioAdjustments?: AudioAdjustments;
  
  /**
   * 颜色校正
   */
  colorCorrection?: ColorCorrection;
}

// 裁剪选项类型
export interface TrimOptions {
  /**
   * 开始时间（秒）
   */
  startTime: number;
  
  /**
   * 结束时间（秒）
   */
  endTime: number;
}

// 转场效果类型
export interface Transition {
  /**
   * 转场类型
   */
  type: string;
  
  /**
   * 开始时间（秒）
   */
  startTime: number;
  
  /**
   * 持续时间（秒）
   */
  duration: number;
  
  /**
   * 转场参数
   */
  params?: Record<string, any>;
}

// 文本叠加类型
export interface TextOverlay {
  /**
   * 文本内容
   */
  text: string;
  
  /**
   * 开始时间（秒）
   */
  startTime: number;
  
  /**
   * 结束时间（秒）
   */
  endTime: number;
  
  /**
   * 位置
   */
  position: { x: number; y: number };
  
  /**
   * 样式
   */
  style?: TextStyle;
}

// 文本样式类型
export interface TextStyle {
  /**
   * 字体
   */
  font: string;
  
  /**
   * 字体大小
   */
  fontSize: number;
  
  /**
   * 颜色
   */
  color: string;
  
  /**
   * 透明度
   */
  opacity: number;
  
  /**
   * 描边
   */
  stroke?: { color: string; width: number };
  
  /**
   * 阴影
   */
  shadow?: { color: string; offsetX: number; offsetY: number; blur: number };
}

// 音频调整类型
export interface AudioAdjustments {
  /**
   * 音量
   */
  volume: number;
  
  /**
   * 淡入时间（秒）
   */
  fadeIn?: number;
  
  /**
   * 淡出时间（秒）
   */
  fadeOut?: number;
}

// 颜色校正类型
export interface ColorCorrection {
  /**
   * 亮度
   */
  brightness: number;
  
  /**
   * 对比度
   */
  contrast: number;
  
  /**
   * 饱和度
   */
  saturation: number;
  
  /**
   * 色调
   */
  hue: number;
}

// 合并选项类型
export interface MergeOptions {
  /**
   * 转场效果
   */
  transition?: Transition;
  
  /**
   * 输出格式
   */
  outputFormat?: string;
}

// 字幕类型
export interface Subtitle {
  /**
   * 开始时间（秒）
   */
  startTime: number;
  
  /**
   * 结束时间（秒）
   */
  endTime: number;
  
  /**
   * 文本内容
   */
  text: string;
  
  /**
   * 样式
   */
  style?: TextStyle;
}

// 视频编辑结果类型
export interface VideoEditingResult {
  /**
   * 视频ID
   */
  videoId: string;
  
  /**
   * 编辑状态
   */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  /**
   * 输出数据
   */
  output?: OutputData;
  
  /**
   * 错误信息
   */
  error?: string;
  
  /**
   * 进度百分比
   */
  progress: number;
  
  /**
   * 处理时间
   */
  processedAt?: Date;
}

// 预览结果类型
export interface PreviewResult {
  /**
   * 预览URL
   */
  previewUrl: string;
  
  /**
   * 时间戳
   */
  timestamp: number;
  
  /**
   * 宽度
   */
  width: number;
  
  /**
   * 高度
   */
  height: number;
}

// 导出结果类型
export interface ExportResult {
  /**
   * 导出ID
   */
  exportId: string;
  
  /**
   * 导出状态
   */
  status: 'pending' | 'exporting' | 'completed' | 'failed';
  
  /**
   * 导出URL
   */
  exportUrl?: string;
  
  /**
   * 错误信息
   */
  error?: string;
  
  /**
   * 进度百分比
   */
  progress: number;
  
  /**
   * 导出大小（字节）
   */
  fileSize?: number;
  
  /**
   * 导出完成时间
   */
  completedAt?: Date;
}
