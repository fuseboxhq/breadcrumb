# Phase 06: Analytics & Telemetry

**Status:** complete
**Beads Epic:** breadcrumb-4fp
**Created:** 2026-02-07

## Objective

Build a full analytics pipeline for Breadcrumb — from install tracking through active usage telemetry to a dashboard for viewing it all. This gives visibility into adoption (how many installs), engagement (which commands are used, how often), and retention (daily/weekly active instances). Data is collected anonymously with an opt-out mechanism.

## Research Summary

**Overall Confidence:** HIGH

Use Neon Postgres (via Vercel Marketplace) with `@neondatabase/serverless` driver + Drizzle ORM for schema/migrations. Vercel Postgres is deprecated — Neon is the replacement. Use Tremor (`@tremor/react`) for the analytics dashboard — it's built on Tailwind + Radix (matching the existing stack), was acquired by Vercel, and provides all needed chart types with native dark theme support.

### Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| @neondatabase/serverless | latest | Neon Postgres driver | HIGH |
| drizzle-orm | latest | Type-safe ORM & queries | HIGH |
| drizzle-kit | latest | Schema migrations | HIGH |
| @tremor/react | 3.18.7 | Dashboard charts & components | HIGH |

### Key Patterns

- **New Neon connection per request** — don't reuse across serverless invocations
- **DATE_TRUNC()** for time-series grouping (day/week/month buckets)
- **COUNT DISTINCT machine_id** for DAU/WAU
- **Drizzle migrations in build step only** — never in API routes
- **Fire-and-forget telemetry** — daemon sends HTTP without awaiting response

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| SQL schema management | Drizzle migrations | Type safety, version control, rollbacks |
| Connection pooling | Neon serverless driver | Built-in HTTP/WebSocket for serverless |
| Chart tooltips/styling | Tremor built-in | Dark mode, responsive, accessible |
| Date aggregation | DATE_TRUNC() | Optimized by Postgres |

### Design Guidance

The `frontend-design` skill will be active during execution of UI tasks in this phase. It provides guidelines for typography, color, motion, spatial composition, and avoiding generic aesthetics.

### Pitfalls

- **@vercel/postgres is deprecated** — Use `@neondatabase/serverless` instead
- **Don't reuse connections** — Create new `neon()` per serverless request handler
- **Don't run migrations in API routes** — Race conditions, corruption
- **Index analytics columns** — `created_at`, `machine_id`, `command_name` for fast GROUP BY
- **Neon free tier limits** — 0.5 GB storage, 100 CU-hours/month, monitor usage

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-4fp.1 | Set up Vercel project + Neon Postgres schema | done | Medium | - |
| breadcrumb-4fp.2 | Build install script proxy API route | done | Medium | .1 |
| breadcrumb-4fp.3 | Add daemon heartbeat telemetry | done | Medium | .1 |
| breadcrumb-4fp.4 | Add command usage telemetry | done | Medium | .3 |
| breadcrumb-4fp.5 | Build analytics query API routes | done | Medium | .1 |
| breadcrumb-4fp.6 | Build analytics dashboard UI | done | High | .5 |
| breadcrumb-4fp.7 | Add opt-out mechanism + documentation | done | Low | .3 |

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | Neon Postgres (via Vercel Marketplace) | Vercel Postgres deprecated; Neon is the replacement. Free tier: 0.5GB, 100 CU-hours/month |
| ORM | Drizzle ORM | Type-safe, SQL-like, zero runtime overhead, migrations via drizzle-kit |
| Driver | @neondatabase/serverless | Official Neon driver for serverless, HTTP-based, new connection per request |
| Charts | Tremor (@tremor/react) | Built on Tailwind + Radix (same stack), acquired by Vercel, native dark mode, all chart types |
| Machine ID | sha256(hostname + username) | Stable anonymous identity, no PII, deterministic |
| Telemetry transport | Fire-and-forget HTTP | Non-blocking, setTimeout-based, no impact on daemon performance |
| Opt-out | ~/.breadcrumb/config.json | Simple JSON file, checked on daemon startup and before each telemetry send |

## Completion Criteria

- [ ] Vercel project deployed with Neon Postgres provisioned
- [ ] Install script served via Vercel proxy with each download logged
- [ ] Daemon sends anonymous heartbeat on startup (respects opt-out)
- [ ] Command usage telemetry collected and sent in batches
- [ ] Analytics dashboard shows: installs/day, DAU/WAU, command popularity, OS breakdown, version adoption
- [ ] Opt-out mechanism documented and functional
- [ ] Install URLs updated in README and installer scripts

## Sources

**HIGH confidence:**
- [Neon for Vercel Marketplace](https://vercel.com/marketplace/neon)
- [Neon Vercel Postgres Transition Guide](https://neon.com/docs/guides/vercel-postgres-transition-guide)
- [Drizzle ORM: Drizzle with Neon](https://orm.drizzle.team/docs/tutorials/drizzle-with-neon)
- [Tremor Official Docs](https://www.tremor.so/)
- [Vercel Acquires Tremor](https://vercel.com/blog/vercel-acquires-tremor)

**MEDIUM confidence:**
- [Neon Pricing Breakdown 2026](https://vela.simplyblock.io/articles/neon-serverless-postgres-pricing-2026/)
- [shadcn/ui Chart Discussion](https://github.com/shadcn-ui/ui/discussions/4133)
