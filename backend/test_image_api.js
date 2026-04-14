/**
 * Quick Test: Image Generator with Azure API
 * Run: node test_image_api.js
 */

import 'dotenv/config';

async function testImageGeneration() {
  console.log('='.repeat(60));
  console.log('IMAGE GENERATOR API TEST');
  console.log('='.repeat(60));

  try {
    const { ImageGeneratorAgent } = await import('./src/agents/image-generator.js');
    const { config } = await import('./src/config/environment.js');

    console.log('\nConfiguration:');
    console.log('  Image Endpoint:', config.azure.imageEndpoint ? 'SET' : 'NOT SET');
    console.log('  API Key:', config.azure.apiKey ? 'SET (hidden)' : 'NOT SET');
    console.log('  API Version:', config.azure.imageApiVersion);

    if (!config.azure.imageEndpoint || !config.azure.apiKey) {
      console.log('\nERROR: Azure configuration missing!');
      process.exit(1);
    }

    const agent = new ImageGeneratorAgent();
    console.log('\nAgent:', agent.name, 'v' + agent.version);

    const testPrompt = 'A simple educational diagram showing photosynthesis: sunlight, water, CO2 going into a plant, and oxygen and glucose coming out. Clean, colorful, with labels.';

    console.log('\nGenerating image...');
    console.log('Prompt:', testPrompt.substring(0, 60) + '...');

    const startTime = Date.now();

    const result = await agent.run(
      { prompt: testPrompt, style: 'educational, clean, colorful' },
      { userId: 'test-user' }
    );

    const duration = Date.now() - startTime;

    if (result.success) {
      console.log('\n✅ Image generated successfully!');
      console.log('  Duration:', (duration / 1000).toFixed(1) + 's');
      console.log('  Image URL:', result.result.imageUrl);
      console.log('  Model:', result.result.metadata.model);
      console.log('  Size:', result.result.metadata.size);
    } else {
      console.log('\n❌ Image generation failed!');
      console.log('  Error:', result.error);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
}

testImageGeneration();
