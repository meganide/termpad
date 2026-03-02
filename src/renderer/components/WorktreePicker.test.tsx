import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WorktreePicker } from './WorktreePicker';
import type { WorktreeInfo } from '../../shared/types';

describe('WorktreePicker', () => {
  const mockWorktrees: WorktreeInfo[] = [
    {
      path: '/repos/project-feature-1',
      branch: 'feature-1',
      head: 'abc123',
      isMain: false,
      isBare: false,
      isLocked: false,
      prunable: false,
    },
    {
      path: '/repos/project-feature-2',
      branch: 'feature-2',
      head: 'def456',
      isMain: false,
      isBare: false,
      isLocked: true,
      prunable: false,
    },
    {
      path: '/repos/project-detached',
      branch: '',
      head: 'ghi789',
      isMain: false,
      isBare: false,
      isLocked: false,
      prunable: false,
    },
  ];

  describe('rendering', () => {
    it('renders nothing when worktrees array is empty', () => {
      const { container } = render(
        <WorktreePicker worktrees={[]} selectedPaths={new Set()} onSelectionChange={vi.fn()} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders a checkbox for each worktree plus toggle all', () => {
      render(
        <WorktreePicker
          worktrees={mockWorktrees}
          selectedPaths={new Set()}
          onSelectionChange={vi.fn()}
        />
      );
      const checkboxes = screen.getAllByRole('checkbox');
      // 3 worktrees + 1 "toggle all" checkbox
      expect(checkboxes).toHaveLength(4);
    });

    it('does not render toggle all when there is only one worktree', () => {
      render(
        <WorktreePicker
          worktrees={[mockWorktrees[0]]}
          selectedPaths={new Set()}
          onSelectionChange={vi.fn()}
        />
      );
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(1);
      expect(screen.queryByText('Select all')).not.toBeInTheDocument();
    });

    it('displays branch name for each worktree', () => {
      render(
        <WorktreePicker
          worktrees={mockWorktrees}
          selectedPaths={new Set()}
          onSelectionChange={vi.fn()}
        />
      );
      expect(screen.getByText('feature-1')).toBeInTheDocument();
      expect(screen.getByText('feature-2')).toBeInTheDocument();
    });

    it('displays "(detached HEAD)" for worktrees without branch', () => {
      render(
        <WorktreePicker
          worktrees={mockWorktrees}
          selectedPaths={new Set()}
          onSelectionChange={vi.fn()}
        />
      );
      expect(screen.getByText('(detached HEAD)')).toBeInTheDocument();
    });

    it('displays path for each worktree', () => {
      render(
        <WorktreePicker
          worktrees={mockWorktrees}
          selectedPaths={new Set()}
          onSelectionChange={vi.fn()}
        />
      );
      expect(screen.getByText('/repos/project-feature-1')).toBeInTheDocument();
      expect(screen.getByText('/repos/project-feature-2')).toBeInTheDocument();
      expect(screen.getByText('/repos/project-detached')).toBeInTheDocument();
    });

    it('shows lock icon for locked worktrees', () => {
      render(
        <WorktreePicker
          worktrees={mockWorktrees}
          selectedPaths={new Set()}
          onSelectionChange={vi.fn()}
        />
      );
      expect(screen.getByLabelText('Locked worktree')).toBeInTheDocument();
    });

    it('does not show lock icon for unlocked worktrees', () => {
      const unlockedWorktrees: WorktreeInfo[] = [
        {
          path: '/repos/project-feature',
          branch: 'feature',
          head: 'abc123',
          isMain: false,
          isBare: false,
          isLocked: false,
          prunable: false,
        },
      ];
      render(
        <WorktreePicker
          worktrees={unlockedWorktrees}
          selectedPaths={new Set()}
          onSelectionChange={vi.fn()}
        />
      );
      expect(screen.queryByLabelText('Locked worktree')).not.toBeInTheDocument();
    });
  });

  describe('selection state', () => {
    it('shows worktree checkboxes as unchecked by default when selectedPaths is empty', () => {
      render(
        <WorktreePicker
          worktrees={mockWorktrees}
          selectedPaths={new Set()}
          onSelectionChange={vi.fn()}
        />
      );
      const checkboxes = screen.getAllByRole('checkbox');
      // Skip toggle-all (index 0), check worktree checkboxes
      expect(checkboxes[1]).not.toBeChecked();
      expect(checkboxes[2]).not.toBeChecked();
      expect(checkboxes[3]).not.toBeChecked();
    });

    it('shows checkbox as checked when path is in selectedPaths', () => {
      const selectedPaths = new Set(['/repos/project-feature-1']);
      render(
        <WorktreePicker
          worktrees={mockWorktrees}
          selectedPaths={selectedPaths}
          onSelectionChange={vi.fn()}
        />
      );
      const checkboxes = screen.getAllByRole('checkbox');
      // Index 0 is toggle-all, indices 1-3 are worktree checkboxes
      expect(checkboxes[1]).toBeChecked();
      expect(checkboxes[2]).not.toBeChecked();
      expect(checkboxes[3]).not.toBeChecked();
    });

    it('shows multiple checkboxes as checked when multiple paths are selected', () => {
      const selectedPaths = new Set(['/repos/project-feature-1', '/repos/project-feature-2']);
      render(
        <WorktreePicker
          worktrees={mockWorktrees}
          selectedPaths={selectedPaths}
          onSelectionChange={vi.fn()}
        />
      );
      const checkboxes = screen.getAllByRole('checkbox');
      // Index 0 is toggle-all, indices 1-3 are worktree checkboxes
      expect(checkboxes[1]).toBeChecked();
      expect(checkboxes[2]).toBeChecked();
      expect(checkboxes[3]).not.toBeChecked();
    });

    it('shows toggle-all as checked when all worktrees are selected', () => {
      const selectedPaths = new Set([
        '/repos/project-feature-1',
        '/repos/project-feature-2',
        '/repos/project-detached',
      ]);
      render(
        <WorktreePicker
          worktrees={mockWorktrees}
          selectedPaths={selectedPaths}
          onSelectionChange={vi.fn()}
        />
      );
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeChecked(); // toggle-all
      expect(screen.getByText('Deselect all')).toBeInTheDocument();
    });

    it('shows Select all label when not all selected', () => {
      const selectedPaths = new Set(['/repos/project-feature-1']);
      render(
        <WorktreePicker
          worktrees={mockWorktrees}
          selectedPaths={selectedPaths}
          onSelectionChange={vi.fn()}
        />
      );
      expect(screen.getByText('Select all')).toBeInTheDocument();
    });
  });

  describe('selection changes', () => {
    it('calls onSelectionChange with path added when checkbox is checked', () => {
      const onSelectionChange = vi.fn();
      render(
        <WorktreePicker
          worktrees={mockWorktrees}
          selectedPaths={new Set()}
          onSelectionChange={onSelectionChange}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      // Index 0 is toggle-all, index 1 is first worktree
      fireEvent.click(checkboxes[1]);

      expect(onSelectionChange).toHaveBeenCalledWith(new Set(['/repos/project-feature-1']));
    });

    it('calls onSelectionChange with path removed when checkbox is unchecked', () => {
      const onSelectionChange = vi.fn();
      const selectedPaths = new Set(['/repos/project-feature-1']);
      render(
        <WorktreePicker
          worktrees={mockWorktrees}
          selectedPaths={selectedPaths}
          onSelectionChange={onSelectionChange}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      // Index 0 is toggle-all, index 1 is first worktree (which is checked)
      fireEvent.click(checkboxes[1]);

      expect(onSelectionChange).toHaveBeenCalledWith(new Set());
    });

    it('preserves existing selections when adding new selection', () => {
      const onSelectionChange = vi.fn();
      const selectedPaths = new Set(['/repos/project-feature-1']);
      render(
        <WorktreePicker
          worktrees={mockWorktrees}
          selectedPaths={selectedPaths}
          onSelectionChange={onSelectionChange}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      // Index 0 is toggle-all, index 2 is second worktree
      fireEvent.click(checkboxes[2]);

      expect(onSelectionChange).toHaveBeenCalledWith(
        new Set(['/repos/project-feature-1', '/repos/project-feature-2'])
      );
    });

    it('preserves other selections when removing one selection', () => {
      const onSelectionChange = vi.fn();
      const selectedPaths = new Set(['/repos/project-feature-1', '/repos/project-feature-2']);
      render(
        <WorktreePicker
          worktrees={mockWorktrees}
          selectedPaths={selectedPaths}
          onSelectionChange={onSelectionChange}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      // Index 0 is toggle-all, index 1 is first worktree
      fireEvent.click(checkboxes[1]);

      expect(onSelectionChange).toHaveBeenCalledWith(new Set(['/repos/project-feature-2']));
    });

    it('selects all when toggle-all is clicked and nothing selected', () => {
      const onSelectionChange = vi.fn();
      render(
        <WorktreePicker
          worktrees={mockWorktrees}
          selectedPaths={new Set()}
          onSelectionChange={onSelectionChange}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]); // toggle-all

      expect(onSelectionChange).toHaveBeenCalledWith(
        new Set(['/repos/project-feature-1', '/repos/project-feature-2', '/repos/project-detached'])
      );
    });

    it('deselects all when toggle-all is clicked and all selected', () => {
      const onSelectionChange = vi.fn();
      const selectedPaths = new Set([
        '/repos/project-feature-1',
        '/repos/project-feature-2',
        '/repos/project-detached',
      ]);
      render(
        <WorktreePicker
          worktrees={mockWorktrees}
          selectedPaths={selectedPaths}
          onSelectionChange={onSelectionChange}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]); // toggle-all

      expect(onSelectionChange).toHaveBeenCalledWith(new Set());
    });
  });
});
