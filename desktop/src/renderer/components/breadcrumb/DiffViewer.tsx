import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { DiffView, DiffModeEnum, DiffFile } from "@git-diff-view/react";
import "@git-diff-view/react/styles/diff-view.css";
import {
  ArrowLeft,
  GitCommit,
  FileText,
  FilePlus,
  FileX,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import {
  useGitStore,
  type CommitInfo,
  type CommitDiff,
  type CommitStats,
} from "../../store/gitStore";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILES_SHOWN = 50;
const MAX_HUNK_LINES = 5000;

// ── Types ────────────────────────────────────────────────────────────────────

interface FileDiff {
  oldName: string;
  newName: string;
  hunks: string;
  isBinary: boolean;
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
  lineCount: number;
}

// ── Diff Parser ──────────────────────────────────────────────────────────────

function parseRawDiff(raw: string): FileDiff[] {
  if (!raw.trim()) return [];

  const files: FileDiff[] = [];
  const sections = raw.split(/^diff --git /m).filter(Boolean);

  for (const section of sections) {
    const lines = section.split("\n");
    const headerLine = lines[0] ?? "";

    const headerMatch = headerLine.match(/^a\/(.+?) b\/(.+?)$/);
    const oldName = headerMatch?.[1] ?? "unknown";
    const newName = headerMatch?.[2] ?? "unknown";

    const isBinary = section.includes("Binary files") || section.includes("GIT binary patch");
    const isNew = section.includes("new file mode");
    const isDeleted = section.includes("deleted file mode");
    const isRenamed = section.includes("rename from") || section.includes("rename to");

    if (isBinary) {
      files.push({ oldName, newName, hunks: "", isBinary: true, isNew, isDeleted, isRenamed, lineCount: 0 });
      continue;
    }

    const diffStart = section.indexOf("--- ");
    if (diffStart === -1) {
      files.push({ oldName, newName, hunks: "", isBinary: false, isNew, isDeleted, isRenamed, lineCount: 0 });
      continue;
    }

    const hunks = section.slice(diffStart);
    const lineCount = hunks.split("\n").length;
    files.push({ oldName, newName, hunks, isBinary: false, isNew, isDeleted, isRenamed, lineCount });
  }

  return files;
}

// ── Language Detection ───────────────────────────────────────────────────────

function detectLang(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    py: "python", rs: "rust", go: "go", rb: "ruby",
    java: "java", kt: "kotlin", swift: "swift",
    c: "c", h: "c", cpp: "cpp", hpp: "cpp", cs: "csharp",
    css: "css", scss: "scss", html: "html",
    json: "json", yaml: "yaml", yml: "yaml",
    md: "markdown", sh: "bash", bash: "bash", zsh: "bash",
    toml: "toml", sql: "sql", xml: "xml", vue: "vue", svelte: "svelte",
  };
  return map[ext] ?? "text";
}

// ── Relative Time ────────────────────────────────────────────────────────────

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 5) return `${weeks}w ago`;
  return `${months}mo ago`;
}

// ── File Status Icon ─────────────────────────────────────────────────────────

function FileStatusIcon({ file }: { file: FileDiff }) {
  if (file.isNew) return <FilePlus className="w-3.5 h-3.5 text-success shrink-0" />;
  if (file.isDeleted) return <FileX className="w-3.5 h-3.5 text-destructive shrink-0" />;
  return <FileText className="w-3.5 h-3.5 text-foreground-muted shrink-0" />;
}

// ── Main DiffViewer Component ────────────────────────────────────────────────

