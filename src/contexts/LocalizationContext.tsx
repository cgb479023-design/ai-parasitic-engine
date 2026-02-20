import React, { createContext, useState, useContext, ReactNode } from 'react';

interface LocalizationContextType {
  language: 'zh' | 'en';
  setLanguage: (lang: 'zh' | 'en') => void;
  t: (key: string, params?: Record<string, any>) => string;
}

interface LocalizationProviderProps {
  children: ReactNode;
}

const translations: Record<string, Record<string, string>> = {
  en: {
    'app.title': 'AI Smart Video Creator',
    'app.description': 'Create viral videos with AI power',
    'input.topic': 'Video Topic',
    'input.duration': 'Duration (seconds)',
    'input.aspectRatio': 'Aspect Ratio',
    'input.style': 'Video Style',
    'input.engine': 'AI Engine',
    'input.generate': 'Generate Video',
    'loading.title': 'AI is Creating Your Video',
    'loading.progress.generatePrompt': 'Generating creative prompt...',
    'loading.progress.initiateVeo': 'Initiating Veo generation with {{model}}...',
    'loading.progress.gmicloudSubmitted': 'Video submitted to {{model}}...',
    'loading.progress.upload.parsing': 'Parsing uploaded video...',
    'loading.progress.generateAnalysis': 'Generating virality analysis...',
    'loading.progress.upload.encoding': 'Encoding final video...',
    'loading.progress.upload.generatingThumbnailImage': 'Generating thumbnail...',
    'loading.progress.complete': 'Video generation complete!',
    'error.title': 'Oops! Something went wrong',
    'error.quotaExceeded': 'API quota exceeded. Please try again later.',
    'error.apiKeyInvalid': 'Invalid API key. Please check your settings.',
    'error.apiKeyMissing': 'API key is missing. Please provide a valid key.',
    'error.videoApiNotSupported': 'Your browser does not support video API. Please use Chrome or Firefox.',
    'error.systemError': 'A system error occurred. Please try again later.',
  },
  zh: {
    'app.title': 'AI智能视频创作器',
    'app.description': '用AI力量创建爆款视频',
    'input.topic': '视频主题',
    'input.duration': '时长（秒）',
    'input.aspectRatio': '宽高比',
    'input.style': '视频风格',
    'input.engine': 'AI引擎',
    'input.generate': '生成视频',
    'loading.title': 'AI正在创建您的视频',
    'loading.progress.generatePrompt': '正在生成创意提示词...',
    'loading.progress.initiateVeo': '正在使用{{model}}启动Veo生成...',
    'loading.progress.gmicloudSubmitted': '视频已提交到{{model}}...',
    'loading.progress.upload.parsing': '正在解析上传的视频...',
    'loading.progress.generateAnalysis': '正在生成传播分析...',
    'loading.progress.upload.encoding': '正在编码最终视频...',
    'loading.progress.upload.generatingThumbnailImage': '正在生成缩略图...',
    'loading.progress.complete': '视频生成完成！',
    'error.title': '哎呀！出了点问题',
    'error.quotaExceeded': 'API配额已用完。请稍后再试。',
    'error.apiKeyInvalid': '无效的API密钥。请检查您的设置。',
    'error.apiKeyMissing': '缺少API密钥。请提供有效的密钥。',
    'error.videoApiNotSupported': '您的浏览器不支持视频API。请使用Chrome或Firefox。',
    'error.systemError': '发生系统错误。请稍后再试。',
  }
};

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export const LocalizationProvider: React.FC<LocalizationProviderProps> = ({ children }) => {
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');

  const t = (key: string, params: Record<string, any> = {}) => {
    let translation = translations[language][key] || key;
    
    // Replace placeholders in the translation
    Object.entries(params).forEach(([param, value]) => {
      translation = translation.replace(`{{${param}}}`, String(value));
    });
    
    return translation;
  };

  return (
    <LocalizationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LocalizationContext.Provider>
  );
};

export const useLocalization = () => {
  const context = useContext(LocalizationContext);
  if (context === undefined) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
};
