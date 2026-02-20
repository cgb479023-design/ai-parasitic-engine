
import React, { useCallback } from 'react';
import { Upload, Video, Sparkles } from 'lucide-react';

interface UploadScreenProps {
    onVideoUpload: (file: File) => void;
}

export const UploadScreen: React.FC<UploadScreenProps> = ({ onVideoUpload }) => {
    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onVideoUpload(e.target.files[0]);
        }
    }, [onVideoUpload]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onVideoUpload(e.dataTransfer.files[0]);
        }
    }, [onVideoUpload]);

    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] p-6">
            <div className="text-center mb-10">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
                    AI Smart Editor
                </h1>
                <p className="text-slate-400 text-lg max-w-xl mx-auto">
                    Upload your raw footage and let our AI assemble, edit, and polish it into a masterpiece.
                </p>
            </div>

            <div
                className="w-full max-w-2xl aspect-video border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/50 hover:bg-slate-800/30 transition-all group bg-slate-900/40 relative overflow-hidden"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    id="smart-editor-upload"
                    onChange={handleFileChange}
                />

                <label htmlFor="smart-editor-upload" className="flex flex-col items-center z-10 w-full h-full justify-center">
                    <div className="relative mb-6">
                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center text-slate-300 group-hover:scale-110 transition-transform duration-300 shadow-xl border border-slate-700">
                            <Video size={36} />
                        </div>
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white animate-bounce-slow">
                            <Sparkles size={14} />
                        </div>
                    </div>

                    <span className="text-xl font-semibold text-slate-200 group-hover:text-white transition-colors">
                        Drop video here to start editing
                    </span>
                    <span className="text-slate-500 mt-2 text-sm">
                        Supports MP4, MOV, WEBM up to 2GB
                    </span>

                    <div className="mt-8 px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-full text-sm font-medium text-slate-300 transition-colors border border-slate-700">
                        Browse Files
                    </div>
                </label>
            </div>
        </div>
    );
};
