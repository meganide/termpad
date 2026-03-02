import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OperationDrawer } from './OperationDrawer';
import type { OperationProgress, HookManifest } from '../../../../shared/types';

describe('OperationDrawer', () => {
  const noHooksManifest: HookManifest = {
    'pre-commit': false,
    'commit-msg': false,
    'post-commit': false,
    'pre-push': false,
    'post-push': false,
  };

  const commitHooksManifest: HookManifest = {
    'pre-commit': true,
    'commit-msg': false,
    'post-commit': false,
    'pre-push': false,
    'post-push': false,
  };

  const baseProgress: OperationProgress = {
    status: 'idle',
    operationType: 'commit',
    currentHook: null,
    output: [],
  };

  const baseProgressWithHooks: OperationProgress = {
    status: 'idle',
    operationType: 'commit',
    currentHook: null,
    output: [],
    hookManifest: commitHooksManifest,
  };

  it('should not render when status is idle', () => {
    render(<OperationDrawer progress={baseProgress} />);
    expect(screen.queryByTestId('operation-drawer')).not.toBeInTheDocument();
  });

  it('should render when status is running-hook', () => {
    render(<OperationDrawer progress={{ ...baseProgressWithHooks, status: 'running-hook' }} />);
    expect(screen.getByTestId('operation-drawer')).toBeInTheDocument();
    expect(screen.getByText('Running hooks...')).toBeInTheDocument();
    expect(screen.getByTestId('status-loading')).toBeInTheDocument();
  });

  it('should render when status is checking-hooks', () => {
    render(<OperationDrawer progress={{ ...baseProgressWithHooks, status: 'checking-hooks' }} />);
    expect(screen.getByText('Checking hooks...')).toBeInTheDocument();
  });

  it('should render when status is executing with hooks', () => {
    render(<OperationDrawer progress={{ ...baseProgressWithHooks, status: 'executing' }} />);
    expect(screen.getByText('Committing...')).toBeInTheDocument();
  });

  it('should show success state with hooks', () => {
    render(<OperationDrawer progress={{ ...baseProgressWithHooks, status: 'success' }} />);
    expect(screen.getByText('Commit successful')).toBeInTheDocument();
    expect(screen.getByTestId('status-success')).toBeInTheDocument();
  });

  it('should show error state', () => {
    render(
      <OperationDrawer progress={{ ...baseProgress, status: 'error', error: 'Test error' }} />
    );
    expect(screen.getByText('Commit failed')).toBeInTheDocument();
    expect(screen.getByTestId('status-error')).toBeInTheDocument();
  });

  // No-hooks behavior tests
  it('should not render when no hooks and status is executing', () => {
    render(
      <OperationDrawer
        progress={{ ...baseProgress, status: 'executing', hookManifest: noHooksManifest }}
      />
    );
    expect(screen.queryByTestId('operation-drawer')).not.toBeInTheDocument();
  });

  it('should not render when no hooks and status is success', () => {
    render(
      <OperationDrawer
        progress={{ ...baseProgress, status: 'success', hookManifest: noHooksManifest }}
      />
    );
    expect(screen.queryByTestId('operation-drawer')).not.toBeInTheDocument();
  });

  it('should render error even when no hooks', () => {
    render(
      <OperationDrawer
        progress={{
          ...baseProgress,
          status: 'error',
          error: 'Test error',
          hookManifest: noHooksManifest,
        }}
      />
    );
    expect(screen.getByTestId('operation-drawer')).toBeInTheDocument();
    expect(screen.getByText('Commit failed')).toBeInTheDocument();
  });

  it('should display output lines', () => {
    render(
      <OperationDrawer
        progress={{
          ...baseProgressWithHooks,
          status: 'running-hook',
          output: ['Line 1', 'Line 2', 'Line 3'],
        }}
      />
    );
    expect(screen.getByText('Line 1')).toBeInTheDocument();
    expect(screen.getByText('Line 2')).toBeInTheDocument();
    expect(screen.getByText('Line 3')).toBeInTheDocument();
  });

  it('should show "Waiting for output..." when output is empty', () => {
    render(
      <OperationDrawer
        progress={{ ...baseProgressWithHooks, status: 'running-hook', output: [] }}
      />
    );
    expect(screen.getByText('Waiting for output...')).toBeInTheDocument();
  });

  it('should highlight error lines in output', () => {
    render(
      <OperationDrawer
        progress={{
          ...baseProgress,
          status: 'error',
          output: ['Normal line', 'error: something failed'],
        }}
      />
    );
    const errorLine = screen.getByText('error: something failed');
    expect(errorLine).toHaveClass('text-destructive');
  });

  it('should collapse and expand when header is clicked (non-running state)', () => {
    render(
      <OperationDrawer
        progress={{
          ...baseProgressWithHooks,
          status: 'success',
          output: ['Line 1'],
        }}
      />
    );

    // Initially expanded
    expect(screen.getByTestId('output-area')).toBeInTheDocument();

    // Click header to collapse
    fireEvent.click(screen.getByTestId('drawer-header'));
    expect(screen.queryByTestId('output-area')).not.toBeInTheDocument();

    // Click header to expand
    fireEvent.click(screen.getByTestId('drawer-header'));
    expect(screen.getByTestId('output-area')).toBeInTheDocument();
  });

  it('should allow collapsing even when running', () => {
    render(
      <OperationDrawer
        progress={{
          ...baseProgressWithHooks,
          status: 'running-hook',
          output: ['Line 1'],
        }}
      />
    );

    // Initially expanded
    expect(screen.getByTestId('output-area')).toBeInTheDocument();

    // Click header to collapse - should now collapse even when running
    fireEvent.click(screen.getByTestId('drawer-header'));
    expect(screen.queryByTestId('output-area')).not.toBeInTheDocument();
  });

  it('should show "View Full Error" button on error state', () => {
    const onViewFullError = vi.fn();
    render(
      <OperationDrawer
        progress={{ ...baseProgress, status: 'error', error: 'Test error' }}
        onViewFullError={onViewFullError}
      />
    );

    const viewErrorButton = screen.getByTestId('view-full-error-button');
    expect(viewErrorButton).toBeInTheDocument();

    fireEvent.click(viewErrorButton);
    expect(onViewFullError).toHaveBeenCalled();
  });

  it('should not show "View Full Error" button when not in error state', () => {
    const onViewFullError = vi.fn();
    render(
      <OperationDrawer
        progress={{ ...baseProgressWithHooks, status: 'success' }}
        onViewFullError={onViewFullError}
      />
    );

    expect(screen.queryByTestId('view-full-error-button')).not.toBeInTheDocument();
  });

  it('should display error message if not already in output', () => {
    render(
      <OperationDrawer
        progress={{
          ...baseProgress,
          status: 'error',
          output: ['Some output'],
          error: 'Unique error message',
        }}
      />
    );
    expect(screen.getByTestId('error-message')).toBeInTheDocument();
    expect(screen.getByText('Unique error message')).toBeInTheDocument();
  });

  it('should show hook name when running specific hook', () => {
    render(
      <OperationDrawer
        progress={{
          ...baseProgressWithHooks,
          status: 'running-hook',
          currentHook: 'pre-commit',
          output: [],
        }}
      />
    );
    expect(screen.getByText('Running pre-commit hook...')).toBeInTheDocument();
  });

  it('should show push operation status correctly', () => {
    const pushProgress: OperationProgress = {
      status: 'executing',
      operationType: 'push',
      currentHook: null,
      output: [],
      hookManifest: {
        'pre-commit': false,
        'commit-msg': false,
        'post-commit': false,
        'pre-push': true,
        'post-push': false,
      },
    };
    render(<OperationDrawer progress={pushProgress} />);
    expect(screen.getByText('Pushing...')).toBeInTheDocument();
  });

  it('should show post-hook failure status when operation succeeded but hook failed', () => {
    render(
      <OperationDrawer
        progress={{
          ...baseProgressWithHooks,
          status: 'error',
          currentHook: 'post-commit',
          operationSucceeded: true,
          error: 'Post-commit hook failed',
        }}
      />
    );
    expect(screen.getByText('Commit OK, post-commit hook failed')).toBeInTheDocument();
    expect(screen.getByTestId('status-post-hook-error')).toBeInTheDocument();
  });

  it('should show push post-hook failure status correctly', () => {
    const pushProgress: OperationProgress = {
      status: 'error',
      operationType: 'push',
      currentHook: 'post-push',
      output: [],
      operationSucceeded: true,
      error: 'Post-push hook failed',
      hookManifest: {
        'pre-commit': false,
        'commit-msg': false,
        'post-commit': false,
        'pre-push': false,
        'post-push': true,
      },
    };
    render(<OperationDrawer progress={pushProgress} />);
    expect(screen.getByText('Push OK, post-push hook failed')).toBeInTheDocument();
    expect(screen.getByTestId('status-post-hook-error')).toBeInTheDocument();
  });

  it('should show cancel button when running and onCancel is provided', () => {
    const onCancel = vi.fn();
    render(
      <OperationDrawer
        progress={{ ...baseProgressWithHooks, status: 'running-hook' }}
        onCancel={onCancel}
      />
    );
    expect(screen.getByTestId('cancel-operation-button')).toBeInTheDocument();
  });

  it('should not show cancel button when not running', () => {
    const onCancel = vi.fn();
    render(
      <OperationDrawer
        progress={{ ...baseProgressWithHooks, status: 'success' }}
        onCancel={onCancel}
      />
    );
    expect(screen.queryByTestId('cancel-operation-button')).not.toBeInTheDocument();
  });

  it('should call onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <OperationDrawer
        progress={{ ...baseProgressWithHooks, status: 'running-hook' }}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByTestId('cancel-operation-button'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('should show close button when error and onClose is provided', () => {
    const onClose = vi.fn();
    render(
      <OperationDrawer
        progress={{ ...baseProgressWithHooks, status: 'error', error: 'Hook failed' }}
        onClose={onClose}
      />
    );
    expect(screen.getByTestId('close-drawer-button')).toBeInTheDocument();
  });

  it('should show close button when success and onClose is provided', () => {
    const onClose = vi.fn();
    render(
      <OperationDrawer
        progress={{ ...baseProgressWithHooks, status: 'success' }}
        onClose={onClose}
      />
    );
    expect(screen.getByTestId('close-drawer-button')).toBeInTheDocument();
  });

  it('should not show close button when running', () => {
    const onClose = vi.fn();
    render(
      <OperationDrawer
        progress={{ ...baseProgressWithHooks, status: 'running-hook' }}
        onClose={onClose}
      />
    );
    expect(screen.queryByTestId('close-drawer-button')).not.toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <OperationDrawer
        progress={{ ...baseProgressWithHooks, status: 'error', error: 'Hook failed' }}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByTestId('close-drawer-button'));
    expect(onClose).toHaveBeenCalled();
  });
});
