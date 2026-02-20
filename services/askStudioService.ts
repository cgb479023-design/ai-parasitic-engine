// Ask Studio Service with Robust Error Handling and Recovery
// Handles Ask Studio AI planning with boundary condition management

import { globalLogger } from './globalLogger';
import { errorRecoveryService } from './errorRecoveryService';

interface AskStudioRequest {
  prompt: string;
  channelId: string;
  historyData: any;
}

interface AskStudioResponse {
  success: boolean;
  jsonData: any;
  rawResponse: string;
}

interface PlanGenResult {
  yppSprint: any;
  channelOverview: any;
  retention: any;
  velocity: any;
  videoPerformance: any;
  audience: any;
  traffic: any;
  engagement: any;
  comments: any;
  rewatch: any;
  swipeAway: any;
  subsConversion: any;
  sessionTime: any;
}

export class AskStudioService {
  private fallbackStrategies = {
    // Generate a保底策划案 when AI fails
    generateFallbackPlan: async (channelId: string): Promise<PlanGenResult> => {
      globalLogger.warn('AskStudio', 'Generating fallback plan for channel', { channelId });
      
      // Create a basic fallback plan with default values
      return {
        yppSprint: { videos: [] },
        channelOverview: { total_subscribers: 0, total_watch_time: 0, total_videos: 0 },
        retention: { average_view_percentage: 50 },
        velocity: { first_hour_views: 100 },
        videoPerformance: { top_videos: [] },
        audience: { top_countries: [] },
        traffic: { shorts_feed_percentage: 30 },
        engagement: { total_likes: 0, total_comments: 0 },
        comments: { total_comments: 0 },
        rewatch: { rewatch_ratio: 1.0 },
        swipeAway: { swipe_away_rate: 20 },
        subsConversion: { conversion_rate: 1.0 },
        sessionTime: { avg_session_time: 60 }
      };
    },

    // Parse JSON with robust error handling
    parseJsonWithRecovery: (rawResponse: string): any => {
      try {
        // Basic cleanup
        let cleanedJson = rawResponse.trim();
        
        // Remove markdown code blocks
        cleanedJson = cleanedJson.replace(/^```json\s*|\s*```$/g, '');
        cleanedJson = cleanedJson.replace(/^```\s*|\s*```$/g, '');
        
        // Fix common JSON issues
        cleanedJson = cleanedJson.replace(/,\s*([}\]])/g, '$1'); // Remove trailing commas
        cleanedJson = cleanedJson.replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
        cleanedJson = cleanedJson.replace(/\\([^"\\\/bfnrtu])/g, '\\$1'); // Fix invalid escape sequences
        
        return JSON.parse(cleanedJson);
      } catch (error) {
        globalLogger.error('AskStudio', 'JSON parsing failed, attempting aggressive recovery', {
          error: (error as Error).message,
          rawResponse: rawResponse.substring(0, 200) + '...'
        });
        
        // Aggressive recovery: Try to extract JSON object from text
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch (innerError) {
            globalLogger.error('AskStudio', 'Aggressive JSON recovery failed', {
              error: (innerError as Error).message,
              matchedJson: jsonMatch[0].substring(0, 200) + '...'
            });
          }
        }
        
        throw error;
      }
    }
  };

  constructor() {
    // Register Ask Studio specific fallback strategies
    errorRecoveryService.registerFallbackStrategy({
      name: 'askStudioFallback',
      execute: async <PlanGenResult>(error: Error): Promise<PlanGenResult> => {
        globalLogger.warn('AskStudio', 'Using Ask Studio specific fallback', {
          error: error.message
        });
        return this.fallbackStrategies.generateFallbackPlan('unknown') as unknown as PlanGenResult;
      }
    });
  }

