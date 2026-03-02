import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepositoryContextMenu } from './RepositoryContextMenu';
import { createMockRepository } from '../../../../tests/utils';

// Mock Radix UI ContextMenu components
vi.mock('../ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="context-menu">{children}</div>
  ),
  ContextMenuTrigger: ({
    children,
    asChild: _asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <div data-testid="context-menu-trigger">{children}</div>,
  ContextMenuContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="context-menu-content" className={className}>
      {children}
    </div>
  ),
  ContextMenuItem: ({
    children,
    onClick,
    className,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    'data-testid'?: string;
  }) => (
    <button
      data-testid={props['data-testid'] || 'context-menu-item'}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  ),
  ContextMenuSeparator: () => <hr data-testid="context-menu-separator" />,
}));

describe('RepositoryContextMenu', () => {
  const mockOnDelete = vi.fn();
  const mockOnReview = vi.fn();
  const mockOnOpenSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the context menu wrapper', () => {
      const repository = createMockRepository({ id: 'proj-1', name: 'Test Project' });
      render(
        <RepositoryContextMenu repository={repository} onDelete={mockOnDelete}>
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      expect(screen.getByTestId('context-menu')).toBeInTheDocument();
    });

    it('renders children as trigger', () => {
      const repository = createMockRepository({ id: 'proj-1', name: 'Test Project' });
      render(
        <RepositoryContextMenu repository={repository} onDelete={mockOnDelete}>
          <span>My Trigger Content</span>
        </RepositoryContextMenu>
      );

      expect(screen.getByText('My Trigger Content')).toBeInTheDocument();
    });

    it('renders context menu content', () => {
      const repository = createMockRepository({ id: 'proj-1', name: 'Test Project' });
      render(
        <RepositoryContextMenu repository={repository} onDelete={mockOnDelete}>
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      expect(screen.getByTestId('context-menu-content')).toBeInTheDocument();
    });

    it('renders Delete Repository menu item', () => {
      const repository = createMockRepository({ id: 'proj-1', name: 'Test Project' });
      render(
        <RepositoryContextMenu repository={repository} onDelete={mockOnDelete}>
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      expect(screen.getByText('Delete Repository')).toBeInTheDocument();
    });

    it('renders trash icon in delete menu item', () => {
      const repository = createMockRepository({ id: 'proj-1', name: 'Test Project' });
      render(
        <RepositoryContextMenu repository={repository} onDelete={mockOnDelete}>
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      // Icon is rendered via lucide-react
      const menuItem = screen.getByTestId('context-menu-item');
      expect(menuItem.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onDelete with repository when Delete Repository is clicked', () => {
      const repository = createMockRepository({ id: 'repo-1', name: 'Test Repository' });
      render(
        <RepositoryContextMenu repository={repository} onDelete={mockOnDelete}>
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      fireEvent.click(screen.getByText('Delete Repository'));

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
      expect(mockOnDelete).toHaveBeenCalledWith(repository);
    });

    it('passes correct repository to onDelete for different repositories', () => {
      const repository1 = createMockRepository({ id: 'repo-1', name: 'Repository 1' });
      const repository2 = createMockRepository({ id: 'repo-2', name: 'Repository 2' });

      const { rerender } = render(
        <RepositoryContextMenu repository={repository1} onDelete={mockOnDelete}>
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      fireEvent.click(screen.getByText('Delete Repository'));
      expect(mockOnDelete).toHaveBeenCalledWith(repository1);

      mockOnDelete.mockClear();

      rerender(
        <RepositoryContextMenu repository={repository2} onDelete={mockOnDelete}>
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      fireEvent.click(screen.getByText('Delete Repository'));
      expect(mockOnDelete).toHaveBeenCalledWith(repository2);
    });
  });

  describe('styling', () => {
    it('applies width class to content', () => {
      const repository = createMockRepository({ id: 'proj-1', name: 'Test Project' });
      render(
        <RepositoryContextMenu repository={repository} onDelete={mockOnDelete}>
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      expect(screen.getByTestId('context-menu-content')).toHaveClass('w-48');
    });

    it('applies destructive styling to delete item', () => {
      const repository = createMockRepository({ id: 'proj-1', name: 'Test Project' });
      render(
        <RepositoryContextMenu repository={repository} onDelete={mockOnDelete}>
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      expect(screen.getByTestId('context-menu-item')).toHaveClass('text-destructive');
    });
  });

  describe('edge cases', () => {
    it('handles repository with minimal data', () => {
      const repository = createMockRepository({ id: 'r', name: '' });
      render(
        <RepositoryContextMenu repository={repository} onDelete={mockOnDelete}>
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      fireEvent.click(screen.getByText('Delete Repository'));
      expect(mockOnDelete).toHaveBeenCalledWith(repository);
    });

    it('handles multiple children as trigger', () => {
      const repository = createMockRepository({ id: 'proj-1', name: 'Test' });
      render(
        <RepositoryContextMenu repository={repository} onDelete={mockOnDelete}>
          <div>
            <span>Child 1</span>
            <span>Child 2</span>
          </div>
        </RepositoryContextMenu>
      );

      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
    });
  });

  describe('review changes', () => {
    it('renders Review Changes menu item when onReview is provided', () => {
      const repository = createMockRepository({ id: 'proj-1', name: 'Test Project' });
      render(
        <RepositoryContextMenu
          repository={repository}
          onDelete={mockOnDelete}
          onReview={mockOnReview}
        >
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      expect(screen.getByText('Review Changes')).toBeInTheDocument();
    });

    it('does not render Review Changes menu item when onReview is not provided', () => {
      const repository = createMockRepository({ id: 'proj-1', name: 'Test Project' });
      render(
        <RepositoryContextMenu repository={repository} onDelete={mockOnDelete}>
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      expect(screen.queryByText('Review Changes')).not.toBeInTheDocument();
    });

    it('calls onReview with repository when Review Changes is clicked', () => {
      const repository = createMockRepository({ id: 'repo-1', name: 'Test Repository' });
      render(
        <RepositoryContextMenu
          repository={repository}
          onDelete={mockOnDelete}
          onReview={mockOnReview}
        >
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      fireEvent.click(screen.getByText('Review Changes'));

      expect(mockOnReview).toHaveBeenCalledTimes(1);
      expect(mockOnReview).toHaveBeenCalledWith(repository);
    });

    it('renders separator between Review Changes and Delete', () => {
      const repository = createMockRepository({ id: 'proj-1', name: 'Test Project' });
      render(
        <RepositoryContextMenu
          repository={repository}
          onDelete={mockOnDelete}
          onReview={mockOnReview}
        >
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      expect(screen.getByTestId('context-menu-separator')).toBeInTheDocument();
    });
  });

  describe('repository settings', () => {
    it('renders Repository Settings menu item when onOpenSettings is provided', () => {
      const repository = createMockRepository({ id: 'proj-1', name: 'Test Project' });
      render(
        <RepositoryContextMenu
          repository={repository}
          onDelete={mockOnDelete}
          onOpenSettings={mockOnOpenSettings}
        >
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      expect(screen.getByText('Repository Settings')).toBeInTheDocument();
    });

    it('does not render Repository Settings menu item when onOpenSettings is not provided', () => {
      const repository = createMockRepository({ id: 'proj-1', name: 'Test Project' });
      render(
        <RepositoryContextMenu repository={repository} onDelete={mockOnDelete}>
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      expect(screen.queryByText('Repository Settings')).not.toBeInTheDocument();
    });

    it('calls onOpenSettings with repository when Repository Settings is clicked', () => {
      const repository = createMockRepository({ id: 'repo-1', name: 'Test Repository' });
      render(
        <RepositoryContextMenu
          repository={repository}
          onDelete={mockOnDelete}
          onOpenSettings={mockOnOpenSettings}
        >
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      fireEvent.click(screen.getByText('Repository Settings'));

      expect(mockOnOpenSettings).toHaveBeenCalledTimes(1);
      expect(mockOnOpenSettings).toHaveBeenCalledWith(repository);
    });

    it('renders settings icon in Repository Settings menu item', () => {
      const repository = createMockRepository({ id: 'proj-1', name: 'Test Project' });
      render(
        <RepositoryContextMenu
          repository={repository}
          onDelete={mockOnDelete}
          onOpenSettings={mockOnOpenSettings}
        >
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      const menuItem = screen.getByTestId('repository-settings-menu-item');
      expect(menuItem.querySelector('svg')).toBeInTheDocument();
    });

    it('renders separator between Repository Settings and Delete', () => {
      const repository = createMockRepository({ id: 'proj-1', name: 'Test Project' });
      render(
        <RepositoryContextMenu
          repository={repository}
          onDelete={mockOnDelete}
          onOpenSettings={mockOnOpenSettings}
        >
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      expect(screen.getByTestId('context-menu-separator')).toBeInTheDocument();
    });

    it('renders all options when both onOpenSettings and onReview are provided', () => {
      const repository = createMockRepository({ id: 'proj-1', name: 'Test Project' });
      render(
        <RepositoryContextMenu
          repository={repository}
          onDelete={mockOnDelete}
          onOpenSettings={mockOnOpenSettings}
          onReview={mockOnReview}
        >
          <span>Trigger</span>
        </RepositoryContextMenu>
      );

      expect(screen.getByText('Repository Settings')).toBeInTheDocument();
      expect(screen.getByText('Review Changes')).toBeInTheDocument();
      expect(screen.getByText('Delete Repository')).toBeInTheDocument();
      // Should have 2 separators: after Settings and after Review
      expect(screen.getAllByTestId('context-menu-separator')).toHaveLength(2);
    });
  });
});
