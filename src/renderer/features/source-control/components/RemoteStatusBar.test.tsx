import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RemoteStatusBar } from './RemoteStatusBar';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { AheadBehindResult } from '../../../../shared/types';

// Wrap component with TooltipProvider for tests
function renderWithProvider(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe('RemoteStatusBar', () => {
  const mockOnPush = vi.fn();
  const mockOnPull = vi.fn();
  const mockOnAddRemote = vi.fn();
  const mockOnCreatePR = vi.fn();

  const defaultAheadBehind: AheadBehindResult = {
    ahead: 0,
    behind: 0,
    hasRemote: true,
    remoteBranch: 'origin/feature-branch',
  };

  const defaultProps = {
    currentBranch: 'feature-branch',
    aheadBehind: defaultAheadBehind,
    remoteUrl: 'https://github.com/user/repo.git',
    onPush: mockOnPush,
    onPull: mockOnPull,
    onAddRemote: mockOnAddRemote,
    onCreatePR: mockOnCreatePR,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnPush.mockResolvedValue(undefined);
    mockOnPull.mockResolvedValue(undefined);
  });

  describe('rendering', () => {
    it('renders the component', () => {
      renderWithProvider(<RemoteStatusBar {...defaultProps} />);
      expect(screen.getByTestId('remote-status-bar')).toBeInTheDocument();
    });

    it('displays current branch name', () => {
      renderWithProvider(<RemoteStatusBar {...defaultProps} />);
      expect(screen.getByTestId('branch-name')).toHaveTextContent('feature-branch');
    });

    it('displays "No branch" when currentBranch is null', () => {
      renderWithProvider(<RemoteStatusBar {...defaultProps} currentBranch={null} />);
      expect(screen.getByTestId('branch-name')).toHaveTextContent('No branch');
    });
  });

  describe('ahead/behind badges', () => {
    it('shows ahead badge when ahead > 0', () => {
      renderWithProvider(
        <RemoteStatusBar {...defaultProps} aheadBehind={{ ...defaultAheadBehind, ahead: 3 }} />
      );
      expect(screen.getByTestId('ahead-badge')).toBeInTheDocument();
      expect(screen.getByTestId('ahead-badge')).toHaveTextContent('3');
    });

    it('shows behind badge when behind > 0', () => {
      renderWithProvider(
        <RemoteStatusBar {...defaultProps} aheadBehind={{ ...defaultAheadBehind, behind: 5 }} />
      );
      expect(screen.getByTestId('behind-badge')).toBeInTheDocument();
      expect(screen.getByTestId('behind-badge')).toHaveTextContent('5');
    });

    it('shows both badges when ahead and behind', () => {
      renderWithProvider(
        <RemoteStatusBar
          {...defaultProps}
          aheadBehind={{ ...defaultAheadBehind, ahead: 2, behind: 3 }}
        />
      );
      expect(screen.getByTestId('ahead-badge')).toHaveTextContent('2');
      expect(screen.getByTestId('behind-badge')).toHaveTextContent('3');
    });

    it('hides ahead badge when ahead is 0', () => {
      renderWithProvider(
        <RemoteStatusBar {...defaultProps} aheadBehind={{ ...defaultAheadBehind, ahead: 0 }} />
      );
      expect(screen.queryByTestId('ahead-badge')).not.toBeInTheDocument();
    });

    it('hides behind badge when behind is 0', () => {
      renderWithProvider(
        <RemoteStatusBar {...defaultProps} aheadBehind={{ ...defaultAheadBehind, behind: 0 }} />
      );
      expect(screen.queryByTestId('behind-badge')).not.toBeInTheDocument();
    });

    it('hides badges when no remote', () => {
      renderWithProvider(
        <RemoteStatusBar
          {...defaultProps}
          aheadBehind={{ ahead: 2, behind: 3, hasRemote: false }}
          remoteUrl={null}
        />
      );
      expect(screen.queryByTestId('ahead-behind-badges')).not.toBeInTheDocument();
    });
  });

  describe('push/pull buttons with remote', () => {
    it('renders push button when remote exists', () => {
      renderWithProvider(<RemoteStatusBar {...defaultProps} />);
      expect(screen.getByTestId('push-button')).toBeInTheDocument();
    });

    it('renders pull button when remote exists', () => {
      renderWithProvider(<RemoteStatusBar {...defaultProps} />);
      expect(screen.getByTestId('pull-button')).toBeInTheDocument();
    });

    it('calls onPush when push button is clicked', () => {
      renderWithProvider(<RemoteStatusBar {...defaultProps} />);
      fireEvent.click(screen.getByTestId('push-button'));
      expect(mockOnPush).toHaveBeenCalledTimes(1);
    });

    it('calls onPull when pull button is clicked', () => {
      renderWithProvider(<RemoteStatusBar {...defaultProps} />);
      fireEvent.click(screen.getByTestId('pull-button'));
      expect(mockOnPull).toHaveBeenCalledTimes(1);
    });

    it('disables push button when isPushLoading is true', () => {
      renderWithProvider(<RemoteStatusBar {...defaultProps} isPushLoading />);
      expect(screen.getByTestId('push-button')).toBeDisabled();
    });

    it('disables pull button when isPullLoading is true', () => {
      renderWithProvider(<RemoteStatusBar {...defaultProps} isPullLoading />);
      expect(screen.getByTestId('pull-button')).toBeDisabled();
    });

    it('disables both buttons when either is loading', () => {
      renderWithProvider(<RemoteStatusBar {...defaultProps} isPushLoading />);
      expect(screen.getByTestId('push-button')).toBeDisabled();
      expect(screen.getByTestId('pull-button')).toBeDisabled();
    });

    it('shows spinner on push button when isPushLoading', () => {
      renderWithProvider(<RemoteStatusBar {...defaultProps} isPushLoading />);
      expect(screen.getByTestId('push-spinner')).toBeInTheDocument();
    });

    it('shows spinner on pull button when isPullLoading', () => {
      renderWithProvider(<RemoteStatusBar {...defaultProps} isPullLoading />);
      expect(screen.getByTestId('pull-spinner')).toBeInTheDocument();
    });
  });

  describe('add remote button without remote', () => {
    const noRemoteProps = {
      ...defaultProps,
      aheadBehind: { ahead: 0, behind: 0, hasRemote: false },
      remoteUrl: null,
    };

    it('shows Add Remote button when no remote configured', () => {
      renderWithProvider(<RemoteStatusBar {...noRemoteProps} />);
      expect(screen.getByTestId('add-remote-button')).toBeInTheDocument();
      expect(screen.getByTestId('add-remote-button')).toHaveTextContent('Add Remote');
    });

    it('hides push/pull buttons when no remote', () => {
      renderWithProvider(<RemoteStatusBar {...noRemoteProps} />);
      expect(screen.queryByTestId('push-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pull-button')).not.toBeInTheDocument();
    });

    it('calls onAddRemote when Add Remote button is clicked', () => {
      renderWithProvider(<RemoteStatusBar {...noRemoteProps} />);
      fireEvent.click(screen.getByTestId('add-remote-button'));
      expect(mockOnAddRemote).toHaveBeenCalledTimes(1);
    });
  });

  describe('create PR button', () => {
    it('renders create PR button for GitHub repos', () => {
      renderWithProvider(<RemoteStatusBar {...defaultProps} />);
      expect(screen.getByTestId('create-pr-button')).toBeInTheDocument();
    });

    it('enables create PR button when there are commits ahead', () => {
      renderWithProvider(
        <RemoteStatusBar {...defaultProps} aheadBehind={{ ...defaultAheadBehind, ahead: 1 }} />
      );
      expect(screen.getByTestId('create-pr-button')).not.toBeDisabled();
    });

    it('enables create PR button even when no commits ahead', () => {
      renderWithProvider(
        <RemoteStatusBar {...defaultProps} aheadBehind={{ ...defaultAheadBehind, ahead: 0 }} />
      );
      expect(screen.getByTestId('create-pr-button')).not.toBeDisabled();
    });

    it('calls onCreatePR when clicked with commits ahead', () => {
      renderWithProvider(
        <RemoteStatusBar {...defaultProps} aheadBehind={{ ...defaultAheadBehind, ahead: 2 }} />
      );
      fireEvent.click(screen.getByTestId('create-pr-button'));
      expect(mockOnCreatePR).toHaveBeenCalledTimes(1);
    });

    it('calls onCreatePR when clicked without commits ahead', () => {
      renderWithProvider(
        <RemoteStatusBar {...defaultProps} aheadBehind={{ ...defaultAheadBehind, ahead: 0 }} />
      );
      fireEvent.click(screen.getByTestId('create-pr-button'));
      expect(mockOnCreatePR).toHaveBeenCalledTimes(1);
    });

    it('works with SSH GitHub URL', () => {
      renderWithProvider(
        <RemoteStatusBar
          {...defaultProps}
          remoteUrl="git@github.com:user/repo.git"
          aheadBehind={{ ...defaultAheadBehind, ahead: 1 }}
        />
      );
      expect(screen.getByTestId('create-pr-button')).not.toBeDisabled();
    });

    it('hides create PR button for non-GitHub repos', () => {
      renderWithProvider(
        <RemoteStatusBar {...defaultProps} remoteUrl="https://gitlab.com/user/repo.git" />
      );
      expect(screen.queryByTestId('create-pr-button')).not.toBeInTheDocument();
    });

    it('disables create PR button when loading', () => {
      renderWithProvider(
        <RemoteStatusBar
          {...defaultProps}
          aheadBehind={{ ...defaultAheadBehind, ahead: 1 }}
          isPushLoading
        />
      );
      expect(screen.getByTestId('create-pr-button')).toBeDisabled();
    });
  });

  describe('button styling', () => {
    it('highlights pull button when behind', () => {
      renderWithProvider(
        <RemoteStatusBar {...defaultProps} aheadBehind={{ ...defaultAheadBehind, behind: 2 }} />
      );
      expect(screen.getByTestId('pull-button')).toHaveClass('text-primary');
    });

    it('highlights push button when ahead', () => {
      renderWithProvider(
        <RemoteStatusBar {...defaultProps} aheadBehind={{ ...defaultAheadBehind, ahead: 2 }} />
      );
      expect(screen.getByTestId('push-button')).toHaveClass('text-primary');
    });

    it('does not highlight pull button when not behind', () => {
      renderWithProvider(
        <RemoteStatusBar {...defaultProps} aheadBehind={{ ...defaultAheadBehind, behind: 0 }} />
      );
      expect(screen.getByTestId('pull-button')).not.toHaveClass('text-primary');
    });

    it('does not highlight push button when not ahead', () => {
      renderWithProvider(
        <RemoteStatusBar {...defaultProps} aheadBehind={{ ...defaultAheadBehind, ahead: 0 }} />
      );
      expect(screen.getByTestId('push-button')).not.toHaveClass('text-primary');
    });
  });

  describe('no remote branch (new local branch)', () => {
    const noRemoteBranchAheadBehind: AheadBehindResult = {
      ahead: 0,
      behind: 0,
      hasRemote: true,
      // no remoteBranch - branch exists locally but not on remote
    };

    const noRemoteBranchProps = {
      ...defaultProps,
      aheadBehind: noRemoteBranchAheadBehind,
    };

    it('disables pull button when no remote branch', () => {
      renderWithProvider(<RemoteStatusBar {...noRemoteBranchProps} />);
      expect(screen.getByTestId('pull-button')).toBeDisabled();
    });

    it('enables push button when no remote branch', () => {
      renderWithProvider(<RemoteStatusBar {...noRemoteBranchProps} />);
      expect(screen.getByTestId('push-button')).not.toBeDisabled();
    });

    it('highlights push button when no remote branch', () => {
      renderWithProvider(<RemoteStatusBar {...noRemoteBranchProps} />);
      expect(screen.getByTestId('push-button')).toHaveClass('text-primary');
    });

    it('calls onPush when push button clicked with no remote branch', () => {
      renderWithProvider(<RemoteStatusBar {...noRemoteBranchProps} />);
      fireEvent.click(screen.getByTestId('push-button'));
      expect(mockOnPush).toHaveBeenCalledTimes(1);
    });

    it('does not call onPull when pull button clicked with no remote branch', () => {
      renderWithProvider(<RemoteStatusBar {...noRemoteBranchProps} />);
      fireEvent.click(screen.getByTestId('pull-button'));
      expect(mockOnPull).not.toHaveBeenCalled();
    });

    it('disables create PR button when no remote branch', () => {
      renderWithProvider(<RemoteStatusBar {...noRemoteBranchProps} />);
      expect(screen.getByTestId('create-pr-button')).toBeDisabled();
    });

    it('does not call onCreatePR when create PR button clicked with no remote branch', () => {
      renderWithProvider(<RemoteStatusBar {...noRemoteBranchProps} />);
      fireEvent.click(screen.getByTestId('create-pr-button'));
      expect(mockOnCreatePR).not.toHaveBeenCalled();
    });
  });
});
