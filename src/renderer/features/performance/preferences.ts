export const PERFORMANCE_TABS = ['all', 'terminal', 'process', 'browser', 'app', 'ports'] as const;
export type PerformanceTab = (typeof PERFORMANCE_TABS)[number];
const TAB_STORAGE_KEY = 'termpad-performance-tab';

export function readPerformanceTab(): PerformanceTab {
  try {
    const stored = localStorage.getItem(TAB_STORAGE_KEY);
    return PERFORMANCE_TABS.find((tab) => tab === stored) ?? 'all';
  } catch {
    return 'all';
  }
}

export function savePerformanceTab(tab: PerformanceTab): void {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    // The view remains usable when browser storage is unavailable.
  }
}
