/**
 * YouTube Analytics模块接口定义
 */

import { BaseService } from '../../../core/types/module-interfaces';

// YouTube Analytics服务接口
export interface YouTubeAnalyticsService extends BaseService {
  /**
   * 连接YouTube账号
   */
  connectAccount(): Promise<ConnectionResult>;
  
  /**
   * 断开YouTube账号连接
   */
  disconnectAccount(): Promise<void>;
  
  /**
   * 获取账号状态
   */
  getAccountStatus(): Promise<AccountStatus>;
  
  /**
   * 获取频道统计数据
   */
  getChannelStats(
    channelId: string,
    period: AnalyticsPeriod
  ): Promise<ChannelStats>;
  
  /**
   * 获取视频列表
   */
  getVideoList(
    channelId: string,
    filter?: VideoFilter
  ): Promise<Paginated<VideoInfo>>;
  
  /**
   * 获取视频统计数据
   */
  getVideoStats(
    videoId: string,
    period: AnalyticsPeriod
  ): Promise<VideoStats>;
  
  /**
   * 获取受众分析
   */
  getAudienceAnalysis(
    channelId: string,
    period: AnalyticsPeriod
  ): Promise<AudienceAnalysis>;
  
  /**
   * 获取播放列表
   */
  getPlaylists(
    channelId: string
  ): Promise<Playlist[]>;
  
  /**
   * 发布视频到YouTube
   */
  publishVideo(
    videoId: string,
    publishOptions: PublishOptions
  ): Promise<PublishResult>;
  
  /**
   * 获取发布状态
   */
  getPublishStatus(
    publishId: string
  ): Promise<PublishStatus>;
}

// 连接结果类型
export interface ConnectionResult {
  /**
   * 连接状态
   */
  connected: boolean;
  
  /**
   * 认证URL
   */
  authUrl?: string;
  
  /**
   * 错误信息
   */
  error?: string;
  
  /**
   * 频道信息
   */
  channelInfo?: ChannelInfo;
}

// 账号状态类型
export interface AccountStatus {
  /**
   * 是否已连接
   */
  isConnected: boolean;
  
  /**
   * 最后连接时间
   */
  lastConnected?: Date;
  
  /**
   * 频道信息
   */
  channelInfo?: ChannelInfo;
  
  /**
   * 权限列表
   */
  permissions: string[];
}

// 频道信息类型
export interface ChannelInfo {
  /**
   * 频道ID
   */
  id: string;
  
  /**
   * 频道名称
   */
  name: string;
  
  /**
   * 频道描述
   */
  description: string;
  
  /**
   * 频道头像URL
   */
  avatarUrl: string;
  
  /**
   * 订阅者数量
   */
  subscriberCount: number;
  
  /**
   * 总观看次数
   */
  viewCount: number;
  
  /**
   * 视频数量
   */
  videoCount: number;
}

// 分析周期类型
export type AnalyticsPeriod = 
  | 'today' 
  | 'yesterday' 
  | 'last7days' 
  | 'last30days' 
  | 'last90days' 
  | 'thisMonth' 
  | 'lastMonth' 
  | 'thisYear' 
  | 'lastYear' 
  | CustomPeriod;

// 自定义周期类型
export interface CustomPeriod {
  /**
   * 开始日期
   */
  startDate: Date;
  
  /**
   * 结束日期
   */
  endDate: Date;
}

// 频道统计数据类型
export interface ChannelStats {
  /**
   * 频道ID
   */
  channelId: string;
  
  /**
   * 周期
   */
  period: AnalyticsPeriod;
  
  /**
   * 总观看次数
   */
  views: number;
  
  /**
   * 观看时长（分钟）
   */
  watchTimeMinutes: number;
  
  /**
   * 平均观看时长（秒）
   */
  averageViewDuration: number;
  
  /**
   * 浏览量
   */
  impressions: number;
  
  /**
   * 浏览量点击率
   */
  clickThroughRate: number;
  
