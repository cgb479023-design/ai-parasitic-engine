
import React from 'react';
import { ArrowLeft, Copy, Check } from 'lucide-react';

interface PromptOutputDisplayProps {
    prompt: string;
    onReset: () => void;
}

export const PromptOutputDisplay: React.FC<PromptOutputDisplayProps> = ({ prompt, onReset }) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-6">
                Generated Prompt
            </h2>

            <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden relative group">
                <div className="p-6 font-mono text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {prompt}
                </div>
                <button
                    onClick={handleCopy}
                    className="absolute top-4 right-4 p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors border border-slate-600 text-slate-300"
                    title="Copy to clipboard"
                >
                    {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                </button>
            </div>

            <div className="mt-8 flex justify-center">
                <button
                    onClick={onReset}
                    className="flex items-center px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-all border border-slate-700"
                >
                    <ArrowLeft size={18} className="mr-2" />
                    Create Another
                </button>
            </div>
        </div>
    );
};
