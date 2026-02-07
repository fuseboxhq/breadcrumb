import { pgTable, serial, text, timestamp, integer, date, uniqueIndex } from 'drizzle-orm/pg-core';

export const installs = pgTable('installs', {
  id: serial('id').primaryKey(),
  ipHash: text('ip_hash').notNull(),
  userAgent: text('user_agent'),
  os: text('os'),
  arch: text('arch'),
  version: text('version'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const heartbeats = pgTable('heartbeats', {
  id: serial('id').primaryKey(),
  machineId: text('machine_id').notNull(),
  version: text('version').notNull(),
  os: text('os').notNull(),
  platform: text('platform').notNull(),
  arch: text('arch'),
  projectCount: integer('project_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('heartbeats_machine_date_idx').on(table.machineId, table.createdAt),
]);

export const commandEvents = pgTable('command_events', {
  id: serial('id').primaryKey(),
  machineId: text('machine_id').notNull(),
  commandName: text('command_name').notNull(),
  count: integer('count').default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Daily aggregation view (populated by queries, not a materialized view)
// Indexes for analytics queries
export const installsDateIdx = 'CREATE INDEX IF NOT EXISTS idx_installs_created_at ON installs(created_at)';
export const heartbeatsDateIdx = 'CREATE INDEX IF NOT EXISTS idx_heartbeats_created_at ON heartbeats(created_at)';
export const heartbeatsMachineIdx = 'CREATE INDEX IF NOT EXISTS idx_heartbeats_machine_id ON heartbeats(machine_id)';
export const commandsDateIdx = 'CREATE INDEX IF NOT EXISTS idx_commands_created_at ON command_events(created_at)';
export const commandsNameIdx = 'CREATE INDEX IF NOT EXISTS idx_commands_name ON command_events(command_name)';
