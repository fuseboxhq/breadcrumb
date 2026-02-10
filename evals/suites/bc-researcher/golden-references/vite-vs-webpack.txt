# Golden Reference Version: 1.0
# Created: 2026-02-07
# Last Validated: 2026-02-07
# Expires: 2026-08-07

# Research: Vite vs Webpack for Production React 2026

**Task ID:** eval-golden-004
**Date:** 2026-02-07
**Domain:** Build tooling, bundlers
**Overall Confidence:** HIGH

## TL;DR

Use **Vite** for new React projects in 2026. It provides 10-100x faster dev server startup via native ES modules, faster HMR, simpler configuration, and production builds via Rollup that match or beat Webpack's output quality. Webpack remains viable for legacy projects with complex custom configurations, but Vite is the clear default for new work.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| vite | 6.x | Build tool and dev server | HIGH |
| @vitejs/plugin-react | 4.x | React Fast Refresh and JSX transform | HIGH |

**Install:**
```bash
npm create vite@latest my-app -- --template react-ts
```

## Key Patterns

### Vite Config with Code Splitting
**Use when:** Setting up a production React app with TypeScript and Tailwind

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
        },
      },
    },
    sourcemap: true,
  },
});
```

### Lazy Loading Routes
**Use when:** Splitting large apps into route-based chunks

```typescript
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

### Performance Comparison

| Metric | Vite 6 | Webpack 5 |
|--------|--------|-----------|
| Dev server cold start | ~300ms | ~8-15s |
| HMR update | ~50ms | ~200-500ms |
| Production build (medium app) | ~5-10s | ~15-30s |
| Config complexity | ~20 lines | ~100+ lines |
| Tree shaking | Rollup (excellent) | Built-in (good) |

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Dev server with HMR | Vite's built-in dev server | Native ESM, no bundling needed in dev |
| CSS processing pipeline | Vite's PostCSS integration | Tailwind + autoprefixer work out of the box |
| Environment variables | Vite's `import.meta.env` | Type-safe, tree-shakeable, `.env` file support |
| Bundle analysis | `rollup-plugin-visualizer` | Works with Vite's Rollup-based production build |

## Pitfalls

### CJS Dependencies Cause Slow Pre-Bundling
**What happens:** First dev server start is slow because Vite must pre-bundle CommonJS dependencies with esbuild. Large CJS deps like lodash or moment add seconds.
**Avoid by:** Prefer ESM packages. Use `lodash-es` instead of `lodash`. Vite caches pre-bundled deps in `node_modules/.vite` after first run.

### Import.meta.env vs process.env
**What happens:** Code using `process.env.REACT_APP_*` (Create React App convention) breaks silently — variables are undefined at runtime.
**Avoid by:** Use `import.meta.env.VITE_*` prefix for client-side env vars. Only `VITE_`-prefixed variables are exposed to client code.

### SSR Requires Additional Setup
**What happens:** Vite's default config is SPA-only. Server-side rendering needs manual configuration or a framework like Remix/Next.js.
**Avoid by:** If you need SSR, use a meta-framework. For SPA-only apps (dashboards, admin panels), Vite's default config is perfect.

## Open Questions

None.

## Sources

**HIGH confidence:**
- [Vite Documentation](https://vite.dev/guide/)
- [Vite Why Vite](https://vite.dev/guide/why.html)
- [Vite Build Configuration](https://vite.dev/config/build-options.html)

**MEDIUM confidence:**
- [Webpack to Vite Migration Guide](https://vite.dev/guide/migration)
- [State of JS 2025 Build Tools](https://stateofjs.com/)
