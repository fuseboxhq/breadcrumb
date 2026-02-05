---
name: integrate
description: Explore existing codebase and create context for planning
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - Write
  - Task
  - AskUserQuestion
  - Skill
---

# Integrate Existing Codebase

Explore an existing codebase and create `.planning/CODEBASE.md` to provide context for all future planning.

## Philosophy

**Understand before building.** For existing projects, we need to know what's already there before we can plan effectively.

## Steps

### 1. Verify Initialization

Check that `.planning/` directory exists.

If not found:
```
Breadcrumb not initialized.
Run /bc:init first.
```

### 2. Check for Existing CODEBASE.md

If `.planning/CODEBASE.md` exists, use AskUserQuestion:

```
question: "CODEBASE.md already exists. What would you like to do?"
options:
  - label: "Refresh (Recommended)"
    description: "Re-explore and update the codebase analysis"
  - label: "Keep existing"
    description: "Cancel and keep the current CODEBASE.md"
```

### 3. Clarify Focus

Use AskUserQuestion to understand what to focus on:

**Purpose:**
```
question: "What is the main purpose of this project?"
options:
  - label: "Web application"
    description: "Frontend, backend, or full-stack web app"
  - label: "CLI tool"
    description: "Command-line application"
  - label: "Library/Package"
    description: "Reusable code meant to be imported"
  - label: "API service"
    description: "Backend API or microservice"
```

**Focus areas:**
```
question: "Any specific areas to focus on?"
multiSelect: true
options:
  - label: "Everything"
    description: "Full codebase analysis"
  - label: "Just the structure"
    description: "Directory layout and key files only"
  - label: "Specific directory"
    description: "I'll specify which part to analyze"
```

**Exclusions:**
```
question: "Anything to ignore during analysis?"
multiSelect: true
options:
  - label: "Standard ignores"
    description: "node_modules, vendor, dist, build, .git"
  - label: "Generated files"
    description: "Auto-generated code, compiled output"
  - label: "Specific paths"
    description: "I'll specify what to skip"
  - label: "Nothing special"
    description: "Analyze everything"
```

### 4. Explore Codebase

**Directory structure:**
```bash
# Get high-level structure (respecting .gitignore)
find . -type d -maxdepth 3 | grep -v -E '(node_modules|vendor|\.git|dist|build|__pycache__|\.next)' | head -50
```

**Package/dependency files:**
Look for (in order of priority):
- `package.json` - Node.js
- `requirements.txt`, `pyproject.toml`, `setup.py` - Python
- `go.mod` - Go
- `Cargo.toml` - Rust
- `pom.xml`, `build.gradle` - Java
- `Gemfile` - Ruby
- `composer.json` - PHP

**Entry points:**
- `main.*`, `index.*`, `app.*`
- `src/main.*`, `src/index.*`
- `cmd/*/main.go` (Go pattern)
- `bin/*`

**Config files:**
- `.env.example`, `config/*`
- `tsconfig.json`, `webpack.config.js`, `vite.config.*`
- `Dockerfile`, `docker-compose.yml`
- CI/CD files (`.github/workflows/`, `.gitlab-ci.yml`)

**Test structure:**
- `test/`, `tests/`, `__tests__/`, `spec/`
- `*_test.go`, `*.test.js`, `*.spec.ts`

**For larger codebases:** If initial exploration reveals >50 files in src/ or complex structure, spawn Task with Explore agent:
```
Use Task tool with subagent_type=Explore to perform deep codebase analysis.
Focus on: patterns, architecture, key abstractions
```

### 5. Identify Patterns

From the exploration, note:
- **Framework/library usage** - React, Express, Django, etc.
- **Code organization** - MVC, layered, modular, monorepo
- **Naming conventions** - camelCase, snake_case, file naming
- **Existing abstractions** - base classes, shared utilities, common patterns

### 6. Write CODEBASE.md

Create `.planning/CODEBASE.md`:

```markdown
# Codebase Overview

**Generated:** [date]
**Last Updated:** [date]

## Project Summary

[1-2 sentences: what this project does based on exploration]

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| [name] | [ver] | [what it's used for] |

## Directory Structure

```
project/
├── src/           # [description]
├── tests/         # [description]
└── ...
```

## Key Files

| File | Purpose |
|------|---------|
| [path] | [what it does] |

## Existing Patterns

### [Pattern Name]
[Brief description of how this pattern is used in this codebase]

## Areas of Interest

Potential areas for future phases:
- [Area 1]: [brief description]
- [Area 2]: [brief description]

## Notes

[Any important context, gotchas, or observations]
```

### 7. Update STATE.md

Add to `.planning/STATE.md`:
```markdown
## Codebase Context

Mapped on [date]. See CODEBASE.md for details.
```

### 8. Report Summary

```markdown
## CODEBASE MAPPED

**Project:** [inferred project type]
**Tech Stack:** [main technologies]

### Structure
- [dir]/    - [description]
- [dir]/    - [description]

### Patterns Found
- [pattern 1]
- [pattern 2]

### Suggested First Phases
1. "[Phase idea]" - [brief description]
2. "[Phase idea]" - [brief description]

Full details: .planning/CODEBASE.md

### Next Steps
1. Create a phase: /bc:new-phase "[suggested phase]"
2. Plan it: /bc:plan PHASE-01
```