  /**
   * 订阅者增长
   */
  subscriberGrowth: number;
  
  /**
   * 分享次数
   */
  shares: number;
  
  /**
   * 点赞次数
   */
  likes: number;
  
  /**
   * 评论次数
   */
  comments: number;
  
  /**
   * 统计数据时间序列
   */
  timeSeries: StatsTimeSeries[];
}

// 统计数据时间序列类型
export interface StatsTimeSeries {
  /**
   * 日期
   */
  date: Date;
  
  /**
   * 观看次数
   */
  views: number;
  
  /**
   * 观看时长（分钟）
   */
  watchTimeMinutes: number;
  
  /**
   * 订阅者增长
   */
  subscriberGrowth: number;
}

// 视频筛选类型
export interface VideoFilter {
  /**
   * 发布日期范围
   */
  publishedAfter?: Date;
  
  /**
   * 发布日期范围
   */
  publishedBefore?: Date;
  
  /**
   * 排序字段
   */
  sortBy?: 'date' | 'views' | 'likes' | 'comments';
  
  /**
   * 排序方向
   */
  sortOrder?: 'asc' | 'desc';
  
  /**
   * 搜索关键词
   */
  search?: string;
}

// 分页响应类型
export interface Paginated<T> {
  /**
   * 数据列表
   */
  items: T[];
  
  /**
   * 总数
   */
  total: number;
  
  /**
   * 当前页码
   */
  page: number;
  
  /**
   * 每页大小
   */
  pageSize: number;
  
  /**
   * 总页数
   */
  totalPages: number;
}

// 视频信息类型
export interface VideoInfo {
  /**
   * 视频ID
   */
  id: string;
  
  /**
   * 视频标题
   */
  title: string;
  
  /**
   * 视频描述
   */
  description: string;
  
  /**
   * 视频缩略图
   */
  thumbnails: Thumbnail[];
  
  /**
   * 发布时间
   */
  publishedAt: Date;
  
  /**
   * 观看次数
   */
  viewCount: number;
  
  /**
   * 点赞次数
   */
  likeCount: number;
  
  /**
   * 评论次数
   */
  commentCount: number;
  
  /**
   * 持续时间（秒）
   */
  duration: number;
  
  /**
   * 视频标签
   */
  tags: string[];
  
  /**
   * 视频分类
   */
  categoryId: string;
}

// 缩略图类型
export interface Thumbnail {
  /**
   * 缩略图URL
   */
  url: string;
  
  /**
   * 宽度
   */
  width: number;
  
  /**
   * 高度
   */
  height: number;
  
  /**
   * 缩略图类型
   */
  type: 'default' | 'medium' | 'high' | 'standard' | 'maxres';
}

// 视频统计数据类型
export interface VideoStats {
  /**
   * 视频ID
   */
  videoId: string;
  
  /**
   * 周期
   */
  period: AnalyticsPeriod;
  
  /**
   * 总观看次数
   */
  views: number;
  
  /**
   * 观看时长（分钟）
   */
  watchTimeMinutes: number;
  
  /**
   * 平均观看时长（秒）
   */
  averageViewDuration: number;
  
  /**
   * 完播率
   */
  viewThroughRate: number;
  
  /**
   * 浏览量
   */
  impressions: number;
  
  /**
   * 浏览量点击率
   */
  clickThroughRate: number;
  
  /**
   * 点赞次数
   */
  likes: number;
  
  /**
   * 踩次数
   */
  dislikes: number;
  
  /**
   * 评论次数
   */
  comments: number;
  
  /**
   * 分享次数
   */
  shares: number;
  
  /**
   * 订阅者增长
   */
  subscriberGrowth: number;
  
  /**
   * 观众保留率
   */
  audienceRetention: RetentionPoint[];
  
  /**
   * 流量来源
   */
  trafficSources: TrafficSource[];
}

// 保留率数据点类型
export interface RetentionPoint {
  /**
   * 视频进度百分比
   */
  percentage: number;
  
