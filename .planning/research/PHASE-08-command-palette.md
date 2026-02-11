# Research: Command Palette for React + Electron Desktop App

**Date:** 2026-02-11
**Domain:** React, Electron, Command Palette UI
**Overall Confidence:** HIGH

## TL;DR

Use **cmdk** (pacocoursey/cmdk) for the command palette UI component. It's battle-tested (Linear, Raycast), unstyled for full design control, and has minimal bundle size. Pair it with **match-sorter** for fuzzy search (simpler and more deterministic than fuse.js). Register global Cmd+K/Ctrl+K shortcut in Electron's main process via `globalShortcut`, communicate to renderer via IPC. Use a centralized command registry that extensions/panels can contribute to, inspired by VS Code's contribution point model. Radix Dialog (already a cmdk dependency) provides focus trapping and accessibility out of the box.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| cmdk | ^1.0.4 | Command palette component | HIGH |
| @tanstack/match-sorter-utils | ^8.19.4 | Fuzzy search/filtering | HIGH |
| Radix UI Dialog | (via cmdk) | Modal overlay, focus trap | HIGH |
| Electron globalShortcut | built-in | Global Cmd+K registration | HIGH |

**Install:**
```bash
pnpm add cmdk @tanstack/match-sorter-utils
```

Note: cmdk already depends on `@radix-ui/react-dialog`, so no separate install needed.

## Library Comparison

### cmdk vs kbar vs hand-rolling

**cmdk (RECOMMENDED):**
- **Pros:** Minimal, unstyled (full design control), composable API, automatic filtering/sorting, 12.2k GitHub stars, proven at scale (Linear, Raycast, Vercel), built by Paco Coursey (Vercel team)
- **Cons:** No built-in animations (but this is a pro for custom design), nested groups have search limitations
- **Bundle size:** Small minzip (specific number not stated, but referenced as "minimal")
- **API design:** Declarative JSX components (`Command`, `Command.Input`, `Command.List`, `Command.Item`, `Command.Group`)
- **Confidence:** HIGH — best fit for Breadcrumb's custom design requirements

**kbar:**
- **Pros:** Built-in animations, nested actions with backspace navigation, keyboard shortcuts per action, history management, screen reader support
- **Cons:** More opinionated design, less styling flexibility, smaller ecosystem (though still popular)
- **Performance:** Handles tens of thousands of actions
- **API design:** Action-based with provider pattern (`KBarProvider`, actions array)
- **Confidence:** MEDIUM — good library, but cmdk is better for unstyled requirements

**Hand-rolling:**
- **Pros:** Full control
- **Cons:** Must implement keyboard navigation, focus trapping, accessibility, filtering, sorting, and all edge cases — estimated 2-3 weeks of work
- **Confidence:** LOW — don't hand-roll what's already solved

**Verdict:** Use **cmdk**. It's the de facto standard for unstyled command palettes, gives full design control, and is proven in production at companies with high UX standards.

## Fuzzy Search Library

### match-sorter vs fuse.js vs flexsearch

**match-sorter (RECOMMENDED):**
- **Pros:** Simple, deterministic ranking (case-sensitive equals → case-insensitive → starts with → contains), integrates easily with React useMemo, sensible UX
- **Cons:** Less sophisticated than fuse.js (but this is often better for command palettes)
- **Performance:** Fast for typical command palette sizes (100-1000 items)
- **Bundle size:** Small
- **Confidence:** HIGH — perfect for command palette use case

**fuse.js:**
- **Pros:** Powerful, flexible, zero dependencies, 19.8k stars, 3.5M weekly npm downloads
- **Cons:** Scoring system can be slower with large datasets, sometimes over-ranks irrelevant matches
- **Use case:** Best for complex search requirements (e.g., multi-field weighted search)
- **Confidence:** MEDIUM — overkill for command palette

**flexsearch:**
- **Pros:** Fastest full-text search, non-blocking async, supports web workers
- **Cons:** Overkill for in-memory command lists, designed for large document search
- **Confidence:** LOW — not needed for command palette

