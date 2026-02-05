---
name: todo
description: Add an item to the todo list for later consideration
argument-hint: <description>
allowed-tools:
  - Read
  - Write
  - Edit
  - Skill
---

# Add Todo: $ARGUMENTS

Quickly capture an idea or task for later consideration.

## Steps

### 1. Ensure Planning Directory Exists

Check if `.planning/` exists. If not:
```
Breadcrumb not initialized.
Run /bc:init first, or I can create just the TODO.md file.
```

If `.planning/` doesn't exist but user wants to continue, create `.planning/TODO.md` directly.

### 2. Create or Update TODO.md

If `.planning/TODO.md` doesn't exist, create it:

```markdown
# Todo List

Quick capture of ideas and tasks for later consideration.
These are not yet part of any phase—review periodically and promote to phases as needed.

---

## Pending

- [ ] $ARGUMENTS
  *Added: [date]*

## Done

(none yet)
```

If it exists, add the new item to the **Pending** section:

```markdown
- [ ] $ARGUMENTS
  *Added: [date]*
```

Add new items at the top of the Pending section (most recent first).

### 3. Confirm

```
Added to TODO.md:
  - [ ] $ARGUMENTS

View all: /bc:todos
```
