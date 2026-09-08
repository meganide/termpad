import { useCallback, useState } from 'react';

export type PanelScope = 'repository' | 'worktree';

// Tracks which of the two scope sections are collapsed within a right panel tab.
export function useCollapsibleScopes() {
  const [collapsed, setCollapsed] = useState<Record<PanelScope, boolean>>({
    repository: false,
    worktree: false,
  });

  const toggle = useCallback((scope: PanelScope) => {
    setCollapsed((prev) => ({ ...prev, [scope]: !prev[scope] }));
  }, []);

  return { collapsed, toggle };
}