**Verdict:** Use **match-sorter** (via `@tanstack/match-sorter-utils` which separates filtering and sorting). cmdk has built-in filtering, but if you need custom fuzzy matching for command names/aliases, match-sorter is the right tool.

## Architecture: Command Registration

Inspired by VS Code's contribution point model (see existing extension-system-architecture.md research).

### Centralized Command Registry

```typescript
// main/commands/CommandRegistry.ts
export interface Command {
  id: string;                    // Unique identifier (e.g., "breadcrumb.terminal.new")
  title: string;                 // Display name
  category?: string;             // Group label (e.g., "Terminal")
  keywords?: string[];           // Aliases for fuzzy search
  icon?: string;                 // lucide-react icon name
  shortcut?: string[];           // Keyboard shortcut (e.g., ["Cmd", "T"])
  when?: string;                 // Conditional context (e.g., "terminalFocus")
  handler: (...args: any[]) => void | Promise<void>;
  source: 'core' | 'extension';  // Command origin
  extensionId?: string;          // If from extension
}

class CommandRegistry {
  private commands = new Map<string, Command>();

  register(command: Command): void {
    if (this.commands.has(command.id)) {
      console.warn(`Command ${command.id} already registered, skipping`);
      return;
    }
    this.commands.set(command.id, command);
  }

  unregister(commandId: string): void {
    this.commands.delete(commandId);
  }

  execute(commandId: string, ...args: any[]): Promise<void> {
    const command = this.commands.get(commandId);
    if (!command) {
      throw new Error(`Command not found: ${commandId}`);
    }
    return Promise.resolve(command.handler(...args));
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  search(query: string): Command[] {
    // Use match-sorter for fuzzy search
    const searchable = this.getAll().map(cmd => ({
      ...cmd,
      searchableText: [cmd.title, cmd.category, ...(cmd.keywords || [])].join(' ')
    }));

    return matchSorter(searchable, query, { keys: ['searchableText', 'id'] });
  }
}
```

### Registration from Different Sources

**Core system commands (Main Process):**
```typescript
// main/commands/coreCommands.ts
export function registerCoreCommands(registry: CommandRegistry) {
  registry.register({
    id: 'breadcrumb.terminal.new',
    title: 'New Terminal',
    category: 'Terminal',
    keywords: ['shell', 'console', 'bash'],
    icon: 'terminal',
    shortcut: ['Cmd', 'T'],
    handler: () => terminalService.createTerminal(),
    source: 'core'
  });

  registry.register({
    id: 'breadcrumb.browser.navigate',
    title: 'Navigate to URL',
    category: 'Browser',
    icon: 'globe',
    handler: async () => {
      const url = await showInputDialog('Enter URL');
      if (url) browserPanel.navigate(url);
    },
    source: 'core'
  });

  // ... more core commands
}
```

**Extension commands (Extension Host):**
```typescript
// Extension code (runs in Extension Host process)
export function activate(context: ExtensionContext) {
  // Via API surface (from extension-system-architecture.md)
  const disposable = breadcrumb.commands.registerCommand(
    'breadcrumb.db.connect',
    async () => {
      const uri = await breadcrumb.window.showInputBox({
        prompt: 'Enter connection string'
      });
      // ... handle command
    }
  );

  context.subscriptions.push(disposable);
}
```

**Panel/component commands (Renderer):**
```typescript
// renderer/panels/TerminalPanel.tsx
import { useCommandRegistry } from '@/hooks/useCommandRegistry';

export function TerminalPanel() {
  const { registerCommand, unregisterCommand } = useCommandRegistry();

  useEffect(() => {
    // Register panel-specific commands
    const commandId = registerCommand({
      id: 'breadcrumb.terminal.split',
      title: 'Split Terminal',
      category: 'Terminal',
      when: 'terminalFocus',
      handler: () => splitCurrentTerminal(),
      source: 'core'
    });

    return () => unregisterCommand(commandId);
  }, []);

  // ...
}
```

### IPC Communication Pattern