export function DiffViewer({
  projectPath,
  hash,
  onBack,
}: {
  projectPath: string;
  hash: string;
  onBack: () => void;
}) {
  const fetchDiff = useGitStore((s) => s.fetchDiff);
  const fetchStats = useGitStore((s) => s.fetchStats);
  const diff = useGitStore(
    (s) => s.projects[projectPath]?.diffs[hash] ?? null
  ) as CommitDiff | null;
  const stats = useGitStore(
    (s) => s.projects[projectPath]?.stats[hash] ?? null
  ) as CommitStats | null;
  const loadingDiff = useGitStore(
    (s) => s.projects[projectPath]?.loadingDiff ?? null
  );
  const commits = useGitStore(
    (s) => s.projects[projectPath]?.commits ?? []
  ) as CommitInfo[];
  const commit = commits.find((c) => c.hash === hash);

  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const fileRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fileListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDiff(projectPath, hash);
    fetchStats(projectPath, hash);
  }, [projectPath, hash, fetchDiff, fetchStats]);

  // Parse raw diff into per-file sections
  const fileDiffs = useMemo(() => {
    if (!diff?.patch) return [];
    return parseRawDiff(diff.patch);
  }, [diff?.patch]);

  // Truncate file list for large commits
  const visibleFiles = useMemo(() => {
    if (showAllFiles) return fileDiffs;
    return fileDiffs.slice(0, MAX_FILES_SHOWN);
  }, [fileDiffs, showAllFiles]);
  const hiddenFileCount = fileDiffs.length - visibleFiles.length;

  // Match stats to files
  const fileStatsMap = useMemo(() => {
    const map = new Map<string, { insertions: number; deletions: number }>();
    if (stats?.files) {
      for (const f of stats.files) {
        map.set(f.path, { insertions: f.insertions, deletions: f.deletions });
      }
    }
    return map;
  }, [stats?.files]);

  const handleFileClick = useCallback((fileName: string) => {
    setExpandedFile((prev) => (prev === fileName ? null : fileName));
    setTimeout(() => {
      fileRefs.current[fileName]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  }, []);

  // Keyboard navigation for file list
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (expandedFile) {
        setExpandedFile(null);
      } else {
        onBack();
      }
    }
  }, [expandedFile, onBack]);

  const isLoading = loadingDiff === hash;

  return (
    <div
      className="flex flex-col h-full animate-fade-in"
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0 bg-background-raised">
        <button
          onClick={onBack}
          className="p-1 rounded-md text-foreground-muted hover:text-foreground-secondary hover:bg-muted/30 transition-default focus-visible:ring-1 focus-visible:ring-accent-secondary/50 focus-visible:outline-none"
          aria-label="Back to pipeline"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-2xs font-mono text-accent-secondary shrink-0">
              {hash.slice(0, 7)}
            </span>
            {commit && (
              <span className="text-sm text-foreground truncate">
                {commit.subject}
              </span>
            )}
          </div>
          {commit && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-2xs text-foreground-muted">
                {commit.author}
              </span>
              <span className="text-2xs text-foreground-muted/50">
                {relativeTime(commit.date)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <DiffSkeleton />
        ) : (
          <>
            {/* Stats summary bar */}
            {stats && (
              <div className="px-4 py-2.5 border-b border-border bg-muted/5">
                <div className="flex items-center gap-3 text-2xs">
                  <span className="text-foreground-muted">
                    {stats.filesChanged} file{stats.filesChanged !== 1 ? "s" : ""} changed
                  </span>
                  <span className="text-success font-mono">
                    +{stats.totalInsertions}
                  </span>
                  <span className="text-destructive font-mono">
                    -{stats.totalDeletions}
                  </span>
                </div>
              </div>
            )}

            {/* File list with inline diffs */}
            <div className="divide-y divide-border/50" ref={fileListRef}>
              {visibleFiles.map((file) => {
                const fileName = file.isDeleted ? file.oldName : file.newName;
                const isExpanded = expandedFile === fileName;
                const fileStat = fileStatsMap.get(fileName);
                const isTooLarge = file.lineCount > MAX_HUNK_LINES;

                return (
                  <div
                    key={fileName}
                    ref={(el) => { fileRefs.current[fileName] = el; }}
                  >
                    {/* File header row */}
                    <button
                      onClick={() => !file.isBinary && handleFileClick(fileName)}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-default focus-visible:ring-1 focus-visible:ring-accent-secondary/50 focus-visible:ring-inset focus-visible:outline-none ${
                        file.isBinary
                          ? "opacity-50 cursor-default"
                          : "hover:bg-muted/10 cursor-pointer"
                      }`}
                      disabled={file.isBinary}
                      tabIndex={0}
                    >
                      <FileStatusIcon file={file} />

                      <span className="text-2xs font-mono text-foreground-secondary truncate flex-1">
                        {fileName}
                      </span>

                      {file.isBinary && (
                        <span className="text-2xs px-1.5 py-0.5 rounded bg-foreground-muted/10 text-foreground-muted shrink-0">
                          Binary
                        </span>
                      )}

                      {file.isRenamed && (
                        <span className="text-2xs px-1.5 py-0.5 rounded bg-accent-secondary/10 text-accent-secondary shrink-0">
                          Renamed
                        </span>
                      )}

                      {isTooLarge && (
                        <span className="text-2xs px-1.5 py-0.5 rounded bg-warning/10 text-warning shrink-0">
                          Large
                        </span>
                      )}

                      {fileStat && !file.isBinary && (
                        <div className="flex items-center gap-1.5 shrink-0 text-2xs font-mono">
                          {fileStat.insertions > 0 && (
                            <span className="text-success">+{fileStat.insertions}</span>
                          )}
                          {fileStat.deletions > 0 && (
                            <span className="text-destructive">-{fileStat.deletions}</span>
                          )}
                        </div>
                      )}

                      {!file.isBinary && (
                        <ChevronRight
                          className={`w-3.5 h-3.5 text-foreground-muted/50 shrink-0 transition-transform duration-150 ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                      )}
                    </button>

                    {/* Expanded diff view with animation */}
                    <div
                      className="grid transition-[grid-template-rows] duration-200 ease-out"
                      style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
                    >
                      <div className="overflow-hidden">
                        {isExpanded && file.hunks && (
                          <div className="border-t border-border/30">
                            <FileDiffView
                              fileName={fileName}
                              hunks={file.hunks}
                              isTooLarge={isTooLarge}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* "N more files" button */}
            {hiddenFileCount > 0 && (
              <div className="px-4 py-3 border-t border-border/50">
                <button
                  onClick={() => setShowAllFiles(true)}
                  className="text-2xs text-accent-secondary hover:text-accent-secondary/80 transition-default"
                >
                  Show {hiddenFileCount} more file{hiddenFileCount !== 1 ? "s" : ""}
                </button>
              </div>
            )}

            {/* Empty state */}
            {fileDiffs.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in-up">
                <div className="w-10 h-10 rounded-xl bg-muted/20 border border-border flex items-center justify-center mb-3">
                  <GitCommit className="w-5 h-5 text-foreground-muted" />
                </div>
                <p className="text-sm text-foreground-secondary mb-0.5">
                  No changes in this commit
                </p>
                <p className="text-2xs text-foreground-muted max-w-[200px]">
                  This commit may be a merge or have no file changes
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function DiffSkeleton() {
  return (
    <div className="animate-fade-in">
      {/* Stats bar skeleton */}
      <div className="px-4 py-2.5 border-b border-border bg-muted/5">
        <div className="flex items-center gap-3">
          <div className="h-3.5 w-24 bg-muted/30 rounded animate-pulse" />
          <div className="h-3.5 w-10 bg-success/10 rounded animate-pulse" />
          <div className="h-3.5 w-10 bg-destructive/10 rounded animate-pulse" />
        </div>
      </div>
      {/* File rows skeleton */}
      <div className="divide-y divide-border/50">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-4 py-2.5 flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-muted/20 rounded animate-pulse shrink-0" />
            <div
              className="h-3.5 bg-muted/20 rounded animate-pulse flex-1"
              style={{ maxWidth: `${70 - i * 8}%` }}
            />
            <div className="h-3.5 w-8 bg-muted/15 rounded animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Single File Diff View ────────────────────────────────────────────────────

function FileDiffView({
  fileName,
  hunks,
  isTooLarge,
}: {
  fileName: string;
  hunks: string;
  isTooLarge: boolean;
}) {
  const [diffFile, setDiffFile] = useState<InstanceType<typeof DiffFile> | null>(null);
  const [parseError, setParseError] = useState(false);

  useEffect(() => {
    try {
      const lang = detectLang(fileName);
      // Truncate large hunks to prevent render lock
      const truncatedHunks = isTooLarge
        ? hunks.split("\n").slice(0, MAX_HUNK_LINES).join("\n")
        : hunks;

      const file = new DiffFile(
        fileName, "",
        fileName, "",
        [truncatedHunks],
        lang,
        lang
      );
      file.initTheme("dark");
      file.initRaw();
      file.buildSplitDiffLines();
      file.buildUnifiedDiffLines();
      setDiffFile(file);
      setParseError(false);
    } catch (err) {
      console.warn("Failed to parse diff for", fileName, err);
      setDiffFile(null);
      setParseError(true);
    }
  }, [fileName, hunks, isTooLarge]);

  if (parseError) {
    return (
      <div className="p-3 flex items-center gap-2 text-2xs text-warning bg-warning/5">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>Could not render diff — showing raw text</span>
      </div>
    );
  }

  if (!diffFile) {
    // Loading state while DiffFile is being created
    return (
      <div className="p-3 space-y-1.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-4 bg-muted/15 rounded animate-pulse"
            style={{ width: `${85 - i * 15}%` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="diff-viewer-wrapper">
      <DiffView
        diffFile={diffFile}
        diffViewMode={DiffModeEnum.Unified}
        diffViewTheme="dark"
        diffViewHighlight={false}
        diffViewWrap
      />
      {isTooLarge && (
        <div className="px-3 py-2 bg-warning/5 border-t border-warning/20 text-2xs text-warning flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          File truncated — showing first {MAX_HUNK_LINES.toLocaleString()} lines
        </div>
      )}
    </div>
  );
}
