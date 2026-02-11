/**
 * Sample Database Browser Extension for Breadcrumb IDE.
 *
 * Demonstrates the extension API by registering commands and providing
 * a mock database browsing experience. In a real extension, this would
 * use better-sqlite3 or pg to connect to actual databases.
 */

// Mock database for demonstration
const MOCK_TABLES = [
  { name: "users", columns: ["id", "name", "email", "created_at"], rowCount: 1250 },
  { name: "projects", columns: ["id", "name", "owner_id", "status"], rowCount: 87 },
  { name: "tasks", columns: ["id", "title", "project_id", "assignee_id", "status"], rowCount: 3420 },
  { name: "sessions", columns: ["id", "user_id", "token", "expires_at"], rowCount: 540 },
];

let connected = false;
let currentDb = null;

function activate(context) {
  console.log("[DB Browser] activating...");

  // Register connect command
  const connectCmd = breadcrumb.commands.registerCommand(
    "connect",
    async () => {
      connected = true;
      currentDb = "sample.db";
      breadcrumb.window.showInformationMessage(
        `Connected to database: ${currentDb}`
      );
      return { connected: true, database: currentDb };
    }
  );

  // Register list tables command
  const listTablesCmd = breadcrumb.commands.registerCommand(
    "listTables",
    async () => {
      if (!connected) {
        breadcrumb.window.showWarningMessage(
          "Not connected to a database. Run 'Database: Connect' first."
        );
        return { error: "Not connected" };
      }
      return {
        database: currentDb,
        tables: MOCK_TABLES.map((t) => ({
          name: t.name,
          columns: t.columns.length,
          rows: t.rowCount,
        })),
      };
    }
  );

  // Register query command
  const queryCmd = breadcrumb.commands.registerCommand(
    "query",
    async (sql) => {
      if (!connected) {
        breadcrumb.window.showWarningMessage("Not connected to a database.");
        return { error: "Not connected" };
      }

      // Mock query execution
      const tableName = extractTableName(sql || "SELECT * FROM users LIMIT 10");
      const table = MOCK_TABLES.find((t) => t.name === tableName);

      if (!table) {
        return {
          error: `Table not found: ${tableName}`,
          availableTables: MOCK_TABLES.map((t) => t.name),
        };
      }

      return {
        query: sql || "SELECT * FROM users LIMIT 10",
        columns: table.columns,
        rowCount: Math.min(10, table.rowCount),
        executionTime: "2ms",
        rows: generateMockRows(table, 10),
      };
    }
  );

  context.subscriptions.push(connectCmd, listTablesCmd, queryCmd);
  console.log("[DB Browser] activated with 3 commands");
}

function deactivate() {
  connected = false;
  currentDb = null;
  console.log("[DB Browser] deactivated");
}

// Helpers

function extractTableName(sql) {
  const match = sql.match(/FROM\s+(\w+)/i);
  return match ? match[1] : "users";
}

function generateMockRows(table, count) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const row = {};
    for (const col of table.columns) {
      if (col === "id") row[col] = i + 1;
      else if (col.endsWith("_id")) row[col] = Math.floor(Math.random() * 100) + 1;
      else if (col === "email") row[col] = `user${i + 1}@example.com`;
      else if (col === "name" || col === "title") row[col] = `Sample ${table.name.slice(0, -1)} ${i + 1}`;
      else if (col === "status") row[col] = ["active", "inactive", "pending"][i % 3];
      else if (col.endsWith("_at")) row[col] = new Date(Date.now() - i * 86400000).toISOString();
      else if (col === "token") row[col] = `tok_${Math.random().toString(36).slice(2, 10)}`;
      else row[col] = `value_${i}`;
    }
    rows.push(row);
  }
  return rows;
}

module.exports = { activate, deactivate };
