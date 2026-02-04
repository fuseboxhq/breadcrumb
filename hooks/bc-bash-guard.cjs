#!/usr/bin/env node
// Breadcrumb PreToolUse Hook (Bash)
// Catches common bd CLI mistakes before they execute

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const command = data.tool_input?.command || '';

    // bd update --status in-progress (should be in_progress with underscore)
    if (/bd\s+update\b.*--status\s+in-progress\b/.test(command)) {
      process.stderr.write(
        'Breadcrumb: Use --status in_progress (underscore, not hyphen).\n' +
        'Correct: bd update <id> --status in_progress\n'
      );
      process.exit(2);
    }

    // bd update --status done/closed (should use bd close)
    if (/bd\s+update\b.*--status\s+(done|closed)\b/.test(command)) {
      process.stderr.write(
        'Breadcrumb: Use "bd close <id>" to close an issue, not --status done/closed.\n' +
        'Correct: bd close <id>\n'
      );
      process.exit(2);
    }
  } catch {
    // Parse error — allow the command through
  }
});
