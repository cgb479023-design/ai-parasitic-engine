
import { VisualStyle, AspectRatio, HookType, GenerationMode, VideoEngine, GmicloudModelInfo } from './types';

type Translator = (key: string) => string;

export const getVisualStyleOptions = (t: Translator) => [
    { value: VisualStyle.CCTV, label: t('constants.visualStyle.cctv') },
    { value: VisualStyle.NIGHT_VISION, label: t('constants.visualStyle.nightVision') },
    { value: VisualStyle.DAYLIGHT, label: t('constants.visualStyle.daylight') },
    { value: VisualStyle.VHS_RETRO, label: t('constants.visualStyle.vhsRetro') },
    { value: VisualStyle.DOCUMENTARY_NATURE, label: t('constants.visualStyle.documentaryNature') },
    { value: VisualStyle.SCI_FI_HOLOGRAM, label: t('constants.visualStyle.sciFiHologram') },
];

export const getAspectRatioOptions = (t: Translator) => [
    { value: AspectRatio.VERTICAL, label: t('constants.aspectRatio.vertical') },
    { value: AspectRatio.HORIZONTAL, label: t('constants.aspectRatio.horizontal') },
    { value: AspectRatio.SQUARE, label: t('constants.aspectRatio.square') },
];

export const getHookTypeOptions = (t: Translator) => [
    { value: HookType.TIME_BASED, label: t('constants.hookType.timeBased'), description: t('constants.hookType.timeBasedDescription') },
    { value: HookType.VISUAL_CUE, label: t('constants.hookType.visualCue'), description: t('constants.hookType.visualCueDescription') },
];

export const getGenerationModeOptions = (t: Translator) => [
    { value: GenerationMode.AI_GENERATION, label: t('constants.generationMode.aiGeneration'), description: t('constants.generationMode.aiGenerationDescription') },
    { value: GenerationMode.SMART_EDITOR, label: t('constants.generationMode.smartEditor'), description: t('constants.generationMode.smartEditorDescription') },
    { value: GenerationMode.PROMPT_ONLY, label: t('constants.generationMode.promptOnly'), description: t('constants.generationMode.promptOnlyDescription') },
];

export const getEngineOptions = (t: Translator) => [
    { value: VideoEngine.VEO, label: t('constants.engine.veo') },
    { value: VideoEngine.GMICLOUD, label: t('constants.engine.gmicloud') },
    { value: VideoEngine.GEMINIGEN, label: t('constants.engine.geminigen') },
    { value: VideoEngine.GOOGLEVIDS, label: t('constants.engine.googlevids') },
];