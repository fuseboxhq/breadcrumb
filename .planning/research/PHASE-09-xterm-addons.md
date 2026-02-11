# Research: xterm.js Addons for Production Terminal

**Date:** 2026-02-11
**Domain:** Terminal emulation, xterm.js ecosystem
**Overall Confidence:** HIGH

## TL;DR

Use the official @xterm namespace addons (formerly xterm-addon-*). All five addons exist and are production-ready. SearchAddon provides regex/case-sensitive search with highlighting. WebLinksAddon handles clickable URLs with custom handlers and OSC 8 support. Unicode11Addon fixes emoji/CJK character widths. SerializeAddon is experimental but works for session persistence. ImageAddon supports SIXEL and iTerm inline images (beta quality). Install via npm, import, instantiate, call `terminal.loadAddon()`.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| @xterm/addon-search | 0.15.0 | Terminal output search with regex/highlighting | HIGH |
| @xterm/addon-web-links | 0.12.0 | Clickable URL detection and OSC 8 hyperlinks | HIGH |
| @xterm/addon-unicode11 | 0.10.0 | Unicode 11 character width rules (emoji/CJK) | HIGH |
| @xterm/addon-serialize | 0.14.0 | Terminal state serialization (experimental) | MEDIUM |
| @xterm/addon-image | 0.9.0-beta.38 | SIXEL and iTerm inline image protocol (beta) | MEDIUM |

**Install:**
```bash
npm install --save @xterm/addon-search @xterm/addon-web-links @xterm/addon-unicode11 @xterm/addon-serialize @xterm/addon-image
```

## 1. @xterm/addon-search

### What It Does
Enables searching terminal buffer content with match highlighting, forward/backward navigation, regex support, and case sensitivity options.

### Import and Setup
```typescript
import { Terminal } from '@xterm/xterm';
import { SearchAddon } from '@xterm/addon-search';

const terminal = new Terminal();
const searchAddon = new SearchAddon({ highlightLimit: 1000 });
terminal.loadAddon(searchAddon);
```

### Key API Methods

#### Constructor
```typescript
constructor(options?: Partial<ISearchAddonOptions>);

interface ISearchAddonOptions {
  highlightLimit: number;  // Max matches highlighted (default: 1000)
}
```

#### Search Methods
```typescript
// Search forward for term, returns true if match found
findNext(term: string, searchOptions?: ISearchOptions): boolean;

// Search backward for term, returns true if match found
findPrevious(term: string, searchOptions?: ISearchOptions): boolean;

// Remove all search highlights
clearDecorations(): void;

// Remove current match highlight only
clearActiveDecoration(): void;
```

#### ISearchOptions
```typescript
interface ISearchOptions {
  regex?: boolean;           // Interpret term as regular expression
  wholeWord?: boolean;       // Match only complete words
  caseSensitive?: boolean;   // Case-sensitive matching
  incremental?: boolean;     // Expand selection on match (findNext only)
  decorations?: ISearchDecorationOptions;
}
```

#### Events
```typescript
readonly onAfterSearch: IEvent<void>;
readonly onBeforeSearch: IEvent<void>;
readonly onDidChangeResults: IEvent<ISearchResultChangeEvent>;
```

### Integration Pattern
```typescript
// Load addon
terminal.loadAddon(searchAddon);

// Basic search
searchAddon.findNext('error');

// Regex search with options
searchAddon.findNext('ERROR|WARN', {
  regex: true,
  caseSensitive: false
});

// Navigate results
searchAddon.findNext('foo');  // Next match
searchAddon.findPrevious('foo');  // Previous match

// Clear highlights when done
searchAddon.clearDecorations();
```

### Gotchas
- `highlightLimit` defaults to 1000 to prevent performance issues with huge buffers
- Regex patterns must be valid JavaScript RegExp syntax
- Decorations persist until explicitly cleared with `clearDecorations()`
- Search is synchronous and may block on very large buffers

---

## 2. @xterm/addon-web-links

### What It Does
Automatically detects URLs in terminal output and makes them clickable. Supports custom link handlers for hover/click behavior and OSC 8 hyperlink protocol for explicit links.

