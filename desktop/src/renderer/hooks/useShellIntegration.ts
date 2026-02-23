import { useRef, useCallback } from "react";
import type { Terminal } from "@xterm/xterm";

export interface CommandBlock {
  id: string;
  promptStartLine: number;
  promptEndLine: number;
  commandStartLine: number;
  commandEndLine: number;
  exitCode: number | null;
  startTime: number | null;
  endTime: number | null;
  cwd: string | null;
}

export interface ShellIntegrationState {
  blocks: CommandBlock[];
  currentCwd: string | null;
  lastExitCode: number | null;
}

interface ShellIntegrationCallbacks {
  onCwdChange?: (cwd: string) => void;
  onCommandStart?: (block: CommandBlock) => void;
  onCommandEnd?: (block: CommandBlock) => void;
}

/**
 * Hook to register OSC 133 (command boundaries) and OSC 7 (cwd tracking)
 * handlers on an xterm.js Terminal instance.
 *
 * Callbacks are stored in a ref so that `registerHandlers` has a stable
 * identity — callers can safely include it in useEffect dependency arrays
 * without triggering terminal recreation on every render.
 */
export function useShellIntegration(callbacks?: ShellIntegrationCallbacks) {
  const stateRef = useRef<ShellIntegrationState>({
    blocks: [],
    currentCwd: null,
    lastExitCode: null,
  });
  const currentBlockRef = useRef<Partial<CommandBlock> | null>(null);
  const blockCounterRef = useRef(0);

  // Store callbacks in a ref so registerHandlers never changes identity
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const registerHandlers = useCallback(
    (terminal: Terminal) => {
      const disposables: { dispose: () => void }[] = [];

      // OSC 133: Command boundary detection
      const osc133Handler = terminal.parser.registerOscHandler(133, (data: string) => {
        const parts = data.split(";");
        const type = parts[0];
        const cursorLine = terminal.buffer.active.cursorY + terminal.buffer.active.baseY;

        switch (type) {
          case "A": {
            // Prompt start — begin a new command block
            blockCounterRef.current++;
            currentBlockRef.current = {
              id: `cmd-${blockCounterRef.current}`,
              promptStartLine: cursorLine,
              promptEndLine: -1,
              commandStartLine: -1,
              commandEndLine: -1,
              exitCode: null,
              startTime: null,
              endTime: null,
              cwd: stateRef.current.currentCwd,
            };
            break;
          }
          case "B": {
            // Prompt end — user can now type
            if (currentBlockRef.current) {
              currentBlockRef.current.promptEndLine = cursorLine;
            }
            break;
          }
          case "C": {
            // Command start — user pressed enter
            if (currentBlockRef.current) {
              currentBlockRef.current.commandStartLine = cursorLine;
              currentBlockRef.current.startTime = Date.now();
              if (callbacksRef.current?.onCommandStart && currentBlockRef.current.id) {
                callbacksRef.current.onCommandStart(currentBlockRef.current as CommandBlock);
              }
            }
            break;
          }
          case "D": {
            // Command end — execution finished
            const exitCode = parts[1] ? parseInt(parts[1], 10) : 0;
            if (currentBlockRef.current) {
              currentBlockRef.current.commandEndLine = cursorLine;
              currentBlockRef.current.exitCode = exitCode;
              currentBlockRef.current.endTime = Date.now();

              const block = currentBlockRef.current as CommandBlock;
              stateRef.current.blocks.push(block);
              stateRef.current.lastExitCode = exitCode;

              if (callbacksRef.current?.onCommandEnd) {
                callbacksRef.current.onCommandEnd(block);
              }

              currentBlockRef.current = null;
            } else {
              // D without a preceding A — still track exit code
              stateRef.current.lastExitCode = exitCode;
            }
            break;
          }
        }

        return true;
      });
      disposables.push(osc133Handler);

      // OSC 7: Working directory reporting
      const osc7Handler = terminal.parser.registerOscHandler(7, (data: string) => {
        // Format: file://hostname/path
        try {
          if (data.startsWith("file://")) {
            const url = new URL(data);
            const cwd = decodeURIComponent(url.pathname);
            stateRef.current.currentCwd = cwd;

            if (callbacksRef.current?.onCwdChange) {
              callbacksRef.current.onCwdChange(cwd);
            }
          }
        } catch {
          // Ignore malformed URLs
        }
        return true;
      });
      disposables.push(osc7Handler);

      // Return cleanup function
      return () => {
        disposables.forEach((d) => d.dispose());
      };
    },
    [] // No dependencies — stable forever
  );

  const getState = useCallback(() => stateRef.current, []);

  return { registerHandlers, getState };
}
