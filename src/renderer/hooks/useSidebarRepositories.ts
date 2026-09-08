import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../stores/appStore';

/** Keep the repository tree and keyboard navigation on the same filtered list. */
export function useSidebarRepositories() {
  const { repositories, showOnlyActiveRepositories, worktreeTabs, userTerminalTabs } = useAppStore(
    useShallow((state) => ({
      repositories: state.repositories,
      showOnlyActiveRepositories: state.settings.showOnlyActiveRepositories ?? false,
      worktreeTabs: state.worktreeTabs,
      userTerminalTabs: state.userTerminalTabs,
    }))
  );

  return useMemo(() => {
    if (!showOnlyActiveRepositories) return repositories;

    const sessionsWithTerminals = new Set(
      [...worktreeTabs, ...userTerminalTabs]
        .filter((session) => session.tabs.length > 0)
        .map((session) => session.worktreeSessionId)
    );

    return repositories.filter((repository) =>
      repository.worktreeSessions.some((session) => sessionsWithTerminals.has(session.id))
    );
  }, [repositories, showOnlyActiveRepositories, worktreeTabs, userTerminalTabs]);
}
