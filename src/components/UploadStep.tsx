
import React, { useCallback } from 'react';
import { FormInput } from '../types';
import { Upload, ArrowLeft, FileVideo } from 'lucide-react';
import { LoadingButton } from './LoadingButton';

interface UploadStepProps {
    jobData: {
        formData: FormInput;
    };
    onUpload: (file: File) => Promise<void>;
    onBack: () => void;
    isVideoApiSupported: boolean;
}

export const UploadStep: React.FC<UploadStepProps> = ({ jobData, onUpload, onBack, isVideoApiSupported }) => {
    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            await onUpload(e.target.files[0]);
        }
    }, [onUpload]);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await onUpload(e.dataTransfer.files[0]);
        }
    }, [onUpload]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center space-y-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Upload Video for AI Processing
            </h2>

            <p className="text-slate-400 max-w-md">
                Upload a video to apply AI editing based on your instructions:
                <span className="text-slate-300 italic block mt-2">"{jobData.formData.editingInstructions}"</span>
            </p>

            <div
                className="border-2 border-dashed border-slate-700 rounded-xl p-10 w-full max-w-lg hover:border-blue-500/50 transition-colors cursor-pointer bg-slate-800/20"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    id="video-upload"
                    onChange={handleFileChange}
                />
                <label htmlFor="video-upload" className="flex flex-col items-center cursor-pointer">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 text-blue-400">
                        <Upload size={32} />
                    </div>
                    <span className="text-lg font-medium text-slate-200">Click to upload or drag video here</span>
                    <span className="text-sm text-slate-500 mt-2">Supported formats: MP4, MOV, WEBM</span>
                </label>
            </div>

            {!isVideoApiSupported && (
                <div className="p-4 bg-yellow-900/20 text-yellow-200 rounded-lg text-sm max-w-md border border-yellow-500/20">
                    ⚠️ Your browser doesn't support advanced video processing. Some AI features may be limited.
                </div>
            )}

            <button
                onClick={onBack}
                className="flex items-center text-slate-400 hover:text-white transition-colors"
            >
                <ArrowLeft size={16} className="mr-2" />
                Back to Settings
            </button>
        </div>
    );
};
