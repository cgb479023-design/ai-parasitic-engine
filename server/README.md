# OAuth 后端服务器

快速启动 Google OAuth 认证服务器，支持前端应用进行用户授权。

## 功能特性

- ✅ Google OAuth2 授权流程
- ✅ 授权码交换令牌
- ✅ 令牌刷新机制
- ✅ 令牌验证端点
- ✅ 用户信息获取
- ✅ CORS 支持

## 快速开始

### 1. 配置 Google OAuth

1. 访问 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. 创建 OAuth 2.0 凭据（Web 应用）
3. 配置以下重定向 URI：

```
http://localhost:51122/oauth-callback
```

4. 记录 Client ID 和 Client Secret

### 2. 安装依赖

```bash
cd server
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入您的凭据
```

### 4. 启动服务器

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

服务器将在 `http://localhost:51122` 启动

## API 端点

### GET /auth/google
启动 OAuth 授权流程

**查询参数:**
- `state` (可选): 状态字符串，用于防 CSRF
- `redirect_uri` (可选): 最终重定向到的前端 URL

**响应:**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

### GET /oauth-callback
OAuth 回调端点（Google 重定向到此处）

**查询参数:**
- `code`: 授权码
- `state`: 状态字符串
- `redirect_uri` (可选): 最终重定向到的前端 URL

**行为:**
- 交换授权码获取访问令牌
- 验证令牌
- 重定向到前端并附带令牌

### POST /auth/refresh
刷新访问令牌

**请求体:**
```json
{
  "refresh_token": "1/..."
}
```

**响应:**
```json
{
  "access_token": "ya29...",
  "expiry_date": 1234567890,
  "scope": "https://www.googleapis.com/auth/cloud-platform ..."
}
```

### GET /auth/verify
验证访问令牌有效性

**查询参数:**
- `access_token`: 访问令牌

**响应:**
```json
{
  "valid": true,
  "email": "user@example.com",
  "scope": "...",
  "expires_in": 3599
}
```

### GET /auth/userinfo
获取已认证用户信息

**查询参数:**
- `access_token`: 访问令牌

**响应:**
```json
{
  "id": "123456789",
  "email": "user@example.com",
  "verified_email": true,
  "name": "John Doe",
  "given_name": "John",
  "family_name": "Doe",
  "picture": "https://...",
  "locale": "en"
}
```

### GET /health
健康检查端点

**响应:**
```json
{
  "status": "ok",
  "service": "AI Content Platform OAuth Server",
  "port": 51122
}
```

## 前端集成示例

### 1. 启动 OAuth 流程

```javascript
async function startOAuthFlow() {
  const response = await fetch('http://localhost:51122/auth/google?redirect_uri=' + encodeURIComponent(window.location.href));
  const { authUrl } = await response.json();
  
  // 保存当前 URL 以便回调后返回
  sessionStorage.setItem('oauth_return_url', window.location.href);
  
  // 重定向到 Google 授权页面
  window.location.href = authUrl;
}
```

### 2. 处理 OAuth 回调

```javascript
// 在页面加载时检查是否为 OAuth 回调
window.addEventListener('load', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const accessToken = urlParams.get('access_token');
  const refreshToken = urlParams.get('refresh_token');
  
  if (accessToken) {
    // 保存令牌到 localStorage
    localStorage.setItem('google_access_token', accessToken);
    if (refreshToken) {
      localStorage.setItem('google_refresh_token', refreshToken);
    }
    
    // 清除 URL 中的令牌参数
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // 令牌已就绪，可以使用
    console.log('OAuth 认证成功！');
  }
});
```

### 3. 使用访问令牌调用 Gemini API

```javascript
import { GoogleGenAI } from '@google/genai';

async function generateVideo(prompt) {
  const accessToken = localStorage.getItem('google_access_token');
  
  const ai = new GoogleGenAI({
    accessToken: accessToken  // 使用 OAuth 访问令牌
  });
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: prompt
  });
  
  return response.text;
}
```

### 4. 刷新令牌

```javascript
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('google_refresh_token');
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
  const response = await fetch('http://localhost:51122/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  
  const { access_token } = await response.json();
  localStorage.setItem('google_access_token', access_token);
  
  return access_token;
}
```

## OAuth 作用域

服务器默认请求以下作用域：

- `https://www.googleapis.com/auth/cloud-platform`: 访问 Google Cloud / Gemini API
- `https://www.googleapis.com/auth/userinfo.email`: 获取用户邮箱
- `https://www.googleapis.com/auth/userinfo.profile`: 获取用户基本信息

## 故障排查

### 1. 重定向 URI 不匹配

**错误:** `redirect_uri_mismatch`

**解决方案:** 确保 Google Console 中配置的重定向 URI 为 `http://localhost:51122/oauth-callback`

### 2. CORS 错误

**错误:** 前端无法访问后端 API

**解决方案:** 检查 `.env` 文件中的 `FRONTEND_URL` 是否正确

### 3. 令牌刷新失败

**错误:** `invalid_grant`

**解决方案:**
- 用户需要重新授权
- 确保首次授权时使用 `prompt=consent` 获取 refresh_token

### 4. 端口被占用

**错误:** `EADDRINUSE`

**解决方案:** 修改 `.env` 文件中的 `OAUTH_SERVER_PORT` 或关闭占用端口的程序

## 安全建议

1. **生产环境**: 使用 HTTPS
2. **令牌存储**: 考虑使用 HttpOnly Cookie 存储令牌，而非 localStorage
3. **CSRF 防护**: 始终使用 state 参数
4. **令牌验证**: 定期验证令牌有效性
5. **令牌刷新**: 实现自动令牌刷新机制

## 许可证

MIT
