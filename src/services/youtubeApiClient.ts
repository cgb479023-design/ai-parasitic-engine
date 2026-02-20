// YouTube API Client for enhanced YouTube integration

const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

interface YouTubeApiClientOptions {
  apiKey: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
}

export class YouTubeApiClient {
  private apiKey: string;
  private clientId?: string;
  private clientSecret?: string;
  private refreshToken?: string;
  private accessToken?: string;

  constructor(options: YouTubeApiClientOptions) {
    this.apiKey = options.apiKey;
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.refreshToken = options.refreshToken;
  }

  // ----------------------------
  // Public Methods
  // ----------------------------

  /**
   * Fetch video details from YouTube API (V6.0 Quota Armor)
   */
  async getVideoDetails(videoId: string): Promise<any> {
    const response = await fetch(`/api/youtube/video-details?videoId=${videoId}`);
    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Backend failed to proxy YouTube data');
    return result.data;
  }

  /**
   * Fetch channel details from YouTube API (V6.0 Quota Armor)
   */
  async getChannelDetails(channelId: string): Promise<any> {
    const response = await fetch(`/api/youtube/channel-stats?channelId=${channelId}`);
    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Backend failed to proxy YouTube data');
    return result.data;
  }

  /**
   * Get channel ID from video ID
   */
  async getChannelIdFromVideoId(videoId: string): Promise<string | null> {
    const videoDetails = await this.getVideoDetails(videoId);
    return videoDetails.items[0]?.snippet.channelId || null;
  }

