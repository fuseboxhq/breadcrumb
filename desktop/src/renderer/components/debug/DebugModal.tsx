/**
 * DebugModal — purpose-built modal for the AI Debug Assistant.
 *
 * Collects:
 *  - Issue description (markdown textarea)
 *  - Screenshots (paste Cmd+V, drag-and-drop)
 *  - Console logs (paste area)
 *  - Instance choice: new Claude or reuse last selected
 *
 * On submit, saves images to temp files via IPC and returns all data
 * to the caller via the onSubmit callback.
 */

import { useState, useEffect, useCallback, useRef } from "react";

export interface ImageAttachment {
  id: string;
  file: File;
  dataUrl: string;
}

export interface DebugSubmitData {
  description: string;
  consoleLogs: string;
  imagePaths: string[];
  instanceChoice: "new" | "reuse";
}

interface DebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DebugSubmitData) => void;
}

export function DebugModal({ isOpen, onClose, onSubmit }: DebugModalProps) {
  const [description, setDescription] = useState("");
  const [consoleLogs, setConsoleLogs] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [instanceChoice, setInstanceChoice] = useState<"new" | "reuse">("new");
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Focus description on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => descriptionRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Global paste handler (works even when textarea is focused)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) addImage(file);
        }
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [isOpen]);

  const addImage = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), file, dataUrl },
      ]);
    };
    reader.readAsDataURL(file);
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      files.forEach(addImage);
    },
    [addImage]
  );

  const handleSubmit = useCallback(async () => {
    if (!description.trim() && images.length === 0) return;
    setIsSubmitting(true);

    try {
      // Save images to temp files
      const imagePaths: string[] = [];
      for (const img of images) {
        const ext = img.file.name.split(".").pop() || "png";
        const result = await window.breadcrumbAPI?.saveImageTemp(img.dataUrl, ext);
        if (result?.success && result.filePath) {
          imagePaths.push(result.filePath);
        }
      }

      onSubmit({
        description: description.trim(),
        consoleLogs: consoleLogs.trim(),
        imagePaths,
        instanceChoice,
      });

      // Reset form
      setDescription("");
      setConsoleLogs("");
      setImages([]);
      setInstanceChoice("new");
    } finally {
      setIsSubmitting(false);
    }
  }, [description, consoleLogs, images, instanceChoice, onSubmit]);

  // Cleanup temp files on close
  const handleClose = useCallback(() => {
    setDescription("");
    setConsoleLogs("");
    setImages([]);
    setInstanceChoice("new");
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[85vh] glass border border-border-strong rounded-xl shadow-lg overflow-hidden animate-fade-in-up flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-accent-secondary/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-accent-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-foreground">
              Debug Issue
            </h2>
          </div>
          <p className="mt-1.5 text-2xs text-foreground-muted">
            Describe the issue and attach evidence. Claude will investigate using
            your project's debug skill.
          </p>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-4">
          {/* Issue description */}
          <div>
            <label className="block text-2xs font-medium text-foreground-secondary mb-1.5">
              Issue Description <span className="text-destructive">*</span>
            </label>
            <textarea
              ref={descriptionRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's happening? What did you expect instead?"
              rows={4}
              className="w-full px-3 py-2.5 bg-background-raised border border-border rounded-lg text-sm text-foreground placeholder:text-foreground-muted outline-none focus:border-accent-secondary transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* Screenshot drop zone */}
          <div>
            <label className="block text-2xs font-medium text-foreground-secondary mb-1.5">
              Screenshots
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                isDragging
                  ? "border-accent-secondary bg-accent-secondary/10"
                  : "border-border hover:border-border-strong"
              }`}
            >
              <p className="text-2xs text-foreground-muted">
                {isDragging
                  ? "Drop screenshots here"
                  : "Drop screenshots here or paste with Cmd+V"}
              </p>
            </div>

            {/* Image preview grid */}
            {images.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-2">
                {images.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.dataUrl}
                      alt="Screenshot"
                      className="h-20 w-20 object-cover rounded-lg border border-border"
                    />
                    <button
                      onClick={() => removeImage(img.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-background-overlay border border-border-strong text-foreground-muted hover:text-foreground text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Console logs */}
          <div>
            <label className="block text-2xs font-medium text-foreground-secondary mb-1.5">
              Console Logs
            </label>
            <textarea
              value={consoleLogs}
              onChange={(e) => setConsoleLogs(e.target.value)}
              placeholder="Paste any relevant console output, error messages, or stack traces..."
              rows={3}
              className="w-full px-3 py-2.5 bg-background-raised border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-muted outline-none focus:border-accent-secondary transition-colors resize-none font-mono leading-relaxed"
            />
          </div>

          {/* Instance choice */}
          <div>
            <label className="block text-2xs font-medium text-foreground-secondary mb-1.5">
              Claude Instance
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setInstanceChoice("new")}
                className={`flex-1 px-3 py-2 rounded-lg border text-2xs font-medium transition-colors ${
                  instanceChoice === "new"
                    ? "border-accent-secondary bg-accent-secondary/10 text-accent-secondary"
                    : "border-border text-foreground-muted hover:border-border-strong hover:text-foreground-secondary"
                }`}
              >
                New instance
              </button>
              <button
                onClick={() => setInstanceChoice("reuse")}
                className={`flex-1 px-3 py-2 rounded-lg border text-2xs font-medium transition-colors ${
                  instanceChoice === "reuse"
                    ? "border-accent-secondary bg-accent-secondary/10 text-accent-secondary"
                    : "border-border text-foreground-muted hover:border-border-strong hover:text-foreground-secondary"
                }`}
              >
                Reuse last selected
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border flex-shrink-0">
          <button
            onClick={handleClose}
            className="px-3.5 py-1.5 text-2xs font-medium text-foreground-secondary hover:text-foreground rounded-md hover:bg-background-raised transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (!description.trim() && images.length === 0)}
            className="px-3.5 py-1.5 text-2xs font-medium text-white bg-accent-secondary hover:bg-accent-secondary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Preparing..." : "Start Debug Session"}
          </button>
        </div>
      </div>
    </div>
  );
}
