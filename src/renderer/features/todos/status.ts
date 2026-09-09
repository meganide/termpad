import type { TodoItem, TodoStatus } from '../../../shared/types';

export const TODO_STATUS_COLORS: Partial<Record<TodoStatus, string>> = {
  backlog: 'bg-muted-foreground',
  in_progress: 'bg-warning',
  done: 'bg-success',
};

export function getTodoStatus(todo: TodoItem): TodoStatus {
  return todo.status ?? (todo.completed ? 'done' : 'backlog');
}
