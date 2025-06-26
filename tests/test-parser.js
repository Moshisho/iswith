const { parseSetupJobLogs } = require('./src/workflow-parser');

// Test with the example log format you provided
const testLog = `Set up job
Inputs
    environment: production
    version: v2.1.0
    enable_debug: true
    timeout_minutes: 60
    custom_message: Deployment triggered by caller-workflow
    caller_workflow: caller-workflow
    app_version: v2.1.0
    run_debug_tests: true
    target_environment: production
    test_timeout: 60

Runner image
`;

console.log('Testing input parser with example log...');
const inputs = parseSetupJobLogs(testLog, true);

console.log('\nParsed inputs:');
inputs.forEach(input => {
  console.log(`${input.name}: "${input.value}"`);
});

console.log(`\nTotal inputs found: ${inputs.length}`);