# Research: OSC Escape Sequence Shell Integration

**Date:** 2026-02-11
**Domain:** Terminal Emulation / Shell Integration
**Overall Confidence:** HIGH

## TL;DR

Use OSC 133 for command boundary detection (prompt start/end, command execution), OSC 7 for working directory tracking, and OSC 8 for clickable hyperlinks. xterm.js provides `parser.registerOscHandler()` for custom parsing. Inject integration via helper scripts that users source (don't modify rc files directly). Follow kitty's ZDOTDIR pattern for zsh, ENV for bash, and XDG_DATA_DIRS for fish.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| xterm.js | 5.x+ | Terminal emulator core | HIGH |
| @xterm/addon-web-links | Latest | OSC 8 hyperlink support (built-in) | HIGH |
| OSC 133 | Standard | Command boundary marking | HIGH |
| OSC 7 | Standard | Working directory reporting | HIGH |
| OSC 8 | Standard | Hyperlinks in terminal | HIGH |

**Note:** xterm.js natively supports OSC sequence parsing. No additional libraries needed for core functionality.

## Key OSC Sequences

### OSC 133 - Command Boundary Detection (Shell Integration)

**Purpose:** Mark prompt boundaries, command execution lifecycle, and capture exit codes.

**Sequences:**

| Sequence | ST | Description | When to Emit |
|----------|----|--------------| -------------|
| `OSC 133 ; A` | ST | Prompt start | Right before prompt is displayed |
| `OSC 133 ; B` | ST | Prompt end | After prompt, before user input |
| `OSC 133 ; C` | ST | Pre-execution / Command start | Right before command runs |
| `OSC 133 ; D ; <exitcode>` | ST | Execution finished | After command completes (exitcode optional) |

**Terminator Values:**
- `ST` (String Terminator) = `ESC \` (0x1b 0x5c) or `BEL` (0x07)
- `OSC` = `ESC ]` (0x1b 0x5d)

**Example (bash/zsh):**
```bash
# Prompt start
printf '\033]133;A\007'

# Prompt end
printf '\033]133;B\007'

# Command start (in preexec)
printf '\033]133;C\007'

# Command end with exit code (in precmd)
printf '\033]133;D;%s\007' "$?"
```

**Confidence:** HIGH - Standardized by FinalTerm, adopted by VS Code, iTerm2, kitty, and Windows Terminal.

### OSC 7 - Working Directory Reporting

**Purpose:** Explicitly tell the terminal emulator the current working directory.

**Format:**
```
OSC 7 ; file://hostname/path ST
```

**Shell Implementation:**

```bash
# Bash/Zsh
__osc7_cwd() {
    printf '\033]7;file://%s%s\033\\' "$HOSTNAME" "$PWD"
}

# Call in PROMPT_COMMAND (bash) or precmd (zsh)
```

```fish
# Fish (built-in since 3.8, manual for older versions)
function __osc7_cwd --on-event fish_prompt
    printf '\033]7;file://%s%s\033\\' (hostname) $PWD
end
```

**URL Encoding Requirements:**
- Must URI-encode special characters in path
- Format: `file://hostname/full/path`
- Both VTE and iTerm2 limit to 2083 bytes

**Benefits:**
- Works from within screen/tmux
- Preserves symlinks (unlike parsing PS1)
- Enables "New Tab in Same Directory" features

**Confidence:** HIGH - Originated in macOS Terminal.app, now supported by VTE, iTerm2, kitty, foot, VS Code.

### OSC 8 - Hyperlinks

**Purpose:** Create clickable links in terminal output.

**Format:**
```
OSC 8 ; params ; URI ST <text> OSC 8 ; ; ST
```

**Example:**
```bash
# Create a hyperlink
printf '\033]8;;https://example.com\033\\Link Text\033]8;;\033\\\n'

# With ID parameter (for split links)
printf '\033]8;id=unique123;https://example.com\033\\Part 1\033]8;;\033\\ '
printf '\033]8;id=unique123;https://example.com\033\\Part 2\033]8;;\033\\\n'
```

