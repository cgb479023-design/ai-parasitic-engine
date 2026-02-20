import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

async function testOAuthServer() {
  const BASE_URL = `http://localhost:${process.env.OAUTH_SERVER_PORT || 51122}`;

  console.log('='.repeat(60));
  console.log('🧪 OAuth Server Test Suite');
  console.log('='.repeat(60));

  // Test 1: Health Check
  console.log('\n[1/4] Testing health endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    
    if (data.status === 'ok') {
      console.log('✅ Health check passed');
      console.log(`   Service: ${data.service}`);
      console.log(`   Port: ${data.port}`);
    } else {
      throw new Error('Health check failed');
    }
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    console.log('   Make sure the server is running: npm run oauth:server');
    return;
  }

  // Test 2: Generate Auth URL
  console.log('\n[2/4] Testing auth URL generation...');
  try {
    const response = await fetch(`${BASE_URL}/auth/google?redirect_uri=http://localhost:4000`);
    const data = await response.json();
    
    if (data.authUrl && data.authUrl.includes('accounts.google.com')) {
      console.log('✅ Auth URL generated successfully');
      console.log(`   URL: ${data.authUrl.substring(0, 80)}...`);
    } else {
      throw new Error('Invalid auth URL response');
    }
  } catch (error) {
    console.log('❌ Auth URL generation failed:', error.message);
  }

  // Test 3: Test verify endpoint (without token)
  console.log('\n[3/4] Testing token verification (negative test)...');
  try {
    const response = await fetch(`${BASE_URL}/auth/verify`);
    const data = await response.json();
    
    if (data.error === 'Access token required') {
      console.log('✅ Token verification endpoint working (correctly rejects missing token)');
    } else {
      throw new Error('Unexpected response');
    }
  } catch (error) {
    console.log('❌ Token verification test failed:', error.message);
  }

  // Test 4: Test userinfo endpoint (without token)
  console.log('\n[4/4] Testing userinfo endpoint (negative test)...');
  try {
    const response = await fetch(`${BASE_URL}/auth/userinfo`);
    const data = await response.json();
    
    if (data.error === 'Access token required') {
      console.log('✅ Userinfo endpoint working (correctly rejects missing token)');
    } else {
      throw new Error('Unexpected response');
    }
  } catch (error) {
    console.log('❌ Userinfo test failed:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Basic tests completed!');
  console.log('='.repeat(60));
  console.log('\n📝 Manual OAuth Flow Test:');
  console.log('1. Open: http://localhost:51122/auth/google');
  console.log('2. Complete Google OAuth authorization');
  console.log('3. Check callback: http://localhost:51122/oauth-callback');
  console.log('='.repeat(60));
}

testOAuthServer().catch(console.error);
