/**
 * OAuth Integration Test
 * 
 * Tests OAuth authentication with Google GenAI API
 * Run this in browser console or as a dev tool
 */

// Test 1: Check OAuth Service
console.log('🧪 Test 1: Checking OAuth Service...');

async function testOAuthService() {
    try {
        const oauthService = await import('./services/oauthService');
        
        console.log('✅ OAuth Service loaded');
        console.log('Available functions:', Object.keys(oauthService));
        
        // Test authentication status
        const isAuthenticated = oauthService.isAuthenticated();
        console.log('🔑 Is Authenticated:', isAuthenticated);
        
        if (isAuthenticated) {
            const token = oauthService.getAccessToken();
            console.log('🎫 Access Token (first 50 chars):', token?.substring(0, 50));
            
            // Verify token
            const verification = await oauthService.verifyToken();
            console.log('📋 Token Verification:', verification);
            
            // Get user info
            const userInfo = await oauthService.getUserInfo();
            console.log('👤 User Info:', userInfo);
        } else {
            console.log('⚠️ Not authenticated. Call startOAuthFlow() to authenticate.');
        }
        
    } catch (error) {
        console.error('❌ OAuth Service Test Failed:', error);
    }
}

// Test 2: Test AI Client Creation with OAuth
console.log('\n🧪 Test 2: Testing AI Client Creation...');

async function testAiClient() {
    try {
        const geminiService = await import('./services/geminiService');
        const oauthService = await import('./services/oauthService');
        
        // Check if authenticated
        if (!oauthService.isAuthenticated()) {
            console.log('⚠️ Not authenticated. Skipping AI Client test.');
            return;
        }
        
        console.log('🔑 Creating AI client with OAuth...');
        const t = (key: string) => key; // Mock translator
        
        // This will automatically use OAuth if available
        const ai = await geminiService.createAiClient(t);
        console.log('✅ AI Client created');
        console.log('🤖 Client type:', ai.constructor.name);
        
    } catch (error) {
        console.error('❌ AI Client Creation Failed:', error);
    }
}

// Test 3: Test OAuth Flow
console.log('\n🧪 Test 3: Testing OAuth Flow...');

async function testOAuthFlow() {
    try {
        const oauthService = await import('./services/oauthService');
        
        console.log('📝 Starting OAuth flow...');
        console.log('⚠️ This will redirect to Google OAuth page');
        console.log('📋 After authentication, return here and run testOAuthService() again');
        
        await oauthService.startOAuthFlow();
        
    } catch (error) {
        console.error('❌ OAuth Flow Failed:', error);
    }
}

// Run all tests
async function runAllTests() {
    await testOAuthService();
    await testAiClient();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Tests Complete!');
    console.log('='.repeat(60));
    console.log('\n📋 Available Test Commands:');
    console.log('  testOAuthService() - Check OAuth status');
    console.log('  testAiClient() - Test AI client creation');
    console.log('  testOAuthFlow() - Start OAuth flow');
    console.log('='.repeat(60));
}

// Run tests
runAllTests();

// Export test functions for manual testing
window.testOAuthService = testOAuthService;
window.testAiClient = testAiClient;
window.testOAuthFlow = testOAuthFlow;

console.log('\n💡 Test functions exported to window:');
console.log('  - testOAuthService()');
console.log('  - testAiClient()');
console.log('  - testOAuthFlow()');