**Parameters:**
- `id=value` - Links with same ID and URI are treated as one link (optional)
- Only colon-delimited key=value pairs
- No `:` or `;` allowed in values

**Constraints:**
- URI and params must be ASCII printable (32-126)
- Non-ASCII in URI must be URI-encoded
- VTE: 2083 byte URI limit, 250 byte ID limit
- iTerm2: No ID length restriction

**xterm.js Support:**
- @xterm/addon-web-links handles OSC 8 natively
- Also does pattern-based URL detection
- No custom handler needed

**Confidence:** HIGH - Well-documented standard, wide terminal support.

## xterm.js Integration

### Parser API

**Registering Custom OSC Handlers:**

```typescript
import { Terminal } from '@xterm/xterm';

const term = new Terminal();

// Register handler for OSC 133
const disposable = term.parser.registerOscHandler(133, (data: string) => {
    // Parse OSC 133 data
    // data format: "A", "B", "C", "D;0", etc.

    const parts = data.split(';');
    const type = parts[0]; // A, B, C, or D

    if (type === 'A') {
        // Prompt start - create new command block
        handlePromptStart();
    } else if (type === 'B') {
        // Prompt end
        handlePromptEnd();
    } else if (type === 'C') {
        // Command execution start
        handleCommandStart();
    } else if (type === 'D') {
        // Command finished
        const exitCode = parts[1] ? parseInt(parts[1], 10) : 0;
        handleCommandEnd(exitCode);
    }

    return true; // Handled
});

// Register handler for OSC 7 (working directory)
term.parser.registerOscHandler(7, (data: string) => {
    // data format: "file://hostname/path"
    if (data.startsWith('file://')) {
        const url = new URL(data);
        const cwd = decodeURIComponent(url.pathname);
        updateWorkingDirectory(cwd);
    }
    return true;
});

// Cleanup when needed
disposable.dispose();
```

**Handler Signature:**
```typescript
(data: string) => boolean | Promise<boolean>
```

**Return Values:**
- `true` - Sequence was handled
- `false` - Parser should try previous handler (handlers are tried in reverse registration order)

**Key Notes:**
- Handlers should be synchronous when possible (faster)
- Async handlers supported via `Promise<boolean>`
- 10MB payload limit for OSC/DCS sequences
- Most recently added handler tried first

**Confidence:** HIGH - Official xterm.js API, well-documented.

### OSC 8 (Hyperlinks) - No Custom Handler Needed

**Just install the addon:**
```bash
npm i @xterm/addon-web-links
```

```typescript
import { WebLinksAddon } from '@xterm/addon-web-links';

term.loadAddon(new WebLinksAddon());
```

The addon handles both:
1. OSC 8 explicit hyperlinks
2. Pattern-based URL detection

**Confidence:** HIGH - Official addon, handles OSC 8 automatically.

## Shell Configuration Patterns

### Bash Integration Script

**Structure:**
```bash
# Check if integration already loaded
if [[ -n "${__TERMINAL_INTEGRATION_LOADED:-}" ]]; then
    return
fi
__TERMINAL_INTEGRATION_LOADED=1

# Detect bash-preexec if already installed
if [[ -n "${bash_preexec_imported:-}" ]]; then
    __has_bash_preexec=1
else
    __has_bash_preexec=0
    # Inline bash-preexec or load it
fi

# Command start (preexec)
__terminal_preexec() {
    printf '\033]133;C\007'
}

# Prompt setup and command end (precmd)
__terminal_precmd() {
    local exit_code=$?
    printf '\033]133;D;%s\007' "$exit_code"
    printf '\033]7;file://%s%s\033\\' "$HOSTNAME" "$PWD"
    printf '\033]133;A\007'
}

# Modify PS1 to include prompt end marker
__terminal_ps1() {
    printf '\033]133;B\007'
}

# Hook into PROMPT_COMMAND
if [[ -z "${PROMPT_COMMAND:-}" ]]; then
    PROMPT_COMMAND="__terminal_precmd"
else
    PROMPT_COMMAND="__terminal_precmd;$PROMPT_COMMAND"
fi

# Append to PS1
PS1='\[$(__terminal_ps1)\]'"$PS1"

# Register preexec
preexec_functions+=(__terminal_preexec)
```

