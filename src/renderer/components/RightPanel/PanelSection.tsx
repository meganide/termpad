import type { ReactNode } from 'react';

interface PanelSectionProps {
  label: string;
  /** Rendered at the right of the header, e.g. a completed count */
  headerAccessory?: ReactNode;
  children: ReactNode;
}

// A scope title and its always-visible content, shared by Todos and Notes.
export function PanelSection({ label, headerAccessory, children }: PanelSectionProps) {
  return (
    <div className="flex flex-1 flex-col gap-1.5 min-h-0">
      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 flex-1 truncate px-1 py-0.5 text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </h2>
        {headerAccessory}
      </div>

      <div className="flex flex-1 min-h-0 flex-col gap-1.5">{children}</div>
    </div>
  );
}