  /**
   * 保留率
   */
  retention: number;
}

// 流量来源类型
export interface TrafficSource {
  /**
   * 来源名称
   */
  source: string;
  
  /**
   * 观看次数
   */
  views: number;
  
  /**
   * 占比
   */
  percentage: number;
}

// 受众分析类型
export interface AudienceAnalysis {
  /**
   * 年龄分布
   */
  ageGroups: AgeGroupDistribution[];
  
  /**
   * 性别分布
   */
  genderDistribution: GenderDistribution[];
  
  /**
   * 地理位置分布
   */
  geolocation: GeolocationDistribution[];
  
  /**
   * 设备类型分布
   */
  deviceTypes: DeviceTypeDistribution[];
  
  /**
   * 观看时间分布
   */
  watchTimeDistribution: WatchTimeDistribution[];
}

// 年龄分布类型
export interface AgeGroupDistribution {
  /**
   * 年龄组
   */
  ageGroup: string;
  
  /**
   * 占比
   */
  percentage: number;
}

// 性别分布类型
export interface GenderDistribution {
  /**
   * 性别
   */
  gender: 'male' | 'female' | 'unknown';
  
  /**
   * 占比
   */
  percentage: number;
}

// 地理位置分布类型
export interface GeolocationDistribution {
  /**
   * 国家/地区
   */
  country: string;
  
  /**
   * 观看次数
   */
  views: number;
  
  /**
   * 占比
   */
  percentage: number;
}

// 设备类型分布类型
export interface DeviceTypeDistribution {
  /**
   * 设备类型
   */
  device: 'desktop' | 'mobile' | 'tablet' | 'tv';
  
  /**
   * 占比
   */
  percentage: number;
}

// 观看时间分布类型
export interface WatchTimeDistribution {
  /**
   * 时间段（小时）
   */
  hour: number;
  
  /**
   * 观看时长（分钟）
   */
  watchTimeMinutes: number;
}

// 播放列表类型
export interface Playlist {
  /**
   * 播放列表ID
   */
  id: string;
  
  /**
   * 播放列表标题
   */
  title: string;
  
  /**
   * 播放列表描述
   */
  description: string;
  
  /**
   * 视频数量
   */
  itemCount: number;
  
  /**
   * 创建时间
   */
  publishedAt: Date;
}

// 发布选项类型
export interface PublishOptions {
  /**
   * 视频标题
   */
  title: string;
  
  /**
   * 视频描述
   */
  description: string;
  
  /**
   * 视频标签
   */
  tags: string[];
  
  /**
   * 视频分类
   */
  categoryId: string;
  
  /**
   * 是否公开
   */
  privacyStatus: 'public' | 'private' | 'unlisted';
  
  /**
   * 缩略图URL
   */
  thumbnailUrl?: string;
  
  /**
   * 发布时间
   */
  publishAt?: Date;
  
  /**
   * 是否允许评论
   */
  allowComments?: boolean;
  
  /**
   * 是否允许评分
   */
  allowRatings?: boolean;
}

// 发布结果类型
export interface PublishResult {
  /**
   * 发布ID
   */
  publishId: string;
  
  /**
   * 视频ID（如果已发布）
   */
  videoId?: string;
  
  /**
   * 发布状态
   */
  status: 'pending' | 'uploading' | 'processing' | 'scheduled' | 'published';
  
  /**
   * 上传进度
   */
  progress: number;
}

// 发布状态类型
export interface PublishStatus {
  /**
   * 发布ID
   */
  publishId: string;
  
  /**
   * 视频ID
   */
  videoId?: string;
  
  /**
   * 发布状态
   */
  status: 'pending' | 'uploading' | 'processing' | 'scheduled' | 'published' | 'failed';
  
  /**
   * 进度
   */
  progress: number;
  
  /**
   * 错误信息
   */
  error?: string;
  
  /**
   * 已发布的视频URL
   */
  videoUrl?: string;
}
