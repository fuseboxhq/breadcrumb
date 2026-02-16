# Research: Multi-Project Dashboard UI Patterns

**Task ID:** breadcrumb-rjx
**Date:** 2026-02-16
**Domain:** UI/UX Design - Project Management Dashboards
**Overall Confidence:** HIGH

## TL;DR

Modern project dashboards use a three-tier hierarchy: **overview cards → phase pipeline → active task list**. For narrow IDE panels (~400px), use vertical stacked layouts with collapsible accordions for phases. Multi-project switching works best with a **simple dropdown or tabs at the top** rather than accordions (which nest too deeply). Group tasks by status (ready/in-flight/blocked/done) using color-coded badges and inline progress indicators. Empty states need an icon, specific next action, and a primary CTA—not just "nothing here" text.

## Recommended Stack

| Pattern/Component | Purpose | Confidence |
|-------------------|---------|------------|
| Vertical stepper/pipeline | Phase progress in narrow panels | HIGH |
| Collapsible accordion groups | Task status grouping (ready/blocked/done) | HIGH |
| Dropdown project switcher | Multi-project navigation (top of panel) | HIGH |
| Progress bars (vertical) | Compact phase completion indicators | HIGH |
| Empty state: icon + CTA | Guide users when no data present | HIGH |
| Inline expand pattern | Click phase to reveal tasks in-place | MEDIUM |

**No new dependencies required** — use Lucide icons, Tailwind, existing component patterns.

## Key Patterns

### 1. Multi-Project Overview Layout

**Modern Pattern (Linear, Height, Shortcut):**

```
┌─────────────────────────────┐
│ [Dropdown: Project A ▾]  ⟳ │ ← Project switcher at top
├─────────────────────────────┤
│ Overall Progress            │
│ ▓▓▓▓▓▓░░░░ 60% (3/5 phases)│
├─────────────────────────────┤
│ Phase Pipeline              │
│ ┌─ PHASE-01: Setup     ✓   │
│ ├─ PHASE-02: Core      ●   │ ← Active phase highlighted
│ ├─ PHASE-03: Polish    ○   │
│ └─ PHASE-04: Deploy    ○   │
├─────────────────────────────┤
│ Active Tasks (3)            │
│ Ready (1) ▾                 │ ← Grouped by status
│   □ task-1.1: API setup     │
│ In Progress (2) ▾           │
│   ◐ task-2.1: Auth flow     │
│   ◐ task-2.2: DB layer      │
└─────────────────────────────┘
```

**Linear's Approach:**
- **Dashboard-level filters** apply globally across projects
- **Insight-level filters** let individual views customize data
- Click into charts/metrics to view underlying issues without navigation
- Use tables, charts, or single metrics per insight

**Source:** Linear dashboards support combining multiple projects with two-tier filtering (dashboard filters + insight filters).

### 2. Narrow Panel Design Patterns

**VS Code Sidebar Guidelines (400px width):**

**Do:**
- Group related views together
- Use clear, descriptive names
- Limit views to 3-5 max for comfort on most screens
- Consolidate toolbar when only one view (no `...` menu)
- Left-align content blocks in narrow spaces

**Don't:**
- Use excessive view containers
- Duplicate existing functionality
- Center-align in small tiles/panels (use left-align)

**Cursor 2.0 Pattern:**
- Agent-centric sidebar with dedicated agent layout
- Agents/plans/runs are first-class objects in sidebar
- Intuitive sidebar for toggling between contexts
- Design sidebar with live controls (sliders, color pickers)

**Source:** VS Code UX Guidelines emphasize 3-5 views max, consolidation for single views, and left-aligned content in narrow spaces.

### 3. Phase Pipeline Visualization (Vertical)

**Best Practice for Compact Vertical Layouts:**

```jsx
// Material UI Stepper pattern adapted for phases
<div className="space-y-2">
  {phases.map(phase => (
    <button
      onClick={() => expandPhase(phase.id)}
      className="w-full flex items-center gap-3 p-3 rounded-lg border hover:border-strong"
    >
      {/* Status indicator */}
      <PhaseStatusIcon status={phase.status} />

      {/* Phase info */}
      <div className="flex-1 text-left">
        <div className="text-sm font-medium">{phase.title}</div>
        <div className="text-2xs text-muted">{phase.tasksDone}/{phase.tasksTotal} tasks</div>
      </div>

      {/* Inline progress bar */}
      <div className="w-16 h-1.5 bg-muted rounded-full">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${phase.progress}%` }}
        />
      </div>

      {/* Expand indicator */}
      <ChevronRight className={expanded ? 'rotate-90' : ''} />
    </button>
  ))}
