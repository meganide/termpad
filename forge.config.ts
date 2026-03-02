import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip'; // macOS only - needed for auto-update
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerAppImage } from '@reforged/maker-appimage';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { PublisherGithub } from '@electron-forge/publisher-github';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import * as fs from 'fs';
import * as path from 'path';

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
const version = packageJson.version;

// Copy a module from node_modules to the build path
function copyModule(moduleName: string, buildPath: string) {
  const src = path.join(__dirname, 'node_modules', moduleName);
  const dest = path.join(buildPath, 'node_modules', moduleName);

  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
    console.log(`Copied ${moduleName} to`, dest);
  }
}

// Copy native modules and their dependencies to the packaged app
function copyNativeModules(buildPath: string) {
  // Copy node-pty (native terminal module)
  copyModule('node-pty', buildPath);

  // Copy js-yaml (needed by electron-updater)
  copyModule('js-yaml', buildPath);

  // Copy node-notifier and its dependencies (includes SnoreToast.exe for Windows)
  const nodeNotifierDeps = [
    'node-notifier',
    'growly',
    'is-wsl',
    'is-docker',
    'semver',
    'shellwords',
    'uuid',
    'which',
    'isexe',
  ];

  for (const dep of nodeNotifierDeps) {
    copyModule(dep, buildPath);
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    executableName: 'termpad',
    icon: './src/renderer/assets/icons/app-icon',
    extraResource: ['./src/renderer/assets/icons/app-icon.png', './app-update.yml'],
    asar: {
      unpack:
        '**/node_modules/{node-pty,node-notifier,growly,is-wsl,is-docker,semver,shellwords,uuid,which,isexe,js-yaml}/**',
    },
    afterCopy: [
      (buildPath, _electronVersion, _platform, _arch, callback) => {
        copyNativeModules(buildPath);
        callback();
      },
    ],
    // Set the app ID for Windows notifications (must match MakerSquirrel name)
    appBundleId: 'com.termpad.app',
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel(
      (arch) => ({
        // Consistent name for AUMID - used by Windows for notification identity
        name: 'Termpad',
        setupExe: `Termpad-Setup-${version}-${arch}.exe`,
        iconUrl:
          'https://raw.githubusercontent.com/meganide/termpad/main/src/renderer/assets/icons/app-icon.ico',
        setupIcon: './src/renderer/assets/icons/app-icon.ico',
      }),
      ['win32']
    ),
    new MakerZIP({}, ['darwin']), // Required for macOS auto-update (Squirrel.Mac)
    new MakerDMG(
      {
        format: 'ULFO',
      },
      ['darwin']
    ),
    new MakerRpm(
      {
        options: {
          icon: './src/renderer/assets/icons/app-icon.png',
          categories: ['Development', 'Utility'],
        },
      },
      ['linux']
    ),
    new MakerDeb(
      {
        options: {
          icon: './src/renderer/assets/icons/app-icon.png',
          categories: ['Development', 'Utility'],
          section: 'devel',
        },
      },
      ['linux']
    ),
    new MakerAppImage(
      {
        options: {
          icon: './src/renderer/assets/icons/app-icon.png',
          categories: ['Development', 'Utility'],
        },
      },
      ['linux']
    ),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.mts',
          target: 'main',
        },
        {
          entry: 'src/preload/preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
        {
          name: 'diff_window',
          config: 'vite.diff-window.config.mts',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: 'meganide',
        name: 'termpad',
      },
      prerelease: false,
      draft: true,
    }),
  ],
};

export default config;
