const { GitHubClient } = require('./github-client');
const { parseWorkflowDefinition, parseSetupJobLogs } = require('./workflow-parser');

async function analyzeWorkflowInputs(owner, repo, authOptions = {}, workflowName = null) {
  const client = new GitHubClient(authOptions);

  try {
    // Get all workflows for the repository
    const workflowsResponse = await client.getWorkflows(owner, repo);
    let workflows = workflowsResponse.workflows || [];

    if (workflows.length === 0) {
      console.log('No workflows found in this repository.');
      return { definedInputs: [], jobInputs: [] };
    }

    // Filter by workflow name if specified
    if (workflowName) {
      workflows = workflows.filter(workflow => 
        workflow.name.toLowerCase().includes(workflowName.toLowerCase()) ||
        workflow.path.toLowerCase().includes(workflowName.toLowerCase())
      );
      
      if (workflows.length === 0) {
        console.log(`No workflows found matching "${workflowName}".`);
        console.log('Available workflows:');
        workflowsResponse.workflows.forEach(w => console.log(`  - ${w.name}`));
        return { definedInputs: [], jobInputs: [] };
      }
    } else {
      console.log('Please specify a workflow name using --workflow or -w');
      console.log('Available workflows:');
      workflowsResponse.workflows.forEach(w => console.log(`  - ${w.name}`));
      return { definedInputs: [], jobInputs: [] };
    }

    const workflow = workflows[0]; // Take the first match
    console.log(`\nAnalyzing workflow: "${workflow.name}"`);
    
    // Step 1: Parse workflow definition to get defined inputs
    let definedInputs = [];
    try {
      const workflowContent = await client.getWorkflowFile(owner, repo, workflow.path);
      const workflowDef = parseWorkflowDefinition(workflowContent);
      definedInputs = workflowDef.inputs;
      
      console.log(`\n📋 Workflow Definition:`);
      if (definedInputs.length > 0) {
        console.log(`Found ${definedInputs.length} defined input(s):`);
        definedInputs.forEach(input => {
          console.log(`  • ${input.name} (${input.type}) - ${input.description}`);
          if (input.required) console.log(`    Required: ${input.required}`);
          if (input.default) console.log(`    Default: ${input.default}`);
        });
      } else {
        console.log('No inputs defined in this workflow.');
      }
    } catch (yamlError) {
      console.log(`Could not parse workflow file: ${yamlError.message}`);
    }

    return { definedInputs, workflow, client, owner, repo };

  } catch (error) {
    throw new Error(`Failed to analyze workflows: ${error.message}`);
  }
}

async function analyzeWorkflowJobs(workflow, client, owner, repo) {
  try {
    // Get recent runs (limit to 1 for now)
    const runsResponse = await client.getWorkflowRuns(owner, repo, workflow.id);
    const runs = runsResponse.workflow_runs || [];
    
    if (runs.length === 0) {
      console.log('\nNo recent workflow runs found.');
      return [];
    }

    const latestRun = runs[0]; // Take only the most recent run
    console.log(`\n🏃 Latest Workflow Run: #${latestRun.run_number}`);
    console.log(`   Status: ${latestRun.status} | Conclusion: ${latestRun.conclusion || 'N/A'}`);
    console.log(`   Triggered: ${new Date(latestRun.created_at).toLocaleString()}`);
    console.log(`   Event: ${latestRun.event}`);

    // Get jobs for this run
    const jobsResponse = await client.getWorkflowJobs(owner, repo, latestRun.id);
    const jobs = jobsResponse.jobs || [];
    
    if (jobs.length === 0) {
      console.log('No jobs found for this run.');
      return [];
    }

    console.log(`\n📋 Jobs in this run:`);
    jobs.forEach((job, index) => {
      console.log(`   ${index + 1}. ${job.name} (${job.status})`);
    });

    return jobs;

  } catch (error) {
    throw new Error(`Failed to analyze workflow jobs: ${error.message}`);
  }
}

async function analyzeJobInputs(job, client, owner, repo) {
  try {
    console.log(`\n🔍 Analyzing job: "${job.name}"`);
    
    // Get job logs
    const jobLogs = await client.getJobLogs(owner, repo, job.id);
    console.debug(`/repos/${owner}/${repo}/actions/jobs/${job.id}/logs`);
    // Parse for "Inputs" section (only present in called workflows)
    const inputs = parseSetupJobLogs(jobLogs, false);
    
    if (inputs.length > 0) {
      console.log(`Found ${inputs.length} input value(s):`);
      inputs.forEach(input => {
        console.log(`  • ${input.name}: ${input.value}`);
      });
      return inputs;
    } else {
      console.log('No "Inputs" section found in job logs.');
      console.log('(This is normal for parent workflows - inputs only appear in called workflows)');
      return [];
    }

  } catch (error) {
    console.log(`Failed to get job logs: ${error.message}`);
    return [];
  }
}

// Simple prompt utility for user input
function prompt(question) {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

module.exports = {
  analyzeWorkflowInputs,
  analyzeWorkflowJobs,
  analyzeJobInputs,
  prompt
};