```typescript
// preload/index.ts (contextBridge)
contextBridge.exposeInMainWorld('breadcrumbAPI', {
  commands: {
    getAll: () => ipcRenderer.invoke('commands:getAll'),
    execute: (commandId: string, ...args: any[]) =>
      ipcRenderer.invoke('commands:execute', commandId, ...args),
    register: (command: Command) =>
      ipcRenderer.invoke('commands:register', command),
  }
});

// main/ipc/commandIpc.ts
export function registerCommandIPCHandlers() {
  ipcMain.handle('commands:getAll', () => {
    return commandRegistry.getAll();
  });

  ipcMain.handle('commands:execute', async (event, commandId, ...args) => {
    await commandRegistry.execute(commandId, ...args);
  });

  ipcMain.handle('commands:register', (event, command) => {
    commandRegistry.register(command);
  });
}
```

## Keyboard Handling: Global Cmd+K

### Electron globalShortcut (Main Process)

```typescript
// main/index.ts
import { app, globalShortcut, BrowserWindow } from 'electron';

app.whenReady().then(() => {
  // Register global shortcut
  const registered = globalShortcut.register('CommandOrControl+K', () => {
    // Send event to renderer to open command palette
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.webContents.send('command-palette:toggle');
    }
  });

  if (!registered) {
    console.warn('Cmd+K shortcut registration failed (already taken by another app)');
  }

  // Check if registered successfully
  console.log('Cmd+K registered:', globalShortcut.isRegistered('CommandOrControl+K'));
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});
```

**Key considerations:**
- Use `CommandOrControl` for cross-platform (Cmd on macOS, Ctrl on Windows/Linux)
- `register()` returns `false` if shortcut is already taken by another app (silent failure by OS design)
- Register after `app.whenReady()` for Wayland compatibility
- Always unregister on `will-quit` to clean up
- `globalShortcut` only works in main process (not renderer)

### Renderer Integration

```typescript
// renderer/App.tsx
import { useEffect, useState } from 'react';

export function App() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    // Listen for IPC event from main process
    const unsubscribe = window.electron.ipcRenderer.on(
      'command-palette:toggle',
      () => {
        setCommandPaletteOpen(prev => !prev);
      }
    );

    return unsubscribe;
  }, []);

  return (
    <>
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      {/* ... rest of app */}
    </>
  );
}
```

### Terminal Input Conflict Handling

