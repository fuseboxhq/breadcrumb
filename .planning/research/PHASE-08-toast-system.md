# Research: Toast Notification System for React + Electron IDE

**Date:** 2026-02-11
**Domain:** UI/UX - Toast Notifications
**Overall Confidence:** HIGH

## TL;DR

Use Sonner for toast notifications. It's the modern standard for React apps (8M+ weekly downloads, adopted by shadcn/ui, Cursor, X, Vercel), has the cleanest API, and offers opinionated defaults that align with IDE UX patterns. Position toasts at bottom-right with 4-5 second auto-dismiss for info toasts, longer for errors. Trigger via global `toast()` function without Context/hooks complexity.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| sonner | 2.0.7+ | Toast notifications | HIGH |

**Install:**
```bash
pnpm add sonner
```

**Bundle Impact:**
- Sonner: ~3KB gzipped (reported 2-3KB by community, ~165KB unpacked)
- Zero external dependencies
- React Hot Toast: ~5KB gzipped (alternative if extreme minimalism needed)

## Key Patterns

### Basic Integration
**Use when:** Standard toast notifications across the app

```tsx
// Source: https://sonner.emilkowal.ski/
// In App.tsx or main entry point
import { Toaster } from 'sonner';

export function App() {
  return (
    <>
      <Toaster
        position="bottom-right"
        expand={true}
        visibleToasts={3}
        richColors
        theme="dark"
      />
      {/* Rest of app */}
    </>
  );
}

// Anywhere in the app (no hooks needed!)
import { toast } from 'sonner';

// Simple usage
toast.success('Task completed');
toast.error('Failed to sync');
toast.info('Building phase...');
toast.warning('Approaching rate limit');

// With action button
toast('Phase complete', {
  action: {
    label: 'View',
    onClick: () => navigateToPhase()
  }
});

// Promise-based (for async operations)
toast.promise(
  syncTasks(),
  {
    loading: 'Syncing tasks...',
    success: 'Tasks synced',
    error: 'Sync failed'
  }
);
```

### Position Configuration
**Use when:** Matching IDE conventions

```tsx
// Source: VS Code UX Guidelines + Design System Best Practices
// Bottom-right is standard for IDEs (VS Code, Warp)
// Top-right is acceptable if bottom-right blocks critical content

<Toaster
  position="bottom-right"  // Default for IDEs
  // Sonner intelligently adjusts swipe direction based on position
/>

// Available positions:
// - bottom-right (recommended for IDE)
// - bottom-center
// - bottom-left
// - top-right
// - top-center
// - top-left
```

### Timing & Auto-Dismiss
**Use when:** Configuring UX behavior

```tsx
// Source: UX Research - 3-8 second attention span
// Canva: 5s default, 10s max
// HPE: 8s default

toast.success('Saved', {
  duration: 4000  // 4 seconds for quick success
});

toast.error('Build failed', {
  duration: 8000  // 8 seconds for errors (user needs time to read)
});

toast.info('Processing...', {
  duration: Infinity  // Manual dismiss only
});

// Default durations if not specified:
// - Success/Info: 4000ms (4s)
// - Error: 5000ms (5s)
// - Loading: Infinity
```

### Styling for Dark Warp-like Theme
**Use when:** Matching your existing design system

```tsx
// Source: Existing tailwind.config.js color system
// Your app already uses dark theme: #0a0a0b background

<Toaster
  theme="dark"
  richColors  // Enhanced colors for success/error/warning/info
  toastOptions={{
    style: {
      background: '#111113',  // surface-raised from your theme
      border: '1px solid #1e1e24',  // border-default
      color: '#ededef',  // text-primary
    },
    className: 'font-sans text-sm',
  }}
/>

// For custom styling per toast
toast.success('Done', {
  style: {
    background: '#30a46c20',  // status-success-muted
    border: '1px solid #30a46c',
    color: '#ededef'
  }
});
```

### Global Toast Access (No Context Needed)
**Use when:** Triggering toasts from anywhere