</div>
```

**Key Elements:**
- **Status icon** (left): ✓ done, ● active, ○ planned
- **Inline progress bar** (right): compact horizontal bar
- **Expand chevron**: rotate 90° when open
- **Vertical stack**: phases listed top-to-bottom

**Source:** Material UI Stepper supports vertical orientation for mobile/desktop, compact for limited space.

### 4. Multi-Project Switcher Patterns

**Recommended: Dropdown at Top**

```jsx
<div className="px-4 py-3 border-b">
  <Dropdown>
    <DropdownTrigger>
      <button className="w-full flex items-center justify-between">
        <span>{currentProject.name}</span>
        <ChevronDown />
      </button>
    </DropdownTrigger>
    <DropdownMenu>
      {projects.map(p => (
        <DropdownItem onClick={() => switchProject(p.id)}>
          {p.name}
          <span className="text-2xs text-muted">{p.phaseCount} phases</span>
        </DropdownItem>
      ))}
    </DropdownMenu>
  </Dropdown>
</div>
```

**Alternative: Tabs (for 2-4 projects)**

```jsx
<div className="flex overflow-x-auto border-b">
  {projects.map(p => (
    <button
      className={`px-4 py-2 border-b-2 ${active ? 'border-accent' : 'border-transparent'}`}
    >
      {p.name}
    </button>
  ))}
</div>
```

**Don't Use: Accordion for Projects**
- Nests too deeply (projects → phases → tasks = 3 levels)
- Causes "floating blob" effect in narrow panels
- Better for phase grouping within a project

**Source:** VS Code ProjectSwitcher plugin enables seamless switching with preserved tabs/state. IntelliJ multi-project workspace plugin provides smooth multi-project editing.

### 5. Task Status Grouping

**Kanban-Inspired Status Groups:**

```jsx
// Group tasks by status
const ready = tasks.filter(t => t.status === 'ready');
const inFlight = tasks.filter(t => t.status === 'in_progress');
const blocked = tasks.filter(t => t.status === 'blocked');
const done = tasks.filter(t => t.status === 'done');

// Render grouped with collapsible headers
<div className="space-y-3">
  {ready.length > 0 && (
    <TaskGroup label="Ready" count={ready.length} color="green">
      {ready.map(task => <TaskCard task={task} />)}
    </TaskGroup>
  )}

  {inFlight.length > 0 && (
    <TaskGroup label="In Progress" count={inFlight.length} color="yellow">
      {inFlight.map(task => <TaskCard task={task} />)}
    </TaskGroup>
  )}

  {blocked.length > 0 && (
    <TaskGroup label="Blocked" count={blocked.length} color="red">
      {blocked.map(task => <TaskCard task={task} />)}
    </TaskGroup>
  )}
</div>
```

**Status Badge Colors:**
- **Ready**: Green background, green text
- **In Progress**: Yellow/amber background, amber text
- **Blocked**: Red background, red text
- **Done**: Muted gray, strikethrough

**Blocked Work Visibility:**
Making blocked items visible creates urgency to resolve obstructions. Some tools "freeze" blocked cards visually (reduced opacity, special icon).

**Source:** Kanban boards use status columns (To-do → In Progress → Done). Blocking features help visualize temporarily unworkable tasks.

### 6. Empty State Design

**Three Guidelines (Nielsen Norman Group):**

1. **Communicate System Status**: Explain why empty
   - "No phases found — initialize with /bc:init"
   - "No tasks in this phase yet"

2. **Provide Learning Cues**: Contextual help
   - "Star your favorites to list them here"
   - "Active tasks will appear when you start working"

3. **Offer Direct Pathways**: Actionable CTAs
   - Primary button: "Add Project", "Initialize Planning"
   - Secondary link: "Learn more", "View documentation"

**Structure for Narrow Panels (Carbon Design System):**

```jsx
<div className="flex flex-col items-center text-center py-8 px-6">
  {/* Icon (centered above text for small spaces) */}
  <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center mb-4">
    <LayoutGrid className="w-6 h-6 text-muted" />
  </div>

  {/* Primary message */}
  <p className="text-sm font-medium text-secondary mb-1">
    No projects in workspace
  </p>

  {/* Explanation */}
  <p className="text-2xs text-muted mb-4 max-w-xs">
    Add a project folder to see its phases, tasks, and progress.
  </p>

  {/* Primary CTA */}
  <button className="btn-primary">
    <FolderOpen className="w-4 h-4" />
    Add Project
  </button>