  /**
   * Generate plan using Ask Studio AI with robust error handling
   */
  async generatePlan(request: AskStudioRequest): Promise<PlanGenResult> {
    const startTime = Date.now();
    
    try {
      return await errorRecoveryService.executeWithRecovery(
        'AskStudio',
        'generatePlan',
        async () => {
          const response = await this.callAskStudioAPI(request);
          
          if (!response.success) {
            throw new Error(`Ask Studio API failed: ${response.rawResponse.substring(0, 100)}...`);
          }
          
          // Parse JSON with robust error handling
          const parsedData = this.fallbackStrategies.parseJsonWithRecovery(response.rawResponse);
          
          // Verify all required categories are present
          const requiredCategories = [
            'yppSprint', 'channelOverview', 'retention', 'velocity', 
            'videoPerformance', 'audience', 'traffic', 'engagement',
            'comments', 'rewatch', 'swipeAway', 'subsConversion', 'sessionTime'
          ];
          
          const missingCategories = requiredCategories.filter(cat => !parsedData[cat]);
          if (missingCategories.length > 0) {
            globalLogger.warn('AskStudio', 'Missing categories in response, using partial data', {
              missingCategories,
              availableCategories: Object.keys(parsedData)
            });
          }
          
          // Build result with fallback for missing categories
          const result: PlanGenResult = {
            yppSprint: parsedData.yppSprint || { videos: [] },
            channelOverview: parsedData.channelOverview || { total_subscribers: 0, total_watch_time: 0, total_videos: 0 },
            retention: parsedData.retention || { average_view_percentage: 50 },
            velocity: parsedData.velocity || { first_hour_views: 100 },
            videoPerformance: parsedData.videoPerformance || { top_videos: [] },
            audience: parsedData.audience || { top_countries: [] },
            traffic: parsedData.traffic || { shorts_feed_percentage: 30 },
            engagement: parsedData.engagement || { total_likes: 0, total_comments: 0 },
            comments: parsedData.comments || { total_comments: 0 },
            rewatch: parsedData.rewatch || { rewatch_ratio: 1.0 },
            swipeAway: parsedData.swipeAway || { swipe_away_rate: 20 },
            subsConversion: parsedData.subsConversion || { conversion_rate: 1.0 },
            sessionTime: parsedData.sessionTime || { avg_session_time: 60 }
          };
          
          return result;
        },
        {
          maxRetries: 3,
          retryDelay: 2000,
          backoffMultiplier: 2,
          fallbackStrategy: 'askStudioFallback',
          timeout: 60000
        }
      );
    } finally {
      const duration = Date.now() - startTime;
      globalLogger.trackPerformance('AskStudio', 'generatePlan', duration, {
        channelId: request.channelId,
        promptLength: request.prompt.length
      });
    }
  }

  /**
   * Call Ask Studio API with boundary condition handling
   */
  private async callAskStudioAPI(request: AskStudioRequest): Promise<AskStudioResponse> {
    // Simulate the API call with boundary condition management
    // In production, this would be an actual API call or browser automation
    
    // Check for empty prompt
    if (!request.prompt || request.prompt.trim() === '') {
      throw new Error('Empty prompt provided to Ask Studio');
    }
    
    // Check for valid channel ID
    if (!request.channelId || request.channelId.trim() === '') {
      throw new Error('Invalid channel ID provided');
    }
    
    // Simulate API response with random failure for testing
    const randomFailure = Math.random() < 0.1; // 10% failure rate for testing
    
    if (randomFailure) {
      return {
        success: false,
        jsonData: null,
        rawResponse: 'API timeout occurred'
      };
    }
    
    // Return mock successful response
    const mockResponse = {
      yppSprint: { videos: [{ title: 'Test Video 1' }] },
      channelOverview: { total_subscribers: 1000, total_watch_time: 422159, total_videos: 675 },
      retention: { average_view_percentage: 50 },
      velocity: { first_hour_views: 100 },
      videoPerformance: { top_videos: [{ title: 'Top Video' }] },
      audience: { top_countries: ['US', 'CA'] },
      traffic: { shorts_feed_percentage: 30 },
      engagement: { total_likes: 100, total_comments: 10 },
      comments: { total_comments: 10 },
      rewatch: { rewatch_ratio: 1.2 },
      swipeAway: { swipe_away_rate: 20 },
      subsConversion: { conversion_rate: 2.0 },
      sessionTime: { avg_session_time: 60 }
    };
    
    return {
      success: true,
      jsonData: mockResponse,
      rawResponse: JSON.stringify(mockResponse, null, 2)
    };
  }