### Import and Setup
```typescript
import { Terminal } from '@xterm/xterm';
import { WebLinksAddon } from '@xterm/addon-web-links';

// Basic usage (default handler opens in browser)
const terminal = new Terminal();
terminal.loadAddon(new WebLinksAddon());

// Custom click handler
const webLinksAddon = new WebLinksAddon(
  (event, uri) => {
    console.log('Link clicked:', uri);
    // Custom behavior here
  }
);
terminal.loadAddon(webLinksAddon);

// With hover/leave handlers
const webLinksAddon = new WebLinksAddon(
  (event, uri) => { /* click */ },
  {
    hover: (event, text, location) => {
      console.log('Hovering over:', text);
    },
    leave: (event, text) => {
      console.log('Left link:', text);
    },
    urlRegex: /custom-pattern/  // Optional custom URL detection
  }
);
terminal.loadAddon(webLinksAddon);
```

### Key API

#### Constructor
```typescript
constructor(
  handler?: (event: MouseEvent, uri: string) => void,
  options?: ILinkProviderOptions
);
```

#### ILinkProviderOptions
```typescript
interface ILinkProviderOptions {
  hover?(event: MouseEvent, text: string, location: IViewportRange): void;
  leave?(event: MouseEvent, text: string): void;
  urlRegex?: RegExp;  // Custom URL pattern (overrides default detection)
}
```

### OSC 8 Hyperlink Support
The addon automatically handles OSC 8 escape sequences for explicit hyperlinks:

```bash
# Shell output with OSC 8 (format: \e]8;;URL\e\\TEXT\e]8;;\e\\)
echo -e '\e]8;;https://example.com\e\\Click here\e]8;;\e\\'
```

When OSC 8 links are present, the custom handler receives the explicit URL, not the display text.

### Integration Pattern
```typescript
// For Electron app, open links in default browser
const webLinksAddon = new WebLinksAddon((event, uri) => {
  event.preventDefault();
  require('electron').shell.openExternal(uri);
});

terminal.loadAddon(webLinksAddon);
```

