import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorktreeDropdownMenu } from '../../src/renderer/components/Sidebar/WorktreeDropdownMenu';
import type { WorktreeSession, Project } from '../../src/shared/types';

// Helper to create a mock session
function createWorktreeSession(id: string): WorktreeSession {
  return {
    id,
    label: `Session ${id}`,
    path: `/test/path/${id}`,
    branchName: `branch-${id}`,
    createdAt: new Date().toISOString(),
    isExternal: false,
  };
}

// Helper to create a mock project
function createProject(id: string, worktreeSessions: WorktreeSession[]): Project {
  return {
    id,
    name: `Project ${id}`,
    path: `/test/project/${id}`,

    isBare: false,
    isExpanded: true,
    worktreeSessions,
    createdAt: new Date().toISOString(),
  };
}

describe('WorktreeDropdownMenu', () => {
  const mockOnStartTerminal = vi.fn();
  const mockOnRemove = vi.fn();
  const mockOnOpenChange = vi.fn();
  const mockOnAssignShortcut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderMenu = () => {
    const session = createWorktreeSession('test-1');
    const project = createProject('p1', [session]);

    return render(
      <WorktreeDropdownMenu
        session={session}
        project={project}
        onStartTerminal={mockOnStartTerminal}
        onRemove={mockOnRemove}
        onOpenChange={mockOnOpenChange}
        onAssignShortcut={mockOnAssignShortcut}
      />
    );
  };

  it('renders the ellipsis trigger button', () => {
    renderMenu();
    expect(screen.getByRole('button', { name: 'Session menu' })).toBeInTheDocument();
  });

  it('trigger button has correct aria attributes', () => {
    renderMenu();
    const button = screen.getByRole('button', { name: 'Session menu' });
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('renders with worktree session', () => {
    renderMenu();
    expect(screen.getByRole('button', { name: 'Session menu' })).toBeInTheDocument();
  });

  it('renders without onAssignShortcut callback', () => {
    const session = createWorktreeSession('test-1');
    const project = createProject('p1', [session]);

    render(
      <WorktreeDropdownMenu
        session={session}
        project={project}
        onStartTerminal={mockOnStartTerminal}
        onRemove={mockOnRemove}
      />
    );

    expect(screen.getByRole('button', { name: 'Session menu' })).toBeInTheDocument();
  });
});
