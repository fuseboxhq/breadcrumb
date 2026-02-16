import { useState, useEffect, useMemo, useRef } from "react";
import { DiffView, DiffModeEnum, DiffFile } from "@git-diff-view/react";
import "@git-diff-view/react/styles/diff-view.css";
import {
  ArrowLeft,
  GitCommit,
  FileText,
  FilePlus,
  FileX,
  ChevronRight,
} from "lucide-react";
import {
  useGitStore,
  type CommitInfo,
  type CommitDiff,
  type CommitStats,
} from "../../store/gitStore";

// ── Types ────────────────────────────────────────────────────────────────────

interface FileDiff {
  oldName: string;
  newName: string;
  hunks: string; // raw hunk text including --- and +++ headers
  isBinary: boolean;
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
}

// ── Diff Parser ──────────────────────────────────────────────────────────────

function parseRawDiff(raw: string): FileDiff[] {
  if (!raw.trim()) return [];

  const files: FileDiff[] = [];
  // Split on "diff --git" boundaries
  const sections = raw.split(/^diff --git /m).filter(Boolean);

  for (const section of sections) {
    const lines = section.split("\n");
    const headerLine = lines[0] ?? "";

    // Parse filenames from "a/path b/path"
    const headerMatch = headerLine.match(/^a\/(.+?) b\/(.+?)$/);
    const oldName = headerMatch?.[1] ?? "unknown";
    const newName = headerMatch?.[2] ?? "unknown";

    const isBinary = section.includes("Binary files") || section.includes("GIT binary patch");
    const isNew = section.includes("new file mode");
    const isDeleted = section.includes("deleted file mode");
    const isRenamed = section.includes("rename from") || section.includes("rename to");

    if (isBinary) {
      files.push({ oldName, newName, hunks: "", isBinary: true, isNew, isDeleted, isRenamed });
      continue;
    }

    // Extract from --- line onwards (the actual diff content)
    const diffStart = section.indexOf("--- ");
    if (diffStart === -1) {
      files.push({ oldName, newName, hunks: "", isBinary: false, isNew, isDeleted, isRenamed });
      continue;
    }

    const hunks = section.slice(diffStart);
    files.push({ oldName, newName, hunks, isBinary: false, isNew, isDeleted, isRenamed });
  }

  return files;
}

// ── Language Detection ───────────────────────────────────────────────────────

function detectLang(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    rs: "rust",
    go: "go",
    rb: "ruby",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    c: "c",
    h: "c",
    cpp: "cpp",
    hpp: "cpp",
    cs: "csharp",
    css: "css",
    scss: "scss",
    html: "html",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    toml: "toml",
    sql: "sql",
    xml: "xml",
    vue: "vue",
    svelte: "svelte",
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
  const fileRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    fetchDiff(projectPath, hash);
    fetchStats(projectPath, hash);
  }, [projectPath, hash, fetchDiff, fetchStats]);

  // Parse raw diff into per-file sections
  const fileDiffs = useMemo(() => {
    if (!diff?.patch) return [];
    return parseRawDiff(diff.patch);
  }, [diff?.patch]);

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

  const handleFileClick = (fileName: string) => {
    setExpandedFile((prev) => (prev === fileName ? null : fileName));
    // Scroll to file after expand
    setTimeout(() => {
      fileRefs.current[fileName]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  };

  const isLoading = loadingDiff === hash;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0 bg-background-raised">
        <button
          onClick={onBack}
          className="p-1 rounded-md text-foreground-muted hover:text-foreground-secondary hover:bg-muted/30 transition-default"
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
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-6 bg-muted/20 rounded animate-pulse"
                style={{ width: `${90 - i * 12}%` }}
              />
            ))}
          </div>
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
            <div className="divide-y divide-border/50">
              {fileDiffs.map((file) => {
                const fileName = file.isDeleted ? file.oldName : file.newName;
                const isExpanded = expandedFile === fileName;
                const fileStat = fileStatsMap.get(fileName);

                return (
                  <div
                    key={fileName}
                    ref={(el) => { fileRefs.current[fileName] = el; }}
                  >
                    {/* File header row */}
                    <button
                      onClick={() => !file.isBinary && handleFileClick(fileName)}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-default ${
                        file.isBinary
                          ? "opacity-50 cursor-default"
                          : "hover:bg-muted/10 cursor-pointer"
                      }`}
                      disabled={file.isBinary}
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

                    {/* Expanded diff view */}
                    {isExpanded && file.hunks && (
                      <div className="border-t border-border/30">
                        <FileDiffView
                          fileName={fileName}
                          hunks={file.hunks}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Empty state */}
            {fileDiffs.length === 0 && !isLoading && (
              <div className="flex items-center gap-2 text-2xs text-foreground-muted p-4">
                <GitCommit className="w-4 h-4" />
                <span>No diff data available for this commit</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Single File Diff View ────────────────────────────────────────────────────

function FileDiffView({
  fileName,
  hunks,
}: {
  fileName: string;
  hunks: string;
}) {
  const [diffFile, setDiffFile] = useState<InstanceType<typeof DiffFile> | null>(null);

  useEffect(() => {
    try {
      const lang = detectLang(fileName);
      const file = new DiffFile(
        fileName, "", // old content (not available from raw diff)
        fileName, "", // new content
        [hunks],      // raw hunks including --- +++ headers
        lang,
        lang
      );
      file.initTheme("dark");
      file.initRaw();
      file.buildSplitDiffLines();
      file.buildUnifiedDiffLines();
      setDiffFile(file);
    } catch (err) {
      console.warn("Failed to parse diff for", fileName, err);
      setDiffFile(null);
    }
  }, [fileName, hunks]);

  if (!diffFile) {
    return (
      <pre className="text-2xs font-mono bg-muted/5 p-3 overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin text-foreground-muted">
        {hunks.slice(0, 3000)}
        {hunks.length > 3000 && "\n... truncated"}
      </pre>
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
    </div>
  );
}
