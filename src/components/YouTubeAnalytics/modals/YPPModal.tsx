import React from 'react';
import { X } from 'lucide-react';

interface YPPModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    children?: React.ReactNode;
}

export const YPPModal: React.FC<YPPModalProps> = ({ isOpen, onClose, onConfirm, title = "Generate Plan", children }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-[#1a1a1a] border border-orange-500/30 rounded-2xl w-full max-w-lg shadow-2xl shadow-orange-900/20 transform transition-all scale-100">
                <div className="flex justify-between items-center p-6 border-b border-white/10">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="text-orange-500">⚡</span> {title}
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6">
                    {children || <p className="text-slate-300">Are you sure you want to generate a new YPP plan? This will overwrite the current schedule.</p>}
                </div>

                <div className="flex justify-end gap-3 p-6 border-t border-white/10 bg-black/20 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-300 hover:text-white font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-6 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white rounded-lg font-bold shadow-lg shadow-orange-900/50 transition-all hover:scale-105 active:scale-95"
                    >
                        Confirm Generation
                    </button>
                </div>
            </div>
        </div>
    );
};