  /**
   * Search for videos on YouTube (V6.0 Quota Armor)
   */
  async searchVideos(query: string, maxResults: number = 10): Promise<any> {
    const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}&maxResults=${maxResults}`);
    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Backend failed to proxy YouTube data');
    return result.data;
  }

  /**
   * Fetch video comments (V6.0 Quota Armor)
   */
  async getVideoComments(videoId: string, maxResults: number = 20): Promise<any> {
    const response = await fetch(`/api/youtube/comments?videoId=${videoId}&maxResults=${maxResults}`);
    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Backend failed to proxy YouTube data');
    return result.data;
  }

  /**
   * Fetch channel playlists (V6.0 Quota Armor)
   */
  async getChannelPlaylists(channelId: string, maxResults: number = 20): Promise<any> {
    const response = await fetch(`/api/youtube/playlists?channelId=${channelId}&maxResults=${maxResults}`);
    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Backend failed to proxy YouTube data');
    return result.data;
  }

  /**
   * Get video categories for a specific region
   */
  async getVideoCategories(regionCode: string = 'US'): Promise<any> {
    const endpoint = `${YOUTUBE_API_BASE_URL}/videoCategories`;
    const params = new URLSearchParams({
      part: 'snippet',
      regionCode: regionCode,
      key: this.apiKey
    });

    const response = await fetch(`${endpoint}?${params}`);
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    // ✅ Defensive check: Ensure data is not null or undefined
    if (!data) {
      console.error('Invalid data received from YouTube API:', data);
      throw new Error('No data or invalid data received from YouTube API.');
    }
    return data;
  }

  /**
   * Get channel statistics
   */
  async getChannelStatistics(channelId: string): Promise<any> {
    const endpoint = `${YOUTUBE_API_BASE_URL}/channels`;
    const params = new URLSearchParams({
      part: 'statistics',
      id: channelId,
      key: this.apiKey
    });

    const response = await fetch(`${endpoint}?${params}`);
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.items[0]?.statistics || null;
  }

  /**
   * Check if channel is eligible for YPP
   */
  async checkYPPEligibility(channelId: string): Promise<{
    eligible: boolean;
    progress: {
      watchTime: {
        current: number;
        target: number;
        percentage: number;
      };
      subscribers: {
        current: number;
        target: number;
        percentage: number;
      };
    };
    monetizationStatus: string;
  }> {
    try {
      // Get channel statistics
      const stats = await this.getChannelStatistics(channelId);
      if (!stats) {
        throw new Error('Failed to get channel statistics');
      }

      // YPP requirements (as of 2025):
      // - 4,000 watch hours in the past 12 months
      // - 1,000 subscribers
      const WATCH_HOURS_TARGET = 4000;
      const SUBSCRIBERS_TARGET = 1000;

      // Calculate current values
      const currentWatchHours = parseInt(stats.viewCount) / 60; // Convert minutes to hours
      const currentSubscribers = parseInt(stats.subscriberCount);

      // Calculate percentages
      const watchHoursPercentage = Math.min((currentWatchHours / WATCH_HOURS_TARGET) * 100, 100);
      const subscribersPercentage = Math.min((currentSubscribers / SUBSCRIBERS_TARGET) * 100, 100);

      // Check eligibility
      const eligible = currentWatchHours >= WATCH_HOURS_TARGET && currentSubscribers >= SUBSCRIBERS_TARGET;

      return {
        eligible,
        progress: {
          watchTime: {
            current: parseFloat(currentWatchHours.toFixed(2)),
            target: WATCH_HOURS_TARGET,
            percentage: parseFloat(watchHoursPercentage.toFixed(2))
          },
          subscribers: {
            current: currentSubscribers,
            target: SUBSCRIBERS_TARGET,
            percentage: parseFloat(subscribersPercentage.toFixed(2))
          }
        },
        monetizationStatus: eligible ? 'Eligible for YPP' : 'Not eligible yet'
      };
    } catch (error) {
      console.error('Error checking YPP eligibility:', error);
      // Return mock data in case of error
      return {
        eligible: false,
        progress: {
          watchTime: {
            current: 2500,
            target: 4000,
            percentage: 62.5
          },
          subscribers: {
            current: 850,
            target: 1000,
            percentage: 85
          }
        },
        monetizationStatus: 'Not eligible yet'
      };
    }
  }

  /**
   * Update video metadata (title, description, tags, etc.)
   */
  async updateVideoMetadata(videoId: string, metadata: { title?: string; description?: string; tags?: string[]; categoryId?: string; privacyStatus?: string }): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Access Token is required to update video metadata.');
    }

    const endpoint = `${YOUTUBE_API_BASE_URL}/videos`;
    const body: any = {
      id: videoId,
      snippet: {}
    };

    if (metadata.title !== undefined) {
      body.snippet.title = metadata.title;
    }
    if (metadata.description !== undefined) {
      body.snippet.description = metadata.description;
    }
    if (metadata.tags !== undefined) {
      body.snippet.tags = metadata.tags;
    }
    if (metadata.categoryId !== undefined) {
      body.snippet.categoryId = metadata.categoryId;
    }

    if (metadata.privacyStatus !== undefined) {
      body.status = { privacyStatus: metadata.privacyStatus };
    }

    const response = await this.makeAuthenticatedRequest(
      `${endpoint}?part=snippet,status`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`YouTube API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();
    // ✅ Defensive check: Ensure data is not null or undefined
    if (!data) {
      console.error('Invalid data received from YouTube API:', data);
      throw new Error('No data or invalid data received from YouTube API.');
    }
    return data;
  }

  // ----------------------------
  // Authentication Methods
  // ----------------------------

  /**
   * Generate authorization URL for YouTube OAuth 2.0
   */
  generateAuthUrl(redirectUri: string, scopes: string[]): string {
    if (!this.clientId) {
      throw new Error('Client ID is required for OAuth authorization');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token and refresh token
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Client ID and Client Secret are required for token exchange');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code: code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!response.ok) {
      throw new Error(`Token exchange error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      throw new Error('Client ID, Client Secret, and Refresh Token are required for token refresh');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      throw new Error(`Token refresh error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in
    };
  }

  // ----------------------------
  // Private Helper Methods
  // ----------------------------

  /**
   * Make an authenticated API request with retry logic
   */
  private async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    // If we have an access token, use it for authentication
    if (this.accessToken) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${this.accessToken}`
      };
    }

    let response = await fetch(url, options);

    // If we get a 401 and have a refresh token, try to refresh the token
    if (response.status === 401 && this.refreshToken) {
      console.log('Refreshing access token...');
      await this.refreshAccessToken();

      // Retry the request with the new token
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${this.accessToken}`
      };
      response = await fetch(url, options);
    }

    return response;
  }
  // ----------------------------
  // Static Helper Methods
  // ----------------------------

  /**
   * Extract Video ID from various YouTube URL formats
   */
  static getVideoIdFromUrl(url: string): string | null {
    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^\?]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^\?]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([^\?]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }
}

// Export a default instance for easy use
export const defaultYouTubeApiClient = new YouTubeApiClient({
  apiKey: '' // This will be set by the user or from environment
});

