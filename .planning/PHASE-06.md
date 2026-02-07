# Phase 06: Analytics & Telemetry

**Status:** not_started
**Beads Epic:** breadcrumb-4fp
**Created:** 2026-02-07

## Objective

Build a full analytics pipeline for Breadcrumb — from install tracking through active usage telemetry to a dashboard for viewing it all. This gives visibility into adoption (how many installs), engagement (which commands are used, how often), and retention (daily/weekly active instances). Data is collected anonymously with an opt-out mechanism.

## Scope

**In scope:**
- Vercel API route to proxy `install.sh` and log install events (timestamp, hashed IP, OS/arch from User-Agent, version)
- Daemon heartbeat — anonymous ping on startup with hashed machine ID, version, OS, project count
- Command usage telemetry — batch and send which `/bc:*` commands are executed, frequency
- Web UI analytics beacon — track dashboard opens
- Analytics dashboard page — visualize installs/day, active users/week, command popularity, OS distribution, version adoption
- Privacy: hashed machine IDs, no PII, opt-out flag in Breadcrumb config
- Update install URL in README and installers to point through the Vercel proxy

**Out of scope:**
- Per-user tracking or any PII collection
- Real-time streaming analytics (batch/periodic is fine)
- Monetization or gating features behind telemetry
- Third-party analytics services (keep it self-hosted on Vercel)

## Constraints

- Must use Vercel infrastructure (already hosting there)
- Storage: Vercel Postgres recommended — relational queries suit analytics (aggregations, time-series grouping, breakdowns by OS/version). Free tier: 256MB
- Anonymous by default — hashed machine ID (`sha256(hostname + username)`), opt-out via config flag
- Telemetry payloads must be small and non-blocking (fire-and-forget, background)
- Install proxy must not break the existing `curl | bash` flow
- Frontend design skill active — follow design thinking process for the analytics dashboard UI

## Research Summary

Run `/bc:plan PHASE-06` to research this phase and populate this section.

## Recommended Approach

**Install tracking:**
- Vercel API route (`/api/install`) that reads `install.sh` from GitHub raw, streams it back, and logs the request metadata to Postgres
- Vercel rewrite rule: `/install.sh` → `/api/install`
- Update install docs to use the Vercel URL

**Daemon heartbeat:**
- On daemon start, send a POST to `/api/telemetry/heartbeat` with: hashed machine ID, version, OS, project count
- Deduplicate by machine ID + date for DAU counting
- Respect opt-out config flag

**Command telemetry:**
- Hook into the existing hook system or daemon request handling
- Buffer command executions in memory, flush to `/api/telemetry/commands` every N minutes or on daemon shutdown
- Payload: `{ machineId, commands: [{ name, count, timestamp }] }`

**Analytics dashboard:**
- New page/route in the Breadcrumb web UI (or standalone Vercel page)
- Charts: installs over time, DAU/WAU, command usage breakdown, OS/arch pie chart, version adoption curve
- Query Vercel Postgres via API routes

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-06` to break down this phase into tasks.

## Technical Decisions

- **Vercel Postgres** over KV — analytics needs aggregation queries (GROUP BY date, COUNT DISTINCT, etc.) which are natural in SQL but awkward in Redis
- **Hashed machine ID** — `sha256(hostname + username)` gives stable anonymous identity without PII
- **Fire-and-forget telemetry** — daemon telemetry calls use no-wait/background HTTP to avoid impacting user experience
- **Proxy install script** — transparently proxies from GitHub raw so the script itself stays in the repo, but downloads are counted

## Completion Criteria

- [ ] Install script served via Vercel proxy with each download logged to Postgres
- [ ] Daemon sends anonymous heartbeat on startup (respects opt-out)
- [ ] Command usage telemetry collected and sent in batches
- [ ] Analytics dashboard shows: installs/day, DAU/WAU, command popularity, OS breakdown, version adoption
- [ ] Opt-out mechanism documented and functional
- [ ] Install URLs updated in README and installer scripts
