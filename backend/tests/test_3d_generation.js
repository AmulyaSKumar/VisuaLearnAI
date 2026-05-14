/**
 * Test 3D Generation System
 * Tests the 3D detection logic and API endpoint
 */

import 'dotenv/config';
import { should3DVisualize, get3DComplexityLevel } from '../src/agents/visual-intelligence.js';

// Test queries - should trigger 3D
const SHOULD_TRIGGER_3D = [
  'How does a car engine work',
  'Show me a 3D model of a water molecule',
  'Explain the structure of DNA',
  'How does a gear mechanism work',
  'Show me the solar system',
  'What is the molecular structure of caffeine',
  'Explain how a turbine works internally',
  'Show me a 3D visualization of a cube',
  'How does a piston engine work',
  'Explain the cross-section of a rocket engine',
];

// Test queries - should NOT trigger 3D
const SHOULD_NOT_TRIGGER_3D = [
  'What is photosynthesis',
  'Explain bubble sort algorithm',
  'What is the history of computers',
  'Calculate 2 + 2',
  'Show me a pie chart of sales data',
  'Explain binary search tree',
  'What is the definition of democracy',
  'How do I write a for loop in Python',
  'Explain the timeline of World War 2',
  'What is the formula for compound interest',
];

console.log('='.repeat(60));
console.log('3D DETECTION LOGIC TEST');
console.log('='.repeat(60));

console.log('\n--- SHOULD TRIGGER 3D (score >= 50) ---\n');
let passed3D = 0;
let failed3D = 0;

for (const query of SHOULD_TRIGGER_3D) {
  const result = should3DVisualize(query);
  const status = result.use3D ? '✓ PASS' : '✗ FAIL';
  if (result.use3D) passed3D++;
  else failed3D++;

  console.log(`${status} | Score: ${result.score.toString().padStart(3)} | "${query}"`);
  if (!result.use3D) {
    console.log(`       Breakdown: ${JSON.stringify(result.breakdown)}`);
  }
}

console.log('\n--- SHOULD NOT TRIGGER 3D (score < 50) ---\n');
let passedNo3D = 0;
let failedNo3D = 0;

for (const query of SHOULD_NOT_TRIGGER_3D) {
  const result = should3DVisualize(query);
  const status = !result.use3D ? '✓ PASS' : '✗ FAIL';
  if (!result.use3D) passedNo3D++;
  else failedNo3D++;

  console.log(`${status} | Score: ${result.score.toString().padStart(3)} | "${query}"`);
  if (result.use3D) {
    console.log(`       Breakdown: ${JSON.stringify(result.breakdown)}`);
  }
}

console.log('\n' + '='.repeat(60));
console.log('DETECTION TEST RESULTS');
console.log('='.repeat(60));
console.log(`3D Triggers:     ${passed3D}/${SHOULD_TRIGGER_3D.length} passed`);
console.log(`Non-3D Triggers: ${passedNo3D}/${SHOULD_NOT_TRIGGER_3D.length} passed`);
console.log(`Total:           ${passed3D + passedNo3D}/${SHOULD_TRIGGER_3D.length + SHOULD_NOT_TRIGGER_3D.length} passed`);

// Test device complexity
console.log('\n' + '='.repeat(60));
console.log('DEVICE COMPLEXITY TEST');
console.log('='.repeat(60));

const devices = [
  { name: 'High-end Desktop', caps: { webgl: true, memory: 16, cores: 8, mobile: false, saveData: false } },
  { name: 'Mid-range Laptop', caps: { webgl: true, memory: 4, cores: 4, mobile: false, saveData: false } },
  { name: 'Mobile Phone', caps: { webgl: true, memory: 3, cores: 4, mobile: true, saveData: false } },
  { name: 'Low-end Mobile', caps: { webgl: true, memory: 2, cores: 2, mobile: true, saveData: false } },
  { name: 'Data Saver Mode', caps: { webgl: true, memory: 4, cores: 4, mobile: false, saveData: true } },
  { name: 'No WebGL', caps: { webgl: false, memory: 8, cores: 8, mobile: false, saveData: false } },
];

for (const device of devices) {
  const complexity = get3DComplexityLevel(device.caps);
  console.log(`${device.name.padEnd(20)} → ${complexity}`);
}

// Test API endpoint (if server is running)
console.log('\n' + '='.repeat(60));
console.log('API ENDPOINT TEST');
console.log('='.repeat(60));

const API_URL = process.env.API_URL || 'http://localhost:3001';

