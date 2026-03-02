import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserTerminalSection } from './UserTerminalSection';
import { useAppStore } from '../../stores/appStore';
import {
  resetAllStores,
  createMockRepository,
  createMockWorktreeSession,
} from '../../../../tests/utils';

// Mock the SplitButton component
vi.mock('../../components/ui/split-button', () => ({
  SplitButton: ({
    label,
    icon,
    onClick,
    disabled,
    items,
    onItemSelect,
    'data-testid': testId,
  }: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    items: Array<{ id: string; label: string; selected?: boolean }>;
    onItemSelect: (id: string) => void;
    'data-testid'?: string;
  }) => (
    <div data-testid={testId || 'split-button'}>
      <button data-testid="run-button-main" onClick={onClick} disabled={disabled}>
        {icon && <span data-testid="run-button-icon">{icon}</span>}
        {label}
      </button>
      <div data-testid="run-button-dropdown">
        {items.map((item) => (
          <button
            key={item.id}
            data-testid={`script-item-${item.id}`}
            data-selected={item.selected}
            onClick={() => onItemSelect(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  ),
}));

// Mock the Tooltip components
vi.mock('../../components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <>{children}</>
  ),
}));

describe('UserTerminalSection', () => {
  const mockRepository = createMockRepository({
    id: 'repo-1',
    name: 'Test Repo',
    path: '/test/repo',
  });

  const mockWorktreeSession = createMockWorktreeSession({
    id: 'session-1',
    label: 'Main Worktree',
    path: '/test/repo/worktree-1',
  });

  // Default props for all tests
  const defaultProps = {
    worktreeSessionId: mockWorktreeSession.id,
    repositoryId: mockRepository.id,
  };

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    // Set up repository with worktree session
    mockRepository.worktreeSessions = [mockWorktreeSession];
    useAppStore.setState({
      repositories: [mockRepository],
      isInitialized: true,
    });
  });

  describe('rendering', () => {
    it('renders the user terminal section with test id', () => {
      render(<UserTerminalSection {...defaultProps} />);

      expect(screen.getByTestId('user-terminal-section')).toBeInTheDocument();
    });

    it('renders the + button for adding new terminals', () => {
      render(<UserTerminalSection {...defaultProps} />);

      expect(screen.getByTestId('user-terminal-add-button')).toBeInTheDocument();
    });

    it('renders the Run split button with Play icon', () => {
      render(<UserTerminalSection {...defaultProps} />);

      expect(screen.getByTestId('run-button-main')).toBeInTheDocument();
      expect(screen.getByTestId('run-button-main')).toHaveTextContent('Run');
      expect(screen.getByTestId('run-button-icon')).toBeInTheDocument();
    });
  });

  describe('+ button behavior', () => {
    it('instantly spawns a new terminal when clicked', async () => {
      render(<UserTerminalSection {...defaultProps} />);

      const addButton = screen.getByTestId('user-terminal-add-button');

      await act(async () => {
        fireEvent.click(addButton);
      });

      // Check that a user tab was created
      const state = useAppStore.getState();
      const userTabs = state.getUserTabsForWorktree(mockWorktreeSession.id);
      expect(userTabs.length).toBe(1);
    });

    it('calls getResolvedShellName to name the new tab', async () => {
      render(<UserTerminalSection {...defaultProps} />);

      const addButton = screen.getByTestId('user-terminal-add-button');

      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(window.terminal.getResolvedShellName).toHaveBeenCalled();
    });
  });

  describe('Run button behavior', () => {
    it('is enabled even when no scripts are configured', () => {
      render(<UserTerminalSection {...defaultProps} />);

      // Run button should always be enabled now
      expect(screen.getByTestId('run-button-main')).not.toBeDisabled();
    });

    it('calls onOpenRepositorySettings when no scripts and Run is clicked', async () => {
      const onOpenRepositorySettings = vi.fn();

      render(
        <UserTerminalSection
          {...defaultProps}
          onOpenRepositorySettings={onOpenRepositorySettings}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('run-button-main'));
      });

      expect(onOpenRepositorySettings).toHaveBeenCalled();
    });

    it('shows scripts in dropdown when configured', () => {
      // Add scripts config to repository
      const repoWithScripts = {
        ...mockRepository,
        scriptsConfig: {
          setupScript: null,
          runScripts: [
            { id: 'script-1', name: 'Dev Server', command: 'npm run dev' },
            { id: 'script-2', name: 'Tests', command: 'npm test' },
          ],
          cleanupScript: null,
          exclusiveMode: false,
          lastUsedRunScriptId: 'script-1',
        },
      };
      useAppStore.setState({
        repositories: [repoWithScripts],
      });

      render(<UserTerminalSection {...defaultProps} />);

      expect(screen.getByTestId('script-item-script-1')).toHaveTextContent('Dev Server');
      expect(screen.getByTestId('script-item-script-2')).toHaveTextContent('Tests');
    });

    it('shows checkmark on selected script', () => {
      const repoWithScripts = {
        ...mockRepository,
        scriptsConfig: {
          setupScript: null,
          runScripts: [
            { id: 'script-1', name: 'Dev Server', command: 'npm run dev' },
            { id: 'script-2', name: 'Tests', command: 'npm test' },
          ],
          cleanupScript: null,
          exclusiveMode: false,
          lastUsedRunScriptId: 'script-1',
        },
      };
      useAppStore.setState({
        repositories: [repoWithScripts],
      });

      render(<UserTerminalSection {...defaultProps} />);

      // script-1 should be selected
      expect(screen.getByTestId('script-item-script-1')).toHaveAttribute('data-selected', 'true');
      expect(screen.getByTestId('script-item-script-2')).toHaveAttribute('data-selected', 'false');
    });

    it('creates terminal and executes script when Run is clicked', async () => {
      vi.useFakeTimers();

      const repoWithScripts = {
        ...mockRepository,
        scriptsConfig: {
          setupScript: null,
          runScripts: [{ id: 'script-1', name: 'Dev Server', command: 'npm run dev' }],
          cleanupScript: null,
          exclusiveMode: false,
          lastUsedRunScriptId: 'script-1',
        },
      };
      useAppStore.setState({
        repositories: [repoWithScripts],
      });

      render(<UserTerminalSection {...defaultProps} />);

      // Click the Run button
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-button-main'));
      });

      // Check that a user tab was created with the script name
      const state = useAppStore.getState();
      const userTabs = state.getUserTabsForWorktree(mockWorktreeSession.id);
      expect(userTabs.length).toBe(1);
      expect(userTabs[0].name).toBe('Dev Server');

      // Advance timer to trigger script execution
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Check that the script command was written to the terminal
      const terminalId = state.getUserTerminalIdForTab(mockWorktreeSession.id, userTabs[0].id);
      expect(window.terminal.write).toHaveBeenCalledWith(terminalId, 'npm run dev\n');

      vi.useRealTimers();
    });

    it('uses first script if no lastUsedRunScriptId is set', async () => {
      vi.useFakeTimers();

      const repoWithScripts = {
        ...mockRepository,
        scriptsConfig: {
          setupScript: null,
          runScripts: [
            { id: 'script-1', name: 'Dev Server', command: 'npm run dev' },
            { id: 'script-2', name: 'Tests', command: 'npm test' },
          ],
          cleanupScript: null,
          exclusiveMode: false,
          lastUsedRunScriptId: null, // No script selected
        },
      };
      useAppStore.setState({
        repositories: [repoWithScripts],
      });

      render(<UserTerminalSection {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('run-button-main'));
      });

      // Should use first script
      const state = useAppStore.getState();
      const userTabs = state.getUserTabsForWorktree(mockWorktreeSession.id);
      expect(userTabs[0].name).toBe('Dev Server');

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      const terminalId = state.getUserTerminalIdForTab(mockWorktreeSession.id, userTabs[0].id);
      expect(window.terminal.write).toHaveBeenCalledWith(terminalId, 'npm run dev\n');

      vi.useRealTimers();
    });

    it('updates lastUsedRunScriptId when script is selected from dropdown', async () => {
      const repoWithScripts = {
        ...mockRepository,
        scriptsConfig: {
          setupScript: null,
          runScripts: [
            { id: 'script-1', name: 'Dev Server', command: 'npm run dev' },
            { id: 'script-2', name: 'Tests', command: 'npm test' },
          ],
          cleanupScript: null,
          exclusiveMode: false,
          lastUsedRunScriptId: 'script-1',
        },
      };
      useAppStore.setState({
        repositories: [repoWithScripts],
      });

      render(<UserTerminalSection {...defaultProps} />);

      // Click on script-2 in dropdown
      await act(async () => {
        fireEvent.click(screen.getByTestId('script-item-script-2'));
      });

      // Check that lastUsedRunScriptId was updated
      const state = useAppStore.getState();
      const repo = state.repositories.find((r) => r.id === mockRepository.id);
      expect(repo?.scriptsConfig?.lastUsedRunScriptId).toBe('script-2');
    });

    it('does not auto-run script when selecting from dropdown', async () => {
      const repoWithScripts = {
        ...mockRepository,
        scriptsConfig: {
          setupScript: null,
          runScripts: [
            { id: 'script-1', name: 'Dev Server', command: 'npm run dev' },
            { id: 'script-2', name: 'Tests', command: 'npm test' },
          ],
          cleanupScript: null,
          exclusiveMode: false,
          lastUsedRunScriptId: 'script-1',
        },
      };
      useAppStore.setState({
        repositories: [repoWithScripts],
      });

      render(<UserTerminalSection {...defaultProps} />);

      // Click on script-2 in dropdown
      await act(async () => {
        fireEvent.click(screen.getByTestId('script-item-script-2'));
      });

      // No terminal should be created (selection only, not execution)
      const state = useAppStore.getState();
      const userTabs = state.getUserTabsForWorktree(mockWorktreeSession.id);
      expect(userTabs.length).toBe(0);

      // terminal.write should not have been called
      expect(window.terminal.write).not.toHaveBeenCalled();
    });
  });

  describe('exclusive mode', () => {
    it('kills only tabs with matching scriptId when exclusiveMode is enabled', async () => {
      vi.useFakeTimers();

      const repoWithScripts = {
        ...mockRepository,
        scriptsConfig: {
          setupScript: null,
          runScripts: [
            { id: 'script-1', name: 'Dev Server', command: 'npm run dev' },
            { id: 'script-2', name: 'Tests', command: 'npm test' },
          ],
          cleanupScript: null,
          exclusiveMode: true, // Enabled
          lastUsedRunScriptId: 'script-1',
        },
      };
      useAppStore.setState({
        repositories: [repoWithScripts],
      });

      // Create an existing terminal tab WITH scriptId (simulating previous Run click)
      await act(async () => {
        useAppStore.getState().createUserTab(mockWorktreeSession.id, 'Dev Server', 'script-1');
      });
      // Create another terminal tab with different scriptId (should not be killed)
      await act(async () => {
        useAppStore.getState().createUserTab(mockWorktreeSession.id, 'Tests', 'script-2');
      });

      const stateBefore = useAppStore.getState();
      const existingTabs = stateBefore.getUserTabsForWorktree(mockWorktreeSession.id);
      expect(existingTabs.length).toBe(2);
      const devServerTab = existingTabs.find((t) => t.scriptId === 'script-1')!;
      const testsTab = existingTabs.find((t) => t.scriptId === 'script-2')!;
      const devServerTerminalId = `user:${mockWorktreeSession.id}:${devServerTab.id}`;

      render(<UserTerminalSection {...defaultProps} />);

      // Click the Run button (which runs script-1)
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-button-main'));
      });

      // Only the Dev Server terminal should have been killed (matching scriptId)
      // kill is called twice: once from exclusive mode, once from closeUserTabById cleanup
      expect(window.terminal.kill).toHaveBeenCalledWith(devServerTerminalId);
      expect(window.terminal.kill).toHaveBeenCalledTimes(2);

      // Should have 2 tabs: the Tests tab (preserved) + new Dev Server tab
      const stateAfter = useAppStore.getState();
      const newTabs = stateAfter.getUserTabsForWorktree(mockWorktreeSession.id);
      expect(newTabs.length).toBe(2);
      expect(newTabs.some((t) => t.id === testsTab.id)).toBe(true); // Tests tab preserved
      expect(newTabs.some((t) => t.name === 'Dev Server' && t.scriptId === 'script-1')).toBe(true);

      vi.useRealTimers();
    });

    it('does not kill terminals without scriptId when exclusiveMode is enabled', async () => {
      vi.useFakeTimers();

      const repoWithScripts = {
        ...mockRepository,
        scriptsConfig: {
          setupScript: null,
          runScripts: [{ id: 'script-1', name: 'Dev Server', command: 'npm run dev' }],
          cleanupScript: null,
          exclusiveMode: true,
          lastUsedRunScriptId: 'script-1',
        },
      };
      useAppStore.setState({
        repositories: [repoWithScripts],
      });

      // Create a terminal tab without scriptId (manual terminal via + button)
      await act(async () => {
        useAppStore.getState().createUserTab(mockWorktreeSession.id, 'manual-terminal');
      });

      const stateBefore = useAppStore.getState();
      const existingTabs = stateBefore.getUserTabsForWorktree(mockWorktreeSession.id);
      expect(existingTabs.length).toBe(1);
      expect(existingTabs[0].scriptId).toBeUndefined();

      render(<UserTerminalSection {...defaultProps} />);

      // Click the Run button
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-button-main'));
      });

      // No terminals should have been killed (no matching scriptId)
      expect(window.terminal.kill).not.toHaveBeenCalled();

      // Should have 2 tabs: the manual terminal + new Dev Server
      const stateAfter = useAppStore.getState();
      const newTabs = stateAfter.getUserTabsForWorktree(mockWorktreeSession.id);
      expect(newTabs.length).toBe(2);

      vi.useRealTimers();
    });

    it('does not kill any terminals when exclusiveMode is disabled', async () => {
      vi.useFakeTimers();

      const repoWithScripts = {
        ...mockRepository,
        scriptsConfig: {
          setupScript: null,
          runScripts: [{ id: 'script-1', name: 'Dev Server', command: 'npm run dev' }],
          cleanupScript: null,
          exclusiveMode: false, // Disabled
          lastUsedRunScriptId: 'script-1',
        },
      };
      useAppStore.setState({
        repositories: [repoWithScripts],
      });

      // Create an existing terminal tab with same scriptId
      await act(async () => {
        useAppStore.getState().createUserTab(mockWorktreeSession.id, 'Dev Server', 'script-1');
      });

      const stateBefore = useAppStore.getState();
      const existingTabs = stateBefore.getUserTabsForWorktree(mockWorktreeSession.id);
      expect(existingTabs.length).toBe(1);

      render(<UserTerminalSection {...defaultProps} />);

      // Click the Run button
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-button-main'));
      });

      // The existing terminal should NOT have been killed (exclusive mode is off)
      expect(window.terminal.kill).not.toHaveBeenCalled();

      // Now there should be 2 terminals (original + new)
      const stateAfter = useAppStore.getState();
      const newTabs = stateAfter.getUserTabsForWorktree(mockWorktreeSession.id);
      expect(newTabs.length).toBe(2);

      vi.useRealTimers();
    });

    it('does not try to kill when no matching scripts exist with exclusiveMode enabled', async () => {
      vi.useFakeTimers();

      const repoWithScripts = {
        ...mockRepository,
        scriptsConfig: {
          setupScript: null,
          runScripts: [{ id: 'script-1', name: 'Dev Server', command: 'npm run dev' }],
          cleanupScript: null,
          exclusiveMode: true, // Enabled but no existing terminals with matching scriptId
          lastUsedRunScriptId: 'script-1',
        },
      };
      useAppStore.setState({
        repositories: [repoWithScripts],
      });

      render(<UserTerminalSection {...defaultProps} />);

      // Click the Run button
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-button-main'));
      });

      // No kill should have been called (no matching terminals)
      expect(window.terminal.kill).not.toHaveBeenCalled();

      // One new terminal should be created with scriptId
      const stateAfter = useAppStore.getState();
      const newTabs = stateAfter.getUserTabsForWorktree(mockWorktreeSession.id);
      expect(newTabs.length).toBe(1);
      expect(newTabs[0].scriptId).toBe('script-1');

      vi.useRealTimers();
    });

    it('stores scriptId on newly created tab when running script', async () => {
      vi.useFakeTimers();

      const repoWithScripts = {
        ...mockRepository,
        scriptsConfig: {
          setupScript: null,
          runScripts: [{ id: 'script-1', name: 'Dev Server', command: 'npm run dev' }],
          cleanupScript: null,
          exclusiveMode: false,
          lastUsedRunScriptId: 'script-1',
        },
      };
      useAppStore.setState({
        repositories: [repoWithScripts],
      });

      render(<UserTerminalSection {...defaultProps} />);

      // Click the Run button
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-button-main'));
      });

      const stateAfter = useAppStore.getState();
      const newTabs = stateAfter.getUserTabsForWorktree(mockWorktreeSession.id);
      expect(newTabs.length).toBe(1);
      expect(newTabs[0].name).toBe('Dev Server');
      expect(newTabs[0].scriptId).toBe('script-1');

      vi.useRealTimers();
    });
  });

  describe('tab interactions', () => {
    it('switches active tab when tab is clicked', async () => {
      // Create two tabs
      await act(async () => {
        useAppStore.getState().createUserTab(mockWorktreeSession.id, 'terminal-1');
        useAppStore.getState().createUserTab(mockWorktreeSession.id, 'terminal-2');
      });

      render(<UserTerminalSection {...defaultProps} />);

      const state = useAppStore.getState();
      const userTabs = state.getUserTabsForWorktree(mockWorktreeSession.id);
      const firstTabId = userTabs[0].id;

      // Click on the first tab (rendered inline now, not through mock TabBar)
      const tabs = screen.getAllByRole('tab');
      const firstTab = tabs.find((tab) => tab.textContent?.includes('terminal-1'));

      await act(async () => {
        if (firstTab) {
          fireEvent.click(firstTab);
        }
      });

      // First tab should now be active
      const newState = useAppStore.getState();
      expect(newState.activeUserTabId).toBe(firstTabId);
    });
  });

  describe('empty state', () => {
    it('creates terminal when clicking + button in header', async () => {
      render(<UserTerminalSection {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('user-terminal-add-button'));
      });

      const state = useAppStore.getState();
      const userTabs = state.getUserTabsForWorktree(mockWorktreeSession.id);
      expect(userTabs.length).toBe(1);
    });
  });
});