</div>
```

**Key Rules:**
- **Left-align** in small tiles/panels, **center** image above text
- **Minimize repetition** if multiple empty states appear (use text-only)
- **Replace the element** that would show (don't show table headers for empty table)
- **Interactive functionality** over passive messaging

**Source:** Carbon Design System specifies left-aligned blocks with centered images for small panels. NNG guidelines emphasize system status, learning cues, and direct pathways.

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Custom phase pipeline component | Material UI Stepper (vertical) | Already handles state, accessibility, mobile |
| Manual accordion state management | Radix UI Accordion | Focus management, keyboard nav, ARIA attributes |
| Custom progress bars | CSS width transitions + gradients | Simpler, smoother animations |
| Hand-coded dropdown menus | Radix/Headless UI Dropdown | Keyboard nav, positioning, click-outside |
| Custom empty state templates | Design system component | Consistency across app |

## Pitfalls

### Pitfall 1: Nesting Accordions Too Deeply

**What happens:** Projects as accordions → phases as accordions → tasks creates 3-level nesting, hard to scan.

**Example:** User has to expand project, then expand phase, then scroll to see tasks.

**Avoid by:**
- **Project switcher at top** (dropdown or tabs), not accordion
- **Phases as accordion groups** (1 level)
- **Tasks inline** when phase expanded

### Pitfall 2: Showing All Projects Simultaneously

**What happens:** Panel becomes overwhelming with 5+ projects showing phases/tasks.

**Example:** 5 projects × 4 phases each = 20 phase cards in one view.

**Avoid by:**
- **Show one project at a time** (use switcher)
- **Overview shows project cards only** (not full phase breakdowns)
- **Drill down to see phases** (separate view)

### Pitfall 3: Uniform Hover States on All Cards

**What happens:** Everything fades the same way, loses intentionality.

**AI pattern detected:** All cards change opacity or color uniformly.

**Avoid by:**
- **Project cards**: border + lift + shadow
- **Phase items**: background + border color change
- **Task items**: background + left accent border

### Pitfall 4: Progress Bars Too Large

**What happens:** Full-height progress bars waste vertical space in narrow panels.

**Example:** 8px tall progress bar when 1.5px is sufficient.

**Avoid by:**
- **Inline progress bars**: 1-2px height, placed next to count
- **Use color coding**: gradient for in-progress, solid for complete
- **Reserve larger bars** for overview cards only

### Pitfall 5: Generic Empty State Copy

**What happens:** "Nothing here" or "No data" without context or action.

**AI pattern detected:** Centered emoji + "Get started!" with no specifics.

**Avoid by:**
- **Specific reason**: "No projects in workspace" not "Nothing here"
- **Specific action**: "Add Project" not "Get started"
- **Context**: Explain what this panel shows when populated

### Pitfall 6: Status Badge Inconsistency

**What happens:** Same status shown differently across views (task vs phase).

**Example:** "In Progress" badge is yellow in task list, purple in phase card.

**Avoid by:**
- **Define status colors once**: ready=green, in-progress=amber, blocked=red, done=gray
- **Use same badge component** everywhere
- **Document status semantics** in design system

### Pitfall 7: Ignoring Keyboard Navigation

**What happens:** Mouse-only interactions, tab navigation broken.

**Common miss:** Custom dropdowns/accordions without focus management.

**Avoid by:**
- **Use Radix/Headless UI** for interactive components
- **Test with keyboard only** (Tab, Enter, Arrow keys)
- **Visible focus rings** (2px solid, 3:1 contrast minimum)

## Open Questions

1. **Inline expand vs separate view for phase detail?**
   - Current implementation uses separate view (drill down)
   - Inline expand (accordion pattern) might reduce clicks
   - Trade-off: inline saves navigation but limits vertical space

2. **How many projects to show in overview simultaneously?**
   - All projects as cards (current pattern)?
   - Or switch to one-project-at-a-time with dropdown?
   - Depends on expected project count (3-5 vs 10+)

3. **Should "blocked" tasks always show or collapse by default?**
   - Blocked items need visibility for urgency
   - But if many blocked, panel becomes noisy
   - Consider: show count, collapse details

4. **Roadmap integration strategy?**
   - PHASE-23 scope says roadmap is separate concern
   - But users may want to see roadmap from dashboard
   - Clarify: separate tab? Modal? External file?

5. **Real-time updates or manual refresh?**
   - Current: manual refresh button
   - Future: watch .planning/ files for changes?
   - Performance impact on multiple projects?

## Actionable Recommendations

### Immediate Changes (High Impact)

1. **Add project switcher at top** of dashboard (dropdown showing all workspace projects)
   - Shows current project name prominently
   - Click to switch between projects
   - Include phase count per project in dropdown

2. **Convert phase list to vertical stepper/pipeline**
   - Status icon (left): ✓ ● ○
   - Inline progress bar (right): 1.5px height
   - Expand chevron for tasks
   - Color-code by status (active highlighted)

3. **Add active task section at bottom**
   - Group by status: Ready → In Progress → Blocked
   - Collapsible groups (default: Ready open, others collapsed)
   - Show count badges: "Ready (3)", "Blocked (1)"

4. **Enhance empty states**
   - Replace generic "No phases found" with context
   - Add specific CTA: "Initialize Planning" button
   - Include icon (centered above text)

5. **Add overall progress at top**
   - Simple horizontal bar: phases done / total
   - Text below: "3 of 5 phases complete (60%)"
   - Use gradient for in-progress, solid green for complete

### Medium Priority

6. **Implement inline phase expansion**
   - Click phase card → tasks expand below
   - Keeps single-view UX (no navigation)
   - Limit to tasks only (objectives/scope in separate drill-down)

7. **Add status filters for task list**
   - Quick filters: "Show Ready Only", "Show Blocked", "Show All"
   - Persisted per project
   - Reduces visual noise

8. **Improve loading states**
   - Skeleton screens for project cards
   - Staggered animation (cards appear one-by-one)
   - Spinner on refresh button

9. **Add project health indicators**
   - Warning icon if blocked tasks > 2
   - Success icon if all phases complete
   - Clock icon if no recent activity

### Lower Priority (Polish)

10. **Keyboard shortcuts**
    - `j`/`k` to navigate phases
    - `Enter` to expand/collapse
    - `Tab` for standard navigation

11. **Drag-to-reorder phases** (if planning files support it)
    - Visual feedback during drag
    - Persist to STATE.md
    - Out of scope if read-only?

12. **Add mini-charts for trends**
    - Sparkline showing task completion over time
    - Only if Beads DB has history
    - Too complex for MVP?

### Avoid

- Showing all projects expanded simultaneously (too noisy)
- Accordion for project switching (nests too deeply)
- Large progress bars (waste vertical space)
- Emoji as primary icons (feels AI-generated)
- Uniform hover states across all elements
- Empty states without actionable CTAs

## Current Implementation Analysis

**What's Good:**
- Three-level navigation (overview → project → phase) is solid
- Status badges consistent (color-coded)
- Progress bars inline (compact)
- Empty states include context and CTAs
- Left-aligned content in narrow panel
- Collapsible groups for phases (Active/Planned/Completed)

**What to Improve:**
- **No multi-project switcher** — user must back out to overview
- **No "active tasks" section** — tasks only visible in phase drill-down
- **Phase list not pipelined** — could visualize progress better
- **Overall progress missing** — no top-level "3/5 phases done"
- **Empty states could be richer** — icon + illustration

**Alignment with Research:**
- ✓ Vertical layout for narrow panel
- ✓ Collapsible groups
- ✓ Status badges with color coding
- ✓ Inline progress bars
- ✗ Missing multi-project switcher at top
- ✗ Missing active task list
- ✗ Missing overall progress summary

## Sources

**HIGH confidence:**

- [Linear Dashboards Documentation](https://linear.app/docs/dashboards) — multi-project filtering patterns
- [VS Code Sidebar UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/sidebars) — narrow panel design patterns
- [Carbon Design System Empty States](https://carbondesignsystem.com/patterns/empty-states-pattern/) — structure for small panels
- [Nielsen Norman Group: Empty State Design](https://www.nngroup.com/articles/empty-state-interface-design/) — 3 guidelines for complex apps
- [Material UI Stepper Component](https://mui.com/material-ui/react-stepper/) — vertical stepper for pipelines
- [Cursor IDE 2.0 Interface Design](https://techjacksolutions.com/ai/ai-development/cursor-ide-what-it-is/) — agent-centric sidebar patterns

**MEDIUM confidence:**

- [Height App Multi-Project View](https://height.app/blog/whats-new-track-and-organize-projects-from-one-place-and-more-0-136) — projects list with flattened subtasks (Note: Height discontinued Sept 2025)
- [Shortcut Project Management](https://www.shortcut.com/) — multi-team project tracking
- [Kanban Blocked Work Management](https://getnave.com/blog/blocked-work-in-kanban/) — blocking visibility patterns
- [IntelliJ Multi-Project Workspace](https://plugins.jetbrains.com/plugin/24765-multi-project-workspace) — multi-project IDE patterns
- [VS Code ProjectSwitcher Extension](https://github.com/KhanhRomVN/ProjectSwitcher) — seamless project switching

**LOW confidence (needs validation):**

- [Multi-Project Dashboard Best Practices](https://www.wrike.com/blog/multiple-project-dashboard/) — generic PM advice, not IDE-specific
- [SaaS Dashboard Examples](https://www.saasframe.io/categories/dashboard) — broad examples, not research-backed patterns
