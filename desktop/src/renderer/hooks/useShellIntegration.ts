import { useRef, useCallback } from "react";
import type { Terminal } from "ghostty-web";
import type { OscShim } from "../lib/oscShim";

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
 * handlers via an OscShim that intercepts raw PTY data.
 *
 * Unlike the previous xterm.js version which used terminal.parser.registerOscHandler(),
 * this version works with any terminal emulator by intercepting data before
 * it reaches the terminal.
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
    (terminal: Terminal, shim: OscShim) => {
      // OSC 133: Command boundary detection
      const unsubOsc133 = shim.on(133, (data: string) => {
        const parts = data.split(";");
        const type = parts[0];
        const buf = terminal.buffer.active;
        const cursorLine = buf.cursorY + buf.baseY;

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
      });

      // OSC 7: Working directory reporting
      const unsubOsc7 = shim.on(7, (data: string) => {
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
      });

      // Return cleanup function
      return () => {
        unsubOsc133();
        unsubOsc7();
      };
    },
    [] // No dependencies — stable forever
  );

  const getState = useCallback(() => stateRef.current, []);

  return { registerHandlers, getState };
}
