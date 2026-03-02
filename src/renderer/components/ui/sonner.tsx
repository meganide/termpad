import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      richColors
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: 'shadow-lg break-all',
          actionButton: '!bg-primary !text-primary-foreground',
          cancelButton: '!bg-muted !text-muted-foreground',
        },
      }}
      style={
        {
          '--border-radius': 'var(--radius-lg)',
          // Default toast
          '--normal-bg': 'var(--color-card)',
          '--normal-text': 'var(--color-card-foreground)',
          '--normal-border': 'var(--color-border)',
          // Success toast
          '--success-bg': 'var(--color-primary-950)',
          '--success-text': 'var(--color-primary-100)',
          '--success-border': 'var(--color-primary-800)',
          // Error toast
          '--error-bg': 'var(--color-red-950)',
          '--error-text': 'var(--color-red-100)',
          '--error-border': 'var(--color-red-800)',
          // Warning toast
          '--warning-bg': 'var(--color-amber-950)',
          '--warning-text': 'var(--color-amber-100)',
          '--warning-border': 'var(--color-amber-800)',
          // Info toast
          '--info-bg': 'var(--color-blue-950)',
          '--info-text': 'var(--color-blue-100)',
          '--info-border': 'var(--color-blue-800)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
