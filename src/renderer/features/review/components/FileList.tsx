import { useState, useMemo } from 'react';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { FileTree } from './FileTree';
import type { DiffFile, DiffFileStatus } from '../../../../shared/reviewTypes';

interface FileListProps {
  files: DiffFile[];
  selectedFile: string | null;
  onFileSelect: (filePath: string) => void;
  isFileViewed: (filePath: string) => boolean;
  onToggleViewed: (filePath: string) => void;
}

type FilterStatus = DiffFileStatus | 'all';

export function FileList({
  files,
  selectedFile,
  onFileSelect,
  isFileViewed,
  onToggleViewed,
}: FileListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  const filteredFiles = useMemo(() => {
    let result = files;

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter((f) => f.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((f) => f.path.toLowerCase().includes(query));
    }

    return result;
  }, [files, searchQuery, statusFilter]);

  const viewedCount = files.filter((f) => isFileViewed(f.path)).length;

  // Stats for display
  const stats = useMemo(() => {
    return {
      total: files.length,
      added: files.filter((f) => f.status === 'added').length,
      modified: files.filter((f) => f.status === 'modified').length,
      deleted: files.filter((f) => f.status === 'deleted').length,
      renamed: files.filter((f) => f.status === 'renamed').length,
    };
  }, [files]);

  return (
    <div className="flex flex-col h-full">
      {/* Search and Filter */}
      <div className="p-3 border-b space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8"
            data-testid="file-search-input"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {viewedCount}/{files.length} viewed
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <Filter className="h-3.5 w-3.5 mr-1" />
                {statusFilter === 'all' ? 'All' : statusFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem
                checked={statusFilter === 'all'}
                onCheckedChange={() => setStatusFilter('all')}
              >
                All ({stats.total})
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilter === 'added'}
                onCheckedChange={() => setStatusFilter('added')}
              >
                <span className="text-green-500 mr-2">A</span>
                Added ({stats.added})
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilter === 'modified'}
                onCheckedChange={() => setStatusFilter('modified')}
              >
                <span className="text-yellow-500 mr-2">M</span>
                Modified ({stats.modified})
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilter === 'deleted'}
                onCheckedChange={() => setStatusFilter('deleted')}
              >
                <span className="text-red-500 mr-2">D</span>
                Deleted ({stats.deleted})
              </DropdownMenuCheckboxItem>
              {stats.renamed > 0 && (
                <DropdownMenuCheckboxItem
                  checked={statusFilter === 'renamed'}
                  onCheckedChange={() => setStatusFilter('renamed')}
                >
                  <span className="text-blue-500 mr-2">R</span>
                  Renamed ({stats.renamed})
                </DropdownMenuCheckboxItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* File Tree */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredFiles.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              {searchQuery ? 'No files match your search' : 'No changed files'}
            </div>
          ) : (
            <FileTree
              files={filteredFiles}
              selectedFile={selectedFile}
              onFileSelect={onFileSelect}
              isFileViewed={isFileViewed}
              onToggleViewed={onToggleViewed}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