**Confidence:** HIGH - Based on iTerm2, VS Code, kitty patterns.

### Zsh Integration Script

**Structure:**
```bash
# Check if integration already loaded
if [[ -n "${__TERMINAL_INTEGRATION_LOADED:-}" ]]; then
    return
fi
__TERMINAL_INTEGRATION_LOADED=1

# Command start (preexec hook)
__terminal_preexec() {
    printf '\033]133;C\007'
}

# Prompt setup and command end (precmd hook)
__terminal_precmd() {
    local exit_code=$?
    printf '\033]133;D;%s\007' "$exit_code"
    printf '\033]7;file://%s%s\033\\' "$HOST" "$PWD"
}

# Add to hook arrays (append, don't replace)
if [[ ${precmd_functions[(ie)__terminal_precmd]} -gt ${#precmd_functions} ]]; then
    precmd_functions+=(__terminal_precmd)
fi

if [[ ${preexec_functions[(ie)__terminal_preexec]} -gt ${#preexec_functions} ]]; then
    preexec_functions+=(__terminal_preexec)
fi

# Modify PS1 to include markers
PS1=$'%{\033]133;A\007%}'$PS1$'%{\033]133;B\007%}'
```

**Confidence:** HIGH - Standard zsh hook pattern, verified in multiple implementations.

### Fish Integration

**Fish 3.8+:** Built-in OSC 133 support, no configuration needed.

**Fish < 3.8:**
```fish
# Check if integration already loaded
if set -q __TERMINAL_INTEGRATION_LOADED
    exit
end
set -g __TERMINAL_INTEGRATION_LOADED 1

# Prompt start marker
function __terminal_mark_prompt --on-event fish_prompt
    printf '\033]133;A\007'
end

# Command start marker
function __terminal_mark_command --on-event fish_preexec
    printf '\033]133;C\007'
end

# Working directory tracking
function __terminal_osc7 --on-event fish_prompt
    printf '\033]7;file://%s%s\033\\' (hostname) $PWD
end
```

**Confidence:** HIGH - Fish has native events, straightforward implementation.

## Implementation Approaches

### Approach 1: User-Sourced Helper Script (Recommended)

**Pros:**
- Non-invasive
- User controls when it loads
- Easy to debug/disable
- Compatible with existing setups

**Cons:**
- Requires user action
- May not load in all shells

**Implementation:**

1. **Provide a script:** `.terminal-integration.bash`, `.terminal-integration.zsh`, `.terminal-integration.fish`

2. **User sources in rc file:**
```bash
# In ~/.bashrc or ~/.zshrc
[[ -f ~/.terminal-integration.bash ]] && source ~/.terminal-integration.bash
```

3. **Detection check in script:**
```bash
# Don't load twice
if [[ -n "${__TERMINAL_INTEGRATION_LOADED:-}" ]]; then
    return
fi
```

**Confidence:** HIGH - This is the standard approach (VS Code, iTerm2 manual mode).

### Approach 2: ENV Variable Injection (Kitty-style)

**Bash:**
```bash
# Launch bash with ENV set
ENV=/path/to/integration.sh bash

# Integration script runs in POSIX mode, then:
set +o posix  # Disable POSIX mode
# Continue with normal bash startup
```

**Zsh:**
```bash
# Temporarily override ZDOTDIR
ZDOTDIR=/path/to/integration/dir zsh

# In integration/.zshenv:
# 1. Restore original ZDOTDIR
# 2. Source original .zshenv
# 3. Load integration code
```

