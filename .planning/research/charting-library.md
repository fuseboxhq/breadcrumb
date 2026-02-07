# Research: React Charting Library for Dashboard

**Date:** 2026-02-07
**Domain:** React data visualization
**Overall Confidence:** HIGH

## TL;DR

Use **Tremor** for this dashboard. It's purpose-built for React dashboards, uses your exact stack (Tailwind + Radix UI), has native dark theme support, and provides copy-paste components that match the shadcn/ui philosophy already in your project. Tremor was recently acquired by Vercel (Jan 2025) and is now fully open source under MIT license with active development.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| @tremor/react | 3.18.7 | Dashboard charts (all chart types) | HIGH |

**Install:**
```bash
npm install @tremor/react
```

**Setup:**
Tremor requires Tailwind CSS (already in your stack). Add Tremor's theme config to `tailwind.config.js`:

```javascript
// tremor.config.js or add to tailwind.config.js
module.exports = {
  theme: {
    extend: {
      // Tremor provides presets for colors, shadows, etc.
    }
  },
  darkMode: 'class', // Already likely configured for dark theme
}
```

## Why Tremor Over Alternatives

### Perfect Stack Alignment
- **Built on Tailwind CSS + Radix UI** - Same foundation as your project
- **Native dark theme support** - Built-in light/dark mode with `prefers-color-scheme` or class-based toggling
- **Copy-paste philosophy** - Like shadcn/ui, you own the component code for full customization
- **Consistent design language** - Will match your existing Radix UI components

### All Required Chart Types Included
- **Line Charts** - `<LineChart>` for installs over time, DAU/WAU
- **Bar Charts** - `<BarChart>` for command usage
- **Donut Charts** - `<DonutChart>` for OS distribution
- **Area Charts** - `<AreaChart>` for version adoption

Plus: KPI cards, bar lists, sparklines, and other dashboard-specific components.

### Strong Backing & Maintenance
- **Acquired by Vercel** (January 2025) - Now part of Vercel's design engineering team
- **Active development** - v3.18.7 released Jan 13, 2025
- **Open source** - MIT license, all components and blocks now free
- **16.5k GitHub stars, 344k weekly downloads** - Strong community adoption
- **61 contributors, 1,041 commits** - Active maintenance

## Architecture Notes

**Tremor builds on Recharts** - Tremor is not a standalone charting library. Under the hood, it uses Recharts for chart rendering. This means:

- You get Recharts' mature charting engine
- Tremor adds dashboard-optimized components and styling
- Bundle size includes Recharts (~107KB gzipped when using LineChart)

**This is intentional and beneficial:**
- Recharts is battle-tested (26,385 GitHub stars, 9.5M weekly downloads)
- Tremor abstracts away Recharts' verbose API
- You get dashboard-ready components without configuration overhead

## Key Patterns

### Basic Line Chart (Installs Over Time)
```tsx
import { LineChart } from '@tremor/react';

const chartdata = [
  { date: '2024-01', installs: 1200 },
  { date: '2024-02', installs: 1850 },
  { date: '2024-03', installs: 2100 },
];

<LineChart
  data={chartdata}
  index="date"
  categories={['installs']}
  colors={['blue']}
  yAxisWidth={48}
/>
```

### Bar Chart (Command Usage)
```tsx
import { BarChart } from '@tremor/react';

const commandData = [
  { command: 'status', count: 450 },
  { command: 'list', count: 320 },
  { command: 'show', count: 280 },
];

<BarChart
  data={commandData}
  index="command"
  categories={['count']}
  colors={['indigo']}
/>
```

### Donut Chart (OS Distribution)
```tsx
import { DonutChart } from '@tremor/react';

const osData = [
  { os: 'macOS', users: 456 },
  { os: 'Linux', users: 351 },
  { os: 'Windows', users: 789 },
];

<DonutChart
  data={osData}
  category="users"
  index="os"
  colors={['blue', 'cyan', 'indigo']}
/>
```

