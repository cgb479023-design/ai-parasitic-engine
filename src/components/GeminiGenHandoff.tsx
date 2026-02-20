
import React, { useEffect, useState } from 'react';
import { FormInput } from '../types';
import { ExternalLink, RefreshCw, ArrowLeft, Terminal } from 'lucide-react';

interface GeminiGenHandoffProps {
    formData: FormInput;
    fullPrompt?: string;
    onVideoSubmit: (url: string) => void;
    onBack: () => void;
}

export const GeminiGenHandoff: React.FC<GeminiGenHandoffProps> = ({ formData, fullPrompt, onVideoSubmit, onBack }) => {
    const [status, setStatus] = useState<string>('Waiting for GeminiGen...');
    const [manualUrl, setManualUrl] = useState('');

    useEffect(() => {
        // Listen for messages from extension/user-script
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'GEMINI_VIDEO_RESULT' && event.data.payload?.url) {
                setStatus('Video detected!');
                onVideoSubmit(event.data.payload.url);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [onVideoSubmit]);

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualUrl.trim()) {
            onVideoSubmit(manualUrl.trim());
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 max-w-2xl mx-auto text-center">
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse text-blue-400 border border-blue-500/20">
                <RefreshCw size={32} className="animate-spin-slow" />
            </div>

            <h2 className="text-3xl font-bold text-white mb-4">
                Automation in Progress
            </h2>

            <p className="text-slate-400 mb-8 max-w-lg">
                We've opened GeminiGen in a new tab to generate your video.
                Please wait for the automation to complete. This usually takes 1-3 minutes.
            </p>

            <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6 w-full text-left mb-8">
                <div className="flex items-center text-slate-300 mb-4 border-b border-slate-700 pb-2">
                    <Terminal size={16} className="mr-2 text-blue-400" />
                    <span className="font-mono text-sm">Status Log</span>
                </div>
                <div className="font-mono text-sm text-green-400">
                    {'>'} Initialized handoff<br />
                    {'>'} Prompt generated<br />
                    {'>'} Waiting for external tool...<br />
                    {'>'} {status}
                </div>
            </div>

            <div className="w-full max-w-md bg-slate-900 rounded-xl p-6 border border-slate-800">
                <h3 className="text-sm font-medium text-slate-400 mb-3 text-left">Manual Override:</h3>
                <form onSubmit={handleManualSubmit} className="flex gap-2">
                    <input
                        type="url"
                        placeholder="Paste video URL if automation fails..."
                        className="flex-1 bg-slate-800 border-none rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500"
                        value={manualUrl}
                        onChange={(e) => setManualUrl(e.target.value)}
                    />
                    <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                    >
                        Submit
                    </button>
                </form>
            </div>

            <button
                onClick={onBack}
                className="mt-8 text-slate-500 hover:text-slate-300 flex items-center transition-colors text-sm"
            >
                <ArrowLeft size={16} className="mr-1" />
                Cancel & Return
            </button>
        </div>
    );
};
