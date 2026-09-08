import { FileText, ListTodo, NotebookPen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type RightPanelTab = 'changes' | 'notes' | 'todos';

const TABS: { id: RightPanelTab; label: string; Icon: LucideIcon }[] = [
  { id: 'changes', label: 'Changes', Icon: FileText },
  { id: 'notes', label: 'Notes', Icon: NotebookPen },
  { id: 'todos', label: 'Todos', Icon: ListTodo },
];

interface RightPanelTabsProps {
  active: RightPanelTab;
  onChange: (tab: RightPanelTab) => void;
}

export function RightPanelTabs({ active, onChange }: RightPanelTabsProps) {
  return (
    <div role="tablist" className="flex items-center gap-1" data-testid="right-panel-tabs">
      {TABS.map(({ id, label, Icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            data-testid={`right-panel-tab-${id}`}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold transition-colors ${
              isActive
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-obsidian-800/60 hover:text-foreground'
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
