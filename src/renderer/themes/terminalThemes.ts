/**
 * Terminal color theme definitions for xterm.js
 * Each theme provides all 22 required color properties
 */

export interface TerminalTheme {
  name: string;
  displayName: string;
  type: 'dark' | 'light';
  colors: {
    background: string;
    foreground: string;
    cursor: string;
    cursorAccent: string;
    selectionBackground: string;
    selectionForeground: string;
    selectionInactiveBackground: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    brightBlack: string;
    brightRed: string;
    brightGreen: string;
    brightYellow: string;
    brightBlue: string;
    brightMagenta: string;
    brightCyan: string;
    brightWhite: string;
  };
}

export const TERMINAL_THEMES: TerminalTheme[] = [
  // Termpad themes (default) - matches app obsidian & neon lime color palette
  {
    name: 'termpad',
    displayName: 'Termpad',
    type: 'dark',
    colors: {
      background: '#181818',
      foreground: '#e4e4e4',
      cursor: '#ccff00',
      cursorAccent: '#181818',
      selectionBackground: '#ccff0020',
      selectionForeground: '#f5f5f5',
      selectionInactiveBackground: '#ccff0012',
      black: '#242424',
      red: '#f87171',
      green: '#4ade80',
      yellow: '#fbbf24',
      blue: '#60a5fa',
      magenta: '#c084fc',
      cyan: '#22d3ee',
      white: '#d4d4d4',
      brightBlack: '#5c5c5c',
      brightRed: '#fca5a5',
      brightGreen: '#86efac',
      brightYellow: '#fcd34d',
      brightBlue: '#93c5fd',
      brightMagenta: '#d8b4fe',
      brightCyan: '#67e8f9',
      brightWhite: '#fafafa',
    },
  },
  // Dark themes
  {
    name: 'dracula',
    displayName: 'Dracula',
    type: 'dark',
    colors: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2',
      cursorAccent: '#282a36',
      selectionBackground: '#44475a80',
      selectionForeground: '#f8f8f2',
      selectionInactiveBackground: '#44475a50',
      black: '#21222c',
      red: '#6e3a3a',
      green: '#3a5c42',
      yellow: '#8a7040',
      blue: '#4a5080',
      magenta: '#6a4060',
      cyan: '#406060',
      white: '#f8f8f2',
      brightBlack: '#6272a4',
      brightRed: '#8a4a4a',
      brightGreen: '#4a6c52',
      brightYellow: '#9a8050',
      brightBlue: '#5a6090',
      brightMagenta: '#7a5070',
      brightCyan: '#507070',
      brightWhite: '#ffffff',
    },
  },
  {
    name: 'one-dark',
    displayName: 'One Dark',
    type: 'dark',
    colors: {
      background: '#282c34',
      foreground: '#abb2bf',
      cursor: '#528bff',
      cursorAccent: '#282c34',
      selectionBackground: '#3e445180',
      selectionForeground: '#abb2bf',
      selectionInactiveBackground: '#3e445150',
      black: '#282c34',
      red: '#b85a63',
      green: '#7a9e64',
      yellow: '#c9a566',
      blue: '#5591c9',
      magenta: '#a565b8',
      cyan: '#4a9aa5',
      white: '#abb2bf',
      brightBlack: '#5c6370',
      brightRed: '#c76a73',
      brightGreen: '#8aae74',
      brightYellow: '#d4b576',
      brightBlue: '#65a1d9',
      brightMagenta: '#b575c8',
      brightCyan: '#5aaab5',
      brightWhite: '#ffffff',
    },
  },
  {
    name: 'tokyo-night',
    displayName: 'Tokyo Night',
    type: 'dark',
    colors: {
      background: '#1a1b26',
      foreground: '#a9b1d6',
      cursor: '#c0caf5',
      cursorAccent: '#1a1b26',
      selectionBackground: '#33467c80',
      selectionForeground: '#c0caf5',
      selectionInactiveBackground: '#33467c50',
      black: '#15161e',
      red: '#c75f73',
      green: '#7fa858',
      yellow: '#c49558',
      blue: '#6688cc',
      magenta: '#9a7fcc',
      cyan: '#68aad4',
      white: '#a9b1d6',
      brightBlack: '#414868',
      brightRed: '#d46f83',
      brightGreen: '#8fb868',
      brightYellow: '#d4a568',
      brightBlue: '#7698dc',
      brightMagenta: '#aa8fdc',
      brightCyan: '#78bae4',
      brightWhite: '#c0caf5',
    },
  },
  {
    name: 'catppuccin-mocha',
    displayName: 'Catppuccin Mocha',
    type: 'dark',
    colors: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      cursorAccent: '#1e1e2e',
      selectionBackground: '#45475a80',
      selectionForeground: '#cdd6f4',
      selectionInactiveBackground: '#45475a50',
      black: '#45475a',
      red: '#c47088',
      green: '#85b883',
      yellow: '#d4bf8f',
      blue: '#7399cc',
      magenta: '#c9a0bc',
      cyan: '#7abfb3',
      white: '#bac2de',
      brightBlack: '#585b70',
      brightRed: '#d48098',
      brightGreen: '#95c893',
      brightYellow: '#e4cf9f',
      brightBlue: '#83a9dc',
      brightMagenta: '#d9b0cc',
      brightCyan: '#8acfc3',
      brightWhite: '#a6adc8',
    },
  },
  {
    name: 'nord',
    displayName: 'Nord',
    type: 'dark',
    colors: {
      background: '#2e3440',
      foreground: '#d8dee9',
      cursor: '#d8dee9',
      cursorAccent: '#2e3440',
      selectionBackground: '#434c5e80',
      selectionForeground: '#eceff4',
      selectionInactiveBackground: '#434c5e50',
      black: '#3b4252',
      red: '#a35459',
      green: '#87a074',
      yellow: '#c9ad76',
      blue: '#6d8aa6',
      magenta: '#987893',
      cyan: '#74a5b3',
      white: '#e5e9f0',
      brightBlack: '#4c566a',
      brightRed: '#b36469',
      brightGreen: '#97b084',
      brightYellow: '#d9bd86',
      brightBlue: '#7d9ab6',
      brightMagenta: '#a888a3',
      brightCyan: '#84b5c3',
      brightWhite: '#eceff4',
    },
  },
  {
    name: 'gruvbox-dark',
    displayName: 'Gruvbox Dark',
    type: 'dark',
    colors: {
      background: '#282828',
      foreground: '#ebdbb2',
      cursor: '#ebdbb2',
      cursorAccent: '#282828',
      selectionBackground: '#50494580',
      selectionForeground: '#ebdbb2',
      selectionInactiveBackground: '#50494550',
      black: '#282828',
      red: '#a64038',
      green: '#7a7a2e',
      yellow: '#b38030',
      blue: '#4a7578',
      magenta: '#8f5570',
      cyan: '#5a8560',
      white: '#a89984',
      brightBlack: '#928374',
      brightRed: '#c65a4a',
      brightGreen: '#959632',
      brightYellow: '#cfa045',
      brightBlue: '#6a9598',
      brightMagenta: '#af7590',
      brightCyan: '#7aa580',
      brightWhite: '#ebdbb2',
    },
  },
  {
    name: 'vscode-dark',
    displayName: 'VS Code Dark+',
    type: 'dark',
    colors: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#aeafad',
      cursorAccent: '#1e1e1e',
      selectionBackground: '#264f7880',
      selectionForeground: '#ffffff',
      selectionInactiveBackground: '#264f7850',
      black: '#000000',
      red: '#a64040',
      green: '#2a9668',
      yellow: '#b8a830',
      blue: '#3a6aa0',
      magenta: '#964096',
      cyan: '#2a8aa6',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#c65050',
      brightGreen: '#3aa678',
      brightYellow: '#c8b840',
      brightBlue: '#4a7ab0',
      brightMagenta: '#a650a6',
      brightCyan: '#3a9ab6',
      brightWhite: '#e5e5e5',
    },
  },
];

/**
 * Default theme to use when none is specified or when an invalid theme name is given
 */
export const DEFAULT_THEME_NAME = 'termpad';

/**
 * Get the default terminal theme (termpad)
 * @returns The termpad theme object
 */
export function getTerminalTheme(): TerminalTheme {
  return TERMINAL_THEMES.find((t) => t.name === DEFAULT_THEME_NAME) ?? TERMINAL_THEMES[0];
}
