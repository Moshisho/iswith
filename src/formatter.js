const Table = require('cli-table3');

function displayResults(results, workflowName = null) {
  if (!results || results.length === 0) {
    const scope = workflowName ? `the "${workflowName}" workflow` : 'the analyzed workflows';
    console.log(`\nNo workflow inputs found in ${scope}.`);
    console.log('This could mean:');
    console.log('  • The workflow doesn\'t use inputs');
    console.log('  • The workflow has no recent runs');
    console.log('  • The workflow uses inputs in a pattern not detected');
    return;
  }

  const title = workflowName 
    ? `📊 Workflow Input Analysis Results for "${workflowName}"\n`
    : '📊 Workflow Input Analysis Results\n';
  console.log('\n' + title);

  const table = new Table({
    head: ['Input Name', 'Total Usage', 'Runs Found', 'Frequency', 'Example Context'],
    style: {
      head: ['cyan', 'bold'],
      border: ['grey']
    },
    colWidths: [20, 12, 10, 10, 50]
  });

  // Sort by frequency (most common first)
  const sortedResults = results.sort((a, b) => b.frequency - a.frequency);

  for (const result of sortedResults) {
    const frequencyPercent = (result.frequency * 100).toFixed(1) + '%';
    const exampleContext = result.examples && result.examples.length > 0 
      ? result.examples[0].substring(0, 45) + (result.examples[0].length > 45 ? '...' : '')
      : 'No context available';

    table.push([
      result.name,
      result.totalUsage.toString(),
      result.runsFound.toString(),
      frequencyPercent,
      exampleContext
    ]);
  }

  console.log(table.toString());
  
  console.log('\n📈 Summary:');
  console.log(`  • Found ${results.length} unique input(s)`);
  console.log(`  • Most common: ${sortedResults[0].name} (${(sortedResults[0].frequency * 100).toFixed(1)}% of runs)`);
  
  if (results.length > 1) {
    console.log(`  • Least common: ${sortedResults[sortedResults.length - 1].name} (${(sortedResults[sortedResults.length - 1].frequency * 100).toFixed(1)}% of runs)`);
  }
}

function displayError(error) {
  console.error('\n❌ Error occurred during analysis:');
  console.error(`   ${error.message}`);
  
  if (error.message.includes('401') || error.message.includes('403')) {
    console.error('\n💡 Suggestions:');
    console.error('   • Set GITHUB_TOKEN environment variable');
    console.error('   • Ensure the token has repo access permissions');
    console.error('   • Check if the repository is private and you have access');
  } else if (error.message.includes('404')) {
    console.error('\n💡 Suggestions:');
    console.error('   • Verify the repository owner/name is correct');
    console.error('   • Check if the repository exists and is accessible');
  }
}

module.exports = {
  displayResults,
  displayError
};