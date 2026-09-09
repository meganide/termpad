import type { TodoColumn } from './types';

export const DEFAULT_TODO_COLUMNS: TodoColumn[] = [
  { id: 'backlog', name: 'Backlog' },
  { id: 'in_progress', name: 'In progress' },
  { id: 'done', name: 'Done' },
];

// Older repositories have no column configuration. Always retain the statuses
// used by completion checkboxes and terminal actions, even with partial data.
export function getTodoColumns(saved?: TodoColumn[]): TodoColumn[] {
  const columns = [...new Map((saved ?? []).map((column) => [column.id, column])).values()];
  return [
    ...columns,
    ...DEFAULT_TODO_COLUMNS.filter((item) => !columns.some((c) => c.id === item.id)),
  ];
}
