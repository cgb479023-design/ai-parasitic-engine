/**
 * 类型定义文件
 * 统一导出所有类型定义，避免重复和不一致
 */

// 从统一类型文件导入
export * from './src/types/unifiedTypes';

// 全局声明保持不变
declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }

    interface Window {
        aistudio?: AIStudio;
        webkitAudioContext?: typeof AudioContext;
        // WebCodecs API types
        VideoEncoder?: typeof VideoEncoder;
        VideoDecoder?: typeof VideoDecoder;
        EncodedVideoChunk?: typeof EncodedVideoChunk;
        MediaStreamTrackProcessor?: unknown;
    }

    // requestVideoFrameCallback for HTMLVideoElement
    interface HTMLVideoElement {
        requestVideoFrameCallback(_callback: (_now: number, _metadata: VideoFrameCallbackMetadata) => void): number;
    }
}
