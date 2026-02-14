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
  private devToolsView: WebContentsView | null = null;
  private mainWindow: BrowserWindow;
  private pendingBounds: BrowserBounds | null = null;
  private initialized = false;
  private lastBounds: BrowserBounds | null = null;

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

    // Mark as initialized once DOM is ready (deterministic vs arbitrary timeout).
    // Apply any bounds that arrived before or during creation.
    this.initialized = false;
    this.view.webContents.once("dom-ready", () => {
      this.initialized = true;
      if (this.pendingBounds) {
        this.applyBounds(this.pendingBounds);
        this.pendingBounds = null;
      }
    });
  }

  /**
   * Destroy the browser WebContentsView and clean up resources.
   * Also destroys DevTools view if open.
   */
  destroy(): void {
    // Destroy DevTools first
    this.destroyDevToolsView();

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
    this.lastBounds = null;
  }

  /**
   * Navigate to a URL. Normalizes bare URLs with https:// prefix.
   * Catches loadURL errors gracefully — errors are reported via did-fail-load event.
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

    try {
      await this.view.webContents.loadURL(normalizedUrl);
    } catch {
      // loadURL rejects on network errors. The did-fail-load event
      // also fires and sends the error to the renderer via IPC.
      // We don't re-throw so the IPC handler always returns success.
    }
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
   * Stores as pending if the view hasn't been created or initialized yet.
   */
  setBounds(bounds: BrowserBounds): void {
    // Store bounds even when view doesn't exist yet — they'll be applied
    // when the initialization timer fires after create().
    if (!this.view || !this.initialized) {
      this.pendingBounds = bounds;
      return;
    }
    this.applyBounds(bounds);
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
   * Show the WebContentsView at last known bounds (after hiding).
   */
  show(): void {
    if (!this.view || !this.lastBounds) return;
    this.applyBounds(this.lastBounds);
  }

  /**
   * Open DevTools in a dedicated WebContentsView.
   * Lazily creates a pristine (never-navigated) view, sets it as the DevTools
   * target via setDevToolsWebContents(), then opens in detach mode so Electron
   * doesn't manage positioning (we handle it via setBounds from renderer).
   */
  openDevTools(): void {
    if (!this.view) return;

    // Already open
    if (this.devToolsView && this.view.webContents.isDevToolsOpened()) return;

    // Must create a fresh pristine view each time — DevTools WebContents
    // cannot have navigated before setDevToolsWebContents()
    this.destroyDevToolsView();

    this.devToolsView = new WebContentsView({
      webPreferences: {
        devTools: false, // DevTools of DevTools not needed
      },
    });

    // Add to window (on top of browser view)
    this.mainWindow.contentView.addChildView(this.devToolsView);

    // Start off-screen until renderer sends bounds
    this.devToolsView.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });

    // Point browser's DevTools to render in our dedicated view
    this.view.webContents.setDevToolsWebContents(this.devToolsView.webContents);
    this.view.webContents.openDevTools({ mode: "detach" });
  }

  /**
   * Close DevTools and destroy the DevTools WebContentsView.
   */
  closeDevTools(): void {
    if (this.view?.webContents.isDevToolsOpened()) {
      this.view.webContents.closeDevTools();
    }
    this.destroyDevToolsView();
  }

  /**
   * Set the bounds for the DevTools WebContentsView.
   */
  setDevToolsBounds(bounds: BrowserBounds): void {
    if (!this.devToolsView) return;

    this.devToolsView.setBounds({
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    });
  }

  /**
   * Check whether the view exists.
   */
  isActive(): boolean {
    return this.view !== null;
  }

  /**
   * Actually apply bounds to the view. Stores as lastBounds for show().
   */
  private applyBounds(bounds: BrowserBounds): void {
    if (!this.view) return;

    const rounded = {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    };

    this.lastBounds = rounded;
    this.view.setBounds(rounded);
  }

  /**
   * Destroy the DevTools WebContentsView and clean up.
   */
  private destroyDevToolsView(): void {
    if (!this.devToolsView) return;

    try {
      this.mainWindow.contentView.removeChildView(this.devToolsView);
    } catch {
      // May already be removed
    }

    try {
      this.devToolsView.webContents.close();
    } catch {
      // May already be destroyed
    }

    this.devToolsView = null;
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
