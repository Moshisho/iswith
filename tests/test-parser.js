const { parseSetupJobLogs } = require('../src/workflow-parser');

// Test with the example log format you provided
const testLog = `2025-07-02T07:34:11.7537637Z ##[group] Inputs
2025-07-02T07:34:11.7538461Z   PAYLOAD: { "FED": [ { "artifact": "app", "version": "0.0.0-PR1234-6184c6eed1bf03421ba42ef8d847f07c5ffbc9d8" } ] }
2025-07-02T07:34:11.7539233Z   ref: refs/pull/1234/merge
2025-07-02T07:34:11.7539666Z   branch: some-branch
2025-07-02T07:34:11.7540121Z   some-sha: 4cdfffbc1f839d68bae20111b41f89ac8a227076
2025-07-02T07:34:11.7540793Z   deployment-url: https://some.site.com/AB1234/
2025-07-02T07:34:11.7543588Z   some-bool: false
2025-07-02T07:34:11.7544419Z   job-id: 1234567890
2025-07-02T07:34:11.7544825Z ##[endgroup]
`;

console.log('Testing input parser with example log...');
const inputs = parseSetupJobLogs(testLog, true);

console.log('\nParsed inputs:');
inputs.forEach(input => {
  console.log(`${input.name}: "${input.value}"`);
});

console.log(`\nTotal inputs found: ${inputs.length}`);