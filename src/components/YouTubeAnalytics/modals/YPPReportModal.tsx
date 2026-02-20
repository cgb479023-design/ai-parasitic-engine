import React from 'react';
import { X, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface YPPReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    content: string;
}

export const YPPReportModal: React.FC<YPPReportModalProps> = ({ isOpen, onClose, content }) => {
    if (!isOpen) return null;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(content);
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-[#121212] border border-blue-500/30 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl shadow-blue-900/20">
                <div className="flex justify-between items-center p-5 border-b border-white/10 bg-[#1a1a1a] rounded-t-2xl">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="text-blue-400">📊</span> YPP Performance Analysis
                    </h3>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={copyToClipboard}
                            className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                            title="Copy Markdown"
                        >
                            <Copy className="w-5 h-5" />
                        </button>
                        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#0f0f0f]">
                    <div className="prose prose-invert max-w-none prose-headings:text-orange-400 prose-a:text-blue-400 prose-strong:text-white">
                        <ReactMarkdown>{content}</ReactMarkdown>
                    </div>
                </div>

                <div className="p-4 border-t border-white/10 bg-[#1a1a1a] rounded-b-2xl flex justify-between items-center text-xs text-slate-500">
                    <div>Generated via YPP Intelligence Engine</div>
                    <button onClick={onClose} className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold transition-colors">
                        Close Report
                    </button>
                </div>
            </div>
        </div>
    );
};
