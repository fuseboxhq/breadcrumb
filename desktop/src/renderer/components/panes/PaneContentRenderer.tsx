import type { ContentPane, TerminalPaneData } from "../../store/appStore";
import { TerminalInstance } from "../terminal/TerminalInstance";
import { BrowserPanel } from "../browser/BrowserPanel";
import { DiffViewer } from "../breadcrumb/DiffViewer";
import { useAppStore } from "../../store/appStore";

interface PaneContentRendererProps {
  pane: ContentPane;
  tabId: string;
  isActive: boolean;
  /** Whether the parent tab is the visible tab in the workspace */
  isTabActive?: boolean;
  workingDirectory?: string;
  /** Tab-level initial command (for first terminal pane only) */
  tabInitialCommand?: string;
  onCwdChange?: (paneId: string, cwd: string) => void;
  onSplitHorizontal?: () => void;
  onSplitVertical?: () => void;
  onToggleZoom?: () => void;
  isZoomed?: boolean;
  canZoom?: boolean;
  onInitialCommandSent?: () => void;
  onPaneInitialCommandSent?: (paneId: string) => void;
  onProcessExit?: (paneId: string, exitCode: number) => void;
}

export function PaneContentRenderer({
  pane,
  tabId,
  isActive,
  isTabActive = true,
  workingDirectory,
  tabInitialCommand,
  onCwdChange,
  onSplitHorizontal,
  onSplitVertical,
  onToggleZoom,
  isZoomed,
  canZoom,
  onInitialCommandSent,
  onPaneInitialCommandSent,
  onProcessExit,
}: PaneContentRendererProps) {
  switch (pane.type) {
    case "terminal": {
      const terminalPane = pane as TerminalPaneData;
      return (
        <TerminalInstance
          sessionId={terminalPane.sessionId}
          isActive={isActive && isTabActive}
          workingDirectory={workingDirectory}
          onCwdChange={onCwdChange ? (cwd) => onCwdChange(pane.id, cwd) : undefined}
          initialCommand={tabInitialCommand || terminalPane.initialCommand}
          onInitialCommandSent={() => {
            onInitialCommandSent?.();
            onPaneInitialCommandSent?.(pane.id);
          }}
          onProcessExit={onProcessExit ? (exitCode) => onProcessExit(pane.id, exitCode) : undefined}
          onSplitHorizontal={onSplitHorizontal}
          onSplitVertical={onSplitVertical}
          onToggleZoom={onToggleZoom}
          isZoomed={isZoomed}
          canZoom={canZoom}
        />
      );
    }
    case "browser":
      return (
        <BrowserPanel
          browserId={pane.browserId}
          initialUrl={pane.url}
          isVisible={isActive}
        />
      );
    case "diff":
      return (
        <DiffViewer
          projectPath={pane.diffProjectPath}
          hash={pane.diffHash}
          onBack={() => useAppStore.getState().removePane(tabId, pane.id)}
        />
      );
    default:
      return null;
  }
}
