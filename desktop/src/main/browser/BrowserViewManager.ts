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
 * Manages a single embedded browser WebContentsView instance.
 *
 * Each instance is identified by a `browserId` and owns one WebContentsView.
 * Multiple instances can coexist in the same BrowserWindow — the
 * BrowserRegistry (in browserIpc.ts) manages the collection.
 */
export class BrowserViewManager {
  private view: WebContentsView | null = null;
  private devToolsView: WebContentsView | null = null;
  private mainWindow: BrowserWindow;
  private pendingBounds: BrowserBounds | null = null;
  private initialized = false;
  private lastBounds: BrowserBounds | null = null;

  readonly browserId: string;

  constructor(mainWindow: BrowserWindow, browserId: string) {
    this.mainWindow = mainWindow;
    this.browserId = browserId;
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
   */
  async navigate(url: string): Promise<void> {
    if (!this.view) return;

    // Normalize URL
    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
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
    }
  }

  goBack(): void {
    if (!this.view) return;
    if (this.view.webContents.navigationHistory.canGoBack()) {
      this.view.webContents.navigationHistory.goBack();
    }
  }

  goForward(): void {
    if (!this.view) return;
    if (this.view.webContents.navigationHistory.canGoForward()) {
      this.view.webContents.navigationHistory.goForward();
    }
  }

  reload(): void {
    if (!this.view) return;
    this.view.webContents.reload();
  }

  /**
   * Set the bounds of the WebContentsView.
   * Stores as pending if the view hasn't been initialized yet.
   */
  setBounds(bounds: BrowserBounds): void {
    if (!this.view || !this.initialized) {
      this.pendingBounds = bounds;
      return;
    }
    this.applyBounds(bounds);
  }

  /**
   * Hide the WebContentsView by moving it off-screen.
   */
  hide(): void {
    if (!this.view) return;
    this.view.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
  }

  /**
   * Show the WebContentsView at last known bounds.
   */
  show(): void {
    if (!this.view || !this.lastBounds) return;
    this.applyBounds(this.lastBounds);
  }

  /**
   * Bring this view to the top of the z-stack by re-adding it.
   */
  bringToFront(): void {
    if (!this.view) return;
    try {
      this.mainWindow.contentView.removeChildView(this.view);
      this.mainWindow.contentView.addChildView(this.view);
    } catch {
      // View may have been destroyed
    }
  }

  /**
   * Open DevTools in a dedicated WebContentsView.
   */
  openDevTools(): void {
    if (!this.view) return;
    if (this.devToolsView && this.view.webContents.isDevToolsOpened()) return;

    this.destroyDevToolsView();

    this.devToolsView = new WebContentsView({
      webPreferences: {
        devTools: false,
      },
    });

    this.mainWindow.contentView.addChildView(this.devToolsView);
    this.devToolsView.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });

    this.view.webContents.setDevToolsWebContents(this.devToolsView.webContents);
    this.view.webContents.openDevTools({ mode: "detach" });
  }

  closeDevTools(): void {
    if (this.view?.webContents.isDevToolsOpened()) {
      this.view.webContents.closeDevTools();
    }
    this.destroyDevToolsView();
  }

  setDevToolsBounds(bounds: BrowserBounds): void {
    if (!this.devToolsView) return;

    this.devToolsView.setBounds({
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    });
  }

  isActive(): boolean {
    return this.view !== null;
  }

  /**
   * Get the current URL of the browser view.
   */
  getCurrentUrl(): string {
    if (!this.view) return "";
    return this.view.webContents.getURL();
  }

  /**
   * Get the current page title.
   */
  getTitle(): string {
    if (!this.view) return "";
    return this.view.webContents.getTitle();
  }

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
   * Wire up webContents navigation events to forward to the renderer.
   * All events include this instance's `browserId` for routing.
   */
  private setupNavigationEvents(): void {
    if (!this.view) return;
    const wc = this.view.webContents;
    const sender = this.mainWindow.webContents;

    wc.on("did-navigate", (_event, url) => {
      const data: BrowserNavigateEvent = {
        browserId: this.browserId,
        url,
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      };
      sender.send(IPC_CHANNELS.BROWSER_NAVIGATE_EVENT, data);
    });

    wc.on("did-navigate-in-page", (_event, url) => {
      const data: BrowserNavigateEvent = {
        browserId: this.browserId,
        url,
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      };
      sender.send(IPC_CHANNELS.BROWSER_NAVIGATE_EVENT, data);
    });

    wc.on("did-start-loading", () => {
      const data: BrowserLoadingChangeEvent = { browserId: this.browserId, isLoading: true };
      sender.send(IPC_CHANNELS.BROWSER_LOADING_CHANGE, data);
    });

    wc.on("did-stop-loading", () => {
      const data: BrowserLoadingChangeEvent = { browserId: this.browserId, isLoading: false };
      sender.send(IPC_CHANNELS.BROWSER_LOADING_CHANGE, data);
    });

    wc.on("page-title-updated", (_event, title) => {
      const data: BrowserTitleChangeEvent = { browserId: this.browserId, title };
      sender.send(IPC_CHANNELS.BROWSER_TITLE_CHANGE, data);
    });

    wc.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) return;
      const data: BrowserErrorEvent = {
        browserId: this.browserId,
        errorCode,
        errorDescription,
        validatedURL,
      };
      sender.send(IPC_CHANNELS.BROWSER_ERROR, data);
    });
  }
}