**Fish:**
```bash
# Prepend to XDG_DATA_DIRS
XDG_DATA_DIRS=/path/to/integration:$XDG_DATA_DIRS fish

# Fish autoloads from XDG_DATA_DIRS
```

**Pros:**
- Automatic injection
- No rc file modification
- User can disable via config

**Cons:**
- Complex environment manipulation
- Must handle ZDOTDIR/ENV conflicts
- Harder to debug

**Confidence:** MEDIUM - Advanced technique, used by kitty but complex.

### Approach 3: Auto-Modify RC Files (Not Recommended)

**How iTerm2's installer does it:**
```bash
curl -L https://iterm2.com/shell_integration/bash \
  -o ~/.iterm2_shell_integration.bash

# Append to .bashrc:
echo "source ~/.iterm2_shell_integration.bash" >> ~/.bashrc
```

**Pros:**
- Automatic once installed

**Cons:**
- Modifies user files
- Can break with custom configs
- Uninstall requires manual cleanup
- User loses control

**Confidence:** LOW - Works but invasive, avoid unless explicitly requested.

## Detecting Existing Integration

### Check for Common Integration Markers

```bash
# Bash: Check PROMPT_COMMAND
if [[ "$PROMPT_COMMAND" =~ "__iterm2_prompt_command" ]]; then
    echo "iTerm2 integration detected"
fi

if [[ "$PROMPT_COMMAND" =~ "__vsc_prompt_cmd" ]]; then
    echo "VS Code integration detected"
fi

# Check for bash-preexec
if [[ -n "${bash_preexec_imported:-}" ]]; then
    echo "bash-preexec detected"
fi
```

```bash
# Zsh: Check precmd_functions array
if (( ${precmd_functions[(I)*iterm2*]} )); then
    echo "iTerm2 integration detected"
fi

# Check for OSC 133 in PS1
if [[ "$PS1" =~ "133" ]]; then
    echo "OSC 133 integration detected"
fi
```

**Strategy:**
1. Check environment variables (`TERM_PROGRAM`, `ITERM_SESSION_ID`, etc.)
2. Check hook functions (`precmd_functions`, `preexec_functions`, `PROMPT_COMMAND`)
3. Parse PS1 for OSC markers
4. Use a guard variable (`__TERMINAL_INTEGRATION_LOADED`)

**Confidence:** HIGH - Standard detection patterns.

## VS Code Shell Integration

### OSC 633 - VS Code Native Protocol

VS Code uses **OSC 633** in addition to supporting OSC 133 for compatibility.

**Sequences:**

| Sequence | Description |
|----------|-------------|
| `OSC 633 ; A` ST | Prompt start |
| `OSC 633 ; B` ST | Prompt end |
| `OSC 633 ; C` ST | Pre-execution |
| `OSC 633 ; D ; <exitcode>` ST | Execution finished |
| `OSC 633 ; E ; <commandline> ; <nonce>` ST | Explicit command line (prevents spoofing) |
| `OSC 633 ; P ; <Property>=<Value>` ST | Set property (Cwd, IsWindows) |

**Why OSC 633 vs OSC 133?**
- OSC 633 adds explicit command reporting (E sequence)
- Includes nonce for security
- Property system for metadata (Cwd, IsWindows)
- OSC 133 is supported for compatibility with other terminals

**Installation:**
```bash
# Bash/Zsh
[[ "$TERM_PROGRAM" == "vscode" ]] && . "$(code --locate-shell-integration-path bash)"

# Fish
string match -q "$TERM_PROGRAM" "vscode"
and . (code --locate-shell-integration-path fish)
```

**Auto-Injection:**
- VS Code auto-injects by default via `terminal.integrated.shellIntegration.enabled`
- For better performance, inline the script path from `code --locate-shell-integration-path`

**Confidence:** HIGH - Official VS Code implementation, well-documented.

## iTerm2 Shell Integration

### Sequences Used

**OSC 133:** Command boundaries (A, B, C, D)
**OSC 7:** Working directory (`file://hostname/path`)
**OSC 1337:** iTerm2-specific extensions

