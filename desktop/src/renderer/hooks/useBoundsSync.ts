import { useEffect, type RefObject } from "react";
import type { BrowserBounds } from "../../shared/types";

const OFF_SCREEN: BrowserBounds = { x: -10000, y: -10000, width: 1, height: 1 };

/**
 * Syncs an element's bounding rect to a WebContentsView via IPC,
 * using a ResizeObserver with requestAnimationFrame throttling.
 *
 * On mount: sends initial bounds.
 * On resize: sends updated bounds (rAF-throttled).
 * On unmount: moves the view off-screen.
 */
export function useBoundsSync(
  ref: RefObject<HTMLElement | null>,
  setBounds: (bounds: BrowserBounds) => void
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let rafId: number | null = null;

    const sendBounds = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);

      if (width < 10 || height < 10) {
        setBounds(OFF_SCREEN);
        return;
      }

      setBounds({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width,
        height,
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        sendBounds();
      });
    });

    resizeObserver.observe(el);
    sendBounds();

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      setBounds(OFF_SCREEN);
    };
  }, [ref, setBounds]);
}
