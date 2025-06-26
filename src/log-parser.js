const zlib = require('zlib');

function parseWorkflowLogs(logData) {
  try {
    // GitHub logs are zip compressed, decompress first
    const decompressed = zlib.gunzipSync(Buffer.from(logData, 'binary')).toString();
    return extractInputsFromLogs(decompressed);
  } catch (error) {
    // If not compressed, try parsing as-is
    return extractInputsFromLogs(logData);
  }
}

function extractInputsFromLogs(logContent) {
  const inputs = new Map();
  const lines = logContent.split('\n');

  for (const line of lines) {
    // Look for common input patterns in GitHub Actions logs
    const patterns = [
      // github.event.inputs.input_name
      /github\.event\.inputs\.(\w+)/g,
      // ${{ inputs.input_name }}
      /\$\{\{\s*inputs\.(\w+)\s*\}\}/g,
      // inputs.input_name
      /inputs\.(\w+)/g,
      // Input parameters in workflow dispatch
      /Input\s+(\w+):/gi,
      // Environment variables that might be inputs
      /INPUT_(\w+)/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const inputName = match[1].toLowerCase();
        
        if (!inputs.has(inputName)) {
          inputs.set(inputName, {
            name: inputName,
            count: 0,
            contexts: []
          });
        }
        
        const input = inputs.get(inputName);
        input.count++;
        
        // Store some context around the input usage
        const context = line.trim();
        if (context && !input.contexts.includes(context) && input.contexts.length < 3) {
          input.contexts.push(context);
        }
      }
    }
  }

  return Array.from(inputs.values());
}

function analyzeInputUsage(allInputs) {
  const inputStats = new Map();

  for (const runInputs of allInputs) {
    for (const input of runInputs) {
      if (!inputStats.has(input.name)) {
        inputStats.set(input.name, {
          name: input.name,
          totalUsage: 0,
          runsFound: 0,
          contexts: new Set()
        });
      }

      const stats = inputStats.get(input.name);
      stats.totalUsage += input.count;
      stats.runsFound++;
      
      for (const context of input.contexts) {
        stats.contexts.add(context);
      }
    }
  }

  return Array.from(inputStats.values()).map(stat => ({
    name: stat.name,
    totalUsage: stat.totalUsage,
    runsFound: stat.runsFound,
    frequency: stat.runsFound / allInputs.length,
    examples: Array.from(stat.contexts).slice(0, 2)
  }));
}

module.exports = {
  parseWorkflowLogs,
  extractInputsFromLogs,
  analyzeInputUsage
};