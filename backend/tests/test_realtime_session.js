/**
 * Test script for Realtime Voice Session API
 * Tests the /api/realtime/session endpoint
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

// Supabase client for auth
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getAuthToken() {
  const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword123';

  const { data, error } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (error) {
    console.error('Auth failed:', error.message);
    return null;
  }

  return data.session?.access_token;
}

async function testSessionEndpoint() {
  console.log('\n=== Testing /api/realtime/session endpoint ===\n');

  // 1. Test without auth (should fail)
  console.log('1. Testing without authentication...');
  try {
    const noAuthRes = await fetch(`${API_BASE}/api/realtime/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    console.log(`   Status: ${noAuthRes.status} (expected 401)`);
    const noAuthData = await noAuthRes.json();
    console.log(`   Response: ${JSON.stringify(noAuthData)}`);
    console.log(noAuthRes.status === 401 ? '   ✓ Correctly rejected unauthenticated request\n' : '   ✗ Should have rejected\n');
  } catch (err) {
    console.error('   ✗ Request failed:', err.message, '\n');
  }

  // 2. Get auth token
  console.log('2. Getting auth token...');
  const token = await getAuthToken();
  if (!token) {
    console.log('   ✗ Could not get auth token. Skipping authenticated tests.\n');
    console.log('   Note: Set TEST_USER_EMAIL and TEST_USER_PASSWORD env vars for testing.\n');
    return;
  }
  console.log('   ✓ Got auth token\n');

  // 3. Test with auth (should work if Azure is configured)
  console.log('3. Testing with authentication...');
  try {
    const authRes = await fetch(`${API_BASE}/api/realtime/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        conversationId: null,
        personaId: null,
      }),
    });

    console.log(`   Status: ${authRes.status}`);
    const authData = await authRes.json();

    if (authRes.status === 200) {
      console.log('   ✓ Session created successfully!');
      console.log(`   - Session ID: ${authData.sessionId}`);
      console.log(`   - WS Endpoint: ${authData.wsEndpoint ? authData.wsEndpoint.substring(0, 50) + '...' : 'N/A'}`);
      console.log(`   - Has Client Secret: ${!!authData.clientSecret}`);
      console.log(`   - Expires At: ${new Date(authData.expiresAt).toISOString()}`);
      console.log(`   - Context Info: ${JSON.stringify(authData.contextInfo)}`);
    } else if (authRes.status === 503) {
      console.log('   ⚠ Azure Realtime not configured (expected in dev without Azure)');
      console.log(`   Details: ${authData.details}`);
    } else {
      console.log('   ✗ Unexpected response');
      console.log(`   Response: ${JSON.stringify(authData)}`);
    }
  } catch (err) {
    console.error('   ✗ Request failed:', err.message);
  }

  console.log('\n=== Test Complete ===\n');
}

// Health check first
async function checkHealth() {
  console.log('Checking backend health...');
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (res.ok) {
      console.log('Backend is running ✓\n');
      return true;
    }
  } catch {
    // Fall through
  }
  console.log('Backend not responding. Make sure to run: npm run dev\n');
  return false;
}

async function main() {
  const healthy = await checkHealth();
  if (healthy) {
    await testSessionEndpoint();
  }
}

main().catch(console.error);
