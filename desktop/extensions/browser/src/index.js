/**
 * Browser Extension for Breadcrumb IDE.
 *
 * Contributes browser commands to the command palette. The actual browser
 * rendering is handled by core infrastructure (BrowserPanel, BrowserViewManager).
 * This extension triggers breadcrumb.browser.open() which signals the renderer
 * to create a browser tab in the right panel.
 */

function activate(context) {
  console.log("[Browser Extension] activating...");

  const openCmd = breadcrumb.commands.registerCommand("open", async () => {
    await breadcrumb.browser.open();
    return { success: true };
  });

  const openUrlCmd = breadcrumb.commands.registerCommand(
    "openUrl",
    async (url) => {
      if (!url) {
        const result = await breadcrumb.window.showInputModal({
          title: "Open URL",
          description: "Enter a URL to open in the embedded browser",
          fields: [
            {
              id: "url",
              type: "text",
              label: "URL",
              placeholder: "http://localhost:3000",
              required: true,
            },
          ],
          submitLabel: "Open",
        });
        if (!result) return { cancelled: true };
        url = result.url;
      }
      await breadcrumb.browser.open(url);
      return { success: true };
    }
  );

  context.subscriptions.push(openCmd, openUrlCmd);
  console.log("[Browser Extension] activated with 2 commands");
}

function deactivate() {
  console.log("[Browser Extension] deactivated");
}

module.exports = { activate, deactivate };
