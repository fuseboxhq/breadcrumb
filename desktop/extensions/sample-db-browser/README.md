# Database Browser — Sample Breadcrumb Extension

Demonstrates the Breadcrumb extension API by providing mock database browsing commands.

## Commands

| Command | Title | Shortcut |
|---------|-------|----------|
| `breadcrumb-db-browser.connect` | Connect to Database | Ctrl+Shift+D |
| `breadcrumb-db-browser.listTables` | List Tables | — |
| `breadcrumb-db-browser.query` | Run Query | — |

## Capabilities

- **fileSystem**: readonly
- **network**: false
- **terminal**: false

## Development

This extension uses mock data. A real implementation would:

1. Add `better-sqlite3` as a dependency
2. Accept a file path via the connect command
3. Execute real SQL queries
4. Return actual database rows

## Extension API Usage

```javascript
// Register a command
const cmd = breadcrumb.commands.registerCommand("myCommand", async (arg) => {
  return { result: "done" };
});
context.subscriptions.push(cmd);

// Show messages
breadcrumb.window.showInformationMessage("Hello!");
breadcrumb.window.showWarningMessage("Careful!");
breadcrumb.window.showErrorMessage("Something went wrong");
```
