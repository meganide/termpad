import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GitHubRepoPicker } from './GitHubRepoPicker';
import type { GitHubRepo } from '../../shared/types';

const mockRepos: GitHubRepo[] = [
  {
    nameWithOwner: 'anthropics/claude-code',
    url: 'https://github.com/anthropics/claude-code.git',
    description: 'Claude Code CLI tool',
    isPrivate: false,
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    nameWithOwner: 'user/private-repo',
    url: 'https://github.com/user/private-repo.git',
    description: 'A private repository',
    isPrivate: true,
    updatedAt: '2024-01-14T10:00:00Z',
  },
  {
    nameWithOwner: 'org/project',
    url: 'https://github.com/org/project.git',
    description: null,
    isPrivate: false,
    updatedAt: '2024-01-13T10:00:00Z',
  },
];

describe('GitHubRepoPicker', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('renders loading indicator when isLoading is true', () => {
      render(<GitHubRepoPicker repos={[]} isLoading={true} error={null} onSelect={mockOnSelect} />);

      expect(screen.getByText('Loading repositories...')).toBeInTheDocument();
    });
  });

  describe('error states', () => {
    it('renders error message for gh CLI not installed', () => {
      const error = 'GitHub CLI not found. Install it from https://cli.github.com';
      render(
        <GitHubRepoPicker repos={[]} isLoading={false} error={error} onSelect={mockOnSelect} />
      );

      expect(screen.getByText('GitHub CLI Not Found')).toBeInTheDocument();
      expect(screen.getByText(error)).toBeInTheDocument();
      expect(screen.getByText('Install GitHub CLI')).toBeInTheDocument();
    });

    it('renders error message for not authenticated', () => {
      const error = 'Not logged in to GitHub. Run `gh auth login` in your terminal.';
      render(
        <GitHubRepoPicker repos={[]} isLoading={false} error={error} onSelect={mockOnSelect} />
      );

      expect(screen.getByText('Not Authenticated')).toBeInTheDocument();
      expect(screen.getByText(error)).toBeInTheDocument();
    });

    it('renders generic error message', () => {
      const error = 'Network error occurred';
      render(
        <GitHubRepoPicker repos={[]} isLoading={false} error={error} onSelect={mockOnSelect} />
      );

      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText(error)).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('renders empty state when no repos and no error', () => {
      render(
        <GitHubRepoPicker repos={[]} isLoading={false} error={null} onSelect={mockOnSelect} />
      );

      expect(screen.getByText('No repositories found.')).toBeInTheDocument();
    });
  });

  describe('repo list', () => {
    it('renders list of repositories', () => {
      render(
        <GitHubRepoPicker
          repos={mockRepos}
          isLoading={false}
          error={null}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('anthropics/claude-code')).toBeInTheDocument();
      expect(screen.getByText('Claude Code CLI tool')).toBeInTheDocument();
      expect(screen.getByText('user/private-repo')).toBeInTheDocument();
      expect(screen.getByText('A private repository')).toBeInTheDocument();
      expect(screen.getByText('org/project')).toBeInTheDocument();
    });

    it('calls onSelect with repo URL when clicking a repo', () => {
      render(
        <GitHubRepoPicker
          repos={mockRepos}
          isLoading={false}
          error={null}
          onSelect={mockOnSelect}
        />
      );

      fireEvent.click(screen.getByText('anthropics/claude-code'));

      expect(mockOnSelect).toHaveBeenCalledTimes(1);
      expect(mockOnSelect).toHaveBeenCalledWith('https://github.com/anthropics/claude-code.git');
    });
  });

  describe('search filtering', () => {
    it('filters repos by name', () => {
      render(
        <GitHubRepoPicker
          repos={mockRepos}
          isLoading={false}
          error={null}
          onSelect={mockOnSelect}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search repositories...');
      fireEvent.change(searchInput, { target: { value: 'claude' } });

      expect(screen.getByText('anthropics/claude-code')).toBeInTheDocument();
      expect(screen.queryByText('user/private-repo')).not.toBeInTheDocument();
      expect(screen.queryByText('org/project')).not.toBeInTheDocument();
    });

    it('filters repos by description', () => {
      render(
        <GitHubRepoPicker
          repos={mockRepos}
          isLoading={false}
          error={null}
          onSelect={mockOnSelect}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search repositories...');
      fireEvent.change(searchInput, { target: { value: 'private' } });

      expect(screen.queryByText('anthropics/claude-code')).not.toBeInTheDocument();
      expect(screen.getByText('user/private-repo')).toBeInTheDocument();
      expect(screen.queryByText('org/project')).not.toBeInTheDocument();
    });

    it('shows no results message when search has no matches', () => {
      render(
        <GitHubRepoPicker
          repos={mockRepos}
          isLoading={false}
          error={null}
          onSelect={mockOnSelect}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search repositories...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText('No repositories match your search.')).toBeInTheDocument();
    });

    it('is case insensitive', () => {
      render(
        <GitHubRepoPicker
          repos={mockRepos}
          isLoading={false}
          error={null}
          onSelect={mockOnSelect}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search repositories...');
      fireEvent.change(searchInput, { target: { value: 'CLAUDE' } });

      expect(screen.getByText('anthropics/claude-code')).toBeInTheDocument();
    });

    it('shows all repos when search is cleared', () => {
      render(
        <GitHubRepoPicker
          repos={mockRepos}
          isLoading={false}
          error={null}
          onSelect={mockOnSelect}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search repositories...');
      fireEvent.change(searchInput, { target: { value: 'claude' } });
      fireEvent.change(searchInput, { target: { value: '' } });

      expect(screen.getByText('anthropics/claude-code')).toBeInTheDocument();
      expect(screen.getByText('user/private-repo')).toBeInTheDocument();
      expect(screen.getByText('org/project')).toBeInTheDocument();
    });
  });
});
