import type { TodoItem, TodoStatus } from '../../../shared/types';

export const TODO_STATUSES: TodoStatus[] = ['backlog', 'in_progress', 'done'];
export const TODO_STATUS_LABELS: Record<TodoStatus, string> = {
  backlog: 'Backlog',
  in_progress: 'In progress',
  done: 'Done',
};
export const TODO_STATUS_COLORS: Record<TodoStatus, string> = {
  backlog: 'bg-muted-foreground',
  in_progress: 'bg-warning',
  done: 'bg-success',
};

export function getTodoStatus(todo: TodoItem): TodoStatus {
  return todo.status ?? (todo.completed ? 'done' : 'backlog');
}
