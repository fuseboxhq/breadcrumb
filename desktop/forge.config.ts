import type { ForgeConfig } from "@electron-forge/shared-types";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: "**/node_modules/node-pty/build/Release/**",
    },
    name: "Breadcrumb",
    executableName: "breadcrumb",
    icon: "./assets/icon",
    appBundleId: "com.breadcrumb.desktop",
    appCategoryType: "public.app-category.developer-tools",
    appCopyright: "Copyright 2026 Breadcrumb",
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "Breadcrumb",
        setupIcon: "./assets/icon.ico",
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
        icon: "./assets/icon.icns",
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