### Dark Theme Configuration
```tsx
// Tremor respects Tailwind's dark mode automatically
// If using class-based dark mode:
<html class="dark">
  {/* All Tremor charts automatically adapt */}
</html>
```

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Custom chart tooltips | Tremor's built-in tooltips | Handles responsive positioning, dark mode, accessibility |
| Date range pickers | Tremor's `<DateRangePicker>` | Handles edge cases, timezone issues |
| KPI cards | Tremor's `<Card>` + `<Metric>` | Pre-styled for dashboards, responsive |
| Color scales | Tremor's color presets | Designed for data viz, WCAG compliant |

## Bundle Size Reality Check

**Tremor is not the smallest option** - Since Tremor builds on Recharts, you inherit Recharts' bundle size:

- Recharts LineChart: ~107KB gzipped (based on GitHub issue reports)
- Tremor adds dashboard components on top of this
- Tree-shaking is limited due to Recharts' architecture

**Lightweight alternatives if bundle size is critical:**
- **Visx** (Airbnb) - 10-80KB range, tree-shakable, but lower-level (more code to write)
- **Victory** - Smaller footprint, but less feature-complete

**However:** For a dashboard application:
- 107KB gzipped is reasonable (React itself is ~45KB gzipped)
- You're trading bundle size for developer velocity
- Tremor's abstraction saves significant development time
- The stack alignment benefits outweigh the size cost

## Pitfalls

### Tremor Requires Tailwind Configuration
**What happens:** Charts won't render correctly without Tremor's Tailwind theme extensions.

**Avoid by:** Follow setup docs carefully. Add Tremor's preset to `tailwind.config.js`:
```javascript
module.exports = {
  presets: [require('@tremor/react/tailwind')],
  // or manually extend theme
}
```

### Recharts Bundle Size Can't Be Tree-Shaken
**What happens:** Adding one chart component pulls in ~107KB due to Recharts' architecture.

**Avoid by:** Accept this tradeoff for dashboard projects. If absolute bundle size is critical (<50KB total for charts), use Visx instead.

### Copy-Paste Components Need Manual Updates
**What happens:** If Tremor releases a bug fix, copy-pasted components won't auto-update.

**Avoid by:** Use the npm package approach (not copy-paste) for most components. Only copy-paste when you need heavy customization.

### Dark Mode Requires Class Strategy (Sometimes)
**What happens:** If using Tailwind's `prefers-color-scheme` default, manual dark mode toggle won't work.

**Avoid by:** Set `darkMode: 'class'` in `tailwind.config.js` if you need manual theme switching.

## Alternative Considered: Recharts Directly

**Why not Recharts?**
- Verbose API requires more boilerplate
- No dashboard-specific components (KPI cards, etc.)
- Dark theme requires manual configuration
- Same bundle size as Tremor (since Tremor uses it)

**When to use Recharts directly:**
- Need chart types Tremor doesn't provide
- Want maximum control over styling
- Not building a dashboard (just individual charts)

## Open Questions

**None** - Tremor meets all stated requirements and aligns perfectly with existing stack.

## Sources

**HIGH confidence:**
- [Tremor Official Docs](https://www.tremor.so/) - Verified features, stack, dark mode support
- [Tremor GitHub](https://github.com/tremorlabs/tremor-npm) - Verified maintenance status, v3.18.7 Jan 2025
- [Vercel Acquires Tremor](https://vercel.com/blog/vercel-acquires-tremor) - Verified acquisition, MIT license, future roadmap
- npm package info - Verified version 3.18.7, 344k weekly downloads

**MEDIUM confidence:**
- [Recharts Bundle Size Issue #3697](https://github.com/recharts/recharts/issues/3697) - Bundle size ~107KB gzipped for LineChart
- [shadcn/ui Chart Discussion](https://github.com/shadcn-ui/ui/discussions/4133) - Community recommends Tremor/Recharts
- [npm trends comparison](https://npmtrends.com/@tremor/react-vs-chart.js-vs-d3-vs-echarts-vs-plotly.js-vs-recharts) - Download stats, stars

**LOW confidence (general ecosystem):**
- [Best React Chart Libraries 2025](https://embeddable.com/blog/react-chart-libraries) - Visx bundle size 10-80KB
- [LogRocket Blog](https://blog.logrocket.com/best-react-chart-libraries-2025/) - General library comparison
- [Nivo vs Recharts](https://www.speakeasy.com/blog/nivo-vs-recharts) - Architecture comparison
