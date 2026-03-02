import { cn } from '@/lib/utils';

interface SuccessIndicatorProps {
  show: boolean;
  className?: string;
}

export function SuccessIndicator({ show, className }: SuccessIndicatorProps) {
  return (
    <div
      className={cn(
        'h-0.5 bg-green-500 transition-all duration-500 ease-out',
        show ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{
        width: show ? '100%' : '0%',
        transitionProperty: 'width, opacity',
      }}
      data-testid="success-indicator"
    />
  );
}