**OSC 1337 Extensions:**

| Sequence | Purpose |
|----------|---------|
| `SetMark` | Add visual mark in scrollbar |
| `SetUserVar=key=base64value` | Set custom variables |
| `CurrentDir=/path` | Alternative to OSC 7 |
| `RemoteHost=user@host` | Report session info |
| `ShellIntegrationVersion=N;shell=bash` | Declare version |

**Installation:**
```bash
# Automatic (preferred)
iTerm2 > Install Shell Integration (menu)

# Manual
curl -L https://iterm2.com/shell_integration/bash \
  -o ~/.iterm2_shell_integration.bash
source ~/.iterm2_shell_integration.bash  # Add to .bashrc
```

**Features Enabled:**
- Command navigation (Cmd+Shift+Up/Down)
- Visual marks (blue triangles)
- Exit code badges (red marks on failure)
- Command history per host
- Recent directories tracking
- File upload/download via right-click

**Confidence:** HIGH - iTerm2 pioneered many of these sequences.

## Warp Terminal

### Sequence Evolution

**Original:** Used custom DCS (Device Control Strings)
**Windows/ConPTY:** Switched to custom OSC codes

**Why the change?**
- ConPTY swallowed unrecognized DCS messages
- ConPTY forwards unrecognized OSC messages
- Had to fork ConPTY to fix ordering issues (OSCs arrived scrambled)

**Implementation:**
- Custom OSC codes for Blocks feature (command grouping)
- OSC flushing forced immediately to maintain order
- Custom "Reset" OSC to clear ConPTY grid state

**Key Features:**
- Blocks (visual command+output grouping)
- Command search/navigation
- AI integration
- Workflow automation

**Confidence:** MEDIUM - Limited public documentation on exact OSC codes used.

## Command Blocks - Visual Grouping

### What Are Command Blocks?

Visual grouping of:
1. Prompt
2. Command input
3. Command output
4. Exit code badge

### Implementation Strategy

**Use OSC 133 to track boundaries:**

```typescript
interface CommandBlock {
    id: string;
    promptStart: number;    // Line where OSC 133;A received
    promptEnd: number;      // Line where OSC 133;B received
    commandStart: number;   // Line where OSC 133;C received
    commandEnd: number;     // Line where OSC 133;D received
    exitCode: number;       // From OSC 133;D;exitcode
    command: string;        // Text between B and C
    output: string[];       // Lines between C and D
}

// Track blocks in array
const blocks: CommandBlock[] = [];

// OSC 133 handlers populate blocks
term.parser.registerOscHandler(133, (data) => {
    const [type, ...args] = data.split(';');

    switch(type) {
        case 'A':
            // Create new block
            currentBlock = {
                id: generateId(),
                promptStart: term.buffer.active.cursorY,
                // ...
            };
            break;
        case 'D':
            // Finalize block
            currentBlock.exitCode = parseInt(args[0] || '0');
            currentBlock.commandEnd = term.buffer.active.cursorY;
            blocks.push(currentBlock);
            renderBlockUI(currentBlock);
            break;
    }
    return true;
});
```

**Visual Features:**
- Color-code by exit status (green=success, red=failure)
- Add collapse/expand controls
- Display timestamp per block
- Add copy/share buttons
- Enable block-level search

**Confidence:** HIGH - Pattern used by Warp, iTerm2, VS Code.

## Exit Code Badges

**Implementation:**

```typescript
function renderBlockUI(block: CommandBlock) {
    const badge = document.createElement('div');
    badge.className = block.exitCode === 0 ? 'badge-success' : 'badge-error';
    badge.textContent = `Exit: ${block.exitCode}`;

    // Position badge at block's command end line
    // (Implementation depends on terminal renderer)
}
```

**Alternative:** Use terminal decorations if xterm.js supports them.

**Confidence:** HIGH - Standard pattern.

## Timestamps Per Command

**Capture timing:**