### Gotchas
- Default handler behavior varies by environment (browser vs Electron)
- In Electron, use `electron.shell.openExternal()` to open in system browser
- `hover` fires on mouseover; `leave` fires on mouseout even if hover never fired
- Custom `urlRegex` completely replaces default detection (doesn't extend it)
- OSC 8 links take precedence over pattern-matched URLs

---

## 3. @xterm/addon-unicode11

### What It Does
Provides Unicode version 11 character width calculations for proper rendering of emoji, CJK characters, and other wide/ambiguous-width Unicode characters.

### Why You Need It
xterm.js defaults to older Unicode width rules. Without this addon:
- Emoji may render with incorrect width (overlapping or gaps)
- CJK (Chinese/Japanese/Korean) characters may misalign
- Complex combining characters break visual layout

The addon updates character widths to Unicode 11 standards using wcwidth-based calculations.

### Import and Setup
```typescript
import { Terminal } from '@xterm/xterm';
import { Unicode11Addon } from '@xterm/addon-unicode11';

const terminal = new Terminal();
const unicode11Addon = new Unicode11Addon();
terminal.loadAddon(unicode11Addon);

// Activate Unicode 11 rules
terminal.unicode.activeVersion = '11';
```

### Key API

#### Constructor
```typescript
constructor();
```

#### Methods
```typescript
activate(terminal: Terminal): void;
dispose(): void;
```

### Integration Pattern
```typescript
// Load and activate
terminal.loadAddon(new Unicode11Addon());
terminal.unicode.activeVersion = '11';

// Verify active version
console.log(terminal.unicode.activeVersion);  // '11'
```

### Gotchas
- You MUST set `terminal.unicode.activeVersion = '11'` after loading the addon
- Loading the addon alone doesn't activate it
- xterm.js actually uses Unicode 12 internally despite the "11" name (known discrepancy)
- Not grapheme-cluster-aware: compound emojis (🏳️‍🌈) may still have issues
- For newer emoji (Unicode 13+), character widths may still be incorrect
- Performance impact is minimal (width lookup tables)

---

## 4. @xterm/addon-serialize

### What It Does
Serializes terminal state (scrollback, cursor position, colors) to a string or HTML format for persistence and restoration across sessions.

**Status:** Experimental (still under construction according to docs)

### Import and Setup
```typescript
import { Terminal } from '@xterm/xterm';
import { SerializeAddon } from '@xterm/addon-serialize';

const terminal = new Terminal();
const serializeAddon = new SerializeAddon();
terminal.loadAddon(serializeAddon);
```

### Key API Methods

#### serialize()
```typescript
serialize(options?: ISerializeOptions): string;

interface ISerializeOptions {
  range?: ISerializeRange;        // Line range to serialize
  scrollback?: number;            // Number of scrollback lines
  excludeModes?: boolean;         // Exclude terminal modes
  excludeAltBuffer?: boolean;     // Exclude alternate buffer
}

interface ISerializeRange {
  start: number | IMarker;
  end: number | IMarker;
}
```

Returns a string that can be written back to the terminal to restore state.

#### serializeAsHTML()
```typescript
serializeAsHTML(options?: Partial<IHTMLSerializeOptions>): string;

interface IHTMLSerializeOptions {
  scrollback?: number;
  onlySelection?: boolean;         // Only serialize selected text
  includeGlobalBackground?: boolean;
  range?: ISerializeBufferRange;
}
```

Returns HTML with inline styles preserving colors and formatting (useful for clipboard).

### Integration Pattern
```typescript
// Serialize current state
const state = serializeAddon.serialize();

// Save to storage (Electron example)
localStorage.setItem('terminal_state', state);

// Restore later (BEFORE terminal.open() for best performance)
const savedState = localStorage.getItem('terminal_state');
if (savedState) {
  terminal.write(savedState);
}
terminal.open(container);

// HTML export (for copy/paste)
const html = serializeAddon.serializeAsHTML({ onlySelection: true });
```

### Gotchas
- **Experimental status**: API may change between versions
- Restore works best BEFORE `terminal.open()` to avoid rendering incomplete frames
- Serialized state includes cursor position and colors
- Recommended to restore into terminal of same size, then resize
- Alternate buffer state may not serialize correctly (use `excludeAltBuffer: true`)
- Large scrollback = large serialized strings (use `scrollback` option to limit)
- No compression built-in (gzip the string if storing persistently)

---

## 5. @xterm/addon-image

### What It Does
Renders inline images in the terminal using SIXEL or iTerm Inline Image Protocol (IIP).

**Status:** Beta quality (SIXEL is beta, IIP is alpha)

### Import and Setup
```typescript
import { Terminal } from '@xterm/xterm';
import { ImageAddon, IImageAddonOptions } from '@xterm/addon-image';

const terminal = new Terminal();
const imageAddon = new ImageAddon({
  pixelLimit: 16777216,      // Max pixels per image (default: 16M)
  storageLimit: 128,         // FIFO storage in MB (default: 128)
  sixelSupport: true,        // Enable SIXEL (default: true)
  iipSupport: true,          // Enable iTerm IIP (default: true)
  sixelScrolling: true,      // Auto-scroll on image (default: true)
  showPlaceholder: false     // Show placeholder for evicted images
});

terminal.loadAddon(imageAddon);
```

### Supported Protocols

#### SIXEL
DEC SIXEL graphics protocol (used by xterm -ti vt340, mintty, mlterm, etc.)

```bash
# Test SIXEL output (requires ImageMagick)
convert image.png sixel:- | cat
```

Limitations:
- Palette limited to 256 registers by default (increase via `sixelPaletteLimit` to max 4096)
- Palette colors carry over between images (no private/shared distinction)
- Raster attributes (level 2) truncate image to given size for performance

#### iTerm Inline Image Protocol (IIP)
```bash
# iTerm IIP format: \e]1337;File=inline=1:[base64 data]\a
printf '\e]1337;File=inline=1:'$(base64 < image.png)'\a'
```

Status: Alpha quality (less stable than SIXEL)

### Key API Methods

```typescript
// Get original image at cell coordinates
getImageAtBufferCell(x: number, y: number): HTMLCanvasElement | undefined;

// Get the actual tile rendered at cell
extractTileAtBufferCell(x: number, y: number): HTMLCanvasElement | undefined;
```

### Integration Pattern
```typescript
// Enable SIXEL-capable terminal
const terminal = new Terminal();
terminal.loadAddon(new ImageAddon());

// Terminal now renders SIXEL/IIP sequences automatically
// No additional code needed for display

// Access image data programmatically
const image = imageAddon.getImageAtBufferCell(10, 5);
if (image) {
  document.body.appendChild(image);  // Original image canvas
}
```

### Gotchas
- **High latency**: Image processing is slow due to xterm.js async parsing pipeline
- Not suitable for realtime/interactive graphics applications
- **Beta/alpha quality**: Expect bugs and API changes
- Storage limit uses FIFO eviction (oldest images removed when limit reached)
- Placeholder display requires explicit opt-in (`showPlaceholder: true`)
- SIXEL palette limit impacts color fidelity for large images
- Memory usage can grow quickly with many images (tune `storageLimit`)
- WebGL renderer may conflict (test thoroughly if using both)

---

## Terminal Options Reference

### Cursor Options

```typescript
const terminal = new Terminal({
  cursorStyle: 'block' | 'underline' | 'bar',  // Default: 'block'
  cursorBlink: boolean,                        // Default: false
  cursorWidth: number,                         // Width in pixels (bar style only)
  cursorInactiveStyle: 'outline' | 'block' | 'bar' | 'underline' | 'none'
});
```

**cursorStyle:**
- `'block'`: Filled block cursor (classic terminal)
- `'underline'`: Underline beneath character
- `'bar'`: Vertical bar (VSCode/modern editor style)

### Typography Options

```typescript
const terminal = new Terminal({
  fontFamily: 'monospace',                     // CSS font-family
  fontSize: 14,                                // Font size in pixels
  fontWeight: 'normal' | 'bold' | '100'-'900', // Default: 'normal'
  fontWeightBold: 'normal' | 'bold' | '100'-'900',
  letterSpacing: 0,                            // Spacing in pixels between chars
  lineHeight: 1.0,                             // Line height multiplier
});
```

**Recommendations:**
- Use web-safe monospace fonts: `'Menlo', 'Monaco', 'Courier New', monospace`
- Popular terminal fonts: JetBrains Mono, Fira Code, Cascadia Code, Consolas
- `letterSpacing: 0` is optimal for most fonts (non-zero can break rendering)
- `lineHeight: 1.0` is standard; increase for readability, decrease for density

### Scrollback Options

```typescript
const terminal = new Terminal({
  scrollback: 1000,           // Lines retained when scrolled off (default: 1000)
  fastScrollSensitivity: 5,   // Scroll multiplier when Alt held
  scrollSensitivity: 1,       // Normal scroll sensitivity
  smoothScrollDuration: 0,    // Smooth scroll animation duration (ms), 0 = disabled
});
```

**Performance Implications:**

| Scrollback | Memory (160x24 terminal) | Resize Time | Recommendation |
|------------|-------------------------|-------------|----------------|
| 1,000 | ~6.8 MB | <10ms | Default, good for most use cases |
| 5,000 | ~34 MB | 30-60ms | High but manageable |
| 10,000 | ~68 MB | 100-150ms | Noticeable lag on resize |
| 100,000 | ~680 MB | 1-2s | Only for log viewing, disable resize |
| Unlimited | Memory leak risk | N/A | **Not recommended** |

**Best Practices:**
- Use 1,000-5,000 for interactive shells
- Use 10,000-50,000 for log viewing (disable resize drag if needed)
- Never set to unlimited (issue #518: memory grows indefinitely)
- For truly infinite scrollback, implement virtual scrolling with SerializeAddon

### Window Options

```typescript
const terminal = new Terminal({
  windowOptions: {
    setWinLines?: boolean,        // Allow setting window lines
    getWinSizePixels?: boolean,   // Allow querying window size in pixels
    getCellSizePixels?: boolean,  // Allow querying cell size
    getWinSizeChars?: boolean,    // Allow querying window size in chars (rows/cols)
    pushTitle?: boolean,          // Allow title stack push
    popTitle?: boolean,           // Allow title stack pop
    setWinPosition?: boolean,     // Allow setting window position (security risk)
    raiseWin?: boolean,           // Allow raising window (security risk)
    lowerWin?: boolean,           // Allow lowering window (security risk)
    minimizeWin?: boolean,        // Allow minimizing window (security risk)
    maximizeWin?: boolean,        // Allow maximizing window (security risk)
    fullscreenWin?: boolean,      // Allow fullscreen (security risk)
  }
});
```

**Security Note:** All options default to `false` for security. Only enable what you need.

**Common Safe Configuration:**
```typescript
windowOptions: {
  setWinLines: true,         // Safe: allows resizing terminal rows
  getCellSizePixels: true,   // Safe: needed for proper rendering
  getWinSizeChars: true,     // Safe: allows querying size
  pushTitle: true,           // Safe: title stack for breadcrumb nav
  popTitle: true,            // Safe: restore previous title
}
```

**Never enable in production:**
- `setWinPosition`, `raiseWin`, `lowerWin`: Allow malicious scripts to move windows
- `minimizeWin`, `maximizeWin`, `fullscreenWin`: UI hijacking risk

### Other Production-Relevant Options

```typescript
const terminal = new Terminal({
  allowTransparency: false,        // Enable alpha channel (impacts performance)
  disableStdin: false,             // Disable user input (read-only terminal)
  convertEol: false,               // Auto-convert \n to \r\n
  rightClickSelectsWord: true,     // Right-click selects word (desktop UX)
  theme: {                         // Color theme
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    selection: '#44475a',
    // ... 16 ANSI colors
  },
  logLevel: 'info',                // 'debug' | 'info' | 'warn' | 'error' | 'off'
  customGlyphs: true,              // Render box-drawing with custom glyphs (better visual)
  rescaleOverlappingGlyphs: false, // Rescale wide glyphs (incompatible with DOM renderer)
});
```

---

## Production Terminal Recommendations

### Essential Addons (Use These)
1. **@xterm/addon-search** - Users expect Cmd+F search
2. **@xterm/addon-web-links** - Clickable URLs are table stakes
3. **@xterm/addon-unicode11** - Emoji/CJK rendering issues are very visible

### Optional Addons (Consider Based on Use Case)
4. **@xterm/addon-serialize** - Only if implementing session restore (experimental risk)
5. **@xterm/addon-image** - Only if SIXEL/IIP support is required (beta quality)

### Core Terminal Config
```typescript
const terminal = new Terminal({
  // Typography
  fontFamily: '"JetBrains Mono", "Menlo", "Monaco", monospace',
  fontSize: 14,
  fontWeight: 'normal',
  letterSpacing: 0,
  lineHeight: 1.0,

  // Cursor
  cursorStyle: 'block',
  cursorBlink: true,

  // Scrollback (tune based on use case)
  scrollback: 5000,
  smoothScrollDuration: 0,  // Disable smooth scroll for performance

  // Window
  windowOptions: {
    setWinLines: true,
    getCellSizePixels: true,
    getWinSizeChars: true,
    pushTitle: true,
    popTitle: true,
  },

  // UX
  rightClickSelectsWord: true,
  allowTransparency: false,  // Keep false unless needed

  // Theme (Dracula example)
  theme: {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    selection: '#44475a',
    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff',
  },
});
```

### Addon Loading Order
```typescript
// 1. Load core addons first
terminal.loadAddon(new Unicode11Addon());
terminal.unicode.activeVersion = '11';

terminal.loadAddon(new WebLinksAddon((event, uri) => {
  event.preventDefault();
  require('electron').shell.openExternal(uri);
}));

// 2. Load search addon
const searchAddon = new SearchAddon({ highlightLimit: 1000 });
terminal.loadAddon(searchAddon);

// 3. Load optional addons last
if (needsPersistence) {
  const serializeAddon = new SerializeAddon();
  terminal.loadAddon(serializeAddon);
}

if (needsImages) {
  terminal.loadAddon(new ImageAddon());
}
```

---

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Terminal search | @xterm/addon-search | Regex, decorations, match tracking, performance optimizations |
| URL detection | @xterm/addon-web-links | OSC 8 support, hover states, custom protocols |
| Unicode width calc | @xterm/addon-unicode11 | wcwidth tables, emoji ZWJ sequences, ambiguous width handling |
| State persistence | @xterm/addon-serialize | Handles cursor, colors, scrollback, alternate buffer edge cases |
| Image rendering | @xterm/addon-image | SIXEL parsing, IIP decoding, palette management, memory limits |

---

## Pitfalls

### SearchAddon
- **Match highlighting on huge buffers**: Default `highlightLimit: 1000` prevents freezing, but may not highlight all matches
- **Regex performance**: Complex regex on 100k scrollback can hang UI. Consider limiting scrollback for search-heavy workflows

### WebLinksAddon
- **Default click behavior in Electron**: Doesn't open system browser. Must use `electron.shell.openExternal()`
- **OSC 8 vs pattern matching**: If both present, OSC 8 wins. May confuse users if display text doesn't match URL

### Unicode11Addon
- **Activation required**: Loading addon doesn't activate it. Must set `terminal.unicode.activeVersion = '11'`
- **Not a silver bullet**: Compound emojis (ZWJ sequences) still break. xterm.js is not grapheme-cluster-aware
- **Version mismatch**: Addon claims "11" but actually uses Unicode 12 rules (known upstream issue)

### SerializeAddon
- **Experimental status**: May have breaking changes in minor versions
- **Restore timing**: Best before `terminal.open()`, not after. Otherwise renders incomplete frames
- **Size mismatch**: Restoring into different terminal size causes layout corruption. Restore to same size first, then resize

### ImageAddon
- **Latency**: Image processing has high latency. Not suitable for interactive graphics (e.g., real-time plotting)
- **Memory**: Default 128 MB storage limit fills quickly with large images. Tune `storageLimit` or implement eviction UI
- **Beta/alpha quality**: SIXEL is beta, IIP is alpha. Expect bugs. Test thoroughly before production use

### General Terminal Options
- **Scrollback unlimited**: Will leak memory (issue #518). Always set a hard limit
- **allowTransparency: true**: Significant performance hit on some GPUs. Only enable if absolutely needed
- **Window manipulation options**: Security risk. Never enable position/raise/lower/fullscreen in production

---

## Open Questions

None — all five addons verified, APIs documented from TypeScript definitions.

---

## Sources

**HIGH confidence:**
- [xterm.js Using Addons Guide](https://xtermjs.org/docs/guides/using-addons/)
- [xterm.js Link Handling Guide](https://xtermjs.org/docs/guides/link-handling/)
- [ITerminalOptions API](https://xtermjs.org/docs/api/terminal/interfaces/iterminaloptions/)
- [@xterm/addon-search TypeScript Definitions](https://github.com/xtermjs/xterm.js/blob/master/addons/addon-search/typings/addon-search.d.ts)
- [@xterm/addon-web-links TypeScript Definitions](https://github.com/xtermjs/xterm.js/blob/master/addons/addon-web-links/typings/addon-web-links.d.ts)
- [@xterm/addon-serialize TypeScript Definitions](https://github.com/xtermjs/xterm.js/blob/master/addons/addon-serialize/typings/addon-serialize.d.ts)
- [@xterm/addon-unicode11 TypeScript Definitions](https://github.com/xtermjs/xterm.js/blob/master/addons/addon-unicode11/typings/addon-unicode11.d.ts)
- [@xterm/addon-search npm](https://www.npmjs.com/package/@xterm/addon-search)
- [@xterm/addon-web-links npm](https://www.npmjs.com/package/@xterm/addon-web-links)
- [@xterm/addon-unicode11 npm](https://www.npmjs.com/package/@xterm/addon-unicode11)
- [@xterm/addon-serialize npm](https://www.npmjs.com/package/@xterm/addon-serialize)

**MEDIUM confidence:**
- [@xterm/addon-image GitHub](https://github.com/xtermjs/xterm.js/tree/master/addons/addon-image) (beta status documented)
- [@xterm/addon-image npm](https://www.npmjs.com/package/@xterm/addon-image/v/0.9.0-beta.38)
- [Unicode handling in xterm.js Issue #1709](https://github.com/xtermjs/xterm.js/issues/1709)
- [Buffer performance improvements Issue #791](https://github.com/xtermjs/xterm.js/issues/791)
- [Setting scrollback to infinite Issue #518](https://github.com/xtermjs/xterm.js/issues/518)
- [xterm.js lies about Unicode 11 Issue #4753](https://github.com/xtermjs/xterm.js/issues/4753)

**LOW confidence (needs validation):**
- None
