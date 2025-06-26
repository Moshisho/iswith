const { GitHubClient } = require('./github-client');
const { parseWorkflowLogs, analyzeInputUsage } = require('./log-parser');

async function analyzeWorkflowInputs(owner, repo) {
  const client = new GitHubClient();
  const allInputs = [];

  try {
    // Get all workflows for the repository
    const workflowsResponse = await client.getWorkflows(owner, repo);
    const workflows = workflowsResponse.workflows || [];

    if (workflows.length === 0) {
      console.log('No workflows found in this repository.');
      return [];
    }

    console.log(`Found ${workflows.length} workflow(s). Analyzing recent runs...`);

    // Analyze recent runs for each workflow
    for (const workflow of workflows) {
      try {
        const runsResponse = await client.getWorkflowRuns(owner, repo, workflow.id);
        const runs = runsResponse.workflow_runs || [];

        // Analyze up to 5 recent runs per workflow
        const recentRuns = runs.slice(0, 5);
        
        for (const run of recentRuns) {
          try {
            console.log(`Analyzing run ${run.id} from workflow "${workflow.name}"...`);
            const logData = await client.getWorkflowRunLogs(owner, repo, run.id);
            const inputs = parseWorkflowLogs(logData);
            allInputs.push(inputs);
          } catch (logError) {
            // Skip this run if we can't get logs (might be too old or private)
            console.log(`  Skipping run ${run.id}: ${logError.message}`);
            continue;
          }
        }
      } catch (workflowError) {
        console.log(`  Skipping workflow "${workflow.name}": ${workflowError.message}`);
        continue;
      }
    }

    if (allInputs.length === 0) {
      console.log('No workflow runs with accessible logs found.');
      return [];
    }

    // Analyze input usage patterns
    const results = analyzeInputUsage(allInputs);
    return results;

  } catch (error) {
    throw new Error(`Failed to analyze workflows: ${error.message}`);
  }
}

module.exports = {
  analyzeWorkflowInputs
};