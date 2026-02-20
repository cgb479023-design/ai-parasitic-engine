// Output Display Component

import React from 'react';
import type { OutputData } from '../types';
import { RefreshCw, ArrowRight, Loader2 } from 'lucide-react';

interface OutputDisplayProps {
  output: OutputData | null;
  onReset: () => void;
  isMuxing?: boolean;
  onNext?: () => void;
}

export const OutputDisplay: React.FC<OutputDisplayProps> = ({ output, onReset, isMuxing = false, onNext }) => {
  if (!output) {
    return (
      <div className="max-w-3xl mx-auto mt-8 bg-slate-900/50 backdrop-blur-md border border-slate-800/50 rounded-2xl p-8 shadow-xl text-center">
        <h2 className="text-xl font-semibold mb-4 text-slate-300">生成结果将显示在这里</h2>
        <p className="text-slate-400">填写表单并点击"生成内容"按钮开始生成</p>
      </div>
    );
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Show a temporary success message
      const tempMessage = document.createElement('div');
      tempMessage.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      tempMessage.textContent = '已复制到剪贴板！';
      document.body.appendChild(tempMessage);
      setTimeout(() => tempMessage.remove(), 2000);
    });
  };

  const { marketingCopy, fullPrompt, viralityAnalysis } = output;

  return (
    <div className="max-w-3xl mx-auto mt-8 bg-slate-900/50 backdrop-blur-md border border-slate-800/50 rounded-2xl p-8 shadow-xl pb-24">
      <h1 className="text-2xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-pink-400">
        生成结果
      </h1>

      <div className="space-y-8">
        {/* Marketing Copy */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-slate-200">营销文案</h2>

          {/* Title */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2 text-slate-300">标题</h3>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-2">
              <p className="text-slate-200">{marketingCopy.title || '无标题'}</p>
            </div>
            <button
              onClick={() => copyToClipboard(marketingCopy.title || '')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              复制标题
            </button>
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2 text-slate-300">描述</h3>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-2 max-h-48 overflow-y-auto">
              <p className="text-slate-200">{marketingCopy.description || '无描述'}</p>
            </div>
            <button
              onClick={() => copyToClipboard(marketingCopy.description || '')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              复制描述
            </button>
          </div>

          {/* Tags */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2 text-slate-300">标签</h3>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-2">
              <div className="flex flex-wrap gap-2">
                {marketingCopy.tags.map((tag: string, index: number) => (
                  <span key={index} className="bg-slate-700/50 text-slate-300 px-3 py-1 rounded-full text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(marketingCopy.tags.join(','))}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              复制标签
            </button>
          </div>
        </div>

        {/* Virality Analysis */}
        {viralityAnalysis && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-slate-200">病毒传播分析</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
                  {viralityAnalysis.score}
                </div>
                <div className="text-sm text-slate-400">传播得分</div>
              </div>

              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-1">传播状态</div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium inline-block ${viralityAnalysis.status === 'Viral' ? 'bg-purple-600/50 text-purple-200' : viralityAnalysis.status === 'High' ? 'bg-green-600/50 text-green-200' : viralityAnalysis.status === 'Medium' ? 'bg-yellow-600/50 text-yellow-200' : 'bg-red-600/50 text-red-200'}`}>
                  {viralityAnalysis.status}
                </div>
              </div>
            </div>

            {/* Insights */}
            {viralityAnalysis.insights && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-slate-300">关键洞察</h3>
                <ul className="space-y-2">
                  {viralityAnalysis.insights.map((insight: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <span className="text-blue-400 mr-2 mt-1">•</span>
                      <span className="text-slate-300">{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* A/B Thumbnail Prompts */}
        {output.thumbnailPrompts && output.thumbnailPrompts.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-slate-200">缩略图 A/B 测试提示词</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {output.thumbnailPrompts.map((prompt: string, index: number) => (
                <div key={index} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400 font-medium">选项 {index + 1}</span>
                    <button
                      onClick={() => copyToClipboard(prompt)}
                      className="text-xs bg-blue-600/50 hover:bg-blue-600 text-blue-200 px-2 py-1 rounded transition-colors"
                    >
                      复制
                    </button>
                  </div>
                  <p className="text-slate-300 text-sm whitespace-pre-wrap">{prompt}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full Prompt */}
        {fullPrompt && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-slate-200">完整提示词</h2>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 max-h-60 overflow-y-auto">
              <pre className="text-slate-300 whitespace-pre-wrap">{fullPrompt}</pre>
            </div>
            <button
              onClick={() => copyToClipboard(fullPrompt)}
              className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              复制提示词
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-slate-950/80 backdrop-blur-xl border-t border-slate-800 flex justify-between items-center z-50">
        <button
          onClick={onReset}
          className="flex items-center px-6 py-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
          disabled={isMuxing}
        >
          <RefreshCw size={20} className="mr-2" />
          Create New Video
        </button>

        {onNext && (
          <button
            onClick={onNext}
            disabled={isMuxing}
            className="flex items-center px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMuxing ? (
              <>
                <Loader2 size={20} className="mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Continue to Analytics
                <ArrowRight size={20} className="ml-2" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
