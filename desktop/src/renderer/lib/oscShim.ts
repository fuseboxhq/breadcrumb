/**
 * OSC Parser Shim — intercepts raw PTY data to detect OSC sequences
 * before they reach the terminal emulator.
 *
 * ghostty-web doesn't expose `parser.registerOscHandler()` like xterm.js.
 * This shim scans the data stream for OSC 133 (shell integration) and
 * OSC 7 (working directory) sequences, fires callbacks, and passes
 * the data through unchanged.
 *
 * Handles sequences that span write() boundaries via internal buffering.
 *
 * OSC format: ESC ] <id> ; <payload> (BEL | ST)
 * Where ST = ESC \
 */

type OscCallback = (data: string) => void;

const enum State {
  Normal,
  EscSeen,       // Got ESC (0x1B), waiting for ]
  OscCollecting, // Inside OSC payload, waiting for BEL (0x07) or ST (ESC \)
  OscEscSeen,    // Inside OSC payload, got ESC, waiting for \ (ST terminator)
}

export class OscShim {
  private state = State.Normal;
  private oscBuffer = "";
  private handlers = new Map<number, OscCallback[]>();

  /** Register a handler for a specific OSC id (e.g., 133, 7) */
  on(oscId: number, callback: OscCallback): () => void {
    let list = this.handlers.get(oscId);
    if (!list) {
      list = [];
      this.handlers.set(oscId, list);
    }
    list.push(callback);
    return () => {
      const idx = list!.indexOf(callback);
      if (idx >= 0) list!.splice(idx, 1);
    };
  }

  /**
   * Process a chunk of PTY output data. Scans for OSC sequences and
   * fires registered callbacks. Returns the data unchanged — the
   * terminal still receives everything (it may also parse the same
   * sequences internally, which is fine).
   */
  process(data: string): string {
    for (let i = 0; i < data.length; i++) {
      const ch = data.charCodeAt(i);

      switch (this.state) {
        case State.Normal:
          if (ch === 0x1b) {
            this.state = State.EscSeen;
          }
          break;

        case State.EscSeen:
          if (ch === 0x5d) {
            // ] — start of OSC
            this.state = State.OscCollecting;
            this.oscBuffer = "";
          } else {
            // Not an OSC, back to normal
            this.state = State.Normal;
          }
          break;

        case State.OscCollecting:
          if (ch === 0x07) {
            // BEL — OSC terminator
            this.dispatchOsc(this.oscBuffer);
            this.state = State.Normal;
          } else if (ch === 0x1b) {
            // Possible ST (ESC \)
            this.state = State.OscEscSeen;
          } else {
            this.oscBuffer += data[i];
          }
          break;

        case State.OscEscSeen:
          if (ch === 0x5c) {
            // \ — ST terminator (ESC \)
            this.dispatchOsc(this.oscBuffer);
          }
          // Either way, back to normal (if it wasn't \, the ESC is consumed)
          this.state = State.Normal;
          break;
      }
    }

    return data;
  }

  private dispatchOsc(payload: string): void {
    // Parse "id;rest" or just "id"
    const semicolonIdx = payload.indexOf(";");
    const idStr = semicolonIdx >= 0 ? payload.substring(0, semicolonIdx) : payload;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return;

    const rest = semicolonIdx >= 0 ? payload.substring(semicolonIdx + 1) : "";
    const callbacks = this.handlers.get(id);
    if (callbacks) {
      for (const cb of callbacks) {
        cb(rest);
      }
    }
  }

  /** Reset parser state (e.g., on terminal reconnect) */
  reset(): void {
    this.state = State.Normal;
    this.oscBuffer = "";
  }

  dispose(): void {
    this.handlers.clear();
    this.reset();
  }
}
