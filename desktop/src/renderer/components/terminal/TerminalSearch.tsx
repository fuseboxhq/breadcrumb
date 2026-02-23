import { useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

interface TerminalSearchProps {
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Terminal search overlay — temporarily disabled while ghostty-web
 * lacks a search addon. Shows a "not available" message instead.
 * Will be restored when ghostty-web adds search support or we build
 * a custom search over the buffer API.
 */
export function TerminalSearch({ isVisible, onClose }: TerminalSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isVisible) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isVisible]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isVisible) return null;

  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass border border-border-strong shadow-lg animate-fade-in">
      <Search className="w-3.5 h-3.5 text-foreground-muted shrink-0" />
      <span className="text-sm text-foreground-muted">
        Search not yet available
      </span>
      <button
        ref={inputRef as React.RefObject<HTMLButtonElement>}
        onClick={onClose}
        onKeyDown={handleKeyDown}
        className="p-1 rounded text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
        title="Close (Esc)"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
