import { YppPlan } from './yppService';

export interface AskStudioResponse {
  success: boolean;
  data?: YppPlan;
  error?: string;
}

export interface AskStudioService {
  generatePlan: (input: string, customParams?: Record<string, any>) => Promise<AskStudioResponse>;
  validatePlan: (plan: any) => boolean;
  sanitizePlanData: (plan: any) => YppPlan;
}

export const askStudioService: AskStudioService = {
  /**
   * 生成Ask Studio计划
   * @param input 输入提示
   * @param customParams 自定义参数
   * @returns 计划生成结果
   */
  generatePlan: async (input: string, customParams: Record<string, any> = {}): Promise<AskStudioResponse> => {
    console.log('[AskStudioService] Requesting plan generation...', { input });

    return new Promise((resolve) => {
      let timeoutId: NodeJS.Timeout;

      // Listener for the result from background -> content -> window message
      const resultListener = (event: MessageEvent) => {
        if (event.data?.type === 'ASK_STUDIO_PLAN_RESULT' || event.data?.type === 'YPP_PLAN_RESULT') {
          const { payload, isHeartbeat } = event.data;

          // 🎯 HEARTBEAT: Reset timeout if extension is still working
          if (isHeartbeat) {
            console.log('[AskStudioService] Heartbeat received. Resetting 300s timeout.');
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
              window.removeEventListener('message', resultListener);
              console.warn('[AskStudioService] Request timed out after 600s heartbeat period.');
              resolve({ success: false, error: 'Request timed out (600s)' });
            }, 600000);
            return;
          }

          // Cleanup
          window.removeEventListener('message', resultListener);
          clearTimeout(timeoutId);

          console.log('[AskStudioService] Received plan result:', payload ? payload.substring(0, 100) + '...' : 'null');

          if (!payload) {
            resolve({ success: false, error: 'Empty payload received' });
            return;
          }

          try {
            // Check if payload is already an object or a string
            let parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;

            // Check for explicit error response
            if (parsed.success === false || parsed.error) {
              resolve({
                success: false,
                error: parsed.error || 'Unknown error from Studio Agent'
              });
              return;
            }

            // Clean weird markdown if present (legacy support)
            if (typeof parsed === 'string') {
              // Try aggressive re-parsing if the first parse returned a string (double encoded)
              try { parsed = JSON.parse(parsed); } catch (e) { }
            }

            // Validate structure
            const isValid = askStudioService.validatePlan(parsed);
            if (!isValid) {
              // Try to salvage if it's wrapped in a 'data' field
              if (parsed.data && askStudioService.validatePlan(parsed.data)) {
                parsed = parsed.data;
              } else {
                console.error('[AskStudioService] Invalid plan structure:', parsed);
                resolve({ success: false, error: 'Generated plan has invalid structure' });
                return;
              }
            }

            // Sanitize and return
            const sanitized = askStudioService.sanitizePlanData(parsed);
            resolve({ success: true, data: sanitized });

          } catch (e) {
            console.error('[AskStudioService] Failed to parse plan JSON:', e);
            resolve({ success: false, error: 'Failed to parse plan JSON from Agent' });
          }
        }
      };

      // Set up listener
      window.addEventListener('message', resultListener);

      // Timeout (10 minutes for slow AI generation - Constitution Sync)
      timeoutId = setTimeout(() => {
        window.removeEventListener('message', resultListener);
        console.warn('[AskStudioService] Request timed out after 600s master timer.');
        resolve({ success: false, error: 'Request timed out (600s)' });
      }, 600000);

      // Send Request
      const JSON_SCHEMA_PROMPT = `
CRITICAL: You MUST respond EXCLUSIVELY with valid JSON. NO OTHER TEXT. 
Structure:
{
  "algorithmStage": "Viral/Retention/Growth/Monetization",
  "stageAnalysis": "Brief context why we are here",
  "schedule": [
    {
      "pillar": "Trend/Core/Search",
      "type": "Short/Long",
      "tool": "geminigen",
      "duration": "number as string (e.g. '30')",
      "publishTimeLocal": "YYYY/MM/DD HH:MM",
      "publishTimeUS": "YYYY/MM/DD HH:MM",
      "promptBlock": "Detailed video creation prompt",
      "title": "Viral Title",
      "description": "Engaging description",
      "tags": ["tag1", "tag2"],
      "pinnedComment": "Strategic first comment"
    }
  ]
}
`;
      const fullPrompt = input + "\n\n" + JSON_SCHEMA_PROMPT;

      console.log('[AskStudioService] Posting ASK_STUDIO_GENERATE_PLAN message');
      window.postMessage({
        type: 'ASK_STUDIO_GENERATE_PLAN',
        prompt: fullPrompt,
        payload: {
          ...customParams,
          directPrompt: input,
          isPlan: true
        }
      }, '*');
    });
  },

  /**
   * 验证计划数据格式
   * @param plan 计划数据
   * @returns 是否有效
   */
  validatePlan: (plan: any): boolean => {
    if (!plan) return false;
    if (typeof plan !== 'object') return false;
    if (!plan.algorithmStage) return false;
    if (!plan.stageAnalysis) return false;
    if (!Array.isArray(plan.schedule)) return false;
    if (plan.schedule.length === 0) return false;

    // 验证计划中的每个视频项
    for (const item of plan.schedule) {
      if (!item.pillar) return false;
      if (!item.type) return false;
      if (!item.tool) return false;
      if (!item.duration) return false;
      if (!item.publishTimeLocal) return false;
      if (!item.promptBlock) return false;
      if (!item.title) return false;
      if (!item.description) return false;
      if (!item.tags) return false;
    }

    return true;
  },

  /**
   * 清理和格式化计划数据
   * @param plan 原始计划数据
   * @returns 清理后的计划数据
   */
  sanitizePlanData: (plan: any): YppPlan => {
    return {
      algorithmStage: plan.algorithmStage || 'unknown',
      stageAnalysis: plan.stageAnalysis || '',
      schedule: (plan.schedule || []).map((item: any) => ({
        pillar: item.pillar || '',
        type: item.type || 'short',
        tool: item.tool || 'geminigen',
        duration: item.duration || '30',
        publishTimeLocal: item.publishTimeLocal || new Date().toISOString(),
        publishTimeUS: item.publishTimeUS || new Date().toISOString(),
        promptBlock: item.promptBlock || '',
        title: item.title || 'Untitled',
        description: item.description || '',
        tags: item.tags || '',
        pinnedComment: item.pinnedComment || '',
        comments: Array.isArray(item.comments) ? item.comments : []
      }))
    };
  }
};
