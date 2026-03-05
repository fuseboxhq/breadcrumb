# Phase 34: Terminal Cursor & Scroll Position Fixes

**Status:** not_started
**Beads Epic:** breadcrumb-1yi
**Created:** 2026-03-05

## Objective

Root-cause fix two persistent xterm.js UX bugs in Claude Code sessions: (1) cursor intermittently appearing below the prompt line instead of inline with it, and (2) terminal viewport randomly scrolling back to the top of the buffer, especially after idle periods. Both issues were partially addressed in PHASE-29 and PHASE-33 but persist. This phase takes a full deep-dive research approach — understanding xterm.js internals before writing fix code.

## Scope

**In scope:**
- Deep research into xterm.js scroll position management internals (viewport, buffer, baseY, ydisp)
- Deep research into xterm.js cursor positioning and how PTY cursor state maps to viewport position
- Root-cause analysis of cursor-below-prompter (intermittent, seems random)
- Root-cause analysis of scroll-to-top (intermittent, correlates with idle periods)
- Fixes for both bugs backed by research findings
- Fixes for closely related terminal UX bugs discovered during research

**Out of scope:**
- New terminal features or UI changes
- Performance optimizations (covered in PHASE-33)
- Terminal windowing/split changes (covered in PHASE-29)
- General terminal refactoring beyond what's needed for fixes

## Constraints

- Must preserve all existing terminal functionality (WebGL rendering, flow control, shell integration, zoom, split panes)
- Fixes must be based on verified understanding of xterm.js internals, not trial-and-error
- No changes to xterm.js library itself — work within its API
- Research findings should be documented for future reference

## Research Summary

Run `/bc:research` on each task to populate this section.

## Recommended Approach

**Research-first methodology:**
1. Research xterm.js scroll/viewport internals (buffer model, ybase, ydisp, viewport scroll sync)
2. Research xterm.js cursor positioning pipeline (how PTY sequences map to cursor row/col in buffer)
3. Audit our TerminalInstance.tsx for any code that manipulates scroll position or cursor
4. Identify specific code paths that could cause scroll-to-top (timers, observers, resize handlers, focus handlers)
5. Identify specific code paths that could cause cursor offset (write callbacks, fit addon, shell integration hooks)
6. Implement targeted fixes backed by research
7. Add defensive guards against future regressions

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| breadcrumb-1yi.1 | Research: xterm.js scroll & viewport internals | pending | High |
| breadcrumb-1yi.2 | Research: xterm.js cursor positioning pipeline | pending | High |
| breadcrumb-1yi.3 | Fix scroll-to-top regression | pending | Medium |
| breadcrumb-1yi.4 | Fix cursor-below-prompter regression | pending | Medium |
| breadcrumb-1yi.5 | Fix related terminal UX bugs found during research | pending | Medium |

### Task Details

#### breadcrumb-1yi.1: Research: xterm.js scroll & viewport internals

**What:** Deep-dive into how xterm.js manages scroll position — understand the buffer model (ybase, ydisp, lines), viewport synchronization, and what operations can reset or corrupt scroll position. Study VS Code's terminal scroll management for comparison.

**Research questions:**
- How does xterm.js track viewport scroll position (ydisp) vs buffer position (ybase)?
- What events/operations can reset ydisp to 0 (scroll to top)?
- How does `terminal.write()` interact with scroll position? Does it always scroll to bottom?
- What happens to scroll position during idle (no PTY activity)?
- Do ResizeObserver, FitAddon.fit(), or focus events affect scroll position?
- How does VS Code prevent scroll position corruption?

**Done when:** Clear documented understanding of the scroll pipeline with specific hypotheses for what's causing the scroll-to-top bug.

---

#### breadcrumb-1yi.2: Research: xterm.js cursor positioning pipeline

**What:** Deep-dive into how xterm.js positions the cursor — understand the cursor state model (buffer.cursorX, buffer.cursorY), how PTY escape sequences move the cursor, and how the cursor renderer maps buffer position to screen position.

**Research questions:**
- How does xterm.js calculate cursor screen position from buffer state?
- What can cause the cursor's visual position to desync from the buffer's cursor state?
- Does FitAddon.fit() or terminal resize affect cursor position?
- How does the WebGL renderer cursor differ from canvas cursor positioning?
- Can flow control (pause/resume) cause cursor position desync?
- Does shell integration or OSC sequences affect cursor rendering?

**Done when:** Clear documented understanding of the cursor pipeline with specific hypotheses for what's causing the cursor-below-prompter bug.

---

#### breadcrumb-1yi.3: Fix scroll-to-top regression

**What:** Based on research findings from task .1, implement a root-cause fix for the terminal viewport randomly jumping to the top of the buffer. This likely involves one or more of: removing/guarding scroll-affecting code paths, fixing viewport sync after idle, or correcting buffer state management.

**Dependencies:** breadcrumb-1yi.1

**Done when:** Terminal maintains scroll position during idle periods and focus switches. No more random scroll-to-top jumps during Claude Code sessions.

---

#### breadcrumb-1yi.4: Fix cursor-below-prompter regression

**What:** Based on research findings from task .2, implement a root-cause fix for the cursor intermittently appearing below the active prompt line. This likely involves one or more of: fixing cursor position calculation after fit/resize, correcting buffer state after write operations, or guarding against cursor desync from shell integration.

**Dependencies:** breadcrumb-1yi.2

**Done when:** Cursor consistently appears inline with the Claude Code prompt. No more intermittent offset below the prompt line.

---

#### breadcrumb-1yi.5: Fix related terminal UX bugs found during research

**What:** Fix any closely related terminal UX bugs discovered during the research and audit phase. This could include scroll position loss on resize, cursor flicker during output, viewport desync after pane focus switch, etc.

**Dependencies:** breadcrumb-1yi.1, breadcrumb-1yi.2

**Done when:** All related bugs found during research are fixed. If no related bugs are found, this task can be closed as N/A.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Approach | Research-first, then fix | Intermittent bugs need deep understanding before fix attempts |
| Research depth | xterm.js source code level | API docs insufficient — need to understand internal state machines |
| Fix strategy | Root-cause fixes, not workarounds | Previous mitigations in PHASE-29/33 didn't resolve the issues |

## Completion Criteria

- [ ] xterm.js scroll/viewport internals documented with root-cause hypothesis
- [ ] xterm.js cursor positioning pipeline documented with root-cause hypothesis
- [ ] Terminal maintains scroll position during idle Claude Code sessions (no random scroll-to-top)
- [ ] Cursor consistently appears inline with Claude Code prompt (no below-prompter offset)
- [ ] Fixes verified with extended Claude Code sessions (10+ minutes of mixed activity/idle)
- [ ] No regressions in existing terminal functionality (WebGL, flow control, shell integration, zoom)
- [ ] TypeScript compiles with no errors (`npx tsc --noEmit`)
