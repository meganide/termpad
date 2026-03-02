import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepositorySettingsOverlay } from './RepositorySettingsOverlay';
import { resetAllStores, createMockRepository } from '../../../../tests/utils';
import { useAppStore } from '../../stores/appStore';

describe('RepositorySettingsOverlay', () => {
  const mockOnClose = vi.fn();
  const testRepositoryId = 'test-repo-1';

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    // Set up a test repository
    const mockRepository = createMockRepository({
      id: testRepositoryId,
      name: 'Test Repository',
      path: '/test/path',
    });
    useAppStore.setState({
      repositories: [mockRepository],
    });
  });

  describe('rendering', () => {
    it('renders the overlay', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      expect(screen.getByTestId('repository-settings-overlay')).toBeInTheDocument();
    });

    it('renders the Scripts nav item', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      expect(screen.getByRole('button', { name: /Scripts/i })).toBeInTheDocument();
    });

    it('renders the Advanced nav item', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      expect(screen.getByRole('button', { name: /Advanced/i })).toBeInTheDocument();
    });

    it('renders the back button', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      expect(screen.getByText('Back')).toBeInTheDocument();
    });

    it('renders setup script input', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      expect(screen.getByText('Setup Script')).toBeInTheDocument();
      expect(screen.getByTestId('setup-script-input')).toBeInTheDocument();
    });

    it('renders cleanup script input', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      expect(screen.getByText('Cleanup Script')).toBeInTheDocument();
      expect(screen.getByTestId('cleanup-script-input')).toBeInTheDocument();
    });

    it('renders nonconcurrent mode checkbox in Advanced tab', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      // Click Advanced tab
      fireEvent.click(screen.getByRole('button', { name: /Advanced/i }));
      expect(screen.getByText('Exclusive Mode')).toBeInTheDocument();
      expect(screen.getByTestId('exclusive-mode-checkbox')).toBeInTheDocument();
    });

    it('renders add run script button', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      expect(screen.getByTestId('add-run-script-button')).toBeInTheDocument();
      expect(screen.getByText('Add Script')).toBeInTheDocument();
    });

    it('shows "Repository not found" when repository does not exist', () => {
      render(<RepositorySettingsOverlay repositoryId="non-existent" onClose={mockOnClose} />);
      expect(screen.getByText('Repository not found')).toBeInTheDocument();
    });
  });

  describe('back button', () => {
    it('calls onClose when back button is clicked', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('back-button'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('auto-save', () => {
    it('auto-saves changes when input value changes', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);

      // Make a change
      const setupScriptInput = screen.getByTestId('setup-script-input');
      fireEvent.change(setupScriptInput, { target: { value: 'npm install' } });

      // Check that state was updated immediately
      const state = useAppStore.getState();
      const repository = state.repositories.find((r) => r.id === testRepositoryId);
      expect(repository?.scriptsConfig?.setupScript).toBe('npm install');

      // Check that storage was called
      expect(window.storage.saveState).toHaveBeenCalled();
    });
  });

  describe('setup script', () => {
    it('updates setup script value on change', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      const input = screen.getByTestId('setup-script-input');
      fireEvent.change(input, { target: { value: 'npm install && npm run build' } });
      expect(input).toHaveValue('npm install && npm run build');
    });

    it('loads existing setup script from repository', () => {
      // Set up repository with existing scripts config
      const repoWithScripts = createMockRepository({
        id: testRepositoryId,
        name: 'Test Repository',
        scriptsConfig: {
          setupScript: 'existing setup command',
          runScripts: [],
          cleanupScript: null,
          exclusiveMode: false,
          lastUsedRunScriptId: null,
        },
      });
      useAppStore.setState({ repositories: [repoWithScripts] });

      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      expect(screen.getByTestId('setup-script-input')).toHaveValue('existing setup command');
    });
  });

  describe('cleanup script', () => {
    it('updates cleanup script value on change', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      const input = screen.getByTestId('cleanup-script-input');
      fireEvent.change(input, { target: { value: 'docker-compose down' } });
      expect(input).toHaveValue('docker-compose down');
    });

    it('loads existing cleanup script from repository', () => {
      const repoWithScripts = createMockRepository({
        id: testRepositoryId,
        name: 'Test Repository',
        scriptsConfig: {
          setupScript: null,
          runScripts: [],
          cleanupScript: 'existing cleanup command',
          exclusiveMode: false,
          lastUsedRunScriptId: null,
        },
      });
      useAppStore.setState({ repositories: [repoWithScripts] });

      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      expect(screen.getByTestId('cleanup-script-input')).toHaveValue('existing cleanup command');
    });
  });

  describe('run scripts', () => {
    it('adds a new run script when Add Script button is clicked', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);

      // Initially no run scripts
      expect(screen.queryByTestId('run-script-0')).not.toBeInTheDocument();

      // Click add button
      fireEvent.click(screen.getByTestId('add-run-script-button'));

      // Now there should be a run script row
      expect(screen.getByTestId('run-script-0')).toBeInTheDocument();
      expect(screen.getByTestId('run-script-name-0')).toBeInTheDocument();
      expect(screen.getByTestId('run-script-command-0')).toBeInTheDocument();
    });

    it('updates run script name', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);

      // Add a script
      fireEvent.click(screen.getByTestId('add-run-script-button'));

      // Update the name
      const nameInput = screen.getByTestId('run-script-name-0');
      fireEvent.change(nameInput, { target: { value: 'dev server' } });
      expect(nameInput).toHaveValue('dev server');
    });

    it('updates run script command', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);

      // Add a script
      fireEvent.click(screen.getByTestId('add-run-script-button'));

      // Update the command
      const commandInput = screen.getByTestId('run-script-command-0');
      fireEvent.change(commandInput, { target: { value: 'npm run dev' } });
      expect(commandInput).toHaveValue('npm run dev');
    });

    it('deletes a run script when delete button is clicked', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);

      // Add a script
      fireEvent.click(screen.getByTestId('add-run-script-button'));
      expect(screen.getByTestId('run-script-0')).toBeInTheDocument();

      // Delete it
      fireEvent.click(screen.getByTestId('run-script-delete-0'));

      // Should be gone
      expect(screen.queryByTestId('run-script-0')).not.toBeInTheDocument();
    });

    it('loads existing run scripts from repository', () => {
      const repoWithScripts = createMockRepository({
        id: testRepositoryId,
        name: 'Test Repository',
        scriptsConfig: {
          setupScript: null,
          runScripts: [
            { id: '1', name: 'dev', command: 'npm run dev' },
            { id: '2', name: 'test', command: 'npm test' },
          ],
          cleanupScript: null,
          exclusiveMode: false,
          lastUsedRunScriptId: null,
        },
      });
      useAppStore.setState({ repositories: [repoWithScripts] });

      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);

      expect(screen.getByTestId('run-script-name-0')).toHaveValue('dev');
      expect(screen.getByTestId('run-script-command-0')).toHaveValue('npm run dev');
      expect(screen.getByTestId('run-script-name-1')).toHaveValue('test');
      expect(screen.getByTestId('run-script-command-1')).toHaveValue('npm test');
    });
  });

  describe('nonconcurrent mode', () => {
    it('toggles nonconcurrent mode when checkbox is clicked', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      // Click Advanced tab
      fireEvent.click(screen.getByRole('button', { name: /Advanced/i }));
      const checkbox = screen.getByTestId('exclusive-mode-checkbox');

      // Initially unchecked
      expect(checkbox).not.toBeChecked();

      // Click to enable
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();

      // Click to disable
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('loads existing nonconcurrent mode setting from repository', () => {
      const repoWithScripts = createMockRepository({
        id: testRepositoryId,
        name: 'Test Repository',
        scriptsConfig: {
          setupScript: null,
          runScripts: [],
          cleanupScript: null,
          exclusiveMode: true,
          lastUsedRunScriptId: null,
        },
      });
      useAppStore.setState({ repositories: [repoWithScripts] });

      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      // Click Advanced tab
      fireEvent.click(screen.getByRole('button', { name: /Advanced/i }));
      expect(screen.getByTestId('exclusive-mode-checkbox')).toBeChecked();
    });

    it('auto-saves nonconcurrent mode when toggled', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      // Click Advanced tab
      fireEvent.click(screen.getByRole('button', { name: /Advanced/i }));

      // Enable nonconcurrent mode
      fireEvent.click(screen.getByTestId('exclusive-mode-checkbox'));

      // Check state was auto-saved
      const state = useAppStore.getState();
      const repository = state.repositories.find((r) => r.id === testRepositoryId);
      expect(repository?.scriptsConfig?.exclusiveMode).toBe(true);
    });
  });

  describe('script descriptions', () => {
    it('shows setup script description', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      expect(
        screen.getByText(/Runs automatically when creating new worktrees/i)
      ).toBeInTheDocument();
    });

    it('shows run scripts description', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      expect(screen.getByText(/Execute common tasks with one click/i)).toBeInTheDocument();
    });

    it('shows cleanup script description', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      expect(screen.getByText(/Runs after worktree deletion/i)).toBeInTheDocument();
    });

    it('shows nonconcurrent mode description', () => {
      render(<RepositorySettingsOverlay repositoryId={testRepositoryId} onClose={mockOnClose} />);
      // Click Advanced tab to see exclusive mode
      fireEvent.click(screen.getByRole('button', { name: /Advanced/i }));
      expect(screen.getByText(/kill any existing instances/i)).toBeInTheDocument();
    });
  });
});
