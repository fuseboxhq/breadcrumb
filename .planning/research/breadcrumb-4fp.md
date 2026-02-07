# Research: Vercel Postgres Setup for Next.js Analytics

**Task ID:** breadcrumb-4fp
**Date:** 2026-02-07
**Domain:** Database / Analytics Infrastructure
**Overall Confidence:** HIGH

## TL;DR

**CRITICAL UPDATE:** Vercel Postgres was deprecated in December 2024. All databases migrated to Neon. Use Neon Postgres through Vercel Marketplace instead. The `@vercel/postgres` package still works but migrate to `@neondatabase/serverless` for new projects. Use Drizzle ORM for migrations and type-safe queries.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| @neondatabase/serverless | latest | Neon Postgres driver | HIGH |
| drizzle-orm | latest | Type-safe ORM & queries | HIGH |
| drizzle-kit | latest | Schema migrations | HIGH |
| @vercel/postgres | (deprecated) | Legacy compatibility only | HIGH |

**Install:**
```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
```

## Setup Process

### 1. Provision Database via Vercel Marketplace

**Options:**
- **Vercel-Managed Integration**: Creates Neon account automatically, billing through Vercel
- **Neon-Managed Integration**: Link existing Neon project, billing stays with Neon

**Steps:**
1. Go to Vercel project dashboard → Storage tab
2. Click "Connect Database" → Choose "Neon" from Marketplace
3. Select integration type (Vercel-managed or Neon-managed)
4. Database URL automatically added as `DATABASE_URL` environment variable

### 2. Configure Drizzle

Create `drizzle.config.ts` in project root:

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

### 3. Define Schema

Create `src/db/schema.ts`:

```typescript
import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core';

export const analyticsEvents = pgTable('analytics_events', {
  id: serial('id').primaryKey(),
  event_name: text('event_name').notNull(),
  user_id: text('user_id'),
  session_id: text('session_id'),
  properties: text('properties'), // JSON string
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const pageViews = pgTable('page_views', {
  id: serial('id').primaryKey(),
  path: text('path').notNull(),
  referrer: text('referrer'),
  user_agent: text('user_agent'),
  ip_address: text('ip_address'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});
```

### 4. Generate & Run Migrations

```bash
# Generate migration files from schema
npx drizzle-kit generate

# Apply migrations to database
npx drizzle-kit migrate
```

**For production deployments**, add to `package.json`:
```json
{
  "scripts": {
    "db:migrate": "drizzle-kit migrate",
    "build": "npm run db:migrate && next build"
  }
}
```

## Key Patterns

### Pattern 1: Query from API Route (Neon Driver)

**Use when:** Need raw SQL queries or simple operations

```typescript
// app/api/analytics/route.ts
import { neon } from '@neondatabase/serverless';

export const runtime = 'edge'; // Optional: use edge runtime
export const preferredRegion = 'iad1'; // Match Neon region

export async function POST(request: Request) {
  const sql = neon(process.env.DATABASE_URL!);
  const { event_name, user_id, properties } = await request.json();

  try {
    const result = await sql`
      INSERT INTO analytics_events (event_name, user_id, properties, created_at)
      VALUES (${event_name}, ${user_id}, ${JSON.stringify(properties)}, NOW())
      RETURNING id
    `;

    return Response.json({ success: true, id: result[0].id });
  } catch (error) {
    return Response.json({ error: 'Failed to insert' }, { status: 500 });
  }
}
```

**Source:** Neon documentation, verified pattern

### Pattern 2: Type-Safe Queries with Drizzle

**Use when:** Need type safety and complex queries

```typescript
// src/db/index.ts
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

// app/api/analytics/stats/route.ts
import { db } from '@/db';
import { analyticsEvents } from '@/db/schema';
import { eq, sql, count } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const event_name = searchParams.get('event');

  const stats = await db
    .select({
      event_name: analyticsEvents.event_name,
      count: count(),
    })
    .from(analyticsEvents)
    .where(eq(analyticsEvents.event_name, event_name))
    .groupBy(analyticsEvents.event_name);

  return Response.json(stats);
}
```

**Source:** Drizzle ORM documentation

### Pattern 3: Analytics Queries (GROUP BY Date)

**Use when:** Building dashboards with time-series data