```typescript
interface CommandBlock {
    // ... existing fields
    startTime: Date;
    endTime?: Date;
    duration?: number;
}

// In OSC 133;C handler:
currentBlock.startTime = new Date();

// In OSC 133;D handler:
currentBlock.endTime = new Date();
currentBlock.duration = currentBlock.endTime - currentBlock.startTime;
```

**Display:**
```typescript
const timestamp = new Date(block.endTime).toLocaleTimeString();
const duration = `${(block.duration / 1000).toFixed(2)}s`;
```

**Confidence:** HIGH - Simple timing, standard pattern.

## Pitfalls

### OSC Sequence Terminator Confusion

**Problem:** `ST` can be `ESC \` or `BEL`. Shells often use `BEL` (simpler), but specs prefer `ESC \`.

**Solution:** Support both in parser. xterm.js does this automatically.

**Confidence:** HIGH

### Double Integration

**Problem:** User has iTerm2 integration + VS Code integration = duplicate sequences.

**Solution:**
- Check guard variables before loading
- Detect conflicting PROMPT_COMMAND/precmd functions
- Use `TERM_PROGRAM` environment variable to load only matching integration

**Confidence:** HIGH

### PROMPT_COMMAND Ordering

**Problem:** Integration must run last in `PROMPT_COMMAND` to capture correct exit code.

**Avoid:**
```bash
PROMPT_COMMAND="custom_func;__terminal_precmd"
```

**Correct:**
```bash
PROMPT_COMMAND="__terminal_precmd;custom_func"
```

**Or:** Save exit code immediately:
```bash
__terminal_precmd() {
    local exit_code=$?  # Must be first line
    # ... rest of function
}
```

**Confidence:** HIGH - Common trap in bash integration.

### Zsh precmd Hooks Not at End

**Problem:** If another script appends to `precmd_functions` after integration, it might emit output that breaks block boundaries.

**Solution:**
```bash
# Check if hook is last, if not, move it
if [[ ${precmd_functions[-1]} != "__terminal_precmd" ]]; then
    precmd_functions=("${(@)precmd_functions:#__terminal_precmd}")
    precmd_functions+=(__terminal_precmd)
fi
```

**Confidence:** MEDIUM - Advanced zsh array manipulation.

### Fish Version Compatibility

**Problem:** Fish < 3.8 needs manual integration. Fish >= 3.8 has it built-in.

**Solution:**
```fish
# Check version before manual integration
if test (fish --version | string match -r '[0-9]+\.[0-9]+' | string split '.')[1] -lt 3
    # Load manual integration
else if test (fish --version | string match -r '3\.([0-9]+)' | string split '.')[2] -lt 8
    # Load manual integration