  /**
   * Process fullReport from Ask Studio with boundary condition handling
   */
  async processFullReport(rawResponse: string, channelId: string): Promise<PlanGenResult> {
    globalLogger.info('AskStudio', 'Processing fullReport from Ask Studio', { channelId });
    
    try {
      return await errorRecoveryService.executeWithRecovery(
        'AskStudio',
        'processFullReport',
        async () => {
          // Parse JSON with robust error handling
          const parsedData = this.fallbackStrategies.parseJsonWithRecovery(rawResponse);
          
          // Validate parsed data structure
          if (typeof parsedData !== 'object' || parsedData === null) {
            throw new Error('Invalid JSON structure: expected object');
          }
          
          // Create result with validation
          return this.validateAndFormatResult(parsedData);
        },
        {
          maxRetries: 2,
          retryDelay: 1000,
          fallbackStrategy: 'askStudioFallback',
          timeout: 30000
        }
      );
    } catch (error) {
      globalLogger.error('AskStudio', 'Failed to process fullReport', {
        channelId,
        error: (error as Error).message,
        rawResponseLength: rawResponse.length
      });
      throw error;
    }
  }

  /**
   * Validate and format the result with boundary condition checks
   */
  private validateAndFormatResult(data: any): PlanGenResult {
    // Validate each category has reasonable values
    const validateNumericValue = (value: any, defaultValue: number, min: number = 0, max?: number): number => {
      if (typeof value !== 'number' || isNaN(value)) {
        return defaultValue;
      }
      if (value < min) return min;
      if (max !== undefined && value > max) return max;
      return value;
    };

    return {
      yppSprint: {
        videos: Array.isArray(data.yppSprint?.videos) ? data.yppSprint.videos : []
      },
      channelOverview: {
        total_subscribers: validateNumericValue(data.channelOverview?.total_subscribers, 0),
        total_watch_time: validateNumericValue(data.channelOverview?.total_watch_time, 0),
        total_videos: validateNumericValue(data.channelOverview?.total_videos, 0)
      },
      retention: {
        average_view_percentage: validateNumericValue(data.retention?.average_view_percentage, 50, 0, 100)
      },
      velocity: {
        first_hour_views: validateNumericValue(data.velocity?.first_hour_views, 100, 0)
      },
      videoPerformance: {
        top_videos: Array.isArray(data.videoPerformance?.top_videos) ? data.videoPerformance.top_videos : []
      },
      audience: {
        top_countries: Array.isArray(data.audience?.top_countries) ? data.audience.top_countries : []
      },
      traffic: {
        shorts_feed_percentage: validateNumericValue(data.traffic?.shorts_feed_percentage, 30, 0, 100)
      },
      engagement: {
        total_likes: validateNumericValue(data.engagement?.total_likes, 0),
        total_comments: validateNumericValue(data.engagement?.total_comments, 0)
      },
      comments: {
        total_comments: validateNumericValue(data.comments?.total_comments, 0)
      },
      rewatch: {
        rewatch_ratio: validateNumericValue(data.rewatch?.rewatch_ratio, 1.0, 0, 10)
      },
      swipeAway: {
        swipe_away_rate: validateNumericValue(data.swipeAway?.swipe_away_rate, 20, 0, 100)
      },
      subsConversion: {
        conversion_rate: validateNumericValue(data.subsConversion?.conversion_rate, 1.0, 0, 100)
      },
      sessionTime: {
        avg_session_time: validateNumericValue(data.sessionTime?.avg_session_time, 60, 0, 3600)
      }
    };
  }
}

// Export singleton instance
export const askStudioService = new AskStudioService();
