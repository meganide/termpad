import type { TodoPriority } from '../../../shared/types';

interface PriorityStyle {
  label: string;
  stripe: string;
  dot: string;
}

export const PRIORITY_STYLES: Record<TodoPriority, PriorityStyle> = {
  high: { label: 'High', stripe: 'bg-destructive', dot: 'bg-destructive' },
  medium: { label: 'Medium', stripe: 'bg-warning', dot: 'bg-warning' },
  low: { label: 'Low', stripe: 'bg-info', dot: 'bg-info' },
};

export const PRIORITY_ORDER: TodoPriority[] = ['high', 'medium', 'low'];