end
```

**Confidence:** HIGH

### ConPTY on Windows

**Problem:** Windows ConPTY can reorder OSC sequences or swallow DCS.

**Solution:**
- Use OSC (not DCS) on Windows
- May need custom flushing logic (Warp forked ConPTY for this)
- Test thoroughly on Windows Terminal

**Confidence:** MEDIUM - Windows-specific edge case, complex.

### ZDOTDIR Conflicts

**Problem:** If user sets `ZDOTDIR` in system files (`/etc/zshenv`), injection via ZDOTDIR fails.

**Solution:**
- Prefer user-sourced scripts over ZDOTDIR injection
- Document that system-level ZDOTDIR breaks auto-injection
- Fallback to manual sourcing

**Confidence:** HIGH

### URI Encoding in OSC 7

**Problem:** Paths with spaces or special chars break OSC 7.

**Solution:**
```bash
__osc7_cwd() {
    local encoded_pwd
    # URI encode PWD (basic version)
    encoded_pwd=$(printf '%s' "$PWD" | sed 's/ /%20/g')
    printf '\033]7;file://%s%s\033\\' "$HOSTNAME" "$encoded_pwd"
}
```

**Better:** Use `jq` or `python` for proper URI encoding.

**Confidence:** HIGH

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Bash preexec hook | bash-preexec library | Handles DEBUG trap edge cases, widely tested |
| URI encoding | Python `urllib.parse.quote` | RFC 3986 compliant, handles all edge cases |
| OSC parser | xterm.js `registerOscHandler` | Handles malformed sequences, 10MB limit protection |
| OSC 8 hyperlinks | @xterm/addon-web-links | Pattern detection + OSC 8 support built-in |

**Confidence:** HIGH

## Open Questions

1. **Warp's exact OSC sequence numbers** - They use custom OSC codes but documentation is limited. Would need to inspect Warp's source or network traffic.

2. **VS Code injection mechanism details** - Documentation mentions "injecting arguments and/or environment variables" but exact implementation is vague. May need to read VS Code source.

3. **xterm.js decorations API** - Is there a built-in way to add visual badges/markers to specific lines? Research needed for block UI implementation.

4. **Performance impact** - How many OSC sequences can xterm.js handle before performance degrades? Need benchmarking data.

## Sources

**HIGH confidence:**
- [VS Code Terminal Shell Integration](https://code.visualstudio.com/docs/terminal/shell-integration) - Official VS Code docs
- [iTerm2 Proprietary Escape Codes](https://iterm2.com/documentation-escape-codes.html) - Official iTerm2 docs
- [iTerm2 Shell Integration Guide](https://iterm2.com/shell_integration.html) - Official iTerm2 docs
- [xterm.js Parser Hooks & Terminal Sequences](https://xtermjs.org/docs/guides/hooks/) - Official xterm.js docs
- [xterm.js IParser API](https://xtermjs.org/docs/api/terminal/interfaces/iparser/) - Official API docs
- [Hyperlinks in Terminal Emulators (OSC 8)](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda) - Canonical OSC 8 spec
- [Kitty Shell Integration](https://sw.kovidgoyal.net/kitty/shell-integration/) - Official kitty docs
- [iTerm2 Bash Integration Script](https://github.com/gnachman/iTerm2/blob/master/Resources/shell_integration/iterm2_shell_integration.bash) - Reference implementation
- [Microsoft Terminal Shell Integration Tutorial](https://learn.microsoft.com/en-us/windows/terminal/tutorials/shell-integration) - Windows Terminal docs

**MEDIUM confidence:**
- [Warp Building on Windows Blog Post](https://www.warp.dev/blog/building-warp-on-windows) - ConPTY OSC implementation details
- [VS Code OSC 633 Finalization Issue](https://github.com/microsoft/vscode/issues/155639) - Discussion of VS Code sequences
- [Fish Shell OSC 133 PR](https://github.com/fish-shell/fish-shell/pull/10352) - Fish implementation details
- [bash-preexec Library](https://github.com/rcaloras/bash-preexec) - Preexec hook implementation
- [OSC 133 Zsh Implementation (Japanese)](https://zenn.dev/ymotongpoo/articles/20220802-osc-133-zsh) - Community implementation

**LOW confidence (needs validation):**
- Warp's exact custom OSC codes - Not publicly documented
- VS Code auto-injection internals - Implementation details sparse
- Performance benchmarks for OSC handling - No data found

## Implementation Checklist

Before building shell integration:

- [ ] Decide on injection approach (user-sourced script recommended)
- [ ] Create helper scripts for bash, zsh, fish
- [ ] Implement OSC 133 handlers in xterm.js
- [ ] Implement OSC 7 handler for working directory
- [ ] Install @xterm/addon-web-links for OSC 8
- [ ] Design command block UI (boundaries, exit codes, timestamps)
- [ ] Add detection for existing integration (guard variables)
- [ ] Test PROMPT_COMMAND ordering (bash)
- [ ] Test precmd_functions ordering (zsh)
- [ ] Test Fish version compatibility
- [ ] Test with iTerm2, VS Code, kitty for conflicts
- [ ] Document installation for users
- [ ] Add opt-out mechanism
- [ ] Test URI encoding for OSC 7
- [ ] Test Windows/ConPTY if targeting Windows
