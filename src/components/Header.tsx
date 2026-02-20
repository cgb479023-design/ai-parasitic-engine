// Header Component

import React from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { HelpCircle, BarChart2 } from 'lucide-react';

interface HeaderProps {
  onOpenManual?: () => void;
  onNavigateToAnalytics?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenManual, onNavigateToAnalytics }) => {
  const { t, language, setLanguage } = useLocalization();

  return (
    <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800/50 py-4 px-6 sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="text-purple-500 text-2xl font-bold">AI</div>
          <div className="text-blue-500 text-2xl font-bold">创作</div>
          <div className="text-pink-500 text-2xl font-bold">平台</div>
        </div>

        <nav className="flex items-center space-x-6">
          <div className="flex space-x-2 bg-slate-800/50 rounded-lg p-1">
            <button
              className="px-4 py-2 rounded-md font-medium transition-all bg-blue-600 text-white shadow-lg shadow-blue-500/20"
            >
              内容生成器
            </button>
            {onNavigateToAnalytics && (
              <button
                onClick={onNavigateToAnalytics}
                className="px-4 py-2 rounded-md font-medium transition-all text-slate-300 hover:text-blue-400 hover:bg-slate-700/50 flex items-center space-x-2"
              >
                <BarChart2 size={18} />
                <span>YouTube分析</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {onOpenManual && (
              <button
                onClick={onOpenManual}
                className="p-2 text-slate-400 hover:text-purple-400 transition-colors"
                title="User Manual"
              >
                <HelpCircle size={20} />
              </button>
            )}

            <button
              onClick={() => setLanguage('zh')}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${language === 'zh' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              中文
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${language === 'en' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              EN
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
};
