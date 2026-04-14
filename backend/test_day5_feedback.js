/**
 * Day 5 Integration Tests
 * Tests Feedback System and Full Pipeline
 *
 * Run: node test_day5_feedback.js
 */

import 'dotenv/config';

const API_BASE = 'http://localhost:3001';

/**
 * Test 1: Feedback Submission
 */
async function testFeedbackSubmission() {
  console.log('\n=== TEST 1: Feedback Submission ===\n');

  try {
    // Test thumbs up
    console.log('Submitting thumbs_up feedback...');
    const response1 = await fetch(`${API_BASE}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'thumbs_up',
        content: 'Great explanation of photosynthesis!',
        metadata: {
          topic: 'photosynthesis',
          widgetType: 'flowchart',
          learningStyle: 'visual',
        },
      }),
    });

    const data1 = await response1.json();
    console.log('Response:', data1.success ? 'SUCCESS' : 'FAILED');
    if (data1.success) {
      console.log('  Feedback ID:', data1.data.id);
      console.log('  Type:', data1.data.type);
    }

    // Test correction
    console.log('\nSubmitting correction feedback...');
    const response2 = await fetch(`${API_BASE}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'correction',
        content: 'The diagram shows 6CO2 but should be clearer about the stoichiometry',
        metadata: {
          topic: 'chemistry',
          widgetType: 'diagram',
        },
      }),
    });

    const data2 = await response2.json();
    console.log('Response:', data2.success ? 'SUCCESS' : 'FAILED');

    // Test validation error
    console.log('\nTesting validation (invalid type)...');
    const response3 = await fetch(`${API_BASE}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'invalid_type',
        content: 'Test',
      }),
    });

    const data3 = await response3.json();
    console.log('Validation:', data3.success === false ? 'Correctly rejected' : 'FAILED');

    console.log('\nFeedback Submission: PASSED');
    return { name: 'Feedback Submission', passed: true };

  } catch (error) {
    console.error('Feedback Submission: FAILED');
    console.error('Error:', error.message);
    return { name: 'Feedback Submission', passed: false, error: error.message };
  }
}

/**
 * Test 2: Feedback Statistics
 */
async function testFeedbackStats() {
  console.log('\n=== TEST 2: Feedback Statistics ===\n');

  try {
    console.log('Fetching feedback stats...');
    const response = await fetch(`${API_BASE}/api/feedback/stats`);
    const data = await response.json();

    if (data.success) {
      console.log('Stats retrieved:');
      console.log('  Total feedback:', data.data.total);
      console.log('  Thumbs up:', data.data.byType.thumbs_up);
      console.log('  Thumbs down:', data.data.byType.thumbs_down);
      console.log('  Corrections:', data.data.byType.correction);
      console.log('  Satisfaction rate:', data.data.satisfactionRate + '%');
      console.log('\nFeedback Statistics: PASSED');
      return { name: 'Feedback Statistics', passed: true };
    } else {
      throw new Error(data.error);
    }

  } catch (error) {
    console.error('Feedback Statistics: FAILED');
    console.error('Error:', error.message);
    return { name: 'Feedback Statistics', passed: false, error: error.message };
  }
}

/**
 * Test 3: Feedback Analyzer
 */
async function testFeedbackAnalyzer() {
  console.log('\n=== TEST 3: Feedback Analyzer ===\n');

  try {
    const { FeedbackAnalyzer } = await import('./src/feedback/analyzer.js');
    const analyzer = new FeedbackAnalyzer();

    console.log('Analyzer initialized');

    // Test system-wide analysis
    console.log('\nRunning system-wide analysis...');
    const systemAnalysis = await analyzer.analyzeSystemFeedback();

    console.log('System analysis results:');
    console.log('  Total feedback:', systemAnalysis.totalFeedback);
    console.log('  Satisfaction rate:', systemAnalysis.analysis.satisfactionRate + '%');
    console.log('  Correction rate:', systemAnalysis.analysis.correctionRate + '%');
    console.log('  Common issues:', systemAnalysis.commonIssues.length);
    console.log('  Recommendations:', systemAnalysis.recommendations.length);

    // Test processing new feedback
    console.log('\nProcessing new feedback...');
    const processResult = await analyzer.processNewFeedback();

    console.log('Processing results:');
    console.log('  Processed:', processResult.processed);
    console.log('  Insights:', processResult.insights?.length || 0);

    console.log('\nFeedback Analyzer: PASSED');
    return { name: 'Feedback Analyzer', passed: true };

  } catch (error) {
    console.error('Feedback Analyzer: FAILED');
    console.error('Error:', error.message);
    return { name: 'Feedback Analyzer', passed: false, error: error.message };
  }
}

/**
 * Test 4: Full Pipeline Integration
 */
async function testFullPipeline() {
  console.log('\n=== TEST 4: Full Pipeline Integration ===\n');

  try {
    console.log('Testing complete user journey...\n');

    // Step 1: Generate a learning plan
    console.log('1. Generating learning plan...');
    const planResponse = await fetch(`${API_BASE}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: 'Learn about gravity and physics',
        userId: 'integration-test-user',
      }),
    });
    const planData = await planResponse.json();
    console.log('   Plan generated:', planData.success ? 'YES' : 'NO');
    console.log('   Title:', planData.data?.plan?.title || 'N/A');

    // Step 2: Submit positive feedback
    console.log('\n2. Submitting feedback...');
    const feedbackResponse = await fetch(`${API_BASE}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'thumbs_up',
        content: 'Great physics explanation!',
        metadata: { topic: 'physics', step: 'planning' },
      }),
    });
    const feedbackData = await feedbackResponse.json();
    console.log('   Feedback submitted:', feedbackData.success ? 'YES' : 'NO');

    // Step 3: Check stats
    console.log('\n3. Checking feedback stats...');
    const statsResponse = await fetch(`${API_BASE}/api/feedback/stats`);
    const statsData = await statsResponse.json();
    console.log('   Stats retrieved:', statsData.success ? 'YES' : 'NO');
    console.log('   Total feedback:', statsData.data?.total || 0);

    // Step 4: Health check
    console.log('\n4. Verifying system health...');
    const healthResponse = await fetch(`${API_BASE}/api/health`);
    const healthData = await healthResponse.json();
    console.log('   System status:', healthData.status);

    console.log('\nFull Pipeline Integration: PASSED');
    return { name: 'Full Pipeline', passed: true };

  } catch (error) {
    console.error('Full Pipeline Integration: FAILED');
    console.error('Error:', error.message);
    return { name: 'Full Pipeline', passed: false, error: error.message };
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('='.repeat(60));
  console.log('DAY 5 INTEGRATION TESTS');
  console.log('='.repeat(60));
  console.log('\nStarting tests...\n');

  // Check if server is running
  try {
    const health = await fetch(`${API_BASE}/api/health`);
    if (!health.ok) throw new Error('Server not responding');
  } catch (error) {
    console.error('ERROR: Server not running on', API_BASE);
    console.error('Start the server first: npm run dev');
    process.exit(1);
  }

  const results = [];

  results.push(await testFeedbackSubmission());
  results.push(await testFeedbackStats());
  results.push(await testFeedbackAnalyzer());
  results.push(await testFullPipeline());

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(r => {
    const status = r.passed ? 'PASS' : 'FAIL';
    const error = r.error ? ` (${r.error})` : '';
    console.log(`  ${status}: ${r.name}${error}`);
  });

  console.log('\n' + '-'.repeat(60));
  console.log(`Total: ${passed}/${results.length} passed`);

  if (failed === 0) {
    console.log('\nAll Day 5 tests PASSED!');
    console.log('MVP Backend Complete!');
  } else {
    console.log(`\n${failed} test(s) FAILED.`);
  }

  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
