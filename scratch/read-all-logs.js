const fs = require('fs');

const data = fs.readFileSync('/Users/tomaszgorecki/.gemini/antigravity-ide/brain/e78dfe75-64e9-4075-a157-22d90a3341e2/.system_generated/logs/transcript.jsonl', 'utf8');
const lines = data.split('\n');

console.log("Analyzing log steps...");
for (const line of lines) {
  if (!line) continue;
  try {
    const step = JSON.parse(line);
    // Look at step results from the subagent
    if (step.source === 'SYSTEM' || step.type === 'TOOL_RESPONSE' || step.type === 'BROWSER_SUBAGENT') {
      const content = step.content || '';
      if (content.includes("console.log") || content.includes("Console logs") || content.includes("Error") || content.includes("Failed to load")) {
        console.log(`Step index: ${step.step_index}, Type: ${step.type}`);
        console.log(content.slice(0, 1000));
        console.log('-------------------------------');
      }
    }
  } catch (e) {}
}
