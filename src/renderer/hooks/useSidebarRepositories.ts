import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../stores/appStore';

/** Keep the repository tree and keyboard navigation on the same filtered list. */
export function useSidebarRepositories(searchQuery = '') {
  const { repositories, showOnlyActiveRepositories, worktreeTabs, userTerminalTabs } = useAppStore(
    useShallow((state) => ({
      repositories: state.repositories,
      showOnlyActiveRepositories: state.settings.showOnlyActiveRepositories ?? false,
      worktreeTabs: state.worktreeTabs,
      userTerminalTabs: state.userTerminalTabs,
    }))
  );

  return useMemo(() => {
    const sessionsWithTerminals = new Set(
      [...worktreeTabs, ...userTerminalTabs]
        .filter((session) => session.tabs.length > 0)
        .map((session) => session.worktreeSessionId)
    );

    const activeRepositories = showOnlyActiveRepositories
      ? repositories.filter((repository) =>
          repository.worktreeSessions.some((session) => sessionsWithTerminals.has(session.id))
        )
      : repositories;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return activeRepositories;

    return activeRepositories.flatMap((repository) => {
      const worktreeSessions = repository.name.toLowerCase().includes(query)
        ? repository.worktreeSessions
        : repository.worktreeSessions.filter((session) =>
            [session.label, session.worktreeName, session.branchName].some((name) =>
              name?.toLowerCase().includes(query)
            )
          );
      if (!worktreeSessions.length && !repository.name.toLowerCase().includes(query)) return [];

      // Reveal matching worktrees without changing the saved expansion state.
      return [{ ...repository, isExpanded: true, worktreeSessions }];
    });
  }, [repositories, showOnlyActiveRepositories, worktreeTabs, userTerminalTabs, searchQuery]);
}
