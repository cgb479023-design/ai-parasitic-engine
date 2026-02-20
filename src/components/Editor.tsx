
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Play, Pause, Scissors, Type, Download, Layers } from 'lucide-react';
import { EditAction, OutputData, TranscriptItem } from '../types';
import { LoadingScreen } from './LoadingScreen';
import { OutputDisplay } from './OutputDisplay';

interface EditorProps {
    videoFile: File;
    initialInstructions: string;
    onReset: () => void;
    onExport: (actions: EditAction[], finalDuration: number, finalAspectRatio: string, model: string, transcript?: TranscriptItem[]) => void;
    apiKey: string;
    onApiKeyChange: (key: string) => void;
    outputData: OutputData | null;
    isProcessing: boolean;
    progress: number;
    isMuxing: boolean;
    onCloseOutput: () => void;
}

export const Editor: React.FC<EditorProps> = ({
    videoFile,
    initialInstructions,
    onReset,
    onExport,
    apiKey,
    onApiKeyChange,
    outputData,
    isProcessing,
    progress,
    isMuxing,
    onCloseOutput
}) => {
    const [videoUrl, setVideoUrl] = useState<string>('');
    const [instructions, setInstructions] = useState(initialInstructions);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        const url = URL.createObjectURL(videoFile);
        setVideoUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [videoFile]);

    const handleExportFromEditor = () => {
        onExport([], duration || 10, '9:16', 'veo');
    };

    const processEditedVideoWithAI = () => {
        console.log('Simulating AI processing of edited video...');
        // Placeholder for actual AI processing logic
    };

    const handleExportClick = () => {
        handleExportFromEditor();
        processEditedVideoWithAI();
    };

    if (outputData) {
        return (
            <div className="h-full overflow-hidden">
                <div className="p-4 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Export Result</h2>
                    <button onClick={onCloseOutput} className="text-slate-400 hover:text-white">
                        <ArrowLeft size={20} className="mr-2 inline" /> Back to Editor
                    </button>
                </div>
                <div className="h-[calc(100%-64px)] overflow-y-auto custom-scrollbar">
                    <OutputDisplay output={outputData} onReset={onReset} isMuxing={isMuxing} onNext={onReset} />
                </div>
            </div>
        );
    }

    if (isProcessing) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <LoadingScreen
                    progress={{ percentage: progress, messageKey: 'Processing Video...' }}
                    videoBlobForPreview={videoFile}
                    originalVideoBlobForPreview={null}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-950">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
                <div className="flex items-center overflow-auto custom-scrollbar">
                    <button onClick={onReset} className="mr-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
                        <ArrowLeft size={20} />
                    </button>
                    <h2 className="text-lg font-bold text-white whitespace-nowrap">{videoFile.name}</h2>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                    <button
                        onClick={handleExportClick}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center font-medium transition-colors"
                    >
                        <Download size={18} className="mr-2" />
                        Export
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Preview Area */}
                <div className="flex-1 bg-black flex items-center justify-center relative p-8">
                    {videoUrl && (
                        <video
                            src={videoUrl}
                            controls
                            className="max-h-full max-w-full shadow-2xl"
                            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                        />
                    )}
                </div>

                {/* Sidebar Controls */}
                <div className="w-80 bg-slate-900 border-l border-slate-800 p-6 flex flex-col overflow-y-auto custom-scrollbar">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">AI Instructions</h3>
                    <textarea
                        className="w-full h-32 bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white mb-6 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Describe how you want to edit this video..."
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                    />

                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Tools</h3>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <button className="flex flex-col items-center justify-center p-4 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors border border-slate-700">
                            <Scissors size={24} className="mb-2 text-purple-400" />
                            <span className="text-xs font-medium text-slate-300">Trim</span>
                        </button>
                        <button className="flex flex-col items-center justify-center p-4 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors border border-slate-700">
                            <Type size={24} className="mb-2 text-pink-400" />
                            <span className="text-xs font-medium text-slate-300">Text</span>
                        </button>
                        <button className="flex flex-col items-center justify-center p-4 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors border border-slate-700">
                            <Layers size={24} className="mb-2 text-blue-400" />
                            <span className="text-xs font-medium text-slate-300">Overlay</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