```typescript
// Daily event counts
export async function GET() {
  const sql = neon(process.env.DATABASE_URL!);

  const dailyStats = await sql`
    SELECT
      DATE_TRUNC('day', created_at) as date,
      event_name,
      COUNT(*) as event_count,
      COUNT(DISTINCT user_id) as unique_users
    FROM analytics_events
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE_TRUNC('day', created_at), event_name
    ORDER BY date DESC
  `;

  return Response.json(dailyStats);
}
```

**Common date functions:**
- `DATE_TRUNC('hour', created_at)` - hourly buckets
- `DATE_TRUNC('day', created_at)` - daily buckets
- `DATE_TRUNC('week', created_at)` - weekly buckets
- `DATE_TRUNC('month', created_at)` - monthly buckets

**Source:** PostgreSQL standard functions, verified in Neon docs

### Pattern 4: Serverless Connection Management

**Use when:** Working in serverless environments (all Vercel deployments)

**CRITICAL RULES:**
- Create new connection per request (don't reuse across requests)
- Use HTTP driver (`neon()`) for simple queries
- Use WebSocket driver (Pool/Client) only for transactions
- Don't create Pool/Client outside request handlers

```typescript
// CORRECT: New connection per request
export async function GET() {
  const sql = neon(process.env.DATABASE_URL!);
  const result = await sql`SELECT * FROM analytics_events LIMIT 10`;
  return Response.json(result);
}

// WRONG: Don't reuse connections
const sql = neon(process.env.DATABASE_URL!); // Outside handler
export async function GET() {
  const result = await sql`SELECT * FROM analytics_events`;
  return Response.json(result);
}
```

**Source:** Neon serverless documentation, Vercel best practices

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Manual SQL schema management | Drizzle migrations | Type safety, version control, rollbacks |
| Building query builders | Drizzle ORM | Type-safe, SQL-like syntax, zero runtime overhead |
| Connection pooling logic | Neon serverless driver | Built-in HTTP/WebSocket handling for serverless |
| Approximate COUNT(DISTINCT) | HyperLogLog extension | 10x+ speedup for large datasets |
| Manual date aggregation | DATE_TRUNC() | Standard SQL, optimized by Postgres |

## SQL Syntax for Analytics

### COUNT DISTINCT (Exact)
```sql
SELECT
  DATE_TRUNC('day', created_at) as date,
  COUNT(DISTINCT user_id) as unique_users
FROM analytics_events
GROUP BY DATE_TRUNC('day', created_at)
```

**Performance:** Can be slow on large datasets. Consider HyperLogLog for approximate counts.

### COUNT DISTINCT (Approximate with HLL)
```sql
-- First enable extension (run once)
CREATE EXTENSION IF NOT EXISTS hll;

-- Use HLL for fast approximate counts
SELECT
  DATE_TRUNC('day', created_at) as date,
  hll_cardinality(hll_add_agg(hll_hash_text(user_id))) as unique_users
FROM analytics_events
GROUP BY DATE_TRUNC('day', created_at)
```

**Performance:** 10x+ faster than exact COUNT(DISTINCT), 1-2% error margin.

### Conditional Aggregation
```sql
SELECT
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) FILTER (WHERE event_name = 'page_view') as page_views,
  COUNT(*) FILTER (WHERE event_name = 'button_click') as clicks,
  COUNT(DISTINCT user_id) as unique_users
FROM analytics_events
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC
```

### Window Functions for Running Totals
```sql
SELECT
  date,
  daily_count,
  SUM(daily_count) OVER (ORDER BY date) as running_total
FROM (
  SELECT
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as daily_count
  FROM analytics_events
  GROUP BY DATE_TRUNC('day', created_at)
) daily_stats
ORDER BY date DESC
```

## Pitfalls

### Pitfall 1: Using @vercel/postgres for New Projects
**What happens:** Package is deprecated, no future updates, eventual breakage
**Avoid by:** Use `@neondatabase/serverless` instead. If migrating existing code, see Neon's transition guide.

### Pitfall 2: Reusing Connections in Serverless
**What happens:** Connections outlive request lifecycle, causing errors or hanging requests
**Avoid by:** Create new `neon()` connection inside each API route handler. Never instantiate outside.

### Pitfall 3: Running Migrations in API Routes
**What happens:** Race conditions, multiple concurrent migrations, database corruption
**Avoid by:** Run migrations in build step only (`npm run db:migrate && next build`). Never in request handlers.

### Pitfall 4: COUNT(DISTINCT) on Large Tables
**What happens:** Query takes 10+ seconds, times out in serverless, high compute costs
**Avoid by:** Use HyperLogLog for approximate counts or pre-aggregate with materialized views.

### Pitfall 5: Not Indexing Analytics Columns
**What happens:** Full table scans on every GROUP BY query, slow dashboards
**Avoid by:** Add indexes on frequently queried columns:
```sql
CREATE INDEX idx_analytics_created_at ON analytics_events(created_at);
CREATE INDEX idx_analytics_event_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_user_id ON analytics_events(user_id);
```

### Pitfall 6: Hitting Free Tier Limits
**What happens:** Database shuts down mid-month, data loss, service disruption
**Avoid by:** Monitor usage in Neon dashboard. Free tier: 0.5 GB storage, 100 CU-hours compute/month.

### Pitfall 7: Storing Large JSON in Text Columns
**What happens:** Inefficient storage, can't query JSON fields, slow selects
**Avoid by:** Use `jsonb` column type instead:
```typescript
properties: jsonb('properties').$type<{key: string}>()
```

## Neon Free Tier Limits (2026)

| Resource | Limit | Notes |
|----------|-------|-------|
| Storage | 0.5 GB per project | 5 GB aggregate across 10 projects |
| Compute | 100 CU-hours/month | Doubled from 50 CU-hours in Oct 2025 |
| Projects | 10 projects | Per account |
| Branches | Unlimited | Database branching for preview deployments |
| Autoscaling | Up to 2 CU | Scale-to-zero with 5min idle timeout |
| Egress | 5 GB/month | Data transfer out |
| Point-in-Time Recovery | 6 hours | Backup retention |
| Connections | Unlimited | Via HTTP or WebSocket |

**What's a CU?** Compute Unit = 1 vCPU + 4 GB RAM. Free tier allows continuous 0.25 CU for 400 hours/month or 1 CU for 100 hours/month.

**Confidence:** HIGH (verified from Neon pricing page January 2026)

## Migration Path (Existing @vercel/postgres Projects)

If you have existing code using `@vercel/postgres`:

**Step 1:** Database already migrated (Vercel did this in Dec 2024)
**Step 2:** Update package.json:
```bash
npm uninstall @vercel/postgres
npm install @neondatabase/serverless
```

**Step 3:** Update imports:
```typescript
// OLD
import { sql } from '@vercel/postgres';

// NEW
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);
```

**Step 4:** Test queries - syntax is identical for template literals

**Confidence:** HIGH (verified from Neon transition guide)

## Open Questions

None - research is complete and verified.

## Sources

**HIGH confidence (Official Documentation):**
- [Vercel Postgres Documentation](https://vercel.com/docs/storage/vercel-postgres) - Confirmed deprecation
- [Neon for Vercel Marketplace](https://vercel.com/marketplace/neon) - Current integration method
- [Neon Plans & Pricing](https://neon.com/pricing) - Free tier limits
- [Neon Docs: Integrating with Vercel](https://neon.com/docs/guides/vercel-overview)
- [Neon Docs: Vercel Postgres Transition Guide](https://neon.com/docs/guides/vercel-postgres-transition-guide)
- [Drizzle ORM: Drizzle with Neon](https://orm.drizzle.team/docs/tutorials/drizzle-with-neon)
- [Neon Docs: Schema Migrations with Drizzle](https://neon.com/docs/guides/drizzle-migrations)
- [Postgres COUNT() Function](https://neon.com/docs/functions/count)

**MEDIUM confidence (Tutorial/Community):**
- [Telerik: Integrate Serverless SQL with Vercel Postgres](https://www.telerik.com/blogs/integrate-serverless-sql-database-vercel-postgres)
- [Chris Nowicki: Setup Vercel Postgres](https://www.chrisnowicki.dev/blog/how-to-setup-vercel-postgres)
- [Vela: Neon Pricing Breakdown 2026](https://vela.simplyblock.io/articles/neon-serverless-postgres-pricing-2026/)
- [Freetiers.com: Neon Free Tier Limits](https://www.freetiers.com/directory/neon)

**LOW confidence (needs validation):**
- None
