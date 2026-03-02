import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ScriptsSection } from './ScriptsSection';
import { TERMPAD_VARIABLES } from './ScriptInput';
import type { RepositoryScriptsConfig } from '../../../shared/types';

// Mock ScriptInput to simplify testing of ScriptsSection logic
vi.mock('./ScriptInput', async () => {
  const actual = await vi.importActual('./ScriptInput');
  return {
    ...actual,
    ScriptInput: ({
      value,
      onChange,
      placeholder,
      'data-testid': testId,
    }: {
      value: string;
      onChange: (value: string) => void;
      placeholder?: string;
      multiline?: boolean;
      'data-testid'?: string;
    }) => (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
      />
    ),
  };
});

function createDefaultConfig(): RepositoryScriptsConfig {
  return {
    setupScript: null,
    runScripts: [],
    cleanupScript: null,
    exclusiveMode: false,
    lastUsedRunScriptId: null,
  };
}

describe('ScriptsSection', () => {
  describe('rendering', () => {
    it('renders scripts section with heading', () => {
      const onUpdate = vi.fn();
      render(<ScriptsSection scriptsConfig={createDefaultConfig()} onUpdate={onUpdate} />);

      expect(screen.getByText('Scripts')).toBeInTheDocument();
      expect(screen.getByTestId('scripts-section')).toBeInTheDocument();
    });

    it('renders setup script section with description', () => {
      const onUpdate = vi.fn();
      render(<ScriptsSection scriptsConfig={createDefaultConfig()} onUpdate={onUpdate} />);

      expect(screen.getByText('Setup Script')).toBeInTheDocument();
      expect(
        screen.getByText(/Runs automatically when creating new worktrees/)
      ).toBeInTheDocument();
      expect(screen.getByTestId('setup-script-input')).toBeInTheDocument();
    });

    it('renders run scripts section with description', () => {
      const onUpdate = vi.fn();
      render(<ScriptsSection scriptsConfig={createDefaultConfig()} onUpdate={onUpdate} />);

      expect(screen.getByText('Run Scripts')).toBeInTheDocument();
      expect(screen.getByText(/Execute common tasks with one click/)).toBeInTheDocument();
      expect(screen.getByTestId('add-run-script-button')).toBeInTheDocument();
    });

    it('renders cleanup script section with description', () => {
      const onUpdate = vi.fn();
      render(<ScriptsSection scriptsConfig={createDefaultConfig()} onUpdate={onUpdate} />);

      expect(screen.getByText('Cleanup Script')).toBeInTheDocument();
      expect(screen.getByText(/Runs after worktree deletion/)).toBeInTheDocument();
      expect(screen.getByTestId('cleanup-script-input')).toBeInTheDocument();
    });

    it('renders environment variables helper text', () => {
      const onUpdate = vi.fn();
      render(<ScriptsSection scriptsConfig={createDefaultConfig()} onUpdate={onUpdate} />);

      expect(screen.getByText('Available Environment Variables')).toBeInTheDocument();
      // Check all environment variables are listed
      TERMPAD_VARIABLES.forEach((variable) => {
        expect(screen.getByText(variable)).toBeInTheDocument();
      });
    });

    it('renders descriptions for each environment variable', () => {
      const onUpdate = vi.fn();
      render(<ScriptsSection scriptsConfig={createDefaultConfig()} onUpdate={onUpdate} />);

      expect(screen.getByText(/Workspace name/)).toBeInTheDocument();
      expect(screen.getByText(/Workspace path/)).toBeInTheDocument();
      expect(screen.getByText(/Repository root directory path/)).toBeInTheDocument();
      expect(screen.getByText(/Unique port for this worktree/)).toBeInTheDocument();
      expect(screen.getByText(/100 ports available/)).toBeInTheDocument();
    });
  });

  describe('setup script', () => {
    it('displays the setup script value', () => {
      const onUpdate = vi.fn();
      const config = { ...createDefaultConfig(), setupScript: 'npm install' };
      render(<ScriptsSection scriptsConfig={config} onUpdate={onUpdate} />);

      expect(screen.getByTestId('setup-script-input')).toHaveValue('npm install');
    });

    it('calls onUpdate when setup script changes', () => {
      const onUpdate = vi.fn();
      render(<ScriptsSection scriptsConfig={createDefaultConfig()} onUpdate={onUpdate} />);

      fireEvent.change(screen.getByTestId('setup-script-input'), {
        target: { value: 'npm install && npm run build' },
      });

      expect(onUpdate).toHaveBeenCalledWith({
        setupScript: 'npm install && npm run build',
      });
    });

    it('sets setupScript to null when value is empty', () => {
      const onUpdate = vi.fn();
      const config = { ...createDefaultConfig(), setupScript: 'npm install' };
      render(<ScriptsSection scriptsConfig={config} onUpdate={onUpdate} />);

      fireEvent.change(screen.getByTestId('setup-script-input'), {
        target: { value: '' },
      });

      expect(onUpdate).toHaveBeenCalledWith({
        setupScript: null,
      });
    });
  });

  describe('run scripts', () => {
    it('renders existing run scripts', () => {
      const onUpdate = vi.fn();
      const config: RepositoryScriptsConfig = {
        ...createDefaultConfig(),
        runScripts: [
          { id: 'script-1', name: 'Dev', command: 'npm run dev' },
          { id: 'script-2', name: 'Test', command: 'npm test' },
        ],
      };
      render(<ScriptsSection scriptsConfig={config} onUpdate={onUpdate} />);

      expect(screen.getByTestId('run-script-0')).toBeInTheDocument();
      expect(screen.getByTestId('run-script-1')).toBeInTheDocument();
      expect(screen.getByTestId('run-script-name-0')).toHaveValue('Dev');
      expect(screen.getByTestId('run-script-command-0')).toHaveValue('npm run dev');
      expect(screen.getByTestId('run-script-name-1')).toHaveValue('Test');
      expect(screen.getByTestId('run-script-command-1')).toHaveValue('npm test');
    });

    it('adds a new run script when clicking add button and sets it as default for first script', () => {
      const onUpdate = vi.fn();
      render(<ScriptsSection scriptsConfig={createDefaultConfig()} onUpdate={onUpdate} />);

      fireEvent.click(screen.getByTestId('add-run-script-button'));

      expect(onUpdate).toHaveBeenCalledWith({
        runScripts: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: '',
            command: '',
          }),
        ]),
        lastUsedRunScriptId: expect.any(String),
      });
    });

    it('updates run script name when changed', () => {
      const onUpdate = vi.fn();
      const config: RepositoryScriptsConfig = {
        ...createDefaultConfig(),
        runScripts: [{ id: 'script-1', name: 'Dev', command: 'npm run dev' }],
      };
      render(<ScriptsSection scriptsConfig={config} onUpdate={onUpdate} />);

      fireEvent.change(screen.getByTestId('run-script-name-0'), {
        target: { value: 'Development' },
      });

      expect(onUpdate).toHaveBeenCalledWith({
        runScripts: [{ id: 'script-1', name: 'Development', command: 'npm run dev' }],
      });
    });

    it('updates run script command when changed', () => {
      const onUpdate = vi.fn();
      const config: RepositoryScriptsConfig = {
        ...createDefaultConfig(),
        runScripts: [{ id: 'script-1', name: 'Dev', command: 'npm run dev' }],
      };
      render(<ScriptsSection scriptsConfig={config} onUpdate={onUpdate} />);

      fireEvent.change(screen.getByTestId('run-script-command-0'), {
        target: { value: 'npm run start' },
      });

      expect(onUpdate).toHaveBeenCalledWith({
        runScripts: [{ id: 'script-1', name: 'Dev', command: 'npm run start' }],
      });
    });

    it('deletes a run script when clicking delete button and updates default', () => {
      const onUpdate = vi.fn();
      const config: RepositoryScriptsConfig = {
        ...createDefaultConfig(),
        runScripts: [
          { id: 'script-1', name: 'Dev', command: 'npm run dev' },
          { id: 'script-2', name: 'Test', command: 'npm test' },
        ],
        lastUsedRunScriptId: 'script-1',
      };
      render(<ScriptsSection scriptsConfig={config} onUpdate={onUpdate} />);

      fireEvent.click(screen.getByTestId('run-script-delete-0'));

      expect(onUpdate).toHaveBeenCalledWith({
        runScripts: [{ id: 'script-2', name: 'Test', command: 'npm test' }],
        lastUsedRunScriptId: 'script-2',
      });
    });

    it('can delete the last remaining run script', () => {
      const onUpdate = vi.fn();
      const config: RepositoryScriptsConfig = {
        ...createDefaultConfig(),
        runScripts: [{ id: 'script-1', name: 'Dev', command: 'npm run dev' }],
        lastUsedRunScriptId: 'script-1',
      };
      render(<ScriptsSection scriptsConfig={config} onUpdate={onUpdate} />);

      fireEvent.click(screen.getByTestId('run-script-delete-0'));

      expect(onUpdate).toHaveBeenCalledWith({
        runScripts: [],
        lastUsedRunScriptId: null,
      });
    });
  });

  describe('cleanup script', () => {
    it('displays the cleanup script value', () => {
      const onUpdate = vi.fn();
      const config = { ...createDefaultConfig(), cleanupScript: 'docker-compose down' };
      render(<ScriptsSection scriptsConfig={config} onUpdate={onUpdate} />);

      expect(screen.getByTestId('cleanup-script-input')).toHaveValue('docker-compose down');
    });

    it('calls onUpdate when cleanup script changes', () => {
      const onUpdate = vi.fn();
      render(<ScriptsSection scriptsConfig={createDefaultConfig()} onUpdate={onUpdate} />);

      fireEvent.change(screen.getByTestId('cleanup-script-input'), {
        target: { value: 'rm -rf node_modules' },
      });

      expect(onUpdate).toHaveBeenCalledWith({
        cleanupScript: 'rm -rf node_modules',
      });
    });

    it('sets cleanupScript to null when value is empty', () => {
      const onUpdate = vi.fn();
      const config = { ...createDefaultConfig(), cleanupScript: 'docker-compose down' };
      render(<ScriptsSection scriptsConfig={config} onUpdate={onUpdate} />);

      fireEvent.change(screen.getByTestId('cleanup-script-input'), {
        target: { value: '' },
      });

      expect(onUpdate).toHaveBeenCalledWith({
        cleanupScript: null,
      });
    });
  });

  describe('accessibility', () => {
    it('has proper labels for script inputs', () => {
      const onUpdate = vi.fn();
      render(<ScriptsSection scriptsConfig={createDefaultConfig()} onUpdate={onUpdate} />);

      // Labels exist
      expect(screen.getByText('Setup Script')).toBeInTheDocument();
      expect(screen.getByText('Run Scripts')).toBeInTheDocument();
      expect(screen.getByText('Cleanup Script')).toBeInTheDocument();
    });
  });
});
