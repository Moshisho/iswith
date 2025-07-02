#!/usr/bin/env node

const { analyzeWorkflowInputs, analyzeWorkflowJobs, analyzeJobInputs, prompt } = require('./analyzer');

function parseArgs(args) {
  const options = {
    repo: null,
    workflow: null,
    token: null,
    appId: null,
    privateKeyPath: null,
    authMethod: null
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    if (arg === '--token') {
      options.token = args[++i];
    } else if (arg === '--app-id') {
      options.appId = args[++i];
    } else if (arg === '--private-key') {
      options.privateKeyPath = args[++i];
    } else if (arg === '--auth-method') {
      options.authMethod = args[++i];
    } else if (arg === '--workflow' || arg === '-w') {
      options.workflow = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    } else if (!options.repo && arg.includes('/')) {
      options.repo = arg;
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
    i++;
  }

  return options;
}

function showHelp() {
  console.log(`
Usage: iswith <owner>/<repo> [options]

Arguments:
  <owner>/<repo>    GitHub repository to analyze

Options:
  -w, --workflow <name>   Specific workflow to analyze (optional)
  --token <token>         GitHub personal access token
  --app-id <id>          GitHub App ID for authentication
  --private-key <path>   Path to GitHub App private key file
  --auth-method <method> Authentication method: token, app, or none
  -h, --help            Show this help message

Environment Variables:
  GITHUB_TOKEN            GitHub personal access token
  GITHUB_APP_ID           GitHub App ID
  GITHUB_PRIVATE_KEY_PATH Path to GitHub App private key

Examples:
  iswith microsoft/vscode
  iswith --workflow ci microsoft/vscode
  iswith -w "caller-workflow" owner/repo
  iswith --token ghp_xxx --workflow ci microsoft/vscode
  iswith --app-id 123456 --private-key ./key.pem -w deploy owner/repo
  GITHUB_TOKEN=ghp_xxx iswith --workflow test owner/repo
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: iswith <owner>/<repo> [options]');
    console.error('Use --help for more information');
    process.exit(1);
  }

  const options = parseArgs(args);
  
  if (!options.repo) {
    console.error('Repository is required. Use: owner/repo');
    console.error('Use --help for more information');
    process.exit(1);
  }

  const [owner, repo] = options.repo.split('/');
  
  if (!owner || !repo) {
    console.error('Invalid repository format. Use: owner/repo');
    process.exit(1);
  }

  try {
    console.log(`🔍 Analyzing workflow inputs for ${owner}/${repo}`);
    if (!options.workflow) {
      console.log('Please specify a workflow name using --workflow or -w');
      process.exit(1);
    }
    
    const authOptions = {
      token: options.token,
      appId: options.appId,
      privateKeyPath: options.privateKeyPath
    };
    
    // Step 1: Get workflow definition and defined inputs
    const { definedInputs, workflow, client } = await analyzeWorkflowInputs(owner, repo, authOptions, options.workflow);
    
    // Step 2: List jobs from recent run and ask user if they want to check job inputs
    const jobs = await analyzeWorkflowJobs(workflow, client, owner, repo);
    
    if (jobs.length > 0) {
      // console.debug(`****** ${JSON.stringify(jobs[0])} ******`);
      // console.debug(`Found ${jobs[0].html_url} job(s) in workflow "${workflow.name}"`);
      console.log(`\n🔍 Analyzing job inputs...`);
      
      let foundInputs = false;
      for (const job of jobs) {
        const jobInputs = await analyzeJobInputs(job, client, owner, repo);
        if (jobInputs.length > 0) {
          foundInputs = true;
        }
      }
      
      if (!foundInputs) {
        console.log(`\n💡 No input values found in job logs.`);
        console.log(`   This is normal for parent workflows that accept inputs via workflow_dispatch.`);
        console.log(`   Input values only appear in logs when one workflow calls another.`);
      }
    }
    
    console.log(`\n✅ Analysis complete!`);
    process.exit(0);
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('403')) {
      console.error('Error: Authentication failed or insufficient permissions.');
      console.error('');
      console.error('Try one of these authentication methods:');
      console.error('  1. Personal token: --token <your_token>');
      console.error('  2. GitHub App: --app-id <id> --private-key <path>');
      console.error('  3. Environment: GITHUB_TOKEN=<token> or GITHUB_APP_ID=<id>');
      console.error('');
      console.error('Use --help for more information');
    } else if (error.message.includes('404')) {
      console.error('Error: Repository not found or not accessible.');
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

main().catch(console.error);