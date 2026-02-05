---
name: view
description: Open the Breadcrumb dashboard in your default browser
allowed-tools:
  - Bash
---

# Open Breadcrumb Dashboard

Open the Breadcrumb web dashboard (localhost:9999) in the default browser.

## Steps

### 1. Check Daemon Status

Check if the Breadcrumb daemon is running:

```bash
cd ~/.breadcrumb/server && pnpm daemon:status 2>&1
```

Look for "running" in the output.

### 2. Start Daemon If Needed

If the daemon is not running, start it:

```bash
cd ~/.breadcrumb/server && pnpm daemon:start
```

Wait for the daemon to be ready:

```bash
sleep 2
```

### 3. Detect Platform and Open Browser

Detect the operating system and use the appropriate command to open the browser.

**Check the platform:**
```bash
uname -s
```

**Then open the browser based on platform:**

**macOS (Darwin):**
```bash
open http://localhost:9999
```

**Linux:**
```bash
xdg-open http://localhost:9999
```

**Windows (Git Bash / MINGW / MSYS / Cygwin):**

If `uname -s` returns something containing "MINGW", "MSYS", or "CYGWIN":
```bash
cmd.exe /c start http://localhost:9999
```

### 4. Report Result

On success:
```text
Dashboard opened at http://localhost:9999
```

If the daemon failed to start:
```
Failed to start Breadcrumb daemon.

Try manually:
  cd ~/.breadcrumb/server && pnpm daemon:start

Check logs:
  cd ~/.breadcrumb/server && pnpm daemon:status
```

If the browser command fails:
```
Could not open browser automatically.

Open manually: http://localhost:9999
```
