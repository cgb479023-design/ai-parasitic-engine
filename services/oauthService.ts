/**
 * OAuth Service
 * 
 * Handles Google OAuth2 authentication flow for the AI Content Platform.
 * Manages token storage, refresh, and API calls.
 * 
 * @module services/oauthService
 * @version 1.0.0
 * @date 2026-01-15
 */

const OAUTH_SERVER_URL = (globalThis as any).VITE_OAUTH_SERVER_URL || 'http://localhost:51122';
const STORAGE_ACCESS_TOKEN = 'google_access_token';
const STORAGE_REFRESH_TOKEN = 'google_refresh_token';
const STORAGE_TOKEN_EXPIRY = 'google_token_expiry';
const STORAGE_USER_INFO = 'google_user_info';

/**
 * OAuth configuration
 */
export interface OAuthConfig {
  serverUrl?: string;
  clientId?: string;
}

/**
 * Token information
 */
export interface TokenInfo {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  scope?: string;
}

/**
 * User information
 */
export interface UserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

/**
 * Start OAuth flow
 * Redirects user to Google OAuth authorization page
 */
export async function startOAuthFlow(redirectUri?: string): Promise<void> {
  const state = generateState();
  sessionStorage.setItem('oauth_state', state);
  sessionStorage.setItem('oauth_return_url', window.location.href);

  const params = new URLSearchParams({
    redirect_uri: redirectUri || window.location.origin + window.location.pathname
  });

  const response = await fetch(`${OAUTH_SERVER_URL}/auth/google?${params.toString()}`);
  const { authUrl } = await response.json();

  if (!authUrl) {
    throw new Error('Failed to get authorization URL');
  }

  window.location.href = authUrl;
}

/**
 * Handle OAuth callback
 * Extracts tokens from URL parameters and stores them
 */
export function handleOAuthCallback(): TokenInfo | null {
  const urlParams = new URLSearchParams(window.location.search);
  const accessToken = urlParams.get('access_token');
  const refreshToken = urlParams.get('refresh_token');
  const error = urlParams.get('error');

  if (error) {
    console.error('[OAuth] Error:', error);
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('oauth_return_url');
    return null;
  }

  if (!accessToken) {
    return null;
  }

  // Store tokens
  localStorage.setItem(STORAGE_ACCESS_TOKEN, accessToken);
  if (refreshToken) {
    localStorage.setItem(STORAGE_REFRESH_TOKEN, refreshToken);
  }

  // Clear URL parameters
  window.history.replaceState({}, document.title, window.location.pathname);

  return {
    access_token: accessToken,
    refresh_token: refreshToken || undefined
  };
}

/**
 * Get stored access token
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_ACCESS_TOKEN);
}

/**
 * Get stored refresh token
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_REFRESH_TOKEN);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const token = getAccessToken();
  return !!token;
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new Error('No refresh token available. User needs to re-authorize.');
  }

  try {
    const response = await fetch(`${OAUTH_SERVER_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    localStorage.setItem(STORAGE_ACCESS_TOKEN, data.access_token);
    
    if (data.expiry_date) {
      localStorage.setItem(STORAGE_TOKEN_EXPIRY, String(data.expiry_date));
    }

    return data.access_token;
  } catch (error: any) {
    console.error('[OAuth] Refresh failed:', error.message);
    throw error;
  }
}

/**
 * Verify access token validity
 */
export async function verifyToken(): Promise<{ valid: boolean; email?: string; scope?: string } | null> {
  const token = getAccessToken();

  if (!token) {
    return { valid: false };
  }

  try {
    const response = await fetch(`${OAUTH_SERVER_URL}/auth/verify?access_token=${encodeURIComponent(token)}`);
    const data = await response.json();

    return data;
  } catch (error: any) {
    console.error('[OAuth] Verify failed:', error.message);
    return null;
  }
}

/**
 * Get user information
 */
export async function getUserInfo(): Promise<UserInfo | null> {
  const token = getAccessToken();

  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${OAUTH_SERVER_URL}/auth/userinfo?access_token=${encodeURIComponent(token)}`);
    const data = await response.json();

    if (response.ok) {
      localStorage.setItem(STORAGE_USER_INFO, JSON.stringify(data));
      return data;
    }

    return null;
  } catch (error: any) {
    console.error('[OAuth] Get user info failed:', error.message);
    return null;
  }
}

/**
 * Get cached user information
 */
export function getCachedUserInfo(): UserInfo | null {
  const cached = localStorage.getItem(STORAGE_USER_INFO);
  return cached ? JSON.parse(cached) : null;
}

/**
 * Logout - Clear all stored tokens
 */
export function logout(): void {
  localStorage.removeItem(STORAGE_ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_TOKEN_EXPIRY);
  localStorage.removeItem(STORAGE_USER_INFO);
  sessionStorage.removeItem('oauth_state');
  sessionStorage.removeItem('oauth_return_url');
}

/**
 * Generate random state string for CSRF protection
 */
function generateState(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15) + 
         Date.now().toString(36);
}

/**
 * Get access token with auto-refresh
 */
export async function getValidAccessToken(): Promise<string> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token. User needs to authorize.');
  }

  // Verify token validity
  const verification = await verifyToken();
  
  if (verification && verification.valid) {
    return token;
  }

  // Token is invalid or expired, try to refresh
  console.log('[OAuth] Token expired, refreshing...');
  return await refreshAccessToken();
}

/**
 * Create GoogleGenAI client with OAuth token
 * Note: Currently, the SDK requires API key. OAuth tokens need to be set as environment variable
 * or passed through custom headers in a different implementation.
 */
export async function createAuthenticatedClient() {
  const { GoogleGenAI } = await import('@google/genai');
  const accessToken = await getValidAccessToken();
  
  // For OAuth usage, we need to set the token as environment variable or use custom headers
  // The SDK currently supports API key. OAuth integration may require:
  // 1. Setting process.env.GOOGLE_GENAI_USE_AUTH = 'true'
  // 2. Passing token through custom request interceptor
  
  // Temporary workaround: Return the access token to be used with direct API calls
  console.warn('[OAuth] SDK OAuth support is limited. Use getValidAccessToken() for custom API calls.');
  
  return {
    client: new GoogleGenAI({ apiKey: '' }), // Placeholder
    accessToken
  };
}

/**
 * Get authentication headers for direct API calls
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const accessToken = await getValidAccessToken();
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
}