```tsx
// Source: Sonner design philosophy - no setup required
// Unlike Context API approaches, Sonner uses global observer pattern

// In a hook
export function usePhaseBuilder() {
  const buildPhase = async () => {
    try {
      await api.build();
      toast.success('Phase built successfully');
    } catch (err) {
      toast.error('Build failed: ' + err.message);
    }
  };
  return { buildPhase };
}

// In a utility function
export async function syncProject() {
  const promise = api.sync();
  toast.promise(promise, {
    loading: 'Syncing project...',
    success: 'Project synced',
    error: 'Sync failed'
  });
  return promise;
}

// In event handlers
<button onClick={() => toast.info('Coming soon!')}>
  Feature X
</button>
```

### Stacking & Visibility Control
**Use when:** Managing multiple notifications

```tsx
// Source: VS Code guidelines - "Display one notification at a time"
// But IDEs often show 2-3 stacked

<Toaster
  visibleToasts={3}  // Show max 3 toasts at once
  expand={true}      // Allow expanding to see all
  closeButton={true} // X button for manual dismiss
/>

// Toasts automatically stack and queue
// Older toasts auto-dismiss as new ones arrive
// User can expand to see full queue
```

## Design Patterns from IDEs

### VS Code Notifications
**Source:** [VS Code UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/notifications)

- **Position:** Bottom-right of window
- **Timing:** Not specified in docs, but observed to be ~5-8s
- **Stacking:** Displays one at a time (guidelines recommend)
- **Types:** Info, Warning, Error
- **Actions:** Include "Do not show again" option
- **Philosophy:** "Respect user's attention - only send when absolutely necessary"

**Key Takeaways:**
- Don't spam notifications
- Include dismissal options
- Keep within context when possible (prefer in-view status over global toasts)
- Use progress notifications for long operations

