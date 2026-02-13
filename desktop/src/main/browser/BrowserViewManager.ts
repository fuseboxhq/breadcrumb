import { BrowserWindow, WebContentsView, shell } from "electron";
import {
  IPC_CHANNELS,
  BrowserBounds,
  BrowserNavigateEvent,
  BrowserLoadingChangeEvent,
  BrowserTitleChangeEvent,
  BrowserErrorEvent,
} from "../../shared/types";

/**
 * Manages a single embedded browser WebContentsView.
 *
 * The WebContentsView is a main-process overlay positioned on top of the
 * BrowserWindow. The renderer sends bounds via IPC (from ResizeObserver)
 * and this class applies them with setBounds(). Navigation events are
 * forwarded back to the renderer via IPC.
 */
export class BrowserViewManager {
  private view: WebContentsView | null = null;
  private mainWindow: BrowserWindow;
  private pendingBounds: BrowserBounds | null = null;
  private initialized = false;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * Create the browser WebContentsView with secure webPreferences.
   * Adds it to the main window's contentView as a child.
   */
  async create(): Promise<void> {
    if (this.view) return;

    this.view = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        partition: "persist:browser",
        devTools: true,
        allowRunningInsecureContent: false,
        webviewTag: false,
      },
    });

    // Add to window (last child = top of z-stack)
    this.mainWindow.contentView.addChildView(this.view);

    // Start off-screen until renderer sends bounds
    this.view.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });

    // Wire navigation events to forward to renderer
    this.setupNavigationEvents();

    // Intercept new window requests → open in system browser
    this.view.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: "deny" };
    });

    // Mark as initialized after delay (setBounds race condition workaround)
    this.initialized = false;
    setTimeout(() => {
      this.initialized = true;
      if (this.pendingBounds) {
        this.setBounds(this.pendingBounds);
        this.pendingBounds = null;
      }
    }, 50);
  }

  /**
   * Destroy the browser WebContentsView and clean up resources.
   */
  destroy(): void {
    if (!this.view) return;

    try {
      this.mainWindow.contentView.removeChildView(this.view);
    } catch {
      // View may already be removed
    }

    try {
      this.view.webContents.close();
    } catch {
      // WebContents may already be destroyed
    }

    this.view = null;
    this.initialized = false;
    this.pendingBounds = null;
  }

  /**
   * Navigate to a URL. Normalizes bare URLs with https:// prefix.
   */
  async navigate(url: string): Promise<void> {
    if (!this.view) return;

    // Normalize URL
    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      // Check if it looks like a localhost URL
      if (/^localhost/i.test(normalizedUrl) || /^127\.0\.0\.1/i.test(normalizedUrl)) {
        normalizedUrl = `http://${normalizedUrl}`;
      } else {
        normalizedUrl = `https://${normalizedUrl}`;
      }
    }

    await this.view.webContents.loadURL(normalizedUrl);
  }

  /**
   * Go back in navigation history.
   */
  goBack(): void {
    if (!this.view) return;
    if (this.view.webContents.navigationHistory.canGoBack()) {
      this.view.webContents.navigationHistory.goBack();
    }
  }

  /**
   * Go forward in navigation history.
   */
  goForward(): void {
    if (!this.view) return;
    if (this.view.webContents.navigationHistory.canGoForward()) {
      this.view.webContents.navigationHistory.goForward();
    }
  }

  /**
   * Reload the current page.
   */
  reload(): void {
    if (!this.view) return;
    this.view.webContents.reload();
  }

  /**
   * Set the bounds (position and size) of the WebContentsView.
   * If the view hasn't finished initializing, stores bounds to apply later.
   */
  setBounds(bounds: BrowserBounds): void {
    if (!this.view) return;

    if (!this.initialized) {
      this.pendingBounds = bounds;
      return;
    }

    this.view.setBounds({
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    });
  }

  /**
   * Hide the WebContentsView by moving it off-screen.
   * Preserves page state (no destroy/reload).
   */
  hide(): void {
    if (!this.view) return;
    this.view.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
  }

  /**
   * Open DevTools for the browser WebContentsView (detached mode).
   */
  openDevTools(): void {
    if (!this.view) return;
    this.view.webContents.openDevTools({ mode: "detach" });
  }

  /**
   * Close DevTools for the browser WebContentsView.
   */
  closeDevTools(): void {
    if (!this.view) return;
    if (this.view.webContents.isDevToolsOpened()) {
      this.view.webContents.closeDevTools();
    }
  }

  /**
   * Check whether the view exists.
   */
  isActive(): boolean {
    return this.view !== null;
  }

  /**
   * Get the underlying webContents (for DevTools integration in ahr.6).
   */
  getWebContents() {
    return this.view?.webContents ?? null;
  }

  /**
   * Wire up webContents navigation events to forward to the renderer via IPC.
   */
  private setupNavigationEvents(): void {
    if (!this.view) return;
    const wc = this.view.webContents;
    const sender = this.mainWindow.webContents;

    // Navigation completed
    wc.on("did-navigate", (_event, url) => {
      const data: BrowserNavigateEvent = {
        url,
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      };
      sender.send(IPC_CHANNELS.BROWSER_NAVIGATE_EVENT, data);
    });

    // In-page navigation (hash changes, pushState)
    wc.on("did-navigate-in-page", (_event, url) => {
      const data: BrowserNavigateEvent = {
        url,
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      };
      sender.send(IPC_CHANNELS.BROWSER_NAVIGATE_EVENT, data);
    });

    // Loading states
    wc.on("did-start-loading", () => {
      const data: BrowserLoadingChangeEvent = { isLoading: true };
      sender.send(IPC_CHANNELS.BROWSER_LOADING_CHANGE, data);
    });

    wc.on("did-stop-loading", () => {
      const data: BrowserLoadingChangeEvent = { isLoading: false };
      sender.send(IPC_CHANNELS.BROWSER_LOADING_CHANGE, data);
    });

    // Page title
    wc.on("page-title-updated", (_event, title) => {
      const data: BrowserTitleChangeEvent = { title };
      sender.send(IPC_CHANNELS.BROWSER_TITLE_CHANGE, data);
    });

    // Load failures
    wc.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) return;
      const data: BrowserErrorEvent = {
        errorCode,
        errorDescription,
        validatedURL,
      };
      sender.send(IPC_CHANNELS.BROWSER_ERROR, data);
    });
  }
}
