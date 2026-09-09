import { create } from 'zustand';

export interface RunningBrowserTab {
  id: string;
  repositoryId: string;
  title: string;
  url: string;
  webContentsId?: number;
  select: () => void;
  close: () => void;
}

// BrowserPanel owns page lifetimes. This registry exposes those live pages to
// Performance without creating a second source of truth for tab state.
export const useBrowserRegistry = create<{
  tabs: RunningBrowserTab[];
  replace: (repositoryId: string, tabs: RunningBrowserTab[]) => void;
}>((set) => ({
  tabs: [],
  replace: (repositoryId, tabs) =>
    set((state) => ({
      tabs: [...state.tabs.filter((tab) => tab.repositoryId !== repositoryId), ...tabs],
    })),
}));
