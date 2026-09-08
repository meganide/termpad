import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

interface PanelSectionProps {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  /** Rendered at the right of the header, e.g. a completed count */
  headerAccessory?: ReactNode;
  children: ReactNode;
}

// A labelled section of the right panel. Collapsing one lets the sibling
// section take the freed height, so a scope can be worked on exclusively.
export function PanelSection({
  label,
  collapsed,
  onToggle,
  headerAccessory,
  children,
}: PanelSectionProps) {
  return (
    <div className={`flex flex-col gap-1.5 min-h-0 ${collapsed ? 'shrink-0' : 'flex-1'}`}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-1 rounded-lg px-1 py-0.5 text-left hover:bg-obsidian-800/60"
        >
          <ChevronDown
            aria-hidden
            className={`size-3 shrink-0 text-muted-foreground transition-transform ${
              collapsed ? '-rotate-90' : ''
            }`}
          />
          <span className="truncate text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </span>
        </button>
        {headerAccessory}
      </div>

      {!collapsed && <div className="flex flex-1 min-h-0 flex-col gap-1.5">{children}</div>}
    </div>
  );
}