async function testAPIEndpoint() {
  const testQuery = 'How does a car engine work';

  console.log(`\nTesting: POST ${API_URL}/api/generate-3d`);
  console.log(`Query: "${testQuery}"`);

  try {
    const response = await fetch(`${API_URL}/api/generate-3d`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In production, you'd need an auth token
        // 'Authorization': `Bearer ${process.env.TEST_TOKEN}`,
      },
      body: JSON.stringify({
        topic: testQuery,
        context: 'Testing 3D generation',
        deviceCapabilities: {
          webgl: true,
          memory: 8,
          cores: 4,
          mobile: false,
          saveData: false,
        },
      }),
    });

    if (response.status === 401) {
      console.log('\n⚠️  API requires authentication');
      console.log('   To test with auth, add TEST_TOKEN to .env');
      return;
    }

    if (!response.ok) {
      console.log(`\n✗ API returned ${response.status}: ${response.statusText}`);
      return;
    }

    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      const data = await response.json();
      console.log('\n✓ API Response (JSON - skipped):');
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    // SSE stream
    console.log('\n✓ API Response (SSE stream):');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let widgetReceived = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        try {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'start') {
            console.log(`  → Started generation for: ${data.topic}`);
          }

          if (data.type === 'code_delta') {
            process.stdout.write('.');
          }

          if (data.type === 'complete' && data.widget) {
            widgetReceived = true;
            console.log('\n  → Widget generated!');
            console.log(`     ID: ${data.widget.id}`);
            console.log(`     Title: ${data.widget.title}`);
            console.log(`     Type: ${data.widget.widget_type}`);
            console.log(`     Code length: ${data.widget.code?.length || 0} chars`);

            // Check for key Three.js patterns
            const code = data.widget.code || '';
            console.log('\n  → Code validation:');
            console.log(`     Has Three.js:       ${code.includes('THREE.') ? '✓' : '✗'}`);
            console.log(`     Has WebGLRenderer:  ${code.includes('WebGLRenderer') ? '✓' : '✗'}`);
            console.log(`     Has OrbitControls:  ${code.includes('OrbitControls') ? '✓' : '✗'}`);
            console.log(`     Has animate loop:   ${code.includes('requestAnimationFrame') ? '✓' : '✗'}`);
            console.log(`     Has container div:  ${code.includes('container') ? '✓' : '✗'}`);
          }

          if (data.type === 'skip') {
            console.log(`\n  → Skipped: ${data.reason}`);
          }

          if (data.type === 'error') {
            console.log(`\n  ✗ Error: ${data.error}`);
          }

          if (data.type === 'done') {
            console.log('\n  → Stream completed');
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    if (!widgetReceived) {
      console.log('\n  ⚠️ No widget was generated');
    }

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('\n⚠️  Server not running at ' + API_URL);
      console.log('   Start the backend with: npm run dev');
    } else {
      console.log(`\n✗ Error: ${error.message}`);
    }
  }
}

// Direct 3D generation test (bypasses API auth)
async function testDirect3DGeneration() {
  console.log('\nTesting direct 3D widget generation (no auth required)...');

  const { CDN_VERSIONS } = await import('../src/services/openai/prompts.js');
  const { getAzureTextClient, getAzureTextModel } = await import('../src/services/openai/azure-client.js');

  const client = getAzureTextClient();

  const topic = 'car engine';
  const prompt = `Create an interactive 3D visualization for: "${topic}"

REQUIREMENTS:
1. Create a complete, self-contained HTML widget with Three.js
2. Use CDN: ${CDN_VERSIONS.threejs}
3. Use OrbitControls: ${CDN_VERSIONS.orbitControls}
4. Include WebGL detection with fallback message
5. Use CSS variables for theming: var(--color-primary), var(--color-background)
6. Use container div with id="container"
7. Make it interactive (rotate, zoom with OrbitControls)

OUTPUT FORMAT:
Return ONLY the complete HTML widget code, starting with <div id="container"> or <style>.
No explanation, no markdown fences, just the code.

Generate a simple 3D visualization of a car engine piston mechanism:`;

  console.log(`\nGenerating 3D widget for: "${topic}"`);
  console.log('Streaming response...\n');

  try {
    const stream = await client.chat.completions.create({
      model: getAzureTextModel(),
      max_completion_tokens: 4096,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    });

    let fullCode = '';
    let charCount = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || '';
      if (!delta) continue;
      fullCode += delta;
      charCount += delta.length;
      if (charCount % 500 === 0 || charCount < 100) {
        process.stdout.write('.');
      }
    }

    console.log(`\n\nGeneration complete! (${fullCode.length} chars)`);

    console.log('\n--- Code Validation ---');
    console.log(`Has Three.js import:    ${fullCode.includes('three') ? 'yes' : 'no'}`);
    console.log(`Has container div:      ${fullCode.includes('container') ? 'yes' : 'no'}`);
    console.log(`Has WebGLRenderer:      ${fullCode.includes('WebGLRenderer') ? 'yes' : 'no'}`);
    console.log(`Has OrbitControls:      ${fullCode.includes('OrbitControls') ? 'yes' : 'no'}`);
    console.log(`Has animate function:   ${fullCode.includes('animate') ? 'yes' : 'no'}`);
    console.log(`Has scene:              ${fullCode.includes('Scene') ? 'yes' : 'no'}`);
    console.log(`Has camera:             ${fullCode.includes('Camera') ? 'yes' : 'no'}`);

    console.log('\n--- Code Preview (first 500 chars) ---');
    console.log(fullCode.slice(0, 500) + '...');
  } catch (error) {
    console.log(`\nError: ${error.message}`);
  }
}

// Run both tests
(async () => {
  // Run API test (will show auth warning)
  await testAPIEndpoint();

  // Run direct generation test
  await testDirect3DGeneration();

  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
})();
