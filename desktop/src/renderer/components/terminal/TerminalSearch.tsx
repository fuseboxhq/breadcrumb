import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, ChevronUp, ChevronDown, Regex } from "lucide-react";
import type { SearchAddon } from "@xterm/addon-search";

interface TerminalSearchProps {
  searchAddon: SearchAddon | null;
  isVisible: boolean;
  onClose: () => void;
}

export function TerminalSearch({ searchAddon, isVisible, onClose }: TerminalSearchProps) {
  const [query, setQuery] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when search becomes visible
  useEffect(() => {
    if (isVisible) {
      setQuery("");
      setMatchCount(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      searchAddon?.clearDecorations();
    }
  }, [isVisible, searchAddon]);

  const findNext = useCallback(() => {
    if (!searchAddon || !query) return;
    const found = searchAddon.findNext(query, { regex: useRegex, caseSensitive: false });
    if (!found) setMatchCount(0);
  }, [searchAddon, query, useRegex]);

  const findPrevious = useCallback(() => {
    if (!searchAddon || !query) return;
    const found = searchAddon.findPrevious(query, { regex: useRegex, caseSensitive: false });
    if (!found) setMatchCount(0);
  }, [searchAddon, query, useRegex]);

  // Search as you type
  useEffect(() => {
    if (!searchAddon || !query || !isVisible) {
      setMatchCount(null);
      return;
    }
    const found = searchAddon.findNext(query, { regex: useRegex, caseSensitive: false, incremental: true });
    setMatchCount(found ? null : 0);
  }, [query, useRegex, searchAddon, isVisible]);

  // Listen for results count changes
  useEffect(() => {
    if (!searchAddon) return;
    const disposable = searchAddon.onDidChangeResults?.((e: { resultIndex: number; resultCount: number }) => {
      setMatchCount(e.resultCount);
    });
    return () => disposable?.dispose();
  }, [searchAddon]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        findPrevious();
      } else {
        findNext();
      }
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isVisible) return null;

  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass border border-border-strong shadow-lg animate-fade-in">
      <Search className="w-3.5 h-3.5 text-foreground-muted shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search..."
        className="w-44 bg-transparent text-sm text-foreground placeholder:text-foreground-muted outline-none"
      />

      {/* Match count */}
      {query && matchCount !== null && (
        <span className="text-2xs text-foreground-muted tabular-nums shrink-0">
          {matchCount === 0 ? "No results" : `${matchCount} found`}
        </span>
      )}

      {/* Regex toggle */}
      <button
        onClick={() => setUseRegex(!useRegex)}
        className={`p-1 rounded transition-default ${
          useRegex
            ? "bg-primary/20 text-primary"
            : "text-foreground-muted hover:text-foreground-secondary"
        }`}
        title="Use regex"
      >
        <Regex className="w-3.5 h-3.5" />
      </button>

      {/* Nav buttons */}
      <button
        onClick={findPrevious}
        className="p-1 rounded text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
        title="Previous match (Shift+Enter)"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={findNext}
        className="p-1 rounded text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
        title="Next match (Enter)"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {/* Close */}
      <button
        onClick={onClose}
        className="p-1 rounded text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
        title="Close (Esc)"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
