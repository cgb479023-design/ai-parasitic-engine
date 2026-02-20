// Re-export yppService from root services directory
// This allows src/components to import from ../services/yppService

export interface YppPlan {
    algorithmStage: string;
    stageAnalysis: string;
    schedule: Array<{
        pillar: string;
        type: string;
        tool: string;
        duration: string;
        publishTimeLocal: string;
        publishTimeUS: string;
        promptBlock: string;
        title: string;
        description: string;
        tags: string;
        pinnedComment: string;
        comments: string[];
    }>;
}

export const yppService = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    generatePlan: async (_analyticsData: any): Promise<YppPlan | null> => {
        console.log('[yppService] Mock generatePlan called');
        return null;
    },

    parseManualPlan: (inputJson: string): YppPlan | null => {
        try {
            let cleanJson = inputJson.trim();

            if (cleanJson.includes("S-Tier V3.0 YouTube")) throw new Error("Pasted PROMPT instead of JSON");

            const jsonBlockMatch = cleanJson.match(/```json\s*([\s\S]*?)\s*```/) || cleanJson.match(/```\s*([\s\S]*?)\s*```/);
            if (jsonBlockMatch) cleanJson = jsonBlockMatch[1];

            cleanJson = cleanJson.replace(/,(\s*[\]}])/g, '$1');

            let plan;
            try {
                plan = JSON.parse(cleanJson);
            } catch {
                console.warn("Retrying JSON fix...");
                plan = JSON.parse(cleanJson.replace(/}\s*{/g, '},{'));
            }
            return plan;
        } catch (e) {
            console.error("Manual Plan Parse Failed", e);
            return null;
        }
    },

    generateVideoGenUrl: (platform: 'geminigen' | 'googleflow' | 'googlevids', promptBlock: string): { url?: string, action?: string, payload?: any } => {
        if (platform === 'googlevids') {
            return {
                action: 'GOOGLE_VIDS_GENERATE',
                payload: { prompt: promptBlock }
            };
        } else if (platform === 'googleflow') {
            return {
                url: `https://labs.google/fx/tools/flow?prompt=${encodeURIComponent(promptBlock)}`
            };
        } else {
            return {
                url: `https://geminigen.ai/?prompt=${encodeURIComponent(promptBlock)}&model=veo-3-fast&ratio=9:16`
            };
        }
    },

    createUploadPayload: (index: number, item: any, videoBase64: string): any => {
        return {
            id: index,
            title: Array.isArray(item.title) ? item.title[0] : item.title,
            description: item.description,
            videoData: videoBase64,
            fileName: `ypp_sprint_${Date.now()}.mp4`,
            scheduleDate: item.scheduleDate,
            scheduleTime: item.scheduleTime,
            isShorts: true,
            pinnedComment: item.pinnedComment
        };
    },

    constructPrompt: (
        analyticsData: any,
        customInstructions: string = "",
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _performanceInsights: any = null
    ): string => {
        // Basic prompt construction for plan generation
        return `Generate a YPP plan based on the following analytics data:

${JSON.stringify(analyticsData, null, 2)}

${customInstructions}`;
    },

    sanitizePromptForVideoGen: (text: string): string => {
        return text;
    }
};
