/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

declare module '*.svg' {
  const content: string;
  export default content;
}
