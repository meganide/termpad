import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileList } from './FileList';
import { FileListItem } from './FileListItem';
import type { DiffFile } from '../../../../shared/reviewTypes';

const mockFiles: DiffFile[] = [
  {
    path: 'src/components/Button.tsx',
    status: 'modified',
    additions: 10,
    deletions: 5,
    isBinary: false,
    hunks: [],
  },
  {
    path: 'src/utils/helpers.ts',
    status: 'added',
    additions: 50,
    deletions: 0,
    isBinary: false,
    hunks: [],
  },
  {
    path: 'src/old-file.ts',
    status: 'deleted',
    additions: 0,
    deletions: 30,
    isBinary: false,
    hunks: [],
  },
  {
    path: 'src/renamed.ts',
    oldPath: 'src/original.ts',
    status: 'renamed',
    additions: 2,
    deletions: 1,
    isBinary: false,
    hunks: [],
  },
  {
    path: 'assets/logo.png',
    status: 'modified',
    additions: 0,
    deletions: 0,
    isBinary: true,
    hunks: [],
  },
];

describe('FileListItem', () => {
  const mockOnToggleViewed = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render file name and path', () => {
    const file = mockFiles[0];
    render(
      <FileListItem
        file={file}
        isSelected={false}
        isViewed={false}
        onClick={vi.fn()}
        onToggleViewed={mockOnToggleViewed}
      />
    );

    expect(screen.getByText('Button.tsx')).toBeInTheDocument();
    expect(screen.getByText('src/components')).toBeInTheDocument();
  });

  it('should show additions and deletions', () => {
    const file = mockFiles[0];
    render(
      <FileListItem
        file={file}
        isSelected={false}
        isViewed={false}
        onClick={vi.fn()}
        onToggleViewed={mockOnToggleViewed}
      />
    );

    expect(screen.getByText('+10')).toBeInTheDocument();
    expect(screen.getByText('-5')).toBeInTheDocument();
  });

  it('should show viewed icon when file is viewed', () => {
    const file = mockFiles[0];
    render(
      <FileListItem
        file={file}
        isSelected={false}
        isViewed={true}
        onClick={vi.fn()}
        onToggleViewed={mockOnToggleViewed}
      />
    );

    expect(screen.getByTestId('viewed-icon')).toBeInTheDocument();
  });

  it('should show unviewed icon when file is not viewed', () => {
    const file = mockFiles[0];
    render(
      <FileListItem
        file={file}
        isSelected={false}
        isViewed={false}
        onClick={vi.fn()}
        onToggleViewed={mockOnToggleViewed}
      />
    );

    expect(screen.getByTestId('unviewed-icon')).toBeInTheDocument();
  });

  it('should call onClick when file item is clicked', () => {
    const file = mockFiles[0];
    const onClick = vi.fn();
    render(
      <FileListItem
        file={file}
        isSelected={false}
        isViewed={false}
        onClick={onClick}
        onToggleViewed={mockOnToggleViewed}
      />
    );

    // Click on the file name to trigger onClick (not the toggle button)
    fireEvent.click(screen.getByText('Button.tsx'));
    expect(onClick).toHaveBeenCalled();
  });

  it('should call onToggleViewed when toggle button is clicked', () => {
    const file = mockFiles[0];
    const onClick = vi.fn();
    render(
      <FileListItem
        file={file}
        isSelected={false}
        isViewed={false}
        onClick={onClick}
        onToggleViewed={mockOnToggleViewed}
      />
    );

    fireEvent.click(screen.getByTestId('toggle-viewed-button'));
    expect(mockOnToggleViewed).toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled(); // Should not trigger parent click
  });

  it('should show status indicator for added files', () => {
    const file = mockFiles[1];
    render(
      <FileListItem
        file={file}
        isSelected={false}
        isViewed={false}
        onClick={vi.fn()}
        onToggleViewed={mockOnToggleViewed}
      />
    );

    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('should show status indicator for deleted files', () => {
    const file = mockFiles[2];
    render(
      <FileListItem
        file={file}
        isSelected={false}
        isViewed={false}
        onClick={vi.fn()}
        onToggleViewed={mockOnToggleViewed}
      />
    );

    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('should show old path for renamed files', () => {
    const file = mockFiles[3];
    render(
      <FileListItem
        file={file}
        isSelected={false}
        isViewed={false}
        onClick={vi.fn()}
        onToggleViewed={mockOnToggleViewed}
      />
    );

    expect(screen.getByText('R')).toBeInTheDocument();
    expect(screen.getByText(/from:/)).toBeInTheDocument();
  });

  it('should show binary indicator for binary files', () => {
    const file = mockFiles[4];
    render(
      <FileListItem
        file={file}
        isSelected={false}
        isViewed={false}
        onClick={vi.fn()}
        onToggleViewed={mockOnToggleViewed}
      />
    );

    expect(screen.getByText('binary')).toBeInTheDocument();
  });
});

describe('FileList', () => {
  const mockOnFileSelect = vi.fn();
  const mockIsFileViewed = vi.fn().mockReturnValue(false);
  const mockOnToggleViewed = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFileViewed.mockReturnValue(false);
  });

  it('should render all files', () => {
    render(
      <FileList
        files={mockFiles}
        selectedFile={null}
        onFileSelect={mockOnFileSelect}
        isFileViewed={mockIsFileViewed}
        onToggleViewed={mockOnToggleViewed}
      />
    );

    expect(screen.getByText('Button.tsx')).toBeInTheDocument();
    expect(screen.getByText('helpers.ts')).toBeInTheDocument();
    expect(screen.getByText('old-file.ts')).toBeInTheDocument();
  });

  it('should have a search input that accepts text', () => {
    render(
      <FileList
        files={mockFiles}
        selectedFile={null}
        onFileSelect={mockOnFileSelect}
        isFileViewed={mockIsFileViewed}
        onToggleViewed={mockOnToggleViewed}
      />
    );

    const searchInput = screen.getByTestId('file-search-input');
    fireEvent.change(searchInput, { target: { value: 'Button' } });

    expect(searchInput).toHaveValue('Button');
  });

  it('should call onFileSelect when file is clicked', () => {
    render(
      <FileList
        files={mockFiles}
        selectedFile={null}
        onFileSelect={mockOnFileSelect}
        isFileViewed={mockIsFileViewed}
        onToggleViewed={mockOnToggleViewed}
      />
    );

    // Click on the file name
    fireEvent.click(screen.getByText('Button.tsx'));
    expect(mockOnFileSelect).toHaveBeenCalledWith('src/components/Button.tsx');
  });

  it('should call onToggleViewed when toggle button is clicked', () => {
    render(
      <FileList
        files={mockFiles}
        selectedFile={null}
        onFileSelect={mockOnFileSelect}
        isFileViewed={mockIsFileViewed}
        onToggleViewed={mockOnToggleViewed}
      />
    );

    // Find the toggle button for a specific file (tree sorts: folders first, then files)
    // Button.tsx is in src/components folder
    const buttonFileName = screen.getByText('Button.tsx');
    const fileRow = buttonFileName.closest('[role="button"]');
    const toggleButton = fileRow?.querySelector('[data-testid="toggle-viewed-button"]');
    expect(toggleButton).toBeTruthy();
    if (toggleButton) {
      fireEvent.click(toggleButton);
    }
    expect(mockOnToggleViewed).toHaveBeenCalledWith('src/components/Button.tsx');
    expect(mockOnFileSelect).not.toHaveBeenCalled();
  });

  it('should show file count in viewed indicator', () => {
    render(
      <FileList
        files={mockFiles}
        selectedFile={null}
        onFileSelect={mockOnFileSelect}
        isFileViewed={mockIsFileViewed}
        onToggleViewed={mockOnToggleViewed}
      />
    );

    // Viewed count shows "0/5 viewed" format
    expect(screen.getByText('0/5 viewed')).toBeInTheDocument();
  });

  it('should show viewed count', () => {
    mockIsFileViewed.mockImplementation((path: string) => path === 'src/components/Button.tsx');

    render(
      <FileList
        files={mockFiles}
        selectedFile={null}
        onFileSelect={mockOnFileSelect}
        isFileViewed={mockIsFileViewed}
        onToggleViewed={mockOnToggleViewed}
      />
    );

    expect(screen.getByText('1/5 viewed')).toBeInTheDocument();
  });

  it('should have filter dropdown button', () => {
    render(
      <FileList
        files={mockFiles}
        selectedFile={null}
        onFileSelect={mockOnFileSelect}
        isFileViewed={mockIsFileViewed}
        onToggleViewed={mockOnToggleViewed}
      />
    );

    // Filter button should exist
    const filterButton = screen.getByText('All');
    expect(filterButton).toBeInTheDocument();
  });

  it('should show empty state when no changed files', () => {
    render(
      <FileList
        files={[]}
        selectedFile={null}
        onFileSelect={mockOnFileSelect}
        isFileViewed={mockIsFileViewed}
        onToggleViewed={mockOnToggleViewed}
      />
    );

    expect(screen.getByText('No changed files')).toBeInTheDocument();
  });
});
