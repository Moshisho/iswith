const yaml = require('js-yaml');

function parseWorkflowDefinition(workflowContent) {
  try {
    const workflow = yaml.load(workflowContent);
    const inputs = new Map();

    // Parse workflow_dispatch inputs
    if (workflow.on && workflow.on.workflow_dispatch && workflow.on.workflow_dispatch.inputs) {
      const dispatchInputs = workflow.on.workflow_dispatch.inputs;
      for (const [inputName, inputDef] of Object.entries(dispatchInputs)) {
        inputs.set(inputName, {
          name: inputName,
          type: inputDef.type || 'string',
          description: inputDef.description || '',
          required: inputDef.required || false,
          default: inputDef.default || '',
          source: 'workflow_dispatch',
          options: inputDef.options || null
        });
      }
    }

    // Parse workflow_call inputs
    if (workflow.on && workflow.on.workflow_call && workflow.on.workflow_call.inputs) {
      const callInputs = workflow.on.workflow_call.inputs;
      for (const [inputName, inputDef] of Object.entries(callInputs)) {
        const existing = inputs.get(inputName);
        const inputInfo = {
          name: inputName,
          type: inputDef.type || 'string',
          description: inputDef.description || '',
          required: inputDef.required || false,
          default: inputDef.default || '',
          source: existing ? `${existing.source}, workflow_call` : 'workflow_call'
        };
        inputs.set(inputName, inputInfo);
      }
    }

    return {
      name: workflow.name,
      inputs: Array.from(inputs.values()),
      triggers: Object.keys(workflow.on || {})
    };
  } catch (error) {
    throw new Error(`Failed to parse workflow YAML: ${error.message}`);
  }
}

function parseSetupJobLogs(logContent, debug = false) {
  const inputs = new Map();
  const lines = logContent.split('\n');
  
  if (debug) {
    console.log('\n=== DEBUG: Job Log Analysis ===');
    console.log(`Total lines: ${lines.length}`);
    if (lines.length <= 10) {
      console.log('Raw content:');
      lines.forEach((line, i) => {
        console.log(`Line ${i}: "${line}"`);
      });
    }
  }
  
  // Look specifically for the "Inputs" section that appears in called workflows
  let inInputsSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for containing "##[group] Inputs" header line that appears in called workflows
    if (line.trim().includes('##[group] Inputs')) {
      if (debug) {
        console.log(`Found Inputs section at line ${i}: "${line.trim()}"`);
      }
      inInputsSection = true;
      continue;
    }
    
    // Stop at the next section or when we hit a line that doesn't look like an input
    if (inInputsSection) {
      if (debug) {
        console.log(`Processing line ${i}: "${line.slice(0, 20)}..."`);
      }
      // Check if this line looks like an input with timestamp: "2025-07-02T07:34:11.7537637Z   inputName: value"
      const inputMatch = line.match(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s+([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*)$/);
      
      if (inputMatch) {
        const inputName = inputMatch[1];
        const inputValue = inputMatch[2];
        
        inputs.set(inputName, {
          name: inputName,
          value: inputValue.trim(),
          source: 'inputs_section',
          lineNumber: i
        });
        
        if (debug) {
          console.log(`Found input: ${inputName} = "${inputValue.trim()}" (line ${i})`);
        }
      } else if (line.trim().includes('##[endgroup]')) {
        if (debug) {
          console.log(`Ending Inputs section at line ${i}: "${line.trim()}"`);
        }
        break;
      }
    }
  }
  
  if (debug) {
    console.log(`=== Found ${inputs.size} inputs ===`);
    for (const [name, input] of inputs) {
      console.log(`${name}: ${input.value}`);
    }
    console.log('=== End Debug ===\n');
  }
  
  return Array.from(inputs.values());
}

function extractInputsFromStepLogs(logContent) {
  const inputs = new Set();
  const lines = logContent.split('\n');
  
  for (const line of lines) {
    // Look for various input patterns in step outputs
    const patterns = [
      // ${{ inputs.input_name }}
      /\$\{\{\s*inputs\.([a-zA-Z_][a-zA-Z0-9_-]*)\s*\}\}/g,
      // github.event.inputs.input_name
      /github\.event\.inputs\.([a-zA-Z_][a-zA-Z0-9_-]*)/g,
      // Environment variable assignments like: INPUT_NAME=value
      /^([A-Z_][A-Z0-9_]*)\s*=.*$/gm,
      // Input parameter usage in logs
      /Input\s+([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/gi
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const inputName = match[1];
        if (inputName && !inputName.startsWith('GITHUB_') && !inputName.startsWith('RUNNER_')) {
          inputs.add(inputName.toLowerCase());
        }
      }
    }
  }
  
  return Array.from(inputs).map(name => ({
    name,
    source: 'step_logs'
  }));
}

module.exports = {
  parseWorkflowDefinition,
  parseSetupJobLogs,
  extractInputsFromStepLogs
};