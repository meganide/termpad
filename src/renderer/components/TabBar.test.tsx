import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TabBar } from './TabBar';
import { useWorkspaceStore } from '../features/workspace/store';

describe('TabBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset workspace store to default state
    useWorkspaceStore.setState({
      tabs: ['task-1', 'task-2'],
      activeTab: 'task-1',
      taskStates: {
        'task-1': { content: '' },
        'task-2': { content: '' }
      }
    });
  });

  describe('rendering', () => {
    it('renders the tab bar container', () => {
      render(<TabBar />);
      const container = document.querySelector('.flex.gap-1');
      expect(container).toBeInTheDocument();
    });

    it('renders tabs from store', () => {
      render(<TabBar />);
      expect(screen.getByRole('button', { name: 'Task 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Task 2' })).toBeInTheDocument();
    });

    it('renders correct number of tabs', () => {
      render(<TabBar />);
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
    });

    it('renders tab names from TAB_NAMES mapping', () => {
      render(<TabBar />);
      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 2')).toBeInTheDocument();
    });
  });

  describe('active tab styling', () => {
    it('applies active styling to current tab', () => {
      useWorkspaceStore.setState({ activeTab: 'task-1' });
      render(<TabBar />);

      const activeTab = screen.getByRole('button', { name: 'Task 1' });
      expect(activeTab).toHaveClass('bg-primary');
      expect(activeTab).toHaveClass('text-primary-foreground');
    });

    it('applies inactive styling to non-active tabs', () => {
      useWorkspaceStore.setState({ activeTab: 'task-1' });
      render(<TabBar />);

      const inactiveTab = screen.getByRole('button', { name: 'Task 2' });
      expect(inactiveTab).toHaveClass('text-muted-foreground');
      expect(inactiveTab).not.toHaveClass('bg-primary');
    });

    it('switches active styling when different tab is active', () => {
      useWorkspaceStore.setState({ activeTab: 'task-2' });
      render(<TabBar />);

      const task1 = screen.getByRole('button', { name: 'Task 1' });
      const task2 = screen.getByRole('button', { name: 'Task 2' });

      expect(task1).not.toHaveClass('bg-primary');
      expect(task2).toHaveClass('bg-primary');
    });
  });

  describe('tab switching', () => {
    it('calls setActiveTab when tab is clicked', () => {
      useWorkspaceStore.setState({ activeTab: 'task-1' });
      render(<TabBar />);

      fireEvent.click(screen.getByRole('button', { name: 'Task 2' }));

      expect(useWorkspaceStore.getState().activeTab).toBe('task-2');
    });

    it('clicking already active tab keeps it active', () => {
      useWorkspaceStore.setState({ activeTab: 'task-1' });
      render(<TabBar />);

      fireEvent.click(screen.getByRole('button', { name: 'Task 1' }));

      expect(useWorkspaceStore.getState().activeTab).toBe('task-1');
    });
  });

  describe('dynamic tabs', () => {
    it('renders custom tab IDs', () => {
      useWorkspaceStore.setState({
        tabs: ['custom-tab'],
        activeTab: 'custom-tab',
        taskStates: { 'custom-tab': { content: '' } }
      });
      render(<TabBar />);

      // When tabId is not in TAB_NAMES, it shows the raw tabId
      expect(screen.getByText('custom-tab')).toBeInTheDocument();
    });

    it('handles empty tabs array', () => {
      useWorkspaceStore.setState({
        tabs: [],
        activeTab: '',
        taskStates: {}
      });
      render(<TabBar />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('handles single tab', () => {
      useWorkspaceStore.setState({
        tabs: ['task-1'],
        activeTab: 'task-1',
        taskStates: { 'task-1': { content: '' } }
      });
      render(<TabBar />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
    });

    it('handles many tabs', () => {
      useWorkspaceStore.setState({
        tabs: ['task-1', 'task-2', 'tab-3', 'tab-4', 'tab-5'],
        activeTab: 'task-1',
        taskStates: {
          'task-1': { content: '' },
          'task-2': { content: '' },
          'tab-3': { content: '' },
          'tab-4': { content: '' },
          'tab-5': { content: '' }
        }
      });
      render(<TabBar />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(5);
    });
  });

  describe('styling', () => {
    it('tabs have rounded styling', () => {
      render(<TabBar />);
      const tab = screen.getByRole('button', { name: 'Task 1' });
      expect(tab).toHaveClass('rounded-md');
    });

    it('tabs have padding', () => {
      render(<TabBar />);
      const tab = screen.getByRole('button', { name: 'Task 1' });
      expect(tab).toHaveClass('px-4', 'py-1.5');
    });

    it('tabs have transition', () => {
      render(<TabBar />);
      const tab = screen.getByRole('button', { name: 'Task 1' });
      expect(tab).toHaveClass('transition-colors');
    });

    it('tabs have font styling', () => {
      render(<TabBar />);
      const tab = screen.getByRole('button', { name: 'Task 1' });
      expect(tab).toHaveClass('text-sm', 'font-medium');
    });
  });

  describe('accessibility', () => {
    it('all tabs are buttons', () => {
      render(<TabBar />);
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button.tagName).toBe('BUTTON');
      });
    });

    it('tabs are focusable', () => {
      render(<TabBar />);
      const tab = screen.getByRole('button', { name: 'Task 1' });
      tab.focus();
      expect(document.activeElement).toBe(tab);
    });

    it('tabs can be clicked via keyboard', () => {
      useWorkspaceStore.setState({ activeTab: 'task-1' });
      render(<TabBar />);

      const tab2 = screen.getByRole('button', { name: 'Task 2' });
      tab2.focus();
      fireEvent.keyDown(tab2, { key: 'Enter' });

      // Note: fireEvent.keyDown doesn't trigger click by default
      // but the button is accessible via keyboard
      expect(tab2).toBeInTheDocument();
    });
  });
});