**Problem:** If a terminal has focus, Cmd+K might be captured by the shell (e.g., zsh's kill-line).

**Solution:** Global shortcuts in Electron intercept before reaching the terminal, so Cmd+K will always trigger the command palette. If users want Cmd+K in the terminal, they can:
1. Use an alternative shortcut for the command palette (configurable)
2. Disable global shortcut when terminal has focus (check with `when` clause)

```typescript
// Example: conditional shortcut based on focus
app.whenReady().then(() => {
  globalShortcut.register('CommandOrControl+K', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      // Check if terminal has focus before showing palette
      focusedWindow.webContents.send('command-palette:request-open');
    }
  });
});

// Renderer checks focus and decides
window.electron.ipcRenderer.on('command-palette:request-open', () => {
  const terminalHasFocus = document.activeElement?.closest('[data-terminal]');
  if (!terminalHasFocus) {
    setCommandPaletteOpen(true);
  }
});
```

## UI Patterns

### Overlay & Modal

Use cmdk's `Command.Dialog` which wraps Radix Dialog:

```tsx
import { Command } from 'cmdk';

export function CommandPalette({ open, onOpenChange }) {
  return (
    <Command.Dialog open={open} onOpenChange={onOpenChange}>
      <Command.Input placeholder="Type a command or search..." />
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>
        <Command.Group heading="Suggestions">
          <Command.Item>New Terminal</Command.Item>
          <Command.Item>Open Browser</Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
```

**Radix Dialog provides:**
- Focus trapping (Tab/Shift+Tab cycles within modal)
- Escape key to close
- Overlay click to close (configurable via `onPointerDownOutside`)
- Screen reader support (WAI-ARIA Dialog pattern)
- Auto-focus on open (via `onOpenAutoFocus`)

### Animations

cmdk is unstyled, so animations are fully customizable. Recommended approach:

```tsx
// renderer/components/CommandPalette.tsx
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion'; // or use CSS transitions

export function CommandPalette({ open, onOpenChange }) {
  return (
    <Command.Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="command-palette"
          >
            <Command.Input />
            <Command.List>
              {/* ... items */}
            </Command.List>
          </motion.div>
        )}
      </AnimatePresence>
    </Command.Dialog>
  );
}
```

**Alternatives to framer-motion:**
- CSS transitions with Tailwind (simpler, no extra dependency)
- `motion` library (already installed in package.json, lightweight alternative)

**Note:** Breadcrumb already uses `motion` (v12.31.0), so prefer that over adding framer-motion.

### Result Grouping

cmdk provides `Command.Group` for categorization:

```tsx
<Command.List>
  <Command.Group heading="Terminal">
    <Command.Item>New Terminal</Command.Item>
    <Command.Item>Split Terminal</Command.Item>
  </Command.Group>

  <Command.Group heading="Browser">
    <Command.Item>Navigate to URL</Command.Item>
    <Command.Item>Reload Page</Command.Item>
  </Command.Group>

  <Command.Group heading="Recent">
    <Command.Item>Connect Database (2 min ago)</Command.Item>
  </Command.Group>
</Command.List>
```

**Grouping strategy:**
1. **Recent commands** (top, max 5 items, from localStorage)
2. **Category groups** (Terminal, Browser, Extensions, etc.)
3. **All commands** (if query is empty, show all)

### Keyboard Navigation

cmdk handles this automatically:
- Arrow Up/Down: Navigate items
- Enter: Execute selected command
- Escape: Close palette
- Tab/Shift+Tab: Cycle focus within palette (Radix Dialog focus trap)
- Optional: `loop` prop to wrap arrow navigation

```tsx
<Command.List loop>
  {/* Items will wrap: last item → first item */}
</Command.List>
```

### Recent Commands Pattern

```typescript
// renderer/hooks/useRecentCommands.ts
const RECENT_COMMANDS_KEY = 'breadcrumb:recentCommands';
const MAX_RECENT = 5;

export function useRecentCommands() {
  const [recent, setRecent] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_COMMANDS_KEY);
    if (stored) {
      setRecent(JSON.parse(stored));
    }
  }, []);

  const addRecentCommand = (commandId: string) => {
    setRecent(prev => {
      // Remove if already exists (move to top)
      const filtered = prev.filter(id => id !== commandId);
      // Add to front, limit to MAX_RECENT
      const updated = [commandId, ...filtered].slice(0, MAX_RECENT);
      localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  return { recent, addRecentCommand };
}

// Usage in CommandPalette
export function CommandPalette({ open, onOpenChange }) {
  const { recent, addRecentCommand } = useRecentCommands();
  const [commands, setCommands] = useState<Command[]>([]);

  useEffect(() => {
    window.breadcrumbAPI.commands.getAll().then(setCommands);
  }, []);

  const recentCommands = commands.filter(cmd => recent.includes(cmd.id));

  return (
    <Command.Dialog open={open} onOpenChange={onOpenChange}>
      <Command.Input />
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>

        {recentCommands.length > 0 && (
          <Command.Group heading="Recent">
            {recentCommands.map(cmd => (
              <Command.Item
                key={cmd.id}
                value={cmd.id}
                onSelect={() => {
                  window.breadcrumbAPI.commands.execute(cmd.id);
                  addRecentCommand(cmd.id);
                  onOpenChange(false);
                }}
              >
                {cmd.title}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Other groups */}
      </Command.List>
    </Command.Dialog>
  );
}
```

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Command palette UI | cmdk | Focus trapping, keyboard nav, accessibility, filtering — all solved |
| Fuzzy search | match-sorter | Deterministic ranking, simple API, already battle-tested |
| Global shortcuts | Electron globalShortcut | OS-level registration, handles conflicts automatically |
| Focus trapping | Radix Dialog (via cmdk) | WAI-ARIA compliant, handles edge cases (nested dialogs, escape key) |
| Command registry | Centralized Map + IPC | Extensions, core, and panels all register to one source of truth |

## Pitfalls

### Global Shortcut Conflicts
**What happens:** Another app (e.g., Spotlight, Raycast) already uses Cmd+K, Electron registration silently fails.
**Avoid by:** Check return value of `globalShortcut.register()`, log warning, allow users to configure alternative shortcut (e.g., Cmd+Shift+K).

### IPC Payload Size for Commands
**What happens:** Sending all commands (with handlers as functions) over IPC fails (functions can't be serialized).
**Avoid by:** Only send command metadata (id, title, category) to renderer. Keep handlers in main process, execute via `commands:execute` IPC call.

### Terminal Focus Stealing
**What happens:** Opening command palette removes focus from terminal, breaking user's typing flow.
**Avoid by:** Radix Dialog's `onCloseAutoFocus` can return focus to previous element. Alternatively, check if terminal has focus before showing palette.

### Command ID Conflicts
**What happens:** Two extensions register the same command ID, second silently fails (or overwrites first).
**Avoid by:** Namespace commands with extension ID (e.g., `extensionId.commandName`). Warn in console on conflicts. Core commands use `breadcrumb.` prefix.

### Stale Command List
**What happens:** User installs extension, command palette doesn't show new commands until restart.
**Avoid by:** Listen for extension lifecycle events, refresh command list in renderer via IPC event when extensions load/unload.

### Performance with Many Commands
**What happens:** 1000+ commands slow down filtering/rendering.
**Avoid by:** cmdk handles up to 2,000-3,000 items well (no virtualization). For larger lists, use `Command.Loading` state and debounce input. Alternatively, fetch commands on-demand based on query.

### Nested Groups Search Issue
**What happens:** cmdk nested groups don't participate in search (known limitation).
**Avoid by:** Flatten command structure for search. If you need visual nesting in the UI, use flat items with category prefixes (e.g., "Database > Connect").

## Key Patterns

### Basic Command Palette with cmdk

```tsx
// renderer/components/CommandPalette.tsx
import { Command } from 'cmdk';
import { useEffect, useState } from 'react';

export function CommandPalette({ open, onOpenChange }) {
  const [commands, setCommands] = useState([]);

  useEffect(() => {
    if (open) {
      window.breadcrumbAPI.commands.getAll().then(setCommands);
    }
  }, [open]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      className="command-palette-dialog"
    >
      <div className="command-palette-wrapper">
        <Command.Input
          placeholder="Type a command or search..."
          className="command-palette-input"
        />
        <Command.List className="command-palette-list">
          <Command.Empty>No results found.</Command.Empty>

          {commands.reduce((groups, cmd) => {
            const category = cmd.category || 'Other';
            if (!groups[category]) groups[category] = [];
            groups[category].push(cmd);
            return groups;
          }, {}).map(([category, items]) => (
            <Command.Group key={category} heading={category}>
              {items.map(cmd => (
                <Command.Item
                  key={cmd.id}
                  value={cmd.id}
                  keywords={cmd.keywords}
                  onSelect={async () => {
                    await window.breadcrumbAPI.commands.execute(cmd.id);
                    onOpenChange(false);
                  }}
                >
                  <span className="command-icon">{cmd.icon}</span>
                  <span className="command-title">{cmd.title}</span>
                  {cmd.shortcut && (
                    <span className="command-shortcut">
                      {cmd.shortcut.join(' ')}
                    </span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
```

### Styling with Tailwind (Warp-like Dark Aesthetic)

```tsx
<Command.Dialog className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
  <div className="fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/3 w-full max-w-2xl">
    <div className="bg-[#0a0a0f] border border-gray-800 rounded-xl shadow-2xl overflow-hidden">
      <Command.Input
        className="w-full px-6 py-4 bg-transparent text-white placeholder:text-gray-500 text-lg outline-none"
        placeholder="Type a command or search..."
      />
      <Command.List className="max-h-[400px] overflow-y-auto px-2 pb-2">
        <Command.Empty className="px-4 py-8 text-center text-gray-500">
          No results found.
        </Command.Empty>

        <Command.Group
          heading="Terminal"
          className="text-xs text-gray-400 px-4 py-2 font-semibold"
        >
          <Command.Item className="px-4 py-3 rounded-lg cursor-pointer data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-blue-600/20 data-[selected=true]:to-purple-600/20 data-[selected=true]:text-white flex items-center gap-3 transition-all">
            <Terminal className="w-4 h-4" />
            <span>New Terminal</span>
            <span className="ml-auto text-xs text-gray-500">⌘ T</span>
          </Command.Item>
        </Command.Group>
      </Command.List>
    </div>
  </div>
</Command.Dialog>
```

### Custom Filter with match-sorter

```tsx
import { matchSorter } from '@tanstack/match-sorter-utils';

export function CommandPalette({ open, onOpenChange }) {
  const [search, setSearch] = useState('');
  const [commands, setCommands] = useState([]);

  useEffect(() => {
    window.breadcrumbAPI.commands.getAll().then(setCommands);
  }, []);

  const filteredCommands = useMemo(() => {
    if (!search) return commands;

    return matchSorter(commands, search, {
      keys: ['title', 'keywords', 'category'],
      threshold: matchSorter.rankings.CONTAINS
    });
  }, [commands, search]);

  return (
    <Command.Dialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <Command.Input
        value={search}
        onValueChange={setSearch}
        placeholder="Search commands..."
      />
      <Command.List>
        {filteredCommands.map(cmd => (
          <Command.Item key={cmd.id} value={cmd.id}>
            {cmd.title}
          </Command.Item>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
```

Note: Set `shouldFilter={false}` when using custom filtering.

## Open Questions

**Should commands be async?** YES — some commands need to show dialogs, wait for user input, or perform network requests. Handlers should return `Promise<void>`.

**Should the command palette support nested/sub-commands?** DEFER — MVP should have flat commands with categories. If needed later, implement via command chaining (command opens a new palette with sub-options).

**Should keyboard shortcuts be configurable?** DEFER — Hardcode Cmd+K for MVP. Add user-configurable shortcuts in a future phase (requires keybinding editor UI).

**Should the palette show command shortcuts in the UI?** YES — helps with discoverability. Display as right-aligned pill (e.g., "⌘ T").

## Completion Criteria

- [ ] cmdk installed and basic command palette renders
- [ ] Global Cmd+K/Ctrl+K shortcut registered in Electron main process
- [ ] IPC communication: main process sends command list to renderer
- [ ] Centralized CommandRegistry in main process
- [ ] Core commands registered (New Terminal, Navigate Browser, etc.)
- [ ] Extensions can register commands via API surface
- [ ] Command palette groups commands by category
- [ ] Keyboard navigation works (arrows, enter, escape)
- [ ] Recent commands section (max 5, persisted to localStorage)
- [ ] Warp-like dark aesthetic applied (deep backgrounds, gradient accents)
- [ ] Focus returns to previous element on close
- [ ] Empty state shows "No results found"
- [ ] Command shortcuts displayed in UI (right-aligned)

## Sources

**HIGH confidence:**
- [pacocoursey/cmdk GitHub](https://github.com/pacocoursey/cmdk)
- [cmdk Documentation](https://cmdk.paco.me)
- [Radix UI Dialog](https://www.radix-ui.com/primitives/docs/components/dialog)
- [Electron globalShortcut API](https://www.electronjs.org/docs/latest/api/global-shortcut)
- [Electron Keyboard Shortcuts Tutorial](https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts)
- [VS Code Command Palette Extension API](https://code.visualstudio.com/api/ux-guidelines/command-palette)
- [match-sorter on npm](https://www.npmjs.com/package/match-sorter)

**MEDIUM confidence:**
- [kbar GitHub](https://github.com/timc1/kbar)
- [kbar Documentation](https://kbar.vercel.app)
- [Command Palette UI Design Best Practices (Mobbin)](https://mobbin.com/glossary/command-palette)
- [Designing Command Palettes (Sam Solomon)](https://solomon.io/designing-command-palettes/)
- [How to Build a Remarkable Command Palette (Superhuman)](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/)

**LOW confidence (needs validation):**
- [React Command Palette with Tailwind (LogRocket)](https://blog.logrocket.com/react-command-palette-tailwind-css-headless-ui/)
- [Fuse.js vs FlexSearch comparison (npm-compare)](https://npm-compare.com/fuse.js,fuzzy-search,fuzzysort)
