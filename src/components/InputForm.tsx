// Input Form Component

import React, { useState, useEffect } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { fetchGoogleTrends } from '../services/geminiService';
import { FormInput, VideoEngine, GenerationMode, AspectRatio, HookType, VisualStyle } from '../types';
import { Settings, Key, RefreshCw, Sparkles, Youtube } from 'lucide-react';

interface InputFormProps {
  initialValues?: FormInput;
  onSubmit: (data: FormInput) => void;
  disabled: boolean;
  isVideoApiSupported: boolean;
  apiKeyStatus: 'checking' | 'ready' | 'needed';
  onSelectKey: () => void;
  isSelectingApiKey: boolean;
  isSystemKeySelectorAvailable: boolean;
  manualApiKey: string;
  onManualApiKeyChange: (key: string) => void;
}

export const InputForm: React.FC<InputFormProps> = ({
  initialValues,
  onSubmit,
  disabled,
  isVideoApiSupported,
  apiKeyStatus,
  onSelectKey,
  isSelectingApiKey,
  isSystemKeySelectorAvailable,
  manualApiKey,
  onManualApiKeyChange
}) => {
  const { t } = useLocalization();
  const [input, setInput] = useState<FormInput>(initialValues || {
    prompt: '',
    duration: 5,
    aspectRatio: AspectRatio.VERTICAL,
    style: [],
    generationMode: GenerationMode.AI_GENERATION,
    engine: VideoEngine.GEMINIGEN,
    thumbnailTitle: '',
    externalHookText: '',
    embeddedHookText: '',
    editingInstructions: '',
    hookType: HookType.TIME_BASED,
    gmicloudModel: 'model',
    gmicloudApiKey: '',
    geminigenApiKey: '',
    processAudio: false,
    videoTitle: '',
    keywords: '',
    niche: '',
    videoDescription: '',
    targetAudience: '',
    videoType: 'tutorial',
    topic: '',
    imitateUrl: ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormInput, string>>>({});
  const [isFetchingTrends, setIsFetchingTrends] = useState(false);

  useEffect(() => {
    if (initialValues) {
      setInput(prev => ({ ...prev, ...initialValues }));
    }
  }, [initialValues]);

  const handleGetTrends = async () => {
    setIsFetchingTrends(true);
    try {
      const trends = await fetchGoogleTrends('US');
      if (trends.length > 0) {
        const topTrend = trends[0];
        const trendKeywords = trends.slice(1, 6).join(', ');

        setInput(prev => ({
          ...prev,
          videoTitle: topTrend,
          topic: topTrend,
          keywords: trendKeywords,
          niche: prev.niche || 'Trending',
          videoDescription: prev.videoDescription || `Exploring the trending topic: ${topTrend}`,
          prompt: prev.prompt || `Create a viral video about ${topTrend}`
        }));
      }
    } catch (e) {
      console.error("Failed to fetch trends", e);
    } finally {
      setIsFetchingTrends(false);
    }
  };

  const validateForm = () => {
    const newErrors: Partial<Record<keyof FormInput, string>> = {};

    if (!input.videoTitle?.trim()) newErrors.videoTitle = '视频标题不能为空';
    // if (!input.keywords?.trim()) newErrors.keywords = '关键词不能为空'; // Optional
    if (!input.niche?.trim()) newErrors.niche = '领域不能为空';
    // if (!input.videoDescription?.trim()) newErrors.videoDescription = '视频描述不能为空'; // Optional

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(input);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setInput(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name as keyof FormInput]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name as keyof FormInput];
        return newErrors;
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-8 bg-slate-900/50 backdrop-blur-md border border-slate-800/50 rounded-2xl p-8 shadow-xl">
      {/* Header with API Key Status */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-pink-400">
          AI智能内容生成器
        </h1>

        <div className="flex items-center space-x-2">
          {apiKeyStatus === 'ready' ? (
            <div className="flex items-center text-green-400 bg-green-900/20 px-3 py-1 rounded-full text-xs border border-green-500/20">
              <Key size={12} className="mr-1" />
              <span>API Ready</span>
            </div>
          ) : (
            <button
              onClick={onSelectKey}
              disabled={!isSystemKeySelectorAvailable || isSelectingApiKey}
              className={`flex items-center text-xs px-3 py-1 rounded-full border transition-colors ${apiKeyStatus === 'needed'
                  ? 'bg-red-900/20 text-red-300 border-red-500/50 hover:bg-red-900/40 animate-pulse'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                }`}
            >
              <Settings size={12} className="mr-1" />
              <span>{isSelectingApiKey ? 'Selecting...' : 'Select API Key'}</span>
            </button>
          )}
        </div>
      </div>

      {/* API Key Manual Input (Fallback) */}
      {!isSystemKeySelectorAvailable && (
        <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <label className="block text-xs font-medium text-slate-400 mb-2">Google Gemini API Key (Manual Entry)</label>
          <input
            type="password"
            value={manualApiKey}
            onChange={(e) => onManualApiKeyChange(e.target.value)}
            placeholder="Enter your API key here..."
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
          <p className="text-xs text-slate-500 mt-1">Required if the system key selector is unavailable.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Video Title */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="videoTitle" className="block text-sm font-medium text-slate-300">
              视频标题
            </label>
            <button
              type="button"
              onClick={handleGetTrends}
              disabled={isFetchingTrends || disabled}
              className="text-xs bg-orange-600/80 hover:bg-orange-600 text-white px-3 py-1 rounded-full transition-colors flex items-center space-x-1"
            >
              {isFetchingTrends ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <span className="text-xs">🔥</span>
              )}
              <span>获取热门话题</span>
            </button>
          </div>
          <input
            type="text"
            id="videoTitle"
            name="videoTitle"
            value={input.videoTitle}
            onChange={handleChange}
            disabled={disabled}
            className={`w-full bg-slate-800/50 border rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${errors.videoTitle ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-blue-500/50'} disabled:opacity-50 disabled:cursor-not-allowed`}
            placeholder="请输入视频标题"
          />
          {errors.videoTitle && (
            <p className="mt-1 text-sm text-red-400">{errors.videoTitle}</p>
          )}
        </div>

        {/* Keywords */}
        <div>
          <label htmlFor="keywords" className="block text-sm font-medium text-slate-300 mb-2">
            关键词
          </label>
          <input
            type="text"
            id="keywords"
            name="keywords"
            value={input.keywords}
            onChange={handleChange}
            disabled={disabled}
            className={`w-full bg-slate-800/50 border rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${errors.keywords ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-blue-500/50'} disabled:opacity-50 disabled:cursor-not-allowed`}
            placeholder="请输入关键词，用逗号分隔"
          />
          {errors.keywords && (
            <p className="mt-1 text-sm text-red-400">{errors.keywords}</p>
          )}
        </div>

        {/* Niche */}
        <div>
          <label htmlFor="niche" className="block text-sm font-medium text-slate-300 mb-2">
            领域
          </label>
          <input
            type="text"
            id="niche"
            name="niche"
            value={input.niche}
            onChange={handleChange}
            disabled={disabled}
            className={`w-full bg-slate-800/50 border rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${errors.niche ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-blue-500/50'} disabled:opacity-50 disabled:cursor-not-allowed`}
            placeholder="请输入视频领域"
          />
          {errors.niche && (
            <p className="mt-1 text-sm text-red-400">{errors.niche}</p>
          )}
        </div>

        {/* Video Description */}
        <div>
          <label htmlFor="videoDescription" className="block text-sm font-medium text-slate-300 mb-2">
            视频描述 & 提示词
          </label>
          <textarea
            id="videoDescription"
            name="videoDescription"
            value={input.videoDescription}
            onChange={handleChange}
            disabled={disabled}
            rows={4}
            className={`w-full bg-slate-800/50 border rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${errors.videoDescription ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-blue-500/50'} disabled:opacity-50 disabled:cursor-not-allowed`}
            placeholder="请输入视频描述"
          />
          {errors.videoDescription && (
            <p className="mt-1 text-sm text-red-400">{errors.videoDescription}</p>
          )}
        </div>

        {/* Generation Settings Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Aspect Ratio */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Aspect Ratio</label>
            <select
              name="aspectRatio"
              value={input.aspectRatio}
              onChange={handleChange}
              disabled={disabled}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value={AspectRatio.VERTICAL}>9:16 (Shorts/Reels)</option>
              <option value={AspectRatio.HORIZONTAL}>16:9 (YouTube)</option>
              <option value={AspectRatio.SQUARE}>1:1 (Instagram)</option>
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Duration (seconds)</label>
            <input
              type="number"
              name="duration"
              value={input.duration}
              onChange={handleChange}
              disabled={disabled}
              min={5}
              max={60}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>

        {/* Target Audience */}
        <div>
          <label htmlFor="targetAudience" className="block text-sm font-medium text-slate-300 mb-2">
            目标受众
          </label>
          <input
            type="text"
            id="targetAudience"
            name="targetAudience"
            value={input.targetAudience}
            onChange={handleChange}
            disabled={disabled}
            className={`w-full bg-slate-800/50 border rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${errors.targetAudience ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-blue-500/50'} disabled:opacity-50 disabled:cursor-not-allowed`}
            placeholder="请输入目标受众"
          />
          {errors.targetAudience && (
            <p className="mt-1 text-sm text-red-400">{errors.targetAudience}</p>
          )}
        </div>

        {/* Viral Imitation URL (New) */}
        <div>
          <label htmlFor="imitateUrl" className="block text-sm font-medium text-slate-300 mb-2">
            爆款视频仿写链接 (可选)
            <span className="ml-2 text-xs text-purple-400 flex items-center inline-flex mt-1">
              <Youtube size={12} className="mr-1" />
              * 输入爆款视频 URL，AI 将分析其脚本结构并进行"洗稿"升级
            </span>
          </label>
          <input
            type="text"
            id="imitateUrl"
            name="imitateUrl"
            value={input.imitateUrl || ''}
            onChange={handleChange}
            disabled={disabled}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </div>

        {/* Video Type */}
        <div>
          <label htmlFor="videoType" className="block text-sm font-medium text-slate-300 mb-2">
            视频类型
          </label>
          <select
            id="videoType"
            name="videoType"
            value={input.videoType}
            onChange={handleChange}
            disabled={disabled}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="tutorial">教程</option>
            <option value="review">评测</option>
            <option value="entertainment">娱乐</option>
            <option value="news">新闻</option>
            <option value="vlog">VLOG</option>
            <option value="other">其他</option>
          </select>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={disabled}
            className="w-full bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 hover:from-purple-700 hover:via-blue-700 hover:to-pink-700 text-white font-semibold py-4 px-6 rounded-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg flex items-center justify-center space-x-2"
          >
            {disabled ? (
              <>
                <RefreshCw size={20} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Sparkles size={20} />
                <span>Generate Video</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
