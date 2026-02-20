// Loading Screen Component

import React from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { VideoEngine } from '../types';

interface LoadingScreenProps {
  progress: { percentage: number; messageKey: string; messageParams?: any } | null;
  videoBlobForPreview?: Blob | null;
  originalVideoBlobForPreview?: Blob | null;
  previewAspectRatio?: string | null;
  trimDuration?: number | null;
  engine?: VideoEngine | null;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  progress,
  videoBlobForPreview,
  originalVideoBlobForPreview,
  previewAspectRatio,
  trimDuration,
  engine
}) => {
  const { t } = useLocalization();

  const percentage = progress?.percentage || 0;
  const message = progress ? t(progress.messageKey, progress.messageParams) : t('loading.title');

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8">
      <div className="max-w-3xl w-full bg-slate-900/50 backdrop-blur-md border border-slate-800/50 rounded-2xl p-12 shadow-xl">
        <h1 className="text-3xl font-bold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-pink-400">
          {t('loading.title')}
        </h1>
        
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-300 font-medium">{message}</span>
            <span className="text-slate-400">{percentage}%</span>
          </div>
          <div className="w-full bg-slate-800/50 rounded-full h-4">
            <div 
              className="bg-gradient-to-r from-purple-400 via-blue-400 to-pink-400 h-4 rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
        </div>
        
        {videoBlobForPreview && (
          <div className="mt-8 bg-slate-800/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-slate-200">视频预览</h3>
            <div className="relative" style={{
              paddingBottom: previewAspectRatio === '9:16' ? '177.78%' : '56.25%',
              backgroundColor: '#000',
              borderRadius: '0.5rem',
              overflow: 'hidden'
            }}>
              <video 
                src={URL.createObjectURL(videoBlobForPreview)} 
                className="absolute inset-0 w-full h-full object-contain"
                controls
              />
            </div>
          </div>
        )}
        
        {originalVideoBlobForPreview && (
          <div className="mt-8 bg-slate-800/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-slate-200">原始视频</h3>
            <div className="relative" style={{
              paddingBottom: previewAspectRatio === '9:16' ? '177.78%' : '56.25%',
              backgroundColor: '#000',
              borderRadius: '0.5rem',
              overflow: 'hidden'
            }}>
              <video 
                src={URL.createObjectURL(originalVideoBlobForPreview)} 
                className="absolute inset-0 w-full h-full object-contain"
                controls
              />
            </div>
          </div>
        )}
        
        <div className="mt-8 text-center text-slate-400 text-sm">
          <p>AI正在创建您的视频，这可能需要几分钟时间。</p>
          <p className="mt-2">请不要关闭此页面。</p>
        </div>
      </div>
    </div>
  );
};
