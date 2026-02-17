# Research: Image Paste and Drag-and-Drop in Electron + React

**Date:** 2026-02-17
**Domain:** Electron IPC, Browser Clipboard API, React event handling, Claude Code image ingestion
**Overall Confidence:** HIGH

---

## TL;DR

Use the **browser Clipboard API** (not Electron's clipboard) directly in the React renderer via the `paste` DOM event — no IPC needed for reading clipboard images. For drag-and-drop, use standard HTML5 drag events with `event.dataTransfer.files`. To pass images to Claude Code, write the image to a temp file via IPC and reference that path in the prompt string sent to the terminal. Do **not** attempt to pipe base64 to Claude Code's CLI — file path in prompt is the confirmed method.

---

## Recommended Stack

| Mechanism | API | Purpose | Confidence |
|-----------|-----|---------|------------|
| Clipboard read (renderer) | `ClipboardEvent.clipboardData` (browser API) | Capture Cmd+V paste in React form | HIGH |
| Drag-and-drop | `DragEvent.dataTransfer.files` (browser API) | Accept dropped image files | HIGH |
| Image to base64 | `FileReader.readAsDataURL()` or `URL.createObjectURL()` | Preview in `<img>` tag | HIGH |
| Image to disk | Electron IPC: `fs.writeFile` in main process via `app.getPath('temp')` | Persist image so Claude can read it | HIGH |
| Pass to Claude Code | File path string in terminal prompt | `"Here is a screenshot: /tmp/debug-XXXX.png\n\nIssue: ..."` | HIGH |
| Electron `clipboard.readImage()` | Main process only (deprecated in renderer) | Not needed — browser paste event covers it | HIGH |

**No new npm packages needed.** Everything is achievable with browser APIs already available in the renderer and Electron's existing `fs` + `app` APIs in the main process.

---

## Key Patterns

### 1. Clipboard Paste (Cmd+V) in React

Attach `onPaste` to any focusable container — does not need to be an `<input>`. Works on a `<div>` or the modal overlay itself.

```tsx
// Source: MDN ClipboardEvent + web.dev/patterns/clipboard/paste-images (verified)
// Attach to the modal wrapper div so paste works anywhere in the modal
function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of Array.from(items)) {
    if (item.type.startsWith("image/")) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) addImage(file);
    }
  }
}

// Usage
<div onPaste={handlePaste} tabIndex={0}>
  {/* modal content */}
</div>
```

**Critical detail:** `event.clipboardData.items` is the right property, NOT `event.clipboardData.files`. The `files` property is empty when an image is pasted from a screenshot tool. `items` contains the image. Both are checked when handling dropped files (where `files` is populated).

**macOS-specific:** The standard `Cmd+V` triggers the `paste` event and works fine. Electron does NOT require `Ctrl+V` in the renderer — `Ctrl+V` is only needed when pasting into the Claude Code terminal itself.

### 2. Drag-and-Drop

```tsx
// Source: MDN DragEvent + React TypeScript patterns (verified)
const [isDragging, setIsDragging] = useState(false);

function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
  setIsDragging(true);
}

function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
  // Only clear if leaving the drop zone entirely, not entering a child
  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
    setIsDragging(false);
  }
}

function handleDrop(e: React.DragEvent<HTMLDivElement>) {
  e.preventDefault();
  setIsDragging(false);
  const files = Array.from(e.dataTransfer.files).filter(
    (f) => f.type.startsWith("image/")
  );
  files.forEach(addImage);
}

<div
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
  className={isDragging ? "border-accent" : "border-border"}
>
```

**`dragLeave` pitfall:** The `dragLeave` event fires when the cursor moves over a child element. The `relatedTarget` check (`!e.currentTarget.contains(e.relatedTarget as Node)`) prevents the drag state from flickering. This is the most common bug with drop zones.

### 3. Converting File to Preview URL (Renderer-side)

```tsx
// Source: MDN FileReader (verified — no new deps needed)
function addImage(file: File) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string; // "data:image/png;base64,..."
    setImages((prev) => [...prev, { file, dataUrl, id: crypto.randomUUID() }]);
  };
  reader.readAsDataURL(file);
}

// Alternative (faster, no base64 overhead in renderer):
// const objectUrl = URL.createObjectURL(file);
// Remember to call URL.revokeObjectURL(objectUrl) on component unmount
```

Use `readAsDataURL` (not `createObjectURL`) when you need the base64 string for sending over IPC. Use `createObjectURL` when you only need the preview — it's faster and uses less memory.

### 4. Saving Image to Temp File (Main Process via IPC)

The renderer cannot write files directly (context isolation). Add an IPC handler in main and expose it via preload.

**Main process IPC handler** (add to `handlers.ts`):

```typescript
// Source: Electron docs fs + app.getPath (verified)
import { app, ipcMain } from "electron";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// IPC channel: 'image:save-temp'
// Input: { dataUrl: string, extension: string }
// Output: { success: boolean; filePath?: string; error?: string }
ipcMain.handle("image:save-temp", async (_, { dataUrl, extension }: { dataUrl: string; extension: string }) => {
  try {
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const fileName = `breadcrumb-debug-${crypto.randomUUID()}.${extension}`;
    const filePath = path.join(app.getPath("temp"), fileName);
    await fs.writeFile(filePath, buffer);
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Cleanup handler — call when modal closes
ipcMain.handle("image:delete-temp", async (_, filePath: string) => {
  try {
    await fs.unlink(filePath);
    return { success: true };
  } catch {
    return { success: true }; // Ignore if already deleted
  }
});
```

**Preload addition** (add to `BreadcrumbAPI` interface in `preload/index.ts`):

```typescript
saveImageTemp: (dataUrl: string, extension: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
deleteImageTemp: (filePath: string) => Promise<{ success: boolean }>;
```

### 5. Passing Images to Claude Code via Terminal

Claude Code accepts images by **file path reference in the prompt text**. This is confirmed in official docs: "Provide an image path to Claude. E.g., 'Analyze this image: /path/to/your/image.png'". It reads the file from disk using its own `Read` tool.

The prompt sent to the terminal (via `writeTerminal`) should be:

```typescript
// Source: Claude Code official docs (verified)
function buildClaudePrompt(description: string, imagePaths: string[]): string {
  const imageLines = imagePaths
    .map((p, i) => `Screenshot ${i + 1}: ${p}`)
    .join("\n");

  const imagePreamble = imagePaths.length > 0
    ? `${imageLines}\n\n`
    : "";

  return `${imagePreamble}${description}\n`;
}

// Then write to terminal:
const prompt = buildClaudePrompt(userDescription, savedFilePaths);
window.breadcrumbAPI.writeTerminal(sessionId, prompt);
```

**Important:** Claude Code in interactive mode reads image paths automatically. You do NOT need `--image` flags (none exist in the CLI). You do NOT need to base64-encode and pipe via stdin. The file path in prompt text approach is the documented, confirmed method.

### 6. Image Preview in Modal

Follow the existing modal pattern from `CommandPalette.tsx`:

```tsx
// Matches existing pattern: fixed inset-0 z-50, backdrop-blur-sm, glass class
function DebugModal({ onClose, onSubmit }) {
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [description, setDescription] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-2xl glass border border-border-strong rounded-xl shadow-lg overflow-hidden animate-fade-in-up"
        onPaste={handlePaste}
        tabIndex={0}
      >
        {/* Drag zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragging ? "border-accent bg-accent/10" : "border-border"
          }`}
        >
          Drop screenshots here or paste with Cmd+V
        </div>

        {/* Preview grid */}
        {images.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-3">
            {images.map((img) => (
              <div key={img.id} className="relative group">
                <img
                  src={img.dataUrl}
                  alt="Screenshot"
                  className="h-20 w-20 object-cover rounded-lg border border-border"
                />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white text-xs opacity-0 group-hover:opacity-100"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text area */}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue..."
          className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground-muted outline-none resize-none"
          rows={4}
        />
      </div>
    </div>
  );
}
```

---

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| MIME type detection | `file.type.startsWith("image/")` | Built-in, correct for all image types including webp |
| Image compression before saving | Skip — Claude Code reads raw files | Adding resize logic is complexity for no benefit; Claude handles large images |
| Base64 piping to Claude CLI stdin | File path in prompt | No `--image` CLI flag exists; stdin image support is not documented/confirmed |
| Custom drag-and-drop library (react-dropzone) | Inline drag events | Zero extra dependencies, the codebase has no existing drag-drop lib |
| Electron `clipboard.readImage()` via IPC | Browser `ClipboardEvent` in renderer | IPC roundtrip is unnecessary; browser paste event gives you the `File` object directly |

---

## Pitfalls

### Pitfall 1: `clipboardData.files` is empty for screenshot pastes

**What happens:** When a user takes a screenshot with `Cmd+Ctrl+Shift+4` and pastes it, `event.clipboardData.files` has length 0. The image is only available in `event.clipboardData.items` as a `DataTransferItem` with `kind === "file"`.

**Avoid by:** Always iterate `clipboardData.items` and call `item.getAsFile()`. Do not rely on `clipboardData.files` for paste handling. (`files` works correctly for drag-and-drop though.)

### Pitfall 2: `dragLeave` flickering on child elements

**What happens:** Moving the cursor over any child element inside the drop zone fires `dragLeave` on the parent, then `dragEnter` again. This causes the drop zone border to flash.

**Avoid by:** In `handleDragLeave`, check `!e.currentTarget.contains(e.relatedTarget as Node)` before clearing drag state. Only clear state when cursor actually leaves the drop zone boundary.

### Pitfall 3: `onPaste` requires the element to be focusable

**What happens:** `onPaste` on a `<div>` does not fire unless the element has `tabIndex={0}` (or equivalent). If the user clicks into the textarea to type and then pastes, the paste event fires on the textarea, not the modal wrapper.

**Avoid by:** Handle `onPaste` on both the modal wrapper AND the `<textarea>`. Alternatively, add a `document.addEventListener('paste', ...)` in a `useEffect` that only runs while the modal is open.

### Pitfall 4: Temp files are never cleaned up

**What happens:** If the user closes the app or an error occurs before the modal cleanup runs, temp image files accumulate in `app.getPath('temp')`.

**Avoid by:** Call `image:delete-temp` for each path on modal close (success or cancel). The `useEffect` cleanup in React is the right place. If you save the paths to the store, add cleanup on app quit via `app.on('before-quit', ...)`.

### Pitfall 5: Electron clipboard in renderer with contextIsolation

**What happens:** Attempting `require('electron').clipboard.readImage()` directly in renderer code fails with contextIsolation enabled (the current setup in this codebase).

**Avoid by:** Do not use Electron's `clipboard` module at all for this feature. The browser `ClipboardEvent` API is sufficient and already works in the renderer without any bridging.

### Pitfall 6: `objectURL` memory leak

**What happens:** `URL.createObjectURL(file)` creates a memory-mapped URL that is never freed unless `URL.revokeObjectURL()` is called. In a long-running Electron app, this accumulates.

**Avoid by:** Either use `readAsDataURL` (base64, no leak) or call `URL.revokeObjectURL(url)` in the `useEffect` cleanup when images are removed.

---

## Implementation Sequence

1. **Renderer: `useImageAttachments` hook** — handles paste, drag-drop, File-to-dataUrl, and image state (`images`, `addImage`, `removeImage`, drag event handlers).
2. **Main: IPC handlers** — `image:save-temp` (write buffer to `app.getPath('temp')`) and `image:delete-temp` (unlink).
3. **Preload: API extension** — expose `saveImageTemp` and `deleteImageTemp` on `window.breadcrumbAPI`.
4. **Modal component** — uses the hook, renders preview grid, passes description + file paths to parent on submit.
5. **Submit handler** — calls `saveImageTemp` for each image sequentially, builds the prompt string with file paths, calls `writeTerminal`.

The submit step must be async (waiting for IPC file writes to complete) before sending to terminal. Show a loading state during this.

---

## Open Questions

- **Electron 33 and `clipboard` in renderer:** Electron docs say renderer clipboard usage is "deprecated" but the severity (warning vs broken) was not confirmed. Moot since we don't need it, but worth noting if any future use case arises.
- **Claude Code file path auto-ingestion bug:** A reported GitHub issue (#13608) describes automatic file ingestion when paths are pasted corrupting sessions. The image file path approach via `writeTerminal` (not paste) avoids this. However, if Claude Code versions change this behavior, file path passing could break silently.
- **Image size limits for Claude Code:** The model has a 5MB per image limit. Whether Claude Code enforces this before reading the file (and how it errors) was not verified. Consider adding a renderer-side size check before saving.

---

## Sources

**HIGH confidence (official docs, verified):**
- [Electron clipboard API](https://www.electronjs.org/docs/latest/api/clipboard) — `readImage()` is main-process only with contextIsolation
- [Electron NativeImage API](https://www.electronjs.org/docs/latest/api/native-image) — `toDataURL()`, `toPNG()`, `toJPEG()` confirmed
- [Claude Code common workflows — "Work with images"](https://code.claude.com/docs/en/common-workflows) — file path in prompt confirmed, Ctrl+V into terminal confirmed
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference) — no `--image` flag exists (absence confirmed by full flag listing)
- [web.dev paste images pattern](https://web.dev/patterns/clipboard/paste-images) — `clipboardData.items` pattern confirmed

**MEDIUM confidence (verified from multiple sources):**
- `clipboardData.files` is empty for screenshot pastes, `clipboardData.items` is correct — confirmed across MDN + multiple implementation reports
- `dragLeave` child element flickering — widely documented pitfall, fix pattern confirmed
- Claude Code max image size 5MB / formats JPEG, PNG, GIF, WebP — from ClaudeLog (not official docs, treat as MEDIUM)

**LOW confidence (needs validation before implementation):**
- Whether `claude -p "prompt with /path/to/image.png"` works in headless mode the same way as interactive mode — the official docs show this for interactive mode only; headless image support was not directly confirmed