### Warp Terminal
**Source:** [Warp Notifications](https://docs.warp.dev/terminal/more-features/notifications)

- **Position:** System notifications (not in-app toasts)
- **Triggers:** Command completion (configurable threshold), password prompts
- **Smart Logic:** Only notifies if Warp is NOT the active app
- **Protocol Support:** OSC 9 (body only), OSC 777 (title + body)

**Key Takeaways:**
- Context-aware notifications (don't notify if user is already looking)
- Configurable triggers
- Integration with system notification center

### General IDE Patterns
**Sources:** Multiple UX research articles

- **Bottom-right is standard** (Windows/Mac place near status bars - Law of Proximity)
- **3-5 second auto-dismiss** for success/info
- **5-8 seconds for errors/warnings** (more reading time needed)
- **Manual dismiss always available** (X button or click-to-dismiss)
- **Hover pauses timer** - critical UX detail
- **Stack max 2-3** to avoid overwhelming

## API Design Comparison

### Sonner (Recommended)
```tsx
// Pros:
// - Zero setup (no provider, no hooks)
// - TypeScript-first
// - Promise-based API for async
// - Global observer pattern (works across route changes)
// - Rich feature set (actions, custom content, headless mode)
// - Modern, actively maintained (2025+)
// - Adopted by major tools (Cursor, shadcn/ui)

import { toast } from 'sonner';
toast.success('Done');
toast.promise(fn, { loading, success, error });
```

### React Hot Toast (Alternative)
```tsx
// Pros:
// - Slightly smaller (5KB vs 3KB, negligible)
// - Battle-tested, simple
// - Promise-based API
// - Good for extreme minimalism

// Cons:
// - Less opinionated (more setup needed)
// - Not as actively promoted in 2026 ecosystem

import toast from 'react-hot-toast';
toast.success('Done');
toast.promise(fn, { loading, success, error });
```

### Hand-Rolling (Not Recommended)
```tsx
// Why not to do this:
// - State management complexity (Context or global state)
// - Animation timing edge cases
// - Accessibility (ARIA announcements, focus management)
// - Stacking/queuing logic
// - Timer pause on hover
// - Mobile responsiveness
// - Theme integration
// - ~200-300 LOC to do it right

// Sonner/React Hot Toast solved all this already
```

## Don't Hand-Roll

| Problem | Use Sonner For | Why |
|---------|----------------|-----|
| Global toast access | `toast()` function | No Context/Provider needed, works everywhere |
| Promise handling | `toast.promise()` | Auto-updates loading → success/error |
| Stacking logic | Built-in queue | Complex timing/positioning logic |
| Accessibility | ARIA announcements | Screen reader support out of box |
| Animations | Built-in transitions | Smooth enter/exit, position-aware swipe |
| Theming | `richColors` prop | Auto-applies success/error/warning colors |
| Hover pause | Automatic | Timer stops on hover, resumes on leave |

## Electron Compatibility

**Confidence:** MEDIUM (no explicit docs, but should work)

- Sonner is a React component library
- Electron supports React applications natively
- No DOM APIs that would conflict with Electron
- **Note:** This project doesn't appear to be using Electron based on package.json (it's a Vite + Express app)
- If Electron is planned: Sonner should work seamlessly, but test integration

**Verification needed:** Check if this is actually an Electron app or web-based IDE.

## Implementation Checklist

- [ ] Install: `pnpm add sonner`
- [ ] Add `<Toaster />` to App.tsx (after reading existing structure)
- [ ] Configure: position="bottom-right", theme="dark", visibleToasts={3}
- [ ] Style to match existing theme (surface-raised, border-default colors)
- [ ] Create helper for common patterns (`toast.buildSuccess()`, etc.)
- [ ] Replace any existing notification system
- [ ] Test auto-dismiss timing (4s success, 8s errors)
- [ ] Test stacking behavior (trigger 5+ toasts rapidly)
- [ ] Test promise-based API with real async operations
- [ ] Verify accessibility (screen reader announcements)

## Open Questions

1. **Is this actually an Electron app?** Package.json shows Express + Vite, not Electron. If it's web-based, Sonner works perfectly. If Electron is planned, verify integration.

2. **Do we need system notifications too?** Warp uses both in-app toasts AND system notifications. Should we integrate with OS notification center for long-running builds?

3. **Custom toast types needed?** Beyond success/error/info/warning, do we need "build progress", "git operation", etc.? Sonner supports custom rendering.

4. **Persistence across route changes?** Sonner's global observer handles this, but verify with your routing setup.

## Pitfalls

### Don't Spam Users
**What happens:** User gets overwhelmed, ignores all toasts, misses important errors
**Avoid by:**
- Only toast user-initiated actions
- Batch rapid updates (e.g., "5 files saved" not 5 toasts)
- Use in-context status when possible (e.g., progress bar over toast)

### Don't Forget Error Details
**What happens:** "Build failed" toast with no context to debug
**Avoid by:**
```tsx
toast.error('Build failed', {
  description: error.message,
  action: {
    label: 'View Logs',
    onClick: () => openLogs()
  }
});
```

### Don't Block Critical Actions
**What happens:** Toast covers "Save" button right when user needs it
**Avoid by:**
- Bottom-right position (out of main content flow)
- Don't make toasts too tall
- Test with smallest supported screen size

### Don't Use for Permanent Info
**What happens:** Important status disappears after 5 seconds
**Avoid by:**
- Use toasts for transient confirmations only
- Put persistent status in UI (status bar, header badge)
- Offer "View Details" action for complex info

### Timer Behavior
**What happens:** User tries to read error toast, it dismisses mid-read
**Avoid by:**
- Sonner auto-pauses timer on hover (built-in)
- Use longer duration for errors (8s minimum)
- Add closeButton for manual control

## Sources

**HIGH confidence:**
- [Sonner Official Docs](https://sonner.emilkowal.ski/)
- [Sonner GitHub](https://github.com/emilkowalski/sonner)
- [VS Code UX Guidelines - Notifications](https://code.visualstudio.com/api/ux-guidelines/notifications)
- [Warp Notifications Docs](https://docs.warp.dev/terminal/more-features/notifications)
- [React Hot Toast Official](https://react-hot-toast.com/)

**MEDIUM confidence:**
- [Top 9 React notification libraries 2026 | Knock](https://knock.app/blog/the-top-notification-libraries-for-react)
- [Comparing React toast libraries 2025 | LogRocket](https://blog.logrocket.com/react-toast-libraries-compared-2025/)
- [Sonner NPM Package](https://www.npmjs.com/package/sonner)
- [Toast notification UX best practices | LogRocket](https://blog.logrocket.com/ux-design/toast-notifications/)
- [Bundlephobia - sonner](https://bundlephobia.com/package/sonner)

**LOW confidence (needs validation):**
- Electron compatibility: Inferred from React compatibility, not explicitly documented
- Exact bundle sizes: Community reports vary (2-3KB vs 165KB unpacked)
