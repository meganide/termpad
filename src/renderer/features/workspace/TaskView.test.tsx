import { render, screen, fireEvent, act} from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskView } from './TaskView';
import { useWorkspaceStore } from './store';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

import { toast } from 'sonner';

describe('TaskView', () => {
  const originalState = {
    tabs: ['task-1', 'task-2'],
    activeTab: 'task-1',
    taskStates: {
      'task-1': { content: '' },
      'task-2': { content: '' }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset workspace store to default state
    useWorkspaceStore.setState(originalState);
    // Clear localStorage to prevent persist middleware interference
    localStorage.clear();
    // Reset ping mock
    vi.mocked(window.electronAPI.ping).mockResolvedValue('pong');
  });

  afterEach(() => {
    // Reset store after each test
    useWorkspaceStore.setState(originalState);
  });

  describe('rendering', () => {
    it('renders the task view', () => {
      render(<TaskView tabId="task-1" />);
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('renders correct title for task-1', () => {
      render(<TaskView tabId="task-1" />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Task 1');
    });

    it('renders correct title for task-2', () => {
      render(<TaskView tabId="task-2" />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Task 2');
    });

    it('renders correct title for unknown tab', () => {
      render(<TaskView tabId="task-3" />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Task 2');
    });

    it('renders textarea', () => {
      render(<TaskView tabId="task-1" />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders Test IPC button', () => {
      render(<TaskView tabId="task-1" />);
      expect(screen.getByRole('button', { name: /Test IPC/i })).toBeInTheDocument();
    });

    it('renders info text about persistence', () => {
      render(<TaskView tabId="task-1" />);
      expect(screen.getByText(/Content is automatically saved/i)).toBeInTheDocument();
    });

    it('renders placeholder text', () => {
      render(<TaskView tabId="task-1" />);
      expect(screen.getByPlaceholderText(/Type something here/i)).toBeInTheDocument();
    });
  });

  describe('content display', () => {
    it('displays content from store', () => {
      useWorkspaceStore.setState({
        taskStates: {
          'task-1': { content: 'Hello World' }
        }
      });
      render(<TaskView tabId="task-1" />);
      expect(screen.getByRole('textbox')).toHaveValue('Hello World');
    });

    it('displays empty content when no state exists', () => {
      useWorkspaceStore.setState({
        taskStates: {}
      });
      render(<TaskView tabId="task-1" />);
      expect(screen.getByRole('textbox')).toHaveValue('');
    });

    it('displays different content for different tabs', () => {
      useWorkspaceStore.setState({
        taskStates: {
          'task-1': { content: 'Content 1' },
          'task-2': { content: 'Content 2' }
        }
      });

      const { rerender } = render(<TaskView tabId="task-1" />);
      expect(screen.getByRole('textbox')).toHaveValue('Content 1');

      rerender(<TaskView tabId="task-2" />);
      expect(screen.getByRole('textbox')).toHaveValue('Content 2');
    });
  });

  describe('content editing', () => {
    it('updates store when content changes', async () => {
      render(<TaskView tabId="task-1" />);

      // Directly call the store action and verify component displays updated content
      await act(async () => {
        useWorkspaceStore.getState().updateTaskContent('task-1', 'New content');
      });

      const { taskStates } = useWorkspaceStore.getState();
      expect(taskStates['task-1'].content).toBe('New content');
      // Verify component reflects the updated store
      expect(screen.getByRole('textbox')).toHaveValue('New content');
    });

    it('preserves content for other tabs when editing', async () => {
      useWorkspaceStore.setState({
        taskStates: {
          'task-1': { content: '' },
          'task-2': { content: 'Preserved' }
        }
      });

      render(<TaskView tabId="task-1" />);

      await act(async () => {
        useWorkspaceStore.getState().updateTaskContent('task-1', 'New content');
      });

      const { taskStates } = useWorkspaceStore.getState();
      expect(taskStates['task-1'].content).toBe('New content');
      expect(taskStates['task-2'].content).toBe('Preserved');
    });

    it('handles empty content', async () => {
      useWorkspaceStore.setState({
        taskStates: {
          'task-1': { content: 'Initial content' }
        }
      });

      render(<TaskView tabId="task-1" />);
      expect(screen.getByRole('textbox')).toHaveValue('Initial content');

      await act(async () => {
        useWorkspaceStore.getState().updateTaskContent('task-1', '');
      });

      const { taskStates } = useWorkspaceStore.getState();
      expect(taskStates['task-1'].content).toBe('');
      expect(screen.getByRole('textbox')).toHaveValue('');
    });

    it('updates textarea value on change event', () => {
      render(<TaskView tabId="task-1" />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Fire change event
      fireEvent.change(textarea, {
        target: { value: 'Test input' }
      });

      // The textarea should have the new value (controlled component behavior)
      // Note: The actual store update is tested separately in the store tests
      expect(textarea.value).toBe('Test input');
    });
  });

  describe('ping functionality', () => {
    it('calls ping API when button is clicked', async () => {
      render(<TaskView tabId="task-1" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Test IPC/i }));
      });

      expect(window.electronAPI.ping).toHaveBeenCalledTimes(1);
    });

    it('shows success toast on successful ping', async () => {
      vi.mocked(window.electronAPI.ping).mockResolvedValue('pong');

      render(<TaskView tabId="task-1" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Test IPC/i }));
        // Wait for the promise to resolve
        await vi.mocked(window.electronAPI.ping).mock.results[0]?.value;
      });

      expect(toast.success).toHaveBeenCalledWith('Response: pong');
    });

    it('shows error toast on failed ping', async () => {
      const mockRejection = vi.mocked(window.electronAPI.ping).mockRejectedValue(
        new Error('Connection failed')
      );

      render(<TaskView tabId="task-1" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Test IPC/i }));
        // Wait for the promise to reject
        try {
          await mockRejection.mock.results[0]?.value;
        } catch {
          // Expected rejection
        }
      });

      expect(toast.error).toHaveBeenCalledWith('Ping failed');
    });
  });

  describe('layout', () => {
    it('has flex column layout', () => {
      render(<TaskView tabId="task-1" />);
      const container = document.querySelector('.flex.h-full.flex-col');
      expect(container).toBeInTheDocument();
    });

    it('has gap between elements', () => {
      render(<TaskView tabId="task-1" />);
      const container = document.querySelector('.gap-4');
      expect(container).toBeInTheDocument();
    });

    it('title row has justify-between', () => {
      render(<TaskView tabId="task-1" />);
      const titleRow = document.querySelector('.justify-between');
      expect(titleRow).toBeInTheDocument();
    });

    it('textarea container is flex-1', () => {
      render(<TaskView tabId="task-1" />);
      const textareaContainer = document.querySelector('.flex-1');
      expect(textareaContainer).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('heading has correct styling', () => {
      render(<TaskView tabId="task-1" />);
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveClass('text-2xl', 'font-bold');
    });

    it('info text has muted color', () => {
      render(<TaskView tabId="task-1" />);
      const infoText = screen.getByText(/Content is automatically saved/i);
      expect(infoText).toHaveClass('text-muted-foreground');
    });

    it('info text is small', () => {
      render(<TaskView tabId="task-1" />);
      const infoText = screen.getByText(/Content is automatically saved/i);
      expect(infoText).toHaveClass('text-sm');
    });
  });

  describe('accessibility', () => {
    it('textarea is focusable', () => {
      render(<TaskView tabId="task-1" />);
      const textarea = screen.getByRole('textbox');
      textarea.focus();
      expect(document.activeElement).toBe(textarea);
    });

    it('button is focusable', () => {
      render(<TaskView tabId="task-1" />);
      const button = screen.getByRole('button', { name: /Test IPC/i });
      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it('has proper heading level', () => {
      render(<TaskView tabId="task-1" />);
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading.tagName).toBe('H1');
    });
  });

  describe('edge cases', () => {
    it('handles rapid content changes', async () => {
      render(<TaskView tabId="task-1" />);
      const store = useWorkspaceStore.getState();

      await act(async () => {
        store.updateTaskContent('task-1', 'a');
      });
      await act(async () => {
        store.updateTaskContent('task-1', 'ab');
      });
      await act(async () => {
        store.updateTaskContent('task-1', 'abc');
      });

      const { taskStates } = useWorkspaceStore.getState();
      expect(taskStates['task-1'].content).toBe('abc');
      expect(screen.getByRole('textbox')).toHaveValue('abc');
    });

    it('handles long content', async () => {
      const longContent = 'a'.repeat(1000);
      render(<TaskView tabId="task-1" />);

      await act(async () => {
        useWorkspaceStore.getState().updateTaskContent('task-1', longContent);
      });

      const { taskStates } = useWorkspaceStore.getState();
      expect(taskStates['task-1'].content).toBe(longContent);
      expect(screen.getByRole('textbox')).toHaveValue(longContent);
    });

    it('handles special characters', async () => {
      const specialContent = '& "quotes" \'apostrophes\' <tag>';
      render(<TaskView tabId="task-1" />);

      await act(async () => {
        useWorkspaceStore.getState().updateTaskContent('task-1', specialContent);
      });

      const { taskStates } = useWorkspaceStore.getState();
      expect(taskStates['task-1'].content).toBe(specialContent);
      expect(screen.getByRole('textbox')).toHaveValue(specialContent);
    });

    it('handles multiline content', async () => {
      const multilineContent = 'Line 1\nLine 2\nLine 3';
      render(<TaskView tabId="task-1" />);

      await act(async () => {
        useWorkspaceStore.getState().updateTaskContent('task-1', multilineContent);
      });

      const { taskStates } = useWorkspaceStore.getState();
      expect(taskStates['task-1'].content).toBe(multilineContent);
      expect(screen.getByRole('textbox')).toHaveValue(multilineContent);
    });

    it('handles unicode content', async () => {
      const unicodeContent = '你好世界 🎉 مرحبا';
      render(<TaskView tabId="task-1" />);

      await act(async () => {
        useWorkspaceStore.getState().updateTaskContent('task-1', unicodeContent);
      });

      const { taskStates } = useWorkspaceStore.getState();
      expect(taskStates['task-1'].content).toBe(unicodeContent);
      expect(screen.getByRole('textbox')).toHaveValue(unicodeContent);
    });
  });
});
