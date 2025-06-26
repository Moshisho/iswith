#!/usr/bin/env node

const { analyzeWorkflowInputs } = require('./analyzer');
const { displayResults } = require('./formatter');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: iswith <owner>/<repo>');
    console.error('Example: iswith microsoft/vscode');
    process.exit(1);
  }

  const [owner, repo] = args[0].split('/');
  
  if (!owner || !repo) {
    console.error('Invalid repository format. Use: owner/repo');
    process.exit(1);
  }

  try {
    console.log(`Analyzing workflow inputs for ${owner}/${repo}...`);
    const results = await analyzeWorkflowInputs(owner, repo);
    displayResults(results);
  } catch (error) {
    if (error.message.includes('401')) {
      console.error('Error: Unauthenticated. Please ensure you have access to this repository.');
      console.error('You may need to set a GITHUB_TOKEN environment variable.');
    } else if (error.message.includes('404')) {
      console.error('Error: Repository not found or not accessible.');
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

main().catch(console.error);