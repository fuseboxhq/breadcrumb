import type { ForgeConfig } from "@electron-forge/shared-types";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import path from "path";
import { execSync } from "child_process";
import fs from "fs";

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: "**/node_modules/node-pty/**",
    },
    name: "Breadcrumb",
    executableName: "breadcrumb",
    icon: path.resolve(process.cwd(), "assets", "icon"),
    appBundleId: "com.breadcrumb.desktop",
    appCategoryType: "public.app-category.developer-tools",
    appCopyright: "Copyright 2026 Breadcrumb",
  },
  rebuildConfig: {},
  hooks: {
    // Re-install native modules after Forge prunes node_modules.
    // The Vite plugin bundles JS but marks native modules as external,
    // so they must exist as real node_modules in the packaged app.
    packageAfterPrune: async (_forgeConfig, buildPath) => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(buildPath, "package.json"), "utf-8")
      );
      // Only install native dependencies that Vite marked as external
      const nativeDeps = ["node-pty", "electron-store"];
      const depsToInstall = nativeDeps.filter(
        (dep) => packageJson.dependencies?.[dep]
      );

      if (depsToInstall.length > 0) {
        execSync(
          `npm install --no-save --omit=dev ${depsToInstall.join(" ")}`,
          {
            cwd: buildPath,
            stdio: "inherit",
          }
        );
      }
    },
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "Breadcrumb",
        setupIcon: path.resolve(process.cwd(), "assets", "icon.ico"),
        authors: "Breadcrumb",
        description: "Breadcrumb Desktop IDE",
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-dmg",
      config: {
        format: "ULFO",
        icon: path.resolve(process.cwd(), "assets", "icon.icns"),
        contents: [
          { x: 130, y: 220, type: "file", path: "" },
          { x: 410, y: 220, type: "link", path: "/Applications" },
        ],
        additionalDMGOptions: {
          window: {
            size: { width: 540, height: 380 },
          },
        },
      },
    },
    {
      name: "@electron-forge/maker-deb",
      config: {},
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {},
    },
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main/index.ts",
          config: "vite.main.config.ts",
        },
        {
          entry: "src/main/extensions/extensionHostWorker.ts",
          config: "vite.main.config.ts",
        },
        {
          entry: "src/preload/index.ts",
          config: "vite.preload.config.ts",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      // Disabled: node-pty's spawn-helper executable must load from outside
      // ASAR. auto-unpack-natives handles .node files but not executables.
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
};

export default config;
