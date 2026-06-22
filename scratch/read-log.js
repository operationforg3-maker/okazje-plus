const fs = require('fs');

const data = fs.readFileSync('/Users/tomaszgorecki/.gemini/antigravity-ide/brain/e78dfe75-64e9-4075-a157-22d90a3341e2/.system_generated/logs/transcript.jsonl', 'utf8');
const lines = data.split('\n');

for (const line of lines) {
  if (!line) continue;
  try {
    const step = JSON.parse(line);
    if (step.step_index === 8399) {
      console.log(step.content);
    }
  } catch (e) {}
}
