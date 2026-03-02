import { useWorkspaceStore } from '../features/workspace/store';
import { cn } from '../lib/utils';

const TAB_NAMES: Record<string, string> = {
  'task-1': 'Task 1',
  'task-2': 'Task 2',
};

export function TabBar() {
  const { tabs, activeTab, setActiveTab } = useWorkspaceStore();

  return (
    <div className="flex gap-1">
      {tabs.map((tabId) => (
        <button
          key={tabId}
          onClick={() => setActiveTab(tabId)}
          className={cn(
            'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            activeTab === tabId
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          {TAB_NAMES[tabId] || tabId}
        </button>
      ))}
    </div>
  );
}
